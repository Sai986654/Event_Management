/**
 * CORS origin resolver for Express + Socket.IO.
 * - Set CLIENT_URL to your production frontend.
 * - Vercel preview deploys use a different subdomain each time (*.vercel.app). By default we
 *   allow any https origin whose host ends with .vercel.app so you do not need extra Render env.
 * - Set CORS_STRICT=true to allow only CLIENT_URL + CORS_ORIGINS (comma-separated).
 * - Optional: CORS_ALLOW_VERCEL=false with CORS_STRICT=true disables *.vercel.app (same as strict).
 */
function createOriginHandler() {
  const strict =
    process.env.CORS_STRICT === 'true' || process.env.CORS_STRICT === '1';
  const allowVercelExplicit =
    process.env.CORS_ALLOW_VERCEL !== 'false' && process.env.CORS_ALLOW_VERCEL !== '0';

  const explicit = [
    process.env.CLIENT_URL,
    ...(process.env.CORS_ORIGINS || '').split(','),
  ]
    .map((s) => (typeof s === 'string' ? s.trim() : ''))
    .filter(Boolean);

  const isVercelOrigin = (origin) => {
    try {
      const { hostname, protocol } = new URL(origin);
      return protocol === 'https:' && /\.vercel\.app$/i.test(hostname);
    } catch {
      return false;
    }
  };

  return (origin, callback) => {
    if (!origin) return callback(null, true);
    if (explicit.length === 0) return callback(null, true);
    if (explicit.includes(origin)) return callback(null, true);
    if (!strict && allowVercelExplicit && isVercelOrigin(origin)) {
      return callback(null, true);
    }
    callback(null, false);
  };
}

module.exports = { createOriginHandler };
