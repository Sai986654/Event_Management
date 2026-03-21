import api from './api';

export const aiService = {
  generatePlannerCopilot: async (eventId) => {
    const response = await api.post('/ai/planner-copilot', { eventId });
    return response.data;
  },

  optimizeBudget: async (payload) => {
    const response = await api.post('/ai/budget-optimizer', payload);
    return response.data;
  },

  autoRebalance: async (payload) => {
    const response = await api.post('/ai/auto-rebalance', payload);
    return response.data;
  },

  createEventCollage: async (eventId, style = 'traditional') => {
    const response = await api.post(`/ai/collage/event/${eventId}`, { style });
    return response.data;
  },

  getEventCollageStatus: async (eventId) => {
    const response = await api.get(`/ai/collage/event/${eventId}/status`);
    return response.data;
  },
};
