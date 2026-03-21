const { collage, remoteBlessings } = require('../config/inviteConfig');

const jobsByEvent = new Map();

const makeJobId = (eventId) => `collage_${eventId}_${Date.now().toString(36)}`;

const normalizeStyle = (style) => {
  const picked = String(style || collage.defaultStyle || 'traditional').toLowerCase();
  return collage.allowedStyles.includes(picked) ? picked : collage.defaultStyle;
};

const createJob = (eventId, style) => {
  const job = {
    jobId: makeJobId(eventId),
    eventId,
    status: 'processing',
    provider: collage.provider,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    resultUrl: null,
    mediaId: null,
    usedPhotos: 0,
    style: normalizeStyle(style),
    note: collage.dryRun ? 'Running in dry-run/mock mode.' : 'Running with configured AI provider.',
  };
  jobsByEvent.set(eventId, job);
  return job;
};

const completeJob = (eventId, updates) => {
  const prev = jobsByEvent.get(eventId);
  if (!prev) return null;
  const next = {
    ...prev,
    ...updates,
    status: 'completed',
    updatedAt: new Date().toISOString(),
  };
  jobsByEvent.set(eventId, next);
  return next;
};

const failJob = (eventId, message) => {
  const prev = jobsByEvent.get(eventId);
  if (!prev) return null;
  const next = {
    ...prev,
    status: 'failed',
    error: message,
    updatedAt: new Date().toISOString(),
  };
  jobsByEvent.set(eventId, next);
  return next;
};

const getJob = (eventId) => jobsByEvent.get(eventId) || null;

const collageEnabled = () => collage.enabled && remoteBlessings.enabled;

module.exports = {
  createJob,
  completeJob,
  failJob,
  getJob,
  collageEnabled,
  minPhotos: collage.minPhotos,
  defaultStyle: collage.defaultStyle,
  allowedStyles: collage.allowedStyles,
  normalizeStyle,
};
