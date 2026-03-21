/**
 * Budget auto-allocation presets (percentages of total budget).
 */
const ALLOCATION_PRESETS = {
  wedding: {
    venue: 0.30,
    catering: 0.30,
    decor: 0.12,
    photography: 0.10,
    music: 0.08,
    transportation: 0.04,
    misc: 0.06,
  },
  corporate: {
    venue: 0.35,
    catering: 0.25,
    decor: 0.08,
    photography: 0.07,
    music: 0.05,
    transportation: 0.10,
    misc: 0.10,
  },
  default: {
    venue: 0.30,
    catering: 0.25,
    decor: 0.10,
    photography: 0.10,
    music: 0.08,
    transportation: 0.07,
    misc: 0.10,
  },
};

/**
 * Given a total budget and event type, return an array of allocations.
 */
const autoAllocateBudget = (totalBudget, eventType = 'default') => {
  const preset = ALLOCATION_PRESETS[eventType] || ALLOCATION_PRESETS.default;
  return Object.entries(preset).map(([category, pct]) => ({
    category,
    planned: Math.round(totalBudget * pct),
    actual: 0,
  }));
};

module.exports = { autoAllocateBudget };
