require('dotenv').config();
const bcrypt = require('bcryptjs');
const { prisma } = require('../config/db');
const { autoAllocateBudget } = require('../utils/budgetAllocator');
const slugify = require('slugify');

const generateSlug = (title) =>
  slugify(title, { lower: true, strict: true }) + '-' + Date.now().toString(36);

const seed = async () => {
  console.log('Seeding database...');

  // Clear existing data (order matters due to foreign keys)
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

  // --- Users ---
  const hashedPassword = await bcrypt.hash('password123', 12);

  const admin = await prisma.user.create({
    data: {
      name: 'Admin User',
      email: 'admin@eventos.com',
      password: hashedPassword,
      role: 'admin',
    },
  });

  const organizer = await prisma.user.create({
    data: {
      name: 'Jane Organizer',
      email: 'jane@eventos.com',
      password: hashedPassword,
      role: 'organizer',
      phone: '+919876543210',
    },
  });

  await prisma.user.create({
    data: {
      name: 'Sam Customer',
      email: 'sam@eventos.com',
      password: hashedPassword,
      role: 'customer',
      phone: '+919812345678',
    },
  });

  const vendorUser1 = await prisma.user.create({
    data: {
      name: 'Chef Gordon',
      email: 'gordon@eventos.com',
      password: hashedPassword,
      role: 'vendor',
    },
  });

  const vendorUser2 = await prisma.user.create({
    data: {
      name: 'Photo Phil',
      email: 'phil@eventos.com',
      password: hashedPassword,
      role: 'vendor',
    },
  });

  const vendorUser3 = await prisma.user.create({
    data: {
      name: 'DJ Marcus',
      email: 'marcus@eventos.com',
      password: hashedPassword,
      role: 'vendor',
    },
  });

  const vendorUser4 = await prisma.user.create({
    data: {
      name: 'Flora Design',
      email: 'flora@eventos.com',
      password: hashedPassword,
      role: 'vendor',
    },
  });

  console.log('Users seeded');

  // --- Vendors ---
  const vendor1 = await prisma.vendor.create({
    data: {
      userId: vendorUser1.id,
      businessName: "Gordon's Catering",
      category: 'catering',
      description: 'Premium catering for all event types. From intimate dinners to grand receptions, we deliver exceptional culinary experiences with locally sourced ingredients and world-class presentation.',
      basePrice: 1400,
      currency: 'INR',
      priceType: 'per_person',
      packages: [
        {
          id: 'basic',
          name: 'Essential Menu',
          price: 65000,
          priceType: 'fixed',
          description: 'Perfect for small gatherings up to 50 guests',
          includes: ['3-course meal', 'Basic table setup', 'Staff for 4 hours', 'Non-alcoholic beverages'],
        },
        {
          id: 'standard',
          name: 'Classic Feast',
          price: 145000,
          priceType: 'fixed',
          description: 'Ideal for weddings & corporate events up to 150 guests',
          includes: ['5-course meal', 'Premium table setup', 'Staff for 6 hours', 'Full bar service', 'Custom menu consultation', 'Dessert station'],
        },
        {
          id: 'premium',
          name: 'Grand Gala',
          price: 320000,
          priceType: 'fixed',
          description: 'The ultimate experience for large-scale events up to 500 guests',
          includes: ['7-course tasting menu', 'Luxury table setup & décor', 'Staff for 10 hours', 'Premium open bar', 'Live cooking stations', 'Dessert & cheese bar', 'Dedicated event coordinator', 'Post-event cleanup'],
        },
      ],
      city: 'Hyderabad',
      state: 'Telangana',
      contactPhone: '+1111111111',
      contactEmail: 'gordon@eventos.com',
      website: 'https://gordonscatering.example.com',
      averageRating: 4.8,
      totalReviews: 12,
      isVerified: true,
      verificationStatus: 'approved',
      verifiedAt: new Date(),
    },
  });

  const vendor2 = await prisma.vendor.create({
    data: {
      userId: vendorUser2.id,
      businessName: "Phil's Photography",
      category: 'photography',
      description: 'Capturing moments with artistry. Award-winning photography team specializing in weddings, corporate events, and milestone celebrations with a modern editorial style.',
      basePrice: 35000,
      currency: 'INR',
      priceType: 'fixed',
      packages: [
        {
          id: 'basic',
          name: 'Essentials',
          price: 35000,
          priceType: 'fixed',
          description: '4 hours of coverage, perfect for small events',
          includes: ['1 photographer', '4 hours coverage', '100+ edited photos', 'Online gallery', 'Digital download'],
        },
        {
          id: 'standard',
          name: 'Full Day',
          price: 95000,
          priceType: 'fixed',
          description: '8 hours of full event coverage',
          includes: ['2 photographers', '8 hours coverage', '300+ edited photos', 'Online gallery', 'Engagement/pre-event shoot', 'USB drive with all photos', 'Print-ready files'],
        },
        {
          id: 'premium',
          name: 'Cinematic',
          price: 195000,
          priceType: 'fixed',
          description: 'Complete photo + video coverage',
          includes: ['2 photographers + 1 videographer', '10 hours coverage', '500+ edited photos', '5-minute highlight video', 'Full ceremony video', 'Drone aerial shots', 'Same-day preview edits', 'Premium photo album'],
        },
      ],
      city: 'Bengaluru',
      state: 'Karnataka',
      contactPhone: '+2222222222',
      contactEmail: 'phil@eventos.com',
      website: 'https://philsphotography.example.com',
      averageRating: 4.5,
      totalReviews: 8,
      isVerified: true,
      verificationStatus: 'approved',
      verifiedAt: new Date(),
    },
  });

  await prisma.vendor.create({
    data: {
      userId: vendorUser3.id,
      businessName: "BeatDrop Entertainment",
      category: 'music',
      description: 'Professional DJ and live music services for any occasion. From elegant wedding receptions to high-energy corporate parties, we set the perfect mood.',
      basePrice: 22000,
      currency: 'INR',
      priceType: 'fixed',
      packages: [
        {
          id: 'basic',
          name: 'DJ Only',
          price: 22000,
          priceType: 'fixed',
          description: 'Professional DJ for up to 4 hours',
          includes: ['Professional DJ', '4 hours', 'Sound system', 'Dance floor lighting', 'Music consultation'],
        },
        {
          id: 'standard',
          name: 'Party Package',
          price: 55000,
          priceType: 'fixed',
          description: 'DJ + MC + lighting for 6 hours',
          includes: ['Professional DJ', 'MC services', '6 hours', 'Premium sound system', 'Dance floor lighting', 'Fog machine', 'Custom playlist'],
        },
        {
          id: 'premium',
          name: 'Live & DJ Combo',
          price: 135000,
          priceType: 'fixed',
          description: 'Live band + DJ for the full event',
          includes: ['4-piece live band', 'Professional DJ', '8 hours', 'Premium sound & lighting', 'MC services', 'Custom song requests', 'Ceremony music'],
        },
      ],
      city: 'Chennai',
      state: 'Tamil Nadu',
      contactPhone: '+3333333333',
      contactEmail: 'marcus@eventos.com',
      averageRating: 4.6,
      totalReviews: 15,
      isVerified: true,
      verificationStatus: 'approved',
      verifiedAt: new Date(),
    },
  });

  await prisma.vendor.create({
    data: {
      userId: vendorUser4.id,
      businessName: "Bloom & Petal Florals",
      category: 'florist',
      description: 'Bespoke floral design for weddings and events. We create stunning arrangements that transform your venue into an unforgettable experience.',
      basePrice: 28000,
      currency: 'INR',
      priceType: 'fixed',
      packages: [
        {
          id: 'basic',
          name: 'Simple Elegance',
          price: 28000,
          priceType: 'fixed',
          description: 'Essential floral arrangements',
          includes: ['Bridal bouquet', '5 table centerpieces', 'Ceremony arch flowers', 'Boutonnière set'],
        },
        {
          id: 'standard',
          name: 'Garden Romance',
          price: 85000,
          priceType: 'fixed',
          description: 'Comprehensive floral design',
          includes: ['Bridal bouquet + bridesmaids', '10 table centerpieces', 'Ceremony arch', 'Aisle decoration', 'Welcome sign florals', 'Cake flowers'],
        },
        {
          id: 'premium',
          name: 'Luxe Installation',
          price: 220000,
          priceType: 'fixed',
          description: 'Full venue transformation',
          includes: ['All Standard items', 'Hanging installations', 'Photo wall backdrop', 'Lounge area florals', 'Guest table blooms', 'Restroom amenities', 'Floral chandelier', 'Setup & teardown'],
        },
      ],
      city: 'Visakhapatnam',
      state: 'Andhra Pradesh',
      contactPhone: '+4444444444',
      contactEmail: 'flora@eventos.com',
      averageRating: 4.9,
      totalReviews: 20,
      isVerified: true,
      verificationStatus: 'approved',
      verifiedAt: new Date(),
    },
  });

  const additionalVendorBlueprints = [
    { ownerName: 'Spice Route Caterers', email: 'spiceroute@eventos.com', businessName: 'Spice Route Caterers', category: 'catering', basePrice: 1800, city: 'Hyderabad', state: 'Telangana', rating: 4.7 },
    { ownerName: 'Aaradhya Decor Studio', email: 'aaradhyadecor@eventos.com', businessName: 'Aaradhya Decor Studio', category: 'decor', basePrice: 1400, city: 'Vijayawada', state: 'Andhra Pradesh', rating: 4.6 },
    { ownerName: 'LensCraft Weddings', email: 'lenscraft@eventos.com', businessName: 'LensCraft Weddings', category: 'photography', basePrice: 1500, city: 'Hyderabad', state: 'Telangana', rating: 4.8 },
    { ownerName: 'FrameStory Films', email: 'framestory@eventos.com', businessName: 'FrameStory Films', category: 'videography', basePrice: 1700, city: 'Visakhapatnam', state: 'Andhra Pradesh', rating: 4.7 },
    { ownerName: 'Sangeet Pulse', email: 'sangeetpulse@eventos.com', businessName: 'Sangeet Pulse', category: 'music', basePrice: 950, city: 'Hyderabad', state: 'Telangana', rating: 4.5 },
    { ownerName: 'Lotus Grand Venues', email: 'lotusvenues@eventos.com', businessName: 'Lotus Grand Venues', category: 'venue', basePrice: 4000, city: 'Guntur', state: 'Andhra Pradesh', rating: 4.4 },
    { ownerName: 'Petal Pooja Florals', email: 'petalpooja@eventos.com', businessName: 'Petal Pooja Florals', category: 'florist', basePrice: 700, city: 'Warangal', state: 'Telangana', rating: 4.6 },
    { ownerName: 'RideRaja Logistics', email: 'rideraja@eventos.com', businessName: 'RideRaja Logistics', category: 'transportation', basePrice: 600, city: 'Hyderabad', state: 'Telangana', rating: 4.5 },
    { ownerName: 'Elite Invitation House', email: 'eliteinvites@eventos.com', businessName: 'Elite Invitation House', category: 'other', basePrice: 500, city: 'Hyderabad', state: 'Telangana', rating: 4.4 },
    { ownerName: 'Bridal Glow Artists', email: 'bridalglow@eventos.com', businessName: 'Bridal Glow Artists', category: 'other', basePrice: 1100, city: 'Tirupati', state: 'Andhra Pradesh', rating: 4.7 },
  ];

  const additionalVendors = [];
  for (const bp of additionalVendorBlueprints) {
    const user = await prisma.user.create({
      data: {
        name: bp.ownerName,
        email: bp.email,
        password: hashedPassword,
        role: 'vendor',
      },
    });

    const vendor = await prisma.vendor.create({
      data: {
        userId: user.id,
        businessName: bp.businessName,
        category: bp.category,
        description: `${bp.businessName} offers high-quality ${bp.category} services tailored for weddings, receptions, and celebrations.`,
        basePrice: bp.basePrice,
        currency: 'INR',
        priceType: 'fixed',
        packages: [
          { id: 'starter', name: 'Starter', price: bp.basePrice, description: 'Best for intimate events' },
          { id: 'signature', name: 'Signature', price: bp.basePrice * 2, description: 'Balanced package for most events' },
          { id: 'elite', name: 'Elite', price: bp.basePrice * 3, description: 'Premium experience with add-ons' },
        ],
        city: bp.city,
        state: bp.state,
        contactPhone: '+910000000000',
        contactEmail: bp.email,
        averageRating: bp.rating,
        totalReviews: 6,
        isVerified: true,
        verificationStatus: 'approved',
        verifiedAt: new Date(),
      },
    });

    additionalVendors.push(vendor);
  }

  console.log('Vendors seeded');

  const packageSeedRows = [
    {
      vendorId: vendor1.id,
      title: 'Wedding Catering - Premium Buffet',
      description: 'Full-service buffet with appetizers, mains, desserts, and staffing.',
      category: 'catering',
      tier: 'premium',
      basePrice: 185000,
      currency: 'INR',
      unitLabel: 'per_guest',
      estimationRules: { perGuest: 1200, fixed: 15000 },
      deliverables: ['menu planning', 'service staff', 'buffet setup'],
    },
    {
      vendorId: vendor2.id,
      title: 'Photography - Full Day Coverage',
      description: '8-hour event coverage with edited photos and online gallery.',
      category: 'photography',
      tier: 'standard',
      basePrice: 95000,
      currency: 'INR',
      unitLabel: 'per_hour',
      estimationRules: { perHour: 8000 },
      deliverables: ['2 photographers', 'edited photos', 'online gallery'],
    },
  ];

  additionalVendors.forEach((vendor) => {
    packageSeedRows.push({
      vendorId: vendor.id,
      title: `${vendor.businessName} - Signature Package`,
      description: `Top-rated ${vendor.category} package for mid to large events.`,
      category: vendor.category,
      tier: 'signature',
      basePrice: Number(vendor.basePrice || 0),
      currency: 'INR',
      unitLabel: vendor.category === 'catering' ? 'per_guest' : vendor.category === 'photography' || vendor.category === 'videography' ? 'per_hour' : 'per_event',
      estimationRules:
        vendor.category === 'catering'
          ? { perGuest: 450, fixed: 10000 }
          : vendor.category === 'photography' || vendor.category === 'videography'
            ? { perHour: 3000, fixed: 5000 }
            : { fixed: Number(vendor.basePrice || 0) },
      deliverables: ['pre-event consultation', 'on-event execution', 'post-event support'],
    });
  });

  await prisma.vendorPackage.createMany({ data: packageSeedRows });

  await prisma.vendorTestimonial.createMany({
    data: [
      {
        vendorId: vendor1.id,
        clientName: 'Natalie & Chris',
        content: 'Outstanding food quality and very professional team.',
        rating: 5,
        source: 'Direct',
      },
      {
        vendorId: vendor2.id,
        clientName: 'Apex Corp',
        content: 'Captured our summit perfectly with quick turnaround.',
        rating: 5,
        source: 'Google Reviews',
      },
      ...additionalVendors.slice(0, 6).map((vendor) => ({
        vendorId: vendor.id,
        clientName: 'EventOS Client',
        content: `${vendor.businessName} delivered a smooth and dependable service for our event.`,
        rating: 5,
        source: 'Direct',
      })),
    ],
  });

  // --- Events ---
  const event1 = await prisma.event.create({
    data: {
      title: 'Spring Garden Wedding',
      slug: generateSlug('Spring Garden Wedding'),
      type: 'wedding',
      description: 'An elegant spring garden wedding celebration.',
      date: new Date('2026-06-15'),
      venue: 'Shilparamam Cultural Venue',
      address: 'HITEC City, Madhapur',
      city: 'Hyderabad',
      state: 'Telangana',
      budget: 2800000,
      guestCount: 150,
      organizerId: organizer.id,
      status: 'planning',
      isPublic: true,
      timeline: [
        { time: '14:00', activity: 'Guest Arrival' },
        { time: '14:30', activity: 'Ceremony' },
        { time: '16:00', activity: 'Reception & Dinner' },
        { time: '20:00', activity: 'Party & Dancing' },
      ],
      tasks: [
        { title: 'Finalize menu', assignee: 'Jane', status: 'in-progress', dueDate: '2026-05-01' },
        { title: 'Book photographer', assignee: 'Jane', status: 'completed', dueDate: '2026-04-01' },
        { title: 'Send invitations', assignee: 'Jane', status: 'pending', dueDate: '2026-04-15' },
      ],
    },
  });

  const event2 = await prisma.event.create({
    data: {
      title: 'Tech Summit 2026',
      slug: generateSlug('Tech Summit 2026'),
      type: 'corporate',
      description: 'Annual technology conference for innovators.',
      date: new Date('2026-09-20'),
      venue: 'BIEC Convention Hall',
      address: 'Tumkur Road',
      city: 'Bengaluru',
      state: 'Karnataka',
      budget: 5500000,
      guestCount: 500,
      organizerId: organizer.id,
      status: 'draft',
      isPublic: false,
    },
  });

  console.log('Events seeded');

  // --- Guests ---
  const guestNames = [
    'Alice Johnson', 'Bob Smith', 'Carol White', 'David Brown',
    'Eve Davis', 'Frank Miller', 'Grace Wilson', 'Henry Taylor',
  ];

  await prisma.guest.createMany({
    data: guestNames.map((name, i) => ({
      eventId: event1.id,
      name,
      email: `${name.split(' ')[0].toLowerCase()}@example.com`,
      rsvpStatus: i < 4 ? 'accepted' : i < 6 ? 'pending' : 'maybe',
      checkedIn: i < 2,
      checkedInAt: i < 2 ? new Date() : null,
    })),
  });

  console.log('Guests seeded');

  // --- Budgets ---
  await prisma.budget.create({
    data: {
      eventId: event1.id,
      totalBudget: 2800000,
      guestCount: 150,
      allocations: autoAllocateBudget(2800000, 'wedding'),
    },
  });

  console.log('Budgets seeded');
  console.log('Seed complete!');
  await prisma.$disconnect();
  process.exit(0);
};

seed().catch(async (err) => {
  console.error('Seed error:', err);
  await prisma.$disconnect();
  process.exit(1);
});
