import api from './api';

const CONTACT_INTEL_HTTP_TIMEOUT_MS = 180000;

export const notificationService = {
  analyzeContacts: async (payload) => {
    const response = await api.post('/notifications/contacts/analyze', payload, {
      timeout: CONTACT_INTEL_HTTP_TIMEOUT_MS,
    });
    return response.data;
  },

  correlateContacts: async (payload) => {
    const response = await api.post('/notifications/contacts/correlate', payload, {
      timeout: CONTACT_INTEL_HTTP_TIMEOUT_MS,
    });
    return response.data;
  },

  sendWhatsAppReminders: async ({ eventId, group = 'all', message, templateName }) => {
    const response = await api.post(`/notifications/events/${eventId}/reminders/whatsapp`, {
      group,
      message,
      templateName,
    });
    return response.data;
  },
};
