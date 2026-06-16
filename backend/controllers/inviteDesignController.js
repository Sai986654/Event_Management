const PDFDocument = require('pdfkit');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const QRCode = require('qrcode');
const crypto = require('crypto');
const { prisma } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { listInviteTemplates, generatePersonalizedInvite } = require('../services/personalizedInviteService');
const { sendInviteLink } = require('../services/notificationService');
const paymentService = require('../services/paymentService');
const { r2Client, R2_BUCKET, R2_PUBLIC_URL } = require('../config/r2');
const { resolveClientBaseUrl } = require('../utils/urlResolver');

const canManageEvent = (event, user) =>
  !!event && (event.organizerId === user.id || user.role === 'admin' || user.role === 'organizer');

const normalizeFormat = (value) => {
  const candidate = String(value || '').toLowerCase();
  if (['png', 'jpg', 'pdf'].includes(candidate)) return candidate;
  return null;
};

const parsePositiveInt = (value) => {
  const num = Number(value);
  return Number.isInteger(num) && num > 0 ? num : null;
};

const numberOrFallback = (value, fallback) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const parseCanvasSize = (value, fallback = '1080x1920') => {
  const [wRaw, hRaw] = String(value || fallback).split('x');
  return {
    width: Math.max(320, numberOrFallback(wRaw, 1080)),
    height: Math.max(320, numberOrFallback(hRaw, 1920)),
  };
};

const coerceObject = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : {});

const deepMerge = (base, override) => {
  if (Array.isArray(base) && Array.isArray(override)) {
    return override.map((item, index) => deepMerge(base[index], item));
  }
  if (base && typeof base === 'object' && override && typeof override === 'object' && !Array.isArray(base) && !Array.isArray(override)) {
    const keys = new Set([...Object.keys(base), ...Object.keys(override)]);
    const merged = {};
    for (const key of keys) {
      if (override[key] === undefined) {
        merged[key] = base[key];
      } else if (base[key] === undefined) {
        merged[key] = override[key];
      } else {
        merged[key] = deepMerge(base[key], override[key]);
      }
    }
    return merged;
  }
  return override === undefined ? base : override;
};

const formatEventDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-IN', { dateStyle: 'medium' });
};

const formatEventTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en-IN', { timeStyle: 'short' });
};

const buildMergeContext = ({ guest, event, layout }) => {
  const mergeData = coerceObject(layout.mergeData);
  const hosts = coerceObject(mergeData.hosts);
  const custom = coerceObject(mergeData.custom);
  const eventOverride = coerceObject(mergeData.event);
  const guestOverride = coerceObject(mergeData.guest);
  const guestData = coerceObject(guest);
  const eventData = coerceObject(event);

  return {
    guest: {
      id: guestOverride.id || guestData.id || '',
      name: guestOverride.name || guestData.name || '',
      email: guestOverride.email || guestData.email || '',
      phone: guestOverride.phone || guestData.phone || '',
      tableAssignment: guestOverride.tableAssignment || guestData.tableAssignment || '',
      plusOnes: guestOverride.plusOnes ?? guestData.plusOnes ?? 0,
      rsvpStatus: guestOverride.rsvpStatus || guestData.rsvpStatus || '',
      relationship: guestOverride.relationship || guestData.relationship || '',
    },
    event: {
      id: eventOverride.id || eventData.id || '',
      title: eventOverride.title || eventData.title || '',
      venue: eventOverride.venue || eventData.venue || '',
      slug: eventOverride.slug || eventData.slug || '',
      type: eventOverride.type || eventData.type || layout.eventType || '',
      date: eventOverride.date || eventData.date || '',
      dateText: eventOverride.dateText || formatEventDate(eventOverride.date || eventData.date),
      timeText: eventOverride.timeText || formatEventTime(eventOverride.date || eventData.date),
      city: eventOverride.city || eventData.city || '',
    },
    hosts,
    custom,
  };
};

const getPathValue = (source, path) => {
  return String(path || '')
    .split('.')
    .filter(Boolean)
    .reduce((acc, segment) => (acc && acc[segment] !== undefined ? acc[segment] : undefined), source);
};

const resolveTemplateText = (value, context) => {
  return String(value || '').replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, token) => {
    const resolved = getPathValue(context, token);
    return resolved === undefined || resolved === null ? '' : String(resolved);
  });
};

const resolveLayoutValue = (value, context) => {
  if (typeof value === 'string') return resolveTemplateText(value, context);
  if (Array.isArray(value)) return value.map((item) => resolveLayoutValue(item, context));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, resolveLayoutValue(entry, context)])
    );
  }
  return value;
};

const buildInviteUrl = ({ clientBaseUrl, event, guest, inviteToken }) => {
  if (!event?.slug || !inviteToken) return '';
  const base = String(clientBaseUrl || '').replace(/\/$/, '');
  return `${base}/public/${event.slug}?guest=${guest.id}&token=${inviteToken}`;
};

const buildMapUrl = (event) => {
  const venue = String(event?.venue || '').trim();
  const city = String(event?.city || '').trim();
  const query = [venue, city].filter(Boolean).join(', ');
  return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : '';
};

const mergeActionLinksIntoOverrides = ({ overrides, rsvpLink, mapLink, liveStreamUrl }) => {
  const source = coerceObject(overrides);
  const mergeData = coerceObject(source.mergeData);
  const custom = coerceObject(mergeData.custom);
  return {
    ...source,
    mergeData: {
      ...mergeData,
      custom: {
        ...custom,
        rsvpLink: custom.rsvpLink || rsvpLink || '',
        mapLink: custom.mapLink || mapLink || '',
        liveStreamUrl: custom.liveStreamUrl || liveStreamUrl || '',
      },
    },
  };
};

const fetchImageBuffer = async (source) => {
  const value = String(source || '').trim();
  if (!value) return null;

  if (/^data:image\//i.test(value)) {
    const commaIndex = value.indexOf(',');
    if (commaIndex < 0) return null;
    return Buffer.from(value.slice(commaIndex + 1), 'base64');
  }

  if (!/^https?:\/\//i.test(value)) return null;

  const response = await fetch(value);
  if (!response.ok) {
    throw new Error(`Failed to fetch image asset: ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
};

const resolveLottieSourceUrl = (source) => {
  if (!source) return '';
  if (typeof source === 'string') return source.trim();
  if (typeof source === 'object' && typeof source.uri === 'string') return source.uri.trim();
  return '';
};

const LOTTIE_FALLBACK_THEMES = [
  {
    id: 'confetti',
    matches: ['obhph3t0', 'confetti'],
    title: 'CONFETTI',
    icon: '🎊',
    bg: '#ecfeff',
    stroke: '#06b6d4',
    badge: '#cffafe',
    titleColor: '#0e7490',
    bodyColor: '#155e75',
  },
  {
    id: 'birthday',
    matches: ['nt4ypxj4', 'birthday'],
    title: 'BIRTHDAY',
    icon: '🎂',
    bg: '#fff7ed',
    stroke: '#f97316',
    badge: '#ffedd5',
    titleColor: '#9a3412',
    bodyColor: '#7c2d12',
  },
  {
    id: 'hearts',
    matches: ['gtgjbk', 'heart', 'hearts'],
    title: 'HEARTS',
    icon: '❤️',
    bg: '#fff1f2',
    stroke: '#f43f5e',
    badge: '#ffe4e6',
    titleColor: '#9f1239',
    bodyColor: '#881337',
  },
  {
    id: 'fireworks',
    matches: ['m9p23l', 'firework'],
    title: 'FIREWORKS',
    icon: '🎆',
    bg: '#eef2ff',
    stroke: '#6366f1',
    badge: '#e0e7ff',
    titleColor: '#3730a3',
    bodyColor: '#312e81',
  },
  {
    id: 'stars',
    matches: ['aztdd5', 'stars', 'star'],
    title: 'STARS',
    icon: '⭐',
    bg: '#fffbeb',
    stroke: '#f59e0b',
    badge: '#fef3c7',
    titleColor: '#92400e',
    bodyColor: '#78350f',
  },
  {
    id: 'wedding',
    matches: ['jbb5pqtg', 'wedding'],
    title: 'WEDDING',
    icon: '💍',
    bg: '#fdf2f8',
    stroke: '#db2777',
    badge: '#fce7f3',
    titleColor: '#9d174d',
    bodyColor: '#831843',
  },
  {
    id: 'balloons',
    matches: ['touohxv0', 'balloon'],
    title: 'BALLOONS',
    icon: '🎈',
    bg: '#eff6ff',
    stroke: '#3b82f6',
    badge: '#dbeafe',
    titleColor: '#1d4ed8',
    bodyColor: '#1e40af',
  },
  {
    id: 'celebrate',
    matches: ['u4yrau84', 'celebrat'],
    title: 'CELEBRATE',
    icon: '🥳',
    bg: '#f0fdf4',
    stroke: '#22c55e',
    badge: '#dcfce7',
    titleColor: '#166534',
    bodyColor: '#14532d',
  },
];

const getLottieFallbackTheme = (sourceUrl) => {
  const value = String(sourceUrl || '').toLowerCase();
  const matched = LOTTIE_FALLBACK_THEMES.find((theme) =>
    theme.matches.some((token) => value.includes(String(token || '').toLowerCase()))
  );

  if (matched) return matched;
  return {
    id: 'generic',
    title: 'ANIMATED STICKER',
    icon: '🎬',
    bg: '#f5f3ff',
    stroke: '#a78bfa',
    badge: '#ede9fe',
    titleColor: '#5b21b6',
    bodyColor: '#6d28d9',
  };
};

const compactSourceText = (sourceUrl) => {
  if (!sourceUrl) return 'Source: Lottie animation';
  try {
    const parsed = new URL(sourceUrl);
    const path = String(parsed.pathname || '').split('/').filter(Boolean);
    const leaf = path[path.length - 1] || parsed.hostname;
    return `Source: ${leaf}`;
  } catch (_error) {
    const compact = String(sourceUrl).slice(0, 60);
    return `Source: ${compact}${String(sourceUrl).length > 60 ? '...' : ''}`;
  }
};

const drawLottieFallback = (doc, { x, y, width, height, sourceUrl }) => {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const theme = getLottieFallbackTheme(sourceUrl);

  doc.save();
  doc.roundedRect(x, y, safeWidth, safeHeight, Math.max(4, Math.min(safeWidth, safeHeight) * 0.06));
  doc.fillAndStroke(theme.bg, theme.stroke);

  const badgeHeight = Math.max(20, safeHeight * 0.2);
  doc.roundedRect(x + 6, y + 6, Math.max(80, safeWidth - 12), badgeHeight, 6).fill(theme.badge);
  doc.fillColor(theme.titleColor).font('Helvetica-Bold').fontSize(Math.max(8, badgeHeight * 0.38));
  doc.text(`${theme.icon} ${theme.title}`, x + 12, y + 6 + badgeHeight * 0.22, {
    width: Math.max(40, safeWidth - 24),
    align: 'left',
    lineBreak: false,
  });

  const sourceText = compactSourceText(sourceUrl);
  doc.fillColor(theme.bodyColor).font('Helvetica').fontSize(Math.max(7, Math.min(11, safeHeight * 0.1)));
  doc.text(sourceText, x + 12, y + badgeHeight + 14, {
    width: Math.max(40, safeWidth - 24),
    height: Math.max(20, safeHeight - badgeHeight - 24),
    ellipsis: true,
  });

  doc.restore();
};

const collectLottieLegendItems = (elements) => {
  const items = [];
  const seen = new Set();

  for (const element of Array.isArray(elements) ? elements : []) {
    if (!element || element.type !== 'lottie') continue;
    const sourceUrl = resolveLottieSourceUrl(element.lottieSource);
    const theme = getLottieFallbackTheme(sourceUrl);
    const key = String(theme.id || theme.title || 'generic');
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ id: key, title: String(theme.title || 'ANIMATED STICKER') });
  }

  return items;
};

const drawLottieLegend = (doc, { pageWidth, pageHeight, items }) => {
  const legendItems = (items || []).slice(0, 6);
  if (!legendItems.length) return;

  const boxWidth = Math.max(170, Math.min(240, pageWidth * 0.42));
  const lineHeight = 12;
  const headerHeight = 18;
  const padding = 8;
  const boxHeight = padding * 2 + headerHeight + legendItems.length * lineHeight + 4;
  const x = Math.max(8, pageWidth - boxWidth - 10);
  const y = Math.max(8, pageHeight - boxHeight - 10);

  doc.save();
  doc.roundedRect(x, y, boxWidth, boxHeight, 8).fillAndStroke('#ffffff', '#cbd5e1');
  doc.fillColor('#334155').font('Helvetica-Bold').fontSize(9);
  doc.text('Animated stickers in this invite', x + padding, y + padding, {
    width: boxWidth - padding * 2,
    lineBreak: false,
  });

  doc.fillColor('#475569').font('Helvetica').fontSize(8);
  legendItems.forEach((item, index) => {
    const rowY = y + padding + headerHeight + index * lineHeight;
    doc.text(`- ${item.title}`, x + padding, rowY, {
      width: boxWidth - padding * 2,
      lineBreak: false,
    });
  });
  doc.restore();
};

const deriveInviteMessage = ({ guest, event, resolvedLayout, fallbackMessage }) => {
  if (fallbackMessage) return fallbackMessage;
  const textCandidates = Array.isArray(resolvedLayout.elements)
    ? resolvedLayout.elements
        .filter((element) => element?.type === 'text' && String(element.text || '').trim())
        .sort((a, b) => numberOrFallback(a.z, 0) - numberOrFallback(b.z, 0))
        .map((element) => String(element.text || '').trim())
    : [];

  if (textCandidates.length) {
    return textCandidates.slice(0, 3).join(' ');
  }

  return `${guest?.name || 'Guest'}, you are invited to ${event?.title || 'our event'}.`;
};

const drawActionElement = (doc, element, { x, y, width, height, scale }) => {
  const radius = Math.max(0, numberOrFallback(element.borderRadius, 28) * scale);
  const fillColor = String(element.fillColor || '#ffffff');
  const strokeColor = String(element.strokeColor || '#c9b07d');
  const strokeWidth = Math.max(0, numberOrFallback(element.strokeWidth, 2) * scale);
  const textColor = String(element.textColor || '#374151');
  const fontSize = Math.max(8, numberOrFallback(element.fontSize, 24) * scale);
  const label = String(element.label || 'Action');
  const url = String(element.url || '').trim();

  doc.save();
  if (radius > 0) {
    doc.roundedRect(x, y, width, height, radius);
  } else {
    doc.rect(x, y, width, height);
  }
  doc.lineWidth(strokeWidth);
  if (strokeWidth > 0) {
    doc.fillAndStroke(fillColor, strokeColor || fillColor);
  } else {
    doc.fill(fillColor);
  }

  doc.fillColor(textColor);
  doc.font(element.fontWeight === 'normal' ? 'Helvetica' : 'Helvetica-Bold');
  doc.fontSize(fontSize);
  const textHeight = doc.heightOfString(label, { width: Math.max(1, width - 16 * scale), align: 'center' });
  doc.text(label, x + 8 * scale, y + Math.max(0, (height - textHeight) / 2), {
    width: Math.max(1, width - 16 * scale),
    height,
    align: 'center',
  });

  if (/^https?:\/\//i.test(url)) {
    doc.link(x, y, width, height, url);
  }
  doc.restore();
};

const buildRenderedDesignPdfBuffer = async ({ design, event, guest = null, layoutOverrides = {}, fallbackMessage = '' }) => {
  const baseLayout = coerceObject(design.jsonLayout);
  const mergedLayout = deepMerge(baseLayout, coerceObject(layoutOverrides));
  const mergeContext = buildMergeContext({ guest, event, layout: mergedLayout });
  const resolvedLayout = resolveLayoutValue(mergedLayout, mergeContext);
  const { width: canvasWidth, height: canvasHeight } = parseCanvasSize(resolvedLayout.canvasSize || design.canvasSize);
  const scale = Math.min(1, 900 / Math.max(canvasWidth, canvasHeight));
  const pageWidth = Math.round(canvasWidth * scale);
  const pageHeight = Math.round(canvasHeight * scale);
  const imageCache = new Map();
  const showAnimationLegend = resolvedLayout.showAnimationLegend !== false;

  const pdfBuffer = await new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({ size: [pageWidth, pageHeight], margin: 0 });

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.rect(0, 0, pageWidth, pageHeight).fill(String(resolvedLayout.backgroundColor || '#ffffff'));

    const orderedElements = Array.isArray(resolvedLayout.elements)
      ? resolvedLayout.elements.slice().sort((a, b) => numberOrFallback(a?.z, 0) - numberOrFallback(b?.z, 0))
      : [];

    for (const element of orderedElements) {
      if (!element || typeof element !== 'object') continue;

      const x = numberOrFallback(element.x, 0) * scale;
      const y = numberOrFallback(element.y, 0) * scale;
      const width = Math.max(1, numberOrFallback(element.width, 120) * scale);
      const height = Math.max(1, numberOrFallback(element.height, 60) * scale);

      if (element.type === 'shape') {
        const radius = Math.max(0, numberOrFallback(element.borderRadius, 0) * scale);
        const fillColor = String(element.fillColor || '#f3f4f6');
        const strokeColor = String(element.strokeColor || '');
        const strokeWidth = Math.max(0, numberOrFallback(element.strokeWidth, 0) * scale);
        if (radius > 0) {
          doc.roundedRect(x, y, width, height, radius);
        } else {
          doc.rect(x, y, width, height);
        }
        if (strokeWidth > 0) {
          doc.fillAndStroke(fillColor, strokeColor || fillColor);
        } else {
          doc.fill(fillColor);
        }
        continue;
      }

      if (element.type === 'divider') {
        doc.save();
        doc.lineWidth(Math.max(1, numberOrFallback(element.thickness, 2) * scale));
        doc.strokeColor(String(element.color || '#b45309'));
        if (element.orientation === 'vertical') {
          doc.moveTo(x + width / 2, y).lineTo(x + width / 2, y + height).stroke();
        } else {
          doc.moveTo(x, y + height / 2).lineTo(x + width, y + height / 2).stroke();
        }
        doc.restore();
        continue;
      }

      if (element.type === 'text') {
        doc.save();
        doc.fillColor(String(element.color || '#111827'));
        doc.font(element.fontWeight === 'bold' || element.fontWeight === '700' ? 'Helvetica-Bold' : 'Helvetica');
        doc.fontSize(Math.max(8, numberOrFallback(element.fontSize, 24) * scale));
        doc.text(String(element.text || ''), x, y, {
          width,
          height,
          align: element.textAlign || 'left',
        });
        doc.restore();
        continue;
      }

      if (element.type === 'action') {
        drawActionElement(doc, element, { x, y, width, height, scale });
        continue;
      }

      if (element.type === 'lottie') {
        drawLottieFallback(doc, {
          x,
          y,
          width,
          height,
          sourceUrl: resolveLottieSourceUrl(element.lottieSource),
        });
      }
    }

    if (showAnimationLegend) {
      drawLottieLegend(doc, {
        pageWidth,
        pageHeight,
        items: collectLottieLegendItems(orderedElements),
      });
    }

    doc.end();
  });

  for (const element of Array.isArray(resolvedLayout.elements) ? resolvedLayout.elements : []) {
    if (!element || element.type !== 'image') continue;
    const src = String(element.src || element.imageUrl || '').trim();
    if (!src) continue;

    if (!imageCache.has(src)) {
      try {
        imageCache.set(src, await fetchImageBuffer(src));
      } catch (_error) {
        imageCache.set(src, null);
      }
    }
  }

  const finalBuffer = await new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({ size: [pageWidth, pageHeight], margin: 0 });

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.rect(0, 0, pageWidth, pageHeight).fill(String(resolvedLayout.backgroundColor || '#ffffff'));

    const orderedElements = Array.isArray(resolvedLayout.elements)
      ? resolvedLayout.elements.slice().sort((a, b) => numberOrFallback(a?.z, 0) - numberOrFallback(b?.z, 0))
      : [];

    for (const element of orderedElements) {
      if (!element || typeof element !== 'object') continue;

      const x = numberOrFallback(element.x, 0) * scale;
      const y = numberOrFallback(element.y, 0) * scale;
      const width = Math.max(1, numberOrFallback(element.width, 120) * scale);
      const height = Math.max(1, numberOrFallback(element.height, 60) * scale);

      if (element.type === 'shape') {
        const radius = Math.max(0, numberOrFallback(element.borderRadius, 0) * scale);
        const fillColor = String(element.fillColor || '#f3f4f6');
        const strokeColor = String(element.strokeColor || '');
        const strokeWidth = Math.max(0, numberOrFallback(element.strokeWidth, 0) * scale);
        doc.save();
        if (radius > 0) {
          doc.roundedRect(x, y, width, height, radius);
        } else {
          doc.rect(x, y, width, height);
        }
        if (strokeWidth > 0) {
          doc.lineWidth(strokeWidth);
          doc.fillAndStroke(fillColor, strokeColor || fillColor);
        } else {
          doc.fill(fillColor);
        }
        doc.restore();
        continue;
      }

      if (element.type === 'divider') {
        doc.save();
        doc.lineWidth(Math.max(1, numberOrFallback(element.thickness, 2) * scale));
        doc.strokeColor(String(element.color || '#b45309'));
        if (element.orientation === 'vertical') {
          doc.moveTo(x + width / 2, y).lineTo(x + width / 2, y + height).stroke();
        } else {
          doc.moveTo(x, y + height / 2).lineTo(x + width, y + height / 2).stroke();
        }
        doc.restore();
        continue;
      }

      if (element.type === 'image') {
        const src = String(element.src || element.imageUrl || '').trim();
        const imageBuffer = imageCache.get(src);
        if (imageBuffer) {
          doc.save();
          const objectFit = String(element.objectFit || 'cover');
          if (objectFit === 'contain') {
            doc.image(imageBuffer, x, y, { fit: [width, height], align: 'center', valign: 'center' });
          } else if (objectFit === 'fill') {
            doc.image(imageBuffer, x, y, { width, height });
          } else {
            doc.image(imageBuffer, x, y, { cover: [width, height], align: 'center', valign: 'center' });
          }
          doc.restore();
        }
        continue;
      }

      if (element.type === 'text') {
        doc.save();
        doc.fillColor(String(element.color || '#111827'));
        doc.font(element.fontWeight === 'bold' || element.fontWeight === '700' ? 'Helvetica-Bold' : 'Helvetica');
        doc.fontSize(Math.max(8, numberOrFallback(element.fontSize, 24) * scale));
        doc.text(String(element.text || ''), x, y, {
          width,
          height,
          align: element.textAlign || 'left',
        });
        doc.restore();
        continue;
      }

      if (element.type === 'action') {
        drawActionElement(doc, element, { x, y, width, height, scale });
        continue;
      }

      if (element.type === 'lottie') {
        drawLottieFallback(doc, {
          x,
          y,
          width,
          height,
          sourceUrl: resolveLottieSourceUrl(element.lottieSource),
        });
      }
    }

    if (showAnimationLegend) {
      drawLottieLegend(doc, {
        pageWidth,
        pageHeight,
        items: collectLottieLegendItems(orderedElements),
      });
    }

    doc.end();
  });

  return {
    pdfBuffer: finalBuffer || pdfBuffer,
    resolvedLayout,
    inviteMessage: deriveInviteMessage({ guest, event, resolvedLayout, fallbackMessage }),
  };
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

// GET /api/invites/designs/library
exports.listInviteDesignLibrary = asyncHandler(async (req, res) => {
  if (!(await ensureInviteDesignTablesReady(res))) return;

  const eventFilter = req.user.role === 'admin' ? {} : { organizerId: req.user.id };
  const manageableEvents = await prisma.event.findMany({
    where: eventFilter,
    select: { id: true, title: true, type: true, venue: true, organizerId: true },
  });

  if (!manageableEvents.length) {
    return res.json({ designs: [], events: [] });
  }

  const eventMap = new Map(manageableEvents.map((event) => [event.id, event]));
  const eventIds = manageableEvents.map((event) => event.id);

  const status = req.query.status ? String(req.query.status).toLowerCase() : null;
  const allowedStatuses = new Set(['draft', 'published', 'archived']);
  const where = {
    eventId: { in: eventIds },
    ...(status && allowedStatuses.has(status) ? { status } : {}),
  };

  const designs = await prisma.inviteDesign.findMany({
    where,
    orderBy: [{ updatedAt: 'desc' }],
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

  const withEvent = designs.map((design) => ({
    ...design,
    event: eventMap.get(design.eventId) || null,
  }));

  res.json({ designs: withEvent, events: manageableEvents });
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
    include: { event: { select: { id: true, organizerId: true, title: true, venue: true, date: true, slug: true, type: true, city: true } } },
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
    const clientBaseUrl = resolveClientBaseUrl(req);
    const publicEventUrl = design.event?.slug ? `${String(clientBaseUrl || '').replace(/\/$/, '')}/public/${design.event.slug}` : '';
    const { pdfBuffer } = await buildRenderedDesignPdfBuffer({
      design,
      event: design.event,
      layoutOverrides: mergeActionLinksIntoOverrides({
        overrides: {},
        rsvpLink: publicEventUrl,
        mapLink: buildMapUrl(design.event),
        liveStreamUrl: req.body.liveStreamUrl,
      }),
    });
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
  if (!['none', 'email', 'whatsapp', 'both'].includes(sendVia)) {
    return res.status(400).json({ message: 'sendVia must be none, email, whatsapp, or both' });
  }

  const design = await prisma.inviteDesign.findUnique({
    where: { id: designId },
    include: {
      event: {
        select: { id: true, organizerId: true, title: true, date: true, venue: true, slug: true, type: true, city: true },
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

      const resolvedInviteToken = generated.inviteToken || guest.inviteToken || crypto.randomBytes(16).toString('hex');
      const inviteUrl = generated.inviteUrl || buildInviteUrl({
        clientBaseUrl,
        event: design.event,
        guest,
        inviteToken: resolvedInviteToken,
      });
      const actionLayoutOverrides = mergeActionLinksIntoOverrides({
        overrides: guest.personalizedLayoutOverrides,
        rsvpLink: inviteUrl,
        mapLink: buildMapUrl(design.event),
        liveStreamUrl: req.body.liveStreamUrl,
      });

      const { pdfBuffer, inviteMessage } = await buildRenderedDesignPdfBuffer({
        design,
        event: design.event,
        guest,
        layoutOverrides: actionLayoutOverrides,
        fallbackMessage: generated.inviteMessage,
      });

      const personalizedPdfKey = `invites/design-exports/event-${design.eventId}/design-${design.id}/guest-${guest.id}-${Date.now()}.pdf`;
      const personalizedPdfUrl = await uploadBufferToR2({
        buffer: pdfBuffer,
        key: personalizedPdfKey,
        contentType: 'application/pdf',
      });

      const qrCodeDataUrl = generated.qrCodeDataUrl || (inviteUrl ? await QRCode.toDataURL(inviteUrl) : null);

      await prisma.guest.update({
        where: { id: guest.id },
        data: {
          inviteDesignId: designId,
          inviteTone: generated.inviteTone,
          inviteLanguage: generated.inviteLanguage,
          inviteTemplateKey: generated.inviteTemplateKey,
          personalizedInviteMessage: inviteMessage,
          personalizedInvitePdfUrl: personalizedPdfUrl,
          personalizedInvitePdfKey: personalizedPdfKey,
          inviteToken: resolvedInviteToken,
          invitationGeneratedAt: new Date(),
          qrCode: qrCodeDataUrl,
        },
      });

      const sent = { email: false, whatsapp: false };
      if ((sendVia === 'email' || sendVia === 'both') && guest.email) {
        sent.email = await sendInviteLink({
          to: guest.email,
          channel: 'email',
          guestName: guest.name,
          eventTitle: design.event.title,
          inviteUrl,
          inviteMessage,
        });
      }
      if ((sendVia === 'whatsapp' || sendVia === 'both') && guest.phone) {
        sent.whatsapp = await sendInviteLink({
          to: guest.phone,
          channel: 'whatsapp',
          guestName: guest.name,
          eventTitle: design.event.title,
          inviteUrl,
          inviteMessage,
        });
      }

      successes.push({
        guestId: guest.id,
        name: guest.name,
        email: guest.email,
        phone: guest.phone,
        inviteUrl,
        pdfUrl: personalizedPdfUrl,
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
