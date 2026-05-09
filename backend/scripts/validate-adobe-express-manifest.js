#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function isKebabCase(value) {
  return typeof value === 'string' && /^[a-z0-9-]{3,64}$/.test(value);
}

function validateHexOrCssColor(value) {
  if (typeof value !== 'string') return false;
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return true;
  return /^[a-zA-Z][a-zA-Z0-9\s-]{1,30}$/.test(value);
}

function pushError(errors, message) {
  errors.push(message);
}

function validateManifest(manifest) {
  const errors = [];

  if (!isObject(manifest)) {
    pushError(errors, 'Manifest root must be an object.');
    return errors;
  }

  const requiredTopLevel = [
    'manifestVersion',
    'templateKey',
    'templateName',
    'engine',
    'version',
    'editableFields',
    'variantProfiles',
    'outputProfiles',
    'timeline',
  ];

  for (const key of requiredTopLevel) {
    if (!(key in manifest)) {
      pushError(errors, `Missing required top-level key: ${key}`);
    }
  }

  if (!/^\d+\.\d+$/.test(String(manifest.manifestVersion || ''))) {
    pushError(errors, 'manifestVersion must follow major.minor format, e.g. 1.0');
  }

  if (!isKebabCase(manifest.templateKey)) {
    pushError(errors, 'templateKey must be kebab-case (3-64 chars).');
  }

  if (manifest.engine !== 'adobe-express') {
    pushError(errors, 'engine must be "adobe-express".');
  }

  if (!Number.isInteger(manifest.version) || manifest.version < 1) {
    pushError(errors, 'version must be an integer >= 1.');
  }

  if (!Array.isArray(manifest.editableFields) || manifest.editableFields.length === 0) {
    pushError(errors, 'editableFields must be a non-empty array.');
  }

  if (!Array.isArray(manifest.variantProfiles) || manifest.variantProfiles.length === 0) {
    pushError(errors, 'variantProfiles must be a non-empty array.');
  }

  if (!Array.isArray(manifest.outputProfiles) || manifest.outputProfiles.length === 0) {
    pushError(errors, 'outputProfiles must be a non-empty array.');
  }

  if (!Array.isArray(manifest.timeline) || manifest.timeline.length === 0) {
    pushError(errors, 'timeline must be a non-empty array.');
  }

  const fieldIds = new Set();
  const sceneIds = new Set();

  if (Array.isArray(manifest.editableFields)) {
    manifest.editableFields.forEach((field, index) => {
      if (!isObject(field)) {
        pushError(errors, `editableFields[${index}] must be an object.`);
        return;
      }

      if (!field.id || !/^[a-zA-Z][a-zA-Z0-9_]{1,50}$/.test(field.id)) {
        pushError(errors, `editableFields[${index}].id is invalid.`);
      } else if (fieldIds.has(field.id)) {
        pushError(errors, `Duplicate editable field id: ${field.id}`);
      } else {
        fieldIds.add(field.id);
      }

      const allowedTypes = new Set(['text', 'date', 'image', 'audio', 'color', 'font', 'qrcode']);
      if (!allowedTypes.has(field.type)) {
        pushError(errors, `editableFields[${index}].type is invalid.`);
      }

      if (typeof field.required !== 'boolean') {
        pushError(errors, `editableFields[${index}].required must be boolean.`);
      }

      if (field.maxLength !== undefined && (!Number.isInteger(field.maxLength) || field.maxLength < 1 || field.maxLength > 500)) {
        pushError(errors, `editableFields[${index}].maxLength must be integer between 1 and 500.`);
      }
    });
  }

  if (Array.isArray(manifest.timeline)) {
    manifest.timeline.forEach((scene, index) => {
      if (!isObject(scene)) {
        pushError(errors, `timeline[${index}] must be an object.`);
        return;
      }

      if (!scene.sceneId || typeof scene.sceneId !== 'string') {
        pushError(errors, `timeline[${index}].sceneId is required.`);
      } else if (sceneIds.has(scene.sceneId)) {
        pushError(errors, `Duplicate sceneId in timeline: ${scene.sceneId}`);
      } else {
        sceneIds.add(scene.sceneId);
      }

      if (!Number.isInteger(scene.startMs) || scene.startMs < 0) {
        pushError(errors, `timeline[${index}].startMs must be integer >= 0.`);
      }

      if (!Number.isInteger(scene.durationMs) || scene.durationMs < 500) {
        pushError(errors, `timeline[${index}].durationMs must be integer >= 500.`);
      }

      if (typeof scene.baseVideo !== 'string' || scene.baseVideo.trim().length === 0) {
        pushError(errors, `timeline[${index}].baseVideo is required.`);
      }

      if (Array.isArray(scene.textLayers)) {
        scene.textLayers.forEach((layer, layerIndex) => {
          if (!isObject(layer)) {
            pushError(errors, `timeline[${index}].textLayers[${layerIndex}] must be an object.`);
            return;
          }

          if (!fieldIds.has(layer.fieldId)) {
            pushError(errors, `timeline[${index}].textLayers[${layerIndex}].fieldId references unknown field: ${layer.fieldId}`);
          }

          ['x', 'y', 'maxWidth', 'maxHeight'].forEach((prop) => {
            if (typeof layer[prop] !== 'number') {
              pushError(errors, `timeline[${index}].textLayers[${layerIndex}].${prop} must be a number.`);
            }
          });
        });
      }
    });

    const sorted = [...manifest.timeline].sort((a, b) => a.startMs - b.startMs);
    for (let i = 1; i < sorted.length; i += 1) {
      const prevEnd = sorted[i - 1].startMs + sorted[i - 1].durationMs;
      if (sorted[i].startMs < prevEnd) {
        pushError(errors, `Timeline overlap: scene ${sorted[i].sceneId} starts before previous scene ends.`);
      }
    }
  }

  if (Array.isArray(manifest.variantProfiles)) {
    const variantKeys = new Set();
    manifest.variantProfiles.forEach((variant, index) => {
      if (!isObject(variant)) {
        pushError(errors, `variantProfiles[${index}] must be an object.`);
        return;
      }

      if (!isKebabCase(variant.key)) {
        pushError(errors, `variantProfiles[${index}].key must be kebab-case.`);
      } else if (variantKeys.has(variant.key)) {
        pushError(errors, `Duplicate variant key: ${variant.key}`);
      } else {
        variantKeys.add(variant.key);
      }

      if (!isObject(variant.palette)) {
        pushError(errors, `variantProfiles[${index}].palette must be an object.`);
      } else {
        ['primary', 'secondary', 'accent', 'text'].forEach((colorKey) => {
          if (!validateHexOrCssColor(variant.palette[colorKey])) {
            pushError(errors, `variantProfiles[${index}].palette.${colorKey} must be a color string.`);
          }
        });
      }

      if (!isObject(variant.fontPairing)) {
        pushError(errors, `variantProfiles[${index}].fontPairing must be an object.`);
      } else {
        if (!variant.fontPairing.heading || !variant.fontPairing.body) {
          pushError(errors, `variantProfiles[${index}].fontPairing requires heading and body.`);
        }
      }
    });
  }

  if (Array.isArray(manifest.outputProfiles)) {
    manifest.outputProfiles.forEach((profile, index) => {
      if (!isObject(profile)) {
        pushError(errors, `outputProfiles[${index}] must be an object.`);
        return;
      }

      const formatSet = new Set(['mp4', 'png', 'jpg', 'pdf']);
      if (!formatSet.has(profile.format)) {
        pushError(errors, `outputProfiles[${index}].format must be one of mp4/png/jpg/pdf.`);
      }

      ['width', 'height', 'fps'].forEach((prop) => {
        if (!Number.isInteger(profile[prop]) || profile[prop] < 1) {
          pushError(errors, `outputProfiles[${index}].${prop} must be a positive integer.`);
        }
      });
    });
  }

  return errors;
}

function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error('Usage: node backend/scripts/validate-adobe-express-manifest.js <manifest.json>');
    process.exit(1);
  }

  const resolvedPath = path.resolve(process.cwd(), inputPath);

  if (!fs.existsSync(resolvedPath)) {
    console.error(`File not found: ${resolvedPath}`);
    process.exit(1);
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
  } catch (error) {
    console.error(`Invalid JSON: ${error.message}`);
    process.exit(1);
  }

  const errors = validateManifest(parsed);
  if (errors.length > 0) {
    console.error('Manifest validation failed:');
    errors.forEach((error) => console.error(`- ${error}`));
    process.exit(1);
  }

  console.log('Manifest validation passed.');
}

if (require.main === module) {
  main();
}

module.exports = {
  validateManifest,
};
