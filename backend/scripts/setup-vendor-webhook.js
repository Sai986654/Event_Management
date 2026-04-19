#!/usr/bin/env node
/*
 * One-command setup:
 * 1) bootstrap webhook assets
 * 2) apply generated env keys into backend/.env
 */

const path = require('path');
const { spawnSync } = require('child_process');

const backendDir = process.cwd();
const args = process.argv.slice(2);

function runNodeScript(scriptName, extraArgs = []) {
  const scriptPath = path.join(backendDir, 'scripts', scriptName);
  const result = spawnSync(process.execPath, [scriptPath, ...extraArgs], {
    stdio: 'inherit',
    cwd: backendDir,
  });

  if (typeof result.status === 'number' && result.status !== 0) {
    process.exit(result.status);
  }

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
}

runNodeScript('bootstrap-vendor-webhook.js', args);
runNodeScript('apply-vendor-webhook-env.js');

console.log('\nVendor webhook setup complete.');
console.log('Next:');
console.log('1) Paste automation/vendor-webhook/google-apps-script.gs into Google Form Apps Script');
console.log('2) Create trigger: onFormSubmit -> On form submit');
console.log('3) Run test command from automation/vendor-webhook/test-vendor-webhook.cmd.txt');
