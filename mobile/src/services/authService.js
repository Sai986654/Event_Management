import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';
import { appNotificationService } from './appNotificationService';

const EXPO_PUSH_TOKEN_KEY = 'expoPushToken';

export const authService = {
  register: async (userData) => {
    const response = await api.post('/auth/register', userData);
    if (response.data.token) {
      await AsyncStorage.setItem('token', response.data.token);
      await AsyncStorage.setItem('user', JSON.stringify(response.data.user));
    }
    return response.data;
  },

  login: async (credentials) => {
    const response = await api.post('/auth/login', credentials);
    if (response.data.token) {
      await AsyncStorage.setItem('token', response.data.token);
      await AsyncStorage.setItem('user', JSON.stringify(response.data.user));
    }
    return response.data;
  },

  logout: async () => {
    const expoPushToken = await AsyncStorage.getItem(EXPO_PUSH_TOKEN_KEY);
    if (expoPushToken) {
      try {
        await appNotificationService.unregisterDevice(expoPushToken);
      } catch (error) {
        console.warn('Failed to unregister push token during logout', error?.message || error);
      }
    }
    await AsyncStorage.multiRemove(['token', 'user', EXPO_PUSH_TOKEN_KEY]);
  },

  getCurrentUser: async () => {
    const user = await AsyncStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },

  getToken: async () => {
    return await AsyncStorage.getItem('token');
  },

  getProfile: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },

  updateProfile: async (data) => {
    const response = await api.put('/auth/profile', data);
    if (response.data.user) {
      await AsyncStorage.setItem('user', JSON.stringify(response.data.user));
    }
    return response.data;
  },

  uploadAvatar: async (file) => {
    const formData = new FormData();
    formData.append('file', {
      uri: file.uri,
      name: file.fileName || 'avatar.jpg',
      type: file.mimeType || 'image/jpeg',
    });

    const response = await api.post('/auth/profile/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    if (response.data.user) {
      await AsyncStorage.setItem('user', JSON.stringify(response.data.user));
    }
    return response.data;
  },

  changePassword: async (payload) => {
    const response = await api.put('/auth/password', payload);
    return response.data;
  },

  deleteAccount: async (payload) => {
    const response = await api.delete('/auth/account', { data: payload });
    return response.data;
  },
};
