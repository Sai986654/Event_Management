const https = require('https');
const http = require('http');
const crypto = require('crypto');

/**
 * Text-to-Speech service abstraction.
 *
 * Providers:
 *   'azure'      — Microsoft Azure Cognitive Services (500K chars/month FREE, excellent Indian language voices)
 *   'elevenlabs' — ElevenLabs (free plan, 10K chars/month — used cautiously with caching)
 *   'gtts'       — Google Translate TTS (free, low quality, fallback)
 *
 * ElevenLabs caching strategy:
 *   - Strip {name} placeholders before sending to ElevenLabs.
 *   - Cache generated audio buffers in memory keyed by SHA-256 of the text.
 *   - Same template text = zero extra ElevenLabs API calls regardless of guest count.
 *   - Dynamic names are NOT sent to ElevenLabs to conserve the 10K char/month limit.
 */

const TTS_PROVIDER = process.env.TTS_PROVIDER || 'gtts'; // 'gtts' | 'azure' | 'elevenlabs'

/* ── In-memory cache for ElevenLabs (keyed by SHA-256 of text) ── */
const elevenLabsCache = new Map();

function cacheKey(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

/* ── Azure voice mapping per language ────────────────────────── */
const AZURE_VOICES = {
  te: { female: 'te-IN-ShrutiNeural', male: 'te-IN-MohanNeural' },
  hi: { female: 'hi-IN-SwaraNeural', male: 'hi-IN-MadhurNeural' },
  ta: { female: 'ta-IN-PallaviNeural', male: 'ta-IN-ValluvarNeural' },
  kn: { female: 'kn-IN-SapnaNeural', male: 'kn-IN-GaganNeural' },
  ml: { female: 'ml-IN-SobhanaNeural', male: 'ml-IN-MidhunNeural' },
  mr: { female: 'mr-IN-AarohiNeural', male: 'mr-IN-ManoharNeural' },
  bn: { female: 'bn-IN-TanishaaNeural', male: 'bn-IN-BashkarNeural' },
  gu: { female: 'gu-IN-DhwaniNeural', male: 'gu-IN-NiranjanNeural' },
  pa: { female: 'pa-IN-GurpreetNeural', male: 'pa-IN-GurpreetNeural' },
  ur: { female: 'ur-IN-GulNeural', male: 'ur-IN-SalmanNeural' },
  en: { female: 'en-IN-NeerjaNeural', male: 'en-IN-PrabhatNeural' },
  es: { female: 'es-ES-ElviraNeural', male: 'es-ES-AlvaroNeural' },
  fr: { female: 'fr-FR-DeniseNeural', male: 'fr-FR-HenriNeural' },
  ar: { female: 'ar-SA-ZariyahNeural', male: 'ar-SA-HamedNeural' },
};

/* ── Google Translate TTS (free, best-effort) ───────────────── */

function gttsGenerate(text, lang = 'en') {
  const encodedText = encodeURIComponent(text.slice(0, 200));
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${lang}&q=${encodedText}`;

  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error(`gTTS returned status ${res.statusCode}`));
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

/* ── Azure Cognitive Services TTS (500K chars/month FREE) ───── */

async function azureGenerate(text, lang = 'en') {
  const key = process.env.AZURE_TTS_KEY;
  const region = process.env.AZURE_TTS_REGION || 'eastus';
  if (!key) throw new Error('AZURE_TTS_KEY is required for Azure TTS');

  const gender = process.env.AZURE_TTS_GENDER || 'female'; // 'male' | 'female'
  const voiceEntry = AZURE_VOICES[lang] || AZURE_VOICES.en;
  const voiceName = gender === 'male' ? voiceEntry.male : voiceEntry.female;
  const xmlLang = lang.length === 2 ? `${lang}-IN` : lang;

  // SSML with slightly slower rate for clarity
  const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${xmlLang}'>
  <voice name='${voiceName}'>
    <prosody rate='-5%' pitch='+0%'>${escapeXml(text)}</prosody>
  </voice>
</speak>`;

  return new Promise((resolve, reject) => {
    const req = https.request(
      `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,
      {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': key,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3',
          'User-Agent': 'Vedika 360-TTS',
        },
      },
      (res) => {
        if (res.statusCode !== 200) {
          const chunks = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => reject(new Error(`Azure TTS ${res.statusCode}: ${Buffer.concat(chunks).toString()}`)));
          return;
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      }
    );
    req.on('error', reject);
    req.end(ssml);
  });
}

function escapeXml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

/* ── ElevenLabs TTS — with deduplication cache ───────────────── */

async function elevenLabsGenerate(text) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'; // Rachel

  if (!apiKey) throw new Error('ELEVENLABS_API_KEY is required');

  // Strip any {name} or {Name} placeholders — names are NOT sent to ElevenLabs
  const sanitized = text.replace(/\{name\}/gi, '').replace(/\s{2,}/g, ' ').trim();

  if (!sanitized) throw new Error('ElevenLabs: text is empty after stripping name placeholders');

  // Return cached audio if same template was already generated this session
  const key = cacheKey(sanitized);
  if (elevenLabsCache.has(key)) {
    console.log(`[ElevenLabs] Cache hit for text hash ${key.slice(0, 8)}… — 0 chars billed`);
    return elevenLabsCache.get(key);
  }

  console.log(`[ElevenLabs] Generating TTS for ${sanitized.length} chars (hash ${key.slice(0, 8)}…)`);

  const body = JSON.stringify({
    text: sanitized,
    model_id: 'eleven_multilingual_v2',
    voice_settings: { stability: 0.5, similarity_boost: 0.75 },
  });

  const buffer = await new Promise((resolve, reject) => {
    const req = https.request(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
      },
      (res) => {
        if (res.statusCode !== 200) {
          const chunks = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => reject(new Error(`ElevenLabs ${res.statusCode}: ${Buffer.concat(chunks).toString()}`)));
          return;
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      }
    );
    req.on('error', reject);
    req.end(body);
  });

  // Cache so all guests with the same template reuse this buffer
  elevenLabsCache.set(key, buffer);
  return buffer;
}

/* ── Public API ──────────────────────────────────────────────── */

/**
 * Generate speech audio buffer from text.
 * @param {string} text - The text to convert.
 * @returns {Promise<Buffer>} MP3 audio buffer.
 */
async function generateSpeech(text, lang = 'en') {
  switch (TTS_PROVIDER) {
    case 'azure':
      return azureGenerate(text, lang);
    case 'elevenlabs':
      return elevenLabsGenerate(text);
    case 'gtts':
    default:
      return gttsGenerate(text, lang);
  }
}

module.exports = { generateSpeech };
