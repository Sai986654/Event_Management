/**
 * AI Planning Helper — mock service.
 * Returns pre-built suggestions without calling any external AI API.
 */

const vendorSuggestions = {
  wedding: [
    { category: 'catering', suggestion: 'Elegant Bites Catering', reason: 'Top-rated for wedding receptions' },
    { category: 'photography', suggestion: 'Moments Studio', reason: 'Specializes in candid wedding photography' },
    { category: 'decor', suggestion: 'Bloom & Petal Designs', reason: 'Known for romantic floral arrangements' },
    { category: 'music', suggestion: 'Harmony Live Band', reason: 'Popular wedding entertainment act' },
  ],
  corporate: [
    { category: 'catering', suggestion: 'Corporate Cuisine Co.', reason: 'Professional buffet and plated service' },
    { category: 'venue', suggestion: 'Grand Conference Center', reason: 'Equipped with AV and networking spaces' },
    { category: 'photography', suggestion: 'ProShot Events', reason: 'Corporate headshots and event coverage' },
  ],
  birthday: [
    { category: 'catering', suggestion: 'Fun Feast Catering', reason: 'Great party menus and dessert bars' },
    { category: 'decor', suggestion: 'Party Pop Decorators', reason: 'Themed party setups' },
    { category: 'music', suggestion: 'DJ Spark', reason: 'High-energy party DJ' },
  ],
};

const themeSuggestions = {
  wedding: ['Classic Elegance', 'Rustic Garden', 'Bohemian Chic', 'Modern Minimalist'],
  corporate: ['Tech Summit', 'Executive Gala', 'Innovation Hub', 'Networking Night'],
  birthday: ['Tropical Paradise', 'Retro Arcade', 'Enchanted Forest', 'Hollywood Glam'],
  conference: ['TED-style', 'Workshop Intensive', 'Panel Series', 'Expo Floor'],
  concert: ['Festival Vibes', 'Acoustic Night', 'Neon Glow', 'Unplugged Sessions'],
};

/** Format amounts as Indian Rupees for user-facing AI copy */
const fmtINR = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(
    Number(n || 0)
  );

const generateTimeline = (eventType, date) => {
  const base = new Date(date);
  const timelines = {
    wedding: [
      { time: '14:00', activity: 'Guest Arrival & Seating' },
      { time: '14:30', activity: 'Ceremony Begins' },
      { time: '15:30', activity: 'Cocktail Hour' },
      { time: '16:30', activity: 'Reception & Dinner' },
      { time: '18:00', activity: 'Toasts & Speeches' },
      { time: '19:00', activity: 'First Dance & Party' },
      { time: '22:00', activity: 'Send-off' },
    ],
    corporate: [
      { time: '08:00', activity: 'Registration & Breakfast' },
      { time: '09:00', activity: 'Opening Keynote' },
      { time: '10:30', activity: 'Break' },
      { time: '11:00', activity: 'Panel Discussion' },
      { time: '12:30', activity: 'Lunch' },
      { time: '14:00', activity: 'Workshops' },
      { time: '16:00', activity: 'Networking Session' },
      { time: '17:00', activity: 'Closing Remarks' },
    ],
    default: [
      { time: '10:00', activity: 'Setup & Preparation' },
      { time: '12:00', activity: 'Guest Arrival' },
      { time: '12:30', activity: 'Opening' },
      { time: '14:00', activity: 'Main Event' },
      { time: '16:00', activity: 'Refreshments' },
      { time: '18:00', activity: 'Wrap Up' },
    ],
  };

  const timeline = timelines[eventType] || timelines.default;
  return timeline.map((item) => ({
    ...item,
    date: base.toISOString().split('T')[0],
  }));
};

const getSuggestions = ({ eventType, budget, guestCount }) => {
  const type = eventType || 'default';
  return {
    vendors: vendorSuggestions[type] || vendorSuggestions.corporate,
    themes: themeSuggestions[type] || themeSuggestions.corporate,
    timeline: generateTimeline(type, new Date()),
    budgetTip:
      budget && guestCount
        ? `With ${fmtINR(budget)} for ${guestCount} guests, allocate ~${fmtINR(Math.round(budget / guestCount))} per guest.`
        : 'Provide budget and guest count for per-person estimates.',
  };
};

const plannerSectors = [
  'invitation',
  'makeup',
  'transportation',
  'catering',
  'decor',
  'photography',
  'videography',
  'music',
  'venue',
  'florist',
  'other',
];

const allocationWeights = {
  invitation: 0.04,
  makeup: 0.06,
  transportation: 0.08,
  catering: 0.28,
  decor: 0.14,
  photography: 0.1,
  videography: 0.08,
  music: 0.06,
  venue: 0.12,
  florist: 0.03,
  other: 0.01,
};

const buildPlannerCopilotPlan = ({ event, packages, teluguStateSet }) => {
  const totalBudget = Number(event?.budget || 0);
  const categorized = packages.reduce((acc, pkg) => {
    const category = String(pkg.category || '').toLowerCase();
    if (!acc[category]) acc[category] = [];
    acc[category].push(pkg);
    return acc;
  }, {});

  const recommendations = plannerSectors.map((sector) => {
    const options = categorized[sector] || [];
    if (!options.length) {
      return {
        sector,
        vendorId: null,
        vendorName: null,
        packageId: null,
        packageTitle: null,
        estimatedPrice: 0,
        reason: 'No active package found in this sector yet.',
      };
    }

    const sectorBudget = totalBudget > 0 ? totalBudget * (allocationWeights[sector] || 0.05) : null;
    const scored = options.map((pkg) => {
      const price = Number(pkg.basePrice || 0);
      const rating = Number(pkg.vendor?.averageRating || 0);
      const verified = pkg.vendor?.isVerified ? 0.7 : 0;
      const inTeluguState = teluguStateSet.has(String(pkg.vendor?.state || '').trim().toLowerCase()) ? 0.5 : 0;
      const budgetFit = sectorBudget
        ? Math.max(0, 1 - Math.abs(price - sectorBudget) / Math.max(sectorBudget, 1))
        : 0.4;
      const score = rating * 1.8 + verified + inTeluguState + budgetFit;
      return { pkg, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const chosen = scored[0].pkg;
    const chosenPrice = Number(chosen.basePrice || 0);
    const reasonBits = [
      `Rated ${Number(chosen.vendor?.averageRating || 0).toFixed(1)}`,
      chosen.vendor?.isVerified ? 'verified vendor' : 'active vendor',
      sectorBudget ? `close to sector budget ${fmtINR(Math.round(sectorBudget))}` : null,
    ].filter(Boolean);

    return {
      sector,
      vendorId: chosen.vendor?.id || null,
      vendorName: chosen.vendor?.businessName || null,
      packageId: chosen.id,
      packageTitle: chosen.title,
      estimatedPrice: chosenPrice,
      reason: reasonBits.join(', '),
    };
  });

  const projectedTotal = recommendations.reduce((sum, item) => sum + Number(item.estimatedPrice || 0), 0);

  return {
    eventSnapshot: {
      eventId: event.id,
      eventType: event.type,
      guestCount: event.guestCount,
      budget: Number(event.budget || 0),
      venue: event.venue || null,
      date: event.date,
    },
    recommendations,
    projectedTotal,
    note: 'AI picks one recommended package per sector. You can change any step manually.',
  };
};

const optimizeBudgetScenario = ({ event, selectedPackages, scenarioGuestCount, scenarioBudget }) => {
  const currentGuestCount = Number(event?.guestCount || 0);
  const targetGuests = Number(scenarioGuestCount || currentGuestCount || 0);
  const targetBudget = Number(scenarioBudget || event?.budget || 0);

  const itemBreakdown = selectedPackages.map((pkg) => {
    const base = Number(pkg.basePrice || 0);
    const rules = pkg.estimationRules || {};
    const perGuest = Number(rules.perGuest || 0);
    const perHour = Number(rules.perHour || 0);
    const defaultHours = perHour > 0 ? 4 : 0;
    const estimate = base + perGuest * targetGuests + perHour * defaultHours;
    return {
      packageId: pkg.id,
      packageTitle: pkg.title,
      sector: String(pkg.category || '').toLowerCase(),
      vendorName: pkg.vendor?.businessName || 'Vendor',
      estimatedAmount: Math.max(0, Math.round(estimate * 100) / 100),
      hints: {
        perGuest,
        perHour,
        defaultHours,
      },
    };
  });

  const projectedTotal = itemBreakdown.reduce((sum, row) => sum + Number(row.estimatedAmount || 0), 0);
  const delta = projectedTotal - targetBudget;
  const status = delta <= 0 ? 'under_budget' : 'over_budget';
  const absDelta = Math.abs(delta);

  const suggestions = [];
  if (status === 'over_budget') {
    suggestions.push(
      `Reduce decor and music tiers first to save around ${fmtINR(Math.round(absDelta * 0.35))} in total.`
    );
    suggestions.push(`Ask catering vendors for per-plate optimization; this is usually highest-impact for ${targetGuests} guests.`);
    suggestions.push('Keep photography, cut videography only if required for budget control.');
  } else {
    suggestions.push(`You still have room of around ${fmtINR(Math.round(absDelta))} in budget.`);
    suggestions.push('Consider upgrading venue comfort or adding premium decor highlights.');
    suggestions.push('Reserve a contingency buffer of at least 5% for last-minute costs.');
  }

  return {
    scenario: {
      eventId: event.id,
      guestCount: targetGuests,
      budget: targetBudget,
    },
    projectedTotal: Math.round(projectedTotal * 100) / 100,
    status,
    delta: Math.round(delta * 100) / 100,
    itemBreakdown,
    suggestions,
  };
};

const autoRebalanceSelection = ({ event, selectedPackages, allPackages, scenarioGuestCount, scenarioBudget }) => {
  const targetGuests = Number(scenarioGuestCount || event?.guestCount || 0);
  const targetBudget = Number(scenarioBudget || event?.budget || 0);

  const estimateWithScenario = (pkg) => {
    const base = Number(pkg.basePrice || 0);
    const rules = pkg.estimationRules || {};
    const perGuest = Number(rules.perGuest || 0);
    const perHour = Number(rules.perHour || 0);
    const defaultHours = perHour > 0 ? 4 : 0;
    return Math.max(0, Math.round((base + perGuest * targetGuests + perHour * defaultHours) * 100) / 100);
  };

  const selectedBySector = selectedPackages.reduce((acc, pkg) => {
    const sector = String(pkg.category || '').toLowerCase();
    acc[sector] = pkg;
    return acc;
  }, {});

  const optionsBySector = allPackages.reduce((acc, pkg) => {
    const sector = String(pkg.category || '').toLowerCase();
    if (!acc[sector]) acc[sector] = [];
    acc[sector].push(pkg);
    return acc;
  }, {});

  const sectors = Object.keys(selectedBySector);
  const swaps = [];
  let projectedTotal = sectors.reduce((sum, sector) => sum + estimateWithScenario(selectedBySector[sector]), 0);
  const beforeTotal = projectedTotal;

  if (targetBudget > 0 && projectedTotal > targetBudget) {
    const ranked = sectors.map((sector) => {
      const current = selectedBySector[sector];
      const currentEstimate = estimateWithScenario(current);
      const alternatives = (optionsBySector[sector] || [])
        .filter((pkg) => pkg.id !== current.id)
        .map((pkg) => ({
          pkg,
          estimate: estimateWithScenario(pkg),
          rating: Number(pkg.vendor?.averageRating || 0),
        }))
        .sort((a, b) => {
          if (a.estimate !== b.estimate) return a.estimate - b.estimate;
          return b.rating - a.rating;
        });

      const bestCheaper = alternatives.find((alt) => alt.estimate < currentEstimate);
      return {
        sector,
        current,
        currentEstimate,
        bestCheaper,
        potentialSaving: bestCheaper ? currentEstimate - bestCheaper.estimate : 0,
      };
    }).sort((a, b) => b.potentialSaving - a.potentialSaving);

    for (const item of ranked) {
      if (projectedTotal <= targetBudget) break;
      if (!item.bestCheaper) continue;

      selectedBySector[item.sector] = item.bestCheaper.pkg;
      projectedTotal -= item.potentialSaving;
      swaps.push({
        sector: item.sector,
        fromPackageId: item.current.id,
        toPackageId: item.bestCheaper.pkg.id,
        reason: `Switched to lower-cost option in ${item.sector} to save ${fmtINR(Math.round(item.potentialSaving))}.`,
      });
    }
  }

  const finalSelections = sectors.map((sector) => {
    const pkg = selectedBySector[sector];
    return {
      sector,
      vendorId: pkg.vendor?.id || null,
      vendorName: pkg.vendor?.businessName || null,
      packageId: pkg.id,
      packageTitle: pkg.title,
      estimatedAmount: estimateWithScenario(pkg),
    };
  });

  const finalProjectedTotal = finalSelections.reduce((sum, row) => sum + Number(row.estimatedAmount || 0), 0);
  return {
    scenario: {
      eventId: event.id,
      guestCount: targetGuests,
      budget: targetBudget,
    },
    beforeTotal: Math.round(beforeTotal * 100) / 100,
    afterTotal: Math.round(finalProjectedTotal * 100) / 100,
    status: targetBudget > 0 && finalProjectedTotal > targetBudget ? 'still_over_budget' : 'rebalanced',
    swaps,
    selections: finalSelections,
  };
};

module.exports = { getSuggestions, buildPlannerCopilotPlan, optimizeBudgetScenario, autoRebalanceSelection };
