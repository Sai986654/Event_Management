const escapeSvg = (svg) => encodeURIComponent(svg).replace(/%0A/g, '').replace(/%20/g, ' ');

const svgToDataUri = (svg) => `data:image/svg+xml;utf8,${escapeSvg(svg)}`;

const CARTOON_BRIDE_GROOM = svgToDataUri(`
<svg xmlns='http://www.w3.org/2000/svg' width='420' height='420' viewBox='0 0 420 420'>
  <rect width='420' height='420' rx='32' fill='#fff7ed'/>
  <circle cx='150' cy='160' r='58' fill='#f8c9a2'/>
  <circle cx='270' cy='160' r='58' fill='#f3bf95'/>
  <path d='M98 238c10-40 92-40 104 0v98H98z' fill='#fde7f3'/>
  <path d='M218 238c10-40 92-40 104 0v98H218z' fill='#e5f0ff'/>
  <circle cx='132' cy='150' r='6' fill='#1f2937'/><circle cx='168' cy='150' r='6' fill='#1f2937'/>
  <circle cx='252' cy='150' r='6' fill='#1f2937'/><circle cx='288' cy='150' r='6' fill='#1f2937'/>
  <path d='M138 176c8 12 22 12 30 0' stroke='#9a3412' stroke-width='4' fill='none' stroke-linecap='round'/>
  <path d='M258 176c8 12 22 12 30 0' stroke='#9a3412' stroke-width='4' fill='none' stroke-linecap='round'/>
  <path d='M108 113c12-26 62-36 86-8' stroke='#111827' stroke-width='14' fill='none' stroke-linecap='round'/>
  <path d='M226 118c8-24 58-34 82-10' stroke='#111827' stroke-width='14' fill='none' stroke-linecap='round'/>
  <circle cx='95' cy='110' r='8' fill='#f59e0b'/><circle cx='205' cy='110' r='8' fill='#f59e0b'/>
  <text x='210' y='356' text-anchor='middle' font-family='Arial' font-size='34' font-weight='700' fill='#7c2d12'>Bride & Groom</text>
</svg>
`);

const CARTOON_BIRTHDAY_BOY = svgToDataUri(`
<svg xmlns='http://www.w3.org/2000/svg' width='420' height='420' viewBox='0 0 420 420'>
  <rect width='420' height='420' rx='32' fill='#eef2ff'/>
  <circle cx='210' cy='150' r='64' fill='#f6c29d'/>
  <path d='M146 235c18-34 110-34 128 0v106H146z' fill='#93c5fd'/>
  <circle cx='188' cy='148' r='7' fill='#1f2937'/><circle cx='232' cy='148' r='7' fill='#1f2937'/>
  <path d='M190 182c10 10 30 10 40 0' stroke='#7c2d12' stroke-width='4' fill='none' stroke-linecap='round'/>
  <path d='M150 110c18-36 108-46 124-8' stroke='#1f2937' stroke-width='14' fill='none' stroke-linecap='round'/>
  <polygon points='210,52 188,96 232,96' fill='#f59e0b'/>
  <circle cx='104' cy='98' r='18' fill='#f472b6'/><circle cx='314' cy='94' r='18' fill='#34d399'/><circle cx='324' cy='128' r='14' fill='#fbbf24'/>
  <line x1='104' y1='118' x2='104' y2='170' stroke='#64748b' stroke-width='2'/>
  <line x1='314' y1='112' x2='314' y2='170' stroke='#64748b' stroke-width='2'/>
  <line x1='324' y1='142' x2='324' y2='175' stroke='#64748b' stroke-width='2'/>
  <text x='210' y='364' text-anchor='middle' font-family='Arial' font-size='34' font-weight='700' fill='#1e3a8a'>Birthday Star</text>
</svg>
`);

const CARTOON_CAKE = svgToDataUri(`
<svg xmlns='http://www.w3.org/2000/svg' width='360' height='280' viewBox='0 0 360 280'>
  <rect width='360' height='280' rx='26' fill='#fff1f2'/>
  <rect x='70' y='130' width='220' height='90' rx='16' fill='#fecdd3'/>
  <rect x='90' y='94' width='180' height='54' rx='14' fill='#fda4af'/>
  <rect x='175' y='56' width='12' height='42' rx='5' fill='#f59e0b'/>
  <path d='M181 42c12 8 12 20 0 26c-12-6-12-18 0-26z' fill='#fb7185'/>
  <circle cx='120' cy='164' r='8' fill='#fb7185'/><circle cx='168' cy='182' r='8' fill='#fb7185'/><circle cx='216' cy='164' r='8' fill='#fb7185'/><circle cx='250' cy='188' r='8' fill='#fb7185'/>
  <text x='180' y='252' text-anchor='middle' font-family='Arial' font-size='28' font-weight='700' fill='#9f1239'>Celebration Cake</text>
</svg>
`);

export const STICKER_ASSETS = [
  { key: 'emoji-heart', label: 'Hearts', type: 'emoji', text: '💖✨', width: 220, height: 90, fontSize: 60 },
  { key: 'emoji-rings', label: 'Rings', type: 'emoji', text: '💍💐', width: 220, height: 90, fontSize: 56 },
  { key: 'emoji-party', label: 'Party', type: 'emoji', text: '🎉🎂', width: 220, height: 90, fontSize: 56 },
  { key: 'emoji-stars', label: 'Stars', type: 'emoji', text: '🌟🎊', width: 220, height: 90, fontSize: 56 },
  { key: 'cartoon-bride-groom', label: 'Bride & Groom', type: 'image', imageUrl: CARTOON_BRIDE_GROOM, width: 320, height: 320 },
  { key: 'cartoon-birthday-boy', label: 'Birthday Boy', type: 'image', imageUrl: CARTOON_BIRTHDAY_BOY, width: 320, height: 320 },
  { key: 'cartoon-cake', label: 'Cake', type: 'image', imageUrl: CARTOON_CAKE, width: 280, height: 210 },
];

const formatEventDate = (dateValue) => {
  if (!dateValue) return 'Save the date';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return 'Save the date';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const buildBaseTextElements = ({ title, subtitle, dateText, venueText, palette }) => [
  {
    id: `title-${Date.now()}-1`,
    type: 'text',
    x: 90,
    y: 180,
    width: 900,
    height: 120,
    z: 10,
    text: title,
    fontSize: 62,
    color: palette.title,
    textAlign: 'center',
    fontWeight: '700',
  },
  {
    id: `subtitle-${Date.now()}-2`,
    type: 'text',
    x: 120,
    y: 300,
    width: 840,
    height: 90,
    z: 11,
    text: subtitle,
    fontSize: 38,
    color: palette.subtitle,
    textAlign: 'center',
    fontWeight: '700',
  },
  {
    id: `date-${Date.now()}-3`,
    type: 'text',
    x: 130,
    y: 1360,
    width: 820,
    height: 80,
    z: 13,
    text: `📅 ${dateText}`,
    fontSize: 34,
    color: palette.body,
    textAlign: 'center',
    fontWeight: '700',
  },
  {
    id: `venue-${Date.now()}-4`,
    type: 'text',
    x: 120,
    y: 1440,
    width: 840,
    height: 100,
    z: 14,
    text: `📍 ${venueText}`,
    fontSize: 30,
    color: palette.body,
    textAlign: 'center',
    fontWeight: '400',
  },
];

const THEMES = {
  scratch: {
    backgroundColor: '#ffffff',
    title: '#111827',
    subtitle: '#334155',
    body: '#475569',
    accent: '#6366f1',
    panel: '#eef2ff',
  },
  'royal-maroon': {
    backgroundColor: '#fff7f2',
    title: '#7c2d12',
    subtitle: '#9a3412',
    body: '#3f3f46',
    accent: '#b45309',
    panel: '#fef3c7',
  },
  'golden-lotus': {
    backgroundColor: '#fffbeb',
    title: '#92400e',
    subtitle: '#b45309',
    body: '#44403c',
    accent: '#f59e0b',
    panel: '#fde68a',
  },
  'birthday-spark': {
    backgroundColor: '#eef2ff',
    title: '#1d4ed8',
    subtitle: '#4338ca',
    body: '#334155',
    accent: '#f97316',
    panel: '#dbeafe',
  },
};

export const OCCASION_PACKS = [
  {
    key: 'wedding-royal',
    name: 'Royal Wedding',
    description: 'Traditional wedding aesthetic with warm maroon and gold accents.',
    palette: THEMES['royal-maroon'],
    defaultTemplateKey: 'royal-maroon',
    emojiLine: '💍💐❤️',
    stickerKey: 'cartoon-bride-groom',
    subtitle: 'Together with our families, we invite you to celebrate our union',
  },
  {
    key: 'birthday-spark',
    name: 'Birthday Spark',
    description: 'Playful birthday look with cool blues, orange confetti, and fun stickers.',
    palette: THEMES['birthday-spark'],
    defaultTemplateKey: 'golden-lotus',
    emojiLine: '🎉🎂🎈',
    stickerKey: 'cartoon-birthday-boy',
    subtitle: 'Join us for laughter, cake, and unforgettable memories',
  },
  {
    key: 'engagement-blush',
    name: 'Engagement Blush',
    description: 'Soft blush palette with romantic sparkles for engagement invites.',
    palette: {
      backgroundColor: '#fff1f2',
      title: '#9d174d',
      subtitle: '#be185d',
      body: '#4b5563',
      accent: '#ec4899',
      panel: '#ffe4e6',
    },
    defaultTemplateKey: 'royal-maroon',
    emojiLine: '💖✨🥂',
    stickerKey: 'emoji-rings',
    subtitle: 'Celebrate the beginning of our forever story',
  },
  {
    key: 'baby-shower-joy',
    name: 'Baby Shower Joy',
    description: 'Gentle pastel style tailored for baby shower celebrations.',
    palette: {
      backgroundColor: '#f0f9ff',
      title: '#0369a1',
      subtitle: '#0284c7',
      body: '#334155',
      accent: '#22c55e',
      panel: '#e0f2fe',
    },
    defaultTemplateKey: 'golden-lotus',
    emojiLine: '🍼👶🎀',
    stickerKey: 'emoji-stars',
    subtitle: 'We are overjoyed to welcome a little miracle soon',
  },
];

const updateElementTypography = (element, palette, subtitleText) => {
  if (element.type !== 'text') return element;

  const text = String(element.text || '');
  let color = element.color;

  if (/^📅|^📍/.test(text)) color = palette.body;
  if (/invite|celebrate|together|wedding|birthday|engagement|baby/i.test(text) && !/^📅|^📍/.test(text)) {
    color = palette.subtitle;
  }

  if (text === 'Join us for a joyful birthday celebration' || text === 'With joy in our hearts, we invite you to celebrate with us') {
    return {
      ...element,
      text: subtitleText,
      color: palette.subtitle,
    };
  }

  if (/💍|🎉|💖|🍼|👶|✨|🎂/.test(text)) {
    return {
      ...element,
      text,
      color: palette.accent,
    };
  }

  return {
    ...element,
    color: color || palette.title,
  };
};

export const applyOccasionPackToLayout = ({ layout, packKey, event }) => {
  const pack = OCCASION_PACKS.find((item) => item.key === packKey) || OCCASION_PACKS[0];
  const baseLayout = layout && typeof layout === 'object' ? layout : {};
  const existingElements = Array.isArray(baseLayout.elements) ? baseLayout.elements : [];

  const palette = pack.palette;
  const titleText = String(event?.title || 'You are invited').trim();

  const nextElements = existingElements.map((element, idx) => {
    let next = { ...element };

    if (next.type === 'shape' && idx === 0) {
      next.fillColor = palette.panel;
    }

    if (next.type === 'text' && idx === 1) {
      next.text = pack.emojiLine;
      next.color = palette.accent;
    }

    if (next.type === 'text' && idx === 2) {
      next.text = titleText;
      next.color = palette.title;
    }

    next = updateElementTypography(next, palette, pack.subtitle);
    return next;
  });

  const hasPrimarySticker = nextElements.some((element) => element.type === 'image' && element.imageUrl);
  if (!hasPrimarySticker) {
    const sticker = STICKER_ASSETS.find((item) => item.key === pack.stickerKey);
    if (sticker) {
      nextElements.push({
        id: `pack-sticker-${Date.now()}-1`,
        type: sticker.type === 'emoji' ? 'text' : 'image',
        x: 380,
        y: 540,
        width: sticker.width || 300,
        height: sticker.height || 280,
        z: nextElements.length + 1,
        ...(sticker.type === 'emoji'
          ? {
              text: sticker.text || '✨',
              fontSize: sticker.fontSize || 54,
              color: palette.accent,
              textAlign: 'center',
              fontWeight: '700',
            }
          : {
              imageUrl: sticker.imageUrl || '',
            }),
      });
    }
  }

  return {
    ...baseLayout,
    templateKey: pack.defaultTemplateKey || baseLayout.templateKey || null,
    backgroundColor: palette.backgroundColor,
    elements: nextElements,
    occasionPackKey: pack.key,
  };
};

export const autoBeautifyLayout = (layout) => {
  const baseLayout = layout && typeof layout === 'object' ? layout : {};
  const elements = Array.isArray(baseLayout.elements) ? baseLayout.elements.slice() : [];
  if (!elements.length) return baseLayout;

  const textElements = elements.filter((element) => element.type === 'text');
  const imageElements = elements.filter((element) => element.type === 'image');
  const shapeElements = elements.filter((element) => element.type === 'shape');

  const centerX = 540;

  const next = elements.map((element, idx) => {
    const width = Number(element.width) || 320;
    const isText = element.type === 'text';
    const isImage = element.type === 'image';
    const isShape = element.type === 'shape';
    const nextElement = { ...element, z: idx + 1 };

    if (isShape && idx === 0) {
      nextElement.x = 56;
      nextElement.y = 116;
      nextElement.width = 968;
      nextElement.height = 1640;
      nextElement.borderRadius = Number(nextElement.borderRadius) || 32;
      return nextElement;
    }

    if (isText) {
      nextElement.x = Math.max(40, Math.round(centerX - width / 2));
      nextElement.textAlign = 'center';
      if (!nextElement.fontSize) nextElement.fontSize = 34;
    }

    if (isImage) {
      nextElement.x = Math.max(30, Math.round(centerX - width / 2));
      if (!nextElement.height) nextElement.height = width;
    }

    return nextElement;
  });

  const sortedText = textElements
    .map((element) => next.find((item) => item.id === element.id))
    .filter(Boolean)
    .sort((a, b) => (Number(a.y) || 0) - (Number(b.y) || 0));

  let cursorY = 170;
  sortedText.forEach((element, index) => {
    const lineHeight = Math.max(72, Number(element.height) || 88);
    element.y = cursorY;
    if (index === 0) element.fontSize = Math.max(52, Number(element.fontSize) || 52);
    if (index === 1) element.fontSize = Math.max(34, Number(element.fontSize) || 34);
    cursorY += lineHeight + 18;
  });

  imageElements
    .map((element) => next.find((item) => item.id === element.id))
    .filter(Boolean)
    .forEach((element, idx) => {
      element.y = 520 + idx * 280;
    });

  return {
    ...baseLayout,
    elements: next,
  };
};

export const buildInviteStarterLayout = ({
  templateKey,
  event,
  mode = 'template',
}) => {
  const effectiveTemplateKey = mode === 'scratch' ? 'scratch' : (templateKey || 'royal-maroon');
  const palette = THEMES[effectiveTemplateKey] || THEMES['royal-maroon'];

  const eventTitle = String(event?.title || 'You are invited').trim();
  const eventType = String(event?.type || '').toLowerCase();
  const dateText = formatEventDate(event?.date);
  const venueText = String(event?.venue || event?.location || 'Venue to be announced').trim();

  const isBirthday = eventType.includes('birthday');

  const heroSticker = isBirthday
    ? STICKER_ASSETS.find((item) => item.key === 'cartoon-birthday-boy')
    : STICKER_ASSETS.find((item) => item.key === 'cartoon-bride-groom');

  const accentEmoji = isBirthday ? '🎉🎂🎁' : '💍💐❤️';

  const subtitle = isBirthday ? 'Join us for a joyful birthday celebration' : 'With joy in our hearts, we invite you to celebrate with us';

  const elements = [
    {
      id: `panel-${Date.now()}-0`,
      type: 'shape',
      x: 56,
      y: 116,
      width: 968,
      height: 1640,
      z: 1,
      fillColor: palette.panel,
      borderRadius: 36,
    },
    {
      id: `emoji-${Date.now()}-5`,
      type: 'text',
      x: 220,
      y: 88,
      width: 640,
      height: 80,
      z: 2,
      text: accentEmoji,
      fontSize: 50,
      color: palette.accent,
      textAlign: 'center',
      fontWeight: '700',
    },
    ...buildBaseTextElements({
      title: eventTitle,
      subtitle,
      dateText,
      venueText,
      palette,
    }),
    {
      id: `hero-${Date.now()}-6`,
      type: 'image',
      x: 380,
      y: 520,
      width: isBirthday ? 320 : 320,
      height: isBirthday ? 320 : 320,
      z: 12,
      imageUrl: heroSticker?.imageUrl || '',
    },
    {
      id: `footer-${Date.now()}-7`,
      type: 'text',
      x: 176,
      y: 1580,
      width: 728,
      height: 72,
      z: 15,
      text: 'Please join us and bless the celebration ✨',
      fontSize: 30,
      color: palette.subtitle,
      textAlign: 'center',
      fontWeight: '700',
    },
  ];

  if (mode === 'scratch') {
    return {
      templateKey: null,
      canvasSize: '1080x1920',
      backgroundColor: palette.backgroundColor,
      elements: [
        {
          id: `scratch-title-${Date.now()}-1`,
          type: 'text',
          x: 120,
          y: 280,
          width: 840,
          height: 120,
          z: 1,
          text: 'Start Designing Your Invite ✨',
          fontSize: 56,
          color: '#1e293b',
          textAlign: 'center',
          fontWeight: '700',
        },
      ],
    };
  }

  return {
    templateKey: effectiveTemplateKey,
    canvasSize: '1080x1920',
    backgroundColor: palette.backgroundColor,
    elements,
  };
};
