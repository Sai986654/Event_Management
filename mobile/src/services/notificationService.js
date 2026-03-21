import api from './api';

export const notificationService = {
  analyzeContacts: async (contacts) => {
    const response = await api.post('/notifications/contacts/analyze', { contacts });
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
