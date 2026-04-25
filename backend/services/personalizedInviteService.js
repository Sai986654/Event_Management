const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { prisma } = require('../config/db');
const { r2Client, R2_BUCKET, R2_PUBLIC_URL } = require('../config/r2');

const SUPPORTED_LANGUAGES = ['en', 'te'];
const SUPPORTED_TONES = ['formal', 'friendly', 'emotional'];
const DEFAULT_INVITE_TEMPLATES = [
  {
    key: 'royal-maroon',
    name: 'Royal Maroon',
    description: 'Timeless Indian wedding card — deep maroon, gold borders, traditional L-bracket corner ornaments and diamond dividers.',
    ornamentStyle: 'traditional',
    palette: {
      background: '#fff7f2',
      frame: '#7c2d12',
      innerBorder: '#b45309',
      header: '#7c2d12',
      headerText: '#fef3c7',
      accent: '#9a3412',
      title: '#4a1d0a',
      subtitle: '#7c2d12',
      body: '#1f2937',
      subtle: '#6b7280',
      divider: '#b45309',
      link: '#9a3412',
      badge: '#fef3c7',
      badgeText: '#7c2d12',
    },
  },
  {
    key: 'golden-lotus',
    name: 'Golden Lotus',
    description: 'Opulent saffron and gold — inspired by royal Mughal court invitations with floral corner blooms.',
    ornamentStyle: 'floral',
    palette: {
      background: '#fffbeb',
      frame: '#92400e',
      innerBorder: '#d97706',
      header: '#92400e',
      headerText: '#fffbeb',
      accent: '#d97706',
      title: '#78350f',
      subtitle: '#92400e',
      body: '#1c1917',
      subtle: '#78716c',
      divider: '#d97706',
      link: '#b45309',
      badge: '#fef3c7',
      badgeText: '#92400e',
    },
  },
  {
    key: 'midnight-elegance',
    name: 'Midnight Elegance',
    description: 'Sophisticated deep navy with amber gold — geometric diamond corner accents for grand evening celebrations.',
    ornamentStyle: 'geometric',
    palette: {
      background: '#f0f4ff',
      frame: '#1e3a8a',
      innerBorder: '#b45309',
      header: '#1e3a8a',
      headerText: '#fef3c7',
      accent: '#b45309',
      title: '#1e3a8a',
      subtitle: '#1d4ed8',
      body: '#111827',
      subtle: '#4b5563',
      divider: '#b45309',
      link: '#1d4ed8',
      badge: '#eff6ff',
      badgeText: '#1e3a8a',
    },
  },
  {
    key: 'crimson-silk',
    name: 'Crimson Silk',
    description: 'Vibrant crimson red and ivory — traditional festive energy with classic L-bracket corner ornamentation.',
    ornamentStyle: 'traditional',
    palette: {
      background: '#fff5f5',
      frame: '#b91c1c',
      innerBorder: '#dc2626',
      header: '#b91c1c',
      headerText: '#fff5f5',
      accent: '#dc2626',
      title: '#7f1d1d',
      subtitle: '#b91c1c',
      body: '#1f2937',
      subtle: '#6b7280',
      divider: '#dc2626',
      link: '#dc2626',
      badge: '#fee2e2',
      badgeText: '#7f1d1d',
    },
  },
  {
    key: 'emerald-garden',
    name: 'Emerald Garden',
    description: 'Lush deep emerald green with floral corner blooms — earthy luxury for outdoor garden celebrations.',
    ornamentStyle: 'floral',
    palette: {
      background: '#f0fdf4',
      frame: '#14532d',
      innerBorder: '#15803d',
      header: '#14532d',
      headerText: '#f0fdf4',
      accent: '#16a34a',
      title: '#14532d',
      subtitle: '#15803d',
      body: '#111827',
      subtle: '#4b5563',
      divider: '#16a34a',
      link: '#15803d',
      badge: '#dcfce7',
      badgeText: '#14532d',
    },
  },
  {
    key: 'rose-gold-glam',
    name: 'Rose Gold Glam',
    description: 'Modern glamour with rose gold and blush — geometric diamond corner accents for upscale receptions.',
    ornamentStyle: 'geometric',
    palette: {
      background: '#fff5f7',
      frame: '#9d174d',
      innerBorder: '#db2777',
      header: '#9d174d',
      headerText: '#fff5f5',
      accent: '#db2777',
      title: '#831843',
      subtitle: '#9d174d',
      body: '#1f2937',
      subtle: '#6b7280',
      divider: '#db2777',
      link: '#be185d',
      badge: '#fce7f3',
      badgeText: '#9d174d',
    },
  },
  {
    key: 'lavender-dreams',
    name: 'Lavender Dreams',
    description: 'Soft amethyst and silver — delicate floral corner ornaments for intimate romantic gatherings.',
    ornamentStyle: 'floral',
    palette: {
      background: '#faf5ff',
      frame: '#6d28d9',
      innerBorder: '#7c3aed',
      header: '#6d28d9',
      headerText: '#faf5ff',
      accent: '#8b5cf6',
      title: '#4c1d95',
      subtitle: '#6d28d9',
      body: '#1f2937',
      subtle: '#6b7280',
      divider: '#8b5cf6',
      link: '#7c3aed',
      badge: '#ede9fe',
      badgeText: '#6d28d9',
    },
  },
  {
    key: 'teal-fusion',
    name: 'Teal Fusion',
    description: 'Contemporary teal and copper — bold geometric diamond ornaments for destination and beach weddings.',
    ornamentStyle: 'geometric',
    palette: {
      background: '#f0fdfa',
      frame: '#0f766e',
      innerBorder: '#0d9488',
      header: '#0f766e',
      headerText: '#f0fdfa',
      accent: '#0d9488',
      title: '#134e4a',
      subtitle: '#0f766e',
      body: '#111827',
      subtle: '#4b5563',
      divider: '#0d9488',
      link: '#0f766e',
      badge: '#ccfbf1',
      badgeText: '#0f766e',
    },
  },
  {
    key: 'floral-cream',
    name: 'Floral Cream',
    description: 'Delicate pastel ivory and sage — soft floral corner blooms for daytime garden celebrations.',
    ornamentStyle: 'floral',
    palette: {
      background: '#fffdf5',
      frame: '#14532d',
      innerBorder: '#65a30d',
      header: '#14532d',
      headerText: '#fffdf5',
      accent: '#65a30d',
      title: '#14532d',
      subtitle: '#16a34a',
      body: '#1f2937',
      subtle: '#4b5563',
      divider: '#65a30d',
      link: '#166534',
      badge: '#f0fdf4',
      badgeText: '#14532d',
    },
  },
  {
    key: 'modern-indigo',
    name: 'Modern Indigo',
    description: 'Clean indigo minimalism — sleek corner lines and restrained accents for contemporary couples.',
    ornamentStyle: 'minimal',
    palette: {
      background: '#f8faff',
      frame: '#1e3a8a',
      innerBorder: '#3b82f6',
      header: '#1e3a8a',
      headerText: '#f8faff',
      accent: '#3b82f6',
      title: '#1e3a8a',
      subtitle: '#2563eb',
      body: '#111827',
      subtle: '#475569',
      divider: '#3b82f6',
      link: '#1d4ed8',
      badge: '#eff6ff',
      badgeText: '#1e3a8a',
    },
  },
];

function normalizeTemplateConfig(raw, fallback) {
  const key = String(raw?.key || fallback.key || '').trim().toLowerCase();
  if (!key) return null;

  const r = raw?.palette || {};
  const f = fallback.palette || {};

  return {
    key,
    name: String(raw?.name || fallback.name || key).trim(),
    description: String(raw?.description || fallback.description || '').trim(),
    ornamentStyle: String(raw?.ornamentStyle || fallback.ornamentStyle || 'traditional').trim(),
    palette: {
      background:  String(r.background  || f.background  || '#ffffff'),
      frame:       String(r.frame       || f.frame       || '#333333'),
      innerBorder: String(r.innerBorder || r.frame       || f.innerBorder || f.frame  || '#555555'),
      header:      String(r.header      || r.frame       || f.header      || f.frame  || '#333333'),
      headerText:  String(r.headerText  || f.headerText  || '#ffffff'),
      accent:      String(r.accent      || f.accent      || '#666666'),
      title:       String(r.title       || f.title       || '#111111'),
      subtitle:    String(r.subtitle    || r.title       || f.subtitle    || f.title  || '#333333'),
      body:        String(r.body        || f.body        || '#1f2937'),
      subtle:      String(r.subtle      || f.subtle      || '#6b7280'),
      divider:     String(r.divider     || r.accent      || f.divider     || f.accent || '#888888'),
      link:        String(r.link        || f.link        || '#1d4ed8'),
      badge:       String(r.badge       || f.badge       || '#f9fafb'),
      badgeText:   String(r.badgeText   || r.title       || f.badgeText   || f.title  || '#111111'),
    },
  };
}

function loadInviteTemplatesFromEnv() {
  const raw = process.env.INVITE_TEMPLATES_JSON;
  if (!raw) return DEFAULT_INVITE_TEMPLATES;

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.length) return DEFAULT_INVITE_TEMPLATES;

    const templates = parsed
      .map((item, index) => normalizeTemplateConfig(item, DEFAULT_INVITE_TEMPLATES[index % DEFAULT_INVITE_TEMPLATES.length]))
      .filter(Boolean);

    return templates.length ? templates : DEFAULT_INVITE_TEMPLATES;
  } catch (_error) {
    return DEFAULT_INVITE_TEMPLATES;
  }
}

const ENV_INVITE_TEMPLATES = loadInviteTemplatesFromEnv();
const DEFAULT_TEMPLATE_KEY = ENV_INVITE_TEMPLATES[0]?.key || 'royal-maroon';

function normalizeDbTemplate(template, index = 0) {
  const fallback = ENV_INVITE_TEMPLATES[index % ENV_INVITE_TEMPLATES.length] || ENV_INVITE_TEMPLATES[0];
  return normalizeTemplateConfig(
    {
      key: template.key,
      name: template.name,
      description: template.description,
      palette: template.palette || {},
    },
    fallback
  );
}

async function getTemplateCatalog({ includeInactive = false } = {}) {
  try {
    const dbTemplates = await prisma.inviteTemplate.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });

    if (dbTemplates.length) {
      return dbTemplates
        .map((template, index) => normalizeDbTemplate(template, index))
        .filter(Boolean);
    }
  } catch (_error) {
    // Fall back to env/default templates when DB table is unavailable.
  }

  return ENV_INVITE_TEMPLATES;
}

async function getInviteTemplateKeys() {
  const templates = await getTemplateCatalog();
  return templates.map((template) => template.key);
}

async function listInviteTemplates() {
  const templates = await getTemplateCatalog();
  return templates.map((t) => ({
    key: t.key,
    name: t.name,
    description: t.description,
    ornamentStyle: t.ornamentStyle || 'traditional',
    preview: {
      background: t.palette.background,
      frame: t.palette.frame,
      accent: t.palette.accent,
      header: t.palette.header || t.palette.frame,
      headerText: t.palette.headerText || '#ffffff',
      badge: t.palette.badge || '#f9fafb',
      gradient: `linear-gradient(135deg, ${t.palette.header || t.palette.frame} 0%, ${t.palette.accent} 100%)`,
    },
  }));
}

function normalizeTemplateKey(templateKey, templates = ENV_INVITE_TEMPLATES) {
  const candidate = String(templateKey || DEFAULT_TEMPLATE_KEY).toLowerCase();
  return templates.some((template) => template.key === candidate)
    ? candidate
    : DEFAULT_TEMPLATE_KEY;
}

function getTemplateByKey(templateKey, templates = ENV_INVITE_TEMPLATES) {
  const normalized = normalizeTemplateKey(templateKey, templates);
  return templates.find((template) => template.key === normalized) || templates[0] || ENV_INVITE_TEMPLATES[0];
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

// ─── PDF Drawing Helpers ───────────────────────────────────────────────────

function _drawDiamond(doc, cx, cy, size, color) {
  doc.save()
    .fillColor(color)
    .moveTo(cx, cy - size)
    .lineTo(cx + size * 0.65, cy)
    .lineTo(cx, cy + size)
    .lineTo(cx - size * 0.65, cy)
    .closePath()
    .fill()
    .restore();
}

function _drawOrnateDivider(doc, y, x1, x2, color) {
  const mid = (x1 + x2) / 2;
  doc.save();
  doc.strokeColor(color).lineWidth(0.65);
  doc.moveTo(x1, y).lineTo(mid - 22, y).stroke();
  doc.moveTo(mid + 22, y).lineTo(x2, y).stroke();
  doc.restore();
  _drawDiamond(doc, mid, y, 4.5, color);
  doc.save().fillColor(color);
  doc.circle(mid - 13, y, 1.8).fill();
  doc.circle(mid + 13, y, 1.8).fill();
  doc.circle(mid - 22, y, 1.2).fill();
  doc.circle(mid + 22, y, 1.2).fill();
  doc.restore();
}

function _drawStraightDivider(doc, y, x1, x2, color) {
  doc.save().strokeColor(color).lineWidth(0.65);
  doc.moveTo(x1, y).lineTo(x2, y).stroke();
  doc.restore();
}

function _drawOrnateCorners(doc, x1, y1, x2, y2, color, style) {
  const s = 10;
  doc.save();
  if (style === 'traditional') {
    doc.strokeColor(color).lineWidth(1.5);
    doc.moveTo(x1 + s * 3, y1).lineTo(x1, y1).lineTo(x1, y1 + s * 3).stroke();
    doc.moveTo(x2 - s * 3, y1).lineTo(x2, y1).lineTo(x2, y1 + s * 3).stroke();
    doc.moveTo(x1 + s * 3, y2).lineTo(x1, y2).lineTo(x1, y2 - s * 3).stroke();
    doc.moveTo(x2 - s * 3, y2).lineTo(x2, y2).lineTo(x2, y2 - s * 3).stroke();
    _drawDiamond(doc, x1, y1, s * 0.7, color);
    _drawDiamond(doc, x2, y1, s * 0.7, color);
    _drawDiamond(doc, x1, y2, s * 0.7, color);
    _drawDiamond(doc, x2, y2, s * 0.7, color);
  } else if (style === 'floral') {
    doc.fillColor(color);
    doc.circle(x1, y1, s * 0.9).fill();
    doc.circle(x2, y1, s * 0.9).fill();
    doc.circle(x1, y2, s * 0.9).fill();
    doc.circle(x2, y2, s * 0.9).fill();
    doc.circle(x1 + s * 2.2, y1, s * 0.4).fill();
    doc.circle(x1, y1 + s * 2.2, s * 0.4).fill();
    doc.circle(x2 - s * 2.2, y1, s * 0.4).fill();
    doc.circle(x2, y1 + s * 2.2, s * 0.4).fill();
    doc.circle(x1 + s * 2.2, y2, s * 0.4).fill();
    doc.circle(x1, y2 - s * 2.2, s * 0.4).fill();
    doc.circle(x2 - s * 2.2, y2, s * 0.4).fill();
    doc.circle(x2, y2 - s * 2.2, s * 0.4).fill();
  } else if (style === 'geometric') {
    _drawDiamond(doc, x1, y1, s, color);
    _drawDiamond(doc, x2, y1, s, color);
    _drawDiamond(doc, x1, y2, s, color);
    _drawDiamond(doc, x2, y2, s, color);
    doc.strokeColor(color).lineWidth(0.9);
    doc.moveTo(x1 + s, y1).lineTo(x1 + s * 3.5, y1).stroke();
    doc.moveTo(x1, y1 + s).lineTo(x1, y1 + s * 3.5).stroke();
    doc.moveTo(x2 - s, y1).lineTo(x2 - s * 3.5, y1).stroke();
    doc.moveTo(x2, y1 + s).lineTo(x2, y1 + s * 3.5).stroke();
    doc.moveTo(x1 + s, y2).lineTo(x1 + s * 3.5, y2).stroke();
    doc.moveTo(x1, y2 - s).lineTo(x1, y2 - s * 3.5).stroke();
    doc.moveTo(x2 - s, y2).lineTo(x2 - s * 3.5, y2).stroke();
    doc.moveTo(x2, y2 - s).lineTo(x2, y2 - s * 3.5).stroke();
  } else {
    // minimal
    doc.strokeColor(color).lineWidth(1.2);
    doc.moveTo(x1 + s * 2.5, y1).lineTo(x1, y1).lineTo(x1, y1 + s * 2.5).stroke();
    doc.moveTo(x2 - s * 2.5, y1).lineTo(x2, y1).lineTo(x2, y1 + s * 2.5).stroke();
    doc.moveTo(x1 + s * 2.5, y2).lineTo(x1, y2).lineTo(x1, y2 - s * 2.5).stroke();
    doc.moveTo(x2 - s * 2.5, y2).lineTo(x2, y2).lineTo(x2, y2 - s * 2.5).stroke();
  }
  doc.restore();
}

// ─── Template Background (structural chrome) ──────────────────────────────

function drawTemplateBackground(doc, template) {
  const W = doc.page.width;
  const H = doc.page.height;
  const outerM = 22;
  const innerM = 31;
  const contentX = 50;
  const contentW = W - 100;
  const headerH = 58;
  const footerH = 46;
  const headerY = outerM;
  const footerY = H - outerM - footerH;
  const p = template.palette;
  const ornamentStyle = template.ornamentStyle || 'traditional';

  // Page background
  doc.rect(0, 0, W, H).fill(p.background);

  // Outer border (thick)
  doc.lineWidth(2.4).strokeColor(p.frame)
    .rect(outerM, outerM, W - outerM * 2, H - outerM * 2).stroke();

  // Inner border (thin)
  doc.lineWidth(0.8).strokeColor(p.innerBorder || p.accent)
    .rect(innerM, innerM, W - innerM * 2, H - innerM * 2).stroke();

  // Header band
  doc.save().rect(outerM + 1, headerY + 1, W - outerM * 2 - 2, headerH).fill(p.header || p.frame).restore();

  // Platform branding in header
  doc.font('Helvetica-Bold').fontSize(14).fillColor(p.headerText || '#ffffff')
    .text('Vedika 360', contentX, headerY + 10, { width: contentW, align: 'center' });
  doc.font('Helvetica').fontSize(8.5).fillColor(p.headerText || '#ffffff')
    .text('Personalized Wedding Invitations', contentX, headerY + 29, { width: contentW, align: 'center' });

  // Header ornament pearl row
  const hMid = W / 2;
  const hDotY = headerY + headerH - 10;
  doc.save().fillColor(p.headerText || '#ffffff');
  doc.circle(hMid - 75, hDotY, 1.8).fill();
  doc.circle(hMid - 50, hDotY, 1.2).fill();
  doc.circle(hMid - 20, hDotY, 1.8).fill();
  doc.circle(hMid, hDotY, 2.8).fill();
  doc.circle(hMid + 20, hDotY, 1.8).fill();
  doc.circle(hMid + 50, hDotY, 1.2).fill();
  doc.circle(hMid + 75, hDotY, 1.8).fill();
  doc.restore();

  // Footer band
  doc.save().rect(outerM + 1, footerY, W - outerM * 2 - 2, footerH).fill(p.header || p.frame).restore();

  doc.font('Helvetica').fontSize(7.5).fillColor(p.headerText || '#ffffff')
    .text('Scan the QR code to RSVP  |  Invite generated by Vedika 360', contentX, footerY + 8, { width: contentW, align: 'center' });
  doc.font('Helvetica').fontSize(7).fillColor(p.headerText || '#ffffff')
    .text('vedika360.com', contentX, footerY + 22, { width: contentW, align: 'center' });

  // Footer ornament pearl row
  const fMid = W / 2;
  const fDotY = footerY + footerH - 10;
  doc.save().fillColor(p.headerText || '#ffffff');
  for (let i = -3; i <= 3; i++) {
    const r = i === 0 ? 2.8 : Math.abs(i) === 1 ? 1.8 : 1.2;
    doc.circle(fMid + i * 16, fDotY, r).fill();
  }
  doc.restore();

  // Corner ornaments on inner border
  _drawOrnateCorners(doc, innerM, innerM, W - innerM, H - innerM, p.accent, ornamentStyle);

  return { headerBottomY: headerY + headerH, footerTopY: footerY, contentX, contentW };
}

function buildPdfBuffer({ guest, event, inviteMessage, inviteUrl, qrBuffer, language, tone, relationship, template }) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({ size: 'A4', margin: 0 });

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const { headerBottomY, footerTopY, contentX, contentW } = drawTemplateBackground(doc, template);
    const p = template.palette;
    const maxY = footerTopY - 12;
    let curY = headerBottomY + 16;

    function fits(h) { return curY + h <= maxY; }

    // ── Ornate divider + Event Title ──────────────────────────────────────
    if (fits(14)) {
      _drawOrnateDivider(doc, curY, contentX + 20, contentX + contentW - 20, p.divider || p.accent);
      curY += 14;
    }

    const eventTitle = event?.title || 'Wedding Celebration';
    if (fits(28)) {
      doc.font('Helvetica-Bold').fontSize(24).fillColor(p.title)
        .text(eventTitle, contentX, curY, { width: contentW, align: 'center' });
      curY = doc.y + 4;
    }

    const organizerName = event?.organizerName || event?.organizer?.name || '';
    if (organizerName && fits(16)) {
      doc.font('Helvetica-Oblique').fontSize(10).fillColor(p.subtitle || p.subtle)
        .text(`Hosted by ${organizerName}`, contentX, curY, { width: contentW, align: 'center' });
      curY = doc.y + 4;
    }

    if (fits(14)) {
      _drawOrnateDivider(doc, curY, contentX + 20, contentX + contentW - 20, p.divider || p.accent);
      curY += 18;
    }

    // ── Date & Venue highlight box ────────────────────────────────────────
    const dateStr = event?.date
      ? new Date(event.date).toLocaleString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
      : 'Date to be announced';
    const timeStr = event?.date
      ? new Date(event.date).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
      : '';
    const venueStr = event?.venue || 'Venue to be announced';

    if (fits(58)) {
      const dvH = 54;
      doc.roundedRect(contentX, curY, contentW, dvH, 5).fill(p.badge || '#fef9ee');
      doc.lineWidth(0.7).strokeColor(p.divider || p.accent)
        .roundedRect(contentX, curY, contentW, dvH, 5).stroke();
      doc.font('Helvetica-Bold').fontSize(11).fillColor(p.title)
        .text(dateStr + (timeStr ? `  \u2022  ${timeStr}` : ''), contentX + 14, curY + 9, { width: contentW - 28, align: 'center' });
      doc.font('Helvetica').fontSize(9.5).fillColor(p.subtle)
        .text(venueStr, contentX + 14, curY + 27, { width: contentW - 28, align: 'center' });
      curY += dvH + 18;
    }

    // ── Invitation section header ─────────────────────────────────────────
    if (fits(32)) {
      _drawStraightDivider(doc, curY, contentX, contentX + contentW, p.divider || p.accent);
      curY += 6;
      doc.font('Helvetica-Bold').fontSize(9).fillColor(p.subtitle || p.frame)
        .text('\u2014  INVITATION  \u2014', contentX, curY, { width: contentW, align: 'center' });
      curY = doc.y + 4;
      _drawStraightDivider(doc, curY, contentX, contentX + contentW, p.divider || p.accent);
      curY += 14;
    }

    // ── Personalized message ──────────────────────────────────────────────
    if (fits(30)) {
      const msgLines = inviteMessage.split('\n');
      for (let i = 0; i < msgLines.length; i++) {
        const line = msgLines[i];
        if (!fits(14)) break;
        if (line === '') {
          curY += 5;
        } else {
          const isSalutation = i === 0;
          const isClosing = line === 'With love' || line === 'Prema to';
          const font = isSalutation || isClosing ? 'Helvetica-Bold' : 'Helvetica-Oblique';
          const size = isSalutation ? 12 : isClosing ? 11 : 10.5;
          const color = isSalutation || isClosing ? (p.subtitle || p.title) : p.body;
          doc.font(font).fontSize(size).fillColor(color)
            .text(line, contentX + 12, curY, { width: contentW - 24, align: 'left', lineGap: 2 });
          curY = doc.y + 4;
        }
      }
      curY += 12;
    }

    // ── Event details section ─────────────────────────────────────────────
    if (fits(80)) {
      _drawStraightDivider(doc, curY, contentX, contentX + contentW, p.divider || p.accent);
      curY += 5;
      doc.font('Helvetica-Bold').fontSize(9).fillColor(p.subtitle || p.frame)
        .text('\u2014  EVENT DETAILS  \u2014', contentX, curY, { width: contentW, align: 'center' });
      curY = doc.y + 5;
      _drawStraightDivider(doc, curY, contentX, contentX + contentW, p.divider || p.accent);
      curY += 12;

      const detailRows = [
        { label: 'Date & Time', value: `${dateStr}${timeStr ? '  \u2022  ' + timeStr : ''}` },
        { label: 'Venue', value: venueStr },
        { label: 'Guest', value: `${guest?.name || 'Guest'}  \u2022  ${relationship || 'Guest'}` },
      ];

      const detBoxH = detailRows.length * 20 + 14;
      if (fits(detBoxH)) {
        doc.roundedRect(contentX, curY, contentW, detBoxH, 4).fill(p.badge || '#f9f9f9');
        doc.lineWidth(0.6).strokeColor(p.divider || p.accent)
          .roundedRect(contentX, curY, contentW, detBoxH, 4).stroke();

        let dY = curY + 9;
        const lW = 90;
        const vW = contentW - lW - 24;
        for (const row of detailRows) {
          doc.font('Helvetica-Bold').fontSize(8.5).fillColor(p.subtitle || p.frame)
            .text(row.label, contentX + 10, dY, { width: lW, align: 'left' });
          doc.font('Helvetica').fontSize(8.5).fillColor(p.body)
            .text(row.value, contentX + lW + 10, dY, { width: vW, align: 'left' });
          dY += 20;
        }
        curY += detBoxH + 18;
      }
    }

    // ── QR code + RSVP section ────────────────────────────────────────────
    if ((qrBuffer || inviteUrl) && fits(55)) {
      _drawStraightDivider(doc, curY, contentX, contentX + contentW, p.divider || p.accent);
      curY += 5;
      doc.font('Helvetica-Bold').fontSize(9).fillColor(p.subtitle || p.frame)
        .text('\u2014  RSVP  \u2014', contentX, curY, { width: contentW, align: 'center' });
      curY = doc.y + 5;
      _drawStraightDivider(doc, curY, contentX, contentX + contentW, p.divider || p.accent);
      curY += 12;

      if (fits(16)) {
        doc.font('Helvetica').fontSize(9).fillColor(p.subtle)
          .text('Scan the QR code below to confirm your attendance and open your personalized invite:', contentX + 10, curY, { width: contentW - 20, align: 'center' });
        curY = doc.y + 10;
      }

      if (qrBuffer && fits(122)) {
        const qrSize = 108;
        const qrX = contentX + (contentW - qrSize) / 2;
        doc.roundedRect(qrX - 6, curY - 4, qrSize + 12, qrSize + 12, 4).fill(p.badge || '#ffffff');
        doc.lineWidth(0.8).strokeColor(p.accent)
          .roundedRect(qrX - 6, curY - 4, qrSize + 12, qrSize + 12, 4).stroke();
        doc.image(qrBuffer, qrX, curY, { width: qrSize, height: qrSize });
        curY += qrSize + 16;
      }

      if (inviteUrl && fits(18)) {
        doc.font('Helvetica').fontSize(8.5).fillColor(p.link)
          .text(inviteUrl, contentX, curY, { width: contentW, align: 'center', underline: true });
      }
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
  const templates = await getTemplateCatalog();
  const language = normalizeLanguage(payload.language || guest.inviteLanguage);
  const tone = normalizeTone(payload.tone || guest.inviteTone);
  const inviteTemplateKey = normalizeTemplateKey(payload.templateKey || guest.inviteTemplateKey, templates);
  const template = getTemplateByKey(inviteTemplateKey, templates);
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
  getInviteTemplateKeys,
  listInviteTemplates,
  normalizeLanguage,
  normalizeTone,
  normalizeTemplateKey,
  generatePersonalizedInvite,
};
