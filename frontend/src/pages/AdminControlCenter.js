import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Form, Input, InputNumber, Modal, Popconfirm, Row, Select, Space, Switch, Table, Tabs, Tag, Upload, message } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined, AppstoreOutlined, CloudUploadOutlined, EnvironmentOutlined, ShopOutlined, TeamOutlined, UploadOutlined, UserAddOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import { adminService } from '../services/adminService';
import { vendorService } from '../services/vendorService';
import LocationAutocomplete from '../components/LocationAutocomplete';
import { getErrorMessage } from '../utils/helpers';
import './PhaseFlows.css';

const AdminControlCenter = () => {
  // ── Vendor Verification ────────────────────────────────────────────
  const [vendors, setVendors] = useState([]);
  const [loadingVendors, setLoadingVendors] = useState(false);
  const [verifyingVendorId, setVerifyingVendorId] = useState(null);

  const loadVerificationQueue = useCallback(async () => {
    setLoadingVendors(true);
    try {
      const res = await vendorService.searchVendors({ limit: 100 });
      setVendors(res.vendors || []);
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setLoadingVendors(false);
    }
  }, []);

  const verify = async (vendorId, status) => {
    setVerifyingVendorId(vendorId);
    try {
      await adminService.verifyVendor(vendorId, status);
      message.success(`Vendor ${status}`);
      await loadVerificationQueue();
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setVerifyingVendorId(null);
    }
  };

  // ── Category Management ────────────────────────────────────────────
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [savingCategory, setSavingCategory] = useState(false);
  const [catForm] = Form.useForm();

  const loadCategories = useCallback(async () => {
    setLoadingCategories(true);
    try {
      const res = await adminService.getCategories();
      setCategories(res.categories || []);
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setLoadingCategories(false);
    }
  }, []);

  const addCategory = async (values) => {
    setSavingCategory(true);
    try {
      await adminService.createCategory(values);
      message.success('Category added');
      catForm.resetFields();
      setCatModalOpen(false);
      await loadCategories();
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setSavingCategory(false);
    }
  };

  const removeCategory = async (id) => {
    try {
      await adminService.deleteCategory(id);
      message.success('Category deleted');
      await loadCategories();
    } catch (err) {
      message.error(getErrorMessage(err));
    }
  };

  // ── Invite Template Management ────────────────────────────────────
  const [inviteTemplates, setInviteTemplates] = useState([]);
  const [loadingInviteTemplates, setLoadingInviteTemplates] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateForm] = Form.useForm();
  const [manifestBuilderForm] = Form.useForm();
  const [adobeForm] = Form.useForm();
  const [validatingAdobeManifest, setValidatingAdobeManifest] = useState(false);
  const [importingAdobeManifest, setImportingAdobeManifest] = useState(false);
  const [adobeValidationResult, setAdobeValidationResult] = useState(null);
  const [adobeImportResult, setAdobeImportResult] = useState(null);
  const [generatedManifestJson, setGeneratedManifestJson] = useState('');
  const [uploadedAdobeAssets, setUploadedAdobeAssets] = useState([]);
  const [uploadingAdobeAsset, setUploadingAdobeAsset] = useState(false);
  const [sceneFieldMappings, setSceneFieldMappings] = useState({});
  const [mappingSceneAsset, setMappingSceneAsset] = useState('');
  const [mappingFieldId, setMappingFieldId] = useState('');
  const [activeLayerId, setActiveLayerId] = useState('');
  const [dragState, setDragState] = useState(null);
  const selectedAssetFilesWatched = Form.useWatch('selectedAssetFiles', manifestBuilderForm);

  const loadInviteTemplates = useCallback(async () => {
    setLoadingInviteTemplates(true);
    try {
      const res = await adminService.getInviteTemplates();
      setInviteTemplates(res.templates || []);
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setLoadingInviteTemplates(false);
    }
  }, []);

  const openTemplateModal = (template = null) => {
    setEditingTemplate(template);
    setTemplateModalOpen(true);
    templateForm.setFieldsValue({
      name: template?.name || '',
      key: template?.key || '',
      description: template?.description || '',
      sortOrder: template?.sortOrder ?? undefined,
      isActive: template?.isActive ?? true,
      paletteJson: JSON.stringify(template?.palette || {}, null, 2),
    });
  };

  const saveTemplate = async (values) => {
    let palette = {};
    try {
      palette = values.paletteJson ? JSON.parse(values.paletteJson) : {};
    } catch (_error) {
      message.error('Palette JSON is invalid');
      return;
    }

    const payload = {
      name: values.name,
      key: values.key,
      description: values.description || '',
      sortOrder: values.sortOrder,
      isActive: values.isActive,
      palette,
    };

    setSavingTemplate(true);
    try {
      if (editingTemplate) {
        await adminService.updateInviteTemplate(editingTemplate.id, payload);
        message.success('Invite template updated');
      } else {
        await adminService.createInviteTemplate(payload);
        message.success('Invite template created');
      }
      setTemplateModalOpen(false);
      setEditingTemplate(null);
      templateForm.resetFields();
      await loadInviteTemplates();
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setSavingTemplate(false);
    }
  };

  const removeTemplate = async (id) => {
    try {
      await adminService.deleteInviteTemplate(id);
      message.success('Invite template deleted');
      await loadInviteTemplates();
    } catch (err) {
      message.error(getErrorMessage(err));
    }
  };

  const parseManifestJson = (manifestJson) => {
    try {
      return JSON.parse(manifestJson);
    } catch (_error) {
      throw new Error('Manifest JSON is invalid');
    }
  };

  const parseCsv = (raw) =>
    String(raw || '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);

  const toKebabCase = (value) =>
    String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

  const buildManifestFromAdminUi = async () => {
    const values = await manifestBuilderForm.validateFields();

    const fieldCatalog = {
      eventTitle: { label: 'Event Title', type: 'text', required: true, maxLength: 80 },
      brideName: { label: 'Bride Name', type: 'text', required: true, maxLength: 40 },
      groomName: { label: 'Groom Name', type: 'text', required: true, maxLength: 40 },
      eventDate: { label: 'Event Date', type: 'date', required: true },
      eventTime: { label: 'Event Time', type: 'text', required: false, maxLength: 32 },
      venueName: { label: 'Venue Name', type: 'text', required: true, maxLength: 120 },
      eventAddress: { label: 'Event Address', type: 'text', required: false, maxLength: 200 },
      customMessage: { label: 'Custom Message', type: 'text', required: false, maxLength: 240 },
      rsvpLink: { label: 'RSVP Link', type: 'qrcode', required: true },
      guestName: { label: 'Guest Name', type: 'text', required: false, maxLength: 60 },
      hostLine: { label: 'Host Line', type: 'text', required: false, maxLength: 100 },
      dressCode: { label: 'Dress Code', type: 'text', required: false, maxLength: 80 },
      hashtag: { label: 'Hashtag', type: 'text', required: false, maxLength: 80 },
      mapLink: { label: 'Venue Map Link', type: 'qrcode', required: false },
      programHighlight: { label: 'Program Highlight', type: 'text', required: false, maxLength: 180 },
      seatingInfo: { label: 'Seating Info', type: 'text', required: false, maxLength: 120 },
    };

    const selectedAssetFiles = Array.isArray(values.selectedAssetFiles) ? values.selectedAssetFiles : [];
    const manualAssetFiles = parseCsv(values.assetFilesManual);
    const assetFiles = [...new Set([...selectedAssetFiles, ...manualAssetFiles])];
    if (!assetFiles.length) {
      throw new Error('Add at least one scene asset file');
    }

    const variantKeys = parseCsv(values.variantKeys).map(toKebabCase).filter(Boolean);
    if (!variantKeys.length) {
      throw new Error('Add at least one variant key');
    }

    const selectedFields = Array.isArray(values.selectedFields) ? values.selectedFields : [];
    if (!selectedFields.length) {
      throw new Error('Select at least one editable field');
    }

    const selectedTextFields = selectedFields.filter((fieldId) => fieldCatalog[fieldId]?.type !== 'qrcode');

    const timeline = assetFiles.map((asset, index) => {
      const sceneId = `scene-${index + 1}`;
      const startMs = index * 6000;
      const mappedLayers = Array.isArray(sceneFieldMappings[asset])
        ? sceneFieldMappings[asset]
            .filter((layer) => selectedFields.includes(layer.fieldId))
            .map((layer, layerIndex) => ({
              id: layer.id || `${sceneId}-layer-${layerIndex + 1}`,
              fieldId: layer.fieldId,
              x: typeof layer.x === 'number' ? layer.x : 0.5,
              y: typeof layer.y === 'number' ? layer.y : 0.5,
              maxWidth: typeof layer.maxWidth === 'number' ? layer.maxWidth : 0.82,
              maxHeight: typeof layer.maxHeight === 'number' ? layer.maxHeight : 0.08,
              align: layer.align || 'center',
            }))
        : [];

      const fallbackLayers = index === 0
        ? selectedTextFields.slice(0, 6).map((fieldId, layerIndex) => ({
            id: `${sceneId}-layer-${layerIndex + 1}`,
            fieldId,
            x: 0.5,
            y: Number((0.18 + layerIndex * 0.1).toFixed(2)),
            maxWidth: 0.82,
            maxHeight: 0.08,
            align: 'center',
          }))
        : [];

      return {
        sceneId,
        startMs,
        durationMs: 6000,
        baseVideo: asset,
        textLayers: mappedLayers.length ? mappedLayers : fallbackLayers,
      };
    });

    const editableFields = selectedFields.map((fieldId) => {
      const meta = fieldCatalog[fieldId];
      const bindings = timeline
        .filter((scene) => Array.isArray(scene.textLayers) && scene.textLayers.some((layer) => layer.fieldId === fieldId))
        .map((scene) => ({
          sceneId: scene.sceneId,
          target: (meta?.type === 'qrcode' || meta?.type === 'image') ? `imageLayer.${fieldId}` : `textLayer.${fieldId}`,
        }));

      return {
        id: fieldId,
        label: meta?.label || fieldId,
        type: meta?.type || 'text',
        required: typeof meta?.required === 'boolean' ? meta.required : false,
        ...(meta?.maxLength ? { maxLength: meta.maxLength } : {}),
        bindings,
      };
    });

    const variantProfiles = variantKeys.map((variantKey, index) => ({
      key: variantKey,
      label: variantKey,
      palette: {
        primary: index % 2 === 0 ? '#B15B70' : '#111827',
        secondary: index % 2 === 0 ? '#F8EFE8' : '#F3F4F6',
        accent: index % 2 === 0 ? '#D8A2B0' : '#14B8A6',
        text: index % 2 === 0 ? '#2F2A26' : '#0F172A',
      },
      fontPairing: {
        heading: 'Noto Serif Telugu',
        body: 'Noto Sans Telugu',
      },
    }));

    const manifest = {
      manifestVersion: '1.0',
      templateKey: toKebabCase(values.templateKey),
      templateName: String(values.templateName || '').trim(),
      engine: 'adobe-express',
      version: 1,
      category: values.category,
      source: {
        tool: 'adobe-express-premium',
        projectLink: values.projectLink || 'https://new.express.adobe.com/',
        exportedAt: new Date().toISOString(),
      },
      editableFields,
      variantProfiles,
      outputProfiles: [
        {
          key: 'story-video',
          format: 'mp4',
          width: 1080,
          height: 1920,
          fps: 30,
          videoBitrateKbps: 7000,
          audioBitrateKbps: 256,
        },
      ],
      timeline,
      assets: {
        videos: assetFiles.filter((name) => /\.mp4$/i.test(name)),
        images: assetFiles.filter((name) => /\.(png|jpg|jpeg)$/i.test(name)),
        audio: [],
      },
    };

    const manifestJson = JSON.stringify(manifest, null, 2);
    setGeneratedManifestJson(manifestJson);
    adobeForm.setFieldsValue({ manifestJson });
    setAdobeValidationResult(null);
    setAdobeImportResult(null);
    message.success('Manifest generated and copied to import form');
  };

  const moveSelectedAsset = (assetPath, direction) => {
    const current = manifestBuilderForm.getFieldValue('selectedAssetFiles') || [];
    const index = current.indexOf(assetPath);
    if (index < 0) return;

    const nextIndex = direction === 'up' ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= current.length) return;

    const reordered = [...current];
    const [item] = reordered.splice(index, 1);
    reordered.splice(nextIndex, 0, item);
    manifestBuilderForm.setFieldsValue({ selectedAssetFiles: reordered });
  };

  const removeSelectedAsset = (assetPath) => {
    const current = manifestBuilderForm.getFieldValue('selectedAssetFiles') || [];
    const next = current.filter((item) => item !== assetPath);
    manifestBuilderForm.setFieldsValue({ selectedAssetFiles: next });
    setSceneFieldMappings((prev) => {
      const copy = { ...prev };
      delete copy[assetPath];
      return copy;
    });
    if (mappingSceneAsset === assetPath) {
      setMappingSceneAsset(next[0] || '');
      setActiveLayerId('');
    }
  };

  useEffect(() => {
    const watched = selectedAssetFilesWatched || [];
    if (!watched.length) {
      setMappingSceneAsset('');
      setActiveLayerId('');
      return;
    }

    if (!mappingSceneAsset || !watched.includes(mappingSceneAsset)) {
      setMappingSceneAsset(watched[0]);
      setActiveLayerId('');
    }
  }, [selectedAssetFilesWatched, mappingSceneAsset]);

  const addLayerMapping = async () => {
    const values = await manifestBuilderForm.validateFields(['selectedFields']);
    const selectedFields = values.selectedFields || [];
    if (!mappingSceneAsset) {
      message.warning('Select a scene first');
      return;
    }
    if (!mappingFieldId) {
      message.warning('Choose a field to map');
      return;
    }
    if (!selectedFields.includes(mappingFieldId)) {
      message.warning('Selected field is not included in editable fields list');
      return;
    }

    const newLayer = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      fieldId: mappingFieldId,
      x: 0.5,
      y: 0.5,
      maxWidth: 0.82,
      maxHeight: 0.08,
      align: 'center',
    };

    setSceneFieldMappings((prev) => {
      const currentLayers = Array.isArray(prev[mappingSceneAsset]) ? prev[mappingSceneAsset] : [];
      return {
        ...prev,
        [mappingSceneAsset]: [...currentLayers, newLayer],
      };
    });
    setActiveLayerId(newLayer.id);
  };

  const updateActiveLayer = (patch) => {
    if (!mappingSceneAsset || !activeLayerId) return;
    setSceneFieldMappings((prev) => {
      const currentLayers = Array.isArray(prev[mappingSceneAsset]) ? prev[mappingSceneAsset] : [];
      return {
        ...prev,
        [mappingSceneAsset]: currentLayers.map((layer) => (layer.id === activeLayerId ? { ...layer, ...patch } : layer)),
      };
    });
  };

  const updateLayerById = (sceneAsset, layerId, patch) => {
    if (!sceneAsset || !layerId) return;
    setSceneFieldMappings((prev) => {
      const currentLayers = Array.isArray(prev[sceneAsset]) ? prev[sceneAsset] : [];
      return {
        ...prev,
        [sceneAsset]: currentLayers.map((layer) => (layer.id === layerId ? { ...layer, ...patch } : layer)),
      };
    });
  };

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  const startLayerDrag = (event, layer, mode = 'move') => {
    const previewEl = event.currentTarget.closest('[data-mapper-preview="true"]');
    if (!previewEl) return;
    const rect = previewEl.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    event.preventDefault();
    event.stopPropagation();
    setActiveLayerId(layer.id);
    setDragState({
      mode,
      sceneAsset: mappingSceneAsset,
      layerId: layer.id,
      startX: event.clientX,
      startY: event.clientY,
      rect,
      startLayer: {
        x: layer.x || 0.5,
        y: layer.y || 0.5,
        maxWidth: layer.maxWidth || 0.82,
        maxHeight: layer.maxHeight || 0.08,
      },
    });
  };

  const stopLayerDrag = () => {
    if (dragState) setDragState(null);
  };

  const handlePreviewMouseMove = (event) => {
    if (!dragState || !mappingSceneAsset || dragState.sceneAsset !== mappingSceneAsset) return;
    const dx = (event.clientX - dragState.startX) / dragState.rect.width;
    const dy = (event.clientY - dragState.startY) / dragState.rect.height;

    if (dragState.mode === 'move') {
      const width = dragState.startLayer.maxWidth;
      const height = dragState.startLayer.maxHeight;
      const x = clamp(dragState.startLayer.x + dx, width / 2, 1 - width / 2);
      const y = clamp(dragState.startLayer.y + dy, height / 2, 1 - height / 2);
      updateLayerById(mappingSceneAsset, dragState.layerId, {
        x: Number(x.toFixed(4)),
        y: Number(y.toFixed(4)),
      });
      return;
    }

    const nextWidth = clamp(dragState.startLayer.maxWidth + dx, 0.05, 1);
    const nextHeight = clamp(dragState.startLayer.maxHeight + dy, 0.04, 0.5);
    const x = clamp(dragState.startLayer.x, nextWidth / 2, 1 - nextWidth / 2);
    const y = clamp(dragState.startLayer.y, nextHeight / 2, 1 - nextHeight / 2);
    updateLayerById(mappingSceneAsset, dragState.layerId, {
      x: Number(x.toFixed(4)),
      y: Number(y.toFixed(4)),
      maxWidth: Number(nextWidth.toFixed(4)),
      maxHeight: Number(nextHeight.toFixed(4)),
    });
  };

  const removeActiveLayer = () => {
    if (!mappingSceneAsset || !activeLayerId) return;
    setSceneFieldMappings((prev) => {
      const currentLayers = Array.isArray(prev[mappingSceneAsset]) ? prev[mappingSceneAsset] : [];
      return {
        ...prev,
        [mappingSceneAsset]: currentLayers.filter((layer) => layer.id !== activeLayerId),
      };
    });
    setActiveLayerId('');
    if (dragState?.layerId === activeLayerId) setDragState(null);
  };

  const handlePreviewClick = (event) => {
    if (!activeLayerId || !mappingSceneAsset) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;

    updateActiveLayer({
      x: Number(Math.min(Math.max(x, 0), 1).toFixed(4)),
      y: Number(Math.min(Math.max(y, 0), 1).toFixed(4)),
    });
  };

  const handleAdobeAssetUpload = async ({ file, onSuccess, onError }) => {
    setUploadingAdobeAsset(true);
    try {
      const templateKey = manifestBuilderForm.getFieldValue('templateKey');
      const res = await adminService.uploadAdobeExpressAsset({ file, templateKey });
      const asset = res?.asset;
      if (!asset?.assetPath) {
        throw new Error('Upload response missing asset path');
      }

      setUploadedAdobeAssets((prev) => {
        const withoutDuplicate = prev.filter((item) => item.assetPath !== asset.assetPath);
        return [...withoutDuplicate, asset];
      });

      const existingSelections = manifestBuilderForm.getFieldValue('selectedAssetFiles') || [];
      manifestBuilderForm.setFieldsValue({
        selectedAssetFiles: [...new Set([...existingSelections, asset.assetPath])],
      });

      message.success(`${asset.name} uploaded`);
      if (onSuccess) onSuccess(asset);
    } catch (err) {
      message.error(getErrorMessage(err));
      if (onError) onError(err);
    } finally {
      setUploadingAdobeAsset(false);
    }
  };

  const validateAdobeManifest = async () => {
    setValidatingAdobeManifest(true);
    try {
      const { manifestJson } = await adobeForm.validateFields(['manifestJson']);
      const manifest = parseManifestJson(manifestJson);
      const result = await adminService.validateAdobeExpressManifest({ manifest });
      setAdobeValidationResult(result);
      message.success('Manifest validation passed');
    } catch (err) {
      const responseData = err?.response?.data;
      if (responseData && Array.isArray(responseData.errors)) {
        setAdobeValidationResult({
          valid: false,
          errors: responseData.errors || [],
          warnings: responseData.warnings || [],
        });
        message.error('Manifest validation failed');
      } else {
        message.error(getErrorMessage(err));
      }
    } finally {
      setValidatingAdobeManifest(false);
    }
  };

  const importAdobeManifest = async (values) => {
    setImportingAdobeManifest(true);
    try {
      const manifest = parseManifestJson(values.manifestJson);
      const payload = {
        manifest,
        upsert: values.upsert,
        isActive: values.isActive,
      };

      if (values.variantKey) payload.variantKey = String(values.variantKey).trim();
      if (values.sortOrder !== undefined && values.sortOrder !== null) {
        payload.sortOrder = Number(values.sortOrder);
      }

      const result = await adminService.importAdobeExpressManifest(payload);
      setAdobeImportResult(result);
      setAdobeValidationResult((prev) => prev || { valid: true, errors: [], warnings: [] });
      message.success(result?.message || 'Adobe Express template imported successfully');
      await loadInviteTemplates();
    } catch (err) {
      const responseData = err?.response?.data;
      if (responseData && Array.isArray(responseData.errors)) {
        setAdobeValidationResult({
          valid: false,
          errors: responseData.errors || [],
          warnings: responseData.warnings || [],
        });
      }
      message.error(getErrorMessage(err));
    } finally {
      setImportingAdobeManifest(false);
    }
  };

  // ── Vendor Management ──────────────────────────────────────────────
  const [allVendors, setAllVendors] = useState([]);
  const [loadingAllVendors, setLoadingAllVendors] = useState(false);
  const [deletingVendorId, setDeletingVendorId] = useState(null);
  const [syncingForms, setSyncingForms] = useState(false);
  const [syncingPlaces, setSyncingPlaces] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState(null);  const [vendorPagination, setVendorPagination] = useState({ current: 1, pageSize: 20, total: 0 });  const [formsSyncForm] = Form.useForm();
  const [placesSyncForm] = Form.useForm();

  const loadAllVendors = useCallback(async (page = 1, pageSize = 20) => {
    setLoadingAllVendors(true);
    try {
      const res = await adminService.getAllVendors({ page, limit: pageSize });
      setAllVendors(res.vendors || []);
      setVendorPagination({ current: page, pageSize, total: res.total || 0 });
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setLoadingAllVendors(false);
    }
  }, []);

  const removeVendor = async (id) => {
    setDeletingVendorId(id);
    try {
      await adminService.deleteVendor(id);
      message.success('Vendor removed from marketplace');
      await loadAllVendors();
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setDeletingVendorId(null);
    }
  };

  const syncFromForms = async (values) => {
    setSyncingForms(true);
    try {
      const payload = {
        ...values,
        includeCredentialsInResponse: true,
      };
      const res = await adminService.syncGoogleFormVendors(payload);
      setLastSyncResult({ source: 'Google Forms', ...res.results });
      message.success('Google Form vendor sync completed');
      await Promise.all([loadAllVendors(), loadVerificationQueue()]);
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setSyncingForms(false);
    }
  };

  const syncFromPlaces = async (values) => {
    setSyncingPlaces(true);
    try {
      const payload = {
        ...values,
        includeCredentialsInResponse: true,
      };
      // Strip undefined/null lat and lng to avoid backend float validation errors
      if (payload.lat == null) delete payload.lat;
      if (payload.lng == null) delete payload.lng;
      const res = await adminService.syncGooglePlacesVendors(payload);
      setLastSyncResult({ source: 'Google Places', ...res.results });
      message.success('Google Places vendor sync completed');
      await Promise.all([loadAllVendors(), loadVerificationQueue()]);
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setSyncingPlaces(false);
    }
  };

  // ── Create User ────────────────────────────────────────────────────
  const [creatingUser, setCreatingUser] = useState(false);
  const [userForm] = Form.useForm();

  // ── Payment Configuration ───────────────────────────────────────
  const [paymentConfigs, setPaymentConfigs] = useState([]);
  const [loadingPaymentConfigs, setLoadingPaymentConfigs] = useState(false);
  const [savingPaymentConfig, setSavingPaymentConfig] = useState('');

  const loadPaymentConfigs = useCallback(async () => {
    setLoadingPaymentConfigs(true);
    try {
      const res = await adminService.getPaymentConfigurations();
      setPaymentConfigs(res.configs || []);
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setLoadingPaymentConfigs(false);
    }
  }, []);

  const updatePaymentConfig = async (entityType, patch) => {
    setSavingPaymentConfig(entityType);
    try {
      await adminService.upsertPaymentConfiguration(entityType, patch);
      message.success(`Payment config updated for ${entityType}`);
      await loadPaymentConfigs();
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setSavingPaymentConfig('');
    }
  };

  const createUser = async (values) => {
    setCreatingUser(true);
    try {
      await adminService.createUser(values);
      userForm.resetFields();
      message.success('User created');
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setCreatingUser(false);
    }
  };

  // ── Load data on mount ─────────────────────────────────────────────
  useEffect(() => {
    loadVerificationQueue();
    loadCategories();
    loadInviteTemplates();
    loadAllVendors();
    loadPaymentConfigs();
  }, [loadVerificationQueue, loadCategories, loadInviteTemplates, loadAllVendors, loadPaymentConfigs]);

  // ── Tab items ──────────────────────────────────────────────────────
  const tabItems = [
    {
      key: 'payments',
      label: <span><AppstoreOutlined /> Payments</span>,
      children: (
        <Card className="phase-card" title="Service Payment Controls">
          <Table
            loading={loadingPaymentConfigs}
            rowKey="entityType"
            dataSource={paymentConfigs}
            pagination={false}
            locale={{ emptyText: <div className="phase-empty">No payment configurations found.</div> }}
            columns={[
              { title: 'Service', dataIndex: 'entityType', render: (v) => <code>{v}</code> },
              {
                title: 'Enabled',
                dataIndex: 'isEnabled',
                width: 140,
                render: (v, r) => (
                  <Switch
                    checked={Boolean(v)}
                    loading={savingPaymentConfig === r.entityType}
                    onChange={(checked) =>
                      updatePaymentConfig(r.entityType, {
                        isEnabled: checked,
                        amount: r.amount,
                        allowManualOverride: r.allowManualOverride,
                        description: r.description,
                      })
                    }
                  />
                ),
              },
              {
                title: 'Amount (INR)',
                dataIndex: 'amount',
                width: 180,
                render: (v, r) => (
                  <InputNumber
                    min={0}
                    value={v ?? 0}
                    style={{ width: '100%' }}
                    onBlur={(e) => {
                      const raw = Number(e.target.value || 0);
                      updatePaymentConfig(r.entityType, {
                        isEnabled: r.isEnabled,
                        amount: Number.isFinite(raw) ? raw : 0,
                        allowManualOverride: r.allowManualOverride,
                        description: r.description,
                      });
                    }}
                  />
                ),
              },
              {
                title: 'Manual Override',
                dataIndex: 'allowManualOverride',
                width: 160,
                render: (v, r) => (
                  <Switch
                    checked={Boolean(v)}
                    loading={savingPaymentConfig === r.entityType}
                    onChange={(checked) =>
                      updatePaymentConfig(r.entityType, {
                        isEnabled: r.isEnabled,
                        amount: r.amount,
                        allowManualOverride: checked,
                        description: r.description,
                      })
                    }
                  />
                ),
              },
            ]}
          />
        </Card>
      ),
    },
    {
      key: 'categories',
      label: <span><AppstoreOutlined /> Categories</span>,
      children: (
        <Card className="phase-card" title="Service Categories" extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setCatModalOpen(true)}>Add Category</Button>}>
          <Table
            loading={loadingCategories}
            rowKey="id"
            dataSource={categories}
            pagination={false}
            locale={{ emptyText: <div className="phase-empty">No categories yet.</div> }}
            columns={[
              { title: '#', dataIndex: 'sortOrder', width: 60 },
              { title: 'Name', dataIndex: 'name', render: (v) => <code>{v}</code> },
              { title: 'Label', dataIndex: 'label', render: (v, r) => <Tag color={r.color}>{v}</Tag> },
              { title: 'Color', dataIndex: 'color' },
              { title: 'Active', dataIndex: 'isActive', render: (v) => <Tag color={v ? 'green' : 'red'}>{v ? 'Yes' : 'No'}</Tag> },
              {
                title: 'Actions',
                width: 100,
                render: (_, r) => (
                  <Popconfirm title="Delete this category?" description="Only categories with no vendors/packages can be deleted." onConfirm={() => removeCategory(r.id)} okText="Delete" okButtonProps={{ danger: true }}>
                    <Button size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                ),
              },
            ]}
          />
        </Card>
      ),
    },
    {
      key: 'vendors',
      label: <span><ShopOutlined /> Vendor Management</span>,
      children: (
        <Card className="phase-card" title="All Marketplace Vendors">
          <Table
            loading={loadingAllVendors}
            rowKey="id"
            dataSource={allVendors}
            pagination={{
              current: vendorPagination.current,
              pageSize: vendorPagination.pageSize,
              total: vendorPagination.total,
              onChange: (page, pageSize) => loadAllVendors(page, pageSize),
            }}
            locale={{ emptyText: <div className="phase-empty">No vendors registered yet.</div> }}
            columns={[
              { title: 'Business', dataIndex: 'businessName', ellipsis: true },
              { title: 'Category', dataIndex: 'category', render: (v) => <Tag>{v}</Tag> },
              { title: 'Owner', render: (_, r) => r.user?.name || '-' },
              { title: 'Email', render: (_, r) => r.user?.email || '-', ellipsis: true },
              { title: 'Rating', dataIndex: 'averageRating', render: (v) => Number(v || 0).toFixed(1), width: 80 },
              { title: 'Reviews', dataIndex: 'totalReviews', width: 80 },
              {
                title: 'Status',
                render: (_, r) => (
                  <Space size={4}>
                    <Tag color={r.isVerified ? 'green' : 'orange'}>{r.verificationStatus || 'pending'}</Tag>
                  </Space>
                ),
              },
              {
                title: 'Actions',
                width: 100,
                render: (_, r) => (
                  <Popconfirm title="Remove this vendor?" description="This will delete the vendor profile, all packages, and testimonials. This cannot be undone." onConfirm={() => removeVendor(r.id)} okText="Delete" okButtonProps={{ danger: true }}>
                    <Button size="small" danger icon={<DeleteOutlined />} loading={deletingVendorId === r.id} />
                  </Popconfirm>
                ),
              },
            ]}
          />
        </Card>
      ),
    },
    {
      key: 'invite-templates',
      label: <span><AppstoreOutlined /> Invite Templates</span>,
      children: (
        <Row gutter={[16, 16]}>
          <Col xs={24} xl={12}>
            <Card className="phase-card" title="Manifest Builder (UI)">
              <Form
                form={manifestBuilderForm}
                layout="vertical"
                initialValues={{
                  templateKey: 'telugu-wedding-template',
                  templateName: 'Telugu Wedding Template',
                  category: 'wedding',
                  variantKeys: 'floral-traditional,modern-minimal',
                  selectedAssetFiles: [],
                  assetFilesManual: '',
                  selectedFields: ['eventTitle', 'eventDate', 'eventTime', 'venueName', 'guestName', 'customMessage', 'rsvpLink'],
                }}
              >
                <Row gutter={12}>
                  <Col xs={24} md={12}>
                    <Form.Item
                      name="templateKey"
                      label="Template Key"
                      rules={[
                        { required: true, message: 'Template key is required' },
                        { pattern: /^[a-z0-9-]{3,64}$/, message: 'Use kebab-case (3-64 chars)' },
                      ]}
                    >
                      <Input placeholder="telugu-wedding-template" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item name="templateName" label="Template Name" rules={[{ required: true, message: 'Template name is required' }]}>
                      <Input placeholder="Telugu Wedding Template" />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={12}>
                  <Col xs={24} md={12}>
                    <Form.Item name="category" label="Category" rules={[{ required: true, message: 'Category is required' }]}>
                      <Select options={[
                        { value: 'wedding', label: 'wedding' },
                        { value: 'engagement', label: 'engagement' },
                        { value: 'birthday', label: 'birthday' },
                        { value: 'corporate', label: 'corporate' },
                        { value: 'other', label: 'other' },
                      ]} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item name="projectLink" label="Adobe Project Link (optional)">
                      <Input placeholder="https://new.express.adobe.com/project/..." />
                    </Form.Item>
                  </Col>
                </Row>
                <Form.Item
                  name="variantKeys"
                  label="Variant Keys (comma separated)"
                  rules={[{ required: true, message: 'Add at least one variant key' }]}
                >
                  <Input placeholder="floral-traditional,modern-minimal" />
                </Form.Item>
                <Form.Item
                  label="Upload Scene Assets"
                >
                  <Upload
                    accept="image/*,video/*"
                    showUploadList={false}
                    customRequest={handleAdobeAssetUpload}
                    disabled={uploadingAdobeAsset}
                  >
                    <Button icon={<UploadOutlined />} loading={uploadingAdobeAsset}>Upload Asset</Button>
                  </Upload>
                </Form.Item>
                <Form.Item
                  name="selectedAssetFiles"
                  label="Select Uploaded Assets"
                  rules={[{ required: true, message: 'Upload/select at least one scene asset' }]}
                >
                  <Select
                    mode="multiple"
                    placeholder="Select uploaded assets"
                    options={uploadedAdobeAssets.map((asset) => ({
                      value: asset.assetPath,
                      label: `${asset.name} (${asset.mediaType || 'asset'})`,
                    }))}
                  />
                </Form.Item>
                <Form.Item shouldUpdate noStyle>
                  {() => {
                    const selectedAssetFiles = manifestBuilderForm.getFieldValue('selectedAssetFiles') || [];
                    if (!selectedAssetFiles.length) return null;

                    const uploadedByPath = new Map(uploadedAdobeAssets.map((asset) => [asset.assetPath, asset]));
                    return (
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ marginBottom: 8, fontWeight: 500 }}>Scene Order (top to bottom)</div>
                        <Space direction="vertical" style={{ width: '100%' }}>
                          {selectedAssetFiles.map((assetPath, index) => {
                            const asset = uploadedByPath.get(assetPath);
                            const label = asset ? `${asset.name} (${asset.mediaType || 'asset'})` : assetPath;
                            return (
                              <div
                                key={assetPath}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  border: '1px solid #f0f0f0',
                                  borderRadius: 8,
                                  padding: '8px 10px',
                                }}
                              >
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 10 }}>
                                  {index + 1}. {label}
                                </span>
                                <Space>
                                  <Button
                                    size="small"
                                    icon={<ArrowUpOutlined />}
                                    disabled={index === 0}
                                    onClick={() => moveSelectedAsset(assetPath, 'up')}
                                  />
                                  <Button
                                    size="small"
                                    icon={<ArrowDownOutlined />}
                                    disabled={index === selectedAssetFiles.length - 1}
                                    onClick={() => moveSelectedAsset(assetPath, 'down')}
                                  />
                                  <Button
                                    size="small"
                                    danger
                                    icon={<DeleteOutlined />}
                                    onClick={() => removeSelectedAsset(assetPath)}
                                  />
                                </Space>
                              </div>
                            );
                          })}
                        </Space>
                      </div>
                    );
                  }}
                </Form.Item>
                <Form.Item
                  name="assetFilesManual"
                  label="Additional Asset Paths (optional, comma separated)"
                >
                  <Input.TextArea rows={2} placeholder="scenes/scene-1.png,scenes/scene-2.png" />
                </Form.Item>
                <Form.Item name="selectedFields" label="Editable Fields" rules={[{ required: true, message: 'Select editable fields' }]}>
                  <Select
                    mode="multiple"
                    options={[
                      { value: 'eventTitle', label: 'eventTitle' },
                      { value: 'brideName', label: 'brideName' },
                      { value: 'groomName', label: 'groomName' },
                      { value: 'eventDate', label: 'eventDate' },
                      { value: 'eventTime', label: 'eventTime' },
                      { value: 'venueName', label: 'venueName' },
                      { value: 'eventAddress', label: 'eventAddress' },
                      { value: 'customMessage', label: 'customMessage' },
                      { value: 'rsvpLink', label: 'rsvpLink' },
                      { value: 'guestName', label: 'guestName' },
                      { value: 'hostLine', label: 'hostLine' },
                      { value: 'dressCode', label: 'dressCode' },
                      { value: 'hashtag', label: 'hashtag' },
                      { value: 'mapLink', label: 'mapLink' },
                      { value: 'programHighlight', label: 'programHighlight' },
                      { value: 'seatingInfo', label: 'seatingInfo' },
                    ]}
                  />
                </Form.Item>
                <Form.Item shouldUpdate noStyle>
                  {() => {
                    const selectedFields = manifestBuilderForm.getFieldValue('selectedFields') || [];
                    const selectedAssets = manifestBuilderForm.getFieldValue('selectedAssetFiles') || [];
                    if (!selectedFields.length || !selectedAssets.length) return null;

                    const uploadedByPath = new Map(uploadedAdobeAssets.map((asset) => [asset.assetPath, asset]));
                    const layers = Array.isArray(sceneFieldMappings[mappingSceneAsset]) ? sceneFieldMappings[mappingSceneAsset] : [];
                    const activeLayer = layers.find((layer) => layer.id === activeLayerId);
                    const previewAsset = uploadedByPath.get(mappingSceneAsset);

                    return (
                      <Card size="small" style={{ marginBottom: 16 }} title="Placeholder Mapper (Click Preview To Place)">
                        <Row gutter={12}>
                          <Col xs={24} md={12}>
                            <Form.Item label="Scene" style={{ marginBottom: 8 }}>
                              <Select
                                value={mappingSceneAsset || undefined}
                                onChange={(value) => {
                                  setMappingSceneAsset(value);
                                  setActiveLayerId('');
                                }}
                                options={selectedAssets.map((assetPath, index) => ({
                                  value: assetPath,
                                  label: `${index + 1}. ${(uploadedByPath.get(assetPath)?.name || assetPath)}`,
                                }))}
                              />
                            </Form.Item>
                          </Col>
                          <Col xs={24} md={12}>
                            <Form.Item label="Field" style={{ marginBottom: 8 }}>
                              <Select
                                value={mappingFieldId || undefined}
                                onChange={setMappingFieldId}
                                options={selectedFields.map((fieldId) => ({ value: fieldId, label: fieldId }))}
                              />
                            </Form.Item>
                          </Col>
                        </Row>
                        <Space style={{ marginBottom: 8 }}>
                          <Button onClick={addLayerMapping} disabled={!mappingSceneAsset || !mappingFieldId}>Add Layer</Button>
                          <Button danger onClick={removeActiveLayer} disabled={!activeLayerId}>Remove Active Layer</Button>
                        </Space>
                        <div
                          data-mapper-preview="true"
                          onClick={handlePreviewClick}
                          onMouseMove={handlePreviewMouseMove}
                          onMouseUp={stopLayerDrag}
                          onMouseLeave={stopLayerDrag}
                          style={{
                            position: 'relative',
                            width: '100%',
                            maxWidth: 320,
                            aspectRatio: '9 / 16',
                            border: '1px solid #f0f0f0',
                            borderRadius: 8,
                            overflow: 'hidden',
                            background: '#fafafa',
                            marginBottom: 10,
                            cursor: activeLayerId ? 'crosshair' : 'default',
                          }}
                        >
                          {previewAsset?.mediaType === 'video' ? (
                            <video src={previewAsset.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted playsInline />
                          ) : previewAsset?.url ? (
                            <img src={previewAsset.url} alt="Scene preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ padding: 12, color: '#999' }}>No preview available for this asset path.</div>
                          )}

                          {layers.map((layer) => (
                            <div
                              key={layer.id}
                              onMouseDown={(e) => startLayerDrag(e, layer, 'move')}
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveLayerId(layer.id);
                              }}
                              style={{
                                position: 'absolute',
                                left: `${Math.max(0, Math.min(1, (layer.x || 0.5) - (layer.maxWidth || 0.82) / 2)) * 100}%`,
                                top: `${Math.max(0, Math.min(1, (layer.y || 0.5) - (layer.maxHeight || 0.08) / 2)) * 100}%`,
                                width: `${Math.min(1, layer.maxWidth || 0.82) * 100}%`,
                                height: `${Math.min(1, layer.maxHeight || 0.08) * 100}%`,
                                border: layer.id === activeLayerId ? '2px solid #1677ff' : '1px solid rgba(22,119,255,0.65)',
                                background: 'rgba(22,119,255,0.10)',
                                color: '#0f172a',
                                fontSize: 11,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                textAlign: 'center',
                                padding: 2,
                                overflow: 'hidden',
                                cursor: 'move',
                              }}
                            >
                              {layer.fieldId}
                              <div
                                onMouseDown={(e) => startLayerDrag(e, layer, 'resize')}
                                style={{
                                  position: 'absolute',
                                  right: 0,
                                  bottom: 0,
                                  width: 10,
                                  height: 10,
                                  background: layer.id === activeLayerId ? '#1677ff' : 'rgba(22,119,255,0.7)',
                                  cursor: 'nwse-resize',
                                  borderTopLeftRadius: 3,
                                }}
                              />
                            </div>
                          ))}
                        </div>
                        {layers.length ? (
                          <div style={{ marginBottom: 8 }}>
                            <div style={{ marginBottom: 6, fontWeight: 500 }}>Layers</div>
                            <Space wrap>
                              {layers.map((layer) => (
                                <Tag
                                  key={layer.id}
                                  color={layer.id === activeLayerId ? 'blue' : 'default'}
                                  style={{ cursor: 'pointer' }}
                                  onClick={() => setActiveLayerId(layer.id)}
                                >
                                  {layer.fieldId}
                                </Tag>
                              ))}
                            </Space>
                          </div>
                        ) : null}
                        <Row gutter={12}>
                          <Col xs={12}>
                            <Form.Item label="Width" style={{ marginBottom: 0 }}>
                              <InputNumber
                                min={0.05}
                                max={1}
                                step={0.01}
                                value={activeLayer?.maxWidth ?? 0.82}
                                style={{ width: '100%' }}
                                disabled={!activeLayer}
                                onChange={(value) => updateActiveLayer({ maxWidth: Number(value) || 0.82 })}
                              />
                            </Form.Item>
                          </Col>
                          <Col xs={12}>
                            <Form.Item label="Height" style={{ marginBottom: 0 }}>
                              <InputNumber
                                min={0.04}
                                max={0.5}
                                step={0.01}
                                value={activeLayer?.maxHeight ?? 0.08}
                                style={{ width: '100%' }}
                                disabled={!activeLayer}
                                onChange={(value) => updateActiveLayer({ maxHeight: Number(value) || 0.08 })}
                              />
                            </Form.Item>
                          </Col>
                        </Row>
                      </Card>
                    );
                  }}
                </Form.Item>
                <Space>
                  <Button type="primary" onClick={buildManifestFromAdminUi}>Generate Manifest</Button>
                  <Button
                    onClick={() => {
                      if (!generatedManifestJson) {
                        message.warning('Generate a manifest first');
                        return;
                      }
                      adobeForm.setFieldsValue({ manifestJson: generatedManifestJson });
                      message.success('Generated manifest copied to import form');
                    }}
                  >
                    Use In Import Form
                  </Button>
                </Space>
                {generatedManifestJson ? (
                  <Input.TextArea
                    style={{ marginTop: 16 }}
                    rows={8}
                    value={generatedManifestJson}
                    readOnly
                  />
                ) : null}
              </Form>
            </Card>
          </Col>
          <Col xs={24} xl={12}>
            <Card className="phase-card" title="Import Adobe Express Manifest">
              <Form
                form={adobeForm}
                layout="vertical"
                onFinish={importAdobeManifest}
                initialValues={{
                  upsert: true,
                  isActive: true,
                }}
              >
                <Form.Item
                  name="manifestJson"
                  label="Manifest JSON"
                  rules={[{ required: true, message: 'Paste Adobe manifest JSON' }]}
                >
                  <Input.TextArea rows={10} placeholder="Paste exported Adobe Express manifest JSON here" />
                </Form.Item>
                <Row gutter={12}>
                  <Col xs={24} md={8}>
                    <Form.Item name="variantKey" label="Variant Key (optional)">
                      <Input placeholder="e.g. premium-gold" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item name="sortOrder" label="Sort Order (optional)">
                      <InputNumber min={0} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={4}>
                    <Form.Item name="upsert" label="Upsert Existing" valuePropName="checked">
                      <Switch />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={4}>
                    <Form.Item name="isActive" label="Activate Template" valuePropName="checked">
                      <Switch />
                    </Form.Item>
                  </Col>
                </Row>
                <Space>
                  <Button onClick={validateAdobeManifest} loading={validatingAdobeManifest}>
                    Validate Manifest
                  </Button>
                  <Button type="primary" htmlType="submit" loading={importingAdobeManifest}>
                    Import Template
                  </Button>
                </Space>
              </Form>

              {adobeValidationResult ? (
                <div style={{ marginTop: 16 }}>
                  <Alert
                    type={adobeValidationResult.valid ? 'success' : 'error'}
                    showIcon
                    message={adobeValidationResult.valid ? 'Manifest is valid' : 'Manifest validation failed'}
                    description={
                      adobeValidationResult.valid
                        ? `Warnings: ${(adobeValidationResult.warnings || []).length}`
                        : `Errors: ${(adobeValidationResult.errors || []).length}`
                    }
                  />
                  {Array.isArray(adobeValidationResult.errors) && adobeValidationResult.errors.length > 0 ? (
                    <Input.TextArea
                      readOnly
                      rows={Math.min(8, adobeValidationResult.errors.length + 1)}
                      style={{ marginTop: 12 }}
                      value={adobeValidationResult.errors.join('\n')}
                    />
                  ) : null}
                  {Array.isArray(adobeValidationResult.warnings) && adobeValidationResult.warnings.length > 0 ? (
                    <Input.TextArea
                      readOnly
                      rows={Math.min(8, adobeValidationResult.warnings.length + 1)}
                      style={{ marginTop: 12 }}
                      value={adobeValidationResult.warnings.join('\n')}
                    />
                  ) : null}
                </div>
              ) : null}

              {adobeImportResult?.template ? (
                <Alert
                  style={{ marginTop: 16 }}
                  type="info"
                  showIcon
                  message={adobeImportResult.message || 'Template import completed'}
                  description={`Template: ${adobeImportResult.template.name} (${adobeImportResult.template.key})`}
                />
              ) : null}
            </Card>
          </Col>
          <Col span={24}>
            <Card
              className="phase-card"
              title="Invite Card Designs"
              extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => openTemplateModal()}>Add Template</Button>}
            >
              <Table
                loading={loadingInviteTemplates}
                rowKey="id"
                dataSource={inviteTemplates}
                pagination={false}
                locale={{ emptyText: <div className="phase-empty">No invite templates yet.</div> }}
                columns={[
                  { title: '#', dataIndex: 'sortOrder', width: 60 },
                  { title: 'Key', dataIndex: 'key', render: (v) => <code>{v}</code> },
                  { title: 'Name', dataIndex: 'name' },
                  { title: 'Description', dataIndex: 'description', ellipsis: true },
                  {
                    title: 'Preview',
                    render: (_, r) => (
                      <span
                        style={{
                          display: 'inline-block',
                          width: 54,
                          height: 20,
                          borderRadius: 12,
                          border: `1px solid ${r.palette?.frame || '#d9d9d9'}`,
                          background: `linear-gradient(135deg, ${r.palette?.frame || '#999'} 0%, ${r.palette?.accent || '#ccc'} 100%)`,
                        }}
                      />
                    ),
                  },
                  { title: 'Active', dataIndex: 'isActive', render: (v) => <Tag color={v ? 'green' : 'red'}>{v ? 'Yes' : 'No'}</Tag> },
                  {
                    title: 'Actions',
                    width: 150,
                    render: (_, r) => (
                      <Space>
                        <Button size="small" icon={<EditOutlined />} onClick={() => openTemplateModal(r)}>
                          Edit
                        </Button>
                        <Popconfirm title="Delete this invite template?" onConfirm={() => removeTemplate(r.id)} okText="Delete" okButtonProps={{ danger: true }}>
                          <Button size="small" danger icon={<DeleteOutlined />} />
                        </Popconfirm>
                      </Space>
                    ),
                  },
                ]}
              />
            </Card>
          </Col>
        </Row>
      ),
    },
    {
      key: 'verification',
      label: <span><TeamOutlined /> Verification Queue</span>,
      children: (
        <Card className="phase-card phase-table" title="Vendor Verification Queue">
          <Table
            loading={loadingVendors}
            rowKey="id"
            dataSource={vendors}
            pagination={false}
            locale={{ emptyText: <div className="phase-empty">No vendors pending verification right now.</div> }}
            columns={[
              { title: 'Business', dataIndex: 'businessName' },
              { title: 'Category', dataIndex: 'category' },
              { title: 'Owner', render: (_, r) => r.user?.name || '-' },
              {
                title: 'Status',
                render: (_, r) => (
                  <Space>
                    <Tag color={r.isVerified ? 'green' : 'orange'}>{r.verificationStatus || 'pending'}</Tag>
                    {r.isVerified ? <Tag color="green">verified</Tag> : null}
                  </Space>
                ),
              },
              {
                title: 'Actions',
                render: (_, r) => (
                  <Space>
                    <Button size="small" type="primary" loading={verifyingVendorId === r.id} onClick={() => verify(r.id, 'approved')}>Approve</Button>
                    <Button size="small" danger loading={verifyingVendorId === r.id} onClick={() => verify(r.id, 'rejected')}>Reject</Button>
                  </Space>
                ),
              },
            ]}
          />
        </Card>
      ),
    },
    {
      key: 'onboarding',
      label: <span><CloudUploadOutlined /> Vendor Onboarding</span>,
      children: (
        <Row gutter={[16, 16]}>
          <Col xs={24} xl={12}>
            <Card className="phase-card" title="Import From Google Forms">
              <Form form={formsSyncForm} layout="vertical" onFinish={syncFromForms} initialValues={{ limit: 100 }}>
                <Form.Item name="limit" label="Rows To Process">
                  <InputNumber min={1} max={5000} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item name="spreadsheetId" label="Spreadsheet ID">
                  <Input placeholder="Optional if GOOGLE_FORM_SHEET_ID is already set" />
                </Form.Item>
                <Form.Item name="range" label="Sheet Range">
                  <Input placeholder="Form Responses 1!A1:ZZ1000" />
                </Form.Item>
                <Form.Item name="defaultPassword" label="Default Vendor Password">
                  <Input.Password placeholder="Vendor@123" />
                </Form.Item>
                <Button type="primary" htmlType="submit" loading={syncingForms} icon={<CloudUploadOutlined />}>
                  Start Form Onboarding
                </Button>
              </Form>
            </Card>
          </Col>
          <Col xs={24} xl={12}>
            <Card className="phase-card" title="Import From Google Places">
              <Form form={placesSyncForm} layout="vertical" onFinish={syncFromPlaces} initialValues={{ limit: 50, radiusMeters: 15000, reviewPage: 1, reviewLimit: 20 }}>
                <Form.Item name="query" label="Search Query" rules={[{ required: true, message: 'Enter a Places search query' }]}>
                  <Input placeholder="wedding caterers in Hyderabad" prefix={<EnvironmentOutlined />} />
                </Form.Item>
                <Row gutter={12}>
                  <Col xs={24} md={12}>
                    <Form.Item name="city" label="City">
                      <LocationAutocomplete
                        value={placesSyncForm.getFieldValue('city')}
                        onChange={(value) => placesSyncForm.setFieldsValue({ city: value })}
                        onLocationPick={(loc) => {
                          placesSyncForm.setFieldsValue({
                            city: loc?.city || loc?.name || placesSyncForm.getFieldValue('city') || '',
                            state: loc?.state || placesSyncForm.getFieldValue('state') || '',
                            lat: Number.isFinite(Number(loc?.lat)) ? Number(loc.lat) : placesSyncForm.getFieldValue('lat'),
                            lng: Number.isFinite(Number(loc?.lng)) ? Number(loc.lng) : placesSyncForm.getFieldValue('lng'),
                          });
                        }}
                        placeholder="Type city and pick a suggestion"
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item name="state" label="State">
                      <Input placeholder="Telangana" />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={12}>
                  <Col xs={24} md={12}>
                    <Form.Item name="lat" label="Latitude (optional)">
                      <InputNumber placeholder="17.3850" style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item name="lng" label="Longitude (optional)">
                      <InputNumber placeholder="78.4867" style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={12}>
                  <Col xs={24} md={12}>
                    <Form.Item name="limit" label="Max Listings">
                      <InputNumber min={1} max={200} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item name="radiusMeters" label="Radius (meters)">
                      <InputNumber min={1000} max={50000} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={12}>
                  <Col xs={24} md={12}>
                    <Form.Item name="type" label="Google Place Type">
                      <Input placeholder="caterer, florist, lodging..." />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item name="forceCategory" label="Force Marketplace Category">
                      <Select allowClear options={[
                        'catering', 'decor', 'photography', 'videography', 'music', 'venue', 'florist', 'transportation', 'other',
                      ].map((value) => ({ value, label: value }))} />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={12}>
                  <Col xs={24} md={12}>
                    <Form.Item name="reviewPage" label="Review Page (Google)">
                      <InputNumber min={1} max={1000} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item name="reviewLimit" label="Reviews Per Vendor (Page Size)">
                      <InputNumber min={1} max={100} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                </Row>
                <div style={{ marginTop: -6, marginBottom: 12, color: '#6b7280', fontSize: 12 }}>
                  Google may return only a limited review subset for some places. Pagination here controls how many reviews our sync processes from the returned subset.
                </div>
                <Form.Item name="defaultPassword" label="Default Vendor Password">
                  <Input.Password placeholder="Vendor@123" />
                </Form.Item>
                <Button type="primary" htmlType="submit" loading={syncingPlaces} icon={<CloudUploadOutlined />}>
                  Start Places Onboarding
                </Button>
              </Form>
            </Card>
          </Col>
          <Col span={24}>
            <Card className="phase-card" title="Latest Onboarding Run">
              {lastSyncResult ? (
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  <Alert
                    type="info"
                    showIcon
                    message={`${lastSyncResult.source} completed`}
                    description={`Processed: ${lastSyncResult.processed || 0}, Created: ${lastSyncResult.created || 0}, Skipped: ${lastSyncResult.skipped || 0}, Failed: ${lastSyncResult.failed || 0}`}
                  />
                  {Array.isArray(lastSyncResult.credentials) && lastSyncResult.credentials.length > 0 ? (
                    <Input.TextArea
                      readOnly
                      rows={Math.min(10, lastSyncResult.credentials.length + 1)}
                      value={lastSyncResult.credentials.map((item) => `${item.email} | ${item.password}`).join('\n')}
                    />
                  ) : null}
                </Space>
              ) : (
                <div className="phase-empty">Trigger bulk onboarding from this tab. Results and created credentials will appear here.</div>
              )}
            </Card>
          </Col>
        </Row>
      ),
    },
    {
      key: 'users',
      label: <span><UserAddOutlined /> Create User</span>,
      children: (
        <Card className="phase-card" title="Create Organizer / Vendor / Other User">
          <Form form={userForm} layout="vertical" onFinish={createUser}>
            <Row gutter={12}>
              <Col xs={24} md={8}><Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="email" label="Email" rules={[{ required: true }]}><Input /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="password" label="Password"><Input.Password /></Form.Item></Col>
            </Row>
            <Row gutter={12}>
              <Col xs={24} md={8}>
                <Form.Item name="role" label="Role" rules={[{ required: true }]}>
                  <Select options={['admin', 'organizer', 'customer', 'vendor', 'guest'].map((r) => ({ value: r, label: r }))} />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}><Form.Item name="phone" label="Phone"><Input /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="businessName" label="Business Name (for vendor)"><Input /></Form.Item></Col>
            </Row>
            <Button type="primary" htmlType="submit" loading={creatingUser}>Create User</Button>
          </Form>
        </Card>
      ),
    },
  ];

  return (
    <div className="phase-page">
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card className="phase-hero">
            <h1 className="phase-title">Admin Control Center</h1>
            <p className="phase-subtitle">Manage categories, vendors, verification, and users.</p>
          </Card>
        </Col>
        <Col span={24}>
          <Tabs defaultActiveKey="categories" items={tabItems} size="large" />
        </Col>
      </Row>

      {/* Add Category Modal */}
      <Modal title="Add New Category" open={catModalOpen} onCancel={() => { setCatModalOpen(false); catForm.resetFields(); }} footer={null} destroyOnClose>
        <Form form={catForm} layout="vertical" onFinish={addCategory}>
          <Form.Item name="name" label="Category Name (slug)" rules={[{ required: true, message: 'Enter a category name' }]}
            help="Lowercase identifier used internally, e.g. makeup_artist">
            <Input placeholder="e.g. makeup_artist" />
          </Form.Item>
          <Form.Item name="label" label="Display Label" rules={[{ required: true, message: 'Enter a display label' }]}>
            <Input placeholder="e.g. Makeup Artist" />
          </Form.Item>
          <Form.Item name="color" label="Tag Color" initialValue="default">
            <Select options={[
              { value: 'default', label: 'Default (grey)' },
              { value: 'red', label: 'Red' },
              { value: 'orange', label: 'Orange' },
              { value: 'gold', label: 'Gold' },
              { value: 'green', label: 'Green' },
              { value: 'cyan', label: 'Cyan' },
              { value: 'blue', label: 'Blue' },
              { value: 'purple', label: 'Purple' },
              { value: 'magenta', label: 'Magenta' },
              { value: 'pink', label: 'Pink' },
            ]} />
          </Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={savingCategory}>Add Category</Button>
            <Button onClick={() => { setCatModalOpen(false); catForm.resetFields(); }}>Cancel</Button>
          </Space>
        </Form>
      </Modal>

      <Modal
        title={editingTemplate ? 'Edit Invite Template' : 'Add Invite Template'}
        open={templateModalOpen}
        onCancel={() => {
          setTemplateModalOpen(false);
          setEditingTemplate(null);
          templateForm.resetFields();
        }}
        footer={null}
        destroyOnClose
        width={720}
      >
        <Form form={templateForm} layout="vertical" onFinish={saveTemplate} initialValues={{ isActive: true }}>
          <Row gutter={12}>
            <Col xs={24} md={12}>
              <Form.Item name="name" label="Display Name" rules={[{ required: true, message: 'Name is required' }]}>
                <Input placeholder="Royal Maroon" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="key" label="Template Key" rules={[{ required: true, message: 'Key is required' }]}>
                <Input placeholder="royal-maroon" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col xs={24} md={12}>
              <Form.Item name="sortOrder" label="Sort Order">
                <Input type="number" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="isActive" label="Status">
                <Select options={[{ value: true, label: 'Active' }, { value: false, label: 'Inactive' }]} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="Description">
            <Input />
          </Form.Item>
          <Form.Item
            name="paletteJson"
            label="Palette JSON"
            rules={[
              {
                validator: async (_, value) => {
                  if (!value) return;
                  JSON.parse(value);
                },
              },
            ]}
            extra={'Example: {"background":"#fff7f2","frame":"#7c2d12","accent":"#9a3412","title":"#4a1d0a","body":"#1f2937","subtle":"#6b7280","link":"#9a3412"}'}
          >
            <Input.TextArea rows={8} />
          </Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={savingTemplate}>
              {editingTemplate ? 'Update Template' : 'Create Template'}
            </Button>
            <Button
              onClick={() => {
                setTemplateModalOpen(false);
                setEditingTemplate(null);
                templateForm.resetFields();
              }}
            >
              Cancel
            </Button>
          </Space>
        </Form>
      </Modal>
    </div>
  );
};

export default AdminControlCenter;
