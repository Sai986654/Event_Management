const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { r2Client, R2_BUCKET, R2_PUBLIC_URL } = require('../config/r2');

const SUPPORTED_LANGUAGES = ['en', 'te'];
const SUPPORTED_TONES = ['formal', 'friendly', 'emotional'];
const DEFAULT_TEMPLATE_KEY = 'royal-maroon';
const INVITE_TEMPLATES = [
  {
    key: 'royal-maroon',
    name: 'Royal Maroon',
    description: 'Classic wedding card feel with warm maroon + gold tones.',
    palette: {
      background: '#fff7f2',
      frame: '#7c2d12',
      accent: '#9a3412',
      title: '#4a1d0a',
      body: '#1f2937',
      subtle: '#6b7280',
      link: '#9a3412',
    },
  },
  {
    key: 'floral-cream',
    name: 'Floral Cream',
    description: 'Soft pastel invitation card with a gentle floral mood.',
    palette: {
      background: '#fffdf5',
      frame: '#14532d',
      accent: '#65a30d',
      title: '#14532d',
      body: '#1f2937',
      subtle: '#4b5563',
      link: '#166534',
    },
  },
  {
    key: 'modern-indigo',
    name: 'Modern Indigo',
    description: 'Minimal modern style with indigo accents.',
    palette: {
      background: '#f8faff',
      frame: '#1e3a8a',
      accent: '#3b82f6',
      title: '#1e3a8a',
      body: '#111827',
      subtle: '#475569',
      link: '#1d4ed8',
    },
  },
];

function listInviteTemplates() {
  return INVITE_TEMPLATES.map((template) => ({
    key: template.key,
    name: template.name,
    description: template.description,
    preview: {
      background: template.palette.background,
      frame: template.palette.frame,
      accent: template.palette.accent,
      gradient: `linear-gradient(135deg, ${template.palette.frame} 0%, ${template.palette.accent} 100%)`,
    },
  }));
}

function normalizeTemplateKey(templateKey) {
  const candidate = String(templateKey || DEFAULT_TEMPLATE_KEY).toLowerCase();
  return INVITE_TEMPLATES.some((template) => template.key === candidate)
    ? candidate
    : DEFAULT_TEMPLATE_KEY;
}

function getTemplateByKey(templateKey) {
  const normalized = normalizeTemplateKey(templateKey);
  return INVITE_TEMPLATES.find((template) => template.key === normalized) || INVITE_TEMPLATES[0];
}

function normalizeLanguage(language) {
  const candidate = String(language || 'en').toLowerCase();
  return SUPPORTED_LANGUAGES.includes(candidate) ? candidate : 'en';
}

function normalizeTone(tone) {
  const candidate = String(tone || 'friendly').toLowerCase();
  return SUPPORTED_TONES.includes(candidate) ? candidate : 'friendly';
}

function normalizeRelationship(relationship) {
  if (!relationship) return 'guest';
  return String(relationship).trim().toLowerCase().slice(0, 80) || 'guest';
}

function tokenizeRelationship(relationship) {
  const rel = normalizeRelationship(relationship);
  const familyMap = {
    uncle: 'uncle',
    aunt: 'aunt',
    cousin: 'cousin',
    brother: 'brother',
    sister: 'sister',
    anna: 'anna',
    akka: 'akka',
    friend: 'friend',
    colleague: 'colleague',
  };

  return familyMap[rel] || rel;
}

function buildSalutation(name, relationship, language) {
  const rel = tokenizeRelationship(relationship);
  const guestName = String(name || 'Guest').trim();

  if (language === 'te') {
    if (['anna', 'akka', 'uncle', 'aunt'].includes(rel)) return `Priyamaina ${guestName} garu`;
    if (rel === 'friend') return `Sneehithuda ${guestName}`;
    return `Aadaraniya ${guestName}`;
  }

  if (['uncle', 'aunt'].includes(rel)) return `Dear ${guestName} Uncle/Aunty`;
  if (['anna', 'akka'].includes(rel)) return `Dear ${guestName}`;
  return `Dear ${guestName}`;
}

function buildBodyByTone({ event, language, tone, relationship }) {
  const rel = tokenizeRelationship(relationship);
  const eventTitle = event?.title || 'our wedding celebration';
  const venue = event?.venue || 'our venue';
  const dateText = event?.date ? new Date(event.date).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'the celebration day';

  const copy = {
    en: {
      formal: `It gives us great pleasure to invite you to ${eventTitle}. Your gracious presence at ${venue} on ${dateText} will mean a lot to our family.`,
      emotional: `From our hearts, we would love to celebrate ${eventTitle} with you. Your blessings and presence at ${venue} on ${dateText} will make the day complete.`,
      friendly: `We are excited to celebrate ${eventTitle}, and it would not feel right without you. Join us at ${venue} on ${dateText} and let us make beautiful memories together.`,
    },
    te: {
      formal: `Meevu ${eventTitle} ku ravalanani mana hrudayapurvaka aahvanam. ${venue} lo ${dateText} na mee sannidhi maaku gauravam.`,
      emotional: `Mana ${eventTitle} sandarbhamlo mee aashirvadam maaku chala mukhyam. ${venue} lo ${dateText} na mee kalavadam kosam eduruchustunnam.`,
      friendly: `${eventTitle} ni kalisi celebrate cheddam. ${venue} lo ${dateText} na tappakunda randi, mee tho memories create cheddam.`,
    },
  };

  let base = copy[language]?.[tone] || copy.en.friendly;

  if (['uncle', 'aunt'].includes(rel)) {
    base += language === 'en' ? ' Your blessings mean a lot to us.' : ' Mee aashirvadam maaku chala mukhyam.';
  }

  return base;
}

function buildClosing(language) {
  if (language === 'te') return 'Prema to';
  return 'With love';
}

function buildInviteMessage({ guest, event, language, tone, relationship, customMessage, memoryNote }) {
  const salutation = buildSalutation(guest?.name, relationship, language);
  const body = buildBodyByTone({ event, language, tone, relationship });
  const custom = customMessage ? String(customMessage).trim() : '';
  const memory = memoryNote ? String(memoryNote).trim() : '';
  const closing = buildClosing(language);

  return [salutation, '', body, custom, memory, '', closing].filter(Boolean).join('\n');
}

function buildInviteUrl({ clientBaseUrl, event, guest, inviteToken }) {
  const base = String(clientBaseUrl || '').replace(/\/$/, '');
  if (!base) return '';

  if (event?.slug) {
    return `${base}/public/${event.slug}?guestId=${guest.id}&inviteToken=${inviteToken}`;
  }

  return `${base}/events/${event?.id || ''}`;
}

function drawTemplateBackground(doc, template) {
  const { width, height } = doc.page;
  const margin = 20;

  doc.save();
  doc.rect(0, 0, width, height).fill(template.palette.background);
  doc.restore();

  doc.save();
  doc.lineWidth(1.6);
  doc.strokeColor(template.palette.frame);
  doc.roundedRect(margin, margin, width - margin * 2, height - margin * 2, 8).stroke();
  doc.restore();

  doc.save();
  doc.fillColor(template.palette.accent);
  doc.circle(margin + 22, margin + 22, 6).fill();
  doc.circle(width - margin - 22, margin + 22, 6).fill();
  doc.circle(margin + 22, height - margin - 22, 6).fill();
  doc.circle(width - margin - 22, height - margin - 22, 6).fill();
  doc.restore();
}

function buildPdfBuffer({ guest, event, inviteMessage, inviteUrl, qrBuffer, language, tone, relationship, template }) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({ size: 'A4', margin: 48 });

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    drawTemplateBackground(doc, template);

    const palette = template.palette;

    doc.fontSize(12).fillColor(palette.accent).text('Vedika 360 Personalized Invitation', { align: 'center' });
    doc.moveDown(1);

    doc.fontSize(24).fillColor(palette.title).text(event?.title || 'Wedding Invitation', { align: 'center' });
    doc.moveDown(0.5);

    const dateLine = event?.date ? new Date(event.date).toLocaleString('en-IN', { dateStyle: 'full', timeStyle: 'short' }) : 'Date to be announced';
    doc.fontSize(11).fillColor(palette.subtle).text(`${dateLine} | ${event?.venue || 'Venue details coming soon'}`, {
      align: 'center',
    });
    doc.moveDown(1.2);

    doc.fontSize(11).fillColor(palette.subtle).text(`Guest: ${guest?.name || 'Guest'} | Relationship: ${relationship || 'guest'} | Tone: ${tone} | Language: ${language}`);
    doc.moveDown(0.8);

    doc.fontSize(13).fillColor(palette.body).text(inviteMessage, {
      align: 'left',
      lineGap: 5,
    });

    doc.moveDown(1.5);
    doc.fontSize(10).fillColor(palette.subtle).text('Scan this QR to open your invite/RSVP page:', { align: 'left' });
    doc.moveDown(0.4);
    if (qrBuffer) {
      doc.image(qrBuffer, doc.x, doc.y, { fit: [130, 130] });
      doc.moveDown(7);
    }

    if (inviteUrl) {
      doc.fontSize(10).fillColor(palette.link).text(inviteUrl, { align: 'left', underline: true });
    }

    doc.end();
  });
}

async function uploadPdfToR2(pdfBuffer, key) {
  await r2Client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: pdfBuffer,
      ContentType: 'application/pdf',
    })
  );

  return `${R2_PUBLIC_URL}/${key}`;
}

async function generatePersonalizedInvite({ guest, event, clientBaseUrl, payload = {} }) {
  const language = normalizeLanguage(payload.language || guest.inviteLanguage);
  const tone = normalizeTone(payload.tone || guest.inviteTone);
  const inviteTemplateKey = normalizeTemplateKey(payload.templateKey || guest.inviteTemplateKey);
  const template = getTemplateByKey(inviteTemplateKey);
  const relationship = normalizeRelationship(payload.relationship || guest.relationship);
  const customMessage = payload.customMessage || guest.customInviteMessage || '';
  const memoryNote = payload.memoryNote || '';
  const inviteToken = guest.inviteToken || crypto.randomBytes(16).toString('hex');

  const inviteUrl = buildInviteUrl({ clientBaseUrl, event, guest, inviteToken });
  const qrBuffer = inviteUrl ? await QRCode.toBuffer(inviteUrl, { width: 240, margin: 1 }) : null;
  const qrCodeDataUrl = inviteUrl ? await QRCode.toDataURL(inviteUrl) : null;

  const inviteMessage = buildInviteMessage({
    guest,
    event,
    language,
    tone,
    relationship,
    customMessage,
    memoryNote,
  });

  const pdfBuffer = await buildPdfBuffer({
    guest,
    event,
    inviteMessage,
    inviteUrl,
    qrBuffer,
    language,
    tone,
    relationship,
    template,
  });

  const key = `invites/personalized/${event.id}/${inviteTemplateKey}/guest-${guest.id}-${Date.now()}.pdf`;
  const pdfUrl = await uploadPdfToR2(pdfBuffer, key);

  return {
    inviteToken,
    inviteMessage,
    inviteLanguage: language,
    inviteTone: tone,
    inviteTemplateKey,
    templateName: template.name,
    relationship,
    customInviteMessage: customMessage || null,
    inviteUrl,
    qrCodeDataUrl,
    personalizedInvitePdfUrl: pdfUrl,
    personalizedInvitePdfKey: key,
  };
}

module.exports = {
  SUPPORTED_LANGUAGES,
  SUPPORTED_TONES,
  DEFAULT_TEMPLATE_KEY,
  listInviteTemplates,
  normalizeLanguage,
  normalizeTone,
  normalizeTemplateKey,
  generatePersonalizedInvite,
};
