const PDFDocument = require('pdfkit');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { prisma } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { listInviteTemplates, generatePersonalizedInvite } = require('../services/personalizedInviteService');
const { sendInviteLink } = require('../services/notificationService');
const paymentService = require('../services/paymentService');
const { r2Client, R2_BUCKET, R2_PUBLIC_URL } = require('../config/r2');

const canManageEvent = (event, user) =>
  !!event && (event.organizerId === user.id || user.role === 'admin' || user.role === 'organizer');

const resolveClientBaseUrl = (req) =>
  process.env.CLIENT_URL || req.get('origin') || 'http://localhost:3000';

const normalizeFormat = (value) => {
  const candidate = String(value || '').toLowerCase();
  if (['png', 'jpg', 'pdf'].includes(candidate)) return candidate;
  return null;
};

const parsePositiveInt = (value) => {
  const num = Number(value);
  return Number.isInteger(num) && num > 0 ? num : null;
};

const inviteDesignTablesReady = async () => {
  try {
    const rows = await prisma.$queryRawUnsafe(
      "SELECT to_regclass('public.invite_designs')::text AS invite_designs, to_regclass('public.invite_design_assets')::text AS invite_design_assets, to_regclass('public.invite_design_exports')::text AS invite_design_exports"
    );
    const row = rows?.[0] || {};
    return Boolean(row.invite_designs && row.invite_design_assets && row.invite_design_exports);
  } catch (_error) {
    return false;
  }
};

const ensureInviteDesignTablesReady = async (res) => {
  const ready = await inviteDesignTablesReady();
  if (ready) return true;

  res.status(503).json({
    message:
      'Invite Design Studio is not ready on this database yet. Run prisma migrate deploy on the active production database and retry.',
    code: 'INVITE_DESIGN_MIGRATION_PENDING',
  });
  return false;
};

const buildBasicDesignPdfBuffer = ({ design, event }) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({ size: 'A4', margin: 40 });

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const layout = design.jsonLayout && typeof design.jsonLayout === 'object' ? design.jsonLayout : {};

    doc.font('Helvetica-Bold').fontSize(24).text(design.name || 'Invitation Design', { align: 'center' });
    doc.moveDown(0.5);
    doc.font('Helvetica').fontSize(12).text(`Event: ${event.title}`, { align: 'center' });
    doc.text(`Venue: ${event.venue || 'TBD'}`, { align: 'center' });
    doc.text(
      `Date: ${event.date ? new Date(event.date).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'TBD'}`,
      { align: 'center' }
    );

    doc.moveDown(1.2);
    doc.font('Helvetica-Bold').fontSize(13).text('Design Metadata');
    doc.moveDown(0.4);
    doc.font('Helvetica').fontSize(10);
    doc.text(`Category: ${design.category || 'general'}`);
    doc.text(`Canvas: ${design.canvasSize}`);
    doc.text(`Language: ${design.language}`);
    doc.text(`Version: ${design.version}`);

    doc.moveDown(0.8);
    doc.font('Helvetica-Bold').fontSize(13).text('Layout Snapshot');
    doc.moveDown(0.4);
    doc.font('Courier').fontSize(9).text(JSON.stringify(layout, null, 2), {
      width: doc.page.width - 80,
      height: 420,
      ellipsis: true,
    });

    doc.end();
  });

const uploadBufferToR2 = async ({ buffer, key, contentType }) => {
  if (!R2_BUCKET || !R2_PUBLIC_URL || !process.env.R2_ENDPOINT) {
    throw new Error('R2 is not configured for invite export');
  }

  await r2Client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );

  return `${String(R2_PUBLIC_URL).replace(/\/$/, '')}/${key}`;
};

// GET /api/invites/templates
exports.getInviteDesignTemplates = asyncHandler(async (_req, res) => {
  const templates = await listInviteTemplates();
  res.json({ templates });
});

// GET /api/invites/designs?eventId=:id
exports.listInviteDesigns = asyncHandler(async (req, res) => {
  if (!(await ensureInviteDesignTablesReady(res))) return;

  const eventId = parsePositiveInt(req.query.eventId);
  if (!eventId) return res.status(400).json({ message: 'eventId is required' });

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, organizerId: true },
  });

  if (!event) return res.status(404).json({ message: 'Event not found' });
  if (!canManageEvent(event, req.user)) return res.status(403).json({ message: 'Not authorized' });

  const designs = await prisma.inviteDesign.findMany({
    where: { eventId },
    orderBy: { updatedAt: 'desc' },
    include: {
      _count: {
        select: {
          assets: true,
          exports: true,
          guests: true,
        },
      },
    },
  });

  res.json({ eventId, designs });
});

// POST /api/invites/designs
exports.createInviteDesign = asyncHandler(async (req, res) => {
  if (!(await ensureInviteDesignTablesReady(res))) return;

  const eventId = parsePositiveInt(req.body.eventId);
  const name = String(req.body.name || '').trim();

  if (!eventId) return res.status(400).json({ message: 'eventId is required' });
  if (!name) return res.status(400).json({ message: 'name is required' });

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, organizerId: true },
  });

  if (!event) return res.status(404).json({ message: 'Event not found' });
  if (!canManageEvent(event, req.user)) return res.status(403).json({ message: 'Not authorized' });

  const design = await prisma.inviteDesign.create({
    data: {
      eventId,
      name,
      category: req.body.category ? String(req.body.category).trim() : null,
      status: req.body.status || 'draft',
      canvasSize: String(req.body.canvasSize || '1080x1920').trim(),
      language: String(req.body.language || 'en').trim().toLowerCase(),
      jsonLayout: req.body.jsonLayout && typeof req.body.jsonLayout === 'object' ? req.body.jsonLayout : {},
      previewUrl: req.body.previewUrl ? String(req.body.previewUrl).trim() : null,
    },
  });

  res.status(201).json({ design });
});

// GET /api/invites/designs/:id
exports.getInviteDesignById = asyncHandler(async (req, res) => {
  if (!(await ensureInviteDesignTablesReady(res))) return;

  const id = parsePositiveInt(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid design id' });

  const design = await prisma.inviteDesign.findUnique({
    where: { id },
    include: {
      event: { select: { id: true, organizerId: true, title: true, slug: true } },
      assets: { orderBy: { id: 'asc' } },
      exports: { orderBy: { createdAt: 'desc' } },
    },
  });

  if (!design) return res.status(404).json({ message: 'Invite design not found' });
  if (!canManageEvent(design.event, req.user)) return res.status(403).json({ message: 'Not authorized' });

  res.json({ design });
});

// PATCH /api/invites/designs/:id
exports.updateInviteDesign = asyncHandler(async (req, res) => {
  if (!(await ensureInviteDesignTablesReady(res))) return;

  const id = parsePositiveInt(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid design id' });

  const existing = await prisma.inviteDesign.findUnique({
    where: { id },
    include: { event: { select: { id: true, organizerId: true } } },
  });

  if (!existing) return res.status(404).json({ message: 'Invite design not found' });
  if (!canManageEvent(existing.event, req.user)) return res.status(403).json({ message: 'Not authorized' });

  const data = {};
  if (req.body.name !== undefined) data.name = String(req.body.name).trim();
  if (req.body.category !== undefined) data.category = req.body.category ? String(req.body.category).trim() : null;
  if (req.body.status !== undefined) data.status = String(req.body.status).toLowerCase();
  if (req.body.canvasSize !== undefined) data.canvasSize = String(req.body.canvasSize).trim();
  if (req.body.language !== undefined) data.language = String(req.body.language).trim().toLowerCase();
  if (req.body.jsonLayout !== undefined) {
    data.jsonLayout = req.body.jsonLayout && typeof req.body.jsonLayout === 'object' ? req.body.jsonLayout : {};
  }
  if (req.body.previewUrl !== undefined) data.previewUrl = req.body.previewUrl ? String(req.body.previewUrl).trim() : null;

  if (Object.prototype.hasOwnProperty.call(data, 'jsonLayout')) {
    data.version = existing.version + 1;
  }

  const design = await prisma.inviteDesign.update({ where: { id }, data });

  if (Array.isArray(req.body.assets)) {
    await prisma.inviteDesignAsset.deleteMany({ where: { designId: id } });
    const rows = req.body.assets
      .filter((asset) => asset && asset.url)
      .map((asset) => ({
        designId: id,
        type: ['image', 'font', 'sticker', 'icon', 'audio'].includes(String(asset.type || '').toLowerCase())
          ? String(asset.type).toLowerCase()
          : 'image',
        url: String(asset.url).trim(),
        metadata: asset.metadata && typeof asset.metadata === 'object' ? asset.metadata : {},
      }));

    if (rows.length) {
      await prisma.inviteDesignAsset.createMany({ data: rows });
    }
  }

  res.json({ design });
});

// POST /api/invites/designs/:id/duplicate
exports.duplicateInviteDesign = asyncHandler(async (req, res) => {
  if (!(await ensureInviteDesignTablesReady(res))) return;

  const id = parsePositiveInt(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid design id' });

  const existing = await prisma.inviteDesign.findUnique({
    where: { id },
    include: {
      event: { select: { id: true, organizerId: true } },
      assets: true,
    },
  });

  if (!existing) return res.status(404).json({ message: 'Invite design not found' });
  if (!canManageEvent(existing.event, req.user)) return res.status(403).json({ message: 'Not authorized' });

  const duplicateName = String(req.body.name || `${existing.name} (Copy)`).trim();

  const duplicated = await prisma.inviteDesign.create({
    data: {
      eventId: existing.eventId,
      name: duplicateName,
      category: existing.category,
      status: 'draft',
      canvasSize: existing.canvasSize,
      language: existing.language,
      jsonLayout: existing.jsonLayout,
      previewUrl: existing.previewUrl,
      assets: {
        create: existing.assets.map((asset) => ({
          type: asset.type,
          url: asset.url,
          metadata: asset.metadata || {},
        })),
      },
    },
    include: { assets: true },
  });

  res.status(201).json({ design: duplicated });
});

// POST /api/invites/designs/:id/export
exports.exportInviteDesign = asyncHandler(async (req, res) => {
  if (!(await ensureInviteDesignTablesReady(res))) return;

  const id = parsePositiveInt(req.params.id);
  const format = normalizeFormat(req.body.format);

  if (!id) return res.status(400).json({ message: 'Invalid design id' });
  if (!format) return res.status(400).json({ message: 'format must be png, jpg, or pdf' });

  const design = await prisma.inviteDesign.findUnique({
    where: { id },
    include: { event: { select: { id: true, organizerId: true, title: true, venue: true, date: true } } },
  });

  if (!design) return res.status(404).json({ message: 'Invite design not found' });
  if (!canManageEvent(design.event, req.user)) return res.status(403).json({ message: 'Not authorized' });

  const requirement = await paymentService.requireCompletedPaymentForEntity({
    entityType: 'invite_design_export',
    entityId: design.id,
    userId: design.event.organizerId,
  });

  if (requirement.required) {
    return res.status(402).json({
      message: 'Payment is required before exporting this invite design',
      requiredPayment: true,
      entityType: 'invite_design_export',
      entityId: design.id,
      config: requirement.config,
    });
  }

  let fileUrl = req.body.url ? String(req.body.url).trim() : null;
  let fileKey = req.body.fileKey ? String(req.body.fileKey).trim() : null;

  if (format === 'pdf') {
    const pdfBuffer = await buildBasicDesignPdfBuffer({ design, event: design.event });
    const key = `invites/design-exports/event-${design.eventId}/design-${design.id}/v${design.version}-${Date.now()}.pdf`;
    fileUrl = await uploadBufferToR2({
      buffer: pdfBuffer,
      key,
      contentType: 'application/pdf',
    });
    fileKey = key;
  } else if (!fileUrl) {
    return res.status(400).json({
      message: 'For png/jpg, pass url of the client-rendered export in request body',
    });
  }

  const exportRow = await prisma.inviteDesignExport.create({
    data: {
      designId: id,
      format,
      fileUrl,
      fileKey,
      width: parsePositiveInt(req.body.width),
      height: parsePositiveInt(req.body.height),
      createdByUserId: req.user.id,
    },
  });

  res.status(201).json({ export: exportRow });
});

// GET /api/invites/designs/:id/exports
exports.listInviteDesignExports = asyncHandler(async (req, res) => {
  if (!(await ensureInviteDesignTablesReady(res))) return;

  const id = parsePositiveInt(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid design id' });

  const design = await prisma.inviteDesign.findUnique({
    where: { id },
    include: { event: { select: { id: true, organizerId: true } } },
  });

  if (!design) return res.status(404).json({ message: 'Invite design not found' });
  if (!canManageEvent(design.event, req.user)) return res.status(403).json({ message: 'Not authorized' });

  const exports = await prisma.inviteDesignExport.findMany({
    where: { designId: id },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ designId: id, exports });
});

// POST /api/invites/designs/:id/personalize/:guestId
exports.attachDesignToGuest = asyncHandler(async (req, res) => {
  if (!(await ensureInviteDesignTablesReady(res))) return;

  const designId = parsePositiveInt(req.params.id);
  const guestId = parsePositiveInt(req.params.guestId);

  if (!designId || !guestId) return res.status(400).json({ message: 'Invalid designId or guestId' });

  const [design, guest] = await Promise.all([
    prisma.inviteDesign.findUnique({
      where: { id: designId },
      include: { event: { select: { id: true, organizerId: true } } },
    }),
    prisma.guest.findUnique({ where: { id: guestId } }),
  ]);

  if (!design) return res.status(404).json({ message: 'Invite design not found' });
  if (!guest) return res.status(404).json({ message: 'Guest not found' });
  if (guest.eventId !== design.eventId) {
    return res.status(400).json({ message: 'Guest and design must belong to the same event' });
  }
  if (!canManageEvent(design.event, req.user)) return res.status(403).json({ message: 'Not authorized' });

  const updatedGuest = await prisma.guest.update({
    where: { id: guestId },
    data: {
      inviteDesignId: designId,
      personalizedLayoutOverrides:
        req.body.layoutOverrides && typeof req.body.layoutOverrides === 'object'
          ? req.body.layoutOverrides
          : {},
    },
  });

  res.json({ guest: updatedGuest });
});

// POST /api/invites/designs/:id/send
exports.generateAndSendFromDesign = asyncHandler(async (req, res) => {
  if (!(await ensureInviteDesignTablesReady(res))) return;

  const designId = parsePositiveInt(req.params.id);
  const sendVia = String(req.body.sendVia || 'email').toLowerCase();

  if (!designId) return res.status(400).json({ message: 'Invalid design id' });
  if (!['email', 'whatsapp', 'both'].includes(sendVia)) {
    return res.status(400).json({ message: 'sendVia must be email, whatsapp, or both' });
  }

  const design = await prisma.inviteDesign.findUnique({
    where: { id: designId },
    include: {
      event: {
        select: { id: true, organizerId: true, title: true, date: true, venue: true, slug: true },
      },
    },
  });

  if (!design) return res.status(404).json({ message: 'Invite design not found' });
  if (!canManageEvent(design.event, req.user)) return res.status(403).json({ message: 'Not authorized' });

  const guestIds = Array.isArray(req.body.guestIds)
    ? req.body.guestIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)
    : [];

  const guests = await prisma.guest.findMany({
    where: {
      eventId: design.eventId,
      ...(guestIds.length ? { id: { in: guestIds } } : {}),
    },
    orderBy: { name: 'asc' },
  });

  if (!guests.length) return res.status(404).json({ message: 'No guests found' });

  const clientBaseUrl = resolveClientBaseUrl(req);
  const successes = [];
  const failures = [];

  for (const guest of guests) {
    try {
      const generated = await generatePersonalizedInvite({
        guest,
        event: design.event,
        clientBaseUrl,
        payload: {
          language: req.body.defaultLanguage || design.language || 'en',
          tone: req.body.defaultTone || guest.inviteTone || 'friendly',
          templateKey: req.body.defaultTemplateKey || guest.inviteTemplateKey,
          customMessage: req.body.customMessage,
        },
      });

      await prisma.guest.update({
        where: { id: guest.id },
        data: {
          inviteDesignId: designId,
          inviteTone: generated.inviteTone,
          inviteLanguage: generated.inviteLanguage,
          inviteTemplateKey: generated.inviteTemplateKey,
          personalizedInviteMessage: generated.inviteMessage,
          personalizedInvitePdfUrl: generated.personalizedInvitePdfUrl,
          personalizedInvitePdfKey: generated.personalizedInvitePdfKey,
          inviteToken: generated.inviteToken,
          invitationGeneratedAt: new Date(),
          qrCode: generated.qrCodeDataUrl,
        },
      });

      const sent = { email: false, whatsapp: false };
      if ((sendVia === 'email' || sendVia === 'both') && guest.email) {
        sent.email = await sendInviteLink({
          to: guest.email,
          channel: 'email',
          guestName: guest.name,
          eventTitle: design.event.title,
          inviteUrl: generated.inviteUrl,
          inviteMessage: generated.inviteMessage,
        });
      }
      if ((sendVia === 'whatsapp' || sendVia === 'both') && guest.phone) {
        sent.whatsapp = await sendInviteLink({
          to: guest.phone,
          channel: 'whatsapp',
          guestName: guest.name,
          eventTitle: design.event.title,
          inviteUrl: generated.inviteUrl,
          inviteMessage: generated.inviteMessage,
        });
      }

      successes.push({
        guestId: guest.id,
        name: guest.name,
        email: guest.email,
        phone: guest.phone,
        inviteUrl: generated.inviteUrl,
        sent,
      });
    } catch (error) {
      failures.push({
        guestId: guest.id,
        name: guest.name,
        error: error.message,
      });
    }
  }

  res.json({
    designId,
    eventId: design.eventId,
    total: guests.length,
    generated: successes.length,
    sent: successes.filter((row) => row.sent.email || row.sent.whatsapp).length,
    failed: failures.length,
    invites: successes,
    failures,
  });
});
