/**
 * Build pagination metadata from query params.
 */
const paginate = (page = 1, limit = 10) => {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
  return { skip: (p - 1) * l, limit: l, page: p };
};

module.exports = { paginate };
