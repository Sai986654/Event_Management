const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const TEMP_DIR = path.join(os.tmpdir(), 'vedika360-invite');

/** Ensure temp directory exists. */
function ensureTempDir() {
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }
  return TEMP_DIR;
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
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

function escapePathForFilter(filePath) {
  return filePath.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");
}

function isVideoFile(filePath) {
  const ext = path.extname(filePath || '').toLowerCase();
  return ['.mp4', '.mov', '.mkv', '.webm', '.avi', '.m4v'].includes(ext);
}

function isImageFile(filePath) {
  const ext = path.extname(filePath || '').toLowerCase();
  return ['.jpg', '.jpeg', '.png', '.webp', '.bmp'].includes(ext);
}

function clampSceneDuration(duration) {
  const num = Number(duration);
  if (!Number.isFinite(num)) return 3;
  return Math.max(2, Math.min(4, num));
}

function pickRandom(list) {
  if (!Array.isArray(list) || list.length === 0) return null;
  return list[Math.floor(Math.random() * list.length)];
}

function sanitizeSceneTextValue(value) {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, ' ').slice(0, 280);
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
  return new Promise((resolve) => {
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

function getVideoDuration(videoPath) {
  return new Promise((resolve) => {
    const proc = spawn('ffprobe', [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      videoPath,
    ]);
    let out = '';
    proc.stdout.on('data', (d) => { out += d.toString(); });
    proc.on('close', (code) => {
      if (code !== 0) return resolve(null);
      const val = parseFloat(out.trim());
      resolve(Number.isFinite(val) && val > 0 ? val : null);
    });
    proc.on('error', () => resolve(null));
  });
}

function collectOverlayAssets(overlayDir) {
  const result = { light: [], grain: [], dust: [] };
  if (!overlayDir || !fs.existsSync(overlayDir)) return result;

  const entries = fs.readdirSync(overlayDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const fullPath = path.join(overlayDir, entry.name);
    const lower = entry.name.toLowerCase();
    if (lower.includes('light') || lower.includes('leak')) result.light.push(fullPath);
    else if (lower.includes('grain') || lower.includes('film')) result.grain.push(fullPath);
    else if (lower.includes('dust') || lower.includes('particle')) result.dust.push(fullPath);
  }

  return result;
}

function alphaExpr(start, duration, fadeIn = 0.35, fadeOut = 0.35) {
  const s = Math.max(0, Number(start) || 0);
  const d = Math.max(0.3, Number(duration) || 1);
  const fi = Math.max(0.1, Math.min(fadeIn, d / 2));
  const fo = Math.max(0.1, Math.min(fadeOut, d / 2));
  const holdUntil = Math.max(s, s + d - fo);
  const end = s + d;
  return `if(lt(t,${s.toFixed(3)}),0,if(lt(t,${(s + fi).toFixed(3)}),(t-${s.toFixed(3)})/${fi.toFixed(3)},if(lt(t,${holdUntil.toFixed(3)}),1,if(lt(t,${end.toFixed(3)}),(${end.toFixed(3)}-t)/${fo.toFixed(3)},0))))`;
}

function yMoveExpr(baseY, start) {
  const y0 = Number(baseY) || 0;
  const s = Math.max(0, Number(start) || 0);
  const riseDur = 0.7;
  const offset = 26;
  return `if(lt(t,${s.toFixed(3)}),${(y0 + offset).toFixed(2)},if(lt(t,${(s + riseDur).toFixed(3)}),${(y0 + offset).toFixed(2)}-((t-${s.toFixed(3)})/${riseDur.toFixed(3)})*${offset},${y0.toFixed(2)}))`;
}

function normalizeNewConfig(config, tempFilesToCleanup) {
  const scenes = Array.isArray(config?.scenes) ? config.scenes : [];
  if (scenes.length === 0) {
    throw new Error('Config must contain at least one scene');
  }

  const renderProfile = resolveRenderProfile(config.renderProfile);

  const normalized = {
    renderProfile,
    fps: Number(config.fps) || renderProfile.defaultFps,
    width: Number(config.width) || renderProfile.defaultWidth,
    height: Number(config.height) || renderProfile.defaultHeight,
    transitionDuration: Math.max(0.3, Math.min(Number(config.transitionDuration) || 0.75, 1.2)),
    transitionMode: config.transitionMode || 'crossfade',
    outputPath: config.outputPath || tempPath('.mp4'),
    musicPath: config.musicPath || null,
    theme: config.theme || 'romantic',
    fontFile: config.fontFile || null,
    musicBeatTimes: Array.isArray(config.musicBeatTimes)
      ? config.musicBeatTimes.map(Number).filter((n) => Number.isFinite(n) && n >= 0).sort((a, b) => a - b)
      : [],
    scenes: [],
  };

  if (config.musicBuffer) {
    const musicPath = writeTempFile(config.musicBuffer, '.mp3');
    tempFilesToCleanup.push(musicPath);
    normalized.musicPath = musicPath;
  }

  let voicePath = null;
  if (config.voicePath) voicePath = config.voicePath;
  if (config.voiceBuffer) {
    voicePath = writeTempFile(config.voiceBuffer, '.mp3');
    tempFilesToCleanup.push(voicePath);
  }
  normalized.voicePath = voicePath;

  const overlayAssets = collectOverlayAssets(config.overlayDir);

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i] || {};
    const background = scene.background;
    if (!background || !fs.existsSync(background)) {
      throw new Error(`Scene ${i + 1} background not found: ${background || 'empty'}`);
    }

    const duration = clampSceneDuration(scene.duration);
    const texts = Array.isArray(scene.texts)
      ? scene.texts
          .map((t) => ({
            value: sanitizeSceneTextValue(t?.value || ''),
            start: Math.max(0, Number(t?.start) || 0),
            duration: Math.max(0.8, Number(t?.duration) || 1.8),
            fontSize: Number(t?.fontSize) || null,
            color: (t?.color || 'white').toString(),
          }))
          .filter((t) => t.value)
      : [];

    const overlayScene = scene.overlays || {};
    normalized.scenes.push({
      background,
      isVideo: isVideoFile(background),
      duration,
      texts,
      overlays: {
        light: overlayScene.light || pickRandom(overlayAssets.light),
        grain: overlayScene.grain || pickRandom(overlayAssets.grain),
        dust: overlayScene.dust || pickRandom(overlayAssets.dust),
      },
    });
  }

  return normalized;
}

function normalizeLegacyConfig(config) {
  const imagePaths = Array.isArray(config?.imagePaths) ? config.imagePaths.filter((p) => p && fs.existsSync(p)) : [];
  if (imagePaths.length === 0) {
    throw new Error('At least 1 image is required');
  }

  // Guarantee every photo is shown for at least 2.5 seconds.
  // With 4 photos at 2.5s each + 3 crossfades of 0.75s = 10s - 2.25s = 7.75s total.
  const PER_PHOTO_DURATION = Math.max(2.5, 3.2);
  const scenes = imagePaths.map((img, index) => ({
    background: img,
    duration: PER_PHOTO_DURATION,
    texts:
      index === 0 && config.overlayText
        ? [{ value: String(config.overlayText), start: 0.6, duration: 2.6, fontSize: 54, color: 'white' }]
        : [],
  }));

  return {
    scenes,
    renderProfile: config.renderProfile || process.env.FFMPEG_RENDER_PROFILE || 'memory_saver',
    transitionDuration: 0.75,
    transitionMode: 'crossfade',
    musicBuffer: config.musicBuffer || null,
    voiceBuffer: config.voiceBuffer || null,
    theme: 'romantic',
  };
}

function themeProfile(themeName) {
  const theme = (themeName || '').toLowerCase();
  if (theme === 'modern') {
    return {
      eq: 'eq=contrast=0.96:saturation=1.03:brightness=0.01:gamma=1.01',
      balance: 'colorbalance=rs=0.01:gs=0.01:bs=0.02',
      vignette: 'vignette=PI/6',
      fontSizeScale: 1,
    };
  }
  if (theme === 'royal') {
    return {
      eq: 'eq=contrast=0.95:saturation=1.10:brightness=0.02:gamma=1.02',
      balance: 'colorbalance=rs=0.06:gs=0.02:bs=-0.01',
      vignette: 'vignette=PI/4',
      fontSizeScale: 1.04,
    };
  }

  return {
    eq: 'eq=contrast=0.94:saturation=1.08:brightness=0.02:gamma=1.02',
    balance: 'colorbalance=rs=0.05:gs=0.01:bs=-0.02',
    vignette: 'vignette=PI/5',
    fontSizeScale: 1,
  };
}

function nearestBeat(time, beats, usedMinTime) {
  if (!Array.isArray(beats) || beats.length === 0) return time;
  let best = null;
  let bestDiff = Number.POSITIVE_INFINITY;
  for (const beat of beats) {
    if (beat <= usedMinTime + 0.08) continue;
    const diff = Math.abs(beat - time);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = beat;
    }
  }
  if (best === null || bestDiff > 0.28) return time;
  return best;
}

function resolveRenderProfile(profileName) {
  const key = String(profileName || process.env.FFMPEG_RENDER_PROFILE || 'balanced').toLowerCase();
  if (key === 'memory_saver' || key === 'memory-saver' || key === 'lowmem') {
    return {
      name: 'memory_saver',
      defaultWidth: 1280,
      defaultHeight: 720,
      defaultFps: 24,
      scaleMultiplier: 1.15,
      maxOverlaysPerScene: 1,
      videoPreset: 'veryfast',
      crf: '24',
      audioBitrate: '128k',
      threads: '1',
      x264Params: 'rc-lookahead=10:ref=2:subme=4:me=dia',
    };
  }

  if (key === 'quality' || key === 'cinematic') {
    return {
      name: 'quality',
      defaultWidth: 1920,
      defaultHeight: 1080,
      defaultFps: 30,
      scaleMultiplier: 1.28,
      maxOverlaysPerScene: 3,
      videoPreset: 'medium',
      crf: '21',
      audioBitrate: '192k',
      threads: process.env.FFMPEG_THREADS || '2',
      x264Params: 'rc-lookahead=20:ref=3:subme=6',
    };
  }

  return {
    name: 'balanced',
    defaultWidth: 1600,
    defaultHeight: 900,
    defaultFps: 30,
    scaleMultiplier: 1.22,
    maxOverlaysPerScene: 2,
    videoPreset: 'faster',
    crf: '23',
    audioBitrate: '160k',
    threads: process.env.FFMPEG_THREADS || '1',
    x264Params: 'rc-lookahead=14:ref=2:subme=5',
  };
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
async function generateInviteVideo({ imagePaths, voiceBuffer, musicBuffer, overlayText, renderProfile }) {
  const tempFilesToCleanup = [];

  try {
    const config = Array.isArray(imagePaths)
      ? normalizeNewConfig(normalizeLegacyConfig({ imagePaths, voiceBuffer, musicBuffer, overlayText, renderProfile }), tempFilesToCleanup)
      : normalizeNewConfig(arguments[0], tempFilesToCleanup);

    const { width: W, height: H, fps, scenes, transitionDuration, outputPath, fontFile, theme, renderProfile: rpf } = config;
    const themeCfg = themeProfile(theme);

    ensureDir(path.dirname(outputPath));

    const inputs = [];
    const filters = [];
    const sceneOutputLabels = [];
    const textFilePaths = [];

    const pushInput = (inputArgs) => {
      inputs.push(...inputArgs);
      return inputs.filter((arg) => arg === '-i').length - 1;
    };

    for (let sceneIdx = 0; sceneIdx < scenes.length; sceneIdx++) {
      const scene = scenes[sceneIdx];
      const duration = scene.duration;

      const bgInputIdx = scene.isVideo
        ? pushInput(['-stream_loop', '-1', '-t', String(duration), '-i', scene.background])
        : pushInput(['-loop', '1', '-t', String(duration), '-i', scene.background]);

      const sceneBase = `s${sceneIdx}base`;
      const sceneGraded = `s${sceneIdx}grade`;
      const frames = Math.ceil(duration * fps);
      const maxZoom = sceneIdx % 2 === 0 ? 1.11 : 1.09;
      const zoomExpr = `if(lte(on,1),1.0,min(${maxZoom.toFixed(3)},zoom+0.00055))`;
      const xExpr = `(iw-iw/zoom)/2+sin(on/60)*18`;
      const yExpr = `(ih-ih/zoom)/2+cos(on/75)*12`;

      filters.push(
        `[${bgInputIdx}:v]format=yuv420p,fps=${fps},` +
          `scale=${Math.ceil(W * rpf.scaleMultiplier)}:${Math.ceil(H * rpf.scaleMultiplier)}:force_original_aspect_ratio=increase,` +
          `zoompan=z='${zoomExpr}':x='${xExpr}':y='${yExpr}':d=${frames}:s=${W}x${H}:fps=${fps},` +
          `trim=duration=${duration.toFixed(3)},setpts=PTS-STARTPTS[${sceneBase}]`
      );

      filters.push(
        `[${sceneBase}]${themeCfg.eq},${themeCfg.balance},curves=all='0/0 0.45/0.42 1/1',${themeCfg.vignette}[${sceneGraded}]`
      );

      let currentLabel = sceneGraded;
      const overlayDefs = [
        { key: 'light', opacity: 0.16, mode: 'overlay' },
        { key: 'grain', opacity: 0.12, mode: 'blend' },
        { key: 'dust', opacity: 0.10, mode: 'overlay' },
      ].slice(0, rpf.maxOverlaysPerScene);

      for (const overlayDef of overlayDefs) {
        const overlayPath = scene.overlays?.[overlayDef.key];
        if (!overlayPath || !fs.existsSync(overlayPath)) continue;

        const overlayIsVideo = isVideoFile(overlayPath);
        const ovInputIdx = overlayIsVideo
          ? pushInput(['-stream_loop', '-1', '-t', String(duration), '-i', overlayPath])
          : pushInput(['-loop', '1', '-t', String(duration), '-i', overlayPath]);

        const ovPrepared = `s${sceneIdx}_${overlayDef.key}_prep`;
        const ovOut = `s${sceneIdx}_${overlayDef.key}_out`;
        filters.push(
          `[${ovInputIdx}:v]format=rgba,fps=${fps},scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},colorchannelmixer=aa=${overlayDef.opacity}[${ovPrepared}]`
        );

        if (overlayDef.mode === 'blend') {
          filters.push(
            `[${currentLabel}][${ovPrepared}]blend=all_mode=overlay:all_opacity=${overlayDef.opacity}[${ovOut}]`
          );
        } else {
          filters.push(
            `[${currentLabel}][${ovPrepared}]overlay=(W-w)/2:(H-h)/2:shortest=1:format=auto[${ovOut}]`
          );
        }
        currentLabel = ovOut;
      }

      const textEntries = Array.isArray(scene.texts) ? scene.texts : [];
      for (let textIdx = 0; textIdx < textEntries.length; textIdx++) {
        const text = textEntries[textIdx];
        const txtPath = tempPath('.txt');
        fs.writeFileSync(txtPath, text.value, 'utf8');
        textFilePaths.push(txtPath);
        tempFilesToCleanup.push(txtPath);

        const textLabel = `s${sceneIdx}t${textIdx}`;
        const baseY = H * (0.34 + textIdx * 0.11);
        const fontSize = Math.round((text.fontSize || (textIdx === 0 ? 70 : 52)) * themeCfg.fontSizeScale);
        const fontOpt = fontFile ? `:fontfile='${escapePathForFilter(fontFile)}'` : '';
        const alpha = alphaExpr(text.start, text.duration, 0.4, 0.45);
        const yExprText = yMoveExpr(baseY, text.start);

        filters.push(
          `[${currentLabel}]drawtext=textfile='${escapePathForFilter(txtPath)}'${fontOpt}` +
            `:fontsize=${fontSize}:fontcolor=${text.color}:line_spacing=10:x=(w-text_w)/2:y='${yExprText}'` +
            `:alpha='${alpha}':shadowx=2:shadowy=2:shadowcolor=black@0.35[${textLabel}]`
        );

        currentLabel = textLabel;
      }

      sceneOutputLabels.push(currentLabel);
    }

    const xfadeTransitions = ['fade', 'fadeblack', 'dissolve', 'smoothleft', 'smoothright'];
    let finalVideoLabel;
    const sceneDurations = scenes.map((s) => s.duration);

    if (sceneOutputLabels.length === 1) {
      finalVideoLabel = sceneOutputLabels[0];
    } else {
      let cumulative = sceneDurations[0];
      let prevOut = sceneOutputLabels[0];
      let lastOffsetUsed = 0;
      for (let i = 1; i < sceneOutputLabels.length; i++) {
        const outLabel = i === sceneOutputLabels.length - 1 ? 'vout' : `vxf${i}`;
        const preferredOffset = cumulative - i * transitionDuration;
        const beatOffset = nearestBeat(preferredOffset, config.musicBeatTimes, lastOffsetUsed);
        const offset = Math.max(lastOffsetUsed + 0.15, beatOffset);
        lastOffsetUsed = offset;
        const transition = xfadeTransitions[(i - 1) % xfadeTransitions.length];
        filters.push(
          `[${prevOut}][${sceneOutputLabels[i]}]xfade=transition=${transition}:duration=${transitionDuration}:offset=${offset.toFixed(3)}[${outLabel}]`
        );
        prevOut = outLabel;
        cumulative += sceneDurations[i];
      }
      finalVideoLabel = 'vout';
    }

    const totalDuration = sceneDurations.reduce((sum, d) => sum + d, 0) - transitionDuration * Math.max(0, scenes.length - 1);

    let audioLabel = null;
    if (config.musicPath && fs.existsSync(config.musicPath)) {
      const musicInput = pushInput(['-stream_loop', '-1', '-i', config.musicPath]);
      filters.push(
        `[${musicInput}:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,` +
          `atrim=0:${totalDuration.toFixed(3)},asetpts=PTS-STARTPTS,volume=0.7,` +
          `afade=t=out:st=${Math.max(0, totalDuration - 1).toFixed(3)}:d=1.0[musicbed]`
      );
      audioLabel = 'musicbed';
    }

    if (config.voicePath && fs.existsSync(config.voicePath)) {
      const voiceInput = pushInput(['-i', config.voicePath]);
      filters.push(
        `[${voiceInput}:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=mono,` +
          `atrim=0:${totalDuration.toFixed(3)},asetpts=PTS-STARTPTS,volume=1.0[voiceover]`
      );

      if (audioLabel) {
        filters.push(`[voiceover][${audioLabel}]amix=inputs=2:duration=longest:weights='1 0.55':dropout_transition=0.8[aout]`);
        audioLabel = 'aout';
      } else {
        audioLabel = 'voiceover';
      }
    }

    if (!audioLabel) {
      const silentDuration = Math.max(2, totalDuration).toFixed(3);
      filters.push(`anullsrc=r=44100:cl=stereo,atrim=0:${silentDuration}[aout]`);
      audioLabel = 'aout';
    }

    const filterComplex = filters.join(';');
    const args = [
      '-y',
      ...inputs,
      '-filter_complex',
      filterComplex,
      '-map',
      `[${finalVideoLabel}]`,
      '-map',
      `[${audioLabel}]`,
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-profile:v',
      'high',
      '-level',
      '4.1',
      '-preset',
      rpf.videoPreset,
      '-crf',
      rpf.crf,
      '-threads',
      rpf.threads,
      '-x264-params',
      rpf.x264Params,
      '-r',
      String(fps),
      '-g',
      String(fps * 2),
      '-c:a',
      'aac',
      '-b:a',
      rpf.audioBitrate,
      '-movflags',
      '+faststart',
      '-shortest',
      outputPath,
    ];

    await runFFmpeg(args);
    return { videoPath: outputPath, duration: totalDuration };
  } finally {
    cleanupFiles(tempFilesToCleanup);
  }
}

/**
 * Attach personalized audio (voice + optional music) to an already-rendered base invite video.
 * This avoids re-encoding complex visuals for every guest.
 */
async function attachAudioToBaseInviteVideo({
  baseVideoPath,
  voiceBuffer,
  musicBuffer,
  outputPath,
  renderProfile,
}) {
  if (!baseVideoPath || !fs.existsSync(baseVideoPath)) {
    throw new Error('Base video not found for audio compositing');
  }
  if (!voiceBuffer) {
    throw new Error('voiceBuffer is required for personalized audio compositing');
  }

  const tempFilesToCleanup = [];
  const rpf = resolveRenderProfile(renderProfile);

  try {
    const voicePath = writeTempFile(voiceBuffer, '.mp3');
    tempFilesToCleanup.push(voicePath);

    let musicPath = null;
    if (musicBuffer) {
      musicPath = writeTempFile(musicBuffer, '.mp3');
      tempFilesToCleanup.push(musicPath);
    }

    const finalOutputPath = outputPath || tempPath('.mp4');
    ensureDir(path.dirname(finalOutputPath));

    // Determine full video duration so we can pad audio to match all photos.
    const videoDuration = await getVideoDuration(baseVideoPath);
    const padTarget = videoDuration ? videoDuration.toFixed(3) : '30';

    const args = ['-y', '-i', baseVideoPath, '-i', voicePath];
    // Pad voice audio to fill the full video so -shortest doesn't cut photos short.
    let filterComplex =
      `[1:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=mono,` +
      `volume=1.0,apad=whole_dur=${padTarget}[voice]`;

    if (musicPath) {
      args.push('-stream_loop', '-1', '-i', musicPath);
      filterComplex +=
        `;[2:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,` +
        `volume=0.55,atrim=0:${padTarget},asetpts=PTS-STARTPTS,` +
        `afade=t=out:st=${Math.max(0, Number(padTarget) - 1).toFixed(3)}:d=1.0[music]` +
        `;[voice][music]amix=inputs=2:duration=longest:weights='1 0.5':dropout_transition=0.8[aout]`;
    } else {
      filterComplex += ';[voice]anull[aout]';
    }

    args.push(
      '-filter_complex', filterComplex,
      '-map', '0:v:0',
      '-map', '[aout]',
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-b:a', rpf.audioBitrate,
      '-movflags', '+faststart',
      ...(videoDuration ? ['-t', padTarget] : []),
      finalOutputPath
    );

    await runFFmpeg(args);
    return { videoPath: finalOutputPath };
  } finally {
    cleanupFiles(tempFilesToCleanup);
  }
}

/** Safely delete a file. */
function safeUnlink(filePath) {
  try { if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch { /* ignore */ }
}

/** Clean up an array of file paths. */
function cleanupFiles(paths) {
  for (const p of paths) safeUnlink(p);
}

module.exports = {
  generateInviteVideo,
  attachAudioToBaseInviteVideo,
  preResizeImage,
  writeTempFile,
  cleanupFiles,
  safeUnlink,
  tempPath,
  ensureTempDir,
};
