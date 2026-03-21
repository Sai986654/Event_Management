const { prisma } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { autoAllocateBudget } = require('../utils/budgetAllocator');

// POST /api/budgets
exports.createBudget = asyncHandler(async (req, res) => {
  const { event, totalBudget, guestCount, eventType } = req.body;

  const existing = await prisma.budget.findUnique({ where: { eventId: Number(event) } });
  if (existing) {
    return res.status(400).json({ message: 'Budget already exists for this event' });
  }

  const allocations = autoAllocateBudget(totalBudget, eventType);
  const budget = await prisma.budget.create({
    data: { eventId: Number(event), totalBudget, guestCount, allocations },
  });
  res.status(201).json({ budget });
});

// GET /api/budgets/:eventId
exports.getBudget = asyncHandler(async (req, res) => {
  const budget = await prisma.budget.findUnique({ where: { eventId: Number(req.params.eventId) } });
  if (!budget) return res.status(404).json({ message: 'Budget not found' });

  const allocs = Array.isArray(budget.allocations) ? budget.allocations : [];
  const totalPlanned = allocs.reduce((s, a) => s + a.planned, 0);
  const totalActual = allocs.reduce((s, a) => s + a.actual, 0);

  res.json({
    budget,
    summary: {
      totalPlanned,
      totalActual,
      remaining: Number(budget.totalBudget) - totalActual,
      perGuest: budget.guestCount ? Math.round(Number(budget.totalBudget) / budget.guestCount) : 0,
    },
  });
});

// PUT /api/budgets/:eventId
exports.updateBudget = asyncHandler(async (req, res) => {
  const budget = await prisma.budget.findUnique({ where: { eventId: Number(req.params.eventId) } });
  if (!budget) return res.status(404).json({ message: 'Budget not found' });

  const data = {};
  if (req.body.totalBudget) data.totalBudget = req.body.totalBudget;
  if (req.body.guestCount) data.guestCount = req.body.guestCount;
  if (req.body.allocations) data.allocations = req.body.allocations;

  const updated = await prisma.budget.update({ where: { id: budget.id }, data });
  res.json({ budget: updated });
});

// POST /api/budgets/:eventId/auto-allocate
exports.autoAllocate = asyncHandler(async (req, res) => {
  const budget = await prisma.budget.findUnique({ where: { eventId: Number(req.params.eventId) } });
  if (!budget) return res.status(404).json({ message: 'Budget not found' });

  const updated = await prisma.budget.update({
    where: { id: budget.id },
    data: { allocations: autoAllocateBudget(Number(budget.totalBudget), req.body.eventType) },
  });
  res.json({ budget: updated });
});
