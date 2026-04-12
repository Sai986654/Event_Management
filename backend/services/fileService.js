const crypto = require('crypto');
const { PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { r2Client, R2_BUCKET, R2_PUBLIC_URL } = require('../config/r2');

/**
 * Upload a file buffer to Cloudflare R2.
 * Returns { url, publicId } to stay compatible with the rest of the codebase.
 * @param {Buffer} fileBuffer
 * @param {string} folder
 * @param {{ contentType?: string, originalname?: string }} opts
 */
const uploadFile = async (fileBuffer, folder = 'vedika360', opts = {}) => {
  const uniqueName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
  const key = `${folder}/${uniqueName}`;

  await r2Client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: fileBuffer,
      ContentType: opts.contentType || 'application/octet-stream',
    })
  );

  const url = `${R2_PUBLIC_URL}/${key}`;
  return { url, publicId: key };
};

/**
 * Delete a file from Cloudflare R2 by its key (publicId).
 */
const deleteFile = async (publicId) => {
  await r2Client.send(
    new DeleteObjectCommand({
      Bucket: R2_BUCKET,
      Key: publicId,
    })
  );
};

module.exports = { uploadFile, deleteFile };
