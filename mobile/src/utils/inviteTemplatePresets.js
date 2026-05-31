export const STICKER_ASSETS = [
  { key: 'emoji-heart', label: 'Hearts', thumb: '💖', type: 'emoji', text: '💖✨', width: 220, height: 90, fontSize: 60 },
  { key: 'emoji-rings', label: 'Rings', thumb: '💍', type: 'emoji', text: '💍💐', width: 220, height: 90, fontSize: 56 },
  { key: 'emoji-party', label: 'Party', thumb: '🎉', type: 'emoji', text: '🎉🎂', width: 220, height: 90, fontSize: 56 },
  { key: 'emoji-stars', label: 'Stars', thumb: '🌟', type: 'emoji', text: '🌟🎊', width: 220, height: 90, fontSize: 56 },
  { key: 'cartoon-bride-groom', label: 'Bride & Groom', thumb: '💒', type: 'emoji', text: '💒\n👰🤵\n💍💐', width: 300, height: 220, fontSize: 52 },
  { key: 'cartoon-birthday-boy', label: 'Birthday Boy', thumb: '🎂', type: 'emoji', text: '🎂\n🎉👦🌟\n🎈🎁', width: 300, height: 220, fontSize: 52 },
  { key: 'cartoon-cake', label: 'Cake', thumb: '🍰', type: 'emoji', text: '🎂🍰\n🎊✨', width: 260, height: 180, fontSize: 56 },
];

// ── Lottie animated cartoon stickers ──
// Free animations from LottieFiles CDN. Find more at lottiefiles.com → right-click → copy JSON link
export const LOTTIE_STICKERS = [
  {
    key: 'lottie-confetti',
    label: 'Confetti',
    thumb: '🎊',
    source: { uri: 'https://assets1.lottiefiles.com/packages/lf20_jcikwtux.json' },
    category: 'festive',
    width: 400,
    height: 400,
    loop: true,
  },
  {
    key: 'lottie-birthday',
    label: 'Birthday',
    thumb: '🎂',
    source: { uri: 'https://assets4.lottiefiles.com/packages/lf20_49rdyysj.json' },
    category: 'celebration',
    width: 380,
    height: 380,
    loop: true,
  },
  {
    key: 'lottie-hearts',
    label: 'Hearts',
    thumb: '❤️',
    source: { uri: 'https://assets5.lottiefiles.com/packages/lf20_ydo1amjm.json' },
    category: 'romantic',
    width: 360,
    height: 360,
    loop: true,
  },
  {
    key: 'lottie-fireworks',
    label: 'Fireworks',
    thumb: '🎆',
    source: { uri: 'https://assets9.lottiefiles.com/packages/lf20_M9p23l.json' },
    category: 'festive',
    width: 420,
    height: 420,
    loop: false,
  },
  {
    key: 'lottie-stars',
    label: 'Stars',
    thumb: '⭐',
    source: { uri: 'https://assets6.lottiefiles.com/packages/lf20_aZTdD5.json' },
    category: 'festive',
    width: 360,
    height: 360,
    loop: true,
  },
  {
    key: 'lottie-wedding',
    label: 'Wedding',
    thumb: '💍',
    source: { uri: 'https://assets6.lottiefiles.com/packages/lf20_kkflmtur.json' },
    category: 'wedding',
    width: 400,
    height: 400,
    loop: true,
  },
  {
    key: 'lottie-balloons',
    label: 'Balloons',
    thumb: '🎈',
    source: { uri: 'https://assets10.lottiefiles.com/packages/lf20_touohxv0.json' },
    category: 'celebration',
    width: 380,
    height: 400,
    loop: true,
  },
  {
    key: 'lottie-celebration',
    label: 'Celebrate',
    thumb: '🥳',
    source: { uri: 'https://assets7.lottiefiles.com/packages/lf20_2cwDXD.json' },
    category: 'celebration',
    width: 400,
    height: 400,
    loop: true,
  },
  {
    key: 'lottie-sparkles',
    label: 'Sparkles',
    thumb: '✨',
    source: { uri: 'https://assets8.lottiefiles.com/packages/lf20_49rdyysj.json' },
    category: 'romantic',
    width: 360,
    height: 360,
    loop: true,
  },
  {
    key: 'lottie-party',
    label: 'Party',
    thumb: '🎉',
    source: { uri: 'https://assets9.lottiefiles.com/packages/lf20_jcikwtux.json' },
    category: 'festive',
    width: 380,
    height: 380,
    loop: true,
  },
  {
    key: 'lottie-stars-plus',
    label: 'Stars+',
    thumb: '🌟',
    source: { uri: 'https://assets10.lottiefiles.com/packages/lf20_ydo1amjm.json' },
    category: 'wedding',
    width: 360,
    height: 360,
    loop: true,
  },
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
    accent: '#B9942A',
    panel: '#fff8e9',
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
    backgroundColor: '#fff8ea',
    title: '#7c2d12',
    subtitle: '#9a3412',
    body: '#4b5563',
    accent: '#f97316',
    panel: '#fde7c2',
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
    description: 'Playful birthday look with warm festive hues, orange confetti, and fun stickers.',
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

export const COLOR_THEMES = {
  'wedding-warm': { bg: '#fff7f2', text: '#7c2d12', shape: '#fcd4b5', divider: '#b45309', label: 'Wedding Warm 🌹' },
  'royal-gold': { bg: '#fffbeb', text: '#92400e', shape: '#fde68a', divider: '#d97706', label: 'Royal Gold ✨' },
  'birthday-pop': { bg: '#fff8ea', text: '#7c2d12', shape: '#f7d8a8', divider: '#f97316', label: 'Birthday Pop 🎉' },
  'pastel-baby': { bg: '#fff7f2', text: '#9a3412', shape: '#fbd5c1', divider: '#d97706', label: 'Pastel Baby 🍼' },
};

export const applyColorThemeToLayout = (layout, themeKey) => {
  const theme = COLOR_THEMES[themeKey];
  if (!theme) return layout;
  const baseLayout = layout && typeof layout === 'object' ? layout : {};
  return {
    ...baseLayout,
    backgroundColor: theme.bg,
    elements: (Array.isArray(baseLayout.elements) ? baseLayout.elements : []).map((el) => {
      if (el.type === 'text') return { ...el, color: theme.text };
      if (el.type === 'shape') return { ...el, fillColor: theme.shape };
      if (el.type === 'divider') return { ...el, color: theme.divider };
      return el;
    }),
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
