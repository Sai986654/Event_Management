import api from './api';

export const vendorService = {
  searchVendors: async (params = {}) => {
    const response = await api.get('/vendors', { params });
    return response.data;
  },

  getVendorById: async (vendorId) => {
    const response = await api.get(`/vendors/${vendorId}`);
    return response.data;
  },

  getVendorsByCategory: async (category) => {
    const response = await api.get('/vendors', { params: { category } });
    return response.data;
  },

  createVendorProfile: async (vendorData) => {
    const response = await api.post('/vendors', vendorData);
    return response.data;
  },

  updateVendorProfile: async (vendorId, vendorData) => {
    const response = await api.put(`/vendors/${vendorId}`, vendorData);
    return response.data;
  },

  getVendorReviews: async (vendorId) => {
    const response = await api.get(`/vendors/${vendorId}/reviews`);
    return response.data;
  },

};
