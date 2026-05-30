const { chatJson, getProvider } = require('./groqAiService');
const { REQUIRED_COMPONENT_TYPES } = require('./inviteTemplateRenderer');

const FUTURE_THEME_KEYS = [
  'telugu_royal',
  'konaseema',
  'tirumala',
  'luxury_gold',
  'traditional_village',
  'modern_minimal',
  'engagement',
  'housewarming',
  'birthday',
  'corporate_event',
];

const coerceObject = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : {});

const normalizeTemplateKey = (value = '') =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const createDefaultComponentVisibility = () =>
  REQUIRED_COMPONENT_TYPES.reduce((acc, type) => {
    acc[type] = true;
    return acc;
  }, {});

const createDefaultLayoutDefinition = () => {
  const sectionTemplate = [
    { id: 'guest_header', componentType: 'GuestHeader', order: 1 },
    { id: 'guest_badge', componentType: 'GuestBadge', order: 2 },
    { id: 'couple_hero', componentType: 'CoupleHero', order: 3 },
    { id: 'personal_message', componentType: 'PersonalMessage', order: 4 },
    { id: 'rsvp_section', componentType: 'RSVPSection', order: 5 },
    { id: 'qr_pass', componentType: 'QRPass', order: 6 },
    { id: 'family_connection', componentType: 'FamilyConnection', order: 7 },
    { id: 'smart_recommendations', componentType: 'SmartRecommendations', order: 8 },
    { id: 'footer_message', componentType: 'FooterMessage', order: 9 },
  ];

  return {
    sections: sectionTemplate.map((section) => ({
      ...section,
      visible: true,
      props: {},
      style: {},
      bindings: {},
    })),
  };
};

const normalizeConfigInput = (payload = {}) => {
  const data = coerceObject(payload);
  const metadata = coerceObject(data.metadata);
  const themeColors = coerceObject(data.themeColors || data.palette);
  const normalizedLayout = coerceObject(data.layoutDefinition || data.layout);
  const normalizedVisibility = coerceObject(data.componentVisibility);

  return {
    metadata,
    palette: themeColors,
    canvas: coerceObject(data.canvas),
    typography: coerceObject(data.typography),
    backgroundAssets: Array.isArray(data.backgroundAssets) ? data.backgroundAssets : [],
    decorativeAssets: Array.isArray(data.decorativeAssets || data.decorations)
      ? data.decorativeAssets || data.decorations
      : [],
    layout: Object.keys(normalizedLayout).length ? normalizedLayout : createDefaultLayoutDefinition(),
    components: Array.isArray(data.components)
      ? data.components
      : createDefaultLayoutDefinition().sections,
    componentVisibility: Object.keys(normalizedVisibility).length
      ? normalizedVisibility
      : createDefaultComponentVisibility(),
    ai: coerceObject(data.ai),
  };
};

const buildAiTemplateSystemPrompt = () => `
You are an invitation template architect for Vedika360.
Return strict JSON object only.
Use this exact output shape:
{
  "templateName": "string",
  "themeKey": "string from allowed values",
  "eventType": "wedding|engagement|housewarming|birthday|corporate|other",
  "colorPalette": {
    "primary": "#hex",
    "secondary": "#hex",
    "accent": "#hex",
    "background": "#hex",
    "surface": "#hex",
    "border": "#hex",
    "textPrimary": "#hex",
    "textSecondary": "#hex"
  },
  "layoutDefinition": {
    "sections": [
      {
        "id": "string",
        "componentType": "GuestHeader|GuestBadge|CoupleHero|PersonalMessage|RSVPSection|QRPass|FamilyConnection|SmartRecommendations|FooterMessage",
        "order": 1,
        "visible": true,
        "props": {},
        "bindings": {},
        "style": {}
      }
    ]
  },
  "imageGenerationPrompts": [
    { "assetId": "hero_primary", "style": "string", "prompt": "string", "aspectRatio": "4:5" }
  ],
  "componentConfiguration": {
    "visibility": {
      "GuestHeader": true,
      "GuestBadge": true,
      "CoupleHero": true,
      "PersonalMessage": true,
      "RSVPSection": true,
      "QRPass": true,
      "FamilyConnection": true,
      "SmartRecommendations": true,
      "FooterMessage": true
    }
  }
}
Allowed theme keys: ${FUTURE_THEME_KEYS.join(', ')}.
Always include all required component types at least once.
`;

const buildAiTemplateUserPrompt = ({ prompt, eventType }) => {
  return `Admin brief: ${String(prompt || '').trim()}\nEvent type hint: ${String(eventType || 'wedding').trim()}\nGenerate premium layered JSON template spec for Vedika360.`;
};

const fallbackAiTemplate = ({ prompt, eventType }) => {
  const now = Date.now();
  return {
    templateName: `AI ${eventType || 'event'} template ${now}`,
    themeKey: 'telugu_royal',
    eventType: eventType || 'wedding',
    colorPalette: {
      primary: '#6D4C2F',
      secondary: '#D4B37F',
      accent: '#C28A2E',
      background: '#F8F3E8',
      surface: '#FFFDF7',
      border: '#D9C39A',
      textPrimary: '#4B3621',
      textSecondary: '#6B5A45',
    },
    layoutDefinition: createDefaultLayoutDefinition(),
    imageGenerationPrompts: [
      {
        assetId: 'hero_primary',
        style: 'Royal Telugu Wedding',
        prompt: String(prompt || 'Premium Indian invitation hero artwork'),
        aspectRatio: '4:5',
      },
    ],
    componentConfiguration: {
      visibility: createDefaultComponentVisibility(),
    },
  };
};

const generateAiTemplateDefinition = async ({ prompt, eventType }) => {
  const systemPrompt = buildAiTemplateSystemPrompt();
  const userPrompt = buildAiTemplateUserPrompt({ prompt, eventType });
  const aiResponse = await chatJson(systemPrompt, userPrompt, { temperature: 0.5, maxTokens: 2500 });

  const payload = coerceObject(aiResponse);
  if (!payload.templateName || !payload.layoutDefinition || !payload.componentConfiguration) {
    return {
      generated: fallbackAiTemplate({ prompt, eventType }),
      provider: getProvider(),
      fallbackUsed: true,
    };
  }

  return {
    generated: payload,
    provider: getProvider(),
    fallbackUsed: false,
  };
};

module.exports = {
  FUTURE_THEME_KEYS,
  normalizeTemplateKey,
  normalizeConfigInput,
  createDefaultComponentVisibility,
  createDefaultLayoutDefinition,
  generateAiTemplateDefinition,
};
