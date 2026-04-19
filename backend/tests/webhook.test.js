
const request = require("supertest");
const { app } = require("../server");
const { prisma } = require("../config/db");
require("dotenv").config();

describe("Webhook API", () => {
  const testVendor = {
    email: `testwebhook${Date.now()}@example.com`,
    businessName: "Test Webhook Business",
    name: "John Doe",
    phone: "+911234567890",
    category: "catering",
    city: "Mumbai",
    state: "Maharashtra",
    description: "Test description",
    website: "https://example.com",
    basePrice: 1000
  };

  afterAll(async () => {
    try {
      // Clean up test user
      const user = await prisma.user.findUnique({ where: { email: testVendor.email } });
      if (user) {
        await prisma.vendor.deleteMany({ where: { userId: user.id } });
        await prisma.user.delete({ where: { id: user.id } });
      }
    } catch (err) {
      console.error("Cleanup error:", err);
    } finally {
      await prisma.$disconnect();
    }
  });

  it("POST /api/webhooks/vendor-form - should process a valid webhook", async () => {
    const res = await request(app)
      .post("/api/webhooks/vendor-form")
      .set("X-Webhook-Secret", process.env.VENDOR_WEBHOOK_SECRET || "")
      .send(testVendor);

    if (res.statusCode !== 201) {
      console.error("Webhook test failed:", res.body);
    }

    expect(res.statusCode).toBe(201);
    expect(res.body.message).toBe("Vendor registration successful");
    expect(res.body.email).toBe(testVendor.email);
  }, 30000);

  it("POST /api/webhooks/vendor-form - should fail with invalid email", async () => {
    const res = await request(app)
      .post("/api/webhooks/vendor-form")
      .set("X-Webhook-Secret", process.env.VENDOR_WEBHOOK_SECRET || "")
      .send({ ...testVendor, email: "invalid-email" });

    expect(res.statusCode).toBe(400);
    expect(res.body.errors).toBeDefined();
  }, 30000);
});
