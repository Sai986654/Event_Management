import api from './api';

export const chatService = {
  getThreads: async () => {
    const response = await api.get('/chat/threads');
    return response.data;
  },

  createThread: async ({ subject, message }) => {
    const response = await api.post('/chat/threads', { subject, message });
    return response.data;
  },

  getMessages: async (threadId) => {
    const response = await api.get(`/chat/threads/${threadId}/messages`);
    return response.data;
  },

  sendMessage: async (threadId, body) => {
    const response = await api.post(`/chat/threads/${threadId}/messages`, { body });
    return response.data;
  },

  closeThread: async (threadId) => {
    const response = await api.patch(`/chat/threads/${threadId}/close`);
    return response.data;
  },
};
