import api from './api';

/** Quote creates order rows + many in-app notifications; default axios timeout is 10s and can fail on slow networks/DB. */
const ORDER_HTTP_TIMEOUT_MS = 120000;

export const orderService = {
  getOrders: async (params = {}) => {
    const response = await api.get('/orders', { params });
    return response.data;
  },

  createQuote: async (payload) => {
    const response = await api.post('/orders/quote', payload, { timeout: ORDER_HTTP_TIMEOUT_MS });
    return response.data;
  },

  placeOrder: async (orderId) => {
    const response = await api.patch(`/orders/${orderId}/place`, {}, { timeout: ORDER_HTTP_TIMEOUT_MS });
    return response.data;
  },
};
