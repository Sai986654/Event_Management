require('dotenv').config();
const bcrypt = require('bcryptjs');
const { prisma } = require('../config/db');
const { autoAllocateBudget } = require('../utils/budgetAllocator');
const slugify = require('slugify');

const generateSlug = (title) =>
  slugify(title, { lower: true, strict: true }) + '-' + Date.now().toString(36);

const seed = async () => {
  console.log('🌱 Seeding database...\n');

  // ── Clear existing data (FK-safe order) ──
  await prisma.instantPhoto.deleteMany();
  await prisma.chatMessage.deleteMany();
  await prisma.chatParticipant.deleteMany();
  await prisma.chatThread.deleteMany();
  await prisma.appNotification.deleteMany();
  await prisma.aiRecommendationSnapshot.deleteMany();
  await prisma.media.deleteMany();
  await prisma.review.deleteMany();
  await prisma.guest.deleteMany();
  await prisma.eventActivity.deleteMany();
  await prisma.eventOrderItem.deleteMany();
  await prisma.eventOrder.deleteMany();
  await prisma.budget.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.vendorTestimonial.deleteMany();
  await prisma.vendorPackage.deleteMany();
  await prisma.event.deleteMany();
  await prisma.vendor.deleteMany();
  await prisma.user.deleteMany();

  const hashedPassword = await bcrypt.hash('password123', 12);

  // ╔══════════════════════════════════════════════════════════╗
  // ║  LOGIN CREDENTIALS (all passwords: password123)         ║
  // ║──────────────────────────────────────────────────────────║
  // ║  Admin    : admin@vedika360.com                         ║
  // ║  Organizer: jane@vedika360.com                          ║
  // ║  Customer : sam@vedika360.com                           ║
  // ║  Vendors  : gordon@vedika360.com                        ║
  // ║            phil@vedika360.com                            ║
  // ║            marcus@vedika360.com                          ║
  // ║            flora@vedika360.com                           ║
  // ║            royal@vedika360.com                           ║
  // ║            cinematic@vedika360.com                       ║
  // ║            spiceroute@vedika360.com                      ║
  // ║            aaradhya@vedika360.com                        ║
  // ║            sangeetpulse@vedika360.com                    ║
  // ║            rideraja@vedika360.com                        ║
  // ╚══════════════════════════════════════════════════════════╝

  // ── Users ──
  const admin = await prisma.user.create({
    data: { name: 'Admin User', email: 'admin@vedika360.com', password: hashedPassword, role: 'admin', phone: '+917093888473' },
  });

  const organizer = await prisma.user.create({
    data: { name: 'Jane Organizer', email: 'jane@vedika360.com', password: hashedPassword, role: 'organizer', phone: '+919876543210' },
  });

  await prisma.user.create({
    data: { name: 'Sam Customer', email: 'sam@vedika360.com', password: hashedPassword, role: 'customer', phone: '+919812345678' },
  });

  console.log('✅ Admin, Organizer & Customer users created');

  // ── Vendor Users ──
  const vendorUsers = {};
  const vendorUserData = [
    { key: 'gordon',       name: 'Chef Gordon',         email: 'gordon@vedika360.com',       phone: '+919900110011' },
    { key: 'phil',         name: 'Photo Phil',           email: 'phil@vedika360.com',         phone: '+919900220022' },
    { key: 'marcus',       name: 'DJ Marcus',            email: 'marcus@vedika360.com',       phone: '+919900330033' },
    { key: 'flora',        name: 'Flora Design',         email: 'flora@vedika360.com',        phone: '+919900440044' },
    { key: 'royal',        name: 'Royal Venue Manager',  email: 'royal@vedika360.com',        phone: '+919900550055' },
    { key: 'cinematic',    name: 'Cinematic Arts',       email: 'cinematic@vedika360.com',    phone: '+919900660066' },
    { key: 'spiceroute',   name: 'Spice Route Owner',    email: 'spiceroute@vedika360.com',   phone: '+919900770077' },
    { key: 'aaradhya',     name: 'Aaradhya Decor',       email: 'aaradhya@vedika360.com',     phone: '+919900880088' },
    { key: 'sangeetpulse', name: 'Sangeet Pulse',        email: 'sangeetpulse@vedika360.com', phone: '+919900990099' },
    { key: 'rideraja',     name: 'RideRaja Transport',   email: 'rideraja@vedika360.com',     phone: '+919900100010' },
  ];

  for (const u of vendorUserData) {
    vendorUsers[u.key] = await prisma.user.create({
      data: { name: u.name, email: u.email, password: hashedPassword, role: 'vendor', phone: u.phone },
    });
  }

  console.log('✅ 10 Vendor users created');

  // ── Vendors ──
  const vendors = {};

  // 1. Gordon's Catering (Hyderabad)
  vendors.gordon = await prisma.vendor.create({
    data: {
      userId: vendorUsers.gordon.id,
      businessName: "Gordon's Royal Catering",
      category: 'catering',
      description: 'Premium multi-cuisine catering with 15+ years of experience. Specializing in South Indian, North Indian, Continental & Chinese cuisines. We serve from intimate gatherings of 50 to grand weddings of 2000+ guests.',
      basePrice: 800,
      priceType: 'per_person',
      city: 'Hyderabad', state: 'Telangana',
      contactPhone: '+919900110011', contactEmail: 'gordon@vedika360.com',
      website: 'https://gordonsroyal.example.com',
      averageRating: 4.8, totalReviews: 45,
      isVerified: true, verificationStatus: 'approved', verifiedAt: new Date(), verifiedByAdminId: admin.id,
      portfolio: [
        { type: 'image', url: 'https://images.unsplash.com/photo-1555244162-803834f70033?w=800', caption: 'Wedding buffet setup' },
        { type: 'image', url: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800', caption: 'Fine dining arrangement' },
      ],
    },
  });

  // 2. Phil's Photography (Bengaluru)
  vendors.phil = await prisma.vendor.create({
    data: {
      userId: vendorUsers.phil.id,
      businessName: "Phil's Wedding Photography",
      category: 'photography',
      description: 'Award-winning photography team capturing love stories since 2012. Modern candid & traditional style. Drone shots, pre-wedding shoots, and same-day edits.',
      basePrice: 25000,
      priceType: 'fixed',
      city: 'Bengaluru', state: 'Karnataka',
      contactPhone: '+919900220022', contactEmail: 'phil@vedika360.com',
      website: 'https://philsphotography.example.com',
      averageRating: 4.7, totalReviews: 62,
      isVerified: true, verificationStatus: 'approved', verifiedAt: new Date(), verifiedByAdminId: admin.id,
      portfolio: [
        { type: 'image', url: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=800', caption: 'Candid wedding moment' },
        { type: 'image', url: 'https://images.unsplash.com/photo-1606216794074-735e91aa2c92?w=800', caption: 'Bridal portrait' },
      ],
    },
  });

  // 3. BeatDrop Entertainment / DJ Marcus (Chennai)
  vendors.marcus = await prisma.vendor.create({
    data: {
      userId: vendorUsers.marcus.id,
      businessName: 'BeatDrop Entertainment',
      category: 'music',
      description: 'Professional DJ, live band & sangeet choreography. We handle sound, lighting, fog machines, and LED dance floors. 500+ events completed across South India.',
      basePrice: 15000,
      priceType: 'fixed',
      city: 'Chennai', state: 'Tamil Nadu',
      contactPhone: '+919900330033', contactEmail: 'marcus@vedika360.com',
      averageRating: 4.6, totalReviews: 38,
      isVerified: true, verificationStatus: 'approved', verifiedAt: new Date(), verifiedByAdminId: admin.id,
    },
  });

  // 4. Bloom & Petal Florals (Visakhapatnam)
  vendors.flora = await prisma.vendor.create({
    data: {
      userId: vendorUsers.flora.id,
      businessName: 'Bloom & Petal Florals',
      category: 'florist',
      description: 'Bespoke floral design for weddings, receptions & corporate events. Fresh flowers, artificial arrangements, car decoration, mandap setup. Serving AP & Telangana.',
      basePrice: 15000,
      priceType: 'fixed',
      city: 'Visakhapatnam', state: 'Andhra Pradesh',
      contactPhone: '+919900440044', contactEmail: 'flora@vedika360.com',
      averageRating: 4.9, totalReviews: 28,
      isVerified: true, verificationStatus: 'approved', verifiedAt: new Date(), verifiedByAdminId: admin.id,
    },
  });

  // 5. Royal Grand Venues (Hyderabad)
  vendors.royal = await prisma.vendor.create({
    data: {
      userId: vendorUsers.royal.id,
      businessName: 'Royal Grand Convention',
      category: 'venue',
      description: 'Premium indoor & outdoor event spaces. AC banquet halls (200-2000 pax), lush lawns, poolside areas, bridal suites. In-house parking for 500+ cars.',
      basePrice: 150000,
      priceType: 'fixed',
      city: 'Hyderabad', state: 'Telangana',
      contactPhone: '+919900550055', contactEmail: 'royal@vedika360.com',
      website: 'https://royalgrand.example.com',
      averageRating: 4.5, totalReviews: 55,
      isVerified: true, verificationStatus: 'approved', verifiedAt: new Date(), verifiedByAdminId: admin.id,
    },
  });

  // 6. FrameStory Cinematic Films (Hyderabad)
  vendors.cinematic = await prisma.vendor.create({
    data: {
      userId: vendorUsers.cinematic.id,
      businessName: 'FrameStory Cinematic Films',
      category: 'videography',
      description: 'Cinematic wedding films, highlight reels, and full event coverage. 4K cameras, drone footage, same-day edits, and custom music scoring.',
      basePrice: 35000,
      priceType: 'fixed',
      city: 'Hyderabad', state: 'Telangana',
      contactPhone: '+919900660066', contactEmail: 'cinematic@vedika360.com',
      averageRating: 4.8, totalReviews: 42,
      isVerified: true, verificationStatus: 'approved', verifiedAt: new Date(), verifiedByAdminId: admin.id,
    },
  });

  // 7. Spice Route Caterers (Hyderabad)
  vendors.spiceroute = await prisma.vendor.create({
    data: {
      userId: vendorUsers.spiceroute.id,
      businessName: 'Spice Route Caterers',
      category: 'catering',
      description: 'Authentic Hyderabadi biryani specialists & multi-cuisine caterers. Known for live counters, chaat stations, and lavish dessert spreads. FSSAI certified.',
      basePrice: 600,
      priceType: 'per_person',
      city: 'Hyderabad', state: 'Telangana',
      contactPhone: '+919900770077', contactEmail: 'spiceroute@vedika360.com',
      averageRating: 4.7, totalReviews: 35,
      isVerified: true, verificationStatus: 'approved', verifiedAt: new Date(), verifiedByAdminId: admin.id,
    },
  });

  // 8. Aaradhya Decor Studio (Vijayawada)
  vendors.aaradhya = await prisma.vendor.create({
    data: {
      userId: vendorUsers.aaradhya.id,
      businessName: 'Aaradhya Decor Studio',
      category: 'decor',
      description: 'Complete event decoration — stage, mandap, entrance, lighting, flower walls, ceiling drapes. Themed setups for weddings, receptions, sangeet & haldi.',
      basePrice: 50000,
      priceType: 'fixed',
      city: 'Vijayawada', state: 'Andhra Pradesh',
      contactPhone: '+919900880088', contactEmail: 'aaradhya@vedika360.com',
      averageRating: 4.6, totalReviews: 22,
      isVerified: true, verificationStatus: 'approved', verifiedAt: new Date(), verifiedByAdminId: admin.id,
    },
  });

  // 9. Sangeet Pulse (Hyderabad)
  vendors.sangeetpulse = await prisma.vendor.create({
    data: {
      userId: vendorUsers.sangeetpulse.id,
      businessName: 'Sangeet Pulse',
      category: 'music',
      description: 'Live band, dhol players, classical instrumentalists & DJ combo. Perfect for baarat, sangeet night, and reception. Multilingual MC available.',
      basePrice: 12000,
      priceType: 'fixed',
      city: 'Hyderabad', state: 'Telangana',
      contactPhone: '+919900990099', contactEmail: 'sangeetpulse@vedika360.com',
      averageRating: 4.5, totalReviews: 18,
      isVerified: true, verificationStatus: 'approved', verifiedAt: new Date(), verifiedByAdminId: admin.id,
    },
  });

  // 10. RideRaja Logistics (Hyderabad)
  vendors.rideraja = await prisma.vendor.create({
    data: {
      userId: vendorUsers.rideraja.id,
      businessName: 'RideRaja Logistics',
      category: 'transportation',
      description: 'Wedding car decoration, guest shuttle buses, vintage cars for baraat, luxury sedan fleet. GPS-tracked vehicles with professional drivers.',
      basePrice: 5000,
      priceType: 'fixed',
      city: 'Hyderabad', state: 'Telangana',
      contactPhone: '+919900100010', contactEmail: 'rideraja@vedika360.com',
      averageRating: 4.4, totalReviews: 15,
      isVerified: true, verificationStatus: 'approved', verifiedAt: new Date(), verifiedByAdminId: admin.id,
    },
  });

  console.log('✅ 10 Vendors created');

  // ── Vendor Packages (with category-specific estimation rules) ──
  const packageData = [
    // ─── Gordon's Catering ───
    {
      vendorId: vendors.gordon.id, category: 'catering', tier: 'Silver',
      title: 'Silver Buffet Package',
      description: 'Veg & Non-Veg buffet with 2 starters, 4 mains, 2 desserts, welcome drinks. Includes service staff & buffet setup.',
      basePrice: 60000, unitLabel: 'per event',
      estimationRules: { perPlate: 800, minPlates: 50, extraSweetCost: 40, extraStarterCost: 60, liveCounterCost: 8000 },
      deliverables: ['Menu planning', 'Service staff (8 hrs)', 'Buffet setup & cleanup', 'Welcome drinks station'],
    },
    {
      vendorId: vendors.gordon.id, category: 'catering', tier: 'Gold',
      title: 'Gold Premium Buffet',
      description: 'Multi-cuisine buffet with 4 starters, 8 mains, 4 desserts, live counters, mocktail bar. Premium crockery & chafing dishes.',
      basePrice: 120000, unitLabel: 'per event',
      estimationRules: { perPlate: 1200, minPlates: 100, extraSweetCost: 50, extraStarterCost: 80, extraMainCourseCost: 100, liveCounterCost: 12000 },
      deliverables: ['Custom menu design', 'Service staff (10 hrs)', 'Live counters (2)', 'Mocktail bar', 'Premium crockery'],
    },
    {
      vendorId: vendors.gordon.id, category: 'catering', tier: 'Platinum',
      title: 'Platinum Grand Feast',
      description: 'Luxury multi-cuisine with 6 starters, 12 mains, 6 desserts, 4 live counters, open bar, chef\'s table experience.',
      basePrice: 250000, unitLabel: 'per event',
      estimationRules: { perPlate: 1800, minPlates: 200, extraSweetCost: 60, extraStarterCost: 100, extraMainCourseCost: 150, liveCounterCost: 15000 },
      deliverables: ['Celebrity chef consultation', 'Service staff (12 hrs)', 'Live counters (4)', 'Open bar', 'Chef table', 'Ice cream station'],
    },

    // ─── Phil's Photography ───
    {
      vendorId: vendors.phil.id, category: 'photography', tier: 'Basic',
      title: 'Essential Coverage',
      description: '4-hour event photography with 1 photographer. 150+ edited photos delivered via online gallery.',
      basePrice: 25000, unitLabel: 'per event',
      estimationRules: { perHour: 5000, editedPhotos: 150, albumCost: 8000, droneCost: 10000, extraCameraCost: 8000 },
      deliverables: ['1 photographer', '150+ edited photos', 'Online gallery', 'Digital downloads'],
    },
    {
      vendorId: vendors.phil.id, category: 'photography', tier: 'Premium',
      title: 'Full Wedding Coverage',
      description: '10-hour coverage with 2 photographers + candid specialist. 500+ edited photos, pre-wedding shoot, premium album.',
      basePrice: 85000, unitLabel: 'per event',
      estimationRules: { perHour: 7000, editedPhotos: 500, albumCost: 15000, droneCost: 12000, extraCameraCost: 10000 },
      deliverables: ['2 photographers', 'Pre-wedding shoot', '500+ edited photos', 'Premium album', 'Same-day previews', 'Online gallery'],
    },
    {
      vendorId: vendors.phil.id, category: 'photography', tier: 'Cinematic',
      title: 'Photo + Video Combo',
      description: 'Complete coverage with 2 photographers + 1 videographer. Drone shots, highlight reel, and cinematic trailer.',
      basePrice: 150000, unitLabel: 'per event',
      estimationRules: { perHour: 12000, editedPhotos: 800, albumCost: 20000, droneCost: 0, extraCameraCost: 12000 },
      deliverables: ['2 photographers + videographer', 'Drone included', '800+ edited photos', '5-min highlight reel', 'Cinematic trailer', 'Premium album'],
    },

    // ─── BeatDrop Entertainment (Music) ───
    {
      vendorId: vendors.marcus.id, category: 'music', tier: 'DJ Only',
      title: 'DJ Night Package',
      description: 'Professional DJ with premium sound system, LED lights, and fog machine. Up to 4 hours.',
      basePrice: 15000, unitLabel: 'per event',
      estimationRules: { perHour: 3000, soundSystemCost: 5000, djCost: 0 },
      deliverables: ['Professional DJ', 'Sound system', 'LED lighting', 'Fog machine', 'Custom playlist'],
    },
    {
      vendorId: vendors.marcus.id, category: 'music', tier: 'Party Pack',
      title: 'Sangeet Night Special',
      description: 'DJ + MC + choreography support + dhol players for sangeet/reception. 6 hours including setup.',
      basePrice: 45000, unitLabel: 'per event',
      estimationRules: { perHour: 5000, soundSystemCost: 8000, extraArtistCost: 10000, djCost: 0 },
      deliverables: ['DJ + MC', 'Dhol players (2)', 'Sound & lighting', 'Fog & LED floor', 'Choreography cues'],
    },
    {
      vendorId: vendors.marcus.id, category: 'music', tier: 'Live Band',
      title: 'Live Band + DJ Combo',
      description: '5-piece live band for ceremony/reception + DJ takeover for party. Full 8-hour coverage.',
      basePrice: 120000, unitLabel: 'per event',
      estimationRules: { perHour: 10000, soundSystemCost: 15000, extraArtistCost: 15000, djCost: 0 },
      deliverables: ['5-piece live band', 'DJ transition', 'Premium sound', 'Stage lighting', 'MC services', '8 hours'],
    },

    // ─── Bloom & Petal Florals ───
    {
      vendorId: vendors.flora.id, category: 'florist', tier: 'Simple',
      title: 'Simple Elegance',
      description: 'Bridal bouquet, 5 table centerpieces, and basic mandap/arch flowers.',
      basePrice: 15000, unitLabel: 'per event',
      estimationRules: { perArrangement: 1500, bouquetCost: 3000, perTableCenterpiece: 800, carDecorationCost: 5000 },
      deliverables: ['Bridal bouquet', '5 centerpieces', 'Ceremony arch flowers', 'Boutonnières'],
    },
    {
      vendorId: vendors.flora.id, category: 'florist', tier: 'Grand',
      title: 'Grand Floral Package',
      description: 'Full venue floral transformation — mandap, entrance, stage backdrop, 15 table centerpieces, car decoration.',
      basePrice: 65000, unitLabel: 'per event',
      estimationRules: { perArrangement: 2000, bouquetCost: 5000, perTableCenterpiece: 1200, carDecorationCost: 8000 },
      deliverables: ['All Simple items', '15 centerpieces', 'Stage backdrop', 'Entrance arch', 'Car decoration', 'Photo wall', 'Setup & teardown'],
    },

    // ─── Royal Grand Venues ───
    {
      vendorId: vendors.royal.id, category: 'venue', tier: 'Banquet Hall',
      title: 'AC Banquet Hall (500 pax)',
      description: 'Fully air-conditioned banquet hall with stage, green room, parking for 200 cars. Ideal for weddings & receptions.',
      basePrice: 150000, unitLabel: 'per day',
      estimationRules: { perDay: 150000, cleaningCharge: 10000, securityDeposit: 50000, acCharge: 20000 },
      deliverables: ['AC hall (500 pax)', 'Stage with backdrop', 'Green rooms (2)', 'Parking', 'Basic PA system'],
    },
    {
      vendorId: vendors.royal.id, category: 'venue', tier: 'Lawn + Hall',
      title: 'Lawn + Hall Combo',
      description: 'Outdoor lawn (1000 pax) + indoor AC hall (500 pax). Perfect for ceremony on lawn + reception inside.',
      basePrice: 300000, unitLabel: 'per day',
      estimationRules: { perDay: 300000, cleaningCharge: 15000, securityDeposit: 75000, acCharge: 25000 },
      deliverables: ['Lawn (1000 pax)', 'AC hall (500 pax)', 'Stage (both)', 'Green rooms (4)', 'Generator backup', 'Parking (500 cars)'],
    },
    {
      vendorId: vendors.royal.id, category: 'venue', tier: 'Premium Poolside',
      title: 'Poolside Premium Experience',
      description: 'Poolside open-air venue (300 pax) with ambient lighting, cabanas, and lounge areas. Ideal for cocktail & sangeet.',
      basePrice: 200000, unitLabel: 'per day',
      estimationRules: { perDay: 200000, perHour: 25000, cleaningCharge: 12000, securityDeposit: 40000 },
      deliverables: ['Poolside area', 'Ambient lighting', 'Cabanas (4)', 'Lounge seating', 'DJ console space'],
    },

    // ─── FrameStory Cinematic Films (Videography) ───
    {
      vendorId: vendors.cinematic.id, category: 'videography', tier: 'Teaser',
      title: 'Wedding Teaser Package',
      description: '4-hour coverage. 2-minute cinematic teaser with custom music. 1 cameraman.',
      basePrice: 35000, unitLabel: 'per event',
      estimationRules: { perHour: 6000, droneCost: 10000, highlightReelCost: 0, trailerCost: 0 },
      deliverables: ['1 cameraman', '4K footage', '2-min teaser', 'Custom music scoring'],
    },
    {
      vendorId: vendors.cinematic.id, category: 'videography', tier: 'Full Film',
      title: 'Complete Wedding Film',
      description: '10-hour coverage. 2 cameramen + drone. Full ceremony film + 5-min highlight reel + cinematic trailer.',
      basePrice: 95000, unitLabel: 'per event',
      estimationRules: { perHour: 8000, extraCameraCost: 10000, droneCost: 0, highlightReelCost: 15000, trailerCost: 20000 },
      deliverables: ['2 cameramen', 'Drone included', 'Full ceremony film', '5-min highlights', 'Cinematic trailer', 'Same-day edit'],
    },

    // ─── Spice Route Caterers ───
    {
      vendorId: vendors.spiceroute.id, category: 'catering', tier: 'Hyderabadi Special',
      title: 'Hyderabadi Biryani Feast',
      description: 'Authentic Hyderabadi biryani spread with kebabs, curries, and traditional desserts. Live biryani counter.',
      basePrice: 45000, unitLabel: 'per event',
      estimationRules: { perPlate: 600, minPlates: 50, extraSweetCost: 35, extraStarterCost: 50, liveCounterCost: 6000 },
      deliverables: ['Live biryani counter', '3 types of biryani', 'Kebab station', 'Traditional desserts', 'Service staff'],
    },
    {
      vendorId: vendors.spiceroute.id, category: 'catering', tier: 'Multi-Cuisine',
      title: 'Multi-Cuisine Grand Buffet',
      description: 'South Indian + North Indian + Chinese + Continental. 3 live counters, juice bar, dessert island.',
      basePrice: 90000, unitLabel: 'per event',
      estimationRules: { perPlate: 950, minPlates: 100, extraSweetCost: 45, extraStarterCost: 70, extraMainCourseCost: 90, liveCounterCost: 10000 },
      deliverables: ['4-cuisine buffet', '3 live counters', 'Juice & mocktail bar', 'Dessert island', 'Service staff (10 hrs)'],
    },

    // ─── Aaradhya Decor Studio ───
    {
      vendorId: vendors.aaradhya.id, category: 'decor', tier: 'Essential',
      title: 'Essential Decor Package',
      description: 'Stage decoration, entrance arch, 10 table setups with basic flower & fabric draping.',
      basePrice: 50000, unitLabel: 'per event',
      estimationRules: { perTable: 2000, stageCost: 25000, entranceCost: 8000, lightingCost: 5000 },
      deliverables: ['Stage decoration', 'Entrance arch', '10 table setups', 'Basic lighting', 'Fabric draping'],
    },
    {
      vendorId: vendors.aaradhya.id, category: 'decor', tier: 'Luxury',
      title: 'Luxury Theme Decor',
      description: 'Complete themed decoration — stage, mandap, ceiling drapes, flower walls, LED panels, entrance pathway.',
      basePrice: 150000, unitLabel: 'per event',
      estimationRules: { perTable: 3500, stageCost: 50000, entranceCost: 15000, extraItemCost: 5000, lightingCost: 20000 },
      deliverables: ['Themed stage & mandap', 'Ceiling drapes', 'Flower walls', 'LED panels', 'Entrance pathway', '20 table setups', 'Setup & teardown'],
    },

    // ─── Sangeet Pulse (Music) ───
    {
      vendorId: vendors.sangeetpulse.id, category: 'music', tier: 'Baarat Band',
      title: 'Baarat Band Package',
      description: 'Traditional baarat band with dhol, trumpet, lights, and horse cart coordination. 2-hour coverage.',
      basePrice: 12000, unitLabel: 'per event',
      estimationRules: { perHour: 4000, soundSystemCost: 0, extraArtistCost: 3000 },
      deliverables: ['Dhol players (4)', 'Band (6 members)', 'LED lights cart', '2 hours'],
    },
    {
      vendorId: vendors.sangeetpulse.id, category: 'music', tier: 'Full Sangeet',
      title: 'Sangeet Night Package',
      description: 'DJ + live singers + dhol + sound system + stage lighting. Ideal for sangeet & reception. 6 hours.',
      basePrice: 55000, unitLabel: 'per event',
      estimationRules: { perHour: 6000, soundSystemCost: 10000, extraArtistCost: 8000, djCost: 15000 },
      deliverables: ['DJ', 'Live singer', 'Dhol players', 'Sound system', 'Stage lighting', 'MC', '6 hours'],
    },

    // ─── RideRaja Logistics (Transportation) ───
    {
      vendorId: vendors.rideraja.id, category: 'transportation', tier: 'Sedan',
      title: 'Luxury Sedan Package',
      description: 'Decorated luxury sedan (Audi/BMW/Mercedes) for bride/groom. Includes driver, fuel, and car decoration.',
      basePrice: 8000, unitLabel: 'per trip',
      estimationRules: { perTrip: 8000, perKm: 25, waitingChargePerHour: 500, driverAllowance: 500 },
      deliverables: ['Luxury sedan', 'Professional driver', 'Car decoration', 'AC', 'Water bottles'],
    },
    {
      vendorId: vendors.rideraja.id, category: 'transportation', tier: 'Guest Shuttle',
      title: 'Guest Shuttle Service',
      description: '45-seater AC bus for guest pickup/drop. Multiple trips between hotel & venue.',
      basePrice: 15000, unitLabel: 'per day',
      estimationRules: { perTrip: 5000, perKm: 40, waitingChargePerHour: 800, driverAllowance: 800 },
      deliverables: ['45-seater AC bus', 'Professional driver', 'Multiple trips', 'GPS tracking'],
    },
    {
      vendorId: vendors.rideraja.id, category: 'transportation', tier: 'Vintage Car',
      title: 'Vintage Car for Baraat',
      description: 'Classic vintage car (Ambassador/Rolls Royce replica) decorated for baraat. Includes driver and fireworks coordination.',
      basePrice: 25000, unitLabel: 'per trip',
      estimationRules: { perTrip: 25000, perKm: 50, waitingChargePerHour: 1000, driverAllowance: 1000 },
      deliverables: ['Vintage car', 'Full decoration', 'Driver in suit', 'Fireworks support', 'Photo time'],
    },
  ];

  await prisma.vendorPackage.createMany({ data: packageData });
  console.log(`✅ ${packageData.length} Vendor Packages created`);

  // ── Vendor Testimonials ──
  const testimonials = [
    { vendorId: vendors.gordon.id, clientName: 'Priya & Rahul', content: 'The food was absolutely divine! Every guest complimented the biryani and live counters. Gordon\'s team was professional and handled 300 guests flawlessly.', rating: 5, source: 'Google Reviews' },
    { vendorId: vendors.gordon.id, clientName: 'Meera Reddy', content: 'We hired them for our daughter\'s wedding. The dessert spread was the highlight - guests are still talking about it!', rating: 5, source: 'Direct' },
    { vendorId: vendors.gordon.id, clientName: 'TechCorp India', content: 'Best corporate catering we\'ve used. Punctual, hygienic, and the menu had excellent variety.', rating: 4, source: 'LinkedIn' },

    { vendorId: vendors.phil.id, clientName: 'Sneha & Arun', content: 'Phil captured our wedding beautifully. The candid shots were magical and the album quality is museum-grade.', rating: 5, source: 'Google Reviews' },
    { vendorId: vendors.phil.id, clientName: 'Anjali Sharma', content: 'Got our photos within 2 weeks! The pre-wedding shoot at Nandi Hills was breathtaking.', rating: 5, source: 'Instagram' },
    { vendorId: vendors.phil.id, clientName: 'Vikram Patel', content: 'Hired for a corporate summit. Very professional, quick turnaround on edited photos.', rating: 4, source: 'Direct' },

    { vendorId: vendors.marcus.id, clientName: 'Kavitha & Deepak', content: 'DJ Marcus made our sangeet night unforgettable! The mix of Bollywood and EDM kept everyone on the dance floor.', rating: 5, source: 'Google Reviews' },
    { vendorId: vendors.marcus.id, clientName: 'Ravi Kumar', content: 'Hired for our startup\'s annual party. Sound quality was excellent and the lighting was spectacular.', rating: 5, source: 'Direct' },

    { vendorId: vendors.flora.id, clientName: 'Lakshmi & Srinivas', content: 'The mandap decoration was stunning! Fresh roses, jasmine, and marigold - exactly what we envisioned.', rating: 5, source: 'Google Reviews' },
    { vendorId: vendors.flora.id, clientName: 'Swetha Reddy', content: 'Car decoration and bridal bouquet were gorgeous. They also did a last-minute flower wall that looked amazing.', rating: 5, source: 'Direct' },

    { vendorId: vendors.royal.id, clientName: 'Ashok Family', content: 'The lawn + hall combo was perfect for our 800-guest wedding. Staff was very cooperative and parking was smooth.', rating: 5, source: 'Google Reviews' },
    { vendorId: vendors.royal.id, clientName: 'Naidu & Sons Corp', content: 'Held our annual conference here. AC hall was comfortable, AV setup was good, and the food options were solid.', rating: 4, source: 'Direct' },

    { vendorId: vendors.cinematic.id, clientName: 'Divya & Karthik', content: 'The highlight reel made us cry happy tears! Cinematic quality, perfect music selection, delivered within 10 days.', rating: 5, source: 'YouTube' },
    { vendorId: vendors.cinematic.id, clientName: 'Sai Teja', content: 'Same-day edit was the talk of our reception. Professional crew, no-fuss setup.', rating: 5, source: 'Google Reviews' },

    { vendorId: vendors.spiceroute.id, clientName: 'Bhavani Family', content: 'Best biryani catering in Hyderabad! The live counter was a huge hit. Quantity was generous too.', rating: 5, source: 'Google Reviews' },
    { vendorId: vendors.spiceroute.id, clientName: 'Rao\'s Reception', content: 'Multi-cuisine spread was excellent. Chinese live counter and the paan station were favorites.', rating: 4, source: 'Direct' },

    { vendorId: vendors.aaradhya.id, clientName: 'Padma & Venkat', content: 'They transformed our simple venue into a palace! The LED panels and flower walls were breathtaking.', rating: 5, source: 'Google Reviews' },
    { vendorId: vendors.aaradhya.id, clientName: 'Keerthi Wedding', content: 'Excellent work on the mandap and stage. They even added surprise lighting effects during jaimala.', rating: 5, source: 'Instagram' },

    { vendorId: vendors.sangeetpulse.id, clientName: 'Harsha Wedding', content: 'The baarat band was energetic and perfectly coordinated with the horse cart. Great dhol players!', rating: 5, source: 'Direct' },

    { vendorId: vendors.rideraja.id, clientName: 'Suresh Wedding', content: 'The vintage car for baraat was a showstopper! Driver was punctual and professional.', rating: 5, source: 'Google Reviews' },
    { vendorId: vendors.rideraja.id, clientName: 'Kumar Family', content: 'Guest shuttle service was smooth - 3 trips between hotel and venue, no one was left waiting.', rating: 4, source: 'Direct' },
  ];

  await prisma.vendorTestimonial.createMany({ data: testimonials });
  console.log(`✅ ${testimonials.length} Testimonials created`);

  // ── Sample Events ──
  const event1 = await prisma.event.create({
    data: {
      title: 'Spring Garden Wedding',
      slug: generateSlug('Spring Garden Wedding'),
      type: 'wedding',
      description: 'An elegant spring garden wedding at Shilparamam with 200 guests.',
      date: new Date('2026-06-15'),
      venue: 'Shilparamam Cultural Venue',
      address: 'HITEC City, Madhapur',
      city: 'Hyderabad', state: 'Telangana',
      budget: 2800000, guestCount: 200,
      organizerId: organizer.id, status: 'planning', isPublic: true,
      timeline: [
        { time: '14:00', activity: 'Guest Arrival & Welcome Drinks' },
        { time: '15:00', activity: 'Wedding Ceremony' },
        { time: '17:00', activity: 'Reception & Photo Session' },
        { time: '19:00', activity: 'Dinner & Dance' },
      ],
      tasks: [
        { title: 'Finalize menu with Gordon\'s', assignee: 'Jane', status: 'in-progress', dueDate: '2026-05-01' },
        { title: 'Book photographer', assignee: 'Jane', status: 'completed', dueDate: '2026-04-01' },
        { title: 'Send invitations', assignee: 'Jane', status: 'pending', dueDate: '2026-04-15' },
        { title: 'Confirm venue booking', assignee: 'Jane', status: 'completed', dueDate: '2026-03-15' },
        { title: 'Floral arrangements review', assignee: 'Jane', status: 'pending', dueDate: '2026-05-10' },
      ],
    },
  });

  await prisma.event.create({
    data: {
      title: 'Tech Summit 2026',
      slug: generateSlug('Tech Summit 2026'),
      type: 'corporate',
      description: 'Annual technology conference for innovators and startup founders.',
      date: new Date('2026-09-20'),
      venue: 'HICC Convention Centre',
      address: 'Madhapur',
      city: 'Hyderabad', state: 'Telangana',
      budget: 5500000, guestCount: 500,
      organizerId: organizer.id, status: 'draft', isPublic: false,
    },
  });

  console.log('✅ 2 Events created');

  // ── Guests ──
  const guestNames = [
    'Alice Johnson', 'Bob Smith', 'Carol White', 'David Brown',
    'Eve Davis', 'Frank Miller', 'Grace Wilson', 'Henry Taylor',
    'Isha Patel', 'Jai Reddy', 'Kavya Nair', 'Laxman Rao',
  ];

  await prisma.guest.createMany({
    data: guestNames.map((name, i) => ({
      eventId: event1.id,
      name,
      email: `${name.split(' ')[0].toLowerCase()}@example.com`,
      phone: `+91980000${String(i).padStart(4, '0')}`,
      rsvpStatus: i < 5 ? 'accepted' : i < 8 ? 'pending' : i < 10 ? 'maybe' : 'declined',
      plusOnes: i < 6 ? 1 : 0,
      checkedIn: i < 3,
      checkedInAt: i < 3 ? new Date() : null,
    })),
  });

  console.log('✅ 12 Guests created');

  // ── Budget ──
  await prisma.budget.create({
    data: {
      eventId: event1.id,
      totalBudget: 2800000,
      guestCount: 200,
      allocations: autoAllocateBudget(2800000, 'wedding'),
    },
  });

  console.log('✅ Budget allocated');

  // ── Done ──
  console.log('\n════════════════════════════════════════════════════');
  console.log('  🎉 SEED COMPLETE — Login Credentials');
  console.log('════════════════════════════════════════════════════');
  console.log('  Password for ALL accounts: password123\n');
  console.log('  👤 Admin      : admin@vedika360.com');
  console.log('  👤 Organizer  : jane@vedika360.com');
  console.log('  👤 Customer   : sam@vedika360.com');
  console.log('  ─────────────────────────────────────────────────');
  console.log('  🏪 Vendors:');
  console.log('     gordon@vedika360.com       (Catering)');
  console.log('     phil@vedika360.com          (Photography)');
  console.log('     marcus@vedika360.com        (Music/DJ)');
  console.log('     flora@vedika360.com         (Florist)');
  console.log('     royal@vedika360.com         (Venue)');
  console.log('     cinematic@vedika360.com     (Videography)');
  console.log('     spiceroute@vedika360.com    (Catering)');
  console.log('     aaradhya@vedika360.com      (Decor)');
  console.log('     sangeetpulse@vedika360.com  (Music)');
  console.log('     rideraja@vedika360.com      (Transportation)');
  console.log('════════════════════════════════════════════════════\n');

  await prisma.$disconnect();
  process.exit(0);
};

seed().catch(async (err) => {
  console.error('❌ Seed error:', err);
  await prisma.$disconnect();
  process.exit(1);
});
