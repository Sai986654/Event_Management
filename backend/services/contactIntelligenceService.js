const { defaultCountryCode, relationDictionary, relativeRelations } = require('../config/contactIntelligenceConfig');

const normalize = (value) => String(value || '').trim().toLowerCase();

const normalizePhone = (value) => {
  const raw = String(value || '').replace(/[^\d+]/g, '');
  if (!raw) return '';
  if (raw.startsWith('+')) return raw;
  if (raw.startsWith('0')) return `${defaultCountryCode}${raw.slice(1)}`;
  return `${defaultCountryCode}${raw}`;
};

const inferRelation = ({ relationLabel, contactName }) => {
  const input = `${normalize(relationLabel)} ${normalize(contactName)}`.trim();
  if (!input) return { relation: 'unknown', confidence: 0 };

  for (const [relation, keywords] of Object.entries(relationDictionary)) {
    const match = keywords.find((k) => input.includes(normalize(k)));
    if (match) {
      return { relation, confidence: 0.9 };
    }
  }
  return { relation: 'friend', confidence: 0.45 };
};

const classifyGroup = (relation) => {
  if (relativeRelations.has(relation)) return 'relatives';
  if (relation === 'unknown') return 'others';
  return 'friends';
};

const analyzeContacts = (contacts = []) => {
  const analyzed = contacts.map((c, idx) => {
    const inferred = inferRelation({ relationLabel: c.relationLabel, contactName: c.name });
    const phone = normalizePhone(c.phone);
    return {
      index: idx,
      name: c.name || 'Unknown',
      relationLabelRaw: c.relationLabel || '',
      inferredRelation: inferred.relation,
      confidence: inferred.confidence,
      group: classifyGroup(inferred.relation),
      phone,
      email: c.email || null,
      canNotifyWhatsApp: Boolean(phone),
    };
  });

  const summary = analyzed.reduce(
    (acc, item) => {
      acc.total += 1;
      acc[item.group] = (acc[item.group] || 0) + 1;
      if (item.canNotifyWhatsApp) acc.whatsAppEligible += 1;
      return acc;
    },
    { total: 0, relatives: 0, friends: 0, others: 0, whatsAppEligible: 0 }
  );

  return { contacts: analyzed, summary };
};

module.exports = { analyzeContacts, normalizePhone };
