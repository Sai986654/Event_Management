import api from './api';

export const packageService = {
  getPublicPackages: async (params = {}) => {
    const response = await api.get('/packages', { params });
    return response.data;
  },

  getMyPackages: async () => {
    const response = await api.get('/packages/mine');
    return response.data;
  },

  createPackage: async (payload) => {
    const response = await api.post('/packages', payload);
    return response.data;
  },

  updatePackage: async (id, payload) => {
    const response = await api.put(`/packages/${id}`, payload);
    return response.data;
  },

  deletePackage: async (id) => {
    const response = await api.delete(`/packages/${id}`);
    return response.data;
  },

  addTestimonial: async (payload) => {
    const response = await api.post('/packages/testimonials', payload);
    return response.data;
  },
};
