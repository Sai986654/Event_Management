import api from './api';

export const inviteDesignService = {
  getTemplates: async () => {
    const response = await api.get('/invites/templates');
    return response.data;
  },

  listDesigns: async (eventId) => {
    const response = await api.get('/invites/designs', { params: { eventId: Number(eventId) } });
    return response.data;
  },

  createDesign: async (payload) => {
    const response = await api.post('/invites/designs', payload);
    return response.data;
  },

  getDesign: async (designId) => {
    const response = await api.get(`/invites/designs/${designId}`);
    return response.data;
  },

  updateDesign: async (designId, payload) => {
    const response = await api.patch(`/invites/designs/${designId}`, payload);
    return response.data;
  },

  duplicateDesign: async (designId, payload = {}) => {
    const response = await api.post(`/invites/designs/${designId}/duplicate`, payload);
    return response.data;
  },

  exportDesign: async (designId, payload) => {
    const response = await api.post(`/invites/designs/${designId}/export`, payload);
    return response.data;
  },

  listExports: async (designId) => {
    const response = await api.get(`/invites/designs/${designId}/exports`);
    return response.data;
  },

  personalizeGuest: async (designId, guestId, payload = {}) => {
    const response = await api.post(`/invites/designs/${designId}/personalize/${guestId}`, payload);
    return response.data;
  },

  generateAndSend: async (designId, payload = {}) => {
    const response = await api.post(`/invites/designs/${designId}/send`, payload);
    return response.data;
  },
};
