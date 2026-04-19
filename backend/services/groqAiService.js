/**
 * Shared Groq / OpenAI Chat Completions helper.
 * Used by event checklist, vendor review summary, and post-event insights.
 */

const LOG = '[GroqAI]';

function getProvider() {
  const explicit = String(process.env.CONTACT_AI_PROVIDER || '').toLowerCase().trim();
  if (explicit === 'groq' || explicit === 'openai') return explicit;
  if (process.env.GROQ_API_KEY && !process.env.OPENAI_API_KEY) return 'groq';
  if (process.env.OPENAI_API_KEY) return 'openai';
  return 'groq';
}

function getApiKey() {
  return getProvider() === 'groq'
    ? String(process.env.GROQ_API_KEY || '').trim()
    : String(process.env.OPENAI_API_KEY || '').trim();
}

function getBaseUrl() {
  return getProvider() === 'groq'
    ? 'https://api.groq.com/openai/v1/chat/completions'
    : 'https://api.openai.com/v1/chat/completions';
}

function getModel() {
  const env = String(process.env.CONTACT_AI_MODEL || '').trim();
  if (env) return env;
  return getProvider() === 'groq' ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini';
}

function parseJsonResponse(raw) {
  let s = String(raw || '').trim();
  if (s.startsWith('```')) {
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
  }
  try { return JSON.parse(s); } catch {}
  const m = s.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
}

/**
 * Single LLM chat completion call.
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @param {{ maxTokens?: number, temperature?: number }} opts
 * @returns {object|null} Parsed JSON or null on failure
 */
async function chatJson(systemPrompt, userPrompt, opts = {}) {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn(`${LOG} no API key — set GROQ_API_KEY or OPENAI_API_KEY`);
    return null;
  }

  const provider = getProvider();
  const model = getModel();
  const body = {
    model,
    temperature: opts.temperature ?? 0.3,
    max_tokens: opts.maxTokens ?? 2000,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  };

  try {
    const res = await fetch(getBaseUrl(), {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const t = await res.text();
      console.error(`${LOG} ${provider} HTTP ${res.status}`, t.slice(0, 600));
      return null;
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content || '';
    const parsed = parseJsonResponse(content);

    if (!parsed) {
      console.warn(`${LOG} unparseable response`, content.slice(0, 400));
      return null;
    }

    console.log(`${LOG} ok provider=${provider} model=${model} tokens=${data?.usage?.total_tokens ?? 'n/a'}`);
    return parsed;
  } catch (e) {
    console.error(`${LOG} exception`, e.message);
    return null;
  }
}

module.exports = { chatJson, getProvider };
