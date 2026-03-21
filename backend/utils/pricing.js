/**
 * Estimate package quote from package rules and provided criteria.
 * Supported rules:
 * - fixed: number
 * - perGuest: number
 * - perHour: number
 */
const estimatePackagePrice = (pkg, criteria = {}) => {
  const rules = pkg.estimationRules || {};
  const guests = Number(criteria.guests || 0);
  const hours = Number(criteria.hours || 0);

  const fixed = Number(rules.fixed || 0);
  const perGuest = Number(rules.perGuest || 0);
  const perHour = Number(rules.perHour || 0);

  const base = Number(pkg.basePrice || 0);
  const quote = base + fixed + guests * perGuest + hours * perHour;
  return Math.max(0, Math.round(quote * 100) / 100);
};

module.exports = { estimatePackagePrice };
