const parseJsonEnv = (value, fallback) => {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch (_) {
    return fallback;
  }
};

const relationDictionary = parseJsonEnv(process.env.CONTACT_RELATION_DICTIONARY_JSON, {
  father: ['father', 'dad', 'daddy', 'nanna', 'ayya'],
  mother: ['mother', 'mom', 'mummy', 'amma', 'talli'],
  brother: ['brother', 'bro', 'anna', 'thammudu'],
  sister: ['sister', 'sis', 'akka', 'chelli'],
  spouse: ['wife', 'husband', 'spouse', 'life partner'],
  uncle: ['uncle', 'babai', 'mavayya'],
  aunt: ['aunt', 'pinni', 'athayya'],
  cousin: ['cousin', 'bava', 'maradalu'],
  friend: ['friend', 'frnd', 'bestie', 'buddy', 'mate'],
  colleague: ['colleague', 'coworker', 'work', 'office', 'boss', 'manager', 'team', 'staff', 'client', 'vendor'],
});

const relativeRelations = parseJsonEnv(process.env.CONTACT_RELATIVE_RELATIONS_JSON, [
  'father',
  'mother',
  'brother',
  'sister',
  'spouse',
  'uncle',
  'aunt',
  'cousin',
]);

module.exports = {
  defaultCountryCode: process.env.CONTACT_DEFAULT_COUNTRY_CODE || '+91',
  relationDictionary,
  relativeRelations: new Set(relativeRelations),
  whatsapp: {
    provider: process.env.WHATSAPP_PROVIDER || 'mock',
    dryRun: String(process.env.WHATSAPP_DRY_RUN || 'true').toLowerCase() !== 'false',
    fromNumber: process.env.WHATSAPP_FROM_NUMBER || '',
    apiBaseUrl: process.env.WHATSAPP_API_BASE_URL || '',
    apiKey: process.env.WHATSAPP_API_KEY || '',
    templatePrefix: process.env.WHATSAPP_TEMPLATE_PREFIX || 'eventos_',
  },
};
