import api from './api';

export const budgetService = {
  createBudget: async (eventId, budgetData) => {
    const response = await api.post('/budgets', { eventId, ...budgetData });
    return response.data;
  },

  getBudget: async (eventId) => {
    const response = await api.get(`/budgets/${eventId}`);
    return response.data;
  },

  updateBudget: async (budgetId, budgetData) => {
    const response = await api.put(`/budgets/${budgetId}`, budgetData);
    return response.data;
  },

  allocateBudget: async (budgetId, allocations) => {
    const response = await api.post(`/budgets/${budgetId}/allocate`, { allocations });
    return response.data;
  },

  getBudgetAnalysis: async (eventId) => {
    const response = await api.get(`/budgets/${eventId}/analysis`);
    return response.data;
  },

  optimizeBudget: async (eventId, guestCount) => {
    const response = await api.post('/budgets/optimize', { eventId, guestCount });
    return response.data;
  },
};
