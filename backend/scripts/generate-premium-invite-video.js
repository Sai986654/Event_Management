const fs = require('fs');
const path = require('path');
const { generateInviteVideo } = require('../services/ffmpegService');

function loadJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function resolveAbsolute(baseDir, maybePath) {
  if (!maybePath) return maybePath;
  return path.isAbsolute(maybePath) ? maybePath : path.resolve(baseDir, maybePath);
}

function resolveConfigPaths(config, configDir) {
  const next = { ...config };

  next.musicPath = resolveAbsolute(configDir, next.musicPath);
  next.overlayDir = resolveAbsolute(configDir, next.overlayDir);
  next.fontFile = resolveAbsolute(configDir, next.fontFile);
  next.outputPath = resolveAbsolute(configDir, next.outputPath || './output/premium-invite.mp4');

  next.scenes = (next.scenes || []).map((scene) => ({
    ...scene,
    background: resolveAbsolute(configDir, scene.background),
    overlays: {
      light: resolveAbsolute(configDir, scene.overlays?.light),
      grain: resolveAbsolute(configDir, scene.overlays?.grain),
      dust: resolveAbsolute(configDir, scene.overlays?.dust),
    },
  }));

  return next;
}

async function main() {
  const configArg = process.argv[2] || './scripts/sample-premium-invite-config.json';
  if (configArg === '--help' || configArg === '-h') {
    console.log('Usage: node scripts/generate-premium-invite-video.js [config.json]');
    console.log('Default config: ./scripts/sample-premium-invite-config.json');
    return;
  }
  const configPath = path.resolve(process.cwd(), configArg);
  const configDir = path.dirname(configPath);

  if (!fs.existsSync(configPath)) {
    throw new Error(`Config file not found: ${configPath}`);
  }

  const config = resolveConfigPaths(loadJson(configPath), configDir);

  console.log('[invite-video] Rendering cinematic invite...');
  const startedAt = Date.now();
  const result = await generateInviteVideo(config);
  const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);

  console.log(`[invite-video] Done in ${elapsedSec}s`);
  console.log(`[invite-video] Output: ${result.videoPath}`);
  if (result.duration) {
    console.log(`[invite-video] Timeline duration: ${result.duration.toFixed(2)}s`);
  }
}

main().catch((err) => {
  console.error('[invite-video] Failed:', err.message);
  process.exit(1);
});
