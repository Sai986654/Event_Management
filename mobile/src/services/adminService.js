import api from './api';

export const adminService = {
  verifyVendor: async (vendorId, status, notes = '') => {
    const response = await api.patch(`/admin/vendors/${vendorId}/verify`, { status, notes });
    return response.data;
  },

  createUser: async (payload) => {
    const response = await api.post('/admin/users', payload);
    return response.data;
  },

  // Category management
  getCategories: async () => {
    const response = await api.get('/admin/categories');
    return response.data;
  },
  createCategory: async (payload) => {
    const response = await api.post('/admin/categories', payload);
    return response.data;
  },
  deleteCategory: async (id) => {
    const response = await api.delete(`/admin/categories/${id}`);
    return response.data;
  },

  // Vendor management
  getAllVendors: async (params = {}) => {
    const response = await api.get('/admin/vendors', { params });
    return response.data;
  },
  deleteVendor: async (id) => {
    const response = await api.delete(`/admin/vendors/${id}`);
    return response.data;
  },
};
