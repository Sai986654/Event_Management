const fs = require('fs');
const { prisma } = require('../config/db');
const { r2Client, R2_BUCKET, R2_PUBLIC_URL } = require('../config/r2');
const { PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { generateSpeech } = require('./ttsService');
const { generateInviteVideo, writeTempFile, cleanupFiles, safeUnlink } = require('./ffmpegService');
const { messagingService } = require('./messagingService');
const { inviteQueue } = require('./jobQueue');

const MAX_RETRIES = 2;

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

  // Download template images from R2 to local temp files
  const imageKeys = Array.isArray(job.imageKeys) ? job.imageKeys : [];
  const localImages = [];

  try {
    for (const key of imageKeys) {
      const buf = await downloadFromR2(key);
      const ext = key.match(/\.\w+$/)?.[0] || '.jpg';
      const localPath = writeTempFile(buf, ext);
      localImages.push(localPath);
    }
  } catch (err) {
    await failJob(jobId, `Failed to download template images: ${err.message}`);
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

  // Process each guest sequentially within this job (parallelism is at the job queue level)
  for (const guest of job.guestVideos) {
    const tempFiles = [];
    try {
      // Update guest status
      await prisma.inviteGuestVideo.update({
        where: { id: guest.id },
        data: { status: 'processing' },
      });

      // 1. Generate TTS voice
      const voiceText = `${guest.guestName}, you are invited to our wedding ceremony`;
      const voiceBuffer = await generateSpeech(voiceText);

      // 2. Generate video with FFmpeg
      const { videoPath } = await generateInviteVideo({
        imagePaths: localImages,
        voiceBuffer,
        musicBuffer,
      });
      tempFiles.push(videoPath);

      // 3. Upload finished video to R2
      const videoData = fs.readFileSync(videoPath);
      const videoKey = `invites/${job.eventId}/${sanitizeFilename(guest.guestName)}.mp4`;
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
      if (retries <= MAX_RETRIES) {
        await prisma.inviteGuestVideo.update({
          where: { id: guest.id },
          data: { status: 'pending', retries, error: err.message },
        });
      } else {
        await prisma.inviteGuestVideo.update({
          where: { id: guest.id },
          data: { status: 'failed', retries, error: err.message },
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
  cleanupFiles(localImages);

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

module.exports = { startInviteJobProcessing, uploadToR2 };
