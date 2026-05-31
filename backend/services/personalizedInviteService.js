const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const { PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
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
  const templateEngine = raw?.__templateEngine || r.__templateEngine || null;
  const adobeExpress = raw?.__adobeExpress || r.__adobeExpress || null;
  const hasTemplateEngineConfig = Boolean(raw?.configJson && typeof raw.configJson === 'object');

  const primary = r.primary || f.frame;
  const secondary = r.secondary || f.header;
  const accent = r.accent || f.accent;
  const background = r.background || f.background;
  const surface = r.surface || r.card || r.badge || f.badge;
  const border = r.border || f.innerBorder || primary;
  const textPrimary = r.textPrimary || r.title || f.title;
  const textSecondary = r.textSecondary || r.subtitle || f.subtitle;

  return {
    key,
    name: String(raw?.name || fallback.name || key).trim(),
    description: String(raw?.description || fallback.description || '').trim(),
    ornamentStyle: String(raw?.ornamentStyle || fallback.ornamentStyle || 'traditional').trim(),
    templateEngine: templateEngine
      ? String(templateEngine).trim().toLowerCase()
      : (hasTemplateEngineConfig ? 'template-engine' : null),
    adobeExpress: adobeExpress && typeof adobeExpress === 'object' ? adobeExpress : null,
    configJson: hasTemplateEngineConfig ? raw.configJson : null,
    palette: {
      background:  String(background || '#ffffff'),
      frame:       String(r.frame       || primary || '#333333'),
      innerBorder: String(r.innerBorder || border || '#555555'),
      header:      String(r.header      || secondary || primary || '#333333'),
      headerText:  String(r.headerText  || f.headerText  || '#ffffff'),
      accent:      String(accent || '#666666'),
      title:       String(textPrimary || '#111111'),
      subtitle:    String(textSecondary || textPrimary || '#333333'),
      body:        String(r.body || textPrimary || '#1f2937'),
      subtle:      String(r.subtle || textSecondary || '#6b7280'),
      divider:     String(r.divider || border || accent || '#888888'),
      link:        String(r.link        || f.link        || '#1d4ed8'),
      badge:       String(r.badge || surface || '#f9fafb'),
      badgeText:   String(r.badgeText || textPrimary || '#111111'),
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
      configJson: template.configJson || null,
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
  return templates.map((t) => {
    const firstScene = Array.isArray(t?.adobeExpress?.timeline) ? t.adobeExpress.timeline[0] : null;
    const previewAsset = firstScene?.baseVideo || firstScene?.asset || null;
    const config = t?.configJson && typeof t.configJson === 'object' ? t.configJson : {};
    const backgroundAssets = Array.isArray(config?.backgroundAssets)
      ? config.backgroundAssets
      : (config?.backgroundAssets && typeof config.backgroundAssets === 'object' ? Object.values(config.backgroundAssets) : []);
    const decorativeAssets = Array.isArray(config?.decorativeAssets)
      ? config.decorativeAssets
      : (config?.decorativeAssets && typeof config.decorativeAssets === 'object' ? Object.values(config.decorativeAssets) : []);

    const allAssets = [...backgroundAssets, ...decorativeAssets];
    const slotMap = {};
    allAssets.forEach((asset) => {
      if (!asset || typeof asset !== 'object') return;
      const slot = String(asset.assetSlot || asset.slot || asset.id || asset.key || '').trim();
      const url = String(asset.url || asset.assetUrl || asset.src || asset.assetPath || asset.publicId || '').trim();
      if (slot && url) slotMap[slot] = url;
    });

    const backgroundAssetRef = String(config?.canvas?.backgroundAssetRef || '').trim();
    const templateEnginePreviewAsset =
      (backgroundAssetRef && slotMap[backgroundAssetRef]) ||
      slotMap.backgroundTextureImage ||
      slotMap.backgroundImage ||
      String(config?.canvas?.backgroundImage || '').trim() ||
      null;

    const previewAssetResolved = templateEnginePreviewAsset || previewAsset;
    const previewAssetKey = resolveR2ObjectKey(previewAssetResolved);
    const previewImageUrl = /^https?:\/\//i.test(String(previewAssetResolved || ''))
      ? String(previewAssetResolved)
      : previewAssetKey
        ? `${R2_PUBLIC_URL}/${previewAssetKey}`
        : null;

    const hasTemplateEngineConfig = Boolean(t?.templateEngine === 'template-engine' && t?.configJson && typeof t.configJson === 'object');
    const hasBackgroundAsset = Boolean(templateEnginePreviewAsset);

    return {
      key: t.key,
      name: t.name,
      description: t.description,
      ornamentStyle: t.ornamentStyle || 'traditional',
      templateEngine: t.templateEngine || 'classic',
      previewImageUrl,
      debug: {
        hasTemplateEngineConfig,
        hasBackgroundAsset,
        backgroundAssetRef: backgroundAssetRef || null,
      },
      preview: {
        background: t.palette.background,
        frame: t.palette.frame,
        accent: t.palette.accent,
        header: t.palette.header || t.palette.frame,
        headerText: t.palette.headerText || '#ffffff',
        badge: t.palette.badge || '#f9fafb',
        gradient: `linear-gradient(135deg, ${t.palette.header || t.palette.frame} 0%, ${t.palette.accent} 100%)`,
      },
    };
  });
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

function resolveTemplateTokens(value, context) {
  if (typeof value === 'string') {
    return value.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, token) => {
      const resolved = String(token)
        .split('.')
        .reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), context);
      return resolved === undefined || resolved === null ? '' : String(resolved);
    });
  }
  if (Array.isArray(value)) return value.map((entry) => resolveTemplateTokens(entry, context));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolveTemplateTokens(v, context)]));
  }
  return value;
}

function firstText(...values) {
  return values.find((value) => typeof value === 'string' && value.trim()) || '';
}

function normalizeTemplateEngineSections(templateConfig, context) {
  if (!templateConfig || typeof templateConfig !== 'object') return [];
  const layoutSections = Array.isArray(templateConfig?.layout?.sections) ? templateConfig.layout.sections : [];
  const componentSections = Array.isArray(templateConfig?.components) ? templateConfig.components : [];
  const sections = layoutSections.length ? layoutSections : componentSections;

  return sections
    .filter((section) => section && section.visible !== false)
    .sort((a, b) => Number(a?.order || 0) - Number(b?.order || 0))
    .map((section) => ({
      ...section,
      props: resolveTemplateTokens(section?.props || {}, context),
      bindings: resolveTemplateTokens(section?.bindings || {}, context),
      style: resolveTemplateTokens(section?.style || {}, context),
    }));
}

function getSectionByComponentType(sections, typeName) {
  const normalized = String(typeName || '').toLowerCase();
  return (sections || []).find((section) => String(section?.componentType || '').toLowerCase() === normalized) || null;
}

function collectAssetSlotUrls(templateConfig) {
  const normalizeAssetCollection = (value) => {
    if (Array.isArray(value)) return value;
    if (value && typeof value === 'object') return Object.values(value);
    return [];
  };

  const assets = {};
  const collect = (entry) => {
    if (!entry || typeof entry !== 'object') return;
    const slot = String(entry.assetSlot || entry.slot || entry.id || entry.key || '').trim();
    const url = String(entry.url || entry.assetUrl || entry.src || entry.assetPath || entry.publicId || '').trim();
    if (slot && url) assets[slot] = url;
  };

  const backgroundAssets = normalizeAssetCollection(templateConfig?.backgroundAssets);
  const decorativeAssets = normalizeAssetCollection(templateConfig?.decorativeAssets);
  backgroundAssets.forEach(collect);
  decorativeAssets.forEach(collect);
  return assets;
}

function buildTemplateEnginePdfBuffer({ guest, event, inviteMessage, inviteUrl, qrBuffer, relationship, template }) {
  return new Promise(async (resolve, reject) => {
    try {
      const chunks = [];
      const doc = new PDFDocument({ size: 'A4', margin: 0 });
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const p = template.palette || {};
      const W = doc.page.width;
      const H = doc.page.height;
      const pagePad = 26;
      const cardX = pagePad;
      const cardW = W - pagePad * 2;
      const cardTop = pagePad;
      const cardBottom = H - pagePad;

      const eventDate = event?.date ? new Date(event.date) : null;
      const dateText = eventDate ? eventDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Date to be announced';
      const timeText = eventDate ? eventDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '';
      const context = {
        guest: {
          name: guest?.name || 'Guest',
          guestCategory: guest?.guestCategory || 'VIP',
          relationship: relationship || guest?.relationship || 'Guest',
          qrData: inviteUrl || '',
          invitationMessage: inviteMessage,
        },
        event: {
          title: event?.title || 'Wedding Celebration',
          brideName: event?.brideName || 'Bride',
          groomName: event?.groomName || 'Groom',
          dateText,
          timeText,
          venue: event?.venue || 'Venue to be announced',
          city: event?.city || '',
          groomFamily: event?.groomFamily || '',
          brideFamily: event?.brideFamily || '',
        },
      };

      const resolvedTemplateConfig = resolveTemplateTokens(template.configJson || {}, context);
      const sections = normalizeTemplateEngineSections(resolvedTemplateConfig, context);
      const assetSlotUrls = collectAssetSlotUrls(resolvedTemplateConfig);

      const guestHeaderSection = getSectionByComponentType(sections, 'GuestHeader');
      const guestBadgeSection = getSectionByComponentType(sections, 'GuestBadge');
      const messageSection = getSectionByComponentType(sections, 'PersonalMessage');
      const heroSection = getSectionByComponentType(sections, 'CoupleHero');
      const smartSection = getSectionByComponentType(sections, 'SmartRecommendations');
      const familySection = getSectionByComponentType(sections, 'FamilyConnection');
      const rsvpSection = getSectionByComponentType(sections, 'RSVPSection');
      const qrSection = getSectionByComponentType(sections, 'QRPass');

      let y = cardTop + 18;

      const heroProps = heroSection?.props || {};
      const headerProps = guestHeaderSection?.props || {};
      const badgeProps = guestBadgeSection?.props || {};
      const msgProps = messageSection?.props || {};
      const smartProps = smartSection?.props || {};
      const familyProps = familySection?.props || {};
      const rsvpProps = rsvpSection?.props || {};
      const qrProps = qrSection?.props || {};

      const topDecorAssetRef = firstText(headerProps.topDecorAssetRef, 'topGarlandImage');
      const topDecorUrl = firstText(assetSlotUrls[topDecorAssetRef], assetSlotUrls.topGarlandImage, headerProps.topDecorUrl);
      const topDecorBuffer = await loadR2AssetBuffer(topDecorUrl);

      const heroImageAssetRef = firstText(heroProps.heroImageAssetRef, 'heroBrideGroomImage');
      const heroImageUrl = firstText(heroProps.heroImageUrl, heroSection?.bindings?.heroImageUrl, assetSlotUrls[heroImageAssetRef], assetSlotUrls.heroBrideGroomImage);
      const heroImageBuffer = await loadR2AssetBuffer(heroImageUrl);

      const mapAssetRef = firstText(qrProps.mapPreviewAssetRef, 'mapPreviewImage');
      const mapPreviewUrl = firstText(qrProps.mapPreviewUrl, assetSlotUrls[mapAssetRef], assetSlotUrls.mapPreviewImage);
      const mapPreviewBuffer = await loadR2AssetBuffer(mapPreviewUrl);

      const backgroundAssetRef = firstText(headerProps.backgroundAssetRef, 'backgroundTextureImage');
      const backgroundImageUrl = firstText(
        assetSlotUrls[backgroundAssetRef],
        assetSlotUrls.backgroundTextureImage,
        assetSlotUrls.backgroundImage,
        resolvedTemplateConfig?.canvas?.backgroundImage
      );
      const backgroundImageBuffer = await loadR2AssetBuffer(backgroundImageUrl);

      if (backgroundImageBuffer) {
        doc.image(backgroundImageBuffer, 0, 0, { fit: [W, H], align: 'center', valign: 'center' });
        doc.save().fillOpacity(0.1).rect(0, 0, W, H).fill('#fffaf0').restore();
        doc.save().fillOpacity(0.82).roundedRect(cardX, cardTop, cardW, cardBottom - cardTop, 24).fill('#fffdf7').restore();
      } else {
        doc.rect(0, 0, W, H).fill(p.background || '#F8F3E8');
        doc.roundedRect(cardX, cardTop, cardW, cardBottom - cardTop, 24).fill('#fffdf7');
      }

      doc.lineWidth(1.6).strokeColor(p.frame || '#6D4C2F').roundedRect(cardX, cardTop, cardW, cardBottom - cardTop, 24).stroke();
      _drawOrnateCorners(doc, cardX + 10, cardTop + 10, cardX + cardW - 10, cardBottom - 10, p.accent || '#C28A2E', 'traditional');

      const badgeText = firstText(badgeProps.badge, badgeProps.label, context?.guest?.guestCategory, 'VIP');
      const headerTitle = firstText(headerProps.title, template?.name, event?.title, 'Wedding Invite');
      const namesLine = firstText(headerProps.subtitle, `${context.event.brideName} ❤ ${context.event.groomName}`);
      const openingLine = firstText(headerProps.themeLine, `With divine blessings, we invite ${context.guest.name}`);

      const salutation = firstText(msgProps.salutation, `Priyamaina ${guest?.name || 'Guest'} garu`);
      const body = firstText(msgProps.message, inviteMessage.split('\n').filter(Boolean).slice(1).join(' '), inviteMessage);
      const dateLine = firstText(msgProps.dateLine, `Date: ${dateText}${timeText ? ` | Time: ${timeText}` : ''}`);
      const venueLine = firstText(msgProps.venueLine, `Venue: ${event?.venue || ''}${event?.city ? `, ${event.city}` : ''}`);

      const scheduleItems = Array.isArray(smartProps.items) && smartProps.items.length
        ? smartProps.items
        : [
            { time: firstText(context.event.segment1Time, '9:00 AM'), label: firstText(context.event.segment1Label, 'Gauri Puja') },
            { time: firstText(context.event.segment2Time, timeText || '10:30 AM'), label: firstText(context.event.segment2Label, 'Muhurtham') },
            { time: firstText(context.event.segment3Time, '12:00 PM'), label: firstText(context.event.segment3Label, 'Lunch Reception') },
          ];

      const groomFamilyLine = firstText(
        familyProps.groomFamily,
        `Groom's Family: ${event?.groomFamily || 'To be announced'}`
      );
      const brideFamilyLine = firstText(
        familyProps.brideFamily,
        `Bride's Family: ${event?.brideFamily || 'To be announced'}`
      );

      const rsvpPrimary = firstText(rsvpProps?.actions?.[0]?.label, rsvpProps.primaryAction, 'RSVP Now');
      const rsvpSecondary = firstText(rsvpProps?.actions?.[1]?.label, rsvpProps.secondaryAction, 'Join Live Stream');

      // Header strip
      doc.save().roundedRect(cardX + 8, y, cardW - 16, 48, 14).fill(p.header || '#6D4C2F').restore();
      doc.font('Helvetica-Bold').fontSize(19).fillColor(p.headerText || '#fffdf7')
        .text(headerTitle, cardX + 20, y + 14, { width: cardW - 40, align: 'center' });
      y += 64;

      _drawOrnateDivider(doc, y - 8, cardX + 34, cardX + cardW - 34, p.divider || p.accent || '#C28A2E');

      if (topDecorBuffer) {
        doc.image(topDecorBuffer, cardX + 24, y - 14, { fit: [cardW - 48, 50], align: 'center', valign: 'center' });
        y += 34;
      }

      doc.font('Helvetica-Bold').fontSize(22).fillColor(p.title || '#4B3621')
        .text(namesLine, cardX + 22, y, { width: cardW - 44, align: 'center' });
      y = doc.y + 2;
      doc.font('Helvetica').fontSize(9.5).fillColor(p.subtitle || '#6B5A45')
        .text(openingLine, cardX + 22, y, { width: cardW - 44, align: 'center' });
      y = doc.y + 10;

      // Guest category badge
      doc.roundedRect(cardX + (cardW - 120) / 2, y, 120, 22, 11).fill(p.badge || '#fff6dc');
      doc.lineWidth(0.8).strokeColor(p.divider || '#D9C39A').roundedRect(cardX + (cardW - 120) / 2, y, 120, 22, 11).stroke();
      doc.font('Helvetica-Bold').fontSize(10).fillColor(p.badgeText || p.title || '#4B3621')
        .text(badgeText, cardX + (cardW - 120) / 2, y + 7, { width: 120, align: 'center' });
      y += 30;

      if (heroImageBuffer) {
        const heroH = 232;
        doc.roundedRect(cardX + 18, y, cardW - 36, heroH, 20).fill('#f8f3e8');
        doc.image(heroImageBuffer, cardX + 18, y, { fit: [cardW - 36, heroH], align: 'center', valign: 'center' });
        doc.lineWidth(1).strokeColor(p.divider || '#D9C39A').roundedRect(cardX + 18, y, cardW - 36, heroH, 20).stroke();
        y += heroH + 12;
      } else {
        const heroH = 152;
        doc.roundedRect(cardX + 18, y, cardW - 36, heroH, 20).fill('#f8f3e8');
        doc.lineWidth(1).strokeColor(p.divider || '#D9C39A').roundedRect(cardX + 18, y, cardW - 36, heroH, 20).stroke();
        doc.font('Helvetica-Bold').fontSize(20).fillColor(p.title || '#4B3621')
          .text(namesLine, cardX + 34, y + 58, { width: cardW - 68, align: 'center' });
        y += heroH + 12;
      }

      doc.roundedRect(cardX + 18, y, cardW - 36, 122, 14).fill(p.badge || '#fff9ee');
      doc.lineWidth(0.8).strokeColor(p.divider || '#D9C39A').roundedRect(cardX + 18, y, cardW - 36, 122, 14).stroke();
      doc.font('Helvetica-Bold').fontSize(14).fillColor(p.title || '#4B3621').text(salutation, cardX + 30, y + 14, { width: cardW - 60, align: 'left' });
      doc.font('Helvetica').fontSize(10.5).fillColor(p.body || '#1f2937').text(body, cardX + 30, y + 36, { width: cardW - 60, align: 'left', lineGap: 2 });
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor(p.subtitle || '#6B5A45').text(dateLine, cardX + 30, y + 84, { width: cardW - 60, align: 'left' });
      doc.font('Helvetica').fontSize(9.5).fillColor(p.subtle || '#6B7280').text(venueLine, cardX + 30, y + 100, { width: cardW - 60, align: 'left' });
      y += 138;

      // RSVP action row
      const btnW = (cardW - 52) / 2;
      doc.roundedRect(cardX + 18, y, btnW, 34, 17).fill('#fff6dc');
      doc.roundedRect(cardX + 18 + btnW + 16, y, btnW, 34, 17).fill('#fff6dc');
      doc.lineWidth(0.8).strokeColor(p.divider || '#D9C39A').roundedRect(cardX + 18, y, btnW, 34, 17).stroke();
      doc.lineWidth(0.8).strokeColor(p.divider || '#D9C39A').roundedRect(cardX + 18 + btnW + 16, y, btnW, 34, 17).stroke();
      doc.font('Helvetica-Bold').fontSize(11).fillColor(p.title || '#4B3621').text(rsvpPrimary, cardX + 18, y + 11, { width: btnW, align: 'center' });
      doc.font('Helvetica-Bold').fontSize(11).fillColor(p.title || '#4B3621').text(rsvpSecondary, cardX + 18 + btnW + 16, y + 11, { width: btnW, align: 'center' });
      y += 50;

      // Timeline strip
      const timelineY = y;
      const timelineH = 72;
      doc.roundedRect(cardX + 18, timelineY, cardW - 36, timelineH, 12).fill('#fffdf7');
      doc.lineWidth(0.8).strokeColor(p.divider || '#D9C39A').roundedRect(cardX + 18, timelineY, cardW - 36, timelineH, 12).stroke();
      const columnW = (cardW - 36) / 3;
      scheduleItems.slice(0, 3).forEach((item, idx) => {
        const colX = cardX + 18 + idx * columnW;
        const cx = colX + columnW / 2;
        doc.circle(cx, timelineY + 12, 5).fill(p.accent || '#C28A2E');
        doc.circle(cx, timelineY + 12, 2).fill('#fffdf7');
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(p.subtitle || '#6B5A45')
          .text(firstText(item?.time, '--'), colX, timelineY + 22, { width: columnW, align: 'center' });
        doc.font('Helvetica').fontSize(8.2).fillColor(p.body || '#1f2937')
          .text(firstText(item?.label, 'Program'), colX + 6, timelineY + 40, { width: columnW - 12, align: 'center' });
      });
      y += timelineH + 10;

      // Family card
      doc.roundedRect(cardX + 18, y, cardW - 36, 62, 12).fill('#fffdf7');
      doc.lineWidth(0.8).strokeColor(p.divider || '#D9C39A').roundedRect(cardX + 18, y, cardW - 36, 62, 12).stroke();
      doc.font('Helvetica-Bold').fontSize(10.5).fillColor(p.title || '#4B3621')
        .text(groomFamilyLine, cardX + 30, y + 16, { width: cardW - 60, align: 'left' });
      doc.font('Helvetica-Bold').fontSize(10.5).fillColor(p.title || '#4B3621')
        .text(brideFamilyLine, cardX + 30, y + 34, { width: cardW - 60, align: 'left' });
      y += 78;

      // Map + QR card
      if (qrBuffer && y + 120 < cardBottom - 20) {
        doc.roundedRect(cardX + 18, y, cardW - 36, 108, 12).fill('#fffdf7');
        doc.lineWidth(0.8).strokeColor(p.divider || '#D9C39A').roundedRect(cardX + 18, y, cardW - 36, 108, 12).stroke();
        doc.font('Helvetica-Bold').fontSize(10).fillColor(p.subtitle || '#6B5A45').text('Get Directions / RSVP', cardX + 28, y + 12, { width: 210, align: 'left' });
        if (mapPreviewBuffer) {
          doc.image(mapPreviewBuffer, cardX + 28, y + 32, { fit: [184, 66], align: 'center', valign: 'center' });
          doc.lineWidth(0.5).strokeColor('#d4c9a8').roundedRect(cardX + 28, y + 32, 184, 66, 8).stroke();
        } else {
          doc.roundedRect(cardX + 28, y + 32, 184, 66, 8).fill('#f6f1e2');
          doc.lineWidth(0.5).strokeColor('#d4c9a8').roundedRect(cardX + 28, y + 32, 184, 66, 8).stroke();
          doc.font('Helvetica').fontSize(9).fillColor(p.subtle || '#6B7280')
            .text(firstText(qrProps.ctaLabel, 'Get Directions'), cardX + 28, y + 58, { width: 184, align: 'center' });
        }
        doc.image(qrBuffer, cardX + cardW - 18 - 84, y + 12, { width: 84, height: 84 });
        if (inviteUrl) {
          doc.font('Helvetica').fontSize(8.2).fillColor(p.link || '#1d4ed8').text(inviteUrl, cardX + 220, y + 81, { width: cardW - 250, align: 'left' });
        }
      }

      _drawOrnateDivider(doc, cardBottom - 20, cardX + 40, cardX + cardW - 40, p.divider || p.accent || '#C28A2E');

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

function resolveR2ObjectKey(assetPath) {
  if (!assetPath) return null;
  const raw = String(assetPath).trim();
  if (!raw) return null;

  if (/^https?:\/\//i.test(raw)) {
    if (R2_PUBLIC_URL && raw.startsWith(R2_PUBLIC_URL)) {
      return raw.slice(R2_PUBLIC_URL.length).replace(/^\/+/, '');
    }
    try {
      const parsed = new URL(raw);
      return decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
    } catch (_error) {
      return null;
    }
  }

  return raw.replace(/^\/+/, '');
}

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function loadR2AssetBuffer(assetPath) {
  const key = resolveR2ObjectKey(assetPath);
  if (!key) return null;

  try {
    const response = await r2Client.send(
      new GetObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
      })
    );

    if (!response?.Body) return null;
    if (typeof response.Body.transformToByteArray === 'function') {
      const byteArray = await response.Body.transformToByteArray();
      return Buffer.from(byteArray);
    }
    return await streamToBuffer(response.Body);
  } catch (_error) {
    return null;
  }
}

function resolveAdobeFieldValue({ fieldId, guest, event, inviteMessage, inviteUrl, relationship, customMessage }) {
  const key = String(fieldId || '').trim().toLowerCase();
  const eventDate = event?.date ? new Date(event.date) : null;
  const dateText = eventDate ? eventDate.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '';
  const timeText = eventDate ? eventDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '';
  const inviteLines = String(inviteMessage || '').split('\n').map((line) => line.trim()).filter(Boolean);
  const salutationLine = inviteLines[0] || '';
  const closingLine = inviteLines[inviteLines.length - 1] || '';
  const firstBodyLine = inviteLines.find((line, idx) => idx > 0 && line !== 'With love' && line !== 'Prema to') || '';
  const addressParts = [event?.address, event?.city, event?.state].filter(Boolean);
  const mapUrl = Number.isFinite(Number(event?.lat)) && Number.isFinite(Number(event?.lng))
    ? `https://maps.google.com/?q=${event.lat},${event.lng}`
    : (event?.venue || addressParts.join(', '))
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${event?.venue || ''} ${addressParts.join(' ')}`.trim())}`
      : '';
  const hashtag = event?.slug ? `#${String(event.slug).replace(/[^a-z0-9]/gi, '')}` : '#CelebrateWithVedika360';
  const hostLine = event?.organizerName || event?.organizer?.name || 'Hosted by Vedika 360';
  const dressCode = 'Traditional Elegance';
  const seatingInfo = relationship ? `Reserved for ${relationship}` : 'Reserved for our honored guest';

  if (['eventtitle', 'covertitle', 'title'].includes(key)) return event?.title || '';
  if (['bridename', 'hostname', 'rsvpname'].includes(key)) return event?.organizerName || event?.organizer?.name || 'Vedika 360';
  if (['groomname', 'partnername'].includes(key)) return event?.partnerName || '';
  if (['eventdate'].includes(key)) return dateText;
  if (['eventtime'].includes(key)) return timeText;
  if (['venuename', 'eventvenue'].includes(key)) return event?.venue || '';
  if (['eventaddress', 'venueaddress', 'locationaddress'].includes(key)) return addressParts.join(', ') || event?.venue || '';
  if (['guestname'].includes(key)) return guest?.name || 'Guest';
  if (['welcomeline', 'salutation'].includes(key)) return salutationLine;
  if (['closingline', 'closingtext'].includes(key)) return closingLine;
  if (['hostline', 'hostmessage', 'hosttitle'].includes(key)) return hostLine;
  if (['dresscode'].includes(key)) return dressCode;
  if (['hashtag'].includes(key)) return hashtag;
  if (['maplink', 'venuemap'].includes(key)) return mapUrl;
  if (['programhighlight', 'eventhighlight'].includes(key)) return firstBodyLine || customMessage || '';
  if (['seatinginfo'].includes(key)) return seatingInfo;
  if (['specialnote', 'custommessage', 'coversubtitle', 'subtitle'].includes(key)) {
    return customMessage || firstBodyLine || relationship || '';
  }
  if (['rsvpphone'].includes(key)) return guest?.phone || '';
  if (['rsvplink'].includes(key)) return inviteUrl || '';

  return '';
}

function resolvePdfFontName(style = {}) {
  const familyRaw = String(style.fontFamily || '').toLowerCase();
  const weightRaw = String(style.weight || style.fontWeight || '').toLowerCase();
  const isBold = ['bold', '700', '800', '900', 'semibold', '600'].includes(weightRaw);
  const isItalic = Boolean(style.italic) || String(style.fontStyle || '').toLowerCase() === 'italic';

  let family = 'helvetica';
  if (familyRaw.includes('serif') || familyRaw.includes('times')) family = 'times';
  else if (familyRaw.includes('mono') || familyRaw.includes('courier')) family = 'courier';

  if (family === 'times') {
    if (isBold && isItalic) return 'Times-BoldItalic';
    if (isBold) return 'Times-Bold';
    if (isItalic) return 'Times-Italic';
    return 'Times-Roman';
  }

  if (family === 'courier') {
    if (isBold && isItalic) return 'Courier-BoldOblique';
    if (isBold) return 'Courier-Bold';
    if (isItalic) return 'Courier-Oblique';
    return 'Courier';
  }

  if (isBold && isItalic) return 'Helvetica-BoldOblique';
  if (isBold) return 'Helvetica-Bold';
  if (isItalic) return 'Helvetica-Oblique';
  return 'Helvetica';
}

function normalizeLayerStyle({ layer, meta, template, boxHeight }) {
  const style = {
    ...((meta && typeof meta.style === 'object') ? meta.style : {}),
    ...((layer && typeof layer.style === 'object') ? layer.style : {}),
  };

  const parsedFont = Number(style.fontSize);
  const fontSize = Number.isFinite(parsedFont)
    ? Math.max(8, Math.min(120, parsedFont))
    : Math.max(10, Math.min(70, Math.round(boxHeight * 0.6)));

  const parsedLineHeight = Number(style.lineHeight);
  const lineGap = Number.isFinite(parsedLineHeight)
    ? Math.max(0, parsedLineHeight > 3 ? parsedLineHeight - fontSize : fontSize * Math.max(0, parsedLineHeight - 1))
    : 2;

  const parsedLetter = Number(style.letterSpacing);
  const letterSpacing = Number.isFinite(parsedLetter) ? Math.max(0, Math.min(8, parsedLetter)) : 0;

  const parsedPadX = Number(style.paddingX);
  const parsedPadY = Number(style.paddingY);
  const parsedPad = Number(style.padding);
  const paddingX = Number.isFinite(parsedPadX)
    ? Math.max(0, Math.min(80, parsedPadX))
    : Number.isFinite(parsedPad)
      ? Math.max(0, Math.min(80, parsedPad))
      : 0;
  const paddingY = Number.isFinite(parsedPadY)
    ? Math.max(0, Math.min(80, parsedPadY))
    : Number.isFinite(parsedPad)
      ? Math.max(0, Math.min(80, parsedPad))
      : 0;

  const parsedRadius = Number(style.radius);
  const parsedBorderWidth = Number(style.borderWidth);
  const parsedBgOpacity = Number(style.backgroundOpacity);
  const parsedStrokeWidth = Number(style.strokeWidth);
  const parsedShadowDx = Number(style.shadowOffsetX);
  const parsedShadowDy = Number(style.shadowOffsetY);
  const parsedShadowOpacity = Number(style.shadowOpacity);
  const parsedRotation = Number(style.rotation);
  const parsedOpacity = Number(style.opacity);

  return {
    fontName: resolvePdfFontName(style),
    fontSize,
    color: String(style.color || template?.palette?.body || '#111827'),
    align: String(style.align || layer?.align || 'center'),
    uppercase: Boolean(style.uppercase),
    lineGap,
    letterSpacing,
    backgroundColor: style.backgroundColor ? String(style.backgroundColor) : null,
    backgroundOpacity: Number.isFinite(parsedBgOpacity) ? Math.max(0, Math.min(1, parsedBgOpacity)) : 0.82,
    borderColor: style.borderColor ? String(style.borderColor) : null,
    borderWidth: Number.isFinite(parsedBorderWidth) ? Math.max(0, Math.min(12, parsedBorderWidth)) : 0,
    radius: Number.isFinite(parsedRadius) ? Math.max(0, Math.min(80, parsedRadius)) : 0,
    paddingX,
    paddingY,
    shadowColor: style.shadowColor ? String(style.shadowColor) : null,
    shadowOffsetX: Number.isFinite(parsedShadowDx) ? Math.max(-40, Math.min(40, parsedShadowDx)) : 0,
    shadowOffsetY: Number.isFinite(parsedShadowDy) ? Math.max(-40, Math.min(40, parsedShadowDy)) : 0,
    shadowOpacity: Number.isFinite(parsedShadowOpacity) ? Math.max(0, Math.min(1, parsedShadowOpacity)) : 0.35,
    strokeColor: style.strokeColor ? String(style.strokeColor) : null,
    strokeWidth: Number.isFinite(parsedStrokeWidth) ? Math.max(0, Math.min(8, parsedStrokeWidth)) : 0,
    rotation: Number.isFinite(parsedRotation) ? Math.max(-180, Math.min(180, parsedRotation)) : 0,
    opacity: Number.isFinite(parsedOpacity) ? Math.max(0, Math.min(1, parsedOpacity)) : 1,
    textGradient: style.textGradient && typeof style.textGradient === 'object' ? style.textGradient : null,
    backgroundGradient: style.backgroundGradient && typeof style.backgroundGradient === 'object' ? style.backgroundGradient : null,
  };
}

function buildLinearGradient(doc, x, y, width, height, gradientStyle) {
  if (!gradientStyle || typeof gradientStyle !== 'object') return null;

  const angleDeg = Number.isFinite(Number(gradientStyle.angle)) ? Number(gradientStyle.angle) : 90;
  const angle = (angleDeg * Math.PI) / 180;
  const cx = x + width / 2;
  const cy = y + height / 2;
  const len = Math.sqrt(width * width + height * height) / 2;

  const fromX = Number.isFinite(Number(gradientStyle.fromX)) ? x + width * Number(gradientStyle.fromX) : cx - Math.cos(angle) * len;
  const fromY = Number.isFinite(Number(gradientStyle.fromY)) ? y + height * Number(gradientStyle.fromY) : cy - Math.sin(angle) * len;
  const toX = Number.isFinite(Number(gradientStyle.toX)) ? x + width * Number(gradientStyle.toX) : cx + Math.cos(angle) * len;
  const toY = Number.isFinite(Number(gradientStyle.toY)) ? y + height * Number(gradientStyle.toY) : cy + Math.sin(angle) * len;

  const gradient = doc.linearGradient(fromX, fromY, toX, toY);
  const stops = Array.isArray(gradientStyle.stops) ? gradientStyle.stops : null;
  if (stops && stops.length >= 2) {
    stops.forEach((stop) => {
      const offset = Number.isFinite(Number(stop?.offset)) ? Math.max(0, Math.min(1, Number(stop.offset))) : 0;
      const color = String(stop?.color || '#000000');
      gradient.stop(offset, color);
    });
    return gradient;
  }

  gradient.stop(0, String(gradientStyle.from || '#111827'));
  gradient.stop(1, String(gradientStyle.to || '#ffffff'));
  return gradient;
}

function buildAdobeExpressPdfBuffer({ guest, event, template, inviteMessage, inviteUrl, qrBuffer, relationship, customMessage }) {
  return new Promise(async (resolve, reject) => {
    try {
      const adobe = template?.adobeExpress || {};
      const timeline = Array.isArray(adobe.timeline) ? adobe.timeline : [];
      const outputProfile = Array.isArray(adobe.outputProfiles) ? adobe.outputProfiles[0] : null;
      const pageWidth = Math.max(320, Math.min(2000, Number(outputProfile?.width) || 1080));
      const pageHeight = Math.max(480, Math.min(4000, Number(outputProfile?.height) || 1920));
      const doc = new PDFDocument({ size: [pageWidth, pageHeight], margin: 0 });
      const chunks = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const editableFields = Array.isArray(adobe.editableFields) ? adobe.editableFields : [];
      const fieldMetaById = new Map(editableFields.map((field) => [String(field?.id || ''), field || {}]));
      const scenes = timeline.length ? timeline : [null];

      for (let sceneIndex = 0; sceneIndex < scenes.length; sceneIndex += 1) {
        const scene = scenes[sceneIndex];
        if (sceneIndex > 0) {
          doc.addPage({ size: [pageWidth, pageHeight], margin: 0 });
        }

        const sceneAsset = scene?.baseVideo || scene?.asset;
        const sceneBuffer = await loadR2AssetBuffer(sceneAsset);
        if (sceneBuffer) {
          const image = doc.openImage(sceneBuffer);
          const scale = Math.max(pageWidth / image.width, pageHeight / image.height);
          const drawWidth = image.width * scale;
          const drawHeight = image.height * scale;
          const drawX = (pageWidth - drawWidth) / 2;
          const drawY = (pageHeight - drawHeight) / 2;
          doc.image(sceneBuffer, drawX, drawY, { width: drawWidth, height: drawHeight });
        } else {
          doc.rect(0, 0, pageWidth, pageHeight).fill(template?.palette?.background || '#ffffff');
        }

        const textLayers = Array.isArray(scene?.textLayers) ? scene.textLayers : [];
        textLayers.forEach((layer) => {
          const fieldId = String(layer?.fieldId || '').trim();
          if (!fieldId) return;

          const meta = fieldMetaById.get(fieldId) || {};
          const type = String(meta.type || 'text').toLowerCase();
          const maxWidth = Math.max(0.04, Math.min(1, Number(layer?.maxWidth) || 0.82));
          const maxHeight = Math.max(0.03, Math.min(1, Number(layer?.maxHeight) || 0.08));
          const centerX = Math.max(0, Math.min(1, Number(layer?.x) || 0.5));
          const centerY = Math.max(0, Math.min(1, Number(layer?.y) || 0.5));
          const boxWidth = pageWidth * maxWidth;
          const boxHeight = pageHeight * maxHeight;
          const boxX = Math.max(0, Math.min(pageWidth - boxWidth, centerX * pageWidth - boxWidth / 2));
          const boxY = Math.max(0, Math.min(pageHeight - boxHeight, centerY * pageHeight - boxHeight / 2));

          if (type === 'qrcode') {
            if (qrBuffer) doc.image(qrBuffer, boxX, boxY, { fit: [boxWidth, boxHeight], align: 'center', valign: 'center' });
            return;
          }

          const value = resolveAdobeFieldValue({
            fieldId,
            guest,
            event,
            inviteMessage,
            inviteUrl,
            relationship,
            customMessage,
          });
          if (!value) return;

          const style = normalizeLayerStyle({ layer, meta, template, boxHeight });
          const renderedValue = style.uppercase ? String(value).toUpperCase() : String(value);
          const textX = boxX + style.paddingX;
          const textY = boxY + style.paddingY + Math.max(0, (boxHeight - style.paddingY * 2 - style.fontSize) / 2);
          const textWidth = Math.max(4, boxWidth - style.paddingX * 2);
          const textHeight = Math.max(4, boxHeight - style.paddingY * 2);
          const originX = boxX + boxWidth / 2;
          const originY = boxY + boxHeight / 2;

          doc.save();
          if (style.rotation !== 0) {
            doc.rotate(style.rotation, { origin: [originX, originY] });
          }
          if (style.opacity < 1) {
            doc.fillOpacity(style.opacity);
            doc.strokeOpacity(style.opacity);
          }

          if (style.backgroundColor || style.backgroundGradient) {
            const bgGradient = buildLinearGradient(doc, boxX, boxY, boxWidth, boxHeight, style.backgroundGradient);
            doc.fillOpacity(style.backgroundOpacity);
            if (bgGradient) doc.fillColor(bgGradient);
            else doc.fillColor(style.backgroundColor);
            doc.roundedRect(boxX, boxY, boxWidth, boxHeight, style.radius).fill();
            if (style.opacity < 1) doc.fillOpacity(style.opacity);
          }

          if (style.borderColor && style.borderWidth > 0) {
            doc.lineWidth(style.borderWidth).strokeColor(style.borderColor);
            doc.roundedRect(boxX, boxY, boxWidth, boxHeight, style.radius).stroke();
          }

          doc.font(style.fontName).fontSize(style.fontSize).fillColor(style.color);
          if (style.letterSpacing > 0) doc.characterSpacing(style.letterSpacing);

          const textOptions = {
            width: textWidth,
            height: textHeight,
            align: style.align,
              lineBreak: true,
            lineGap: style.lineGap,
              ellipsis: true,
          };

          if (style.shadowColor && (style.shadowOffsetX !== 0 || style.shadowOffsetY !== 0)) {
            const effectiveShadowOpacity = style.opacity < 1
              ? Math.max(0, Math.min(1, style.shadowOpacity * style.opacity))
              : style.shadowOpacity;
            doc.fillOpacity(effectiveShadowOpacity).fillColor(style.shadowColor);
            doc.text(renderedValue, textX + style.shadowOffsetX, textY + style.shadowOffsetY, textOptions);
            doc.fillOpacity(style.opacity < 1 ? style.opacity : 1);
          }

          if (style.strokeColor && style.strokeWidth > 0) {
            const offsets = [
              [-style.strokeWidth, 0],
              [style.strokeWidth, 0],
              [0, -style.strokeWidth],
              [0, style.strokeWidth],
            ];
            doc.fillColor(style.strokeColor);
            offsets.forEach(([dx, dy]) => {
              doc.text(renderedValue, textX + dx, textY + dy, textOptions);
            });
          }

          const textGradient = buildLinearGradient(doc, textX, textY, textWidth, textHeight, style.textGradient);
          if (textGradient) doc.fillColor(textGradient);
          else doc.fillColor(style.color);
          doc.text(renderedValue, textX, textY, textOptions);
          if (style.letterSpacing > 0) doc.characterSpacing(0);
          doc.restore();
        });
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
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

  const hasAdobeTemplate = template?.templateEngine === 'adobe-express' && Array.isArray(template?.adobeExpress?.timeline) && template.adobeExpress.timeline.length > 0;
  const hasTemplateEngineJson = template?.templateEngine === 'template-engine' && template?.configJson && typeof template.configJson === 'object';
  const rendererUsed = hasAdobeTemplate
    ? 'adobe-express'
    : hasTemplateEngineJson
      ? 'template-engine'
      : 'classic';

  const templateAssetSlots = hasTemplateEngineJson ? collectAssetSlotUrls(template.configJson || {}) : {};
  const backgroundAssetRef = hasTemplateEngineJson
    ? String(template?.configJson?.canvas?.backgroundAssetRef || '').trim()
    : '';
  const hasBackgroundAsset = Boolean(
    hasTemplateEngineJson && (
      (backgroundAssetRef && templateAssetSlots[backgroundAssetRef]) ||
      templateAssetSlots.backgroundTextureImage ||
      templateAssetSlots.backgroundImage ||
      (template?.configJson?.canvas?.backgroundImage && String(template.configJson.canvas.backgroundImage).trim())
    )
  );

  const pdfBuffer = hasAdobeTemplate
    ? await buildAdobeExpressPdfBuffer({
        guest,
        event,
        template,
        inviteMessage,
        inviteUrl,
        qrBuffer,
        relationship,
        customMessage,
      })
    : hasTemplateEngineJson
      ? await buildTemplateEnginePdfBuffer({
          guest,
          event,
          template,
          inviteMessage,
          inviteUrl,
          qrBuffer,
          relationship,
        })
    : await buildPdfBuffer({
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
    rendererUsed,
    templateDiagnostics: {
      templateEngine: template?.templateEngine || 'classic',
      hasAdobeTemplate,
      hasTemplateEngineJson,
      hasBackgroundAsset,
      backgroundAssetRef: backgroundAssetRef || null,
    },
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
