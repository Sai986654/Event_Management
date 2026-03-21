export const formatDate = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const formatCurrency = (amount, currency = 'INR') => {
  if (amount == null || Number.isNaN(Number(amount))) {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(0);
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(amount));
};

export const getErrorMessage = (error) => {
  return error?.response?.data?.message || error?.message || 'An error occurred';
};

export const getRoleColor = (role) => {
  const colors = {
    admin: '#ff4d4f',
    organizer: '#1890ff',
    customer: '#722ed1',
    vendor: '#52c41a',
    guest: '#8c8c8c',
  };
  return colors[role] || '#8c8c8c';
};

export const getStatusColor = (status) => {
  const colors = {
    pending: '#fa8c16',
    confirmed: '#52c41a',
    cancelled: '#ff4d4f',
    completed: '#1890ff',
    planning: '#667eea',
    draft: '#8c8c8c',
  };
  return colors[status] || '#8c8c8c';
};
