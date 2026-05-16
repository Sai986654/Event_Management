const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1']);

const normalizeBaseUrl = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return raw.replace(/\/+$/, '');
};

const isLocalBaseUrl = (value) => {
  const normalized = normalizeBaseUrl(value);
  if (!normalized) return false;
  try {
    const parsed = new URL(normalized);
    return LOCAL_HOSTNAMES.has(parsed.hostname);
  } catch (_err) {
    return false;
  }
};

const forwardedOrigin = (req) => {
  const proto = String(req?.headers?.['x-forwarded-proto'] || '').split(',')[0].trim();
  const host = String(req?.headers?.['x-forwarded-host'] || '').split(',')[0].trim();
  if (!proto || !host) return '';
  return `${proto}://${host}`;
};

const resolveClientBaseUrl = (req) => {
  const candidates = [
    process.env.PUBLIC_INVITE_BASE_URL,
    process.env.PUBLIC_CLIENT_URL,
    process.env.CLIENT_URL,
    process.env.FRONTEND_URL,
    process.env.WEB_URL,
    process.env.APP_URL,
    req?.get?.('origin'),
    forwardedOrigin(req),
  ]
    .map(normalizeBaseUrl)
    .filter(Boolean);

  if (String(process.env.NODE_ENV || '').toLowerCase() === 'production') {
    const nonLocal = candidates.find((item) => !isLocalBaseUrl(item));
    if (nonLocal) return nonLocal;
  }

  return candidates[0] || 'http://localhost:3000';
};

module.exports = {
  resolveClientBaseUrl,
  isLocalBaseUrl,
};
