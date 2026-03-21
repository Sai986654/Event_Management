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
};
