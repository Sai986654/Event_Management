const REQUIRED_COMPONENT_TYPES = [
  'GuestHeader',
  'GuestBadge',
  'CoupleHero',
  'PersonalMessage',
  'RSVPSection',
  'QRPass',
  'FamilyConnection',
  'SmartRecommendations',
  'FooterMessage',
];

const coerceObject = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : {});

const deepResolve = (value, context) => {
  if (typeof value === 'string') {
    return value.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, token) => {
      const resolved = String(token)
        .split('.')
        .reduce((acc, segment) => (acc && acc[segment] !== undefined ? acc[segment] : undefined), context);
      return resolved === undefined || resolved === null ? '' : String(resolved);
    });
  }

  if (Array.isArray(value)) {
    return value.map((entry) => deepResolve(entry, context));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, deepResolve(entry, context)]));
  }

  return value;
};

const normalizeSections = (config) => {
  const layout = coerceObject(config.layout);
  if (Array.isArray(layout.sections)) return layout.sections;
  if (Array.isArray(config.components)) {
    return config.components.map((component, index) => ({
      id: component.id || `component_${index + 1}`,
      componentType: component.componentType || component.type || 'Generic',
      order: Number.isFinite(Number(component.order)) ? Number(component.order) : index,
      visible: component.visible !== false,
      props: coerceObject(component.props || component),
      bindings: coerceObject(component.bindings),
      style: coerceObject(component.style),
    }));
  }
  return [];
};

const applyVisibility = (sections, visibilityMap, includeHidden) => {
  const visibility = coerceObject(visibilityMap);
  const withFlags = sections.map((section) => {
    const typeKey = String(section.componentType || section.type || '').trim();
    const explicitVisible = section.visible !== false;
    const visibilityOverride = visibility[typeKey];
    const visible = visibilityOverride === undefined ? explicitVisible : Boolean(visibilityOverride);
    return {
      ...section,
      visible,
    };
  });

  return includeHidden ? withFlags : withFlags.filter((section) => section.visible !== false);
};

const ensureRequiredComponents = (sections) => {
  const set = new Set(
    sections
      .map((section) => String(section.componentType || section.type || '').trim())
      .filter(Boolean)
  );

  const missing = REQUIRED_COMPONENT_TYPES.filter((type) => !set.has(type));
  return { hasAllRequired: missing.length === 0, missingComponents: missing };
};

const buildMergeContext = ({ guestData, eventData }) => {
  const guest = coerceObject(guestData);
  const event = coerceObject(eventData);

  return {
    guest,
    event,
    guestName: guest.name || guest.guestName || '',
    guestCategory: guest.guestCategory || guest.category || 'Guest',
    guestCount: guest.guestCount || guest.plusOnes || 1,
    relation: guest.relationship || guest.relation || '',
    qrData: guest.qrData || guest.qrCode || '',
    invitationMessage: guest.invitationMessage || event.invitationMessage || '',
    coupleNames: event.coupleNames || `${event.brideName || ''}${event.brideName && event.groomName ? ' & ' : ''}${event.groomName || ''}`,
  };
};

const renderTemplate = ({ templateConfig, guestData = {}, eventData = {}, includeHidden = false }) => {
  const config = coerceObject(templateConfig);
  const metadata = coerceObject(config.metadata);
  const canvas = coerceObject(config.canvas);
  const palette = coerceObject(config.palette);
  const typography = coerceObject(config.typography);
  const visibility = coerceObject(config.componentVisibility || config.componentVisibilityJson);
  const backgroundAssets = Array.isArray(config.backgroundAssets) ? config.backgroundAssets : [];
  const decorativeAssets = Array.isArray(config.decorativeAssets || config.decorations)
    ? config.decorativeAssets || config.decorations
    : [];

  const mergeContext = buildMergeContext({ guestData, eventData });
  const sections = normalizeSections(config)
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));

  const visibleSections = applyVisibility(sections, visibility, includeHidden).map((section) => ({
    ...section,
    props: deepResolve(coerceObject(section.props), mergeContext),
    bindings: deepResolve(coerceObject(section.bindings), mergeContext),
    style: deepResolve(coerceObject(section.style), mergeContext),
  }));

  const requiredValidation = ensureRequiredComponents(sections);

  return {
    metadata,
    canvas,
    palette,
    typography,
    backgroundAssets,
    decorativeAssets,
    sections: visibleSections,
    mergeContext,
    requiredValidation,
    renderedAt: new Date().toISOString(),
  };
};

module.exports = {
  REQUIRED_COMPONENT_TYPES,
  renderTemplate,
};
