const COMMON_PLACEHOLDERS = [
  { token: '{{guest.name}}', label: 'Guest Name' },
  { token: '{{guest.relationship}}', label: 'Guest Relationship' },
  { token: '{{guest.invitationMessage}}', label: 'Guest Invitation Message' },
  { token: '{{event.title}}', label: 'Event Title' },
  { token: '{{event.dateText}}', label: 'Event Date' },
  { token: '{{event.timeText}}', label: 'Event Time' },
  { token: '{{event.venue}}', label: 'Venue' },
  { token: '{{event.city}}', label: 'City' },
  { token: '{{custom.rsvpLink}}', label: 'RSVP Link' },
  { token: '{{custom.mapLink}}', label: 'Map Link' },
  { token: '{{custom.liveStreamUrl}}', label: 'Live Stream Link' },
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
  engagement: {
    label: 'Engagement',
    hostFields: [
      { key: 'brideName', label: 'Bride Name', placeholder: 'Saanvi' },
      { key: 'groomName', label: 'Groom Name', placeholder: 'Nikhil' },
      { key: 'familyNames', label: 'Family Names', placeholder: 'Sharma & Rao Families' },
      { key: 'blessingLine', label: 'Blessings Line', placeholder: 'Seek your blessings for our new beginning' },
    ],
    placeholders: [
      { token: '{{hosts.brideName}}', label: 'Bride Name' },
      { token: '{{hosts.groomName}}', label: 'Groom Name' },
      { token: '{{hosts.familyNames}}', label: 'Family Names' },
      { token: '{{hosts.blessingLine}}', label: 'Blessings Line' },
    ],
  },
  anniversary: {
    label: 'Anniversary',
    hostFields: [
      { key: 'coupleNames', label: 'Couple Names', placeholder: 'Asha & Raj' },
      { key: 'familyNames', label: 'Family Names', placeholder: 'Nair Family' },
      { key: 'milestone', label: 'Milestone', placeholder: '25th Anniversary' },
      { key: 'blessingLine', label: 'Blessings Line', placeholder: 'Celebrate this milestone with us' },
    ],
    placeholders: [
      { token: '{{hosts.coupleNames}}', label: 'Couple Names' },
      { token: '{{hosts.familyNames}}', label: 'Family Names' },
      { token: '{{hosts.milestone}}', label: 'Milestone' },
      { token: '{{hosts.blessingLine}}', label: 'Blessings Line' },
    ],
  },
  babyshower: {
    label: 'Baby Shower',
    hostFields: [
      { key: 'momName', label: 'Mother Name', placeholder: 'Meera' },
      { key: 'dadName', label: 'Father Name', placeholder: 'Vikram' },
      { key: 'familyNames', label: 'Family Names', placeholder: 'Iyer Family' },
      { key: 'blessingLine', label: 'Blessings Line', placeholder: 'Join us to bless the little one' },
    ],
    placeholders: [
      { token: '{{hosts.momName}}', label: 'Mother Name' },
      { token: '{{hosts.dadName}}', label: 'Father Name' },
      { token: '{{hosts.familyNames}}', label: 'Family Names' },
      { token: '{{hosts.blessingLine}}', label: 'Blessings Line' },
    ],
  },
  housewarming: {
    label: 'Housewarming',
    hostFields: [
      { key: 'hostNames', label: 'Host Names', placeholder: 'Kavya & Rahul' },
      { key: 'familyName', label: 'Family Name', placeholder: 'Reddy Family' },
      { key: 'homeName', label: 'Home Name', placeholder: 'Sri Nivasam' },
      { key: 'blessingLine', label: 'Blessings Line', placeholder: 'Please grace our home with your presence' },
    ],
    placeholders: [
      { token: '{{hosts.hostNames}}', label: 'Host Names' },
      { token: '{{hosts.familyName}}', label: 'Family Name' },
      { token: '{{hosts.homeName}}', label: 'Home Name' },
      { token: '{{hosts.blessingLine}}', label: 'Blessings Line' },
    ],
  },
  corporate: {
    label: 'Corporate',
    hostFields: [
      { key: 'companyName', label: 'Company Name', placeholder: 'Vedika Labs' },
      { key: 'hostName', label: 'Host / Speaker', placeholder: 'Rohit Varma' },
      { key: 'designation', label: 'Designation', placeholder: 'CEO' },
      { key: 'blessingLine', label: 'Closing Line', placeholder: 'We look forward to your participation' },
    ],
    placeholders: [
      { token: '{{hosts.companyName}}', label: 'Company Name' },
      { token: '{{hosts.hostName}}', label: 'Host / Speaker' },
      { token: '{{hosts.designation}}', label: 'Designation' },
      { token: '{{hosts.blessingLine}}', label: 'Closing Line' },
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
  if (value === 'corporate' || value === 'conference') return 'corporate';
  if (value === 'engagement') return 'engagement';
  if (value === 'anniversary') return 'anniversary';
  if (value === 'babyshower' || value === 'baby_shower' || value.includes('baby')) return 'babyshower';
  if (value === 'housewarming' || value.includes('house')) return 'housewarming';
  if (value.includes('matur') || value.includes('half') || value.includes('puberty')) return 'maturity';
  return 'other';
};

export const EVENT_TYPE_OPTIONS = [
  { value: 'wedding', label: 'Wedding' },
  { value: 'engagement', label: 'Engagement' },
  { value: 'birthday', label: 'Birthday' },
  { value: 'maturity', label: 'Maturity Function' },
  { value: 'anniversary', label: 'Anniversary' },
  { value: 'babyshower', label: 'Baby Shower' },
  { value: 'housewarming', label: 'Housewarming' },
  { value: 'corporate', label: 'Corporate / Conference' },
  { value: 'other', label: 'Other Event' },
];

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

export const getQuickTextBlocks = (eventType) => {
  const type = normalizeEventType(eventType);
  const base = [
    { key: 'greeting', label: 'Greeting', text: 'Dear {{guest.name}},' },
    { key: 'eventline', label: 'Event Line', text: 'You are invited to {{event.title}} at {{event.venue}} on {{event.dateText}} {{event.timeText}}.' },
    { key: 'blessing', label: 'Blessing', text: '{{hosts.blessingLine}}' },
  ];

  if (type === 'wedding') {
    return [
      { key: 'couple', label: 'Couple Line', text: '{{hosts.brideName}} & {{hosts.groomName}}' },
      ...base,
      { key: 'parents', label: 'Parents Line', text: '{{hosts.brideParents}} | {{hosts.groomParents}}' },
    ];
  }

  if (type === 'engagement') {
    return [
      { key: 'couple', label: 'Couple Line', text: '{{hosts.brideName}} & {{hosts.groomName}}' },
      ...base,
      { key: 'family', label: 'Family Line', text: '{{hosts.familyNames}}' },
    ];
  }

  if (type === 'birthday' || type === 'maturity' || type === 'babyshower') {
    return [
      { key: 'celebrant', label: 'Celebrant', text: '{{hosts.celebrantName}}' },
      ...base,
      { key: 'parents', label: 'Family Line', text: '{{hosts.parentNames}}' },
    ];
  }

  if (type === 'corporate') {
    return [
      { key: 'company', label: 'Company', text: '{{hosts.companyName}}' },
      { key: 'host', label: 'Host Intro', text: 'Hosted by {{hosts.hostName}}, {{hosts.designation}}' },
      ...base,
    ];
  }

  return base;
};

export const getSectionBlocks = (eventType) => {
  const type = normalizeEventType(eventType);

  const header = {
    key: 'header',
    label: 'Header Section',
    elements: [
      {
        type: 'shape',
        x: 40,
        y: 40,
        width: 1000,
        height: 220,
        shapeType: 'rectangle',
        fillColor: '#f8fafc',
        strokeColor: '#cbd5e1',
        strokeWidth: 2,
        borderRadius: 16,
      },
      {
        type: 'text',
        x: 80,
        y: 84,
        width: 920,
        height: 60,
        text: '{{event.title}}',
        fontSize: 54,
        fontWeight: 'bold',
        color: '#0f172a',
        textAlign: 'center',
        fontFamily: 'Georgia',
      },
      {
        type: 'text',
        x: 80,
        y: 156,
        width: 920,
        height: 42,
        text: '{{event.dateText}} • {{event.timeText}} • {{event.venue}}',
        fontSize: 30,
        fontWeight: 'normal',
        color: '#334155',
        textAlign: 'center',
        fontFamily: 'Arial',
      },
    ],
  };

  const footer = {
    key: 'footer',
    label: 'Footer Section',
    elements: [
      {
        type: 'divider',
        x: 90,
        y: 1680,
        width: 900,
        height: 10,
        thickness: 3,
        color: '#cbd5e1',
        orientation: 'horizontal',
      },
      {
        type: 'text',
        x: 100,
        y: 1710,
        width: 880,
        height: 48,
        text: 'Dear {{guest.name}},',
        fontSize: 34,
        fontWeight: 'normal',
        color: '#1f2937',
        textAlign: 'center',
        fontFamily: 'Arial',
      },
      {
        type: 'text',
        x: 100,
        y: 1762,
        width: 880,
        height: 48,
        text: '{{hosts.blessingLine}}',
        fontSize: 30,
        fontWeight: 'normal',
        color: '#334155',
        textAlign: 'center',
        fontFamily: 'Arial',
      },
    ],
  };

  const actionButtons = {
    key: 'invite-actions',
    label: 'RSVP & Directions',
    elements: [
      {
        type: 'action',
        x: 130,
        y: 1380,
        width: 390,
        height: 68,
        label: 'RSVP Now',
        actionKind: 'rsvp',
        url: '{{custom.rsvpLink}}',
        fillColor: '#ffffff',
        textColor: '#4b2e16',
        strokeColor: '#c9b07d',
        strokeWidth: 2,
        borderRadius: 34,
        fontSize: 28,
        fontWeight: 'bold',
        fontFamily: 'Arial',
      },
      {
        type: 'action',
        x: 560,
        y: 1380,
        width: 390,
        height: 68,
        label: 'Join Live Stream',
        actionKind: 'liveStream',
        url: '{{custom.liveStreamUrl}}',
        fillColor: '#ffffff',
        textColor: '#4b2e16',
        strokeColor: '#c9b07d',
        strokeWidth: 2,
        borderRadius: 34,
        fontSize: 28,
        fontWeight: 'bold',
        fontFamily: 'Arial',
      },
      {
        type: 'action',
        x: 150,
        y: 1480,
        width: 780,
        height: 76,
        label: 'Get Directions',
        actionKind: 'directions',
        url: '{{custom.mapLink}}',
        fillColor: '#fffdf7',
        textColor: '#1f2937',
        strokeColor: '#c9b07d',
        strokeWidth: 2,
        borderRadius: 28,
        fontSize: 28,
        fontWeight: 'bold',
        fontFamily: 'Arial',
      },
    ],
  };

  const weddingBody = {
    key: 'wedding-body',
    label: 'Wedding Couple Block',
    elements: [
      {
        type: 'text',
        x: 140,
        y: 520,
        width: 800,
        height: 80,
        text: '{{hosts.brideName}}  ♥  {{hosts.groomName}}',
        fontSize: 62,
        fontWeight: 'bold',
        color: '#7c2d12',
        textAlign: 'center',
        fontFamily: 'Georgia',
      },
      {
        type: 'text',
        x: 140,
        y: 612,
        width: 800,
        height: 44,
        text: '{{hosts.brideParents}} | {{hosts.groomParents}}',
        fontSize: 28,
        fontWeight: 'normal',
        color: '#475569',
        textAlign: 'center',
        fontFamily: 'Arial',
      },
    ],
  };

  const celebrantBody = {
    key: 'celebrant-body',
    label: 'Celebrant Block',
    elements: [
      {
        type: 'text',
        x: 140,
        y: 540,
        width: 800,
        height: 80,
        text: '{{hosts.celebrantName}}',
        fontSize: 64,
        fontWeight: 'bold',
        color: '#7c2d12',
        textAlign: 'center',
        fontFamily: 'Georgia',
      },
      {
        type: 'text',
        x: 140,
        y: 632,
        width: 800,
        height: 44,
        text: '{{hosts.parentNames}}',
        fontSize: 28,
        fontWeight: 'normal',
        color: '#475569',
        textAlign: 'center',
        fontFamily: 'Arial',
      },
    ],
  };

  const corporateBody = {
    key: 'corporate-body',
    label: 'Corporate Speaker Block',
    elements: [
      {
        type: 'text',
        x: 120,
        y: 540,
        width: 840,
        height: 74,
        text: '{{hosts.companyName}}',
        fontSize: 56,
        fontWeight: 'bold',
        color: '#0f172a',
        textAlign: 'center',
        fontFamily: 'Georgia',
      },
      {
        type: 'text',
        x: 120,
        y: 626,
        width: 840,
        height: 44,
        text: 'Hosted by {{hosts.hostName}}, {{hosts.designation}}',
        fontSize: 28,
        fontWeight: 'normal',
        color: '#334155',
        textAlign: 'center',
        fontFamily: 'Arial',
      },
    ],
  };

  const genericBody = {
    key: 'generic-body',
    label: 'Body Section',
    elements: [
      {
        type: 'text',
        x: 110,
        y: 560,
        width: 860,
        height: 64,
        text: 'You are invited to {{event.title}}',
        fontSize: 44,
        fontWeight: 'bold',
        color: '#0f172a',
        textAlign: 'center',
        fontFamily: 'Georgia',
      },
      {
        type: 'text',
        x: 120,
        y: 640,
        width: 840,
        height: 80,
        text: '{{hosts.blessingLine}}',
        fontSize: 30,
        fontWeight: 'normal',
        color: '#334155',
        textAlign: 'center',
        fontFamily: 'Arial',
      },
    ],
  };

  if (type === 'wedding' || type === 'engagement') {
    return [header, weddingBody, actionButtons, footer];
  }
  if (type === 'birthday' || type === 'maturity' || type === 'anniversary' || type === 'babyshower') {
    return [header, celebrantBody, actionButtons, footer];
  }
  if (type === 'corporate') {
    return [header, corporateBody, actionButtons, footer];
  }
  return [header, genericBody, actionButtons, footer];
};

export const buildDefaultMergeData = (eventType, existing = {}) => {
  const config = getPlaceholderConfig(eventType);
  const current = existing && typeof existing === 'object' ? existing : {};
  const hosts = current.hosts && typeof current.hosts === 'object' ? current.hosts : {};
  const custom = current.custom && typeof current.custom === 'object' ? current.custom : {};
  const event = current.event && typeof current.event === 'object' ? current.event : {};
  const guest = current.guest && typeof current.guest === 'object' ? current.guest : {};
  const nextHosts = { ...hosts };

  config.hostFields.forEach((field) => {
    if (nextHosts[field.key] === undefined) {
      nextHosts[field.key] = '';
    }
  });

  return {
    hosts: nextHosts,
    custom: {
      rsvpLink: '',
      mapLink: '',
      liveStreamUrl: '',
      ...custom,
    },
    event,
    guest,
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
  const eventOverride = safeMerge.event || {};
  const guestOverride = safeMerge.guest || {};
  const eventDate = event?.date ? new Date(event.date) : null;
  const overrideDate = eventOverride.date ? new Date(eventOverride.date) : null;
  const resolvedDate = overrideDate && !Number.isNaN(overrideDate.getTime())
    ? overrideDate
    : eventDate;

  return {
    guest: {
      name: guestOverride.name || guest?.name || 'Guest Name',
      relationship: guestOverride.relationship || guest?.relationship || 'family',
      invitationMessage: guestOverride.invitationMessage || guest?.customInviteMessage || guest?.invitationMessage || '',
    },
    event: {
      title: eventOverride.title || event?.title || 'Special Celebration',
      brideName: eventOverride.brideName || event?.brideName || 'Bride',
      groomName: eventOverride.groomName || event?.groomName || 'Groom',
      venue: eventOverride.venue || event?.venue || 'Venue TBD',
      city: eventOverride.city || event?.city || '',
      dateText: eventOverride.dateText || (resolvedDate && !Number.isNaN(resolvedDate.getTime())
        ? resolvedDate.toLocaleDateString('en-IN', { dateStyle: 'medium' })
        : 'Date TBD'),
      timeText: eventOverride.timeText || (resolvedDate && !Number.isNaN(resolvedDate.getTime())
        ? resolvedDate.toLocaleTimeString('en-IN', { timeStyle: 'short' })
        : 'Time TBD'),
      date: eventOverride.date || event?.date || '',
    },
    hosts: safeMerge.hosts,
    custom: safeMerge.custom,
  };
};

export const buildStarterLayout = ({
  eventType,
  event,
  templateKey = null,
  mergeData,
  canvasSize = '1080x1920',
  backgroundColor = '#fffaf6',
}) => {
  const normalizedMerge = buildDefaultMergeData(eventType, mergeData);
  const sectionBlocks = getSectionBlocks(eventType);
  const starterElements = sectionBlocks.flatMap((block) => block.elements || []);

  const withIds = starterElements.map((element, index) => ({
    ...element,
    id: `starter-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
    locked: false,
    z: index,
  }));

  return {
    templateKey,
    canvasSize,
    backgroundColor,
    title: event?.title || '',
    venue: event?.venue || '',
    date: event?.date || null,
    eventType,
    mergeData: normalizedMerge,
    elements: withIds,
  };
};
