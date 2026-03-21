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

  updatePackage: async (packageId, payload) => {
    const response = await api.put(`/packages/${packageId}`, payload);
    return response.data;
  },

  deletePackage: async (packageId) => {
    const response = await api.delete(`/packages/${packageId}`);
    return response.data;
  },

  addTestimonial: async (payload) => {
    const response = await api.post('/packages/testimonials', payload);
    return response.data;
  },

  getVendorTestimonials: async (vendorId) => {
    const response = await api.get(`/packages/vendor/${vendorId}/testimonials`);
    return response.data;
  },
};
