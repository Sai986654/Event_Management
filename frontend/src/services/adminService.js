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

  // Invite template management
  getInviteTemplates: async () => {
    const response = await api.get('/admin/invite-templates');
    return response.data;
  },
  validateAdobeExpressManifest: async (manifestPayload) => {
    const response = await api.post('/admin/invite-templates/adobe-express/validate', manifestPayload);
    return response.data;
  },
  importAdobeExpressManifest: async (payload) => {
    const response = await api.post('/admin/invite-templates/adobe-express/import', payload);
    return response.data;
  },
  uploadAdobeExpressAsset: async ({ file, templateKey }) => {
    const formData = new FormData();
    formData.append('file', file);
    if (templateKey) formData.append('templateKey', templateKey);
    const response = await api.post('/admin/invite-templates/adobe-express/assets', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
  createInviteTemplate: async (payload) => {
    const response = await api.post('/admin/invite-templates', payload);
    return response.data;
  },
  updateInviteTemplate: async (id, payload) => {
    const response = await api.patch(`/admin/invite-templates/${id}`, payload);
    return response.data;
  },
  deleteInviteTemplate: async (id) => {
    const response = await api.delete(`/admin/invite-templates/${id}`);
    return response.data;
  },

  // Dynamic invite template engine
  getTemplateEngineThemes: async () => {
    const response = await api.get('/admin/invite-template-engine/themes');
    return response.data;
  },
  listTemplateEngineTemplates: async () => {
    const response = await api.get('/admin/invite-template-engine/templates');
    return response.data;
  },
  getTemplateEngineTemplateById: async (id) => {
    const response = await api.get(`/admin/invite-template-engine/templates/${id}`);
    return response.data;
  },
  createTemplateEngineTemplate: async (payload) => {
    const response = await api.post('/admin/invite-template-engine/templates', payload);
    return response.data;
  },
  updateTemplateEngineTemplate: async (id, payload) => {
    const response = await api.patch(`/admin/invite-template-engine/templates/${id}`, payload);
    return response.data;
  },
  reorderTemplateEngineSections: async (id, sectionOrder) => {
    const response = await api.post(`/admin/invite-template-engine/templates/${id}/reorder-sections`, {
      sectionOrder,
    });
    return response.data;
  },
  uploadTemplateEngineAsset: async ({ id, file }) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post(`/admin/invite-template-engine/templates/${id}/assets`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
  previewTemplateEngineTemplate: async (payload) => {
    const response = await api.post('/admin/invite-template-engine/templates/preview', payload);
    return response.data;
  },
  publishTemplateEngineTemplate: async (id, status = 'published') => {
    const response = await api.post(`/admin/invite-template-engine/templates/${id}/publish`, { status });
    return response.data;
  },
  generateTemplateEngineFromAI: async (payload) => {
    const response = await api.post('/admin/invite-template-engine/templates/ai-generate', payload);
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

  syncGoogleFormVendors: async (payload) => {
    const response = await api.post('/admin/vendors/sync-google-forms', payload);
    return response.data;
  },

  syncGooglePlacesVendors: async (payload) => {
    const response = await api.post('/admin/vendors/sync-google-places', payload);
    return response.data;
  },

  getPaymentConfigurations: async () => {
    const response = await api.get('/payments/configurations');
    return response.data;
  },

  upsertPaymentConfiguration: async (entityType, payload) => {
    const response = await api.put(`/payments/configurations/${entityType}`, payload);
    return response.data;
  },
};
