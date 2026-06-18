import api from './api';

export const publicInviteService = {
  getInvite: (token) => api.get(`/invites/view/${token}`),
  submitRsvp: (token, data) => api.post(`/invites/view/${token}/rsvp`, data),
};
