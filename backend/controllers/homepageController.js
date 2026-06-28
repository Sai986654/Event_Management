const { prisma } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { getCache, setCache } = require('../utils/redis');
const { getCategoryOptions } = require('../services/vendorFormSchemaService');

// GET /api/homepage
exports.getHomepageData = asyncHandler(async (req, res) => {
  const cacheKey = 'homepage:v1';
  
  // Try Cache
  const cachedData = await getCache(cacheKey);
  if (cachedData) {
    res.set('X-Cache', 'HIT');
    res.set('Cache-Control', 'public, max-age=900'); // 15 mins
    return res.json(cachedData);
  }

  // Cache Miss -> Query Database
  const [featuredVendors, categories, verifiedVendors] = await Promise.all([
    // Featured vendors: featured = true, top-rated
    prisma.vendor.findMany({
      where: { featured: true },
      orderBy: { averageRating: 'desc' },
      take: 6,
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
    // Categories from schema service
    getCategoryOptions(),
    // Recommended vendors: verified, top rated
    prisma.vendor.findMany({
      where: { isVerified: true },
      orderBy: { averageRating: 'desc' },
      take: 6,
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
  ]);

  const themes = [
    { key: 'traditional_telugu', label: 'Traditional Telugu (Pelli)', description: 'Classic marigold, banana leaves, and temple style setup' },
    { key: 'royal_gold_crimson', label: 'Royal Gold & Crimson', description: 'Rich velvet drapes and heritage brass artifacts' },
    { key: 'minimalist_pastel', label: 'Minimalist Pastel', description: 'Contemporary elegance with baby breath and subtle pinks' },
    { key: 'south_indian_temple', label: 'South Indian Temple Decor', description: 'Authentic stone pillar mockups and white jasmine garlands' },
    { key: 'vintage_garden', label: 'Vintage Garden', description: 'Earthy decor with fairy lights and wild floral arrangements' }
  ];

  const popularSearches = [
    { query: 'photographer Hyderabad', label: 'Photographers in Hyderabad' },
    { query: 'mandap decoration Vijayawada', label: 'Mandap Decorators in Vijayawada' },
    { query: 'luxury catering', label: 'Luxury Catering Services' },
    { query: 'Telugu wedding planner', label: 'Telugu Wedding Planners' }
  ];

  const homepageData = {
    featuredVendors,
    categories,
    themes,
    popularSearches,
    recommended: verifiedVendors
  };

  // Save to Cache (15 minutes TTL)
  await setCache(cacheKey, homepageData, 900);

  res.set('X-Cache', 'MISS');
  res.set('Cache-Control', 'public, max-age=900');
  res.json(homepageData);
});
