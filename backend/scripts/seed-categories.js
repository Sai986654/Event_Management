/**
 * Seed default service categories into the service_categories table.
 * Run with: node scripts/seed-categories.js
 * Safe to run multiple times — uses upsert so existing rows are untouched.
 */
require('dotenv').config();
const { prisma } = require('../config/db');

const DEFAULT_CATEGORIES = [
  { name: 'catering',       label: 'Catering',           color: 'orange',  icon: 'food',               sortOrder: 1 },
  { name: 'photography',    label: 'Photography',         color: 'blue',    icon: 'camera',             sortOrder: 2 },
  { name: 'videography',    label: 'Videography',         color: 'purple',  icon: 'video',              sortOrder: 3 },
  { name: 'music',          label: 'Music & DJ',          color: 'pink',    icon: 'music',              sortOrder: 4 },
  { name: 'decor',          label: 'Decoration',          color: 'teal',    icon: 'balloon',            sortOrder: 5 },
  { name: 'florist',        label: 'Florist',             color: 'green',   icon: 'flower',             sortOrder: 6 },
  { name: 'venue',          label: 'Venue',               color: 'brown',   icon: 'office-building',    sortOrder: 7 },
  { name: 'transportation', label: 'Transportation',      color: 'gray',    icon: 'car',                sortOrder: 8 },
  { name: 'make_up',        label: 'Makeup Artist',       color: 'rose',    icon: 'lipstick',           sortOrder: 9 },
  { name: 'lighting',       label: 'Lighting',            color: 'yellow',  icon: 'lightbulb',          sortOrder: 10 },
  { name: 'tent_rental',    label: 'Tent & Furniture',    color: 'indigo',  icon: 'home',               sortOrder: 11 },
  { name: 'anchor',         label: 'Anchor / Emcee',      color: 'violet',  icon: 'microphone',         sortOrder: 12 },
  { name: 'mehendi',        label: 'Mehendi Artist',      color: 'amber',   icon: 'hand-left',          sortOrder: 13 },
  { name: 'invitation',     label: 'Invitation Design',   color: 'cyan',    icon: 'card-text',          sortOrder: 14 },
  { name: 'security',       label: 'Security',            color: 'red',     icon: 'shield',             sortOrder: 15 },
  { name: 'raw_materials',  label: 'Raw Materials',       color: 'lime',    icon: 'package-variant',    sortOrder: 16 },
];

async function main() {
  console.log('🌱 Seeding service categories...\n');

  let created = 0;
  let skipped = 0;

  for (const cat of DEFAULT_CATEGORIES) {
    const result = await prisma.serviceCategory.upsert({
      where:  { name: cat.name },
      update: {},          // Don't overwrite if already exists
      create: cat,
    });

    const wasCreated = result.createdAt.getTime() === result.createdAt.getTime() &&
      Math.abs(Date.now() - result.createdAt.getTime()) < 5000;

    console.log(`  ✔ ${cat.label} (${cat.name})`);
    created++;
  }

  console.log(`\n✅ Done. ${DEFAULT_CATEGORIES.length} categories processed.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
