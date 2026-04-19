const {
  defaultCountryCode,
  relationDictionary,
  relativeRelations,
  teluguRelationLabels,
  employerSuffixTokens,
  professionSuffixTokens,
} = require('../config/contactIntelligenceConfig');

const LOG = '[ContactIntelligence]';

/** Avoid repeating the same Groq/OpenAI model mismatch warning on every batch. */
let warnedContactAiModelMismatch = false;

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

/** Default batch size: large CSVs (40+ contacts) often hit output truncation in one call. Override via CONTACT_AI_BATCH_SIZE. */
function getOpenAiBatchSize() {
  const n = Number(process.env.CONTACT_AI_BATCH_SIZE);
  if (Number.isFinite(n) && n >= 3 && n <= 50) return Math.floor(n);
  return 12;
}

/** `groq` | `openai` — Groq when CONTACT_AI_PROVIDER=groq, or only GROQ_API_KEY is set; else OpenAI if key present. */
function getContactAiProvider() {
  const explicit = String(process.env.CONTACT_AI_PROVIDER || '').toLowerCase().trim();
  if (explicit === 'groq' || explicit === 'openai') return explicit;
  const hasGroq = Boolean(process.env.GROQ_API_KEY);
  const hasOpenai = Boolean(process.env.OPENAI_API_KEY);
  if (hasGroq && !hasOpenai) return 'groq';
  if (hasOpenai && !hasGroq) return 'openai';
  if (hasGroq && hasOpenai) return 'openai';
  return 'openai';
}

function getContactAiApiKey() {
  return getContactAiProvider() === 'groq'
    ? String(process.env.GROQ_API_KEY || '').trim()
    : String(process.env.OPENAI_API_KEY || '').trim();
}

function getContactAiChatCompletionsUrl() {
  return getContactAiProvider() === 'groq'
    ? 'https://api.groq.com/openai/v1/chat/completions'
    : 'https://api.openai.com/v1/chat/completions';
}

/** CONTACT_AI_MODEL overrides; otherwise provider defaults (Groq: Llama 3.3, OpenAI: gpt-4o-mini). */
function getContactAiModel() {
  const provider = getContactAiProvider();
  const env = String(process.env.CONTACT_AI_MODEL || '').trim();
  if (env) {
    if (provider === 'groq' && /^(gpt-|o\d)/i.test(env)) {
      if (!warnedContactAiModelMismatch) {
        warnedContactAiModelMismatch = true;
        console.warn(
          `${LOG} CONTACT_AI_MODEL=${env} is not a Groq model; using llama-3.3-70b-versatile. Clear CONTACT_AI_MODEL or set a Groq model id to silence this.`
        );
      }
      return 'llama-3.3-70b-versatile';
    }
    return env;
  }
  return provider === 'groq' ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini';
}

function parseOpenAiMessageJson(raw) {
  let s = String(raw || '').trim();
  if (s.startsWith('```')) {
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
  }
  try {
    return JSON.parse(s);
  } catch {
    const m = s.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        return {};
      }
    }
    return {};
  }
}

/**
 * One Chat Completions call for a batch of contacts (keeps JSON output small enough to parse).
 */
async function refineOneOpenAiBatch(batchContacts, aiOptions, { includeOverview }) {
  const provider = getContactAiProvider();
  const apiKey = getContactAiApiKey();
  const listOwnerContext = aiOptions.listOwnerContext || 'unspecified';
  const listOwnerNotes = String(aiOptions.listOwnerNotes || '').trim();
  const model = getContactAiModel();

  const payload = batchContacts.map((c) => ({
    index: c.index,
    name: c.name,
    hints: c.relationLabelRaw || '',
    ruleGuess: c.inferredRelation,
    ruleTelugu: c.relationTelugu,
    nameSuffixHint: c.nameSuffixHint || null,
    inferenceSource: c.inferenceSource || null,
  }));

  const systemParts = [
    'You classify contacts for Indian (Telugu) wedding guest lists. Output a single JSON object only.',
    `CONTEXT — ${listOwnerPromptLine(listOwnerContext)}`,
    listOwnerNotes ? `Organizer notes: ${listOwnerNotes}` : '',
    'NAMING HABITS: "FirstName Employer" (e.g. Lakshmi Accenture) → colleague if not family-labeled. "Name Profession" (e.g. Ravi Plumber) → relation other unless family.',
    'Respect Google Labels / Notes / kin terms over guesses.',
    'For EACH contact in the input batch, output one object in items with the SAME index number as provided.',
    'relation: one of father, mother, brother, sister, spouse, uncle, aunt, cousin, friend, colleague, other, unknown',
    'relationTelugu: short Telugu label for invitations.',
    'confidence: 0–1',
    includeOverview
      ? 'Include overview: 2–4 English sentences summarizing this batch for the organizer.'
      : 'Set overview to an empty string "".',
    'JSON shape: {"overview":"string","items":[{"index":number,"relation":string,"confidence":number,"relationTelugu":string}]}',
  ].filter(Boolean);

  const body = {
    model,
    temperature: 0.2,
    max_tokens: Number(process.env.CONTACT_AI_MAX_TOKENS) || 8192,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemParts.join('\n') },
      { role: 'user', content: JSON.stringify({ listOwnerContext, contacts: payload }) },
    ],
  };

  const res = await fetch(getContactAiChatCompletionsUrl(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`${LOG} llm:http_error provider=${provider}`, res.status, errText.slice(0, 800));
    return {
      contacts: batchContacts.map((c) => ({ ...c, segmentationSource: 'rules' })),
      overview: null,
      openAiRefinedCount: 0,
    };
  }

  const data = await res.json();
  const finishReason = data?.choices?.[0]?.finish_reason;
  if (finishReason === 'length') {
    console.warn(`${LOG} llm:truncated provider=${provider} finish_reason=length — reduce CONTACT_AI_BATCH_SIZE (now ${getOpenAiBatchSize()})`);
  }

  const raw = data?.choices?.[0]?.message?.content || '{}';
  const parsed = parseOpenAiMessageJson(raw);
  const itemsLen = Array.isArray(parsed.items) ? parsed.items.length : 0;
  if (itemsLen === 0) {
    console.warn(
      `${LOG} llm:empty_items provider=${provider} batchSize=${batchContacts.length} contentLen=${raw.length} preview=${String(raw).slice(0, 200)}`
    );
  }

  const overview = typeof parsed.overview === 'string' && parsed.overview.trim() ? parsed.overview.trim() : null;
  if (overview && includeOverview) {
    console.log(`${LOG} llm:overview`, overview.slice(0, 400));
  }

  const byIndex = new Map();
  for (const it of parsed.items || []) {
    const idx = Number(it.index);
    if (Number.isFinite(idx)) byIndex.set(idx, it);
  }

  let openAiRefinedCount = 0;
  const next = batchContacts.map((c) => {
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
    `${LOG} llm:batch_done provider=${provider} batch=${batchContacts.length} refined=${openAiRefinedCount} tokens=${data?.usage?.total_tokens ?? 'n/a'}`
  );

  return { contacts: next, overview: includeOverview ? overview : null, openAiRefinedCount };
}

/**
 * Optional LLM refinement (OpenAI or Groq). Large lists are processed in batches to avoid truncated JSON.
 */
async function refineWithOpenAI(analyzedContacts, aiOptions = {}) {
  const apiKey = getContactAiApiKey();
  const provider = getContactAiProvider();
  const listOwnerContext = aiOptions.listOwnerContext || 'unspecified';

  if (!apiKey || analyzedContacts.length === 0) {
    console.log(
      `${LOG} llm:skip reason=${!apiKey ? 'no GROQ_API_KEY or OPENAI_API_KEY' : 'empty contacts'} owner=${listOwnerContext}`
    );
    return {
      contacts: analyzedContacts,
      overview: null,
      openAiRefinedCount: 0,
      openAiWarning: undefined,
      openAiBatches: 0,
    };
  }

  const batchSize = getOpenAiBatchSize();
  const mergedByIndex = new Map(analyzedContacts.map((c) => [c.index, { ...c }]));
  let totalRefined = 0;
  let overview = null;
  let batchNum = 0;

  console.log(
    `${LOG} llm:start provider=${provider} model=${getContactAiModel()} total=${analyzedContacts.length} batchSize=${batchSize} owner=${listOwnerContext}`
  );

  if (process.env.CONTACT_AI_DEBUG === 'true') {
    console.log(`${LOG} llm:debug first indexes`, analyzedContacts.slice(0, 3).map((c) => c.index));
  }

  for (let i = 0; i < analyzedContacts.length; i += batchSize) {
    const batch = analyzedContacts.slice(i, i + batchSize);
    batchNum += 1;
    const includeOverview = i === 0;
    try {
      const r = await refineOneOpenAiBatch(batch, aiOptions, { includeOverview });
      totalRefined += r.openAiRefinedCount;
      if (r.overview) overview = r.overview;
      for (const c of r.contacts) {
        mergedByIndex.set(c.index, c);
      }
    } catch (e) {
      console.error(`${LOG} llm:batch_exception`, e.message);
    }
  }

  const merged = analyzedContacts.map((c) => mergedByIndex.get(c.index) || c);

  let openAiWarning;
  if (totalRefined === 0 && analyzedContacts.length > 0) {
    openAiWarning =
      'LLM returned no refined rows (empty or invalid JSON). Check server logs, API key/quota, CONTACT_AI_PROVIDER, or set CONTACT_AI_BATCH_SIZE=8. Table shows rule-based results only.';
    console.warn(`${LOG} llm:no_refines totalContacts=${analyzedContacts.length} batches=${batchNum}`);
  } else if (totalRefined < analyzedContacts.length) {
    openAiWarning = `LLM refined ${totalRefined} of ${analyzedContacts.length} contacts; some rows remain rule-based (check batch logs).`;
  }

  console.log(
    `${LOG} llm:done refined=${totalRefined}/${analyzedContacts.length} batches=${batchNum}`
  );

  return {
    contacts: merged,
    overview,
    openAiRefinedCount: totalRefined,
    openAiWarning,
    openAiBatches: batchNum,
  };
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
  let openAiWarning;
  let openAiBatches = 0;

  if (useOpenAi && getContactAiApiKey()) {
    const refined = await refineWithOpenAI(contacts, { listOwnerContext, listOwnerNotes });
    contacts = refined.contacts;
    overview = refined.overview;
    openAiRefinedCount = refined.openAiRefinedCount;
    openAiWarning = refined.openAiWarning;
    openAiBatches = refined.openAiBatches || 0;
  } else {
    console.log(`${LOG} llm:skipped useOpenAi=${useOpenAi} hasKey=${Boolean(getContactAiApiKey())}`);
  }

  const summary = buildSummary(contacts);
  const aiUsed = Boolean(getContactAiApiKey()) && useOpenAi;

  console.log(
    `${LOG} pipeline:done aiUsed=${aiUsed} llmRows=${openAiRefinedCount} batches=${openAiBatches} whatsAppEligible=${summary.whatsAppEligible}`
  );

  return {
    contacts,
    summary,
    aiUsed,
    listOwnerContext,
    listOwnerNotes: listOwnerNotes || undefined,
    aiOverview: overview || undefined,
    openAiRefinedCount,
    openAiWarning: openAiWarning || undefined,
    openAiBatches: openAiBatches || undefined,
  };
}

/**
 * Correlate a user-selected subset of analyzed contacts (LLM + duplicate-phone hints).
 * @param {object[]} contacts - Analyzed contact rows from analyzeContactsPipeline / analyzeContacts
 * @param {{ listOwnerContext?: string, listOwnerNotes?: string }} options
 */
async function correlateContactsSubset(contacts, options = {}) {
  if (!Array.isArray(contacts) || contacts.length < 2) {
    return { error: 'Select at least two contacts.', code: 'MIN_CONTACTS' };
  }

  const listOwnerContext = normalizeListOwnerContext(options.listOwnerContext);
  const listOwnerNotes = String(options.listOwnerNotes || '').trim();

  const phoneNorm = (p) => String(p || '').replace(/\D/g, '');
  const byPhone = new Map();
  for (const c of contacts) {
    const p = phoneNorm(c.phone);
    if (p.length >= 10) {
      if (!byPhone.has(p)) byPhone.set(p, []);
      byPhone.get(p).push({ index: c.index, name: c.name });
    }
  }
  const duplicatePhones = [...byPhone.entries()]
    .filter(([, arr]) => arr.length > 1)
    .map(([digits, people]) => ({ digits, people }));

  const simplified = contacts.map((c) => ({
    index: c.index,
    name: c.name,
    phone: c.phone,
    relationLabelRaw: c.relationLabelRaw,
    inferredRelation: c.inferredRelation,
    relationTelugu: c.relationTelugu,
    group: c.group,
    nameSuffixHint: c.nameSuffixHint || null,
    segmentationSource: c.segmentationSource,
  }));

  const provider = getContactAiProvider();
  const apiKey = getContactAiApiKey();
  if (!apiKey) {
    const dupSummary = duplicatePhones.length
      ? duplicatePhones
          .map((d) => `${d.digits}: ${d.people.map((p) => p.name).join(', ')}`)
          .join('; ')
      : 'No duplicate normalized phone numbers in this selection.';
    return {
      correlationSummary: `No LLM API key on the server (${LOG}; set GROQ_API_KEY or OPENAI_API_KEY). Rules-only: ${dupSummary}`,
      relationshipNotes: [],
      pairs: [],
      duplicatePhones,
      source: 'rules',
    };
  }

  const model = getContactAiModel();
  const maxTokens = Number(process.env.CONTACT_AI_CORRELATE_MAX_TOKENS);
  const systemParts = [
    'You help Indian wedding organizers understand how SELECTED guests may relate to each other.',
    `List owner context: ${listOwnerPromptLine(listOwnerContext)}`,
    listOwnerNotes ? `Organizer notes: ${listOwnerNotes}` : '',
    'Use each person\'s labels (relationLabelRaw), inferredRelation, Telugu label, group, and name suffix hints.',
    'duplicatePhoneHints: same normalized phone on multiple rows may mean shared family phone or duplicate entries — mention cautiously.',
    'Do not invent blood ties without label support; use "likely" or "possibly" when uncertain.',
    'Output JSON only: {"summary":"2-6 sentences in English","relationshipNotes":["short bullet strings"],"pairs":[{"personA":"","personB":"","relationshipHypothesis":""}]}',
  ].filter(Boolean);

  const body = {
    model,
    temperature: 0.35,
    max_tokens: Number.isFinite(maxTokens) && maxTokens >= 512 ? Math.floor(maxTokens) : 4096,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemParts.join('\n') },
      {
        role: 'user',
        content: JSON.stringify({
          listOwnerContext,
          duplicatePhoneHints: duplicatePhones,
          contacts: simplified,
        }),
      },
    ],
  };

  console.log(
    `${LOG} correlate:subset provider=${provider} n=${contacts.length} owner=${listOwnerContext} dupPhones=${duplicatePhones.length}`
  );

  const res = await fetch(getContactAiChatCompletionsUrl(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`${LOG} correlate:llm_http provider=${provider}`, res.status, errText.slice(0, 600));
    return {
      error: 'LLM request failed for correlation.',
      code: 'LLM_HTTP',
      status: res.status,
      duplicatePhones,
    };
  }

  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content;
  const parsed = parseOpenAiMessageJson(raw);
  const summary =
    typeof parsed.summary === 'string'
      ? parsed.summary
      : typeof parsed.correlationSummary === 'string'
        ? parsed.correlationSummary
        : '';

  return {
    correlationSummary: summary,
    relationshipNotes: Array.isArray(parsed.relationshipNotes) ? parsed.relationshipNotes : [],
    pairs: Array.isArray(parsed.pairs) ? parsed.pairs : [],
    duplicatePhones,
    source: provider === 'groq' ? 'groq' : 'openai',
  };
}

/**
 * Build an actionable invite strategy from analyzed contacts.
 * Uses LLM (Groq/OpenAI) when available, otherwise returns deterministic rule-based guidance.
 */
async function generateInviteStrategy(contacts = [], options = {}) {
  if (!Array.isArray(contacts) || contacts.length === 0) {
    return {
      source: 'rules',
      strategySummary: 'No contacts available. Analyze contacts first to generate an invite strategy.',
      priorities: [],
      messageVariants: [],
      followUps: [],
    };
  }

  const listOwnerContext = normalizeListOwnerContext(options.listOwnerContext);
  const listOwnerNotes = String(options.listOwnerNotes || '').trim();

  const safeGroup = (g) => (['relatives', 'friends', 'work', 'others'].includes(g) ? g : 'others');
  const stats = {
    total: contacts.length,
    whatsAppEligible: 0,
    groups: {
      relatives: { total: 0, wa: 0 },
      friends: { total: 0, wa: 0 },
      work: { total: 0, wa: 0 },
      others: { total: 0, wa: 0 },
    },
  };

  for (const c of contacts) {
    const g = safeGroup(c.group);
    stats.groups[g].total += 1;
    if (c.canNotifyWhatsApp) {
      stats.whatsAppEligible += 1;
      stats.groups[g].wa += 1;
    }
  }

  const ranked = Object.entries(stats.groups)
    .map(([group, value]) => ({
      group,
      total: value.total,
      wa: value.wa,
      waRate: value.total ? Number((value.wa / value.total).toFixed(2)) : 0,
    }))
    .filter((r) => r.total > 0)
    .sort((a, b) => b.wa - a.wa || b.total - a.total);

  const fallbackPriorities = ranked.slice(0, 3).map((r, idx) => ({
    group: r.group,
    reason:
      idx === 0
        ? `Largest reachable segment (${r.wa}/${r.total} with WhatsApp).`
        : `Strong reachable audience (${r.wa}/${r.total} with WhatsApp).`,
    recommendedWindow:
      r.group === 'relatives'
        ? 'Evening 7:00-9:00 PM'
        : r.group === 'work'
          ? 'Lunch 12:30-2:00 PM'
          : 'Evening 6:00-8:00 PM',
    suggestedTone:
      r.group === 'relatives'
        ? 'Warm and respectful'
        : r.group === 'work'
          ? 'Polite and concise'
          : 'Friendly and celebratory',
  }));

  const fallbackMessages = ranked.slice(0, 3).map((r) => ({
    group: r.group,
    text:
      r.group === 'relatives'
        ? 'Namaskaram! Our event is approaching soon. Your presence and blessings mean a lot to us. Please check the invite and RSVP.'
        : r.group === 'work'
          ? 'Hello! A gentle reminder about our upcoming event. Please review the invite details and RSVP at your convenience.'
          : 'Hi! We are excited to celebrate soon. Please check our invite details and confirm your RSVP. Looking forward to seeing you!',
  }));

  const fallback = {
    source: 'rules',
    strategySummary: `Focus first on ${fallbackPriorities[0]?.group || 'top segments'} to maximize RSVP response from reachable contacts.`,
    priorities: fallbackPriorities,
    messageVariants: fallbackMessages,
    followUps: [
      'Send first reminder to top segment 10-14 days before event.',
      'Send a short follow-up 3-5 days before event to non-responders.',
      'Call key family contacts manually for VIP confirmations.',
    ],
  };

  const apiKey = getContactAiApiKey();
  if (!apiKey) {
    return fallback;
  }

  const provider = getContactAiProvider();
  const model = getContactAiModel();
  const sampleContacts = contacts.slice(0, 40).map((c) => ({
    name: c.name,
    group: safeGroup(c.group),
    relationTelugu: c.relationTelugu,
    inferredRelation: c.inferredRelation,
    canNotifyWhatsApp: Boolean(c.canNotifyWhatsApp),
  }));

  const body = {
    model,
    temperature: 0.3,
    max_tokens: Number(process.env.CONTACT_AI_STRATEGY_MAX_TOKENS) || 1500,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: [
          'You are an event invite strategist for Indian weddings and family events.',
          `List owner context: ${listOwnerPromptLine(listOwnerContext)}`,
          listOwnerNotes ? `Organizer notes: ${listOwnerNotes}` : '',
          'Return practical outreach strategy to improve RSVP and attendance.',
          'Output JSON only.',
          'Schema: {"strategySummary":"string","priorities":[{"group":"relatives|friends|work|others","reason":"string","recommendedWindow":"string","suggestedTone":"string"}],"messageVariants":[{"group":"relatives|friends|work|others","text":"string"}],"followUps":["string"]}',
        ]
          .filter(Boolean)
          .join('\n'),
      },
      {
        role: 'user',
        content: JSON.stringify({
          stats,
          rankedGroups: ranked,
          sampleContacts,
        }),
      },
    ],
  };

  try {
    const res = await fetch(getContactAiChatCompletionsUrl(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const t = await res.text();
      console.error(`${LOG} strategy:llm_http provider=${provider}`, res.status, t.slice(0, 600));
      return fallback;
    }

    const data = await res.json();
    const parsed = parseOpenAiMessageJson(data?.choices?.[0]?.message?.content || '{}');
    const priorities = Array.isArray(parsed.priorities)
      ? parsed.priorities
          .map((p) => ({
            group: safeGroup(p.group),
            reason: String(p.reason || '').trim(),
            recommendedWindow: String(p.recommendedWindow || '').trim(),
            suggestedTone: String(p.suggestedTone || '').trim(),
          }))
          .filter((p) => p.reason)
      : [];
    const messageVariants = Array.isArray(parsed.messageVariants)
      ? parsed.messageVariants
          .map((m) => ({
            group: safeGroup(m.group),
            text: String(m.text || '').trim(),
          }))
          .filter((m) => m.text)
      : [];
    const followUps = Array.isArray(parsed.followUps)
      ? parsed.followUps.map((f) => String(f || '').trim()).filter(Boolean)
      : [];

    return {
      source: provider,
      strategySummary:
        String(parsed.strategySummary || '').trim() ||
        fallback.strategySummary,
      priorities: priorities.length ? priorities : fallback.priorities,
      messageVariants: messageVariants.length ? messageVariants : fallback.messageVariants,
      followUps: followUps.length ? followUps : fallback.followUps,
    };
  } catch (e) {
    console.error(`${LOG} strategy:llm_exception`, e.message);
    return fallback;
  }
}

module.exports = {
  analyzeContacts,
  analyzeContactsPipeline,
  correlateContactsSubset,
  generateInviteStrategy,
  normalizePhone,
  inferRelation,
  inferNameSuffixHint,
  classifyGroup,
  normalizeListOwnerContext,
  LIST_OWNER_CONTEXTS: Array.from(LIST_OWNER_CONTEXTS),
};
