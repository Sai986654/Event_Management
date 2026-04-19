import api from './api';

export const aiService = {
  getSuggestions: async (eventId, preferences = {}) => {
    const response = await api.post('/ai/suggestions', {
      eventId,
      ...preferences,
    });
    return response.data;
  },

  getVendorFitScores: async (eventId, category) => {
    const response = await api.post('/ai/vendor-fit', {
      eventId,
      category,
    });
    return response.data;
  },

  suggestVendors: async (eventId, category, budget) => {
    const response = await api.post('/ai/suggest-vendors', {
      eventId,
      category,
      budget,
    });
    return response.data;
  },

  suggestTheme: async (eventType, budget, guestCount) => {
    const response = await api.post('/ai/suggest-theme', {
      eventType,
      budget,
      guestCount,
    });
    return response.data;
  },

  generateTimeline: async (eventId, preferences) => {
    const response = await api.post('/ai/generate-timeline', {
      eventId,
      ...preferences,
    });
    return response.data;
  },

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

  generateChecklist: async (eventId) => {
    const response = await api.post('/ai/generate-checklist', { eventId });
    return response.data;
  },

  getVendorReviewSummary: async (vendorId) => {
    const response = await api.get(`/ai/vendor/${vendorId}/review-summary`);
    return response.data;
  },

  getPostEventInsights: async (eventId) => {
    const response = await api.post(`/ai/event/${eventId}/post-event-insights`);
    return response.data;
  },
};
