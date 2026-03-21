import api from './api';

export const activityService = {
  getByOrder: async (orderId) => {
    const response = await api.get(`/activities/order/${orderId}`);
    return response.data;
  },

  updateProgress: async (activityId, payload) => {
    const response = await api.patch(`/activities/${activityId}/progress`, payload);
    return response.data;
  },
};
