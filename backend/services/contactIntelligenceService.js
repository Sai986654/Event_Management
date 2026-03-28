const {
  defaultCountryCode,
  relationDictionary,
  relativeRelations,
  teluguRelationLabels,
  employerSuffixTokens,
  professionSuffixTokens,
} = require('../config/contactIntelligenceConfig');

const LOG = '[ContactIntelligence]';

const normalize = (value) => String(value || '').trim().toLowerCase();

const normalizePhone = (value) => {
  const raw = String(value || '').replace(/[^\d+]/g, '');
  if (!raw) return '';
  if (raw.startsWith('+')) return raw;
  if (raw.startsWith('0')) return `${defaultCountryCode}${raw.slice(1)}`;
  return `${defaultCountryCode}${raw}`;
};

/** Whose phone book / export this is — drives AI interpretation of labels like "Amma", "Athamma". */
const LIST_OWNER_CONTEXTS = new Set([
  'unspecified',
  'groom',
  'bride',
  'groom_father',
  'groom_mother',
  'bride_father',
  'bride_mother',
  'other',
]);

const listOwnerPromptLine = (ctx) => {
  const map = {
    unspecified:
      'The organizer did not specify whose contact list this is; infer relations only from labels, notes, and names.',
    groom: 'This export is from the GROOM’s phone or account. “Amma/అమ్మ” often means the groom’s mother; “Nanna” the groom’s father.',
    bride: 'This export is from the BRIDE’s phone or account. Kin terms are relative to the bride’s side unless notes say otherwise.',
    groom_father:
      'This export is from the GROOM’S FATHER’s contact list. Terms like “Kodalu” may refer to the bride; “Mamayya” is often the groom’s maternal uncle from this perspective.',
    groom_mother:
      'This export is from the GROOM’S MOTHER’s contact list. “Kodalu/bride”, “Athamma”, “Pinni” should be read in that family context.',
    bride_father:
      'This export is from the BRIDE’S FATHER’s contact list. Allamudi / maternal relatives follow the bride’s paternal family perspective.',
    bride_mother:
      'This export is from the BRIDE’S MOTHER’s contact list. “Alludu/groom”, “Vadina”, “Maridi” follow the bride’s maternal network.',
    other: 'Custom context — use organizer notes below together with labels.',
  };
  return map[ctx] || map.unspecified;
};

function normalizeListOwnerContext(raw) {
  const s = normalize(raw).replace(/\s+/g, '_');
  if (!s || s === '') return 'unspecified';
  const aliases = {
    groomside: 'groom',
    brideside: 'bride',
    'groom-father': 'groom_father',
    'groom-mother': 'groom_mother',
    'bride-father': 'bride_father',
    'bride-mother': 'bride_mother',
  };
  const key = aliases[s] || s;
  return LIST_OWNER_CONTEXTS.has(key) ? key : 'unspecified';
}

function teluguFallbackForRelation(relation) {
  const r = String(relation || 'unknown').toLowerCase();
  return teluguRelationLabels[r] || teluguRelationLabels.other;
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Avoid false positives from short English substrings (e.g. "sis" inside "assistant").
 * Single-token ASCII keywords use word boundaries; phrases and Telugu use substring.
 */
function keywordMatchesNormalizedInput(input, keywordRaw) {
  const k = normalize(keywordRaw);
  if (!k || !input) return false;
  if (/\s/.test(k)) {
    return input.includes(k);
  }
  if (/^[a-z0-9]+$/.test(k)) {
    return new RegExp(`\\b${escapeRegex(k)}\\b`).test(input);
  }
  return input.includes(k);
}

/**
 * Indian users often save contacts as "FirstName Company" (work) or "Name Plumber" (trade).
 * Uses the last whitespace-separated token when there are at least two tokens.
 */
function inferNameSuffixHint(contactName) {
  const raw = String(contactName || '').trim();
  if (!raw) return null;
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;
  const lastRaw = parts[parts.length - 1];
  const tokenKey = normalize(lastRaw).replace(/[^a-z0-9]/g, '');
  if (!tokenKey) return null;
  if (employerSuffixTokens.has(tokenKey)) {
    return { kind: 'employer', token: lastRaw };
  }
  if (professionSuffixTokens.has(tokenKey)) {
    return { kind: 'profession', token: lastRaw };
  }
  return null;
}

/**
 * Kin/label keywords first, then employer/profession name suffix, then acquaintance default.
 */
const inferRelation = ({ relationLabel, contactName }) => {
  const input = `${normalize(relationLabel)} ${normalize(contactName)}`.trim();
  if (!input) return { relation: 'unknown', confidence: 0, inferenceSource: 'empty' };

  for (const [relation, keywords] of Object.entries(relationDictionary)) {
    const match = keywords.find((k) => keywordMatchesNormalizedInput(input, k));
    if (match) {
      return { relation, confidence: 0.88, inferenceSource: 'kin_keywords' };
    }
  }

  const suffix = inferNameSuffixHint(contactName);
  if (suffix?.kind === 'employer') {
    return {
      relation: 'colleague',
      confidence: 0.84,
      inferenceSource: 'name_suffix_employer',
      nameSuffixHint: suffix,
    };
  }
  if (suffix?.kind === 'profession') {
    return {
      relation: 'other',
      confidence: 0.8,
      inferenceSource: 'name_suffix_profession',
      nameSuffixHint: suffix,
    };
  }

  return { relation: 'friend', confidence: 0.42, inferenceSource: 'default' };
};

function relationTeluguForRow(inferred) {
  if (inferred.nameSuffixHint?.kind === 'employer') {
    return `సహోద్యోగి (${inferred.nameSuffixHint.token})`;
  }
  if (inferred.nameSuffixHint?.kind === 'profession') {
    return `వృత్తి (${inferred.nameSuffixHint.token})`;
  }
  return teluguFallbackForRelation(inferred.relation);
}

const classifyGroup = (relation) => {
  if (relativeRelations.has(relation)) return 'relatives';
  if (relation === 'colleague') return 'work';
  if (relation === 'unknown' || relation === 'other') return 'others';
  return 'friends';
};

const buildSummary = (analyzed) =>
  analyzed.reduce(
    (acc, item) => {
      acc.total += 1;
      acc[item.group] = (acc[item.group] || 0) + 1;
      if (item.canNotifyWhatsApp) acc.whatsAppEligible += 1;
      return acc;
    },
    { total: 0, relatives: 0, friends: 0, work: 0, others: 0, whatsAppEligible: 0 }
  );

/** Synchronous analysis (rule-based). Used by guest reminders and tests. */
const analyzeContacts = (contacts = []) => {
  const analyzed = contacts.map((c, idx) => {
    const inferred = inferRelation({ relationLabel: c.relationLabel, contactName: c.name });
    const phone = normalizePhone(c.phone);
    const rel = inferred.relation;
    return {
      index: idx,
      name: c.name || 'Unknown',
      relationLabelRaw: c.relationLabel || '',
      inferredRelation: rel,
      relationTelugu: relationTeluguForRow(inferred),
      confidence: inferred.confidence,
      group: classifyGroup(rel),
      phone,
      email: c.email || null,
      canNotifyWhatsApp: Boolean(phone),
      segmentationSource: 'rules',
      inferenceSource: inferred.inferenceSource,
      nameSuffixHint: inferred.nameSuffixHint || undefined,
    };
  });

  return { contacts: analyzed, summary: buildSummary(analyzed) };
};

/**
 * Optional OpenAI refinement (set OPENAI_API_KEY). Falls back to rules-only on error / no key.
 */
async function refineWithOpenAI(analyzedContacts, aiOptions = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  const listOwnerContext = aiOptions.listOwnerContext || 'unspecified';
  const listOwnerNotes = String(aiOptions.listOwnerNotes || '').trim();

  if (!apiKey || analyzedContacts.length === 0) {
    console.log(
      `${LOG} openai:skip reason=${!apiKey ? 'no OPENAI_API_KEY' : 'empty contacts'} owner=${listOwnerContext}`
    );
    return { contacts: analyzedContacts, overview: null, openAiRefinedCount: 0 };
  }

  const model = process.env.CONTACT_AI_MODEL || 'gpt-4o-mini';
  const payload = analyzedContacts.map((c) => ({
    index: c.index,
    name: c.name,
    hints: c.relationLabelRaw || '',
    ruleGuess: c.inferredRelation,
    ruleTelugu: c.relationTelugu,
    nameSuffixHint: c.nameSuffixHint || null,
    inferenceSource: c.inferenceSource || null,
  }));

  const systemParts = [
    'You classify contacts for Indian (Telugu) wedding guest lists.',
    `CONTEXT — ${listOwnerPromptLine(listOwnerContext)}`,
    listOwnerNotes ? `Organizer notes: ${listOwnerNotes}` : '',
    'NAMING HABITS: People often save contacts as "FirstName Employer" (e.g. Lakshmi Accenture) meaning they work together at that company — treat as colleague when labels do not say family.',
    'They also save "Name Profession" (e.g. Ravi Plumber, Suresh Electrician) meaning a service provider or trade — use relation "other" unless labels clearly say family/friend.',
    'Respect explicit Google Labels / Notes / kin terms over name suffix guesses.',
    'Use Google Labels, Notes, job titles, and Telugu/English names.',
    'For each contact, output:',
    '- relation: exactly one of father, mother, brother, sister, spouse, uncle, aunt, cousin, friend, colleague, other, unknown',
    '- relationTelugu: a short kinship or role label in Telugu script (natural for invitations), e.g. మామయ్య, అత్త, అల్లుడు, కోడలు.',
    '- confidence: 0–1',
    'Respond with JSON only, shape:',
    '{"overview":"2-4 English sentences summarizing segmentation for the organizer","items":[{"index":number,"relation":string,"confidence":number,"relationTelugu":string}]}',
  ].filter(Boolean);

  const body = {
    model,
    temperature: 0.2,
    messages: [
      { role: 'system', content: systemParts.join('\n') },
      { role: 'user', content: JSON.stringify({ listOwnerContext, contacts: payload }) },
    ],
  };

  console.log(`${LOG} openai:start model=${model} contacts=${analyzedContacts.length} owner=${listOwnerContext}`);
  if (process.env.CONTACT_AI_DEBUG === 'true') {
    console.log(`${LOG} openai:debug payload.sample`, JSON.stringify(payload.slice(0, 3)));
  }

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`${LOG} openai:http_error`, res.status, errText.slice(0, 500));
      return {
        contacts: analyzedContacts.map((c) => ({ ...c, segmentationSource: 'rules' })),
        overview: null,
        openAiRefinedCount: 0,
      };
    }

    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content || '{}';
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : {};
    }

    const overview = typeof parsed.overview === 'string' ? parsed.overview : null;
    if (overview) {
      console.log(`${LOG} openai:overview`, overview.slice(0, 400));
    }

    const byIndex = new Map((parsed.items || []).map((it) => [Number(it.index), it]));
    let openAiRefinedCount = 0;

    const next = analyzedContacts.map((c) => {
      const ai = byIndex.get(c.index);
      if (!ai || !ai.relation) {
        return { ...c, segmentationSource: 'rules' };
      }
      const rel = String(ai.relation).toLowerCase();
      const confidence = Math.min(1, Math.max(0, Number(ai.confidence) || 0.75));
      const relationTelugu =
        typeof ai.relationTelugu === 'string' && ai.relationTelugu.trim()
          ? ai.relationTelugu.trim()
          : teluguFallbackForRelation(rel);
      openAiRefinedCount += 1;
      return {
        ...c,
        inferredRelation: rel,
        relationTelugu,
        confidence,
        group: classifyGroup(rel),
        segmentationSource: 'openai',
      };
    });

    console.log(
      `${LOG} openai:done refined=${openAiRefinedCount}/${analyzedContacts.length} tokens=${data?.usage?.total_tokens ?? 'n/a'}`
    );

    return { contacts: next, overview, openAiRefinedCount };
  } catch (e) {
    console.error(`${LOG} openai:exception`, e.message);
    return {
      contacts: analyzedContacts.map((c) => ({ ...c, segmentationSource: 'rules' })),
      overview: null,
      openAiRefinedCount: 0,
    };
  }
}

/**
 * Full pipeline: rules first, then optional LLM relabelling + Telugu labels.
 */
async function analyzeContactsPipeline(rawContacts = [], options = {}) {
  const useOpenAi =
    options.useOpenAi !== false && String(process.env.CONTACT_AI_ENABLED || 'true').toLowerCase() !== 'false';
  const listOwnerContext = normalizeListOwnerContext(options.listOwnerContext);
  const listOwnerNotes = String(options.listOwnerNotes || '').trim();

  console.log(`${LOG} pipeline:start raw=${rawContacts.length} owner=${listOwnerContext} openAi=${useOpenAi}`);

  const base = analyzeContacts(rawContacts);
  console.log(
    `${LOG} rules:done total=${base.summary.total} relatives=${base.summary.relatives} friends=${base.summary.friends} work=${base.summary.work}`
  );

  let contacts = base.contacts;
  let overview = null;
  let openAiRefinedCount = 0;

  if (useOpenAi && process.env.OPENAI_API_KEY) {
    const refined = await refineWithOpenAI(contacts, { listOwnerContext, listOwnerNotes });
    contacts = refined.contacts;
    overview = refined.overview;
    openAiRefinedCount = refined.openAiRefinedCount;
  } else {
    console.log(`${LOG} openai:skipped useOpenAi=${useOpenAi} hasKey=${Boolean(process.env.OPENAI_API_KEY)}`);
  }

  const summary = buildSummary(contacts);
  const aiUsed = Boolean(process.env.OPENAI_API_KEY) && useOpenAi;

  console.log(
    `${LOG} pipeline:done aiUsed=${aiUsed} llmRows=${openAiRefinedCount} whatsAppEligible=${summary.whatsAppEligible}`
  );

  return {
    contacts,
    summary,
    aiUsed,
    listOwnerContext,
    listOwnerNotes: listOwnerNotes || undefined,
    aiOverview: overview || undefined,
    openAiRefinedCount,
  };
}

module.exports = {
  analyzeContacts,
  analyzeContactsPipeline,
  normalizePhone,
  inferRelation,
  inferNameSuffixHint,
  classifyGroup,
  normalizeListOwnerContext,
  LIST_OWNER_CONTEXTS: Array.from(LIST_OWNER_CONTEXTS),
};
