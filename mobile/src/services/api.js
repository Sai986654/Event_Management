import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Change this to your backend IP/URL
// For local dev with Expo Go on physical device, use your computer's LAN IP
// e.g., 'http://192.168.1.100:5000/api'
const API_BASE_URL = 'https://lionlike-flavourlessly-neida.ngrok-free.dev/api'; // Android emulator → host machine

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// Attach token to every request
api.interceptors.request.use(async (config) => {
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
