export const formatDate = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
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
    maximumFractionDigits: 0,
  }).format(Number(amount));
};

export const getInitials = (name) => {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase();
};

export const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

export const getErrorMessage = (error) => {
  return error?.response?.data?.message || error?.message || 'An error occurred';
};

export const getRoleColor = (role) => {
  const colors = {
    admin: 'red',
    organizer: 'blue',
    customer: 'purple',
    vendor: 'green',
    guest: 'default',
  };
  return colors[role] || 'default';
};

export const getStatusColor = (status) => {
  const colors = {
    pending: 'orange',
    confirmed: 'green',
    cancelled: 'red',
    completed: 'blue',
  };
  return colors[status] || 'default';
};
