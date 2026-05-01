const COMMON_PLACEHOLDERS = [
  { token: '{{guest.name}}', label: 'Guest Name' },
  { token: '{{guest.relationship}}', label: 'Guest Relationship' },
  { token: '{{event.title}}', label: 'Event Title' },
  { token: '{{event.dateText}}', label: 'Event Date' },
  { token: '{{event.timeText}}', label: 'Event Time' },
  { token: '{{event.venue}}', label: 'Venue' },
  { token: '{{event.city}}', label: 'City' },
];

const EVENT_CONFIG = {
  wedding: {
    label: 'Wedding',
    hostFields: [
      { key: 'brideName', label: 'Bride Name', placeholder: 'Ananya' },
      { key: 'groomName', label: 'Groom Name', placeholder: 'Arjun' },
      { key: 'brideParents', label: 'Bride Family / Parents', placeholder: 'Lakshmi & Ramesh' },
      { key: 'groomParents', label: 'Groom Family / Parents', placeholder: 'Sita & Madhav' },
      { key: 'blessingLine', label: 'Blessings Line', placeholder: 'With the blessings of our elders' },
    ],
    placeholders: [
      { token: '{{hosts.brideName}}', label: 'Bride Name' },
      { token: '{{hosts.groomName}}', label: 'Groom Name' },
      { token: '{{hosts.brideParents}}', label: 'Bride Family / Parents' },
      { token: '{{hosts.groomParents}}', label: 'Groom Family / Parents' },
      { token: '{{hosts.blessingLine}}', label: 'Blessings Line' },
    ],
  },
  birthday: {
    label: 'Birthday',
    hostFields: [
      { key: 'celebrantName', label: 'Celebrant Name', placeholder: 'Aadhya' },
      { key: 'parentNames', label: 'Parent / Host Names', placeholder: 'Priya & Kiran' },
      { key: 'blessingLine', label: 'Blessings Line', placeholder: 'Request your presence and blessings' },
    ],
    placeholders: [
      { token: '{{hosts.celebrantName}}', label: 'Celebrant Name' },
      { token: '{{hosts.parentNames}}', label: 'Parent / Host Names' },
      { token: '{{hosts.blessingLine}}', label: 'Blessings Line' },
    ],
  },
  maturity: {
    label: 'Maturity Function',
    hostFields: [
      { key: 'celebrantName', label: 'Celebrant Name', placeholder: 'Harini' },
      { key: 'parentNames', label: 'Parent / Host Names', placeholder: 'Uma & Venkatesh' },
      { key: 'blessingLine', label: 'Blessings Line', placeholder: 'With blessings from all our relatives' },
    ],
    placeholders: [
      { token: '{{hosts.celebrantName}}', label: 'Celebrant Name' },
      { token: '{{hosts.parentNames}}', label: 'Parent / Host Names' },
      { token: '{{hosts.blessingLine}}', label: 'Blessings Line' },
    ],
  },
  other: {
    label: 'General Event',
    hostFields: [
      { key: 'hostNames', label: 'Host Names', placeholder: 'The Reddy Family' },
      { key: 'familyName', label: 'Family / Group Name', placeholder: 'Reddy Family' },
      { key: 'blessingLine', label: 'Blessings Line', placeholder: 'We request your gracious presence' },
    ],
    placeholders: [
      { token: '{{hosts.hostNames}}', label: 'Host Names' },
      { token: '{{hosts.familyName}}', label: 'Family / Group Name' },
      { token: '{{hosts.blessingLine}}', label: 'Blessings Line' },
    ],
  },
};

const normalizeEventType = (eventType) => {
  const value = String(eventType || '').toLowerCase();
  if (value === 'wedding') return 'wedding';
  if (value === 'birthday') return 'birthday';
  if (value.includes('matur') || value.includes('half') || value.includes('puberty')) return 'maturity';
  return 'other';
};

export const getPlaceholderConfig = (eventType) => {
  const key = normalizeEventType(eventType);
  return EVENT_CONFIG[key] || EVENT_CONFIG.other;
};

export const getInvitePlaceholderGroups = (eventType) => {
  const config = getPlaceholderConfig(eventType);
  return [
    { label: 'Guest & Event', items: COMMON_PLACEHOLDERS },
    { label: config.label, items: config.placeholders },
  ];
};

export const getHostFieldConfig = (eventType) => getPlaceholderConfig(eventType).hostFields;

export const buildDefaultMergeData = (eventType, existing = {}) => {
  const config = getPlaceholderConfig(eventType);
  const current = existing && typeof existing === 'object' ? existing : {};
  const hosts = current.hosts && typeof current.hosts === 'object' ? current.hosts : {};
  const custom = current.custom && typeof current.custom === 'object' ? current.custom : {};
  const nextHosts = { ...hosts };

  config.hostFields.forEach((field) => {
    if (nextHosts[field.key] === undefined) {
      nextHosts[field.key] = '';
    }
  });

  return {
    hosts: nextHosts,
    custom,
  };
};

export const resolveTemplateString = (value, context = {}) => {
  return String(value || '').replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, token) => {
    const result = String(token || '')
      .split('.')
      .filter(Boolean)
      .reduce((acc, segment) => (acc && acc[segment] !== undefined ? acc[segment] : undefined), context);
    return result === undefined || result === null ? '' : String(result);
  });
};

export const buildPreviewMergeContext = ({ event, guest, mergeData }) => {
  const safeMerge = buildDefaultMergeData(event?.type, mergeData);
  const eventDate = event?.date ? new Date(event.date) : null;

  return {
    guest: {
      name: guest?.name || 'Guest Name',
      relationship: guest?.relationship || 'family',
    },
    event: {
      title: event?.title || 'Special Celebration',
      venue: event?.venue || 'Venue TBD',
      city: event?.city || '',
      dateText: eventDate && !Number.isNaN(eventDate.getTime())
        ? eventDate.toLocaleDateString('en-IN', { dateStyle: 'medium' })
        : 'Date TBD',
      timeText: eventDate && !Number.isNaN(eventDate.getTime())
        ? eventDate.toLocaleTimeString('en-IN', { timeStyle: 'short' })
        : 'Time TBD',
    },
    hosts: safeMerge.hosts,
    custom: safeMerge.custom,
  };
};