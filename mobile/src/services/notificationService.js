import api from './api';

export const notificationService = {
  analyzeContacts: async (payload) => {
    const response = await api.post('/notifications/contacts/analyze', payload);
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
