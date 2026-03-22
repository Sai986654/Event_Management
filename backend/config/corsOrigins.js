/**
 * CORS origin resolver for Express + Socket.IO.
 * - Set CLIENT_URL to your production frontend (e.g. https://app.vercel.app).
 * - Vercel preview URLs are different subdomains; set CORS_ALLOW_VERCEL=true on the API
 *   while testing previews, or list them in CORS_ORIGINS (comma-separated).
 */
function createOriginHandler() {
  const allowVercel =
    process.env.CORS_ALLOW_VERCEL === 'true' ||
    process.env.CORS_ALLOW_VERCEL === '1';

  const explicit = [
    process.env.CLIENT_URL,
    ...(process.env.CORS_ORIGINS || '').split(','),
  ]
    .map((s) => (typeof s === 'string' ? s.trim() : ''))
    .filter(Boolean);

  return (origin, callback) => {
    if (!origin) return callback(null, true);
    if (explicit.length === 0) return callback(null, true);
    if (explicit.includes(origin)) return callback(null, true);
    if (allowVercel && /\.vercel\.app$/i.test(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  };
}

module.exports = { createOriginHandler };
