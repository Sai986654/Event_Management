#!/usr/bin/env node
/*
 * Applies generated vendor webhook env snippet into backend/.env.
 * Idempotent: updates existing keys and appends missing ones.
 */

const fs = require('fs');
const path = require('path');

const backendDir = process.cwd();
const projectRoot = path.resolve(backendDir, '..');
const snippetPath = path.join(projectRoot, 'automation', 'vendor-webhook', '.env.vendor-webhook');
const envPath = path.join(backendDir, '.env');

function parseEnvLines(text) {
  const map = new Map();
  text.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eq = line.indexOf('=');
    if (eq <= 0) return;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1);
    if (key) map.set(key, value);
  });
  return map;
}

function updateEnvContent(existingContent, updatesMap) {
  const lines = existingContent ? existingContent.split(/\r?\n/) : [];
  const applied = new Set();

  const updatedLines = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return line;

    const eq = line.indexOf('=');
    if (eq <= 0) return line;

    const key = line.slice(0, eq).trim();
    if (!updatesMap.has(key)) return line;

    applied.add(key);
    return `${key}=${updatesMap.get(key)}`;
  });

  const missing = [];
  for (const [key, value] of updatesMap.entries()) {
    if (!applied.has(key)) missing.push(`${key}=${value}`);
  }

  let output = updatedLines.join('\n');
  if (missing.length) {
    if (output.trim().length > 0 && !output.endsWith('\n')) output += '\n';
    output += (output.trim().length > 0 ? '\n' : '') + '# Vendor webhook (auto-managed)\n';
    output += missing.join('\n') + '\n';
  } else if (!output.endsWith('\n')) {
    output += '\n';
  }

  return output;
}

function main() {
  if (!fs.existsSync(snippetPath)) {
    console.error(`Snippet file not found: ${snippetPath}`);
    console.error('Run bootstrap first: npm run vendor:webhook:bootstrap -- --base-url=https://your-domain.com');
    process.exit(1);
  }

  const snippet = fs.readFileSync(snippetPath, 'utf8');
  const updates = parseEnvLines(snippet);
  if (updates.size === 0) {
    console.error('No valid env keys found in snippet file.');
    process.exit(1);
  }

  const existing = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  const next = updateEnvContent(existing, updates);

  fs.writeFileSync(envPath, next, 'utf8');
  console.log(`Applied ${updates.size} env key(s) to ${envPath}`);
  for (const key of updates.keys()) {
    console.log(`- ${key}`);
  }
}

main();
