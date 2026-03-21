import api from './api';

export const orderService = {
  getOrders: async (params = {}) => {
    const response = await api.get('/orders', { params });
    return response.data;
  },

  createQuote: async (payload) => {
    const response = await api.post('/orders/quote', payload);
    return response.data;
  },

  placeOrder: async (orderId) => {
    const response = await api.patch(`/orders/${orderId}/place`);
    return response.data;
  },
};
