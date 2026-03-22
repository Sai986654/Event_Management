import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const rawBase =
  process.env.EXPO_PUBLIC_API_URL ||
  'https://event-management-9i4d.onrender.com/api';
const API_BASE_URL = `${String(rawBase).replace(/\/+$/, '')}/`;

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

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
    }
    return Promise.reject(error);
  }
);

export const setBaseURL = (url) => {
  api.defaults.baseURL = url;
};

export default api;
