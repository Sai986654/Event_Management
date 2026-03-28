import api from './api';

export const appNotificationService = {
  list: async (params = {}) => {
    const response = await api.get('app-notifications', { params });
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
};
