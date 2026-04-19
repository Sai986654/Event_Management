import axios from 'axios';

// Trailing slash + paths without a leading slash avoids wrong URLs like host/login
const rawBase = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const API_BASE_URL = `${rawBase.replace(/\/+$/, '')}/`;
const COLD_START_RETRY_TIMEOUT = 25000;
const COLD_START_POLL_INTERVAL = 2000;

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
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

// Add token to every request
api.interceptors.request.use((config) => {
  if (typeof config.url === 'string' && config.url.startsWith('/')) {
    config.url = config.url.slice(1);
  }
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle response errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
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

export default api;
