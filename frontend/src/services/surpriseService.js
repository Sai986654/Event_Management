import api from './api';

export const surpriseService = {
  // Templates (public)
  getTemplates: async (params = {}) => {
    const response = await api.get('/surprises/templates', { params });
    return response.data;
  },

  getTemplate: async (id) => {
    const response = await api.get(`/surprises/templates/${id}`);
    return response.data;
  },

  // Surprise Pages (auth)
  createSurprisePage: async (data) => {
    const response = await api.post('/surprises', data);
    return response.data;
  },

  getMySurprisePages: async (params = {}) => {
    const response = await api.get('/surprises', { params });
    return response.data;
  },

  getSurprisePage: async (id) => {
    const response = await api.get(`/surprises/${id}`);
    return response.data;
  },

  updateSurprisePage: async (id, data) => {
    const response = await api.put(`/surprises/${id}`, data);
    return response.data;
  },

  deleteSurprisePage: async (id) => {
    const response = await api.delete(`/surprises/${id}`);
    return response.data;
  },

  getAnalytics: async (id) => {
    const response = await api.get(`/surprises/${id}/analytics`);
    return response.data;
  },

  // Public viewer (no auth)
  viewBySlug: async (slug, password) => {
    const params = password ? { password } : {};
    const response = await api.get(`/surprises/view/${slug}`, { params });
    return response.data;
  },

  trackInteraction: async (slug, data) => {
    const response = await api.post(`/surprises/view/${slug}/interact`, data);
    return response.data;
  },

  // Publish / Deploy
  publishPage: async (id, deployTarget = 'auto') => {
    const response = await api.post(`/surprises/${id}/publish`, { deployTarget });
    return response.data;
  },

  unpublishPage: async (id) => {
    const response = await api.post(`/surprises/${id}/unpublish`);
    return response.data;
  },
};
