import React, { useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { ScrollView, StyleSheet, View, Alert, RefreshControl, Image, TouchableOpacity, PanResponder } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ActivityIndicator, Button, Card, Chip, Text, TextInput, Portal, Modal, IconButton, Divider,
  SegmentedButtons,
} from 'react-native-paper';
import { vendorService } from '../services/vendorService';
import { adminService } from '../services/adminService';
import { getErrorMessage } from '../utils/helpers';
import { AuthContext } from '../context/AuthContext';
import { Colors, Spacing, Radius } from '../theme';
import LocationPicker from '../components/LocationPicker';

const roles = ['admin', 'organizer', 'customer', 'vendor', 'guest'];
const tagColors = ['default', 'red', 'orange', 'gold', 'green', 'cyan', 'blue', 'purple', 'magenta', 'pink'];
const INVITE_FIELD_CATALOG = [
  { key: 'hostName', label: 'Host Name' },
  { key: 'partnerName', label: 'Partner Name' },
  { key: 'eventDate', label: 'Event Date' },
  { key: 'eventTime', label: 'Event Time' },
  { key: 'eventVenue', label: 'Event Venue' },
  { key: 'eventAddress', label: 'Event Address' },
  { key: 'rsvpName', label: 'RSVP Name' },
  { key: 'rsvpPhone', label: 'RSVP Phone' },
  { key: 'guestName', label: 'Guest Name' },
  { key: 'hostLine', label: 'Host Line' },
  { key: 'dressCode', label: 'Dress Code' },
  { key: 'hashtag', label: 'Hashtag' },
  { key: 'mapLink', label: 'Venue Map Link' },
  { key: 'programHighlight', label: 'Program Highlight' },
  { key: 'seatingInfo', label: 'Seating Info' },
  { key: 'coverTitle', label: 'Cover Title' },
  { key: 'coverSubtitle', label: 'Cover Subtitle' },
  { key: 'specialNote', label: 'Special Note' },
];

const DEFAULT_LAYER = { x: 0.2, y: 0.2, width: 0.6, height: 0.08 };
const BUILDER_DRAFT_KEY = '@admin_adobe_builder_draft';

const AdminControlScreen = () => {
  const { user } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('categories');
  const [refreshing, setRefreshing] = useState(false);

  // ── Vendor Verification ─────────────────────────────────────────
  const [vendors, setVendors] = useState([]);
  const [loadingVendors, setLoadingVendors] = useState(false);
  const [verifyingId, setVerifyingId] = useState(null);

  // ── Category Management ─────────────────────────────────────────
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [showCatModal, setShowCatModal] = useState(false);
  const [savingCat, setSavingCat] = useState(false);
  const [catForm, setCatForm] = useState({ name: '', label: '', color: 'default' });

  // ── Vendor Management ───────────────────────────────────────────
  const [allVendors, setAllVendors] = useState([]);
  const [loadingAllVendors, setLoadingAllVendors] = useState(false);
  const [loadingMoreVendors, setLoadingMoreVendors] = useState(false);
  const [vendorPage, setVendorPage] = useState(1);
  const [vendorTotal, setVendorTotal] = useState(0);
  const [deletingVendorId, setDeletingVendorId] = useState(null);
  const VENDORS_PER_PAGE = 15;
  const [syncingForms, setSyncingForms] = useState(false);
  const [syncingPlaces, setSyncingPlaces] = useState(false);
  const [formsSyncForm, setFormsSyncForm] = useState({ limit: '100', spreadsheetId: '', range: '', defaultPassword: '' });
  const [placesSyncForm, setPlacesSyncForm] = useState({ query: '', city: '', state: '', lat: '', lng: '', limit: '50', radiusMeters: '15000', type: '', forceCategory: '', reviewPage: '1', reviewLimit: '20', defaultPassword: '' });
  const [lastSyncResult, setLastSyncResult] = useState(null);

  // ── Create User ─────────────────────────────────────────────────
  const [creating, setCreating] = useState(false);
  const [userForm, setUserForm] = useState({ name: '', email: '', role: 'organizer', password: '', phone: '', businessName: '' });
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info');

  // ── Payment Configuration ─────────────────────────────────────
  const [paymentConfigs, setPaymentConfigs] = useState([]);
  const [loadingPaymentConfigs, setLoadingPaymentConfigs] = useState(false);
  const [savingPaymentConfig, setSavingPaymentConfig] = useState('');

  // ── Invite Templates (Adobe Express) ──────────────────────────
  const [inviteTemplates, setInviteTemplates] = useState([]);
  const [loadingInviteTemplates, setLoadingInviteTemplates] = useState(false);
  const [uploadingAdobeAsset, setUploadingAdobeAsset] = useState(false);
  const [validatingAdobeManifest, setValidatingAdobeManifest] = useState(false);
  const [importingAdobeManifest, setImportingAdobeManifest] = useState(false);
  const [uploadedAdobeAssets, setUploadedAdobeAssets] = useState([]);
  const [previewSize, setPreviewSize] = useState({ width: 260, height: 462 });

  const [builderForm, setBuilderForm] = useState({
    templateKey: '',
    templateName: '',
    category: '',
    musicAssetUrl: '',
    selectedFields: ['hostName', 'partnerName', 'eventDate', 'eventVenue'],
    selectedAssets: [],
    fieldMappings: {},
  });

  const [selectedSceneIndex, setSelectedSceneIndex] = useState(0);
  const [activeFieldForMapping, setActiveFieldForMapping] = useState('hostName');
  const [generatedManifestPayload, setGeneratedManifestPayload] = useState(null);
  const [manifestInputText, setManifestInputText] = useState('');
  const [manifestValidationResult, setManifestValidationResult] = useState(null);
  const [manifestImportResult, setManifestImportResult] = useState(null);
  const suppressPreviewTapRef = useRef(false);
  const gestureStartRef = useRef(null);
  const builderDraftLoadedRef = useRef(false);

  const clamp = useCallback((value, min, max) => Math.min(max, Math.max(min, value)), []);

  // ── Draft persistence ──────────────────────────────────────────
  useEffect(() => {
    if (builderDraftLoadedRef.current) return;
    AsyncStorage.getItem(BUILDER_DRAFT_KEY)
      .then((raw) => {
        if (!raw) return;
        try {
          const draft = JSON.parse(raw);
          if (draft && typeof draft === 'object') {
            setBuilderForm((prev) => ({
              ...prev,
              templateKey: draft.templateKey ?? prev.templateKey,
              templateName: draft.templateName ?? prev.templateName,
              category: draft.category ?? prev.category,
              musicAssetUrl: draft.musicAssetUrl ?? prev.musicAssetUrl,
              selectedFields: Array.isArray(draft.selectedFields) ? draft.selectedFields : prev.selectedFields,
              selectedAssets: Array.isArray(draft.selectedAssets) ? draft.selectedAssets : prev.selectedAssets,
              fieldMappings: draft.fieldMappings && typeof draft.fieldMappings === 'object' ? draft.fieldMappings : prev.fieldMappings,
            }));
            if (draft.uploadedAssets) {
              setUploadedAdobeAssets((prev) => {
                const existing = new Set(prev.map((a) => a.assetPath));
                const newOnes = (draft.uploadedAssets || []).filter((a) => !existing.has(a.assetPath));
                return [...prev, ...newOnes];
              });
            }
            if (draft.manifestInputText) setManifestInputText(draft.manifestInputText);
          }
        } catch (_) {}
      })
      .catch(() => {})
      .finally(() => {
        builderDraftLoadedRef.current = true;
      });
  }, []);

  useEffect(() => {
    if (!builderDraftLoadedRef.current) return;
    const draft = {
      templateKey: builderForm.templateKey,
      templateName: builderForm.templateName,
      category: builderForm.category,
      musicAssetUrl: builderForm.musicAssetUrl,
      selectedFields: builderForm.selectedFields,
      selectedAssets: builderForm.selectedAssets,
      fieldMappings: builderForm.fieldMappings,
      uploadedAssets: uploadedAdobeAssets,
      manifestInputText,
    };
    AsyncStorage.setItem(BUILDER_DRAFT_KEY, JSON.stringify(draft)).catch(() => {});
  }, [builderForm, uploadedAdobeAssets, manifestInputText]);

  const clearBuilderDraft = useCallback(() => {
    AsyncStorage.removeItem(BUILDER_DRAFT_KEY).catch(() => {});
  }, []);

  // ── Load Functions ──────────────────────────────────────────────
  const loadVerificationQueue = useCallback(async () => {
    setLoadingVendors(true);
    try {
      const res = await vendorService.searchVendors({ limit: 100 });
      setVendors(res.vendors || []);
    } catch (err) {
      setMessage(getErrorMessage(err)); setMessageType('error');
    } finally {
      setLoadingVendors(false);
    }
  }, []);

  const loadCategories = useCallback(async () => {
    setLoadingCategories(true);
    try {
      const res = await adminService.getCategories();
      setCategories(res.categories || []);
    } catch (err) {
      setMessage(getErrorMessage(err)); setMessageType('error');
    } finally {
      setLoadingCategories(false);
    }
  }, []);

  const loadAllVendors = useCallback(async (page = 1, append = false) => {
    if (page === 1) setLoadingAllVendors(true);
    else setLoadingMoreVendors(true);
    try {
      const res = await adminService.getAllVendors({ page, limit: VENDORS_PER_PAGE });
      const vendors = res.vendors || [];
      
      // Deduplicate vendors by ID when appending
      if (append) {
        setAllVendors((prev) => {
          const vendorIds = new Set(prev.map(v => v.id));
          const dedupedNew = vendors.filter(v => !vendorIds.has(v.id));
          return [...prev, ...dedupedNew];
        });
      } else {
        setAllVendors(vendors);
      }
      
      setVendorPage(page);
      setVendorTotal(res.total || 0);
    } catch (err) {
      setMessage(getErrorMessage(err)); setMessageType('error');
    } finally {
      if (page === 1) setLoadingAllVendors(false);
      else setLoadingMoreVendors(false);
    }
  }, []);

  const loadMore = useCallback(() => {
    if (loadingMoreVendors || allVendors.length >= vendorTotal) return;
    loadAllVendors(vendorPage + 1, true);
  }, [loadingMoreVendors, allVendors.length, vendorTotal, vendorPage, loadAllVendors]);

  const loadPaymentConfigurations = useCallback(async () => {
    setLoadingPaymentConfigs(true);
    try {
      const res = await adminService.getPaymentConfigurations();
      setPaymentConfigs(res.configs || []);
    } catch (err) {
      setMessage(getErrorMessage(err));
      setMessageType('error');
    } finally {
      setLoadingPaymentConfigs(false);
    }
  }, []);

  const loadInviteTemplates = useCallback(async () => {
    setLoadingInviteTemplates(true);
    try {
      const res = await adminService.getInviteTemplates();
      setInviteTemplates(res.templates || []);
    } catch (err) {
      setMessage(getErrorMessage(err));
      setMessageType('error');
    } finally {
      setLoadingInviteTemplates(false);
    }
  }, []);

  const loadAll = useCallback(async () => {
    await Promise.all([
      loadVerificationQueue(),
      loadCategories(),
      loadAllVendors(),
      loadPaymentConfigurations(),
      loadInviteTemplates(),
    ]);
    setRefreshing(false);
  }, [loadVerificationQueue, loadCategories, loadAllVendors, loadPaymentConfigurations, loadInviteTemplates]);

  const updatePaymentConfiguration = async (entityType, patch) => {
    setSavingPaymentConfig(entityType);
    try {
      await adminService.upsertPaymentConfiguration(entityType, patch);
      setMessage(`Payment config updated for ${entityType}`);
      setMessageType('success');
      await loadPaymentConfigurations();
    } catch (err) {
      setMessage(getErrorMessage(err));
      setMessageType('error');
    } finally {
      setSavingPaymentConfig('');
    }
  };

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Verification Actions ────────────────────────────────────────
  const verify = async (vendorId, status) => {
    setVerifyingId(vendorId);
    try {
      await adminService.verifyVendor(vendorId, status);
      setMessage(`Vendor ${status}`); setMessageType('success');
      await loadVerificationQueue();
    } catch (err) {
      setMessage(getErrorMessage(err)); setMessageType('error');
    } finally {
      setVerifyingId(null);
    }
  };

  // ── Category Actions ────────────────────────────────────────────
  const addCategory = async () => {
    if (!catForm.name.trim() || !catForm.label.trim()) {
      Alert.alert('Validation', 'Name and label are required');
      return;
    }
    setSavingCat(true);
    try {
      await adminService.createCategory(catForm);
      setMessage('Category added'); setMessageType('success');
      setCatForm({ name: '', label: '', color: 'default' });
      setShowCatModal(false);
      await loadCategories();
    } catch (err) {
      Alert.alert('Error', getErrorMessage(err));
    } finally {
      setSavingCat(false);
    }
  };

  const removeCategory = (id, name) => {
    Alert.alert('Delete Category', `Delete "${name}"? Only categories with no vendors/packages can be deleted.`, [
      { text: 'Cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await adminService.deleteCategory(id);
            setMessage('Category deleted'); setMessageType('success');
            await loadCategories();
          } catch (err) {
            Alert.alert('Error', getErrorMessage(err));
          }
        },
      },
    ]);
  };

  // ── Vendor Management Actions ───────────────────────────────────
  const removeVendor = (id, name) => {
    Alert.alert('Remove Vendor', `Remove "${name}" from marketplace? This deletes the vendor profile, all packages, and testimonials. This cannot be undone.`, [
      { text: 'Cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          setDeletingVendorId(id);
          try {
            await adminService.deleteVendor(id);
            setMessage('Vendor removed'); setMessageType('success');
            await loadAllVendors();
          } catch (err) {
            Alert.alert('Error', getErrorMessage(err));
          } finally {
            setDeletingVendorId(null);
          }
        },
      },
    ]);
  };

  const syncFromForms = async () => {
    try {
      setSyncingForms(true);
      const payload = {
        limit: Number(formsSyncForm.limit) || 100,
        includeCredentialsInResponse: true,
        ...(formsSyncForm.spreadsheetId.trim() ? { spreadsheetId: formsSyncForm.spreadsheetId.trim() } : {}),
        ...(formsSyncForm.range.trim() ? { range: formsSyncForm.range.trim() } : {}),
        ...(formsSyncForm.defaultPassword.trim() ? { defaultPassword: formsSyncForm.defaultPassword.trim() } : {}),
      };
      const res = await adminService.syncGoogleFormVendors(payload);
      setLastSyncResult({ source: 'Google Forms', ...res.results });
      setMessage('Google Form vendor sync completed'); setMessageType('success');
      await Promise.all([loadVerificationQueue(), loadAllVendors()]);
    } catch (err) {
      setMessage(getErrorMessage(err)); setMessageType('error');
    } finally {
      setSyncingForms(false);
    }
  };

  const syncFromPlaces = async () => {
    if (!placesSyncForm.query.trim()) {
      Alert.alert('Validation', 'Search query is required for Google Places onboarding');
      return;
    }
    try {
      setSyncingPlaces(true);
      const payload = {
        query: placesSyncForm.query.trim(),
        limit: Number(placesSyncForm.limit) || 50,
        radiusMeters: Number(placesSyncForm.radiusMeters) || 15000,
        reviewPage: Number(placesSyncForm.reviewPage) || 1,
        reviewLimit: Number(placesSyncForm.reviewLimit) || 20,
        includeCredentialsInResponse: true,
        ...(placesSyncForm.city.trim() ? { city: placesSyncForm.city.trim() } : {}),
        ...(placesSyncForm.state.trim() ? { state: placesSyncForm.state.trim() } : {}),
        ...(placesSyncForm.lat.trim() ? { lat: Number(placesSyncForm.lat) } : {}),
        ...(placesSyncForm.lng.trim() ? { lng: Number(placesSyncForm.lng) } : {}),
        ...(placesSyncForm.type.trim() ? { type: placesSyncForm.type.trim() } : {}),
        ...(placesSyncForm.forceCategory.trim() ? { forceCategory: placesSyncForm.forceCategory.trim() } : {}),
        ...(placesSyncForm.defaultPassword.trim() ? { defaultPassword: placesSyncForm.defaultPassword.trim() } : {}),
      };
      const res = await adminService.syncGooglePlacesVendors(payload);
      setLastSyncResult({ source: 'Google Places', ...res.results });
      setMessage('Google Places vendor sync completed'); setMessageType('success');
      await Promise.all([loadVerificationQueue(), loadAllVendors()]);
    } catch (err) {
      setMessage(getErrorMessage(err)); setMessageType('error');
    } finally {
      setSyncingPlaces(false);
    }
  };

  // ── Create User ─────────────────────────────────────────────────
  const createUser = async () => {
    if (!userForm.name.trim() || !userForm.email.trim() || !userForm.role.trim()) {
      setMessage('Name, email, and role are required'); setMessageType('error');
      return;
    }
    try {
      setCreating(true);
      await adminService.createUser(userForm);
      setMessage('User created'); setMessageType('success');
      setUserForm({ name: '', email: '', role: 'organizer', password: '', phone: '', businessName: '' });
    } catch (err) {
      setMessage(getErrorMessage(err)); setMessageType('error');
    } finally {
      setCreating(false);
    }
  };

  // ── Invite Template (Adobe Express) Actions ───────────────────
  const normalizeTemplateKey = (value) =>
    String(value || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

  const toggleBuilderField = (fieldKey) => {
    setBuilderForm((prev) => {
      const exists = prev.selectedFields.includes(fieldKey);
      const nextFields = exists
        ? prev.selectedFields.filter((key) => key !== fieldKey)
        : [...prev.selectedFields, fieldKey];

      const nextMappings = { ...prev.fieldMappings };
      if (exists) delete nextMappings[fieldKey];

      return {
        ...prev,
        selectedFields: nextFields,
        fieldMappings: nextMappings,
      };
    });
  };

  const pickAndUploadAdobeAsset = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission required', 'Media library permission is required to upload assets.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        quality: 1,
      });

      if (result.canceled || !result.assets?.length) return;

      const picked = result.assets[0];
      const fileName = picked.fileName || picked.uri.split('/').pop() || 'asset.png';
      const mimeType = picked.mimeType || (picked.type === 'video' ? 'video/mp4' : 'image/png');

      setUploadingAdobeAsset(true);
      const uploadRes = await adminService.uploadAdobeExpressAsset({
        file: { uri: picked.uri, fileName, mimeType },
        templateKey: normalizeTemplateKey(builderForm.templateKey) || undefined,
      });

      const uploaded = uploadRes.asset || null;
      if (!uploaded?.assetPath) {
        throw new Error('Asset upload response missing asset path');
      }

      setUploadedAdobeAssets((prev) => {
        if (prev.some((item) => item.assetPath === uploaded.assetPath)) return prev;
        return [...prev, uploaded];
      });

      setBuilderForm((prev) => {
        if (prev.selectedAssets.includes(uploaded.assetPath)) return prev;
        return { ...prev, selectedAssets: [...prev.selectedAssets, uploaded.assetPath] };
      });

      setMessage('Asset uploaded and added to scenes');
      setMessageType('success');
    } catch (err) {
      setMessage(getErrorMessage(err));
      setMessageType('error');
    } finally {
      setUploadingAdobeAsset(false);
    }
  };

  const moveSelectedAsset = (index, direction) => {
    setBuilderForm((prev) => {
      const next = [...prev.selectedAssets];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...prev, selectedAssets: next };
    });
  };

  const removeSelectedAsset = (assetPath) => {
    setBuilderForm((prev) => {
      const nextAssets = prev.selectedAssets.filter((path) => path !== assetPath);
      const nextMappings = { ...prev.fieldMappings };

      Object.keys(nextMappings).forEach((fieldKey) => {
        nextMappings[fieldKey] = (nextMappings[fieldKey] || []).filter((layer) => layer.sceneAsset !== assetPath);
      });

      return {
        ...prev,
        selectedAssets: nextAssets,
        fieldMappings: nextMappings,
      };
    });

    setSelectedSceneIndex(0);
  };

  const upsertActiveLayerForField = (fieldKey, sceneAsset, patch) => {
    setBuilderForm((prev) => {
      const existing = prev.fieldMappings[fieldKey] || [];
      const current = existing.find((layer) => layer.sceneAsset === sceneAsset);
      const nextLayer = {
        sceneAsset,
        ...DEFAULT_LAYER,
        ...(current || {}),
        ...(patch || {}),
      };

      const others = existing.filter((layer) => layer.sceneAsset !== sceneAsset);
      return {
        ...prev,
        fieldMappings: {
          ...prev.fieldMappings,
          [fieldKey]: [...others, nextLayer],
        },
      };
    });
  };

  const handlePreviewTap = (event) => {
    if (suppressPreviewTapRef.current) {
      suppressPreviewTapRef.current = false;
      return;
    }

    if (!activeFieldForMapping) return;
    const sceneAsset = builderForm.selectedAssets[selectedSceneIndex];
    if (!sceneAsset) return;

    const width = Math.max(1, previewSize.width);
    const height = Math.max(1, previewSize.height);
    const normalizedX = Math.max(0, Math.min(1, event.nativeEvent.locationX / width));
    const normalizedY = Math.max(0, Math.min(1, event.nativeEvent.locationY / height));
    const layer = (builderForm.fieldMappings[activeFieldForMapping] || []).find((item) => item.sceneAsset === sceneAsset);
    const layerWidth = Number(layer?.width ?? DEFAULT_LAYER.width);
    const layerHeight = Number(layer?.height ?? DEFAULT_LAYER.height);

    const x = clamp(normalizedX - layerWidth / 2, 0, 1 - layerWidth);
    const y = clamp(normalizedY - layerHeight / 2, 0, 1 - layerHeight);

    upsertActiveLayerForField(activeFieldForMapping, sceneAsset, { x: Number(x.toFixed(4)), y: Number(y.toFixed(4)) });
  };

  const getActiveLayerInCurrentScene = useCallback(() => {
    const sceneAsset = builderForm.selectedAssets[selectedSceneIndex];
    if (!sceneAsset || !activeFieldForMapping) return null;
    const layer = (builderForm.fieldMappings[activeFieldForMapping] || []).find((item) => item.sceneAsset === sceneAsset);
    if (!layer) return null;
    return {
      sceneAsset,
      layer,
    };
  }, [activeFieldForMapping, builderForm.fieldMappings, builderForm.selectedAssets, selectedSceneIndex]);

  const moveLayerPanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => Boolean(getActiveLayerInCurrentScene()),
    onMoveShouldSetPanResponder: (_, gestureState) => Boolean(getActiveLayerInCurrentScene()) && (Math.abs(gestureState.dx) > 1 || Math.abs(gestureState.dy) > 1),
    onPanResponderGrant: () => {
      const current = getActiveLayerInCurrentScene();
      if (!current) return;
      suppressPreviewTapRef.current = true;
      gestureStartRef.current = {
        type: 'move',
        sceneAsset: current.sceneAsset,
        x: Number(current.layer.x ?? DEFAULT_LAYER.x),
        y: Number(current.layer.y ?? DEFAULT_LAYER.y),
        width: Number(current.layer.width ?? DEFAULT_LAYER.width),
        height: Number(current.layer.height ?? DEFAULT_LAYER.height),
      };
    },
    onPanResponderMove: (_, gestureState) => {
      const start = gestureStartRef.current;
      if (!start || start.type !== 'move' || !activeFieldForMapping) return;
      const width = Math.max(1, previewSize.width);
      const height = Math.max(1, previewSize.height);
      const dx = gestureState.dx / width;
      const dy = gestureState.dy / height;
      const nextX = clamp(start.x + dx, 0, 1 - start.width);
      const nextY = clamp(start.y + dy, 0, 1 - start.height);
      upsertActiveLayerForField(activeFieldForMapping, start.sceneAsset, {
        x: Number(nextX.toFixed(4)),
        y: Number(nextY.toFixed(4)),
      });
    },
    onPanResponderRelease: () => {
      gestureStartRef.current = null;
      setTimeout(() => {
        suppressPreviewTapRef.current = false;
      }, 0);
    },
    onPanResponderTerminate: () => {
      gestureStartRef.current = null;
      setTimeout(() => {
        suppressPreviewTapRef.current = false;
      }, 0);
    },
  }), [activeFieldForMapping, clamp, getActiveLayerInCurrentScene, previewSize.height, previewSize.width]);

  const resizeLayerPanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => Boolean(getActiveLayerInCurrentScene()),
    onMoveShouldSetPanResponder: (_, gestureState) => Boolean(getActiveLayerInCurrentScene()) && (Math.abs(gestureState.dx) > 1 || Math.abs(gestureState.dy) > 1),
    onPanResponderGrant: () => {
      const current = getActiveLayerInCurrentScene();
      if (!current) return;
      suppressPreviewTapRef.current = true;
      gestureStartRef.current = {
        type: 'resize',
        sceneAsset: current.sceneAsset,
        x: Number(current.layer.x ?? DEFAULT_LAYER.x),
        y: Number(current.layer.y ?? DEFAULT_LAYER.y),
        width: Number(current.layer.width ?? DEFAULT_LAYER.width),
        height: Number(current.layer.height ?? DEFAULT_LAYER.height),
      };
    },
    onPanResponderMove: (_, gestureState) => {
      const start = gestureStartRef.current;
      if (!start || start.type !== 'resize' || !activeFieldForMapping) return;
      const viewWidth = Math.max(1, previewSize.width);
      const viewHeight = Math.max(1, previewSize.height);
      const dx = gestureState.dx / viewWidth;
      const dy = gestureState.dy / viewHeight;
      const nextWidth = clamp(start.width + dx, 0.05, 1);
      const nextHeight = clamp(start.height + dy, 0.05, 1);
      const nextX = clamp(start.x, 0, 1 - nextWidth);
      const nextY = clamp(start.y, 0, 1 - nextHeight);
      upsertActiveLayerForField(activeFieldForMapping, start.sceneAsset, {
        x: Number(nextX.toFixed(4)),
        y: Number(nextY.toFixed(4)),
        width: Number(nextWidth.toFixed(4)),
        height: Number(nextHeight.toFixed(4)),
      });
    },
    onPanResponderRelease: () => {
      gestureStartRef.current = null;
      setTimeout(() => {
        suppressPreviewTapRef.current = false;
      }, 0);
    },
    onPanResponderTerminate: () => {
      gestureStartRef.current = null;
      setTimeout(() => {
        suppressPreviewTapRef.current = false;
      }, 0);
    },
  }), [activeFieldForMapping, clamp, getActiveLayerInCurrentScene, previewSize.height, previewSize.width]);

  const buildManifestFromBuilder = () => {
    const templateKey = normalizeTemplateKey(builderForm.templateKey);
    if (!templateKey) {
      Alert.alert('Validation', 'Template key is required.');
      return null;
    }
    if (!builderForm.templateName.trim()) {
      Alert.alert('Validation', 'Template name is required.');
      return null;
    }
    if (!builderForm.selectedAssets.length) {
      Alert.alert('Validation', 'Upload and select at least one scene asset.');
      return null;
    }

    const selectedFields = builderForm.selectedFields.length
      ? builderForm.selectedFields
      : ['hostName', 'partnerName', 'eventDate', 'eventVenue'];

    const timelineScenes = builderForm.selectedAssets.map((assetPath, index) => ({
      id: `scene_${index + 1}`,
      durationMs: 3500,
      asset: assetPath,
      transitions: {
        in: index === 0 ? 'fade' : 'crossfade',
        out: 'crossfade',
      },
    }));

    const bindings = [];
    selectedFields.forEach((fieldKey) => {
      const layers = builderForm.fieldMappings[fieldKey] || [];
      layers.forEach((layer, idx) => {
        if (!layer?.sceneAsset) return;
        const sceneIndex = builderForm.selectedAssets.findIndex((asset) => asset === layer.sceneAsset);
        if (sceneIndex === -1) return;
        bindings.push({
          id: `bind_${fieldKey}_${sceneIndex}_${idx}`,
          fieldKey,
          target: {
            sceneId: `scene_${sceneIndex + 1}`,
            property: 'text',
            layer: {
              x: Number(layer.x ?? DEFAULT_LAYER.x),
              y: Number(layer.y ?? DEFAULT_LAYER.y),
              width: Number(layer.width ?? DEFAULT_LAYER.width),
              height: Number(layer.height ?? DEFAULT_LAYER.height),
            },
          },
          style: {
            fontFamily: 'Poppins',
            fontSize: fieldKey === 'hostName' || fieldKey === 'partnerName' ? 52 : 34,
            color: '#ffffff',
            align: 'center',
            weight: fieldKey === 'hostName' || fieldKey === 'partnerName' ? '700' : '500',
          },
        });
      });
    });

    return {
      version: '1.0.0',
      template: {
        key: templateKey,
        name: builderForm.templateName.trim(),
        category: builderForm.category.trim() || 'wedding',
        supportedVariants: ['default'],
      },
      fields: selectedFields.map((fieldKey) => {
        const field = INVITE_FIELD_CATALOG.find((item) => item.key === fieldKey);
        return {
          key: fieldKey,
          label: field?.label || fieldKey,
          type: 'text',
          required: ['hostName', 'partnerName', 'eventDate', 'eventVenue'].includes(fieldKey),
          maxLength: 120,
        };
      }),
      timeline: {
        fps: 30,
        scenes: timelineScenes,
      },
      bindings,
      output: {
        format: 'mp4',
        width: 1080,
        height: 1920,
        codec: 'h264',
        audio: {
          musicAsset: builderForm.musicAssetUrl.trim() || undefined,
        },
      },
    };
  };

  const generateManifestFromBuilder = () => {
    const manifest = buildManifestFromBuilder();
    if (!manifest) return;
    setGeneratedManifestPayload(manifest);
    setManifestInputText(JSON.stringify(manifest, null, 2));
    setManifestValidationResult(null);
    setManifestImportResult(null);
    setMessage('Manifest generated from mobile builder');
    setMessageType('success');
  };

  const validateManifestInput = async () => {
    if (!manifestInputText.trim()) {
      Alert.alert('Validation', 'Generate or paste a manifest JSON first.');
      return;
    }
    try {
      const manifest = JSON.parse(manifestInputText);
      setValidatingAdobeManifest(true);
      const res = await adminService.validateAdobeExpressManifest({ manifest });
      setManifestValidationResult(res);
      setMessage(res?.valid ? 'Manifest validation passed' : 'Manifest validation failed');
      setMessageType(res?.valid ? 'success' : 'error');
    } catch (err) {
      setManifestValidationResult({ valid: false, errors: [getErrorMessage(err)] });
      setMessage(getErrorMessage(err));
      setMessageType('error');
    } finally {
      setValidatingAdobeManifest(false);
    }
  };

  const importManifestInput = async () => {
    if (!manifestInputText.trim()) {
      Alert.alert('Validation', 'Generate or paste a manifest JSON first.');
      return;
    }
    try {
      const manifest = JSON.parse(manifestInputText);
      setImportingAdobeManifest(true);
      const res = await adminService.importAdobeExpressManifest({ manifest });
      setManifestImportResult(res);
      setMessage('Adobe template imported successfully');
      setMessageType('success');
      clearBuilderDraft();
      await loadInviteTemplates();
    } catch (err) {
      setMessage(getErrorMessage(err));
      setMessageType('error');
    } finally {
      setImportingAdobeManifest(false);
    }
  };

  // ── Auth Guard ──────────────────────────────────────────────────
  if (user?.role !== 'admin') {
    return (
      <View style={styles.centered}>
        <Text variant="titleMedium" style={{ color: Colors.textPrimary }}>Admin Only</Text>
        <Text style={{ color: Colors.textSecondary, marginTop: Spacing.sm }}>You are not authorized to access this page.</Text>
      </View>
    );
  }

  // ── Tab Content Renderers ───────────────────────────────────────
  const renderCategories = () => (
    <View>
      <View style={styles.tabHeader}>
        <Text variant="titleMedium" style={styles.sectionTitle}>Service Categories</Text>
        <Button mode="contained-tonal" compact icon="plus" onPress={() => setShowCatModal(true)}>Add</Button>
      </View>
      {loadingCategories && <ActivityIndicator style={{ marginVertical: Spacing.md }} color={Colors.primary} />}
      {categories.length === 0 && !loadingCategories && (
        <Text style={styles.emptyText}>No categories yet.</Text>
      )}
      {categories.map((cat) => (
        <Card key={cat.id} style={styles.itemCard}>
          <Card.Content style={styles.itemRow}>
            <View style={{ flex: 1 }}>
              <Text variant="titleSmall" style={{ fontWeight: '700' }}>{cat.label}</Text>
              <Text variant="bodySmall" style={{ color: Colors.textSecondary }}>{cat.name} • {cat.color || 'default'}</Text>
              <View style={{ flexDirection: 'row', marginTop: 4, gap: 4 }}>
                <Chip compact textStyle={{ fontSize: 10 }} style={cat.isActive ? styles.activeChip : styles.inactiveChip}>
                  {cat.isActive ? 'Active' : 'Inactive'}
                </Chip>
                {cat.sortOrder != null && (
                  <Chip compact textStyle={{ fontSize: 10, color: Colors.textSecondary }}>#{cat.sortOrder}</Chip>
                )}
              </View>
            </View>
            <IconButton icon="delete-outline" iconColor={Colors.danger} size={20} onPress={() => removeCategory(cat.id, cat.label)} />
          </Card.Content>
        </Card>
      ))}
    </View>
  );

  const renderVendorManagement = () => (
    <View>
      <View style={styles.tabHeader}>
        <Text variant="titleMedium" style={styles.sectionTitle}>All Marketplace Vendors</Text>
        <Text variant="bodySmall" style={{ color: Colors.textSecondary }}>
          {allVendors.length}/{vendorTotal}
        </Text>
      </View>
      {loadingAllVendors && <ActivityIndicator style={{ marginVertical: Spacing.md }} color={Colors.primary} />}
      {allVendors.length === 0 && !loadingAllVendors && (
        <Text style={styles.emptyText}>No vendors registered yet.</Text>
      )}
      {allVendors.map((v) => (
        <Card key={v.id} style={styles.itemCard}>
          <Card.Content>
            <View style={styles.itemRow}>
              <View style={{ flex: 1 }}>
                <Text variant="titleSmall" style={{ fontWeight: '700' }}>{v.businessName}</Text>
                <Text variant="bodySmall" style={{ color: Colors.textSecondary }}>
                  {v.category} • {v.user?.name || '-'} • {v.user?.email || '-'}
                </Text>
                <View style={{ flexDirection: 'row', marginTop: 4, gap: 4 }}>
                  <Chip compact textStyle={{ fontSize: 10 }} style={v.isVerified ? styles.activeChip : styles.pendingChip}>
                    {v.verificationStatus || 'pending'}
                  </Chip>
                  <Chip compact textStyle={{ fontSize: 10, color: Colors.textSecondary }}>
                    ⭐ {Number(v.averageRating || 0).toFixed(1)} ({v.totalReviews || 0})
                  </Chip>
                </View>
              </View>
              <IconButton
                icon="delete-outline"
                iconColor={Colors.danger}
                size={20}
                disabled={deletingVendorId === v.id}
                onPress={() => removeVendor(v.id, v.businessName)}
              />
            </View>
          </Card.Content>
        </Card>
      ))}
      {allVendors.length < vendorTotal && (
        <Button
          mode="contained-tonal"
          loading={loadingMoreVendors}
          disabled={loadingMoreVendors}
          onPress={loadMore}
          style={{ marginTop: Spacing.md }}
        >
          Load More ({allVendors.length} of {vendorTotal})
        </Button>
      )}
    </View>
  );

  const renderVerificationQueue = () => (
    <View>
      <Text variant="titleMedium" style={styles.sectionTitle}>Vendor Verification Queue</Text>
      {loadingVendors && <ActivityIndicator style={{ marginVertical: Spacing.md }} color={Colors.primary} />}
      {vendors.length === 0 && !loadingVendors && (
        <Text style={styles.emptyText}>No vendors pending verification right now.</Text>
      )}
      {vendors.map((v) => (
        <Card key={v.id} style={styles.itemCard}>
          <Card.Content>
            <View style={styles.itemRow}>
              <View style={{ flex: 1 }}>
                <Text variant="titleSmall" style={{ fontWeight: '700' }}>{v.businessName}</Text>
                <Text variant="bodySmall" style={{ color: Colors.textSecondary }}>
                  {v.category} • {v.user?.name || '-'}
                </Text>
                <Chip compact textStyle={{ fontSize: 10 }} style={v.isVerified ? styles.activeChip : styles.pendingChip}>
                  {v.verificationStatus || 'pending'}
                </Chip>
              </View>
              <View style={styles.vendorActions}>
                <Button compact mode="contained" loading={verifyingId === v.id} onPress={() => verify(v.id, 'approved')} style={styles.approveBtn} labelStyle={{ fontWeight: '600', fontSize: 12 }}>Approve</Button>
                <Button compact mode="outlined" loading={verifyingId === v.id} onPress={() => verify(v.id, 'rejected')} textColor={Colors.danger} style={styles.rejectBtn}>Reject</Button>
              </View>
            </View>
          </Card.Content>
        </Card>
      ))}
    </View>
  );

  const renderCreateUser = () => (
    <View>
      <Text variant="titleMedium" style={styles.sectionTitle}>Create User</Text>
      <TextInput label="Name *" mode="outlined" value={userForm.name} onChangeText={(v) => setUserForm((p) => ({ ...p, name: v }))} style={styles.input} outlineStyle={styles.outline} />
      <TextInput label="Email *" mode="outlined" value={userForm.email} onChangeText={(v) => setUserForm((p) => ({ ...p, email: v }))} keyboardType="email-address" autoCapitalize="none" style={styles.input} outlineStyle={styles.outline} />
      <TextInput label="Password" mode="outlined" value={userForm.password} onChangeText={(v) => setUserForm((p) => ({ ...p, password: v }))} secureTextEntry style={styles.input} outlineStyle={styles.outline} />
      <TextInput label="Phone" mode="outlined" value={userForm.phone} onChangeText={(v) => setUserForm((p) => ({ ...p, phone: v }))} keyboardType="phone-pad" style={styles.input} outlineStyle={styles.outline} />
      <TextInput label="Business Name (for vendor)" mode="outlined" value={userForm.businessName} onChangeText={(v) => setUserForm((p) => ({ ...p, businessName: v }))} style={styles.input} outlineStyle={styles.outline} />
      <Text variant="labelMedium" style={styles.fieldLabel}>Role</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.md }}>
        {roles.map((r) => (
          <Chip key={r} selected={userForm.role === r} onPress={() => setUserForm((p) => ({ ...p, role: r }))} style={styles.chip} textStyle={{ textTransform: 'capitalize' }}>{r}</Chip>
        ))}
      </ScrollView>
      <Button mode="contained" loading={creating} disabled={creating} onPress={createUser} style={styles.btn} labelStyle={{ fontWeight: '600' }}>Create User</Button>
    </View>
  );

  const renderOnboarding = () => (
    <View>
      <Text variant="titleMedium" style={styles.sectionTitle}>Bulk Vendor Onboarding</Text>

      <Card style={styles.itemCard}>
        <Card.Content>
          <Text variant="titleSmall" style={{ fontWeight: '700', marginBottom: Spacing.md }}>Import From Google Forms</Text>
          <TextInput label="Rows To Process" mode="outlined" value={formsSyncForm.limit} onChangeText={(v) => setFormsSyncForm((p) => ({ ...p, limit: v.replace(/[^0-9]/g, '') }))} keyboardType="number-pad" style={styles.input} outlineStyle={styles.outline} />
          <TextInput label="Spreadsheet ID" mode="outlined" value={formsSyncForm.spreadsheetId} onChangeText={(v) => setFormsSyncForm((p) => ({ ...p, spreadsheetId: v }))} style={styles.input} outlineStyle={styles.outline} />
          <TextInput label="Sheet Range" mode="outlined" value={formsSyncForm.range} onChangeText={(v) => setFormsSyncForm((p) => ({ ...p, range: v }))} placeholder="Form Responses 1!A1:ZZ1000" style={styles.input} outlineStyle={styles.outline} />
          <TextInput label="Default Vendor Password" mode="outlined" value={formsSyncForm.defaultPassword} onChangeText={(v) => setFormsSyncForm((p) => ({ ...p, defaultPassword: v }))} secureTextEntry style={styles.input} outlineStyle={styles.outline} />
          <Button mode="contained" loading={syncingForms} disabled={syncingForms} onPress={syncFromForms} style={styles.btn}>Start Form Onboarding</Button>
        </Card.Content>
      </Card>

      <Card style={styles.itemCard}>
        <Card.Content>
          <Text variant="titleSmall" style={{ fontWeight: '700', marginBottom: Spacing.md }}>Import From Google Places</Text>
          <TextInput label="Search Query" mode="outlined" value={placesSyncForm.query} onChangeText={(v) => setPlacesSyncForm((p) => ({ ...p, query: v }))} placeholder="wedding caterers in Hyderabad" style={styles.input} outlineStyle={styles.outline} />
          <LocationPicker
            label="City"
            value={placesSyncForm.city}
            onChange={(v) => setPlacesSyncForm((p) => ({ ...p, city: v }))}
            onLocationPick={(loc) =>
              setPlacesSyncForm((p) => ({
                ...p,
                city: loc?.city || loc?.name || p.city,
                state: loc?.state || p.state,
                lat: Number.isFinite(Number(loc?.lat)) ? String(loc.lat) : p.lat,
                lng: Number.isFinite(Number(loc?.lng)) ? String(loc.lng) : p.lng,
              }))
            }
            placeholder="Type city and pick suggestion"
            style={styles.input}
          />
          <TextInput label="State" mode="outlined" value={placesSyncForm.state} onChangeText={(v) => setPlacesSyncForm((p) => ({ ...p, state: v }))} placeholder="Telangana" style={styles.input} outlineStyle={styles.outline} />
          <TextInput label="Latitude (optional)" mode="outlined" value={placesSyncForm.lat} onChangeText={(v) => setPlacesSyncForm((p) => ({ ...p, lat: v.replace(/[^0-9.\-]/g, '') }))} keyboardType="numeric" placeholder="17.3850" style={styles.input} outlineStyle={styles.outline} />
          <TextInput label="Longitude (optional)" mode="outlined" value={placesSyncForm.lng} onChangeText={(v) => setPlacesSyncForm((p) => ({ ...p, lng: v.replace(/[^0-9.\-]/g, '') }))} keyboardType="numeric" placeholder="78.4867" style={styles.input} outlineStyle={styles.outline} />
          <TextInput label="Max Listings" mode="outlined" value={placesSyncForm.limit} onChangeText={(v) => setPlacesSyncForm((p) => ({ ...p, limit: v.replace(/[^0-9]/g, '') }))} keyboardType="number-pad" style={styles.input} outlineStyle={styles.outline} />
          <TextInput label="Radius (meters)" mode="outlined" value={placesSyncForm.radiusMeters} onChangeText={(v) => setPlacesSyncForm((p) => ({ ...p, radiusMeters: v.replace(/[^0-9]/g, '') }))} keyboardType="number-pad" style={styles.input} outlineStyle={styles.outline} />
          <TextInput label="Google Place Type" mode="outlined" value={placesSyncForm.type} onChangeText={(v) => setPlacesSyncForm((p) => ({ ...p, type: v }))} placeholder="caterer, florist, lodging" style={styles.input} outlineStyle={styles.outline} />
          <TextInput label="Force Marketplace Category" mode="outlined" value={placesSyncForm.forceCategory} onChangeText={(v) => setPlacesSyncForm((p) => ({ ...p, forceCategory: v }))} placeholder="catering, venue, florist..." style={styles.input} outlineStyle={styles.outline} />
          <TextInput label="Review Page (Google)" mode="outlined" value={placesSyncForm.reviewPage} onChangeText={(v) => setPlacesSyncForm((p) => ({ ...p, reviewPage: v.replace(/[^0-9]/g, '') }))} keyboardType="number-pad" style={styles.input} outlineStyle={styles.outline} />
          <TextInput label="Reviews Per Vendor (Page Size)" mode="outlined" value={placesSyncForm.reviewLimit} onChangeText={(v) => setPlacesSyncForm((p) => ({ ...p, reviewLimit: v.replace(/[^0-9]/g, '') }))} keyboardType="number-pad" style={styles.input} outlineStyle={styles.outline} />
          <Text style={{ color: Colors.textSecondary, marginTop: -4, marginBottom: Spacing.sm }}>
            Google may return only a limited review subset for some places. Pagination here controls how many reviews our sync processes from that subset.
          </Text>
          <TextInput label="Default Vendor Password" mode="outlined" value={placesSyncForm.defaultPassword} onChangeText={(v) => setPlacesSyncForm((p) => ({ ...p, defaultPassword: v }))} secureTextEntry style={styles.input} outlineStyle={styles.outline} />
          <Button mode="contained" loading={syncingPlaces} disabled={syncingPlaces} onPress={syncFromPlaces} style={styles.btn}>Start Places Onboarding</Button>
        </Card.Content>
      </Card>

      <Card style={styles.itemCard}>
        <Card.Content>
          <Text variant="titleSmall" style={{ fontWeight: '700', marginBottom: Spacing.sm }}>Latest Onboarding Run</Text>
          {lastSyncResult ? (
            <>
              <Text style={{ color: Colors.textSecondary, marginBottom: Spacing.sm }}>
                {lastSyncResult.source} • Processed {lastSyncResult.processed || 0} • Created {lastSyncResult.created || 0} • Skipped {lastSyncResult.skipped || 0} • Failed {lastSyncResult.failed || 0}
              </Text>
              {Array.isArray(lastSyncResult.credentials) && lastSyncResult.credentials.length > 0 ? (
                <Text style={styles.codeBlock}>{lastSyncResult.credentials.map((item) => `${item.email} | ${item.password}`).join('\n')}</Text>
              ) : (
                <Text style={styles.emptyText}>No credentials returned in the latest run.</Text>
              )}
            </>
          ) : (
            <Text style={styles.emptyText}>Open this tab to trigger bulk onboarding from mobile.</Text>
          )}
        </Card.Content>
      </Card>
    </View>
  );

  const renderPayments = () => (
    <View>
      <Text variant="titleMedium" style={styles.sectionTitle}>Service Payment Controls</Text>
      {loadingPaymentConfigs && <ActivityIndicator style={{ marginVertical: Spacing.md }} color={Colors.primary} />}
      {paymentConfigs.length === 0 && !loadingPaymentConfigs && (
        <Text style={styles.emptyText}>No payment configurations found.</Text>
      )}
      {paymentConfigs.map((cfg) => (
        <Card key={cfg.entityType} style={styles.itemCard}>
          <Card.Content>
            <Text variant="titleSmall" style={{ fontWeight: '700' }}>{cfg.entityType}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.xs }}>
              <Text style={{ color: Colors.textSecondary }}>Enabled</Text>
              <Button
                compact
                mode={cfg.isEnabled ? 'contained' : 'outlined'}
                loading={savingPaymentConfig === cfg.entityType}
                onPress={() =>
                  updatePaymentConfiguration(cfg.entityType, {
                    isEnabled: !cfg.isEnabled,
                    amount: cfg.amount,
                    allowManualOverride: cfg.allowManualOverride,
                    description: cfg.description,
                  })
                }
              >
                {cfg.isEnabled ? 'On' : 'Off'}
              </Button>
            </View>
            <TextInput
              label="Amount (INR)"
              mode="outlined"
              value={String(cfg.amount ?? 0)}
              onChangeText={(v) => {
                const nextAmount = Number(v.replace(/[^0-9.]/g, '') || 0);
                setPaymentConfigs((prev) => prev.map((p) => (p.entityType === cfg.entityType ? { ...p, amount: nextAmount } : p)));
              }}
              onBlur={() =>
                updatePaymentConfiguration(cfg.entityType, {
                  isEnabled: cfg.isEnabled,
                  amount: Number(cfg.amount || 0),
                  allowManualOverride: cfg.allowManualOverride,
                  description: cfg.description,
                })
              }
              keyboardType="numeric"
              style={styles.input}
              outlineStyle={styles.outline}
            />
          </Card.Content>
        </Card>
      ))}
    </View>
  );

  const renderInviteTemplates = () => {
    const currentSceneAsset = builderForm.selectedAssets[selectedSceneIndex] || null;
    const currentSceneUploaded = uploadedAdobeAssets.find((asset) => asset.assetPath === currentSceneAsset);
    const activeLayers = builderForm.selectedFields
      .map((fieldKey) => {
        const layer = (builderForm.fieldMappings[fieldKey] || []).find((item) => item.sceneAsset === currentSceneAsset);
        return layer ? { fieldKey, layer } : null;
      })
      .filter(Boolean);

    const activeFieldLayer = activeFieldForMapping
      ? (builderForm.fieldMappings[activeFieldForMapping] || []).find((item) => item.sceneAsset === currentSceneAsset)
      : null;

    return (
      <View>
        <Text variant="titleMedium" style={styles.sectionTitle}>Invite Templates (Adobe Express)</Text>

        <Card style={styles.itemCard}>
          <Card.Content>
            <Text variant="titleSmall" style={{ fontWeight: '700', marginBottom: Spacing.md }}>Builder</Text>
            <TextInput
              label="Template Key"
              mode="outlined"
              value={builderForm.templateKey}
              onChangeText={(v) => setBuilderForm((prev) => ({ ...prev, templateKey: normalizeTemplateKey(v) }))}
              placeholder="e.g. premium-royal-wedding"
              style={styles.input}
              outlineStyle={styles.outline}
            />
            <TextInput
              label="Template Name"
              mode="outlined"
              value={builderForm.templateName}
              onChangeText={(v) => setBuilderForm((prev) => ({ ...prev, templateName: v }))}
              placeholder="Premium Royal Wedding"
              style={styles.input}
              outlineStyle={styles.outline}
            />
            <TextInput
              label="Category"
              mode="outlined"
              value={builderForm.category}
              onChangeText={(v) => setBuilderForm((prev) => ({ ...prev, category: v }))}
              placeholder="wedding"
              style={styles.input}
              outlineStyle={styles.outline}
            />
            <TextInput
              label="Music Asset URL (optional)"
              mode="outlined"
              value={builderForm.musicAssetUrl}
              onChangeText={(v) => setBuilderForm((prev) => ({ ...prev, musicAssetUrl: v }))}
              placeholder="https://.../music.mp3"
              style={styles.input}
              outlineStyle={styles.outline}
            />

            <Text variant="labelMedium" style={styles.fieldLabel}>Fields</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.md }}>
              {INVITE_FIELD_CATALOG.map((field) => (
                <Chip
                  key={field.key}
                  selected={builderForm.selectedFields.includes(field.key)}
                  onPress={() => toggleBuilderField(field.key)}
                  style={styles.chip}
                >
                  {field.label}
                </Chip>
              ))}
            </ScrollView>

            <Button
              mode="contained-tonal"
              icon="upload"
              loading={uploadingAdobeAsset}
              disabled={uploadingAdobeAsset}
              onPress={pickAndUploadAdobeAsset}
              style={styles.btnSoft}
            >
              Upload Scene Asset
            </Button>

            {builderForm.selectedAssets.map((assetPath, index) => (
              <Card key={assetPath} style={styles.assetCard}>
                <Card.Content style={styles.assetRow}>
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ fontWeight: '600' }}>{assetPath}</Text>
                    <Text style={{ color: Colors.textSecondary, fontSize: 12 }}>Scene {index + 1}</Text>
                  </View>
                  <View style={{ flexDirection: 'row' }}>
                    <IconButton icon="arrow-up" size={18} onPress={() => moveSelectedAsset(index, -1)} disabled={index === 0} />
                    <IconButton icon="arrow-down" size={18} onPress={() => moveSelectedAsset(index, 1)} disabled={index === builderForm.selectedAssets.length - 1} />
                    <IconButton icon="delete-outline" size={18} iconColor={Colors.danger} onPress={() => removeSelectedAsset(assetPath)} />
                  </View>
                </Card.Content>
              </Card>
            ))}

            <View style={styles.mappingControlsRow}>
              <Button mode="contained" onPress={generateManifestFromBuilder} style={{ flex: 1 }}>Generate Manifest JSON</Button>
              <Button
                mode="outlined"
                textColor={Colors.danger}
                onPress={() =>
                  Alert.alert(
                    'Discard Draft',
                    'Clear the current builder form and delete the saved draft?',
                    [
                      { text: 'Cancel' },
                      {
                        text: 'Discard',
                        style: 'destructive',
                        onPress: () => {
                          setBuilderForm({
                            templateKey: '',
                            templateName: '',
                            category: '',
                            musicAssetUrl: '',
                            selectedFields: ['hostName', 'partnerName', 'eventDate', 'eventVenue'],
                            selectedAssets: [],
                            fieldMappings: {},
                          });
                          setUploadedAdobeAssets([]);
                          setManifestInputText('');
                          setManifestValidationResult(null);
                          setManifestImportResult(null);
                          setSelectedSceneIndex(0);
                          clearBuilderDraft();
                          setMessage('Draft discarded');
                          setMessageType('info');
                        },
                      },
                    ],
                  )
                }
              >
                Discard Draft
              </Button>
            </View>
          </Card.Content>
        </Card>

        <Card style={styles.itemCard}>
          <Card.Content>
            <Text variant="titleSmall" style={{ fontWeight: '700', marginBottom: Spacing.md }}>Placeholder Mapper</Text>
            {builderForm.selectedAssets.length === 0 ? (
              <Text style={styles.emptyText}>Upload and select at least one scene asset to map placeholders.</Text>
            ) : (
              <>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.sm }}>
                  {builderForm.selectedAssets.map((assetPath, idx) => (
                    <Chip
                      key={`${assetPath}_${idx}`}
                      selected={idx === selectedSceneIndex}
                      onPress={() => setSelectedSceneIndex(idx)}
                      style={styles.chip}
                    >
                      Scene {idx + 1}
                    </Chip>
                  ))}
                </ScrollView>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.sm }}>
                  {builderForm.selectedFields.map((fieldKey) => (
                    <Chip
                      key={fieldKey}
                      selected={activeFieldForMapping === fieldKey}
                      onPress={() => setActiveFieldForMapping(fieldKey)}
                      style={styles.chip}
                    >
                      {INVITE_FIELD_CATALOG.find((f) => f.key === fieldKey)?.label || fieldKey}
                    </Chip>
                  ))}
                </ScrollView>

                <TouchableOpacity
                  activeOpacity={0.95}
                  onPress={handlePreviewTap}
                  onLayout={(event) => {
                    const { width, height } = event.nativeEvent.layout;
                    setPreviewSize({ width, height });
                  }}
                  style={styles.mapperPreview}
                >
                  {currentSceneUploaded?.url ? (
                    <Image source={{ uri: currentSceneUploaded.url }} style={styles.mapperPreviewImage} resizeMode="cover" />
                  ) : (
                    <View style={styles.mapperFallback}><Text style={{ color: Colors.textSecondary }}>No preview available</Text></View>
                  )}

                  {activeLayers.map(({ fieldKey, layer }) => {
                    const isActiveLayer = activeFieldForMapping === fieldKey;
                    const layerWidth = Math.max(0.05, Math.min(1, Number(layer.width || DEFAULT_LAYER.width)));
                    const layerHeight = Math.max(0.05, Math.min(1, Number(layer.height || DEFAULT_LAYER.height)));
                    const layerX = Math.max(0, Math.min(1 - layerWidth, Number(layer.x || 0)));
                    const layerY = Math.max(0, Math.min(1 - layerHeight, Number(layer.y || 0)));

                    if (isActiveLayer) {
                      return (
                        <View
                          key={`${fieldKey}_${layer.sceneAsset}`}
                          {...moveLayerPanResponder.panHandlers}
                          style={[
                            styles.mappingBox,
                            styles.mappingBoxActive,
                            {
                              left: `${layerX * 100}%`,
                              top: `${layerY * 100}%`,
                              width: `${layerWidth * 100}%`,
                              height: `${layerHeight * 100}%`,
                            },
                          ]}
                        >
                          <Text style={styles.mappingBoxText} numberOfLines={1}>{fieldKey}</Text>
                          <View style={styles.mappingResizeHandle} {...resizeLayerPanResponder.panHandlers} />
                        </View>
                      );
                    }

                    return (
                      <TouchableOpacity
                        key={`${fieldKey}_${layer.sceneAsset}`}
                        activeOpacity={0.9}
                        onPressIn={() => {
                          suppressPreviewTapRef.current = true;
                        }}
                        onPress={() => {
                          setActiveFieldForMapping(fieldKey);
                          setTimeout(() => {
                            suppressPreviewTapRef.current = false;
                          }, 0);
                        }}
                        style={[
                          styles.mappingBox,
                          {
                            left: `${layerX * 100}%`,
                            top: `${layerY * 100}%`,
                            width: `${layerWidth * 100}%`,
                            height: `${layerHeight * 100}%`,
                            borderColor: '#38bdf8',
                          },
                        ]}
                      >
                        <Text style={styles.mappingBoxText} numberOfLines={1}>{fieldKey}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </TouchableOpacity>
                <Text style={{ color: Colors.textSecondary, marginTop: Spacing.xs, fontSize: 12 }}>
                  Tap to place, drag active box to move, drag corner handle to resize.
                </Text>

                {activeFieldLayer && (
                  <View style={{ marginTop: Spacing.md }}>
                    <Text variant="labelMedium" style={styles.fieldLabel}>Selected Field Box Size</Text>
                    <View style={styles.mappingControlsRow}>
                      <Button mode="outlined" compact onPress={() => upsertActiveLayerForField(activeFieldForMapping, currentSceneAsset, { width: Math.max(0.05, Number(activeFieldLayer.width || DEFAULT_LAYER.width) - 0.02) })}>W-</Button>
                      <Button mode="outlined" compact onPress={() => upsertActiveLayerForField(activeFieldForMapping, currentSceneAsset, { width: Math.min(1, Number(activeFieldLayer.width || DEFAULT_LAYER.width) + 0.02) })}>W+</Button>
                      <Button mode="outlined" compact onPress={() => upsertActiveLayerForField(activeFieldForMapping, currentSceneAsset, { height: Math.max(0.05, Number(activeFieldLayer.height || DEFAULT_LAYER.height) - 0.02) })}>H-</Button>
                      <Button mode="outlined" compact onPress={() => upsertActiveLayerForField(activeFieldForMapping, currentSceneAsset, { height: Math.min(1, Number(activeFieldLayer.height || DEFAULT_LAYER.height) + 0.02) })}>H+</Button>
                    </View>
                  </View>
                )}
              </>
            )}
          </Card.Content>
        </Card>

        <Card style={styles.itemCard}>
          <Card.Content>
            <Text variant="titleSmall" style={{ fontWeight: '700', marginBottom: Spacing.md }}>Manifest Review & Import</Text>
            <TextInput
              label="Manifest JSON"
              mode="outlined"
              value={manifestInputText}
              onChangeText={setManifestInputText}
              multiline
              numberOfLines={12}
              style={styles.codeInput}
              outlineStyle={styles.outline}
            />
            <View style={styles.mappingControlsRow}>
              <Button mode="contained-tonal" loading={validatingAdobeManifest} disabled={validatingAdobeManifest} onPress={validateManifestInput}>Validate</Button>
              <Button mode="contained" loading={importingAdobeManifest} disabled={importingAdobeManifest} onPress={importManifestInput}>Import</Button>
            </View>

            {manifestValidationResult && (
              <View style={{ marginTop: Spacing.md }}>
                <Text style={{ fontWeight: '700', color: manifestValidationResult.valid ? Colors.success : Colors.danger }}>
                  {manifestValidationResult.valid ? 'Validation passed' : 'Validation failed'}
                </Text>
                {Array.isArray(manifestValidationResult.errors) && manifestValidationResult.errors.length > 0 && (
                  <Text style={styles.codeBlock}>{manifestValidationResult.errors.join('\n')}</Text>
                )}
              </View>
            )}

            {manifestImportResult && (
              <View style={{ marginTop: Spacing.md }}>
                <Text style={{ fontWeight: '700', color: Colors.success }}>Imported</Text>
                <Text style={{ color: Colors.textSecondary }}>
                  Template: {manifestImportResult.template?.name || manifestImportResult.template?.key || 'Imported'}
                </Text>
              </View>
            )}
          </Card.Content>
        </Card>

        <Card style={styles.itemCard}>
          <Card.Content>
            <View style={styles.tabHeader}>
              <Text variant="titleSmall" style={{ fontWeight: '700' }}>Existing Invite Templates</Text>
              {loadingInviteTemplates && <ActivityIndicator size="small" color={Colors.primary} />}
            </View>
            {inviteTemplates.length === 0 && !loadingInviteTemplates ? (
              <Text style={styles.emptyText}>No invite templates available.</Text>
            ) : (
              inviteTemplates.map((tpl) => (
                <Card key={tpl.id} style={styles.assetCard}>
                  <Card.Content>
                    <Text style={{ fontWeight: '700' }}>{tpl.name}</Text>
                    <Text style={{ color: Colors.textSecondary, fontSize: 12 }}>{tpl.key} • {tpl.category || 'wedding'}</Text>
                  </Card.Content>
                </Card>
              ))
            )}
          </Card.Content>
        </Card>
      </View>
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadAll(); }} colors={[Colors.primary]} />}
    >
      {/* Hero */}
      <Card style={styles.heroCard}>
        <Card.Content>
          <Text variant="headlineSmall" style={styles.heroTitle}>Admin Control Center</Text>
            <Text style={styles.heroSubtitle}>Manage categories, vendors, users, payments, and invite templates.</Text>
        </Card.Content>
      </Card>

      {/* Tab Switcher */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll}>
        {[
          { value: 'payments', label: 'Payments' },
          { value: 'categories', label: 'Categories' },
          { value: 'vendors', label: 'Vendors' },
          { value: 'verification', label: 'Verification' },
          { value: 'onboarding', label: 'Onboarding' },
          { value: 'invite-templates', label: 'Invite Templates' },
          { value: 'users', label: 'Create User' },
        ].map((tab) => (
          <Chip
            key={tab.value}
            selected={activeTab === tab.value}
            onPress={() => setActiveTab(tab.value)}
            style={[styles.tabChip, activeTab === tab.value && styles.tabChipActive]}
            textStyle={[styles.tabChipText, activeTab === tab.value && styles.tabChipTextActive]}
          >
            {tab.label}
          </Chip>
        ))}
      </ScrollView>

      {/* Tab Content */}
      <Card style={styles.card}>
        <Card.Content>
          {activeTab === 'categories' && renderCategories()}
          {activeTab === 'payments' && renderPayments()}
          {activeTab === 'vendors' && renderVendorManagement()}
          {activeTab === 'verification' && renderVerificationQueue()}
          {activeTab === 'onboarding' && renderOnboarding()}
          {activeTab === 'invite-templates' && renderInviteTemplates()}
          {activeTab === 'users' && renderCreateUser()}
        </Card.Content>
      </Card>

      {message ? <Text style={messageType === 'error' ? styles.msgError : styles.msgSuccess}>{message}</Text> : null}

      {/* Add Category Modal */}
      <Portal>
        <Modal visible={showCatModal} onDismiss={() => setShowCatModal(false)} contentContainerStyle={styles.modal}>
          <Text variant="titleLarge" style={{ fontWeight: '800', marginBottom: Spacing.lg }}>Add Category</Text>
          <TextInput
            label="Category Name (slug)"
            placeholder="e.g. makeup_artist"
            value={catForm.name}
            onChangeText={(v) => setCatForm((p) => ({ ...p, name: v }))}
            mode="outlined"
            style={styles.input}
          />
          <Text variant="bodySmall" style={{ color: Colors.textMuted, marginBottom: Spacing.sm, marginTop: -8 }}>
            Lowercase identifier used internally
          </Text>
          <TextInput
            label="Display Label"
            placeholder="e.g. Makeup Artist"
            value={catForm.label}
            onChangeText={(v) => setCatForm((p) => ({ ...p, label: v }))}
            mode="outlined"
            style={styles.input}
          />
          <Text variant="labelMedium" style={styles.fieldLabel}>Tag Color</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.md }}>
            {tagColors.map((c) => (
              <Chip
                key={c}
                selected={catForm.color === c}
                onPress={() => setCatForm((p) => ({ ...p, color: c }))}
                style={styles.chip}
                textStyle={{ textTransform: 'capitalize' }}
              >
                {c}
              </Chip>
            ))}
          </ScrollView>
          <View style={styles.modalActions}>
            <Button mode="text" onPress={() => { setShowCatModal(false); setCatForm({ name: '', label: '', color: 'default' }); }}>Cancel</Button>
            <Button mode="contained" onPress={addCategory} loading={savingCat} disabled={savingCat}>Add Category</Button>
          </View>
        </Modal>
      </Portal>

      <View style={{ height: 20 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { padding: Spacing.lg, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xxl },
  heroCard: { marginBottom: Spacing.md, borderRadius: Radius.lg, elevation: 3, backgroundColor: Colors.surface },
  heroTitle: { fontWeight: '800', color: Colors.textPrimary },
  heroSubtitle: { marginTop: 6, color: Colors.textSecondary },
  tabScroll: { marginBottom: Spacing.md },
  tabChip: { marginRight: Spacing.sm, backgroundColor: Colors.surface, borderRadius: Radius.full },
  tabChipActive: { backgroundColor: Colors.primary },
  tabChipText: { color: Colors.textSecondary, fontWeight: '600' },
  tabChipTextActive: { color: Colors.textOnPrimary },
  card: { marginBottom: Spacing.md, borderRadius: Radius.lg, elevation: 2, backgroundColor: Colors.surface },
  sectionTitle: { fontWeight: '700', marginBottom: Spacing.md, color: Colors.textPrimary },
  tabHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  fieldLabel: { marginTop: Spacing.sm, marginBottom: Spacing.xs, color: Colors.textSecondary, fontWeight: '600' },
  itemCard: { marginBottom: Spacing.sm, borderRadius: Radius.sm, elevation: 1, backgroundColor: Colors.background },
  itemRow: { flexDirection: 'row', alignItems: 'center' },
  vendorActions: { flexDirection: 'row', gap: Spacing.xs },
  approveBtn: { backgroundColor: Colors.success, borderRadius: Radius.sm },
  rejectBtn: { borderColor: Colors.danger, borderRadius: Radius.sm },
  activeChip: { backgroundColor: '#dcfce7' },
  inactiveChip: { backgroundColor: '#fee2e2' },
  pendingChip: { backgroundColor: '#fef3c7' },
  emptyText: { color: Colors.textMuted, textAlign: 'center', paddingVertical: Spacing.lg },
  input: { marginBottom: Spacing.md },
  outline: { borderRadius: Radius.sm },
  chip: { marginRight: Spacing.sm },
  btn: { marginTop: Spacing.sm, backgroundColor: Colors.primary, borderRadius: Radius.sm },
  btnSoft: { marginBottom: Spacing.md, borderRadius: Radius.sm },
  msgError: { color: Colors.danger, marginTop: Spacing.sm, fontSize: 13 },
  msgSuccess: { color: Colors.success, marginTop: Spacing.sm, fontSize: 13 },
  assetCard: { marginBottom: Spacing.sm, borderRadius: Radius.sm, backgroundColor: Colors.surface },
  assetRow: { flexDirection: 'row', alignItems: 'center' },
  mapperPreview: {
    width: '100%',
    aspectRatio: 9 / 16,
    borderRadius: Radius.sm,
    overflow: 'hidden',
    backgroundColor: '#111827',
    position: 'relative',
  },
  mapperPreviewImage: { width: '100%', height: '100%' },
  mapperFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e5e7eb',
  },
  mappingBox: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  mappingBoxActive: {
    borderColor: '#f59e0b',
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
  },
  mappingResizeHandle: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 14,
    height: 14,
    borderTopLeftRadius: 4,
    backgroundColor: '#f59e0b',
    borderWidth: 1,
    borderColor: '#ffffff',
  },
  mappingBoxText: { fontSize: 10, color: '#ffffff', fontWeight: '700' },
  mappingControlsRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center', marginTop: Spacing.sm, flexWrap: 'wrap' },
  codeInput: {
    marginBottom: Spacing.md,
    backgroundColor: '#f8fafc',
    minHeight: 220,
    textAlignVertical: 'top',
    fontFamily: 'monospace',
  },
  codeBlock: {
    backgroundColor: '#0f172a',
    color: '#e2e8f0',
    padding: Spacing.md,
    borderRadius: Radius.sm,
    fontSize: 12,
    lineHeight: 18,
  },
  modal: { backgroundColor: Colors.surface, margin: Spacing.lg, padding: Spacing.xl, borderRadius: Radius.lg },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: Spacing.md },
});

export default AdminControlScreen;
