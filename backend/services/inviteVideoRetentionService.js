const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { prisma } = require('../config/db');
const { r2Client, R2_BUCKET } = require('../config/r2');

function retentionDays() {
  const raw = Number(process.env.INVITE_VIDEO_RETENTION_DAYS || 7);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 7;
}

function cleanupBatchSize() {
  const raw = Number(process.env.INVITE_VIDEO_CLEANUP_BATCH || 50);
  if (!Number.isFinite(raw)) return 50;
  return Math.min(Math.max(Math.floor(raw), 1), 500);
}

function isCleanupDryRun() {
  return String(process.env.INVITE_VIDEO_CLEANUP_DRY_RUN || 'false').toLowerCase() === 'true';
}

async function deleteKeyFromR2(key) {
  await r2Client.send(
    new DeleteObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
    })
  );
}

async function cleanupExpiredInviteVideos() {
  const days = retentionDays();
  const batch = cleanupBatchSize();
  const dryRun = isCleanupDryRun();

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const candidates = await prisma.inviteGuestVideo.findMany({
    where: {
      status: 'completed',
      videoKey: { not: null },
      createdAt: { lte: cutoff },
    },
    take: batch,
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      videoKey: true,
      createdAt: true,
    },
  });

  let deleted = 0;
  let failed = 0;

  for (const row of candidates) {
    const key = row.videoKey;
    if (!key) continue;

    try {
      if (!dryRun) {
        await deleteKeyFromR2(key);
      }

      await prisma.inviteGuestVideo.update({
        where: { id: row.id },
        data: {
          videoKey: null,
          videoUrl: null,
          error: `Auto-deleted after ${days} days (${new Date().toISOString()})`,
        },
      });

      deleted++;
    } catch (err) {
      failed++;
      console.error(`[InviteVideoRetention] Failed for inviteGuestVideo=${row.id}: ${err.message}`);
    }
  }

  return {
    retentionDays: days,
    dryRun,
    checked: candidates.length,
    deleted,
    failed,
    cutoff: cutoff.toISOString(),
  };
}

module.exports = {
  cleanupExpiredInviteVideos,
};
