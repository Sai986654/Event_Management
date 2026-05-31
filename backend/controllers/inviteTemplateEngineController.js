const path = require('path');
const asyncHandler = require('../utils/asyncHandler');
const { prisma } = require('../config/db');
const { uploadFile } = require('../services/fileService');
const { renderTemplate } = require('../services/inviteTemplateRenderer');
const {
  FUTURE_THEME_KEYS,
  normalizeTemplateKey,
  normalizeConfigInput,
  createDefaultLayoutDefinition,
  createDefaultComponentVisibility,
  generateAiTemplateDefinition,
} = require('../services/inviteTemplateEngineService');

const coerceObject = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : {});

const templateEngineTablesReady = async () => {
  try {
    const rows = await prisma.$queryRawUnsafe(
      `
      SELECT
        to_regclass('public.invite_template_versions')::text AS invite_template_versions,
        to_regclass('public.invite_component_presets')::text AS invite_component_presets,
        EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'invite_templates'
            AND column_name = 'event_type'
        ) AS has_event_type,
        EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'invite_templates'
            AND column_name = 'theme_key'
        ) AS has_theme_key,
        EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'invite_templates'
            AND column_name = 'status'
        ) AS has_status,
        EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'invite_templates'
            AND column_name = 'config_json'
        ) AS has_config_json
      `
    );
    const row = rows?.[0] || {};
    return Boolean(
      row.invite_template_versions &&
      row.invite_component_presets &&
      row.has_event_type &&
      row.has_theme_key &&
      row.has_status &&
      row.has_config_json
    );
  } catch (_error) {
    return false;
  }
};

const ensureTemplateEngineTablesReady = async (res) => {
  const ready = await templateEngineTablesReady();
  if (ready) return true;

  res.status(503).json({
    message:
      'Invitation Template Engine tables are not ready yet. Run prisma migrate deploy on the active database and retry.',
    code: 'INVITE_TEMPLATE_ENGINE_MIGRATION_PENDING',
  });
  return false;
};

const buildTemplateData = (body) => {
  const config = normalizeConfigInput(body.config || body.templateConfig || body);
  const palette = coerceObject(config.palette);
  const visibility = coerceObject(config.componentVisibility);

  return {
    key: normalizeTemplateKey(body.key || body.templateKey || body.name),
    name: String(body.name || body.templateName || 'Untitled Template').trim(),
    description: body.description ? String(body.description).trim() : null,
    eventType: body.eventType ? String(body.eventType).trim().toLowerCase() : null,
    themeKey: body.themeKey ? String(body.themeKey).trim().toLowerCase() : null,
    palette,
    configJson: config,
    componentVisibilityJson: visibility,
    aiMetaJson: coerceObject(body.aiMetaJson || config.ai),
  };
};

exports.listTemplateEngineThemes = asyncHandler(async (_req, res) => {
  res.json({ themes: FUTURE_THEME_KEYS });
});

exports.listTemplateEngineTemplates = asyncHandler(async (_req, res) => {
  if (!(await ensureTemplateEngineTablesReady(res))) return;

  const templates = await prisma.inviteTemplate.findMany({
    orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
    include: {
      versions: {
        orderBy: { version: 'desc' },
        take: 1,
      },
    },
  });

  res.json({ templates });
});

exports.getTemplateEngineTemplateById = asyncHandler(async (req, res) => {
  if (!(await ensureTemplateEngineTablesReady(res))) return;

  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: 'Invalid template id' });

  const template = await prisma.inviteTemplate.findUnique({
    where: { id },
    include: {
      versions: { orderBy: { version: 'desc' } },
      componentPresets: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
    },
  });

  if (!template) return res.status(404).json({ message: 'Template not found' });
  res.json({ template });
});

exports.createTemplateEngineTemplate = asyncHandler(async (req, res) => {
  if (!(await ensureTemplateEngineTablesReady(res))) return;

  const data = buildTemplateData(req.body);
  if (!data.key) return res.status(400).json({ message: 'Template key or name is required' });

  const existing = await prisma.inviteTemplate.findUnique({ where: { key: data.key } });
  if (existing) return res.status(409).json({ message: 'Template key already exists' });

  const maxSort = await prisma.inviteTemplate.aggregate({ _max: { sortOrder: true } });

  const created = await prisma.$transaction(async (tx) => {
    const template = await tx.inviteTemplate.create({
      data: {
        ...data,
        sortOrder: req.body.sortOrder !== undefined ? Number(req.body.sortOrder) : (maxSort._max.sortOrder || 0) + 1,
        status: 'draft',
        latestVersion: 1,
        isActive: req.body.isActive !== undefined ? Boolean(req.body.isActive) : true,
      },
    });

    await tx.inviteTemplateVersion.create({
      data: {
        templateId: template.id,
        version: 1,
        status: 'draft',
        configJson: template.configJson,
        componentVisibility: template.componentVisibilityJson,
        aiMetaJson: template.aiMetaJson,
        createdByUserId: req.user?.id || null,
      },
    });

    return template;
  });

  res.status(201).json({ template: created });
});

exports.updateTemplateEngineTemplate = asyncHandler(async (req, res) => {
  if (!(await ensureTemplateEngineTablesReady(res))) return;

  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: 'Invalid template id' });

  const existing = await prisma.inviteTemplate.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ message: 'Template not found' });

  const data = buildTemplateData(req.body);

  if (data.key && data.key !== existing.key) {
    const collision = await prisma.inviteTemplate.findUnique({ where: { key: data.key } });
    if (collision) return res.status(409).json({ message: 'Template key already exists' });
  }

  const patch = {
    ...(req.body.name !== undefined ? { name: data.name } : {}),
    ...(req.body.key !== undefined || req.body.templateKey !== undefined ? { key: data.key } : {}),
    ...(req.body.description !== undefined ? { description: data.description } : {}),
    ...(req.body.eventType !== undefined ? { eventType: data.eventType } : {}),
    ...(req.body.themeKey !== undefined ? { themeKey: data.themeKey } : {}),
    ...(req.body.palette !== undefined ? { palette: data.palette } : {}),
    ...(req.body.config !== undefined || req.body.templateConfig !== undefined ? { configJson: data.configJson } : {}),
    ...(req.body.componentVisibility !== undefined ? { componentVisibilityJson: data.componentVisibilityJson } : {}),
    ...(req.body.aiMetaJson !== undefined ? { aiMetaJson: data.aiMetaJson } : {}),
    ...(req.body.isActive !== undefined ? { isActive: Boolean(req.body.isActive) } : {}),
    ...(req.body.status !== undefined ? { status: String(req.body.status).toLowerCase() } : {}),
  };

  const saveVersion = req.body.saveVersion !== false;

  const updated = await prisma.$transaction(async (tx) => {
    const template = await tx.inviteTemplate.update({ where: { id }, data: patch });

    if (saveVersion) {
      const nextVersion = template.latestVersion + 1;
      await tx.inviteTemplateVersion.create({
        data: {
          templateId: template.id,
          version: nextVersion,
          status: template.status,
          configJson: template.configJson,
          componentVisibility: template.componentVisibilityJson,
          aiMetaJson: template.aiMetaJson,
          createdByUserId: req.user?.id || null,
        },
      });

      return tx.inviteTemplate.update({
        where: { id: template.id },
        data: { latestVersion: nextVersion },
      });
    }

    return template;
  });

  res.json({ template: updated });
});

exports.reorderTemplateEngineSections = asyncHandler(async (req, res) => {
  if (!(await ensureTemplateEngineTablesReady(res))) return;

  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: 'Invalid template id' });

  const sectionOrder = Array.isArray(req.body.sectionOrder) ? req.body.sectionOrder : [];
  if (!sectionOrder.length) return res.status(400).json({ message: 'sectionOrder array is required' });

  const template = await prisma.inviteTemplate.findUnique({ where: { id } });
  if (!template) return res.status(404).json({ message: 'Template not found' });

  const config = coerceObject(template.configJson);
  const layout = coerceObject(config.layout);
  const sections = Array.isArray(layout.sections) ? layout.sections : [];

  const sectionMap = new Map(sections.map((section) => [String(section.id), section]));
  const reordered = [];

  sectionOrder.forEach((sectionId, index) => {
    const key = String(sectionId);
    if (!sectionMap.has(key)) return;
    reordered.push({ ...sectionMap.get(key), order: index + 1 });
    sectionMap.delete(key);
  });

  Array.from(sectionMap.values()).forEach((section, index) => {
    reordered.push({ ...section, order: sectionOrder.length + index + 1 });
  });

  const nextConfig = {
    ...config,
    layout: {
      ...layout,
      sections: reordered,
    },
  };

  const updated = await prisma.inviteTemplate.update({
    where: { id },
    data: {
      configJson: nextConfig,
      latestVersion: template.latestVersion + 1,
    },
  });

  await prisma.inviteTemplateVersion.create({
    data: {
      templateId: updated.id,
      version: updated.latestVersion,
      status: updated.status,
      configJson: nextConfig,
      componentVisibility: updated.componentVisibilityJson,
      aiMetaJson: updated.aiMetaJson,
      createdByUserId: req.user?.id || null,
    },
  });

  res.json({ template: updated });
});

exports.uploadTemplateEngineAsset = asyncHandler(async (req, res) => {
  if (!(await ensureTemplateEngineTablesReady(res))) return;

  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  const templateId = Number(req.params.id);
  if (!Number.isInteger(templateId) || templateId <= 0) {
    return res.status(400).json({ message: 'Invalid template id' });
  }

  const template = await prisma.inviteTemplate.findUnique({ where: { id: templateId } });
  if (!template) return res.status(404).json({ message: 'Template not found' });

  const uploadFolder = `vedika360/invite-template-engine/${template.key}/assets`;

  const uploaded = await uploadFile(req.file.buffer, uploadFolder, {
    contentType: req.file.mimetype,
    originalname: req.file.originalname,
  });

  const extension = path.extname(req.file.originalname || '').toLowerCase();

  res.status(201).json({
    message: 'Asset uploaded successfully',
    asset: {
      name: req.file.originalname || uploaded.publicId.split('/').pop(),
      mimeType: req.file.mimetype,
      extension,
      size: req.file.size,
      assetPath: uploaded.publicId,
      url: uploaded.url,
    },
  });
});

exports.previewTemplateEngineTemplate = asyncHandler(async (req, res) => {
  if (!(await ensureTemplateEngineTablesReady(res))) return;

  const templateId = req.body.templateId ? Number(req.body.templateId) : null;
  const guestData = coerceObject(req.body.guestData);
  const eventData = coerceObject(req.body.eventData);

  let templateConfig = coerceObject(req.body.templateConfig);

  if ((!templateConfig || !Object.keys(templateConfig).length) && templateId) {
    const template = await prisma.inviteTemplate.findUnique({ where: { id: templateId } });
    if (!template) return res.status(404).json({ message: 'Template not found' });
    templateConfig = coerceObject(template.configJson);
  }

  if (!templateConfig || !Object.keys(templateConfig).length) {
    return res.status(400).json({ message: 'templateConfig or templateId is required' });
  }

  const rendered = renderTemplate({
    templateConfig,
    guestData,
    eventData,
    includeHidden: Boolean(req.body.includeHidden),
  });

  res.json({ rendered });
});

exports.publishTemplateEngineTemplate = asyncHandler(async (req, res) => {
  if (!(await ensureTemplateEngineTablesReady(res))) return;

  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: 'Invalid template id' });

  const existing = await prisma.inviteTemplate.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ message: 'Template not found' });

  const status = String(req.body.status || 'published').toLowerCase();
  if (!['draft', 'published', 'archived'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status' });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const template = await tx.inviteTemplate.update({
      where: { id },
      data: {
        status,
        publishedAt: status === 'published' ? new Date() : null,
        latestVersion: existing.latestVersion + 1,
      },
    });

    await tx.inviteTemplateVersion.create({
      data: {
        templateId: template.id,
        version: template.latestVersion,
        status: template.status,
        configJson: template.configJson,
        componentVisibility: template.componentVisibilityJson,
        aiMetaJson: template.aiMetaJson,
        createdByUserId: req.user?.id || null,
      },
    });

    return template;
  });

  res.json({ template: updated });
});

exports.generateTemplateEngineFromAI = asyncHandler(async (req, res) => {
  if (!(await ensureTemplateEngineTablesReady(res))) return;

  const prompt = String(req.body.prompt || '').trim();
  if (!prompt) return res.status(400).json({ message: 'prompt is required' });

  const eventType = req.body.eventType ? String(req.body.eventType).trim().toLowerCase() : 'wedding';
  const aiResult = await generateAiTemplateDefinition({ prompt, eventType });
  const generated = coerceObject(aiResult.generated);

  const normalizedConfig = normalizeConfigInput({
    metadata: {
      source: 'ai',
      prompt,
      generatedAt: new Date().toISOString(),
    },
    palette: generated.colorPalette,
    layoutDefinition: generated.layoutDefinition || createDefaultLayoutDefinition(),
    components: generated.layoutDefinition?.sections || createDefaultLayoutDefinition().sections,
    componentVisibility: generated.componentConfiguration?.visibility || createDefaultComponentVisibility(),
    ai: {
      prompt,
      imageGenerationPrompts: generated.imageGenerationPrompts || [],
      provider: aiResult.provider,
      fallbackUsed: aiResult.fallbackUsed,
    },
  });

  const responsePayload = {
    templateName: generated.templateName || `AI ${eventType} template`,
    colorPalette: generated.colorPalette || {},
    layoutDefinition: generated.layoutDefinition || createDefaultLayoutDefinition(),
    imageGenerationPrompts: generated.imageGenerationPrompts || [],
    componentConfiguration: {
      visibility: generated.componentConfiguration?.visibility || createDefaultComponentVisibility(),
    },
    themeKey: generated.themeKey || 'telugu_royal',
    eventType: generated.eventType || eventType,
  };

  if (req.body.persist === true) {
    const key = normalizeTemplateKey(req.body.key || responsePayload.templateName);
    if (!key) return res.status(400).json({ message: 'Unable to derive template key from generated output' });

    const existing = await prisma.inviteTemplate.findUnique({ where: { key } });
    if (existing) {
      return res.status(409).json({ message: 'Template key already exists, provide a unique key', generated: responsePayload });
    }

    const maxSort = await prisma.inviteTemplate.aggregate({ _max: { sortOrder: true } });

    const created = await prisma.$transaction(async (tx) => {
      const template = await tx.inviteTemplate.create({
        data: {
          key,
          name: responsePayload.templateName,
          description: req.body.description ? String(req.body.description).trim() : `AI generated from prompt: ${prompt.slice(0, 120)}`,
          eventType: responsePayload.eventType,
          themeKey: responsePayload.themeKey,
          palette: responsePayload.colorPalette,
          configJson: normalizedConfig,
          componentVisibilityJson: responsePayload.componentConfiguration.visibility,
          aiMetaJson: {
            adminPrompt: prompt,
            imageGenerationPrompts: responsePayload.imageGenerationPrompts,
            provider: aiResult.provider,
            fallbackUsed: aiResult.fallbackUsed,
          },
          status: 'draft',
          latestVersion: 1,
          sortOrder: req.body.sortOrder !== undefined ? Number(req.body.sortOrder) : (maxSort._max.sortOrder || 0) + 1,
          isActive: true,
        },
      });

      await tx.inviteTemplateVersion.create({
        data: {
          templateId: template.id,
          version: 1,
          status: 'draft',
          configJson: template.configJson,
          componentVisibility: template.componentVisibilityJson,
          aiMetaJson: template.aiMetaJson,
          createdByUserId: req.user?.id || null,
        },
      });

      return template;
    });

    return res.status(201).json({ generated: responsePayload, template: created, provider: aiResult.provider });
  }

  res.json({ generated: responsePayload, provider: aiResult.provider, fallbackUsed: aiResult.fallbackUsed });
});
