import api from './api';

export const appNotificationService = {
  list: async (params = {}) => {
    const response = await api.get('app-notifications', { params });
    return response.data;
  },

  registerDevice: async (payload) => {
    const response = await api.post('app-notifications/devices', payload);
    return response.data;
  },

  unregisterDevice: async (expoPushToken) => {
    const response = await api.delete('app-notifications/devices', {
      data: { expoPushToken },
    });
    return response.data;
  },

  markRead: async (id) => {
    const response = await api.put(`app-notifications/${id}/read`);
    return response.data;
  },

  markAllRead: async () => {
    const response = await api.put('app-notifications/read-all');
    return response.data;
  },

  deleteOne: async (id) => {
    const response = await api.delete(`app-notifications/${id}`);
    return response.data;
  },

  deleteAll: async () => {
    const response = await api.delete('app-notifications/delete-all');
    return response.data;
  },
};
