const crypto = require('crypto');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const { PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { prisma } = require('../config/db');
const { r2Client, R2_BUCKET, R2_PUBLIC_URL } = require('../config/r2');

const HTML_PDF_PAGE_WIDTH = 794;
const HTML_PDF_PAGE_HEIGHT = 1123;

let playwrightChromium = null;

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
    const firstAnyAssetUrl = Object.values(slotMap).find((value) => typeof value === 'string' && value.trim()) || null;
    const templateEnginePreviewAsset =
      (backgroundAssetRef && slotMap[backgroundAssetRef]) ||
      slotMap.backgroundTextureImage ||
      slotMap.backgroundImage ||
      String(config?.canvas?.backgroundImage || '').trim() ||
      firstAnyAssetUrl ||
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
      templateConfig: t?.templateEngine === 'template-engine' && t?.configJson && typeof t.configJson === 'object'
        ? t.configJson
        : null,
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

function collectTemplateAssetUrls(templateConfig) {
  const normalizeAssetCollection = (value) => {
    if (Array.isArray(value)) return value;
    if (value && typeof value === 'object') return Object.values(value);
    return [];
  };

  const pickAssetUrl = (entry) => {
    if (!entry || typeof entry !== 'object') return '';
    return String(entry.url || entry.assetUrl || entry.src || entry.assetPath || entry.publicId || '').trim();
  };

  const backgroundAssets = normalizeAssetCollection(templateConfig?.backgroundAssets);
  const decorativeAssets = normalizeAssetCollection(templateConfig?.decorativeAssets);

  return [...backgroundAssets, ...decorativeAssets]
    .map((entry) => pickAssetUrl(entry))
    .filter(Boolean);
}

function normalizeSimpleTemplateModel(templateConfig = {}) {
  const canvas = templateConfig?.canvas && typeof templateConfig.canvas === 'object' ? templateConfig.canvas : {};
  const contentArea =
    (templateConfig?.contentArea && typeof templateConfig.contentArea === 'object')
      ? templateConfig.contentArea
      : (canvas?.contentArea && typeof canvas.contentArea === 'object')
        ? canvas.contentArea
        : null;

  const theme = templateConfig?.theme && typeof templateConfig.theme === 'object'
    ? templateConfig.theme
    : {};

  return {
    backgroundImage: firstText(
      templateConfig?.backgroundImage,
      canvas?.backgroundImage,
      canvas?.backgroundImageUrl
    ),
    contentArea,
    theme,
  };
}

function resolveDynamicTheme(templateConfig = {}, palette = {}) {
  const model = normalizeSimpleTemplateModel(templateConfig);
  const t = model.theme || {};

  const primary = firstText(t.primary, t.primaryColor, palette.header, palette.primary, '#8DBD4A');
  const accent = firstText(t.accent, t.accentColor, palette.accent, '#B8872A');
  const border = firstText(t.border, t.borderColor, palette.border, palette.divider, '#C9B07D');
  const surface = firstText(t.surface, t.surfaceColor, palette.surface, palette.badge, '#FFFDF7');
  const text = firstText(t.text, t.textColor, palette.textPrimary, palette.title, '#2F2415');
  const subtle = firstText(t.subtle, t.textSecondary, palette.textSecondary, palette.subtitle, '#6B5A45');

  return {
    primary,
    accent,
    border,
    surface,
    text,
    subtle,
  };
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
      const assetUrls = collectTemplateAssetUrls(resolvedTemplateConfig);

      const rawPlacements =
        (resolvedTemplateConfig?.layout?.componentPlacements && typeof resolvedTemplateConfig.layout.componentPlacements === 'object')
          ? resolvedTemplateConfig.layout.componentPlacements
          : (resolvedTemplateConfig?.layout?.placements && typeof resolvedTemplateConfig.layout.placements === 'object')
            ? resolvedTemplateConfig.layout.placements
            : (resolvedTemplateConfig?.canvas?.componentPlacements && typeof resolvedTemplateConfig.canvas.componentPlacements === 'object')
              ? resolvedTemplateConfig.canvas.componentPlacements
              : {};

      const absoluteMode = String(resolvedTemplateConfig?.layout?.mode || '').toLowerCase() === 'absolute';
      const useAbsoluteLayout = absoluteMode || Object.keys(rawPlacements).length > 0;
      const canvasConfig = (resolvedTemplateConfig?.canvas && typeof resolvedTemplateConfig.canvas === 'object')
        ? resolvedTemplateConfig.canvas
        : {};
      const cardOverlaySetting = canvasConfig.cardOverlay;
      const cardFrameSetting = canvasConfig.cardFrame;
      const parsedBackgroundTintOpacity = Number(canvasConfig.backgroundTintOpacity);
      const parsedCardOverlayOpacity = Number(canvasConfig.cardOverlayOpacity);
      const cardOverlayOpacity = Number.isFinite(parsedCardOverlayOpacity)
        ? Math.max(0, Math.min(1, parsedCardOverlayOpacity))
        : 0.68;
      const backgroundTintOpacity = Number.isFinite(parsedBackgroundTintOpacity)
        ? Math.max(0, Math.min(1, parsedBackgroundTintOpacity))
        : (useAbsoluteLayout ? 0 : 0.06);
      const cardOverlayEnabled = typeof cardOverlaySetting === 'boolean' ? cardOverlaySetting : !useAbsoluteLayout;
      const cardFrameEnabled = typeof cardFrameSetting === 'boolean' ? cardFrameSetting : !useAbsoluteLayout;

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
        resolvedTemplateConfig?.canvas?.backgroundImage,
        assetSlotUrls.decorativeImage,
        assetUrls[0]
      );
      const backgroundImageBuffer = await loadR2AssetBuffer(backgroundImageUrl);

      const hasLayoutSections = Array.isArray(resolvedTemplateConfig?.layout?.sections) && resolvedTemplateConfig.layout.sections.length > 0;
      const hasComponents = Array.isArray(resolvedTemplateConfig?.components) && resolvedTemplateConfig.components.length > 0;
      const useBackgroundContentModel = !hasLayoutSections && !hasComponents && (
        resolvedTemplateConfig?.backgroundImage ||
        resolvedTemplateConfig?.contentArea ||
        resolvedTemplateConfig?.theme
      );

      if (useBackgroundContentModel) {
        // Background artwork is immutable; only dynamic data is rendered over it.
        if (backgroundImageBuffer) {
          doc.image(backgroundImageBuffer, 0, 0, { cover: [W, H], align: 'center', valign: 'center' });
        } else {
          doc.rect(0, 0, W, H).fill(p.background || '#F8F3E8');
        }

        const t = (resolvedTemplateConfig?.theme && typeof resolvedTemplateConfig.theme === 'object')
          ? resolvedTemplateConfig.theme
          : {};
        const theme = {
          primary: String(t.primary || p.primary || p.header || '#8B6A2F'),
          accent: String(t.accent || p.accent || '#B8872A'),
          border: String(t.border || p.border || p.divider || '#C9B07D'),
          surface: String(t.surface || p.surface || '#FFFDF7'),
          text: String(t.text || t.textPrimary || p.textPrimary || p.body || '#2F2415'),
          subtle: String(t.textSecondary || p.textSecondary || p.subtle || '#6B5A45'),
        };

        const contentAreaRaw = (resolvedTemplateConfig?.contentArea && typeof resolvedTemplateConfig.contentArea === 'object')
          ? resolvedTemplateConfig.contentArea
          : (resolvedTemplateConfig?.canvas?.contentArea && typeof resolvedTemplateConfig.canvas.contentArea === 'object')
            ? resolvedTemplateConfig.canvas.contentArea
            : {};

        const toNumber = (value) => {
          const n = Number(value);
          return Number.isFinite(n) ? n : null;
        };

        const resolveRect = (raw, container) => {
          const src = raw && typeof raw === 'object' ? raw : {};
          const xRaw = toNumber(src.x ?? src.left);
          const yRaw = toNumber(src.y ?? src.top);
          const wRaw = toNumber(src.width ?? src.w);
          const hRaw = toNumber(src.height ?? src.h);

          const x = xRaw === null ? container.x : (xRaw >= 0 && xRaw <= 1 ? container.x + xRaw * container.w : container.x + xRaw);
          const yPos = yRaw === null ? container.y : (yRaw >= 0 && yRaw <= 1 ? container.y + yRaw * container.h : container.y + yRaw);
          const w = wRaw === null ? container.w : (wRaw > 0 && wRaw <= 1 ? container.w * wRaw : wRaw);
          const h = hRaw === null ? container.h : (hRaw > 0 && hRaw <= 1 ? container.h * hRaw : hRaw);

          return {
            x,
            y: yPos,
            w: Math.max(80, w),
            h: Math.max(120, h),
          };
        };

        const defaultContentRect = { x: W * 0.14, y: H * 0.20, w: W * 0.72, h: H * 0.70 };
        const contentRect = resolveRect(contentAreaRaw, defaultContentRect);

        // Guard against undersized content areas from template JSON that leave large blank space.
        const minContentHeight = H * 0.64;
        if (contentRect.h < minContentHeight) {
          contentRect.h = minContentHeight;
        }
        const maxBottom = H - pagePad;
        const maxRight = W - pagePad;
        contentRect.x = Math.max(pagePad, contentRect.x);
        contentRect.y = Math.max(pagePad, contentRect.y);
        contentRect.w = Math.min(contentRect.w, maxRight - contentRect.x);
        contentRect.h = Math.min(contentRect.h, maxBottom - contentRect.y);

        const inviteLines = String(inviteMessage || '').split('\n').map((line) => line.trim()).filter(Boolean);
        const bodyMessage = inviteLines.slice(1, -1).join(' ') || inviteLines.slice(1).join(' ') || inviteLines[0] || '';
        const guestLine = firstText(`Guest: ${context.guest.name}`, openingLine);
        const familyLineA = firstText(`Groom's Family: ${event?.groomFamily}`, "Groom's Family: To be announced");
        const familyLineB = firstText(`Bride's Family: ${event?.brideFamily}`, "Bride's Family: To be announced");

        const timelineItems = [
          { time: firstText(context.event.segment1Time, '9:00 AM'), label: firstText(context.event.segment1Label, 'Program 1') },
          { time: firstText(context.event.segment2Time, timeText || '10:30 AM'), label: firstText(context.event.segment2Label, 'Program 2') },
          { time: firstText(context.event.segment3Time, '12:00 PM'), label: firstText(context.event.segment3Label, 'Program 3') },
        ];

        const base = {
          header: 120,
          message: 118,
          rsvp: 44,
          timeline: 76,
          family: 60,
          qr: 88,
          footer: 20,
          gap: 10,
        };
        const baseTotal = base.header + base.message + base.rsvp + base.timeline + base.family + base.qr + base.footer + base.gap * 6;
        const scale = Math.max(0.64, Math.min(1, contentRect.h / baseTotal, contentRect.w / 430));

        const dim = {
          header: base.header * scale,
          message: base.message * scale,
          rsvp: base.rsvp * scale,
          timeline: base.timeline * scale,
          family: base.family * scale,
          qr: base.qr * scale,
          footer: base.footer * scale,
          gap: base.gap * scale,
          pad: 12 * scale,
          radius: 14 * scale,
        };

        const usedStackHeight = dim.header + dim.message + dim.rsvp + dim.timeline + dim.family + dim.qr + dim.footer + dim.gap * 6;
        const spareVertical = Math.max(0, contentRect.h - usedStackHeight);
        if (spareVertical > 0) {
          // Spread spare height between cards so content reaches lower page area naturally.
          dim.gap += spareVertical / 6;
        }

        const drawCard = (xPos, yPos, width, height) => {
          doc.save().fillOpacity(0.88).roundedRect(xPos, yPos + 1.4, width, height, dim.radius).fill('#000000').restore();
          doc.save().fillOpacity(0.9).roundedRect(xPos, yPos, width, height, dim.radius).fill(theme.surface).restore();
          doc.lineWidth(0.9).strokeColor(theme.border).roundedRect(xPos, yPos, width, height, dim.radius).stroke();
        };

        const fitText = (text, width, maxHeight, fontName, fontSize, lineGap) => {
          const source = String(text || '').trim();
          if (!source) return '';
          doc.font(fontName).fontSize(fontSize);
          const h = doc.heightOfString(source, { width, lineGap });
          if (h <= maxHeight) return source;

          const words = source.split(/\s+/).filter(Boolean);
          if (words.length <= 1) return source;
          let low = 1;
          let high = words.length;
          let best = `${words[0]}...`;
          while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            const candidate = `${words.slice(0, mid).join(' ')}...`;
            const candidateH = doc.heightOfString(candidate, { width, lineGap });
            if (candidateH <= maxHeight) {
              best = candidate;
              low = mid + 1;
            } else {
              high = mid - 1;
            }
          }
          return best;
        };

        let cursor = contentRect.y;

        // Header (no separate decorative components from artwork).
        const headerRect = { x: contentRect.x, y: cursor, w: contentRect.w, h: dim.header };
        drawCard(headerRect.x, headerRect.y, headerRect.w, headerRect.h);
        doc.font('Helvetica-Bold').fontSize(18 * scale).fillColor(theme.text)
          .text(firstText(event?.title, headerTitle), headerRect.x + dim.pad, headerRect.y + dim.pad, { width: headerRect.w - dim.pad * 2, align: 'center' });
        doc.font('Helvetica-Bold').fontSize(15 * scale).fillColor(theme.text)
          .text(firstText(`${context.event.brideName} ❤ ${context.event.groomName}`, namesLine), headerRect.x + dim.pad, headerRect.y + dim.pad + 28 * scale, { width: headerRect.w - dim.pad * 2, align: 'center' });
        doc.font('Helvetica').fontSize(10 * scale).fillColor(theme.subtle)
          .text(guestLine, headerRect.x + dim.pad, headerRect.y + dim.pad + 52 * scale, { width: headerRect.w - dim.pad * 2, align: 'center' });
        cursor += dim.header + dim.gap;

        // Personal message
        const messageRect = { x: contentRect.x, y: cursor, w: contentRect.w, h: dim.message };
        drawCard(messageRect.x, messageRect.y, messageRect.w, messageRect.h);
        doc.font('Helvetica-Bold').fontSize(12 * scale).fillColor(theme.text)
          .text(firstText(`Priyamaina ${context.guest.name} garu`, salutation), messageRect.x + dim.pad, messageRect.y + dim.pad, { width: messageRect.w - dim.pad * 2, align: 'left' });
        const messageBodyY = messageRect.y + dim.pad + 18 * scale;
        const fittedBody = fitText(bodyMessage, messageRect.w - dim.pad * 2, messageRect.h - 52 * scale, 'Helvetica', 9.4 * scale, 1.6);
        doc.font('Helvetica').fontSize(9.4 * scale).fillColor(theme.text)
          .text(fittedBody, messageRect.x + dim.pad, messageBodyY, { width: messageRect.w - dim.pad * 2, align: 'left', lineGap: 1.6 });
        doc.font('Helvetica-Bold').fontSize(8.6 * scale).fillColor(theme.subtle)
          .text(dateLine, messageRect.x + dim.pad, messageRect.y + messageRect.h - 24 * scale, { width: messageRect.w - dim.pad * 2, align: 'left' });
        doc.font('Helvetica').fontSize(8.4 * scale).fillColor(theme.subtle)
          .text(venueLine, messageRect.x + dim.pad, messageRect.y + messageRect.h - 13 * scale, { width: messageRect.w - dim.pad * 2, align: 'left' });
        cursor += dim.message + dim.gap;

        // RSVP buttons
        const rsvpRect = { x: contentRect.x, y: cursor, w: contentRect.w, h: dim.rsvp };
        const btnGap = 10 * scale;
        const btnW = (rsvpRect.w - btnGap) / 2;
        const drawButton = (xPos, label) => {
          doc.save().fillOpacity(0.98).roundedRect(xPos, rsvpRect.y, btnW, rsvpRect.h, rsvpRect.h / 2).fill(theme.accent).restore();
          doc.lineWidth(0.8).strokeColor(theme.border).roundedRect(xPos, rsvpRect.y, btnW, rsvpRect.h, rsvpRect.h / 2).stroke();
          doc.font('Helvetica-Bold').fontSize(10.5 * scale).fillColor('#ffffff');
          const buttonTextY = rsvpRect.y + (rsvpRect.h - doc.currentLineHeight()) / 2 - 0.4 * scale;
          doc.text(label, xPos, buttonTextY, { width: btnW, align: 'center' });
        };
        drawButton(rsvpRect.x, firstText(rsvpPrimary, 'RSVP Now'));
        drawButton(rsvpRect.x + btnW + btnGap, firstText(rsvpSecondary, 'Join Live Stream'));
        cursor += dim.rsvp + dim.gap;

        // Timeline
        const timelineRect = { x: contentRect.x, y: cursor, w: contentRect.w, h: dim.timeline };
        drawCard(timelineRect.x, timelineRect.y, timelineRect.w, timelineRect.h);
        const itemW = timelineRect.w / 3;
        timelineItems.forEach((item, idx) => {
          const colX = timelineRect.x + idx * itemW;
          const cx = colX + itemW / 2;
          doc.circle(cx, timelineRect.y + 12 * scale, 3.2 * scale).fill(theme.accent);
          doc.font('Helvetica-Bold').fontSize(8.2 * scale).fillColor(theme.subtle)
            .text(firstText(item.time, '--'), colX, timelineRect.y + 18 * scale, { width: itemW, align: 'center' });
          doc.font('Helvetica').fontSize(8 * scale).fillColor(theme.text)
            .text(firstText(item.label, 'Program'), colX + 4 * scale, timelineRect.y + 34 * scale, { width: itemW - 8 * scale, align: 'center' });
        });
        cursor += dim.timeline + dim.gap;

        // Family details
        const familyRect = { x: contentRect.x, y: cursor, w: contentRect.w, h: dim.family };
        drawCard(familyRect.x, familyRect.y, familyRect.w, familyRect.h);
        doc.font('Helvetica-Bold').fontSize(9.8 * scale).fillColor(theme.text)
          .text(familyLineA, familyRect.x + dim.pad, familyRect.y + 11 * scale, { width: familyRect.w - dim.pad * 2, align: 'left' });
        doc.font('Helvetica-Bold').fontSize(9.8 * scale).fillColor(theme.text)
          .text(familyLineB, familyRect.x + dim.pad, familyRect.y + 29 * scale, { width: familyRect.w - dim.pad * 2, align: 'left' });
        cursor += dim.family + dim.gap;

        // QR + directions
        const qrRect = { x: contentRect.x, y: cursor, w: contentRect.w, h: dim.qr };
        drawCard(qrRect.x, qrRect.y, qrRect.w, qrRect.h);
        doc.font('Helvetica-Bold').fontSize(10 * scale).fillColor(theme.text)
          .text(firstText(qrProps.ctaLabel, 'Get Directions / RSVP'), qrRect.x + dim.pad, qrRect.y + 12 * scale, { width: qrRect.w - 80 * scale, align: 'left' });
        if (inviteUrl) {
          const fittedUrl = fitText(inviteUrl, qrRect.w - 88 * scale, 24 * scale, 'Helvetica', 7.4 * scale, 1);
          doc.font('Helvetica').fontSize(7.4 * scale).fillColor(p.link || '#1d4ed8')
            .text(fittedUrl, qrRect.x + dim.pad, qrRect.y + 30 * scale, { width: qrRect.w - 88 * scale, align: 'left' });
        }
        if (qrBuffer) {
          const qrSize = Math.min(48 * scale, qrRect.h - 16 * scale);
          doc.image(qrBuffer, qrRect.x + qrRect.w - qrSize - dim.pad, qrRect.y + (qrRect.h - qrSize) / 2, { width: qrSize, height: qrSize });
        }
        cursor += dim.qr + dim.gap;

        // Footer message
        const footerText = firstText(resolvedTemplateConfig?.footerMessage, 'With blessings from Vedika360');
        doc.font('Helvetica').fontSize(8.4 * scale).fillColor(theme.subtle)
          .text(footerText, contentRect.x + 4, Math.min(cursor, contentRect.y + contentRect.h - dim.footer), { width: contentRect.w - 8, align: 'center' });

        doc.end();
        return;
      }

      if (backgroundImageBuffer) {
        doc.image(backgroundImageBuffer, 0, 0, { cover: [W, H], align: 'center', valign: 'center' });
        if (backgroundTintOpacity > 0) {
          doc.save().fillOpacity(backgroundTintOpacity).rect(0, 0, W, H).fill('#fffaf0').restore();
        }
        if (cardOverlayEnabled) {
          doc.save().fillOpacity(cardOverlayOpacity).roundedRect(cardX, cardTop, cardW, cardBottom - cardTop, 24).fill('#fffdf7').restore();
        }
      } else {
        doc.rect(0, 0, W, H).fill(p.background || '#F8F3E8');
        if (cardOverlayEnabled) {
          doc.roundedRect(cardX, cardTop, cardW, cardBottom - cardTop, 24).fill('#fffdf7');
        }
      }

      if (cardFrameEnabled) {
        doc.lineWidth(1.6).strokeColor(p.frame || '#6D4C2F').roundedRect(cardX, cardTop, cardW, cardBottom - cardTop, 24).stroke();
        _drawOrnateCorners(doc, cardX + 10, cardTop + 10, cardX + cardW - 10, cardBottom - 10, p.accent || '#C28A2E', 'traditional');
      }

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

      if (useAbsoluteLayout) {
        const typography = (resolvedTemplateConfig?.typography && typeof resolvedTemplateConfig.typography === 'object')
          ? resolvedTemplateConfig.typography
          : {};
        const autoFlow = Boolean(canvasConfig.autoFlow);

        const toNumber = (value) => {
          const n = Number(value);
          return Number.isFinite(n) ? n : null;
        };

        const styleNumber = (style, keys, fallback) => {
          const keyList = Array.isArray(keys) ? keys : [keys];
          for (const key of keyList) {
            const n = Number(style?.[key]);
            if (Number.isFinite(n)) return n;
          }
          return fallback;
        };

        const styleText = (style, keys, fallback) => {
          const keyList = Array.isArray(keys) ? keys : [keys];
          for (const key of keyList) {
            const value = style?.[key];
            if (typeof value === 'string' && value.trim()) return value.trim();
          }
          return fallback;
        };

        const resolveRect = (rect, container) => {
          const src = rect && typeof rect === 'object' ? rect : {};
          const xRaw = toNumber(src.x ?? src.left);
          const yRaw = toNumber(src.y ?? src.top);
          const wRaw = toNumber(src.width ?? src.w);
          const hRaw = toNumber(src.height ?? src.h);

          const x = xRaw === null ? container.x : (xRaw >= 0 && xRaw <= 1 ? container.x + xRaw * container.w : container.x + xRaw);
          const yPos = yRaw === null ? container.y : (yRaw >= 0 && yRaw <= 1 ? container.y + yRaw * container.h : container.y + yRaw);
          const w = wRaw === null ? container.w : (wRaw > 0 && wRaw <= 1 ? container.w * wRaw : wRaw);
          const h = hRaw === null ? container.h : (hRaw > 0 && hRaw <= 1 ? container.h * hRaw : hRaw);

          return {
            x,
            y: yPos,
            w: Math.max(10, w),
            h: Math.max(10, h),
          };
        };

        const fitTextToHeight = (text, { width, maxHeight, fontName = 'Helvetica', fontSize = 10, lineGap = 1 }) => {
          const source = String(text || '').trim();
          if (!source) return '';
          doc.font(fontName).fontSize(fontSize);
          const fullHeight = doc.heightOfString(source, { width, lineGap });
          if (fullHeight <= maxHeight) return source;

          const words = source.split(/\s+/).filter(Boolean);
          if (words.length <= 1) return source;

          let low = 1;
          let high = words.length;
          let best = `${words[0]}...`;
          while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            const candidate = `${words.slice(0, mid).join(' ')}...`;
            const h = doc.heightOfString(candidate, { width, lineGap });
            if (h <= maxHeight) {
              best = candidate;
              low = mid + 1;
            } else {
              high = mid - 1;
            }
          }
          return best;
        };

        const canvasContent = (resolvedTemplateConfig?.canvas?.contentArea && typeof resolvedTemplateConfig.canvas.contentArea === 'object')
          ? resolvedTemplateConfig.canvas.contentArea
          : (resolvedTemplateConfig?.canvas?.contentBox && typeof resolvedTemplateConfig.canvas.contentBox === 'object')
            ? resolvedTemplateConfig.canvas.contentBox
            : {};

        const defaultContentContainer = backgroundImageBuffer
          ? { x: W * 0.10, y: H * 0.14, w: W * 0.80, h: H * 0.76 }
          : { x: cardX + 18, y: cardTop + 18, w: cardW - 36, h: cardBottom - cardTop - 36 };
        const contentRect = resolveRect(canvasContent, defaultContentContainer);

        const defaultPlacements = {
          GuestHeader: { x: 0.03, y: 0.00, width: 0.94, height: 0.14 },
          GuestBadge: { x: 0.35, y: 0.13, width: 0.30, height: 0.05 },
          CoupleHero: { x: 0.04, y: 0.20, width: 0.92, height: 0.30 },
          PersonalMessage: { x: 0.04, y: 0.52, width: 0.92, height: 0.16 },
          RSVPSection: { x: 0.04, y: 0.70, width: 0.92, height: 0.08 },
          SmartRecommendations: { x: 0.04, y: 0.79, width: 0.92, height: 0.10 },
          FamilyConnection: { x: 0.04, y: 0.90, width: 0.92, height: 0.08 },
          QRPass: { x: 0.04, y: 1.00, width: 0.92, height: 0.10 },
          FooterMessage: { x: 0.04, y: 1.11, width: 0.92, height: 0.06 },
        };

        const findPlacement = (section) => {
          const byId = rawPlacements?.[section?.id];
          const byType = rawPlacements?.[section?.componentType];
          const byTypeLower = rawPlacements?.[String(section?.componentType || '').toLowerCase()];
          const fallback = defaultPlacements[String(section?.componentType || '')] || null;
          return byId || byType || byTypeLower || fallback;
        };

        const sectionsWithRects = sections
          .map((section) => {
            const placement = findPlacement(section);
            if (!placement) return null;
            const rect = resolveRect(placement, contentRect);
            return { section, rect };
          })
          .filter(Boolean)
          .sort((a, b) => a.rect.y - b.rect.y);

        if (autoFlow) {
          const minGap = 6;
          let cursorY = contentRect.y;
          sectionsWithRects.forEach((entry) => {
            const r = entry.rect;
            if (r.y < cursorY) r.y = cursorY;
            const maxY = contentRect.y + contentRect.h;
            if (r.y + r.h > maxY) {
              r.h = Math.max(18, maxY - r.y);
            }
            cursorY = r.y + r.h + minGap;
          });
        }

        const rectBySectionId = new Map(
          sectionsWithRects.map(({ section, rect }) => [section?.id || `${section?.componentType || 'section'}-${section?.order || 0}`, rect])
        );

        const drawContainer = (rect, options = {}) => {
          const radius = Number.isFinite(Number(options.radius)) ? Number(options.radius) : 14;
          const fill = options.fill || '#fffdf7';
          const borderColor = options.borderColor || p.divider || '#D9C39A';
          const borderWidth = Number.isFinite(Number(options.borderWidth)) ? Number(options.borderWidth) : 0.8;
          doc.save();
          doc.fillOpacity(1);
          doc.roundedRect(rect.x, rect.y, rect.w, rect.h, radius).fill(fill);
          doc.restore();
          if (borderWidth > 0) {
            doc.lineWidth(borderWidth).strokeColor(borderColor).roundedRect(rect.x, rect.y, rect.w, rect.h, radius).stroke();
          }
        };

        const drawText = (text, xPos, yPos, options = {}) => {
          doc.font(options.bold ? 'Helvetica-Bold' : 'Helvetica')
            .fontSize(options.size || Number(typography.bodySize) || Number(typography.fontSize) || 11)
            .fillColor(options.color || p.body || '#1f2937')
            .text(firstText(text, options.fallback || ''), xPos, yPos, {
              width: options.width,
              align: options.align || 'left',
              lineGap: options.lineGap || 1,
            });
        };

        sections.forEach((section) => {
          const rectKey = section?.id || `${section?.componentType || 'section'}-${section?.order || 0}`;
          const rect = rectBySectionId.get(rectKey);
          if (!rect) return;
          const type = String(section?.componentType || '').toLowerCase();
          const sectionStyle = (section?.style && typeof section.style === 'object') ? section.style : {};
          const containerFill = styleText(sectionStyle, ['backgroundColor', 'cardBackground', 'fillColor'], p.surface || '#fffdf7');
          const containerBorder = styleText(sectionStyle, ['borderColor', 'strokeColor'], p.border || p.divider || '#D9C39A');
          const containerBorderWidth = styleNumber(sectionStyle, ['borderWidth', 'strokeWidth'], 0.8);
          const containerRadius = styleNumber(sectionStyle, ['radius', 'borderRadius'], 12);
          const titleColor = styleText(sectionStyle, ['titleColor', 'headingColor', 'color'], p.title || p.textPrimary || '#4B3621');
          const subtitleColor = styleText(sectionStyle, ['subtitleColor', 'metaColor'], p.subtitle || p.textSecondary || '#6B5A45');
          const bodyColor = styleText(sectionStyle, ['bodyColor', 'textColor', 'color'], p.body || p.textPrimary || '#1f2937');
          const titleSize = styleNumber(sectionStyle, ['titleSize', 'headingSize', 'fontSize'], Number(typography.titleSize) || 14);
          const subtitleSize = styleNumber(sectionStyle, ['subtitleSize', 'metaSize'], Number(typography.subtitleSize) || 10);
          const bodySize = styleNumber(sectionStyle, ['bodySize', 'textSize', 'fontSize'], Number(typography.bodySize) || 9.8);
          const contentAlign = styleText(sectionStyle, ['align', 'textAlign'], 'left');

          if (type === 'guestheader') {
            const heading = firstText(section?.props?.title, headerTitle);
            const subtitle = firstText(section?.props?.subtitle, namesLine);
            drawText(heading, rect.x + 10, rect.y + 8, { width: rect.w - 20, align: 'center', size: titleSize, bold: true, color: titleColor });
            drawText(subtitle, rect.x + 10, rect.y + 32, { width: rect.w - 20, align: 'center', size: subtitleSize + 1, color: subtitleColor });
            drawText(openingLine, rect.x + 10, rect.y + 48, { width: rect.w - 20, align: 'center', size: subtitleSize - 0.6, color: p.subtle || subtitleColor });
            return;
          }

          if (type === 'guestbadge') {
            drawContainer(rect, { radius: containerRadius, fill: styleText(sectionStyle, ['backgroundColor', 'cardBackground'], p.badge || '#fff6dc'), borderColor: containerBorder, borderWidth: containerBorderWidth });
            drawText(badgeText, rect.x + 4, rect.y + Math.max(6, rect.h / 2 - 5), { width: rect.w - 8, align: 'center', size: styleNumber(sectionStyle, ['fontSize', 'textSize'], 10), bold: true, color: p.badgeText || titleColor });
            return;
          }

          if (type === 'couplehero') {
            drawContainer(rect, { radius: styleNumber(sectionStyle, ['radius', 'borderRadius'], 18), fill: containerFill, borderColor: containerBorder, borderWidth: containerBorderWidth });
            if (heroImageBuffer) {
              doc.image(heroImageBuffer, rect.x, rect.y, { fit: [rect.w, rect.h], align: 'center', valign: 'center' });
              doc.lineWidth(0.8).strokeColor(p.divider || '#D9C39A').roundedRect(rect.x, rect.y, rect.w, rect.h, 18).stroke();
            } else {
              drawText(firstText(section?.props?.title, namesLine), rect.x + 12, rect.y + rect.h / 2 - 8, { width: rect.w - 24, align: 'center', size: titleSize + 1, bold: true, color: titleColor });
            }
            return;
          }

          if (type === 'personalmessage') {
            drawContainer(rect, { radius: containerRadius, fill: containerFill, borderColor: containerBorder, borderWidth: containerBorderWidth });
            const innerX = rect.x + 12;
            const innerW = rect.w - 24;
            const salutationSize = styleNumber(sectionStyle, ['salutationSize', 'titleSize'], titleSize - 1);
            const messageLineGap = styleNumber(sectionStyle, ['lineGap'], 2);

            doc.font('Helvetica-Bold').fontSize(salutationSize);
            const salutationText = firstText(salutation, 'Dear Guest');
            const salutationHeight = doc.heightOfString(salutationText, { width: innerW, lineGap: 1 });
            const salutationY = rect.y + 12;
            drawText(salutationText, innerX, salutationY, { width: innerW, size: salutationSize, bold: true, color: titleColor, align: contentAlign });

            const messageY = salutationY + salutationHeight + 6;
            const dateY = rect.y + rect.h - 30;
            const venueY = rect.y + rect.h - 16;
            const messageBottomLimit = Math.min(dateY - 4, venueY - 18);
            const messageMaxHeight = Math.max(12, messageBottomLimit - messageY);
            const fittedBody = fitTextToHeight(body, {
              width: innerW,
              maxHeight: messageMaxHeight,
              fontName: 'Helvetica',
              fontSize: bodySize,
              lineGap: messageLineGap,
            });
            drawText(fittedBody, innerX, messageY, { width: innerW, size: bodySize, color: bodyColor, lineGap: messageLineGap, align: contentAlign });
            drawText(dateLine, innerX, dateY, { width: innerW, size: Math.max(8, bodySize - 1), bold: true, color: subtitleColor, align: contentAlign });
            drawText(venueLine, innerX, venueY, { width: innerW, size: Math.max(8, bodySize - 1), color: p.subtle || subtitleColor, align: contentAlign });
            return;
          }

          if (type === 'rsvpsection') {
            const halfW = (rect.w - 12) / 2;
            const left = { x: rect.x, y: rect.y, w: halfW, h: rect.h };
            const right = { x: rect.x + halfW + 12, y: rect.y, w: halfW, h: rect.h };
            const rsvpFill = styleText(sectionStyle, ['buttonBackground', 'backgroundColor'], p.badge || '#fff6dc');
            drawContainer(left, { radius: styleNumber(sectionStyle, ['buttonRadius', 'radius'], 14), fill: rsvpFill, borderColor: containerBorder, borderWidth: containerBorderWidth });
            drawContainer(right, { radius: styleNumber(sectionStyle, ['buttonRadius', 'radius'], 14), fill: rsvpFill, borderColor: containerBorder, borderWidth: containerBorderWidth });
            drawText(rsvpPrimary, left.x + 6, left.y + left.h / 2 - 5, { width: left.w - 12, align: 'center', size: styleNumber(sectionStyle, ['fontSize', 'textSize'], 10.5), bold: true, color: titleColor });
            drawText(rsvpSecondary, right.x + 6, right.y + right.h / 2 - 5, { width: right.w - 12, align: 'center', size: styleNumber(sectionStyle, ['fontSize', 'textSize'], 10.5), bold: true, color: titleColor });
            return;
          }

          if (type === 'smartrecommendations') {
            drawContainer(rect, { radius: containerRadius, fill: containerFill, borderColor: containerBorder, borderWidth: containerBorderWidth });
            const itemW = rect.w / 3;
            scheduleItems.slice(0, 3).forEach((item, idx) => {
              const colX = rect.x + idx * itemW;
              const cx = colX + itemW / 2;
              doc.circle(cx, rect.y + 10, 4).fill(p.accent || '#C28A2E');
              doc.circle(cx, rect.y + 10, 1.6).fill('#fffdf7');
              drawText(firstText(item?.time, '--'), colX, rect.y + 18, { width: itemW, align: 'center', size: Math.max(7.8, bodySize - 1.4), bold: true, color: subtitleColor });
              drawText(firstText(item?.label, 'Program'), colX + 4, rect.y + 34, { width: itemW - 8, align: 'center', size: Math.max(7.8, bodySize - 1.4), color: bodyColor });
            });
            return;
          }

          if (type === 'familyconnection') {
            drawContainer(rect, { radius: containerRadius, fill: containerFill, borderColor: containerBorder, borderWidth: containerBorderWidth });
            const famSize = styleNumber(sectionStyle, ['fontSize', 'textSize'], 10);
            const famX = rect.x + 12;
            const famW = rect.w - 24;
            const firstY = rect.y + 10;
            drawText(groomFamilyLine, famX, firstY, { width: famW, size: famSize, bold: true, color: titleColor, align: contentAlign });
            doc.font('Helvetica-Bold').fontSize(famSize);
            const firstHeight = doc.heightOfString(firstText(groomFamilyLine, ''), { width: famW, lineGap: 1 });
            const secondY = Math.min(rect.y + rect.h - famSize - 4, firstY + firstHeight + 4);
            drawText(brideFamilyLine, famX, secondY, { width: famW, size: famSize, bold: true, color: titleColor, align: contentAlign });
            return;
          }

          if (type === 'qrpass' && qrBuffer) {
            drawContainer(rect, { radius: containerRadius, fill: containerFill, borderColor: containerBorder, borderWidth: containerBorderWidth });
            if (mapPreviewBuffer && rect.w > 200) {
              const mapW = Math.max(100, rect.w - 90);
              doc.image(mapPreviewBuffer, rect.x + 10, rect.y + 8, { fit: [mapW, rect.h - 16], align: 'center', valign: 'center' });
              doc.lineWidth(0.5).strokeColor('#d4c9a8').roundedRect(rect.x + 10, rect.y + 8, mapW, rect.h - 16, 8).stroke();
            } else {
              drawText(firstText(qrProps.ctaLabel, 'Scan for RSVP / Entry'), rect.x + 12, rect.y + 12, { width: rect.w - 80, size: styleNumber(sectionStyle, ['fontSize', 'textSize'], 10), bold: true, color: subtitleColor });
              if (inviteUrl) {
                drawText(inviteUrl, rect.x + 12, rect.y + 30, { width: rect.w - 80, size: Math.max(7.5, bodySize - 2), color: p.link || '#1d4ed8' });
              }
            }
            const qrSize = Math.min(64, rect.h - 14);
            doc.image(qrBuffer, rect.x + rect.w - qrSize - 10, rect.y + (rect.h - qrSize) / 2, { width: qrSize, height: qrSize });
            return;
          }

          if (type === 'footermessage') {
            drawText(firstText(section?.props?.text, section?.props?.message, section?.bindings?.text), rect.x + 6, rect.y + 2, { width: rect.w - 12, align: 'center', size: 8.5, color: p.subtle || '#6B7280' });
          }
        });

        _drawOrnateDivider(doc, cardBottom - 20, cardX + 40, cardX + cardW - 40, p.divider || p.accent || '#C28A2E');
        doc.end();
        return;
      }

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

      const heroTitle = firstText(heroProps.title, heroProps.heading, heroSection?.bindings?.title);
      const heroSubtitle = firstText(heroProps.subtitle, heroSection?.bindings?.subtitle, heroProps.caption);
      const shouldRenderHeroCard = Boolean(heroImageBuffer || heroTitle || heroSubtitle);

      if (shouldRenderHeroCard) {
        if (heroImageBuffer) {
          const heroH = 188;
          doc.roundedRect(cardX + 18, y, cardW - 36, heroH, 20).fill('#f8f3e8');
          doc.image(heroImageBuffer, cardX + 18, y, { fit: [cardW - 36, heroH], align: 'center', valign: 'center' });
          doc.lineWidth(1).strokeColor(p.divider || '#D9C39A').roundedRect(cardX + 18, y, cardW - 36, heroH, 20).stroke();
          y += heroH + 12;
        } else {
          const heroH = 82;
          doc.roundedRect(cardX + 18, y, cardW - 36, heroH, 16).fill('#fbf6ea');
          doc.lineWidth(0.8).strokeColor(p.divider || '#D9C39A').roundedRect(cardX + 18, y, cardW - 36, heroH, 16).stroke();
          doc.font('Helvetica-Bold').fontSize(13).fillColor(p.title || '#4B3621')
            .text(heroTitle || namesLine, cardX + 34, y + 20, { width: cardW - 68, align: 'center' });
          if (heroSubtitle) {
            doc.font('Helvetica').fontSize(9.2).fillColor(p.subtitle || '#6B5A45')
              .text(heroSubtitle, cardX + 34, y + 44, { width: cardW - 68, align: 'center' });
          }
          y += heroH + 10;
        }
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
        if (mapPreviewBuffer) {
          doc.roundedRect(cardX + 18, y, cardW - 36, 108, 12).fill('#fffdf7');
          doc.lineWidth(0.8).strokeColor(p.divider || '#D9C39A').roundedRect(cardX + 18, y, cardW - 36, 108, 12).stroke();
          doc.font('Helvetica-Bold').fontSize(10).fillColor(p.subtitle || '#6B5A45').text('Get Directions / RSVP', cardX + 28, y + 12, { width: 210, align: 'left' });
          doc.image(mapPreviewBuffer, cardX + 28, y + 32, { fit: [184, 66], align: 'center', valign: 'center' });
          doc.lineWidth(0.5).strokeColor('#d4c9a8').roundedRect(cardX + 28, y + 32, 184, 66, 8).stroke();
          doc.image(qrBuffer, cardX + cardW - 18 - 84, y + 12, { width: 84, height: 84 });
          if (inviteUrl) {
            doc.font('Helvetica').fontSize(8.2).fillColor(p.link || '#1d4ed8').text(inviteUrl, cardX + 220, y + 81, { width: cardW - 250, align: 'left' });
          }
        } else {
          doc.roundedRect(cardX + 18, y, cardW - 36, 70, 12).fill('#fffdf7');
          doc.lineWidth(0.8).strokeColor(p.divider || '#D9C39A').roundedRect(cardX + 18, y, cardW - 36, 70, 12).stroke();
          doc.font('Helvetica-Bold').fontSize(10).fillColor(p.subtitle || '#6B5A45')
            .text(firstText(qrProps.ctaLabel, 'Scan for RSVP / Entry'), cardX + 28, y + 16, { width: cardW - 150, align: 'left' });
          if (inviteUrl) {
            doc.font('Helvetica').fontSize(8.2).fillColor(p.link || '#1d4ed8')
              .text(inviteUrl, cardX + 28, y + 36, { width: cardW - 150, align: 'left' });
          }
          doc.image(qrBuffer, cardX + cardW - 18 - 52, y + 9, { width: 52, height: 52 });
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

function getPlaywrightChromium() {
  if (playwrightChromium) return playwrightChromium;

  try {
    // Prefer full playwright package because it can manage browser binaries.
    playwrightChromium = require('playwright').chromium;
    return playwrightChromium;
  } catch (_error) {
    try {
      // Fallback for environments that install playwright-core with system chromium.
      playwrightChromium = require('playwright-core').chromium;
      return playwrightChromium;
    } catch (_innerError) {
      return null;
    }
  }
}

function resolveChromiumExecutablePath() {
  const candidates = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    process.env.CHROMIUM_PATH,
    process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : '',
    process.platform === 'win32' ? 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe' : '',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch (_error) {
      // Ignore malformed path checks.
    }
  }

  return null;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function resolveContentAreaRectForHtml(contentAreaRaw) {
  const toFiniteNumber = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };

  const contentArea = contentAreaRaw && typeof contentAreaRaw === 'object' ? contentAreaRaw : {};
  const defaultRect = {
    x: Math.round(HTML_PDF_PAGE_WIDTH * 0.12),
    y: Math.round(HTML_PDF_PAGE_HEIGHT * 0.18),
    w: Math.round(HTML_PDF_PAGE_WIDTH * 0.76),
    h: Math.round(HTML_PDF_PAGE_HEIGHT * 0.72),
  };

  const xRaw = toFiniteNumber(contentArea.x ?? contentArea.left);
  const yRaw = toFiniteNumber(contentArea.y ?? contentArea.top);
  const wRaw = toFiniteNumber(contentArea.width ?? contentArea.w);
  const hRaw = toFiniteNumber(contentArea.height ?? contentArea.h);

  const resolveAxis = (raw, total, fallback) => {
    if (raw === null) return fallback;
    if (raw >= 0 && raw <= 1) return Math.round(raw * total);
    return Math.round(raw);
  };

  const x = resolveAxis(xRaw, HTML_PDF_PAGE_WIDTH, defaultRect.x);
  const y = resolveAxis(yRaw, HTML_PDF_PAGE_HEIGHT, defaultRect.y);
  const w = Math.max(220, resolveAxis(wRaw, HTML_PDF_PAGE_WIDTH, defaultRect.w));
  const h = Math.max(260, resolveAxis(hRaw, HTML_PDF_PAGE_HEIGHT, defaultRect.h));

  return { x, y, w, h };
}

async function renderHtmlToPdfBuffer(html) {
  const chromium = getPlaywrightChromium();
  if (!chromium) {
    throw new Error('Playwright Chromium not available. Install playwright or playwright-core.');
  }

  const launchOptions = {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  };
  const executablePath = resolveChromiumExecutablePath();
  if (executablePath) launchOptions.executablePath = executablePath;

  const browser = await chromium.launch(launchOptions);
  try {
    const page = await browser.newPage({
      viewport: { width: HTML_PDF_PAGE_WIDTH, height: HTML_PDF_PAGE_HEIGHT },
      deviceScaleFactor: 1,
    });

    await page.setContent(html, { waitUntil: 'networkidle' });
    return await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' },
      preferCSSPageSize: true,
    });
  } finally {
    await browser.close();
  }
}

async function buildTemplateEngineHtmlPdfBuffer({ guest, event, inviteMessage, inviteUrl, qrBuffer, relationship, template }) {
  const p = template?.palette || {};
  const eventDate = event?.date ? new Date(event.date) : null;
  const dateText = eventDate
    ? eventDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'Date to be announced';
  const timeText = eventDate
    ? eventDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
    : '';

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
      groomFamily: event?.groomFamily || 'To be announced',
      brideFamily: event?.brideFamily || 'To be announced',
      segment1Time: event?.segment1Time || '9:00 AM',
      segment2Time: event?.segment2Time || (timeText || '10:30 AM'),
      segment3Time: event?.segment3Time || '12:00 PM',
      segment1Label: event?.segment1Label || 'Program 1',
      segment2Label: event?.segment2Label || 'Program 2',
      segment3Label: event?.segment3Label || 'Program 3',
    },
  };

  const resolvedTemplateConfig = template?.configJson && typeof template.configJson === 'object'
    ? template.configJson
    : {};
  const normalizedModel = normalizeSimpleTemplateModel(resolvedTemplateConfig);

  const assetSlotUrls = collectAssetSlotUrls(resolvedTemplateConfig);
  const assetUrls = collectTemplateAssetUrls(resolvedTemplateConfig);
  const backgroundAssetRef = String(resolvedTemplateConfig?.canvas?.backgroundAssetRef || '').trim();
  const backgroundImageUrl = firstText(
    normalizedModel.backgroundImage,
    assetSlotUrls[backgroundAssetRef],
    assetSlotUrls.backgroundTextureImage,
    assetSlotUrls.backgroundImage,
    resolvedTemplateConfig?.canvas?.backgroundImage,
    assetSlotUrls.decorativeImage,
    assetUrls[0]
  );

  const theme = resolveDynamicTheme(resolvedTemplateConfig, p);
  const contentRect = resolveContentAreaRectForHtml(normalizedModel.contentArea);
  const sections = normalizeTemplateEngineSections(resolvedTemplateConfig, context);

  const inviteLines = String(inviteMessage || '').split('\n').map((line) => line.trim()).filter(Boolean);
  const salutation = inviteLines[0] || `Dear ${context.guest.name}`;
  const messageBody = inviteLines.slice(1).join(' ') || context.guest.invitationMessage || '';

  const syntheticSections = [
    {
      componentType: 'GuestHeader',
      props: {
        title: context.event.title,
        subtitle: `${context.event.brideName} & ${context.event.groomName}`,
        badgeText: context.guest.guestCategory,
      },
    },
    {
      componentType: 'PersonalMessage',
      props: {
        salutation,
        message: messageBody,
        signature: `${context.event.dateText}${context.event.timeText ? ` | ${context.event.timeText}` : ''}`,
      },
    },
    {
      componentType: 'RSVPSection',
      props: { title: 'RSVP', primaryLabel: 'RSVP Now', secondaryLabel: 'Join Live Stream' },
    },
    {
      componentType: 'SmartRecommendations',
      props: {
        title: 'Event Timeline',
        segment1Label: context.event.segment1Label,
        segment2Label: context.event.segment2Label,
        segment3Label: context.event.segment3Label,
      },
    },
    {
      componentType: 'FamilyConnection',
      props: {
        groomFamilyLabel: `Groom's Family: ${context.event.groomFamily}`,
        brideFamilyLabel: `Bride's Family: ${context.event.brideFamily}`,
      },
    },
    {
      componentType: 'QRPass',
      props: { ctaLabel: 'Get Directions / RSVP', helpText: inviteUrl || '' },
    },
  ];

  const sectionsToRender = sections.length ? sections : syntheticSections;
  const qrDataUrl = qrBuffer ? `data:image/png;base64,${qrBuffer.toString('base64')}` : '';
  const useOrnateCardLayout = sections.length === 0;
  const clampWords = (value, maxWords) => {
    const words = String(value || '').trim().split(/\s+/).filter(Boolean);
    if (words.length <= maxWords) return words.join(' ');
    return `${words.slice(0, maxWords).join(' ')}...`;
  };

  const getSectionProps = (componentType) => {
    const target = String(componentType || '').toLowerCase();
    const section = sectionsToRender.find((entry) => String(entry?.componentType || '').toLowerCase() === target);
    return section?.props && typeof section.props === 'object' ? section.props : {};
  };

  const headerProps = getSectionProps('GuestHeader');
  const messageProps = getSectionProps('PersonalMessage');
  const rsvpProps = getSectionProps('RSVPSection');
  const timelineProps = getSectionProps('SmartRecommendations');
  const familyProps = getSectionProps('FamilyConnection');
  const qrProps = getSectionProps('QRPass');

  const topDecorUrl = firstText(
    assetSlotUrls.topGarlandImage,
    assetSlotUrls.headerGarlandImage,
    assetSlotUrls.topDecorImage
  );
  const heroImageUrl = firstText(
    assetSlotUrls.heroBrideGroomImage,
    assetSlotUrls.heroImage,
    assetSlotUrls.coupleImage,
    assetSlotUrls.decorativeImage
  );
  const mapPreviewUrl = firstText(
    assetSlotUrls.mapPreviewImage,
    assetSlotUrls.mapImage
  );

  const timelineRows = [
    {
      time: firstText(context.event.segment1Time, '9:00 AM'),
      label: firstText(timelineProps.segment1Label, context.event.segment1Label),
    },
    {
      time: firstText(context.event.segment2Time, timeText || '10:30 AM'),
      label: firstText(timelineProps.segment2Label, context.event.segment2Label),
    },
    {
      time: firstText(context.event.segment3Time, '12:00 PM'),
      label: firstText(timelineProps.segment3Label, context.event.segment3Label),
    },
  ];

  const ornateRect = {
    x: Math.max(34, Math.min(contentRect.x, 46)),
    y: Math.max(18, Math.min(contentRect.y, 36)),
    w: Math.min(Math.max(contentRect.w, HTML_PDF_PAGE_WIDTH - 78), HTML_PDF_PAGE_WIDTH - 68),
    h: Math.min(Math.max(contentRect.h, HTML_PDF_PAGE_HEIGHT - 72), HTML_PDF_PAGE_HEIGHT - 54),
  };

  const cardMarkup = sectionsToRender.map((section) => {
    const type = String(section?.componentType || '').toLowerCase();
    const props = section?.props && typeof section.props === 'object' ? section.props : {};

    if (type === 'guestbadge') {
      return '';
    }

    if (type === 'guestheader' || type === 'couplehero') {
      return `
        <section class="card card-header">
          <h1>${escapeHtml(firstText(props.title, context.event.title))}</h1>
          <p class="subtitle">${escapeHtml(firstText(props.subtitle, `${context.event.brideName} & ${context.event.groomName}`))}</p>
          <div class="badge">${escapeHtml(firstText(props.badgeText, context.guest.guestCategory))}</div>
        </section>
      `;
    }

    if (type === 'personalmessage') {
      const resolvedBody = clampWords(firstText(props.message, messageBody), 42);
      return `
        <section class="card card-message">
          <h2>${escapeHtml(firstText(props.salutation, salutation))}</h2>
          <p>${escapeHtml(resolvedBody)}</p>
          <div class="muted">${escapeHtml(firstText(props.signature, `${context.event.dateText}${context.event.timeText ? ` | ${context.event.timeText}` : ''}`))}</div>
          <div class="muted">${escapeHtml(context.event.venue)}</div>
        </section>
      `;
    }

    if (type === 'rsvpsection') {
      return `
        <section class="card card-actions">
          <div class="btn">${escapeHtml(firstText(props.primaryLabel, 'RSVP Now'))}</div>
          <div class="btn">${escapeHtml(firstText(props.secondaryLabel, 'Join Live Stream'))}</div>
        </section>
      `;
    }

    if (type === 'smartrecommendations') {
      return `
        <section class="card card-timeline">
          <div class="timeline-item"><div class="dot"></div><div class="timeline-time">${escapeHtml(context.event.segment1Time)}</div><div>${escapeHtml(firstText(props.segment1Label, context.event.segment1Label))}</div></div>
          <div class="timeline-item"><div class="dot"></div><div class="timeline-time">${escapeHtml(context.event.segment2Time)}</div><div>${escapeHtml(firstText(props.segment2Label, context.event.segment2Label))}</div></div>
          <div class="timeline-item"><div class="dot"></div><div class="timeline-time">${escapeHtml(context.event.segment3Time)}</div><div>${escapeHtml(firstText(props.segment3Label, context.event.segment3Label))}</div></div>
        </section>
      `;
    }

    if (type === 'familyconnection') {
      return `
        <section class="card card-details">
          <div>${escapeHtml(firstText(props.groomFamilyLabel, `Groom's Family: ${context.event.groomFamily}`))}</div>
          <div>${escapeHtml(firstText(props.brideFamilyLabel, `Bride's Family: ${context.event.brideFamily}`))}</div>
        </section>
      `;
    }

    if (type === 'qrpass') {
      return `
        <section class="card card-qr">
          <div class="qr-content">
            <div class="qr-title">${escapeHtml(firstText(props.ctaLabel, 'Get Directions / RSVP'))}</div>
            <div class="qr-link">${escapeHtml(firstText(props.helpText, inviteUrl))}</div>
          </div>
          ${qrDataUrl ? `<img class="qr-image" src="${escapeHtml(qrDataUrl)}" alt="QR" />` : ''}
        </section>
      `;
    }

    const genericRows = Object.values(props).filter((value) => typeof value === 'string' && value.trim());
    if (genericRows.length < 2) return '';
    return `
      <section class="card card-details">
        ${genericRows.slice(0, 4).map((line) => `<div>${escapeHtml(line)}</div>`).join('')}
      </section>
    `;
  }).join('');

  const ornateMarkup = `
    <div class="ornate-shell" style="left:${ornateRect.x}px;top:${ornateRect.y}px;width:${ornateRect.w}px;height:${ornateRect.h}px;">
      ${topDecorUrl ? `<img class="ornate-garland" src="${escapeHtml(topDecorUrl)}" alt="top decor" />` : ''}
      <div class="ornate-card">
        <section class="ornate-hero">
          ${heroImageUrl ? `<img class="ornate-hero-image" src="${escapeHtml(heroImageUrl)}" alt="couple" />` : ''}
        </section>

        <section class="ornate-title">
          <div class="ornate-title-main">${escapeHtml(firstText(headerProps.title, context.event.title))}</div>
          <div class="ornate-title-sub">${escapeHtml(firstText(headerProps.subtitle, `${context.event.brideName} \u2764 ${context.event.groomName}`))}</div>
        </section>

        <section class="ornate-meta">
          <div class="ornate-meta-row"><span class="ornate-meta-label">Date</span><span>${escapeHtml(context.event.dateText)}${context.event.timeText ? ` | ${escapeHtml(context.event.timeText)}` : ''}</span></div>
          <div class="ornate-meta-row"><span class="ornate-meta-label">Venue</span><span>${escapeHtml(firstText(context.event.venue, 'Venue to be announced'))}</span></div>
        </section>

        <section class="ornate-actions">
          <div class="ornate-btn">${escapeHtml(firstText(rsvpProps.primaryLabel, 'RSVP Now'))}</div>
          <div class="ornate-btn">${escapeHtml(firstText(rsvpProps.secondaryLabel, 'Join Live Stream'))}</div>
        </section>

        <section class="ornate-timeline">
          ${timelineRows.map((item) => `
            <div class="ornate-timeline-item">
              <span class="ornate-dot"></span>
              <div class="ornate-time">${escapeHtml(item.time)}</div>
              <div class="ornate-label">${escapeHtml(item.label)}</div>
            </div>
          `).join('')}
        </section>

        <section class="ornate-family">
          <div>${escapeHtml(firstText(familyProps.groomFamilyLabel, `Groom's Family: ${context.event.groomFamily}`))}</div>
          <div>${escapeHtml(firstText(familyProps.brideFamilyLabel, `Bride's Family: ${context.event.brideFamily}`))}</div>
        </section>

        <section class="ornate-directions">
          <div class="ornate-directions-text">${escapeHtml(firstText(qrProps.ctaLabel, 'Get Directions'))}</div>
          ${mapPreviewUrl
            ? `<img class="ornate-map" src="${escapeHtml(mapPreviewUrl)}" alt="map" />`
            : (qrDataUrl ? `<img class="ornate-map" src="${escapeHtml(qrDataUrl)}" alt="qr" />` : '')}
        </section>

        ${firstText(messageProps.message, messageBody) ? `<section class="ornate-note">${escapeHtml(clampWords(firstText(messageProps.message, messageBody), 30))}</section>` : ''}
      </div>
    </div>
  `;

  const pageBackground = backgroundImageUrl
    ? `background-image: url('${escapeHtml(backgroundImageUrl)}'); background-size: cover; background-position: center;`
    : `background: linear-gradient(135deg, ${escapeHtml(firstText(p.background, '#f8f3e8'))} 0%, #fffdf5 100%);`;

  const html = `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          @page { size: A4; margin: 0; }
          * { box-sizing: border-box; }
          html, body { margin: 0; padding: 0; width: ${HTML_PDF_PAGE_WIDTH}px; height: ${HTML_PDF_PAGE_HEIGHT}px; font-family: 'Segoe UI', 'Noto Sans Telugu', Arial, sans-serif; }
          .page {
            position: relative;
            width: ${HTML_PDF_PAGE_WIDTH}px;
            height: ${HTML_PDF_PAGE_HEIGHT}px;
            ${pageBackground}
            overflow: hidden;
          }
          .content {
            position: absolute;
            left: ${contentRect.x}px;
            top: ${contentRect.y}px;
            width: ${contentRect.w}px;
            max-height: ${contentRect.h}px;
            display: grid;
            gap: 8px;
          }
          .card {
            background: rgba(255, 252, 245, 0.9);
            border: 1.2px solid ${escapeHtml(theme.border)};
            border-radius: 16px;
            padding: 10px 12px;
            color: ${escapeHtml(theme.text)};
            backdrop-filter: blur(1px);
          }
          .card h1, .card h2, .card p { margin: 0; }
          .card-header h1 { text-align: center; font-size: 18px; line-height: 1.1; color: ${escapeHtml(theme.primary)}; }
          .card-header .subtitle { margin-top: 3px; text-align: center; font-size: 14px; font-weight: 700; }
          .badge {
            margin: 6px auto 0;
            padding: 2px 12px;
            width: fit-content;
            border-radius: 999px;
            border: 1px solid ${escapeHtml(theme.border)};
            background: rgba(255, 255, 255, 0.72);
            font-weight: 700;
            font-size: 12px;
          }
          .card-message h2 { font-size: 17px; color: ${escapeHtml(theme.text)}; }
          .card-message p { margin-top: 6px; font-size: 12px; line-height: 1.38; }
          .muted { margin-top: 4px; font-size: 11px; color: ${escapeHtml(theme.subtle)}; font-weight: 600; }
          .card-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
          .btn {
            text-align: center;
            padding: 7px 10px;
            border-radius: 999px;
            border: 1px solid ${escapeHtml(theme.border)};
            font-weight: 700;
            font-size: 12px;
            background: rgba(255, 255, 255, 0.9);
          }
          .card-timeline { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
          .timeline-item { text-align: center; font-size: 11px; }
          .timeline-time { font-size: 10px; font-weight: 700; color: ${escapeHtml(theme.subtle)}; margin-bottom: 2px; }
          .dot { width: 6px; height: 6px; border-radius: 50%; margin: 0 auto 4px; background: ${escapeHtml(theme.accent)}; }
          .card-details { font-size: 11px; line-height: 1.35; font-weight: 700; }
          .card-qr { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
          .qr-title { font-size: 12px; font-weight: 700; }
          .qr-link { margin-top: 4px; font-size: 10px; color: #b91c1c; word-break: break-all; }
          .qr-image { width: 52px; height: 52px; border-radius: 6px; border: 1px solid ${escapeHtml(theme.border)}; background: #fff; }

          .ornate-shell {
            position: absolute;
          }
          .ornate-garland {
            width: 100%;
            max-height: 92px;
            object-fit: contain;
            object-position: center;
            margin-bottom: 8px;
          }
          .ornate-card {
            height: calc(100% - 98px);
            background: rgba(255, 250, 240, 0.86);
            border: 1.5px solid ${escapeHtml(theme.border)};
            border-radius: 30px;
            box-shadow: 0 10px 26px rgba(70, 42, 10, 0.18);
            padding: 14px;
            display: grid;
            grid-template-rows: 355px auto auto auto auto auto auto;
            gap: 10px;
            color: ${escapeHtml(theme.text)};
          }
          .ornate-hero {
            border-radius: 22px;
            overflow: hidden;
            border: 1.3px solid ${escapeHtml(theme.border)};
            background: linear-gradient(180deg, rgba(255,255,255,0.8), rgba(255,248,230,0.9));
          }
          .ornate-hero-image {
            width: 100%;
            height: 100%;
            object-fit: cover;
            object-position: center;
          }
          .ornate-title {
            text-align: center;
            line-height: 1.25;
            margin-top: -2px;
          }
          .ornate-title-main {
            font-size: 33px;
            color: ${escapeHtml(theme.primary)};
            font-weight: 700;
          }
          .ornate-title-sub {
            margin-top: 3px;
            font-size: 44px;
            color: ${escapeHtml(theme.text)};
            font-weight: 700;
          }
          .ornate-meta,
          .ornate-actions,
          .ornate-timeline,
          .ornate-family,
          .ornate-directions,
          .ornate-note {
            border: 1.2px solid ${escapeHtml(theme.border)};
            border-radius: 18px;
            background: rgba(255, 255, 252, 0.92);
          }
          .ornate-meta {
            padding: 10px 14px;
            font-size: 20px;
            line-height: 1.45;
          }
          .ornate-meta-row {
            display: flex;
            gap: 10px;
            align-items: baseline;
          }
          .ornate-meta-label {
            min-width: 62px;
            font-weight: 700;
            color: ${escapeHtml(theme.primary)};
          }
          .ornate-actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 14px;
            padding: 10px 12px;
          }
          .ornate-btn {
            border: 1.1px solid ${escapeHtml(theme.border)};
            border-radius: 999px;
            text-align: center;
            padding: 8px 10px;
            font-size: 30px;
            font-weight: 700;
            color: ${escapeHtml(theme.text)};
            background: linear-gradient(180deg, #fffef8, #f6edd6);
          }
          .ornate-timeline {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
            padding: 10px 10px 8px;
          }
          .ornate-timeline-item {
            text-align: center;
            font-size: 17px;
            line-height: 1.25;
          }
          .ornate-dot {
            width: 11px;
            height: 11px;
            border-radius: 50%;
            display: inline-block;
            background: ${escapeHtml(theme.accent)};
            margin-bottom: 6px;
          }
          .ornate-time {
            font-weight: 700;
            color: ${escapeHtml(theme.subtle)};
          }
          .ornate-label {
            margin-top: 1px;
          }
          .ornate-family {
            padding: 10px 14px;
            font-size: 21px;
            line-height: 1.35;
            font-weight: 700;
          }
          .ornate-directions {
            display: grid;
            grid-template-columns: 1fr 130px;
            align-items: center;
            gap: 10px;
            padding: 8px 12px;
            min-height: 84px;
          }
          .ornate-directions-text {
            font-size: 31px;
            font-weight: 700;
            color: ${escapeHtml(theme.text)};
          }
          .ornate-map {
            width: 124px;
            height: 68px;
            border-radius: 12px;
            border: 1px solid ${escapeHtml(theme.border)};
            object-fit: cover;
            background: #fff;
          }
          .ornate-note {
            padding: 8px 12px;
            font-size: 16px;
            line-height: 1.25;
            color: ${escapeHtml(theme.subtle)};
          }
        </style>
      </head>
      <body>
        <div class="page">
          ${useOrnateCardLayout ? ornateMarkup : `
          <div class="content">
            ${cardMarkup}
          </div>
          `}
        </div>
      </body>
    </html>
  `;

  return renderHtmlToPdfBuffer(html);
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
  const startedAt = Date.now();
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
  let rendererUsed = hasAdobeTemplate
    ? 'adobe-express'
    : hasTemplateEngineJson
      ? 'template-engine'
      : 'classic';
  let htmlRendererAttempted = false;
  let htmlRendererFailed = false;
  let htmlRendererError = null;

  const templateAssetSlots = hasTemplateEngineJson ? collectAssetSlotUrls(template.configJson || {}) : {};
  const templateAssetUrls = hasTemplateEngineJson ? collectTemplateAssetUrls(template.configJson || {}) : [];
  const backgroundAssetRef = hasTemplateEngineJson
    ? String(template?.configJson?.canvas?.backgroundAssetRef || '').trim()
    : '';
  const hasBackgroundAsset = Boolean(
    hasTemplateEngineJson && (
      (backgroundAssetRef && templateAssetSlots[backgroundAssetRef]) ||
      templateAssetSlots.backgroundTextureImage ||
      templateAssetSlots.backgroundImage ||
      templateAssetSlots.decorativeImage ||
      (template?.configJson?.canvas?.backgroundImage && String(template.configJson.canvas.backgroundImage).trim()) ||
      templateAssetUrls[0]
    )
  );

  let pdfBuffer;
  if (hasAdobeTemplate) {
    pdfBuffer = await buildAdobeExpressPdfBuffer({
      guest,
      event,
      template,
      inviteMessage,
      inviteUrl,
      qrBuffer,
      relationship,
      customMessage,
    });
  } else if (hasTemplateEngineJson) {
    htmlRendererAttempted = true;
    try {
      pdfBuffer = await buildTemplateEngineHtmlPdfBuffer({
        guest,
        event,
        template,
        inviteMessage,
        inviteUrl,
        qrBuffer,
        relationship,
      });
      rendererUsed = 'template-engine-html';
    } catch (error) {
      htmlRendererFailed = true;
      htmlRendererError = firstText(error?.message, String(error || ''));
      pdfBuffer = await buildTemplateEnginePdfBuffer({
        guest,
        event,
        template,
        inviteMessage,
        inviteUrl,
        qrBuffer,
        relationship,
      });
      rendererUsed = 'template-engine-pdfkit-fallback';
    }
  } else {
    pdfBuffer = await buildPdfBuffer({
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
  }

  const key = `invites/personalized/${event.id}/${inviteTemplateKey}/guest-${guest.id}-${Date.now()}.pdf`;
  const pdfUrl = await uploadPdfToR2(pdfBuffer, key);

  const generationMs = Date.now() - startedAt;
  if (htmlRendererFailed) {
    console.warn('[invite-renderer] html renderer fallback engaged', {
      guestId: guest?.id,
      eventId: event?.id,
      templateKey: inviteTemplateKey,
      rendererUsed,
      generationMs,
      error: htmlRendererError,
    });
  } else {
    console.info('[invite-renderer] invite generated', {
      guestId: guest?.id,
      eventId: event?.id,
      templateKey: inviteTemplateKey,
      rendererUsed,
      generationMs,
    });
  }

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
      htmlRendererAttempted,
      htmlRendererFailed,
      htmlRendererError,
      generationMs,
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
