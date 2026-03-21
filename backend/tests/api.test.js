const request = require('supertest');
const { prisma } = require('../config/db');
const { app } = require('../server');

let token;
let adminToken;
let vendorToken;
let customerToken;
let organizerEventId;
let createdPackageId;
let createdOrderId;
let createdActivityId;
let customerEventId;

beforeAll(async () => {
  // Wait for DB connection
  await new Promise((resolve) => setTimeout(resolve, 3000));
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Auth API', () => {
  const testUser = {
    name: 'Test User',
    email: `test${Date.now()}@eventos.com`,
    password: 'password123',
    role: 'organizer',
  };

  it('POST /api/auth/register — should register a user', async () => {
    const res = await request(app).post('/api/auth/register').send(testUser);
    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.email).toBe(testUser.email);
    token = res.body.token;
  });

  it('POST /api/auth/login — should login', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: testUser.email, password: testUser.password });
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('token');
  });

  it('POST /api/auth/register — should register admin/vendor/customer users for flow tests', async () => {
    const admin = await request(app).post('/api/auth/register').send({
      name: 'Admin Flow',
      email: `adminflow${Date.now()}@eventos.com`,
      password: 'password123',
      role: 'admin',
    });
    expect(admin.statusCode).toBe(201);
    adminToken = admin.body.token;

    const vendor = await request(app).post('/api/auth/register').send({
      name: 'Vendor Flow',
      email: `vendorflow${Date.now()}@eventos.com`,
      password: 'password123',
      role: 'vendor',
    });
    expect(vendor.statusCode).toBe(201);
    vendorToken = vendor.body.token;

    const customer = await request(app).post('/api/auth/register').send({
      name: 'Customer Flow',
      email: `customerflow${Date.now()}@eventos.com`,
      password: 'password123',
      role: 'customer',
    });
    expect(customer.statusCode).toBe(201);
    customerToken = customer.body.token;
  });

  it('GET /api/auth/me — should return current user', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.user.name).toBe(testUser.name);
  });
});

describe('Health Check', () => {
  it('GET /api/health — should return ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('Events API', () => {
  let eventId;

  it('POST /api/events — should create an event', async () => {
    const res = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Test Event',
        type: 'corporate',
        date: '2026-12-01T10:00:00.000Z',
        venue: 'Test Venue',
      });
    expect(res.statusCode).toBe(201);
    expect(res.body.event).toHaveProperty('slug');
    eventId = res.body.event.id;
    organizerEventId = res.body.event.id;
  });

  it('GET /api/events — should list events', async () => {
    const res = await request(app)
      .get('/api/events')
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.events)).toBe(true);
  });

  it('GET /api/events/:id — should get single event', async () => {
    const res = await request(app)
      .get(`/api/events/${eventId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.event.title).toBe('Test Event');
  });
});

describe('Phase 3 API Flows', () => {
  it('POST /api/events — customer should create an event for planning flow', async () => {
    const res = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        title: 'Customer Planned Event',
        type: 'birthday',
        date: '2026-11-20T09:00:00.000Z',
        venue: 'City Hall',
      });
    expect(res.statusCode).toBe(201);
    customerEventId = res.body.event.id;
  });

  it('POST /api/packages — vendor should create package', async () => {
    // Create vendor profile first
    const profile = await request(app)
      .post('/api/vendors')
      .set('Authorization', `Bearer ${vendorToken}`)
      .send({
        businessName: 'Vendor Flow Studio',
        category: 'photography',
        description: 'Event photography services',
      });
    expect(profile.statusCode).toBe(201);

    // Admin approves vendor
    const vendorId = profile.body.vendor.id;
    const verify = await request(app)
      .patch(`/api/admin/vendors/${vendorId}/verify`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'approved' });
    expect(verify.statusCode).toBe(200);
    expect(verify.body.vendor.isVerified).toBe(true);

    const pkg = await request(app)
      .post('/api/packages')
      .set('Authorization', `Bearer ${vendorToken}`)
      .send({
        title: 'Wedding Coverage',
        description: '8 hour photo coverage with edits',
        category: 'photography',
        tier: 'standard',
        basePrice: 1500,
        estimationRules: { perHour: 100 },
      });
    expect(pkg.statusCode).toBe(201);
    createdPackageId = pkg.body.package.id;
  });

  it('POST /api/orders/quote — customer should get quote from selected package', async () => {
    const res = await request(app)
      .post('/api/orders/quote')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        eventId: customerEventId,
        selections: [{ packageId: createdPackageId, criteria: { hours: 5 } }],
      });
    expect(res.statusCode).toBe(201);
    expect(res.body.order).toHaveProperty('quotedTotal');
    expect((res.body.order.items || []).length).toBeGreaterThan(0);
    createdOrderId = res.body.order.id;
    createdActivityId = res.body.order.activities?.[0]?.id;
  });

  it('PATCH /api/orders/:id/place — organizer customer should place own order', async () => {
    const res = await request(app)
      .patch(`/api/orders/${createdOrderId}/place`)
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.order.status).toBe('placed');
  });

  it('PATCH /api/activities/:id/progress — admin can update progress', async () => {
    const res = await request(app)
      .patch(`/api/activities/${createdActivityId}/progress`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ progressPercent: 55, spendActual: 900, status: 'in_progress' });
    expect(res.statusCode).toBe(200);
    expect(res.body.activity.progressPercent).toBe(55);
  });

  it('PATCH /api/activities/:id/progress — vendor should be forbidden', async () => {
    const res = await request(app)
      .patch(`/api/activities/${createdActivityId}/progress`)
      .set('Authorization', `Bearer ${vendorToken}`)
      .send({ progressPercent: 80 });
    expect(res.statusCode).toBe(403);
  });
});

describe('Vendors API', () => {
  it('GET /api/vendors — should list vendors (public)', async () => {
    const res = await request(app).get('/api/vendors');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.vendors)).toBe(true);
  });
});

describe('AI Suggestions', () => {
  it('POST /api/ai/suggestions — should return mock suggestions', async () => {
    const res = await request(app)
      .post('/api/ai/suggestions')
      .set('Authorization', `Bearer ${token}`)
      .send({ eventType: 'wedding', budget: 50000, guestCount: 150 });
    expect(res.statusCode).toBe(200);
    expect(res.body.suggestions).toHaveProperty('vendors');
    expect(res.body.suggestions).toHaveProperty('themes');
    expect(res.body.suggestions).toHaveProperty('timeline');
  });
});
