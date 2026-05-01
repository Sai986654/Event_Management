/**
 * Estimate package quote from package rules and provided criteria.
 * Supported rules:
 * - fixed: number
 * - perGuest: number
 * - perHour: number
 */
const estimatePackagePrice = (pkg, criteria = {}) => {
  const rules = pkg.estimationRules || {};
  const guestsInput = Number(criteria.guests || 0);
  const hours = Number(criteria.hours || 0);
  const minGuests = Number(rules.minPlates || 0);
  const guests = guestsInput > 0 ? Math.max(guestsInput, minGuests) : 0;

  const fixed = Number(rules.fixed || 0);
  const perGuest = Number(rules.perGuest || rules.perPlate || 0);
  const perHour = Number(rules.perHour || 0);

  const coreKeys = new Set(['fixed', 'perGuest', 'perPlate', 'perHour', 'minPlates']);
  const addonQty = criteria.addons || {};
  const addonTotal = Object.entries(addonQty).reduce((sum, [key, qtyRaw]) => {
    if (coreKeys.has(key)) return sum;
    const rate = Number(rules[key] || 0);
    const qty = Number(qtyRaw || 0);
    if (rate <= 0 || qty <= 0) return sum;
    return sum + rate * qty;
  }, 0);

  const base = Number(pkg.basePrice || 0);
  const quote = base + fixed + guests * perGuest + hours * perHour + addonTotal;
  return Math.max(0, Math.round(quote * 100) / 100);
};

module.exports = { estimatePackagePrice };
