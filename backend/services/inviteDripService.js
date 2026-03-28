const { prisma } = require('../config/db');
const { sendWhatsApp } = require('./notificationService');

const LOG = '[InviteDrip]';

function clientBaseUrl() {
  const u = String(process.env.CLIENT_URL || 'http://localhost:3000').replace(/\/+$/, '');
  return u;
}

function getLlmEndpoint() {
  const hasGroq = Boolean(process.env.GROQ_API_KEY);
  const hasOpenai = Boolean(process.env.OPENAI_API_KEY);
  if (hasGroq && (!hasOpenai || process.env.CONTACT_AI_PROVIDER === 'groq')) {
    return { url: 'https://api.groq.com/openai/v1/chat/completions', key: process.env.GROQ_API_KEY };
  }
  return { url: 'https://api.openai.com/v1/chat/completions', key: process.env.OPENAI_API_KEY };
}

function getLlmModel() {
  const env = String(process.env.CONTACT_AI_MODEL || '').trim();
  if (env) {
    if (process.env.GROQ_API_KEY && /^(gpt-|o\d)/i.test(env)) return 'llama-3.3-70b-versatile';
    return env;
  }
  return process.env.GROQ_API_KEY && !process.env.OPENAI_API_KEY ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini';
}

/**
 * Short, warm WhatsApp-sized text; falls back if no LLM key.
 */
async function generateDripCopy(event, { publicUrl, daysUntil }) {
  const videoHint = event.inviteDripVideoUrl
    ? `Optional teaser link to mention once: ${event.inviteDripVideoUrl}`
    : 'No video URL — focus on excitement and the guest page link.';

  const { url, key } = getLlmEndpoint();
  if (!key) {
    const fallback = [
      `Hi! ${daysUntil} days to ${event.title}.`,
      `RSVP & details: ${publicUrl}`,
      event.inviteDripVideoUrl ? `Teaser: ${event.inviteDripVideoUrl}` : '',
    ]
      .filter(Boolean)
      .join('\n');
    return fallback.slice(0, 1200);
  }

  const system = [
    'You write short WhatsApp invite reminders for Indian weddings and events.',
    'Output plain text only, no markdown, max 600 characters.',
    'Be warm, inclusive, mention the link once. ' + videoHint,
  ].join(' ');

  const user = JSON.stringify({
    eventTitle: event.title,
    venue: event.venue,
    eventDate: event.date,
    daysUntil,
    publicUrl,
    videoUrl: event.inviteDripVideoUrl || null,
  });

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: getLlmModel(),
        temperature: 0.85,
        max_tokens: 400,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: `Write today's reminder message for guests:\n${user}` },
        ],
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      console.error(`${LOG} llm_http`, res.status, t.slice(0, 400));
      throw new Error('llm_failed');
    }
    const data = await res.json();
    const text = String(data?.choices?.[0]?.message?.content || '').trim();
    if (text.length > 10) return text.slice(0, 1200);
  } catch (e) {
    console.warn(`${LOG} llm_fallback`, e.message);
  }

  return [
    `Reminder: ${event.title} is in about ${daysUntil} day(s)!`,
    publicUrl,
    event.inviteDripVideoUrl ? `Watch: ${event.inviteDripVideoUrl}` : '',
  ]
    .filter(Boolean)
    .join('\n')
    .slice(0, 1200);
}

function shouldSendNow(event, now) {
  if (!event.inviteDripEnabled || !event.isPublic) return false;
  const eventDate = new Date(event.date);
  if (eventDate.getTime() <= now.getTime()) return false;

  const intervalDays = Math.max(1, Math.min(14, Number(event.inviteDripIntervalDays) || 2));
  const msInterval = intervalDays * 24 * 60 * 60 * 1000;
  const last = event.inviteDripLastSentAt ? new Date(event.inviteDripLastSentAt).getTime() : null;
  if (last == null) return true;
  return now.getTime() - last >= msInterval;
}

/**
 * One event: generate copy and WhatsApp all guests with phone.
 */
async function sendDripForEvent(event) {
  const now = new Date();
  const guests = await prisma.guest.findMany({ where: { eventId: event.id } });
  const withPhone = guests.filter((g) => g.phone && String(g.phone).trim());
  if (!withPhone.length) {
    return { skipped: true, reason: 'no_guest_phones', sent: 0 };
  }

  const publicUrl = `${clientBaseUrl()}/public/${event.slug}`;
  const daysUntil = Math.max(
    0,
    Math.ceil((new Date(event.date).getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
  );

  const message = await generateDripCopy(event, { publicUrl, daysUntil });
  const templateName = process.env.INVITE_DRIP_WHATSAPP_TEMPLATE || 'invite_drip';

  const results = [];
  for (const g of withPhone) {
    const sent = await sendWhatsApp({
      to: g.phone,
      templateName,
      text: message,
    });
    results.push({ guestId: g.id, name: g.name, ...sent });
  }

  await prisma.event.update({
    where: { id: event.id },
    data: { inviteDripLastSentAt: now },
  });

  const sentCount = results.filter((r) => r.sent).length;
  console.log(`${LOG} event=${event.id} guests=${withPhone.length} sent=${sentCount}`);

  return { skipped: false, sent: sentCount, results };
}

/**
 * Cron: all eligible events.
 */
async function processInviteDripsTick() {
  if (String(process.env.INVITE_DRIP_ENABLED || 'true').toLowerCase() === 'false') {
    return { ran: false };
  }

  const now = new Date();
  const events = await prisma.event.findMany({
    where: {
      inviteDripEnabled: true,
      isPublic: true,
      date: { gt: now },
    },
  });

  const out = [];
  for (const event of events) {
    if (!shouldSendNow({ ...event, inviteDripLastSentAt: event.inviteDripLastSentAt }, now)) {
      continue;
    }
    try {
      const r = await sendDripForEvent(event);
      out.push({ eventId: event.id, ...r });
    } catch (e) {
      console.error(`${LOG} event_${event.id}`, e.message);
      out.push({ eventId: event.id, error: e.message });
    }
  }

  return { ran: true, processed: out.length, details: out };
}

/**
 * Manual trigger (organizer test) — optionally bypass interval with force=true.
 */
async function triggerInviteDripForEventId(eventId, { force = false } = {}) {
  const event = await prisma.event.findUnique({ where: { id: Number(eventId) } });
  if (!event) return { error: 'Event not found' };
  if (!event.inviteDripEnabled) return { error: 'Invite drip is not enabled for this event' };
  if (!event.isPublic) return { error: 'Set the event to public so guests have a page link' };

  const now = new Date();
  if (!force && !shouldSendNow(event, now)) {
    return { error: 'Interval not elapsed yet; use force=true to test anyway', code: 'INTERVAL' };
  }

  const r = await sendDripForEvent(event);
  return { ok: true, ...r };
}

module.exports = {
  processInviteDripsTick,
  triggerInviteDripForEventId,
  generateDripCopy,
};
