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
  const data = error?.response?.data;
  if (!data) return error?.message || 'An error occurred';
  let msg = data.message || 'An error occurred';
  if (Array.isArray(data.errors) && data.errors.length) {
    const bits = data.errors.map((e) => e.message || e.msg || e.field).filter(Boolean);
    if (bits.length) msg = `${msg} (${bits.join('; ')})`;
  }
  if (Array.isArray(data.skipped) && data.skipped.length) {
    const bits = data.skipped.map((s) => `#${s.packageId}: ${s.reason}`);
    msg = `${msg} — ${bits.join('; ')}`;
  }
  return msg;
};

export const getPaymentRequirement = (error) => {
  const data = error?.response?.data;
  if (!data || !data.requiredPayment) return null;
  if (!data.entityType || !data.entityId) return null;
  return {
    entityType: data.entityType,
    entityId: Number(data.entityId),
    config: data.config || null,
    message: data.message || 'Payment is required for this action',
  };
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
