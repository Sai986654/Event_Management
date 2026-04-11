const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const TEMP_DIR = path.join(os.tmpdir(), 'eventos-invite');

/** Ensure temp directory exists. */
function ensureTempDir() {
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }
  return TEMP_DIR;
}

/** Generate a unique temp file path. */
function tempPath(ext) {
  ensureTempDir();
  return path.join(TEMP_DIR, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`);
}

/**
 * Write buffer to a temp file and return the file path.
 */
function writeTempFile(buffer, ext) {
  const filePath = tempPath(ext);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

/**
 * Run an FFmpeg command and return a promise.
 * @param {string[]} args - FFmpeg arguments.
 * @returns {Promise<void>}
 */
function runFFmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('close', (code) => {
      if (code === 0) return resolve();
      reject(new Error(`FFmpeg exited with code ${code}: ${stderr.slice(-500)}`));
    });
    proc.on('error', (err) => reject(new Error(`FFmpeg spawn error: ${err.message}`)));
  });
}

/**
 * Pre-resize an image to 854x480 JPEG to limit memory during video generation.
 * Returns new file path (caller must clean up).
 */
async function preResizeImage(inputPath) {
  const outPath = tempPath('.jpg');
  await runFFmpeg([
    '-y', '-i', inputPath,
    '-vf', 'scale=854:480:force_original_aspect_ratio=decrease,pad=854:480:(ow-iw)/2:(oh-ih)/2,format=yuvj420p',
    '-q:v', '4',
    '-frames:v', '1',
    outPath,
  ]);
  return outPath;
}

/**
 * Get audio duration in seconds using ffprobe.
 */
function getAudioDuration(audioPath) {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      audioPath,
    ]);
    let out = '';
    proc.stdout.on('data', (d) => { out += d.toString(); });
    proc.on('close', (code) => {
      if (code !== 0) return resolve(12); // default fallback
      resolve(parseFloat(out.trim()) || 12);
    });
    proc.on('error', () => resolve(12));
  });
}

/**
 * Generate a personalized invitation video.
 *
 * @param {Object} opts
 * @param {string[]} opts.imagePaths  - Local paths to 3-5 images.
 * @param {Buffer}   opts.voiceBuffer - MP3 buffer of TTS voice.
 * @param {Buffer|null} opts.musicBuffer - MP3 buffer of background music (optional).
 * @param {string}   [opts.overlayText] - Text to display as subtitle overlay.
 * @returns {Promise<{ videoPath: string }>} Path to the generated MP4.
 */
async function generateInviteVideo({ imagePaths, voiceBuffer, musicBuffer, overlayText }) {
  if (!imagePaths || imagePaths.length < 1) {
    throw new Error('At least 1 image is required');
  }

  const voicePath = writeTempFile(voiceBuffer, '.mp3');
  const outputPath = tempPath('.mp4');

  // Get voice duration to size the video
  const voiceDuration = await getAudioDuration(voicePath);
  const totalDuration = Math.max(voiceDuration + 1, 10); // at least 10s
  const imageCount = imagePaths.length;
  const transitionDur = 0.5; // 0.5s xfade (lighter than 1s)
  const imageDur = Math.max(3, (totalDuration + (imageCount - 1) * transitionDur) / imageCount);

  // ── Build filter_complex ──────────────────────────────────
  // Use 480p (854x480) to cut memory usage on free-tier hosts
  const W = 854;
  const H = 480;

  const inputs = [];
  const filterParts = [];

  // Image inputs — loop each image for imageDur seconds
  for (let i = 0; i < imageCount; i++) {
    inputs.push('-loop', '1', '-t', String(imageDur), '-i', imagePaths[i]);
  }

  // Scale all images to 480p
  for (let i = 0; i < imageCount; i++) {
    filterParts.push(`[${i}]scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p[img${i}]`);
  }

  // Chain xfade transitions between images
  if (imageCount === 1) {
    filterParts.push(`[img0]trim=duration=${totalDuration},setpts=PTS-STARTPTS[vout]`);
  } else {
    let prevLabel = 'img0';
    for (let i = 1; i < imageCount; i++) {
      const offset = i * imageDur - i * transitionDur;
      const outLabel = i === imageCount - 1 ? 'vout' : `xf${i}`;
      filterParts.push(`[${prevLabel}][img${i}]xfade=transition=fade:duration=${transitionDur}:offset=${offset.toFixed(2)}[${outLabel}]`);
      prevLabel = outLabel;
    }
  }

  // Audio inputs
  const voiceInputIdx = imageCount;
  inputs.push('-i', voicePath);

  let audioFilter;
  if (musicBuffer) {
    const musicPath = writeTempFile(musicBuffer, '.mp3');
    const musicInputIdx = imageCount + 1;
    inputs.push('-i', musicPath);
    audioFilter = `[${voiceInputIdx}]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=mono[voice];` +
      `[${musicInputIdx}]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=mono,volume=0.2[bgm];` +
      `[voice][bgm]amix=inputs=2:duration=first:dropout_transition=2[aout]`;
  } else {
    audioFilter = `[${voiceInputIdx}]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=mono[aout]`;
  }

  const fullFilter = filterParts.join(';') + ';' + audioFilter;

  // ── Text overlay (subtitle-style) ──────────────────────────
  let videoMapLabel = '[vout]';
  let textFilePath = null;
  let drawtextFilter = '';

  if (overlayText && overlayText.trim()) {
    // Write text to a file to avoid FFmpeg escaping issues
    textFilePath = tempPath('.txt');
    // Word-wrap long lines (~40 chars per line for 854px)
    const words = overlayText.trim().split(/\s+/);
    const lines = [];
    let line = '';
    for (const w of words) {
      if (line && (line + ' ' + w).length > 40) { lines.push(line); line = w; }
      else { line = line ? line + ' ' + w : w; }
    }
    if (line) lines.push(line);
    fs.writeFileSync(textFilePath, lines.join('\n'));

    drawtextFilter = `;[vout]drawtext=textfile='${textFilePath.replace(/\\/g, '/').replace(/:/g, '\\:')}'` +
      `:fontsize=26:fontcolor=white:x=(w-text_w)/2:y=h-th-36` +
      `:box=1:boxcolor=black@0.55:boxborderw=12:line_spacing=8[vtxt]`;
    videoMapLabel = '[vtxt]';
  }

  const finalFilter = fullFilter + drawtextFilter;

  const args = [
    '-y',
    ...inputs,
    '-filter_complex', finalFilter,
    '-map', videoMapLabel,
    '-map', '[aout]',
    '-c:v', 'libx264',
    '-preset', 'ultrafast',  // fastest encode, lowest memory
    '-crf', '28',            // lower quality = less CPU/RAM
    '-tune', 'stillimage',   // optimized for slideshow content
    '-c:a', 'aac',
    '-b:a', '96k',
    '-movflags', '+faststart',
    '-t', String(totalDuration),
    '-shortest',
    '-threads', '1',         // single-threaded to limit memory
    outputPath,
  ];

  await runFFmpeg(args);

  // Clean up temp voice file and text file
  safeUnlink(voicePath);
  safeUnlink(textFilePath);

  return { videoPath: outputPath };
}

/** Safely delete a file. */
function safeUnlink(filePath) {
  try { if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch { /* ignore */ }
}

/** Clean up an array of file paths. */
function cleanupFiles(paths) {
  for (const p of paths) safeUnlink(p);
}

module.exports = { generateInviteVideo, preResizeImage, writeTempFile, cleanupFiles, safeUnlink, tempPath, ensureTempDir };
