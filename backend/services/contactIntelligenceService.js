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
      return { relation, confidence: 0.88 };
    }
  }
  return { relation: 'friend', confidence: 0.42 };
};

const classifyGroup = (relation) => {
  if (relativeRelations.has(relation)) return 'relatives';
  if (relation === 'colleague') return 'work';
  if (relation === 'unknown') return 'others';
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

/** Synchronous analysis (rule-based + keyword AI). Used by guest reminders and tests. */
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
      segmentationSource: 'rules',
    };
  });

  return { contacts: analyzed, summary: buildSummary(analyzed) };
};

/**
 * Optional OpenAI refinement (set OPENAI_API_KEY). Falls back to rules-only on error / no key.
 */
async function refineWithOpenAI(analyzedContacts) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || analyzedContacts.length === 0) {
    return analyzedContacts.map((c) => ({ ...c, segmentationSource: c.segmentationSource || 'rules' }));
  }

  const model = process.env.CONTACT_AI_MODEL || 'gpt-4o-mini';
  const payload = analyzedContacts.map((c) => ({
    index: c.index,
    name: c.name,
    hints: c.relationLabelRaw || '',
    ruleGuess: c.inferredRelation,
  }));

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content: `You classify people for Indian wedding/event guest lists. For each item, choose exactly one relation from:
father, mother, brother, sister, spouse, uncle, aunt, cousin, friend, colleague, other.
Respond with JSON only: {"items":[{"index":number,"relation":string,"confidence":number}]}
confidence is 0-1. Use hints (Google Labels, Notes, job) strongly.`,
          },
          { role: 'user', content: JSON.stringify(payload) },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('OpenAI contact refine error:', res.status, errText);
      return analyzedContacts.map((c) => ({ ...c, segmentationSource: 'rules' }));
    }

    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content || '{}';
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : { items: [] };
    }
    const byIndex = new Map((parsed.items || []).map((it) => [Number(it.index), it]));

    return analyzedContacts.map((c) => {
      const ai = byIndex.get(c.index);
      if (!ai || !ai.relation) return { ...c, segmentationSource: 'rules' };
      const rel = String(ai.relation).toLowerCase();
      const confidence = Math.min(1, Math.max(0, Number(ai.confidence) || 0.75));
      return {
        ...c,
        inferredRelation: rel,
        confidence,
        group: classifyGroup(rel),
        segmentationSource: 'openai',
      };
    });
  } catch (e) {
    console.error('OpenAI contact refine exception:', e.message);
    return analyzedContacts.map((c) => ({ ...c, segmentationSource: 'rules' }));
  }
}

/**
 * Full pipeline: rules first, then optional LLM relabelling.
 */
async function analyzeContactsPipeline(rawContacts = [], options = {}) {
  const useOpenAi = options.useOpenAi !== false && String(process.env.CONTACT_AI_ENABLED || 'true').toLowerCase() !== 'false';
  const base = analyzeContacts(rawContacts);
  let contacts = base.contacts;
  if (useOpenAi && process.env.OPENAI_API_KEY) {
    contacts = await refineWithOpenAI(contacts);
  }
  return {
    contacts,
    summary: buildSummary(contacts),
    aiUsed: Boolean(process.env.OPENAI_API_KEY) && useOpenAi,
  };
}

module.exports = {
  analyzeContacts,
  analyzeContactsPipeline,
  normalizePhone,
  inferRelation,
  classifyGroup,
};
