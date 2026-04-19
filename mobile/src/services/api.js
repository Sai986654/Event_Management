import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const rawBase =
  process.env.EXPO_PUBLIC_API_URL ||
  'https://event-management-9i4d.onrender.com/api';
const API_BASE_URL = `${String(rawBase).replace(/\/+$/, '')}/`;
const COLD_START_RETRY_TIMEOUT = 45000;
const COLD_START_POLL_INTERVAL = 2500;

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

const getHealthUrl = (baseURL = api.defaults.baseURL || API_BASE_URL) =>
  `${String(baseURL).replace(/\/+$/, '').replace(/\/api$/, '')}/api/health`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isColdStartError = (error) => {
  if (!error) return false;

  if (error.response?.status === 503) return true;
  if (error.code === 'ECONNABORTED') return true;

  return !error.response && /network error|timeout/i.test(String(error.message || ''));
};

export const warmUpBackend = async (baseURL) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < COLD_START_RETRY_TIMEOUT) {
    try {
      const response = await axios.get(getHealthUrl(baseURL), {
        timeout: COLD_START_POLL_INTERVAL,
        headers: { 'Cache-Control': 'no-cache' },
      });

      if (response.status >= 200 && response.status < 300) {
        return true;
      }
    } catch (error) {
      if (error.response?.status !== 503) {
        return false;
      }
    }

    await sleep(COLD_START_POLL_INTERVAL);
  }

  return false;
};

// Attach token to every request
api.interceptors.request.use(async (config) => {
  if (typeof config.url === 'string' && config.url.startsWith('/')) {
    config.url = config.url.slice(1);
  }
  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 globally
let logoutCallback = null;
export const setLogoutHandler = (cb) => {
  logoutCallback = cb;
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await AsyncStorage.multiRemove(['token', 'user']);
      if (logoutCallback) logoutCallback();
      return Promise.reject(error);
    }

    const originalRequest = error.config;
    if (!originalRequest || originalRequest.__coldStartRetried || !isColdStartError(error)) {
      return Promise.reject(error);
    }

    originalRequest.__coldStartRetried = true;
    originalRequest.timeout = Math.max(originalRequest.timeout || 0, COLD_START_RETRY_TIMEOUT);

    await warmUpBackend(originalRequest.baseURL || api.defaults.baseURL);
    return api(originalRequest);
  }
);

export const setBaseURL = (url) => {
  api.defaults.baseURL = url;
};

export default api;
