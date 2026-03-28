import api from './api';

/** Groq/OpenAI runs many batches; large CSVs often need 1–3+ minutes. Default axios timeout is 10s. */
const CONTACT_INTEL_HTTP_TIMEOUT_MS = 180000;

export const notificationService = {
  /**
   * @param {{ contacts?: object[], csv?: string, useOpenAi?: boolean, listOwnerContext?: string, listOwnerNotes?: string }} payload
   */
  analyzeContacts: async (payload) => {
    const response = await api.post('/notifications/contacts/analyze', payload, {
      timeout: CONTACT_INTEL_HTTP_TIMEOUT_MS,
    });
    return response.data;
  },

  /**
   * Multi-select correlation for analyzed contacts (LLM on server).
   * @param {{ contacts: object[], listOwnerContext?: string, listOwnerNotes?: string }} payload
   */
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

  /** Progress / reminder text to every guest with a phone (organizer or admin). */
  sendGuestWhatsAppBroadcast: async (eventId, { message, templateName } = {}) => {
    const response = await api.post(`/notifications/events/${eventId}/guests/whatsapp-broadcast`, {
      message,
      templateName,
    });
    return response.data;
  },

  sendReminder: async (eventId, recipientType) => {
    const response = await api.post('/notifications/send-reminder', {
      eventId,
      recipientType,
    });
    return response.data;
  },

  sendBookingConfirmation: async (bookingId) => {
    const response = await api.post('/notifications/booking-confirmation', { bookingId });
    return response.data;
  },

  sendRsvpConfirmation: async (guestId) => {
    const response = await api.post('/notifications/rsvp-confirmation', { guestId });
    return response.data;
  },

  /** In-app notifications (stored in DB). */
  getNotifications: async (params = {}) => {
    const response = await api.get('app-notifications', { params });
    return response.data;
  },

  markAsRead: async (notificationId) => {
    const response = await api.put(`app-notifications/${notificationId}/read`);
    return response.data;
  },

  subscribeToUpdates: async (eventId) => {
    const response = await api.post('/notifications/subscribe', { eventId });
    return response.data;
  },
};
