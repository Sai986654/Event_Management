const { Worker } = require('bullmq');
const Redis = require('ioredis');
const sharp = require('sharp');
const { GetObjectCommand, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { r2Client, R2_BUCKET } = require('../config/r2');
const { prisma } = require('../config/db');

// Helper to resolve CDN URLs
const getCdnUrl = (key) => {
  const base = process.env.CLOUDFLARE_CDN_URL || process.env.R2_PUBLIC_URL;
  return `${base.replace(/\/+$/, '')}/${key}`;
};

// Stream helper to read S3 object body as Buffer
const streamToBuffer = (stream) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });

/**
 * Core image processing logic.
 * Resizes, converts to WebP, uploads to R2, and generates base64 blur placeholders.
 */
const optimizeImageJob = async (data) => {
  const { rawKey, vendorId, mediaId, caption } = data;
  console.log(`[Worker] Starting image optimization for Vendor ${vendorId}, Media ID: ${mediaId}`);

  // 1. Fetch raw buffer from R2
  let rawBuffer;
  try {
    const response = await r2Client.send(
      new GetObjectCommand({
        Bucket: R2_BUCKET,
        Key: rawKey,
      })
    );
    rawBuffer = await streamToBuffer(response.Body);
  } catch (err) {
    console.error(`[Worker] Failed to fetch raw image ${rawKey}:`, err.message);
    throw err;
  }

  // 2. Generate optimized formats using sharp
  try {
    const [thumbBuf, cardBuf, detailBuf, blurBuf] = await Promise.all([
      sharp(rawBuffer).resize({ width: 300, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer(),
      sharp(rawBuffer).resize({ width: 600, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer(),
      sharp(rawBuffer).resize({ width: 1200, withoutEnlargement: true }).webp({ quality: 85 }).toBuffer(),
      sharp(rawBuffer).resize({ width: 10, height: 10, fit: 'cover' }).webp({ quality: 20 }).toBuffer(),
    ]);

    const baseName = rawKey.split('/').pop().replace(/\.[^/.]+$/, '');
    const thumbKey = `optimized/vendor-${vendorId}/thumb-${baseName}.webp`;
    const cardKey = `optimized/vendor-${vendorId}/card-${baseName}.webp`;
    const detailKey = `optimized/vendor-${vendorId}/detail-${baseName}.webp`;

    // 3. Upload resized versions to R2
    await Promise.all([
      r2Client.send(new PutObjectCommand({ Bucket: R2_BUCKET, Key: thumbKey, Body: thumbBuf, ContentType: 'image/webp' })),
      r2Client.send(new PutObjectCommand({ Bucket: R2_BUCKET, Key: cardKey, Body: cardBuf, ContentType: 'image/webp' })),
      r2Client.send(new PutObjectCommand({ Bucket: R2_BUCKET, Key: detailKey, Body: detailBuf, ContentType: 'image/webp' })),
    ]);

    // Generate base64 blur data URL
    const blurDataUrl = `data:image/webp;base64,${blurBuf.toString('base64')}`;

    // 4. Update the vendor's portfolio in the DB
    const vendor = await prisma.vendor.findUnique({ where: { id: Number(vendorId) } });
    if (vendor) {
      const portfolio = Array.isArray(vendor.portfolio) ? vendor.portfolio : [];
      const updatedPortfolio = portfolio.map((item) => {
        if (item.id === mediaId) {
          return {
            ...item,
            url: getCdnUrl(detailKey),
            thumbnailUrl: getCdnUrl(thumbKey),
            cardUrl: getCdnUrl(cardKey),
            blurDataUrl,
            loading: false,
          };
        }
        return item;
      });

      await prisma.vendor.update({
        where: { id: vendor.id },
        data: { portfolio: updatedPortfolio },
      });
      console.log(`[Worker] Vendor ${vendorId} portfolio updated successfully`);
    }

    // 5. Clean up the raw temp file
    await r2Client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: rawKey }));
    console.log(`[Worker] Temporary raw file deleted: ${rawKey}`);

  } catch (err) {
    console.error(`[Worker] Image optimization process failed:`, err.message);
    throw err;
  }
};

/**
 * Execute job inline (fallback when Redis queue is down).
 */
const processJobInline = async (name, data) => {
  console.log(`[Worker] Executing job inline: ${name}`);
  if (name === 'optimizeImage') {
    await optimizeImageJob(data);
  } else {
    console.warn(`[Worker] Unknown job name: ${name}`);
  }
};

// Start background worker if Redis is configured
if (process.env.REDIS_URL) {
  try {
    const connection = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
    });

    const worker = new Worker(
      'marketplaceJobs',
      async (job) => {
        if (job.name === 'optimizeImage') {
          await optimizeImageJob(job.data);
        } else {
          console.warn(`[Worker] Unhandled background job: ${job.name}`);
        }
      },
      { connection, concurrency: 2 }
    );

    worker.on('completed', (job) => {
      console.log(`[Worker] Job completed: ${job.id}`);
    });

    worker.on('failed', (job, err) => {
      console.error(`[Worker] Job failed: ${job?.id}, Error:`, err.message);
    });

    console.log('[Worker] BullMQ worker initialized and listening');
  } catch (err) {
    console.error('[Worker] Worker initialization error:', err.message);
  }
}

module.exports = {
  processJobInline,
};
