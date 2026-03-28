module.exports = {
  /** Shown on public invite page and organizer Event details — editable via env. */
  inviteCopy: {
    tagline:
      process.env.INVITE_PUBLIC_TAGLINE ||
      "If you can't join us in person, you're still part of our day — scan the QR on your invitation.",
    details:
      process.env.INVITE_PUBLIC_DETAILS ||
      'Send blessings, gift via UPI using the QR, and upload photos for our album and AI collage. Our organizer will receive everything and honour your presence at the celebration.',
  },
  gifting: {
    enabled: String(process.env.INVITE_GIFTING_ENABLED || 'true').toLowerCase() !== 'false',
    upiId: process.env.INVITE_GIFT_UPI_ID || '',
    payeeName: process.env.INVITE_GIFT_PAYEE_NAME || 'Event Family',
    defaultNote: process.env.INVITE_GIFT_NOTE || 'Blessings for your special day',
  },
  remoteBlessings: {
    enabled: String(process.env.INVITE_REMOTE_BLESSINGS_ENABLED || 'true').toLowerCase() !== 'false',
    autoApprove: String(process.env.INVITE_REMOTE_BLESSINGS_AUTO_APPROVE || 'false').toLowerCase() === 'true',
  },
  collage: {
    enabled: String(process.env.INVITE_AI_COLLAGE_ENABLED || 'true').toLowerCase() !== 'false',
    provider: process.env.INVITE_AI_COLLAGE_PROVIDER || 'mock',
    dryRun: String(process.env.INVITE_AI_COLLAGE_DRY_RUN || 'true').toLowerCase() !== 'false',
    minPhotos: Number(process.env.INVITE_AI_COLLAGE_MIN_PHOTOS || 2),
    defaultStyle: process.env.INVITE_AI_COLLAGE_DEFAULT_STYLE || 'traditional',
    allowedStyles: String(process.env.INVITE_AI_COLLAGE_ALLOWED_STYLES || 'traditional,modern,cinematic')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  },
};
