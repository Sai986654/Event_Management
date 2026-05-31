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
    admin: '#ff4d4f',
    organizer: '#d4af37',
    customer: '#1e293b',
    vendor: '#22c55e',
    guest: '#9ca3af',
  };
  return colors[role] || '#9ca3af';
};

export const getStatusColor = (status) => {
  const colors = {
    pending: '#fa8c16',
    confirmed: '#22c55e',
    cancelled: '#ff4d4f',
    completed: '#334155',
    planning: '#d4af37',
    draft: '#9ca3af',
  };
  return colors[status] || '#9ca3af';
};
