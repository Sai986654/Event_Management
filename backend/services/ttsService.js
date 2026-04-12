const https = require('https');
const http = require('http');

/**
 * Text-to-Speech service abstraction.
 *
 * Default: Google Translate TTS (free, no API key, limited to ~200 chars).
 * Switch to a paid provider (ElevenLabs, Google Cloud TTS, AWS Polly)
 * by implementing the same interface.
 */

const TTS_PROVIDER = process.env.TTS_PROVIDER || 'gtts'; // 'gtts' | 'elevenlabs'

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

/* ── ElevenLabs TTS (paid, high quality) ────────────────────── */

async function elevenLabsGenerate(text) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'; // Rachel

  if (!apiKey) throw new Error('ELEVENLABS_API_KEY is required');

  const body = JSON.stringify({
    text,
    model_id: 'eleven_monolingual_v1',
    voice_settings: { stability: 0.5, similarity_boost: 0.75 },
  });

  return new Promise((resolve, reject) => {
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
}

/* ── Public API ──────────────────────────────────────────────── */

/**
 * Generate speech audio buffer from text.
 * @param {string} text - The text to convert.
 * @returns {Promise<Buffer>} MP3 audio buffer.
 */
async function generateSpeech(text, lang = 'en') {
  switch (TTS_PROVIDER) {
    case 'elevenlabs':
      return elevenLabsGenerate(text);
    case 'gtts':
    default:
      return gttsGenerate(text, lang);
  }
}

module.exports = { generateSpeech };
