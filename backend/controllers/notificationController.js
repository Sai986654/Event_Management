const { prisma } = require('../config/db');
const { sendEmail, sendSMS, sendWhatsApp } = require('../services/notificationService');
const { analyzeContacts, analyzeContactsPipeline } = require('../services/contactIntelligenceService');
const { parseGoogleContactsCsv } = require('../utils/googleContactsCsv');
const asyncHandler = require('../utils/asyncHandler');

// POST /api/notifications/email
exports.sendEmailNotification = asyncHandler(async (req, res) => {
  const { to, subject, html } = req.body;
  const success = await sendEmail({ to, subject, html });
  res.json({ sent: success });
});

// POST /api/notifications/sms
exports.sendSMSNotification = asyncHandler(async (req, res) => {
  const { to, message } = req.body;
  const success = await sendSMS({ to, message });
  res.json({ sent: success });
});

// POST /api/notifications/contacts/analyze
// Body: { contacts?: [...] } OR { csv: string (Google Contacts export) }, optional useOpenAi: boolean
exports.analyzeContactGraph = asyncHandler(async (req, res) => {
  const useOpenAi = req.body.useOpenAi !== false;

  if (req.body.csv != null && typeof req.body.csv === 'string' && req.body.csv.trim()) {
    const { contacts: raw, meta } = parseGoogleContactsCsv(req.body.csv);
    const result = await analyzeContactsPipeline(raw, { useOpenAi });
    return res.json({ ...result, importMeta: meta });
  }

  const raw = Array.isArray(req.body.contacts) ? req.body.contacts : [];
  const result = await analyzeContactsPipeline(raw, { useOpenAi });
  res.json(result);
});

// POST /api/notifications/events/:eventId/reminders/whatsapp
exports.sendEventWhatsAppReminders = asyncHandler(async (req, res) => {
  const eventId = Number(req.params.eventId);
  const group = String(req.body.group || 'all').toLowerCase();
  const messageText = req.body.message || 'Reminder: Please check your event invitation details.';
  const templateName = req.body.templateName || 'invitation_reminder';

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { guests: true },
  });
  if (!event) return res.status(404).json({ message: 'Event not found' });

  if (req.user.role === 'organizer' && event.organizerId !== req.user.id) {
    return res.status(403).json({ message: 'Not authorized for this event' });
  }

  const analyzed = analyzeContacts(
    (event.guests || []).map((g) => ({
      name: g.name,
      relationLabel: g.tableAssignment || g.dietaryPreferences || '',
      phone: g.phone,
      email: g.email,
    }))
  ).contacts;

  const target = analyzed.filter((c) => {
    if (!c.canNotifyWhatsApp) return false;
    if (group === 'all') return true;
    return c.group === group;
  });

  const results = [];
  for (const contact of target) {
    const sent = await sendWhatsApp({
      to: contact.phone,
      templateName,
      text: `${messageText}\nEvent: ${event.title}`,
    });
    results.push({ name: contact.name, to: contact.phone, group: contact.group, ...sent });
  }

  res.json({
    eventId,
    eventTitle: event.title,
    requestedGroup: group,
    totalGuests: event.guests.length,
    eligible: target.length,
    sentCount: results.filter((r) => r.sent).length,
    results,
  });
});
