#!/usr/bin/env node
/**
 * Camera Auto-Uploader
 * 
 * Watches a folder for new images (from tethered DSLR, WiFi camera, etc.)
 * and auto-uploads them to the Live Photo Wall API.
 *
 * Usage:
 *   node scripts/camera-uploader.js --folder "C:\Photos\Tethered" --event 42 --token <jwt>
 *
 * Options:
 *   --folder   Path to watch for new images (required)
 *   --event    Event ID to upload to (required)
 *   --token    JWT auth token (required — get from browser DevTools → localStorage → token)
 *   --api      API base URL (default: http://localhost:5000)
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

// ── Parse CLI args ─────────────────────────────────────────────────────
const args = {};
process.argv.slice(2).forEach((arg, i, arr) => {
  if (arg.startsWith('--')) args[arg.slice(2)] = arr[i + 1];
});

const WATCH_FOLDER = args.folder;
const EVENT_ID = args.event;
const TOKEN = args.token;
const API_BASE = args.api || 'http://localhost:5000';

if (!WATCH_FOLDER || !EVENT_ID || !TOKEN) {
  console.error('Usage: node camera-uploader.js --folder <path> --event <id> --token <jwt>');
  console.error('  --folder  Folder to watch for new images');
  console.error('  --event   Event ID');
  console.error('  --token   JWT token (copy from browser localStorage)');
  console.error('  --api     API base URL (default: http://localhost:5000)');
  process.exit(1);
}

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.tiff', '.bmp']);
const uploaded = new Set();

// ── Upload a single file ───────────────────────────────────────────────
function uploadFile(filePath) {
  return new Promise((resolve, reject) => {
    const ext = path.extname(filePath).toLowerCase();
    const fileName = path.basename(filePath);
    const boundary = '----FormBoundary' + Date.now().toString(36);

    const fileData = fs.readFileSync(filePath);

    const mimeTypes = {
      '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
      '.webp': 'image/webp', '.heic': 'image/heic', '.tiff': 'image/tiff',
      '.bmp': 'image/bmp', '.heif': 'image/heif',
    };
    const mime = mimeTypes[ext] || 'image/jpeg';

    // Build multipart form body
    const parts = [];
    // eventId field
    parts.push(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="eventId"\r\n\r\n` +
      `${EVENT_ID}\r\n`
    );
    // file field
    parts.push(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n` +
      `Content-Type: ${mime}\r\n\r\n`
    );

    const header = Buffer.from(parts[0] + parts[1]);
    const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
    const body = Buffer.concat([header, fileData, footer]);

    const url = new URL(`${API_BASE}/api/instant-photos/upload`);
    const isHttps = url.protocol === 'https:';
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
      },
    };

    const req = (isHttps ? https : http).request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 201) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Watch folder for new files ─────────────────────────────────────────
function startWatching() {
  console.log('📷 Camera Auto-Uploader');
  console.log(`   Watching : ${WATCH_FOLDER}`);
  console.log(`   Event ID : ${EVENT_ID}`);
  console.log(`   API      : ${API_BASE}`);
  console.log('   Waiting for new images...\n');

  // Index existing files so we only upload NEW ones
  if (fs.existsSync(WATCH_FOLDER)) {
    fs.readdirSync(WATCH_FOLDER).forEach((f) => uploaded.add(f));
    console.log(`   (skipping ${uploaded.size} existing files)\n`);
  } else {
    console.error(`Folder not found: ${WATCH_FOLDER}`);
    process.exit(1);
  }

  fs.watch(WATCH_FOLDER, { persistent: true }, async (eventType, filename) => {
    if (!filename) return;
    if (uploaded.has(filename)) return;

    const ext = path.extname(filename).toLowerCase();
    if (!IMAGE_EXTENSIONS.has(ext)) return;

    const filePath = path.join(WATCH_FOLDER, filename);

    // Wait briefly for file write to complete (tethering may write in chunks)
    await delay(500);
    if (!fs.existsSync(filePath)) return;

    // Check file size is stable (not still being written)
    let prevSize = 0;
    for (let i = 0; i < 10; i++) {
      const stat = fs.statSync(filePath);
      if (stat.size > 0 && stat.size === prevSize) break;
      prevSize = stat.size;
      await delay(300);
    }

    uploaded.add(filename);

    try {
      console.log(`⬆️  Uploading: ${filename}...`);
      const result = await uploadFile(filePath);
      console.log(`✅ Uploaded:  ${filename} → live wall (ID: ${result.photo?.id})`);
    } catch (err) {
      console.error(`❌ Failed:    ${filename} — ${err.message}`);
      uploaded.delete(filename); // allow retry
    }
  });
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

startWatching();
