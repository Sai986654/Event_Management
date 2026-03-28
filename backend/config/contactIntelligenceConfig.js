const parseJsonEnv = (value, fallback) => {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch (_) {
    return fallback;
  }
};

/* Order matters: longer/specific kin terms (e.g. mamayya) before short substrings (e.g. anna). */
const relationDictionary = parseJsonEnv(process.env.CONTACT_RELATION_DICTIONARY_JSON, {
  uncle: ['uncle', 'babai', 'mavayya', 'mamayya', 'pedanana'],
  aunt: ['aunt', 'pinni', 'athayya', 'atha', 'peddamma', 'chinnamma'],
  cousin: ['cousin', 'bava', 'maradalu', 'bavamaridi', 'menalludu'],
  father: ['father', 'dad', 'daddy', 'nanna'],
  mother: ['mother', 'mom', 'mummy', 'amma', 'talli'],
  brother: ['brother', 'bro', 'anna', 'thammudu'],
  sister: ['sister', 'sis', 'akka', 'chelli'],
  spouse: ['wife', 'husband', 'spouse', 'life partner'],
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

/** Default Telugu labels for rule-based rows (AI may override with context-aware labels). */
const teluguRelationLabels = parseJsonEnv(process.env.CONTACT_TELUGU_LABELS_JSON, {
  father: 'తండ్రి (నాన్న)',
  mother: 'తల్లి (అమ్మ)',
  brother: 'అన్న / తమ్ముడు',
  sister: 'అక్క / చెల్లి',
  spouse: 'జీవిత భాగస్వామి',
  uncle: 'మామయ్య / బాబాయి',
  aunt: 'అత్త / పిన్ని',
  cousin: 'బావ / మేనకోడలు',
  friend: 'స్నేహితుడు',
  colleague: 'సహోద్యోగి',
  other: 'ఇతరులు',
  unknown: 'తెలియదు',
});

/**
 * Last token of saved names often means employer ("Lakshmi Accenture") or trade ("Ravi Plumber").
 * Matched case-insensitively. Extend via CONTACT_EMPLOYER_SUFFIXES_JSON / CONTACT_PROFESSION_SUFFIXES_JSON (JSON arrays of strings).
 */
const defaultEmployerSuffixes = [
  'accenture',
  'infosys',
  'tcs',
  'wipro',
  'cognizant',
  'capgemini',
  'deloitte',
  'ey',
  'kpmg',
  'pwc',
  'google',
  'microsoft',
  'amazon',
  'meta',
  'apple',
  'ibm',
  'oracle',
  'sap',
  'salesforce',
  'adobe',
  'hcl',
  'mphasis',
  'mindtree',
  'lti',
  'ltimindtree',
  'techmahindra',
  'jpmorgan',
  'goldman',
  'barclays',
  'hsbc',
  'icici',
  'hdfc',
  'sbi',
  'flipkart',
  'swiggy',
  'zomato',
  'paytm',
  'phonepe',
  'freshworks',
  'zerodha',
  'servicenow',
  'vmware',
  'dell',
  'hp',
  'intel',
  'nvidia',
  'qualcomm',
  'broadcom',
  'netflix',
  'uber',
  'ola',
];

const defaultProfessionSuffixes = [
  'plumber',
  'electrician',
  'carpenter',
  'painter',
  'mason',
  'welder',
  'mechanic',
  'driver',
  'doctor',
  'dr',
  'surgeon',
  'dentist',
  'lawyer',
  'advocate',
  'teacher',
  'professor',
  'nurse',
  'tailor',
  'cook',
  'chef',
  'contractor',
  'builder',
  'architect',
  'photographer',
  'designer',
  'accountant',
  'broker',
  'agent',
  'journalist',
  'engineer',
  'developer',
  'physio',
  'physiotherapist',
  'ca',
  'cs',
  'cfo',
  'ceo',
  'realtor',
  'inspector',
];

const mergeSuffixLists = (defaults, extraJson) => {
  const extra = parseJsonEnv(extraJson, []);
  const arr = Array.isArray(extra) ? extra : [];
  return [...defaults, ...arr.map((s) => String(s || '').trim().toLowerCase()).filter(Boolean)];
};

const employerSuffixTokens = new Set(mergeSuffixLists(defaultEmployerSuffixes, process.env.CONTACT_EMPLOYER_SUFFIXES_JSON));
const professionSuffixTokens = new Set(mergeSuffixLists(defaultProfessionSuffixes, process.env.CONTACT_PROFESSION_SUFFIXES_JSON));

module.exports = {
  defaultCountryCode: process.env.CONTACT_DEFAULT_COUNTRY_CODE || '+91',
  relationDictionary,
  relativeRelations: new Set(relativeRelations),
  teluguRelationLabels,
  employerSuffixTokens,
  professionSuffixTokens,
  whatsapp: {
    provider: process.env.WHATSAPP_PROVIDER || 'mock',
    dryRun: String(process.env.WHATSAPP_DRY_RUN || 'true').toLowerCase() !== 'false',
    fromNumber: process.env.WHATSAPP_FROM_NUMBER || '',
    apiBaseUrl: process.env.WHATSAPP_API_BASE_URL || '',
    apiKey: process.env.WHATSAPP_API_KEY || '',
    templatePrefix: process.env.WHATSAPP_TEMPLATE_PREFIX || 'eventos_',
  },
};
