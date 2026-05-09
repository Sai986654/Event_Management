const fs = require('fs');
const path = require('path');
const { prisma } = require('../config/db');
const { r2Client, R2_BUCKET, R2_PUBLIC_URL } = require('../config/r2');
const { PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { generateSpeech } = require('./ttsService');
const TTS_PROVIDER = process.env.TTS_PROVIDER || 'gtts';
const {
  generateInviteVideo,
  attachAudioToBaseInviteVideo,
  writeTempFile,
  cleanupFiles,
  safeUnlink,
  preResizeImage,
} = require('./ffmpegService');
const { messagingService } = require('./messagingService');
const { inviteQueue } = require('./jobQueue');

// Maximum retry attempts after the first failure.
const MAX_RETRIES = 2;

function isNonRetryableTtsError(err) {
  const msg = String(err?.message || '');
  // Only consider it non-retryable if ALL providers have been exhausted
  return (
    /All\s+TTS\s+providers\s+failed/i.test(msg) ||
    // Network/system errors that won't be fixed by retrying
    /ENOTFOUND|ECONNREFUSED|ECONNRESET|timeout/i.test(msg)
  );
}

function timestampKeyPart(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function normalizeExt(ext, fallback = 'bin') {
  const cleaned = String(ext || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return cleaned || fallback;
}

function buildInviteStorageKey({
  eventId,
  jobId,
  guestId,
  guestName,
  mediaGroup,
  mediaKind,
  extension,
  index,
  requestId,
}) {
  const ts = timestampKeyPart();
  const eventPart = `event-${Number(eventId) || 0}`;
  const jobPart = jobId ? `job-${Number(jobId)}` : null;
  const reqPart = requestId ? `req-${String(requestId).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32)}` : null;
  const ext = normalizeExt(extension, mediaKind === 'video' ? 'mp4' : mediaKind === 'audio' ? 'mp3' : 'jpg');

  const baseSegments = ['invites', 'events', eventPart];
  if (jobPart) baseSegments.push('jobs', jobPart);
  if (reqPart) baseSegments.push(reqPart);

  if (mediaGroup === 'generated' && guestId) {
    const guestSlug = sanitizeFilename(guestName || 'guest');
    return `${baseSegments.join('/')}/generated/guest-${guestId}-${guestSlug}/${ts}-${mediaKind}.${ext}`;
  }

  if (mediaGroup === 'template-images') {
    const idx = Number.isFinite(index) ? index : 0;
    return `${baseSegments.join('/')}/template/images/${ts}-image-${idx}.${ext}`;
  }

  if (mediaGroup === 'template-music') {
    return `${baseSegments.join('/')}/template/music/${ts}-music.${ext}`;
  }

  return `${baseSegments.join('/')}/${ts}-${mediaKind}.${ext}`;
}

/**
 * Upload a buffer to R2 and return the public URL + key.
 */
async function uploadToR2(buffer, key, contentType = 'application/octet-stream') {
  await r2Client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );
  return `${R2_PUBLIC_URL}/${key}`;
}

/**
 * Download a file from R2 by key and return the buffer.
 */
async function downloadFromR2(key) {
  const resp = await r2Client.send(
    new GetObjectCommand({ Bucket: R2_BUCKET, Key: key })
  );
  const chunks = [];
  for await (const chunk of resp.Body) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function downloadAssetBuffer(assetRef) {
  const ref = String(assetRef || '').trim();
  if (!ref) {
    throw new Error('Missing asset reference');
  }

  if (/^https?:\/\//i.test(ref)) {
    const response = await fetch(ref);
    if (!response.ok) {
      throw new Error(`Failed to fetch asset: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      ext: path.extname(new URL(ref).pathname) || '.bin',
      contentType: response.headers.get('content-type') || 'application/octet-stream',
    };
  }

  const buffer = await downloadFromR2(ref);
  return {
    buffer,
    ext: path.extname(ref) || '.bin',
    contentType: 'application/octet-stream',
  };
}

/**
 * Start processing an invite job.
 * Called from the controller — returns immediately, processing happens in the background.
 *
 * @param {number} jobId - The InviteJob id.
 * @param {Object} io - Socket.IO instance for real-time updates.
 */
function startInviteJobProcessing(jobId, io) {
  inviteQueue.enqueue(() => processInviteJob(jobId, io));
}

/**
 * Core processing loop for one invite job.
 */
async function processInviteJob(jobId, io) {
  const job = await prisma.inviteJob.findUnique({
    where: { id: jobId },
    include: { guestVideos: true },
  });

  if (!job) {
    console.error(`[InviteJob] Job ${jobId} not found`);
    return;
  }

  // Mark job as processing
  await prisma.inviteJob.update({
    where: { id: jobId },
    data: { status: 'processing' },
  });

  emitProgress(io, job.eventId, jobId, { status: 'processing', processed: 0, total: job.totalGuests });

  // Download template assets from R2/URL to local temp files.
  // Manifest-driven jobs can carry scene descriptors, while legacy jobs still carry string keys.
  const sceneEntries = Array.isArray(job.imageKeys) ? job.imageKeys : [];
  const sceneRenderData = [];

  try {
    for (const [index, entry] of sceneEntries.entries()) {
      const descriptor = typeof entry === 'string' ? { key: entry } : (entry || {});
      const assetRef = String(descriptor.key || descriptor.assetKey || descriptor.path || '').trim();

      if (!assetRef) {
        throw new Error(`Scene ${index + 1} is missing an asset reference`);
      }

      const downloaded = await downloadAssetBuffer(assetRef);
      const rawPath = writeTempFile(downloaded.buffer, downloaded.ext || path.extname(assetRef) || '.bin');
      const isVideo = /\.(mp4|mov|mkv|webm|avi|m4v)$/i.test(rawPath) || /^video\//i.test(downloaded.contentType || '');
      const backgroundPath = isVideo ? rawPath : await preResizeImage(rawPath);

      sceneRenderData.push({
        sceneId: descriptor.sceneId || `scene-${index + 1}`,
        rawPath,
        backgroundPath,
        isVideo,
        durationMs: Number(descriptor.durationMs || descriptor.duration || 0) || 3200,
        texts: Array.isArray(descriptor.texts) ? descriptor.texts : [],
      });
    }
  } catch (err) {
    cleanupFiles(sceneRenderData.flatMap((scene) => [scene.rawPath, scene.backgroundPath].filter(Boolean)));
    await failJob(jobId, `Failed to prepare template images: ${err.message}`);
    emitProgress(io, job.eventId, jobId, { status: 'failed', error: err.message });
    return;
  }

  // Download background music if present
  let musicBuffer = null;
  if (job.musicKey) {
    try {
      musicBuffer = await downloadFromR2(job.musicKey);
    } catch (err) {
      console.warn(`[InviteJob] Music download failed (proceeding without): ${err.message}`);
    }
  }

  let processed = 0;
  let failed = 0;

  // Decode voice narration and overlay text.
  // The mobile app encodes both as: "voice text|||OVERLAY|||overlay text"
  // If no separator, the whole string is the voice text.
  const rawTemplate = job.voiceTemplate || '';
  const OVERLAY_SEP = '|||OVERLAY|||';
  let voiceRawTemplate, jobOverlayText;
  if (rawTemplate.includes(OVERLAY_SEP)) {
    const parts = rawTemplate.split(OVERLAY_SEP);
    voiceRawTemplate = parts[0].trim();
    jobOverlayText = parts[1] ? parts[1].trim() : '';
  } else {
    voiceRawTemplate = rawTemplate;
    jobOverlayText = '';
  }

  // Strip {name} from voice text — the static body is generated ONCE and cached.
  // This means 1 ElevenLabs API call total per unique template, not 1 per guest.
  const baseTextTemplate = (voiceRawTemplate || 'You are cordially invited').replace(/\{name\}/gi, '').trim();
  const videoOverlayText = jobOverlayText || 'You are Invited';
  let baseVoiceBuffer = null;

  // Pre-generate the static voice body once before the guest loop
  if (TTS_PROVIDER === 'elevenlabs' && baseTextTemplate) {
    try {
      baseVoiceBuffer = await generateSpeech(baseTextTemplate, job.voiceLang || 'en');
      console.log(`[InviteJob] ElevenLabs voice pre-generated once for job ${jobId}`);
    } catch (err) {
      if (isNonRetryableTtsError(err)) {
        const guestIds = job.guestVideos
          .filter((g) => g.status === 'pending' || g.status === 'processing')
          .map((g) => g.id);

        if (guestIds.length > 0) {
          await prisma.inviteGuestVideo.updateMany({
            where: { id: { in: guestIds } },
            data: {
              status: 'failed',
              error: `Non-retryable TTS error: ${err.message}`,
            },
          });
        }

          cleanupFiles(sceneRenderData.flatMap((scene) => [scene.rawPath, scene.backgroundPath].filter(Boolean)));
        await failJob(jobId, `Non-retryable TTS error: ${err.message}`);
        emitProgress(io, job.eventId, jobId, { status: 'failed', error: err.message });
        console.error(`[InviteJob] Job ${jobId} failed early due to non-retryable TTS error: ${err.message}`);
        return;
      }

      console.warn(`[InviteJob] ElevenLabs voice generation failed, will retry per guest: ${err.message}`);
    }
  }
  let baseVideoPath = null;
  try {
    const baseRender = await generateInviteVideo({
      scenes: sceneRenderData.map((scene, index) => {
        const descriptor = sceneEntries[index] || {};

        const texts = Array.isArray(descriptor.texts)
          ? descriptor.texts.map((text) => ({
              value: String(text?.value || ''),
              start: typeof text?.start === 'number' ? text.start : 0,
              duration: typeof text?.duration === 'number' ? text.duration : 3,
              x: typeof text?.x === 'number' ? text.x : 0.5,
              y: typeof text?.y === 'number' ? text.y : 0.5,
              maxWidth: typeof text?.maxWidth === 'number' ? text.maxWidth : 0.82,
              maxHeight: typeof text?.maxHeight === 'number' ? text.maxHeight : 0.08,
              align: text?.align || 'center',
              style: text?.style || {},
            }))
          : [];

        if (!texts.length && index === 0 && videoOverlayText) {
          texts.push({ value: videoOverlayText, start: 0.6, duration: 2.6, x: 0.5, y: 0.2, maxWidth: 0.8, maxHeight: 0.08, align: 'center', style: { fontSize: 54, color: '#ffffff' } });
        }

        return {
          background: scene.backgroundPath,
          duration: Number(scene.durationMs || descriptor.durationMs || descriptor.duration || 3200) / 1000,
          texts,
        };
      }),
      musicBuffer: null,
      renderProfile: process.env.FFMPEG_RENDER_PROFILE || 'memory_saver',
    });
    baseVideoPath = baseRender.videoPath;
  } catch (err) {
    cleanupFiles(sceneRenderData.flatMap((scene) => [scene.rawPath, scene.backgroundPath].filter(Boolean)));
    await failJob(jobId, `Failed to render base invite video: ${err.message}`);
    emitProgress(io, job.eventId, jobId, { status: 'failed', error: err.message });
    return;
  }

  // Process only guests still needing work.
  const guestsToProcess = job.guestVideos.filter(
    (g) => g.status === 'pending' || g.status === 'processing'
  );

  // Process each guest sequentially within this job (parallelism is at the job queue level)
  for (const guest of guestsToProcess) {
    const tempFiles = [];
    try {
      // Update guest status
      await prisma.inviteGuestVideo.update({
        where: { id: guest.id },
        data: { status: 'processing' },
      });

      // 1. Generate TTS voice
      // For ElevenLabs: reuse the pre-generated static buffer (name is excluded to save quota).
      // For other providers: generate per guest with the full personalized text.
      let voiceBuffer;
      if (TTS_PROVIDER === 'elevenlabs' && baseVoiceBuffer) {
        voiceBuffer = baseVoiceBuffer; // reuse — 0 extra ElevenLabs chars billed
      } else {
        const template = voiceRawTemplate || 'Dear {name}, you are cordially invited';
        const voiceText = template.replace(/\{name\}/gi, guest.guestName);
        voiceBuffer = await generateSpeech(voiceText, job.voiceLang || 'en');
      }

      // 2. Reuse base visual and only compose personalized audio
      const { videoPath } = await attachAudioToBaseInviteVideo({
        baseVideoPath,
        voiceBuffer,
        musicBuffer,
        renderProfile: process.env.FFMPEG_RENDER_PROFILE || 'memory_saver',
      });
      tempFiles.push(videoPath);

      // 3. Upload finished video to R2
      const videoData = fs.readFileSync(videoPath);
      const videoKey = buildInviteStorageKey({
        eventId: job.eventId,
        jobId: job.id,
        guestId: guest.id,
        guestName: guest.guestName,
        mediaGroup: 'generated',
        mediaKind: 'video',
        extension: 'mp4',
      });
      const videoUrl = await uploadToR2(videoData, videoKey, 'video/mp4');

      // 4. Update guest record
      await prisma.inviteGuestVideo.update({
        where: { id: guest.id },
        data: { status: 'completed', videoKey, videoUrl },
      });

      // 5. Send WhatsApp message
      try {
        const msg = `Hi ${guest.guestName}, you are invited 🎉 Watch your invite: ${videoUrl}`;
        const result = await messagingService.sendMessage(guest.phone, msg);
        if (result.success) {
          await prisma.inviteGuestVideo.update({
            where: { id: guest.id },
            data: { messageSent: true },
          });
        }
      } catch (msgErr) {
        console.error(`[InviteJob] Message send failed for ${guest.guestName}: ${msgErr.message}`);
        // Don't fail the guest just because messaging failed
      }

      processed++;
    } catch (err) {
      console.error(`[InviteJob] Guest ${guest.guestName} failed: ${err.message}`);
      const retries = guest.retries + 1;
      const nonRetryable = isNonRetryableTtsError(err);

      if (!nonRetryable && retries <= MAX_RETRIES) {
        await prisma.inviteGuestVideo.update({
          where: { id: guest.id },
          data: { status: 'pending', retries, error: err.message },
        });
      } else {
        await prisma.inviteGuestVideo.update({
          where: { id: guest.id },
          data: {
            status: 'failed',
            retries,
            error: nonRetryable ? `Non-retryable TTS error: ${err.message}` : err.message,
          },
        });
        failed++;
      }
    } finally {
      cleanupFiles(tempFiles);
    }

    // Update job progress
    await prisma.inviteJob.update({
      where: { id: jobId },
      data: { processed: processed + failed, failed },
    });

    emitProgress(io, job.eventId, jobId, {
      status: 'processing',
      processed: processed + failed,
      failed,
      total: job.totalGuests,
      lastGuest: guest.guestName,
    });
  }

  // Clean up shared temp files (template images)
  cleanupFiles(sceneRenderData.flatMap((scene) => [scene.rawPath, scene.backgroundPath].filter(Boolean)));
  safeUnlink(baseVideoPath);

  // Retry pending guests (those that failed but have retries left)
  const pendingRetries = await prisma.inviteGuestVideo.findMany({
    where: { jobId, status: 'pending', retries: { gt: 0 } },
  });

  if (pendingRetries.length > 0) {
    console.log(`[InviteJob] ${pendingRetries.length} guest(s) queued for retry on job ${jobId}`);
    // Re-enqueue the job for retry processing
    inviteQueue.enqueue(() => processInviteJob(jobId, io));
    return;
  }

  // Final status
  const finalStatus = failed === job.totalGuests ? 'failed' : 'completed';
  await prisma.inviteJob.update({
    where: { id: jobId },
    data: { status: finalStatus, processed, failed },
  });

  emitProgress(io, job.eventId, jobId, { status: finalStatus, processed, failed, total: job.totalGuests });
  console.log(`[InviteJob] Job ${jobId} ${finalStatus}: ${processed} ok, ${failed} failed out of ${job.totalGuests}`);
}

/**
 * Mark a job as failed with an error message.
 */
async function failJob(jobId, error) {
  await prisma.inviteJob.update({
    where: { id: jobId },
    data: { status: 'failed', error },
  });
}

/**
 * Emit real-time progress via Socket.IO.
 */
function emitProgress(io, eventId, jobId, data) {
  if (io) {
    io.to(`event-${eventId}`).emit('invite-job-progress', { jobId, ...data });
  }
}

/**
 * Sanitize guest name for use as a filename.
 */
function sanitizeFilename(name) {
  return name
    .replace(/[^a-zA-Z0-9_\- ]/g, '')
    .replace(/\s+/g, '_')
    .toLowerCase()
    .slice(0, 50) || 'guest';
}

module.exports = { startInviteJobProcessing, uploadToR2, buildInviteStorageKey };
