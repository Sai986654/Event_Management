import React, { useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { ScrollView, StyleSheet, View, Alert, RefreshControl, Image, Dimensions } from 'react-native';
import {
  ActivityIndicator, Button, Card, Chip, Text, TextInput, Divider, FAB,
  IconButton, Modal, Portal, SegmentedButtons,
} from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import { AuthContext } from '../context/AuthContext';
import { vendorService } from '../services/vendorService';
import { packageService } from '../services/packageService';
import { adminService } from '../services/adminService';
import { getErrorMessage, formatCurrency } from '../utils/helpers';
import { Colors, Spacing, Radius } from '../theme';

const FALLBACK_CATEGORIES = ['catering', 'decor', 'photography', 'videography', 'music', 'venue', 'florist', 'transportation', 'other'];
const catLabel = (c) => c ? c.charAt(0).toUpperCase() + c.slice(1) : '';
const TIERS = ['basic', 'standard', 'premium', 'luxury'];

const CATEGORY_FIELDS = {
  catering: [
    { name: 'perPlate', label: 'Per Plate Cost', prefix: '₹', placeholder: '350' },
    { name: 'extraSweetCost', label: 'Extra Sweet (per item)', prefix: '₹', placeholder: '10' },
    { name: 'extraStarterCost', label: 'Extra Starter (per item)', prefix: '₹', placeholder: '15' },
    { name: 'extraMainCourseCost', label: 'Extra Main Course (per item)', prefix: '₹', placeholder: '20' },
    { name: 'minPlates', label: 'Minimum Plates', placeholder: '100' },
    { name: 'liveCounterCost', label: 'Live Counter Charge', prefix: '₹', placeholder: '5000' },
  ],
  photography: [
    { name: 'perHour', label: 'Per Hour', prefix: '₹', placeholder: '2000' },
    { name: 'extraCameraCost', label: 'Extra Camera/Photographer', prefix: '₹', placeholder: '3000' },
    { name: 'editedPhotos', label: 'Edited Photos Included', placeholder: '500' },
    { name: 'albumCost', label: 'Album Cost', prefix: '₹', placeholder: '5000' },
    { name: 'droneCost', label: 'Drone Coverage', prefix: '₹', placeholder: '8000' },
  ],
  videography: [
    { name: 'perHour', label: 'Per Hour', prefix: '₹', placeholder: '3000' },
    { name: 'extraCameraCost', label: 'Extra Cameraman', prefix: '₹', placeholder: '4000' },
    { name: 'droneCost', label: 'Drone Coverage', prefix: '₹', placeholder: '8000' },
    { name: 'highlightReelCost', label: 'Highlight Reel', prefix: '₹', placeholder: '10000' },
    { name: 'trailerCost', label: 'Wedding Trailer', prefix: '₹', placeholder: '15000' },
  ],
  decor: [
    { name: 'perTable', label: 'Per Table Setup', prefix: '₹', placeholder: '1500' },
    { name: 'stageCost', label: 'Stage Decoration', prefix: '₹', placeholder: '25000' },
    { name: 'entranceCost', label: 'Entrance Decoration', prefix: '₹', placeholder: '10000' },
    { name: 'extraItemCost', label: 'Extra Item / Add-on', prefix: '₹', placeholder: '500' },
    { name: 'lightingCost', label: 'Lighting Package', prefix: '₹', placeholder: '15000' },
  ],
  music: [
    { name: 'perHour', label: 'Per Hour', prefix: '₹', placeholder: '5000' },
    { name: 'soundSystemCost', label: 'Sound System Charge', prefix: '₹', placeholder: '10000' },
    { name: 'extraArtistCost', label: 'Extra Artist / Singer', prefix: '₹', placeholder: '8000' },
    { name: 'djCost', label: 'DJ Setup', prefix: '₹', placeholder: '15000' },
  ],
  venue: [
    { name: 'perDay', label: 'Per Day Rental', prefix: '₹', placeholder: '50000' },
    { name: 'perHour', label: 'Per Hour (if applicable)', prefix: '₹', placeholder: '5000' },
    { name: 'cleaningCharge', label: 'Cleaning Charge', prefix: '₹', placeholder: '3000' },
    { name: 'securityDeposit', label: 'Security Deposit', prefix: '₹', placeholder: '10000' },
    { name: 'acCharge', label: 'AC / Generator Charge', prefix: '₹', placeholder: '8000' },
  ],
  florist: [
    { name: 'perArrangement', label: 'Per Arrangement', prefix: '₹', placeholder: '2000' },
    { name: 'bouquetCost', label: 'Bouquet Cost', prefix: '₹', placeholder: '1500' },
    { name: 'perTableCenterpiece', label: 'Table Centerpiece', prefix: '₹', placeholder: '800' },
    { name: 'carDecorationCost', label: 'Car Decoration', prefix: '₹', placeholder: '3000' },
  ],
  transportation: [
    { name: 'perTrip', label: 'Per Trip', prefix: '₹', placeholder: '2000' },
    { name: 'perKm', label: 'Per Km', prefix: '₹', placeholder: '15' },
    { name: 'waitingChargePerHour', label: 'Waiting Charge / Hr', prefix: '₹', placeholder: '200' },
    { name: 'driverAllowance', label: 'Driver Allowance', prefix: '₹', placeholder: '500' },
  ],
  other: [
    { name: 'perUnit', label: 'Per Unit Cost', prefix: '₹', placeholder: '0' },
    { name: 'perHour', label: 'Per Hour', prefix: '₹', placeholder: '0' },
  ],
};

const VendorWorkspaceScreen = ({ navigation }) => {
  const { user } = useContext(AuthContext);
  const [vendor, setVendor] = useState(null);
  const [packages, setPackages] = useState([]);
  const [allCategories, setAllCategories] = useState(FALLBACK_CATEGORIES);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Service modal
  const [serviceModalVisible, setServiceModalVisible] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [svcCategory, setSvcCategory] = useState('');
  const [svcDescription, setSvcDescription] = useState('');
  const [savingService, setSavingService] = useState(false);

  // Package modal
  const [pkgModalVisible, setPkgModalVisible] = useState(false);
  const [editingPackage, setEditingPackage] = useState(null);
  const [pkgCategory, setPkgCategory] = useState('');
  const [pkgTitle, setPkgTitle] = useState('');
  const [pkgDescription, setPkgDescription] = useState('');
  const [pkgTier, setPkgTier] = useState('standard');
  const [pkgBasePrice, setPkgBasePrice] = useState('');
  const [pkgDeliverables, setPkgDeliverables] = useState('');
  const [pkgCustomPricing, setPkgCustomPricing] = useState({});
  const [pkgCustomParams, setPkgCustomParams] = useState([]); // [{ name, value }]
  const [newParamName, setNewParamName] = useState('');
  const [newParamValue, setNewParamValue] = useState('');
  const [savingPackage, setSavingPackage] = useState(false);

  // Testimonial modal
  const [testimonialModalVisible, setTestimonialModalVisible] = useState(false);
  const [testClientName, setTestClientName] = useState('');
  const [testContent, setTestContent] = useState('');
  const [testRating, setTestRating] = useState('');
  const [testSource, setTestSource] = useState('');
  const [savingTestimonial, setSavingTestimonial] = useState(false);

  // Portfolio state
  const [mediaCaption, setMediaCaption] = useState('');
  const [uploadingMedia, setUploadingMedia] = useState(false);

  // Raw materials supplier catalog state
  const [rawMaterialItems, setRawMaterialItems] = useState([]);
  const [rawMaterialModalVisible, setRawMaterialModalVisible] = useState(false);
  const [editingRawMaterial, setEditingRawMaterial] = useState(null);
  const [rmName, setRmName] = useState('');
  const [rmDescription, setRmDescription] = useState('');
  const [rmPrice, setRmPrice] = useState('');
  const [rmPhotoUrl, setRmPhotoUrl] = useState('');
  const [rmCategories, setRmCategories] = useState([]);
  const [savingRawMaterial, setSavingRawMaterial] = useState(false);
  const [uploadingRawMaterialPhoto, setUploadingRawMaterialPhoto] = useState(false);

  if (user?.role !== 'vendor' && user?.role !== 'admin') {
    return (
      <View style={styles.centered}>
        <Text variant="titleMedium" style={{ color: Colors.textPrimary }}>Access Restricted</Text>
        <Text style={{ color: Colors.textSecondary, marginTop: Spacing.sm }}>Only vendors can access the workspace.</Text>
      </View>
    );
  }

  const loadData = useCallback(async () => {
    try {
      // Categories
      try {
        const catRes = await adminService.getCategories();
        const cats = (catRes.categories || []).map((c) => c.name);
        if (cats.length > 0) setAllCategories(cats);
      } catch (_) {}

      const res = await vendorService.searchVendors({ limit: 100 });
      const mine = (res.vendors || []).find((v) => v.user?.id === user?.id);
      if (mine) {
        const detail = await vendorService.getVendorById(mine.id);
        const fullVendor = detail.vendor || mine;
        setVendor(fullVendor);
        setRawMaterialItems(Array.isArray(fullVendor.rawMaterialItems) ? fullVendor.rawMaterialItems : []);
        const pkgRes = await packageService.getMyPackages();
        setPackages(pkgRes.packages || []);
      } else {
        setVendor(null);
        setRawMaterialItems([]);
        setPackages([]);
      }
    } catch (err) {
      Alert.alert('Error', getErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  // Derived data
  const services = useMemo(() => {
    const raw = vendor?.packages;
    return Array.isArray(raw) ? raw : [];
  }, [vendor]);

  const usedCategories = useMemo(() => services.map((s) => s.category), [services]);
  const availableCategories = useMemo(() => allCategories.filter((c) => !usedCategories.includes(c)), [usedCategories, allCategories]);

  const packagesByCategory = useMemo(() => {
    const map = {};
    packages.forEach((pkg) => {
      const cat = pkg.category || 'other';
      if (!map[cat]) map[cat] = [];
      map[cat].push(pkg);
    });
    return map;
  }, [packages]);

  // ---- Service CRUD ----
  const openAddService = () => {
    setEditingService(null);
    setSvcCategory(availableCategories[0] || '');
    setSvcDescription('');
    setServiceModalVisible(true);
  };

  const openEditService = (svc) => {
    setEditingService(svc);
    setSvcCategory(svc.category);
    setSvcDescription(svc.serviceDescription || '');
    setServiceModalVisible(true);
  };

  const saveService = async () => {
    if (!svcCategory || !svcDescription.trim()) {
      Alert.alert('Error', 'Category and description are required');
      return;
    }
    setSavingService(true);
    try {
      let updated;
      if (editingService) {
        updated = services.map((s) =>
          s.category === editingService.category
            ? { ...s, category: svcCategory, serviceDescription: svcDescription.trim() }
            : s
        );
        if (svcCategory !== editingService.category) {
          const toUpdate = packagesByCategory[editingService.category] || [];
          await Promise.all(toUpdate.map((pkg) => packageService.updatePackage(pkg.id, { category: svcCategory })));
        }
      } else {
        updated = [...services, { category: svcCategory, serviceDescription: svcDescription.trim(), createdAt: new Date().toISOString() }];
      }
      await vendorService.updateVendorProfile(vendor.id, { packages: updated });
      Alert.alert('Success', editingService ? 'Service updated' : 'Service added');
      setServiceModalVisible(false);
      await loadData();
    } catch (err) {
      Alert.alert('Error', getErrorMessage(err));
    } finally {
      setSavingService(false);
    }
  };

  const deleteService = (category) => {
    const catPkgs = packagesByCategory[category] || [];
    Alert.alert(
      `Delete "${catLabel(category)}" service?`,
      catPkgs.length > 0 ? `This will also delete ${catPkgs.length} package(s).` : 'This service has no packages.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive', onPress: async () => {
            try {
              await Promise.all(catPkgs.map((pkg) => packageService.deletePackage(pkg.id)));
              const updated = services.filter((s) => s.category !== category);
              await vendorService.updateVendorProfile(vendor.id, { packages: updated });
              Alert.alert('Success', 'Service deleted');
              await loadData();
            } catch (err) {
              Alert.alert('Error', getErrorMessage(err));
            }
          },
        },
      ]
    );
  };

  // ---- Package CRUD ----
  const openAddPackage = (category) => {
    setEditingPackage(null);
    setPkgCategory(category);
    setPkgTitle('');
    setPkgDescription('');
    setPkgTier('standard');
    setPkgBasePrice('');
    setPkgDeliverables('');
    setPkgCustomPricing({});
    setPkgCustomParams([]);
    setNewParamName('');
    setNewParamValue('');
    setPkgModalVisible(true);
  };

  const openEditPackage = (pkg) => {
    setEditingPackage(pkg);
    setPkgCategory(pkg.category);
    setPkgTitle(pkg.title || '');
    setPkgDescription(pkg.description || '');
    setPkgTier(pkg.tier || 'standard');
    setPkgBasePrice(String(pkg.basePrice || ''));
    setPkgDeliverables(Array.isArray(pkg.deliverables) ? pkg.deliverables.join(', ') : '');
    const rules = pkg.estimationRules || {};
    const knownKeys = new Set((CATEGORY_FIELDS[pkg.category] || []).map((f) => f.name));
    const cp = {};
    const customP = [];
    Object.entries(rules).forEach(([k, v]) => {
      if (knownKeys.has(k)) {
        cp[k] = String(v);
      } else {
        customP.push({ name: k, value: String(v) });
      }
    });
    setPkgCustomPricing(cp);
    setPkgCustomParams(customP);
    setNewParamName('');
    setNewParamValue('');
    setPkgModalVisible(true);
  };

  const savePackage = async () => {
    if (!pkgTitle.trim() || !pkgDescription.trim()) {
      Alert.alert('Error', 'Title and description are required');
      return;
    }
    setSavingPackage(true);
    try {
      const estimationRules = {};
      Object.entries(pkgCustomPricing).forEach(([k, v]) => {
        const num = Number(v);
        if (num > 0) estimationRules[k] = num;
      });
      // Merge custom parameters
      pkgCustomParams.forEach((p) => {
        if (p.name.trim() && Number(p.value) > 0) {
          estimationRules[p.name.trim()] = Number(p.value);
        }
      });
      const payload = {
        title: pkgTitle.trim(),
        description: pkgDescription.trim(),
        category: pkgCategory,
        tier: pkgTier,
        basePrice: Number(pkgBasePrice || 0),
        estimationRules,
        deliverables: pkgDeliverables ? pkgDeliverables.split(',').map((d) => d.trim()).filter(Boolean) : [],
      };
      if (editingPackage) {
        await packageService.updatePackage(editingPackage.id, payload);
        Alert.alert('Success', 'Package updated');
      } else {
        await packageService.createPackage(payload);
        Alert.alert('Success', 'Package added');
      }
      setPkgModalVisible(false);
      await loadData();
    } catch (err) {
      Alert.alert('Error', getErrorMessage(err));
    } finally {
      setSavingPackage(false);
    }
  };

  const confirmDeletePackage = (pkg) => {
    Alert.alert('Delete Package', `Delete "${pkg.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await packageService.deletePackage(pkg.id);
            Alert.alert('Success', 'Package deleted');
            await loadData();
          } catch (err) {
            Alert.alert('Error', getErrorMessage(err));
          }
        },
      },
    ]);
  };

  // ---- Testimonials ----
  const saveTestimonial = async () => {
    if (!testClientName.trim() || !testContent.trim()) {
      Alert.alert('Error', 'Client name and testimonial are required');
      return;
    }
    setSavingTestimonial(true);
    try {
      await packageService.addTestimonial({
        clientName: testClientName.trim(),
        content: testContent.trim(),
        rating: testRating ? Number(testRating) : undefined,
        source: testSource.trim() || undefined,
      });
      Alert.alert('Success', 'Testimonial added');
      setTestimonialModalVisible(false);
      setTestClientName('');
      setTestContent('');
      setTestRating('');
      setTestSource('');
    } catch (err) {
      Alert.alert('Error', getErrorMessage(err));
    } finally {
      setSavingTestimonial(false);
    }
  };

  // ---- Portfolio media ----
  const portfolioItems = useMemo(() => {
    return Array.isArray(vendor?.portfolio) ? vendor.portfolio : [];
  }, [vendor]);

  const pickAndUploadMedia = async () => {
    if (!vendor?.id) { Alert.alert('Error', 'Create your business profile first.'); return; }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Allow access to your photos to upload portfolio media.'); return; }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    setUploadingMedia(true);
    try {
      await vendorService.uploadVendorMedia(vendor.id, {
        uri: asset.uri,
        fileName: asset.fileName || `media-${Date.now()}.jpg`,
        mimeType: asset.mimeType || (asset.type === 'video' ? 'video/mp4' : 'image/jpeg'),
      }, mediaCaption);
      Alert.alert('Success', 'Portfolio media uploaded');
      setMediaCaption('');
      await loadData();
    } catch (err) {
      Alert.alert('Upload Error', getErrorMessage(err));
    } finally {
      setUploadingMedia(false);
    }
  };

  // ---- Raw material supplier catalog ----
  const openAddRawMaterial = () => {
    setEditingRawMaterial(null);
    setRmName('');
    setRmDescription('');
    setRmPrice('');
    setRmPhotoUrl('');
    setRmCategories([]);
    setRawMaterialModalVisible(true);
  };

  const openEditRawMaterial = (item) => {
    setEditingRawMaterial(item);
    setRmName(item.itemName || '');
    setRmDescription(item.description || '');
    setRmPrice(String(item.price || ''));
    setRmPhotoUrl(item.photoUrl || '');
    setRmCategories(Array.isArray(item.categories) ? item.categories : []);
    setRawMaterialModalVisible(true);
  };

  const toggleRawMaterialCategory = (cat) => {
    setRmCategories((prev) => (prev.includes(cat)
      ? prev.filter((c) => c !== cat)
      : [...prev, cat]));
  };

  const pickAndUploadRawMaterialPhoto = async () => {
    if (!vendor?.id) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow access to upload raw material photo.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;

    setUploadingRawMaterialPhoto(true);
    try {
      const asset = result.assets[0];
      const upload = await vendorService.uploadRawMaterialPhoto({
        uri: asset.uri,
        fileName: asset.fileName || `raw-material-${Date.now()}.jpg`,
        mimeType: asset.mimeType || 'image/jpeg',
      }, vendor.id);
      setRmPhotoUrl(upload.photoUrl || '');
      Alert.alert('Success', 'Photo uploaded');
    } catch (err) {
      Alert.alert('Upload Error', getErrorMessage(err));
    } finally {
      setUploadingRawMaterialPhoto(false);
    }
  };

  const saveRawMaterialItem = async () => {
    if (!rmName.trim()) {
      Alert.alert('Error', 'Item name is required');
      return;
    }
    if (Number(rmPrice || 0) < 0) {
      Alert.alert('Error', 'Price must be 0 or more');
      return;
    }

    setSavingRawMaterial(true);
    try {
      const payload = {
        itemName: rmName.trim(),
        description: rmDescription.trim() || null,
        price: Number(rmPrice || 0),
        photoUrl: rmPhotoUrl || null,
        categories: rmCategories,
        isActive: true,
      };

      if (editingRawMaterial) {
        await vendorService.updateRawMaterialItem(editingRawMaterial.id, payload);
        Alert.alert('Success', 'Raw material item updated');
      } else {
        await vendorService.createRawMaterialItem(payload);
        Alert.alert('Success', 'Raw material item added');
      }

      setRawMaterialModalVisible(false);
      await loadData();
    } catch (err) {
      Alert.alert('Error', getErrorMessage(err));
    } finally {
      setSavingRawMaterial(false);
    }
  };

  const deleteRawMaterialItem = (item) => {
    Alert.alert('Delete Item', `Delete "${item.itemName}" from your raw material catalog?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await vendorService.deleteRawMaterialItem(item.id);
            Alert.alert('Success', 'Raw material item deleted');
            await loadData();
          } catch (err) {
            Alert.alert('Error', getErrorMessage(err));
          }
        },
      },
    ]);
  };

  // ---- No vendor profile ----
  if (!vendor && !loading) {
    return (
      <View style={styles.centered}>
        <Text style={{ fontSize: 48, marginBottom: Spacing.md }}>🏪</Text>
        <Text variant="titleLarge" style={{ fontWeight: '700', color: Colors.textPrimary, textAlign: 'center' }}>
          Create Your Business Profile
        </Text>
        <Text style={{ color: Colors.textSecondary, marginTop: Spacing.sm, textAlign: 'center', paddingHorizontal: Spacing.xxl }}>
          Go to your Profile tab to create a business profile first, then come back here.
        </Text>
        <Button mode="contained" style={{ marginTop: Spacing.xl, borderRadius: Radius.sm }} onPress={() => navigation.navigate('ProfileTab')}>
          Go to Profile
        </Button>
      </View>
    );
  }

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  }

  const statusColor = { approved: Colors.success, pending: Colors.warning, rejected: Colors.danger }[vendor?.verificationStatus] || Colors.textMuted;

  return (
    <Portal.Host>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} colors={[Colors.primary]} />}
      >
        {/* Hero */}
        <Card style={styles.heroCard}>
          <Card.Content>
            <View style={styles.heroRow}>
              <View style={{ flex: 1 }}>
                <Text variant="titleLarge" style={styles.heroTitle}>Vendor Workspace</Text>
                <Text style={styles.heroSubtitle}>Manage services, packages & testimonials</Text>
              </View>
              <View style={styles.heroTags}>
                <Chip compact style={{ backgroundColor: statusColor + '20' }} textStyle={{ color: statusColor, fontSize: 11, fontWeight: '600' }}>
                  {vendor?.verificationStatus || 'pending'}
                </Chip>
                {vendor?.isVerified && (
                  <Chip compact icon="check-circle" style={{ backgroundColor: Colors.success + '18' }} textStyle={{ color: Colors.success, fontSize: 11 }}>Verified</Chip>
                )}
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Add Service Button */}
        <Button
          mode="contained"
          icon="plus"
          onPress={openAddService}
          disabled={availableCategories.length === 0}
          style={styles.addServiceBtn}
          labelStyle={styles.addServiceBtnLabel}
          contentStyle={{ paddingVertical: 6 }}
        >
          Add a New Service
        </Button>
        {availableCategories.length === 0 && (
          <Text style={styles.allCatText}>You've added services in all available categories.</Text>
        )}

        {/* Service Cards */}
        {services.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Card.Content style={{ alignItems: 'center', paddingVertical: Spacing.xxl }}>
              <Text style={{ fontSize: 36, marginBottom: Spacing.sm }}>📦</Text>
              <Text style={{ color: Colors.textMuted, textAlign: 'center' }}>No services yet. Add your first service above.</Text>
            </Card.Content>
          </Card>
        ) : (
          services.map((svc) => {
            const cat = svc.category;
            const catPkgs = packagesByCategory[cat] || [];
            return (
              <Card key={cat} style={styles.serviceCard}>
                <Card.Content>
                  {/* Service header */}
                  <View style={styles.serviceHeader}>
                    <View style={styles.serviceHeaderLeft}>
                      <Chip compact style={styles.serviceCatChip} textStyle={styles.serviceCatText}>{catLabel(cat)}</Chip>
                      <Text style={styles.servicePkgCount}>{catPkgs.length} package{catPkgs.length !== 1 ? 's' : ''}</Text>
                    </View>
                    <View style={styles.serviceActions}>
                      <IconButton icon="pencil" size={18} onPress={() => openEditService(svc)} />
                      <IconButton icon="delete" size={18} iconColor={Colors.danger} onPress={() => deleteService(cat)} />
                    </View>
                  </View>

                  {/* Service description */}
                  {svc.serviceDescription ? (
                    <View style={styles.svcDescBox}>
                      <Text style={styles.svcDescText}>{svc.serviceDescription}</Text>
                    </View>
                  ) : null}

                  {/* Package cards */}
                  {catPkgs.length === 0 ? (
                    <Text style={styles.noPkgText}>No packages yet for this service.</Text>
                  ) : (
                    catPkgs.map((pkg) => {
                      const rules = pkg.estimationRules || {};
                      const catFields = CATEGORY_FIELDS[cat] || [];
                      const pricingTags = catFields.filter((f) => rules[f.name] > 0);
                      return (
                        <Card key={pkg.id} style={styles.pkgCard}>
                          <Card.Content>
                            <View style={styles.pkgHeader}>
                              <Text variant="titleSmall" style={styles.pkgTitle} numberOfLines={1}>{pkg.title}</Text>
                              <View style={styles.pkgHeaderRight}>
                                <Chip compact style={styles.tierChip} textStyle={styles.tierChipText}>{pkg.tier || 'standard'}</Chip>
                              </View>
                            </View>
                            <Text variant="bodySmall" numberOfLines={2} style={styles.pkgDesc}>{pkg.description}</Text>
                            <Text style={styles.pkgPrice}>{formatCurrency(pkg.basePrice)}</Text>

                            {/* Category-specific pricing tags */}
                            {pricingTags.length > 0 && (
                              <View style={styles.pricingTagsRow}>
                                {pricingTags.map((f) => (
                                  <View key={f.name} style={styles.pricingTag}>
                                    <Text style={styles.pricingTagText}>₹{Number(rules[f.name]).toLocaleString('en-IN')} {f.label.replace(/\(₹\)/, '').trim().toLowerCase()}</Text>
                                  </View>
                                ))}
                              </View>
                            )}

                            {/* Deliverables */}
                            {Array.isArray(pkg.deliverables) && pkg.deliverables.length > 0 && (
                              <View style={styles.deliverablesRow}>
                                {pkg.deliverables.slice(0, 3).map((d, i) => (
                                  <View key={i} style={styles.deliverableTag}>
                                    <Text style={styles.deliverableText}>{d}</Text>
                                  </View>
                                ))}
                                {pkg.deliverables.length > 3 && (
                                  <View style={styles.deliverableTag}>
                                    <Text style={styles.deliverableText}>+{pkg.deliverables.length - 3} more</Text>
                                  </View>
                                )}
                              </View>
                            )}

                            {/* Status + actions */}
                            <View style={styles.pkgFooter}>
                              <Chip compact style={{ backgroundColor: pkg.isActive ? Colors.success + '18' : Colors.textMuted + '18' }}
                                textStyle={{ color: pkg.isActive ? Colors.success : Colors.textMuted, fontSize: 10 }}>
                                {pkg.isActive ? 'Active' : 'Inactive'}
                              </Chip>
                              <View style={styles.pkgActions}>
                                <IconButton icon="pencil" size={16} onPress={() => openEditPackage(pkg)} />
                                <IconButton icon="delete" size={16} iconColor={Colors.danger} onPress={() => confirmDeletePackage(pkg)} />
                              </View>
                            </View>
                          </Card.Content>
                        </Card>
                      );
                    })
                  )}

                  {/* Add package button */}
                  <Button
                    mode="outlined"
                    icon="plus"
                    onPress={() => openAddPackage(cat)}
                    style={styles.addPkgBtn}
                    labelStyle={{ fontSize: 13 }}
                  >
                    Add Package to {catLabel(cat)}
                  </Button>
                </Card.Content>
              </Card>
            );
          })
        )}

        {/* Testimonial section */}
        <Card style={styles.serviceCard}>
          <Card.Content>
            <View style={styles.serviceHeader}>
              <Text variant="titleMedium" style={styles.sectionTitle}>Testimonials</Text>
              <IconButton icon="plus" size={20} onPress={() => setTestimonialModalVisible(true)} />
            </View>
            <Text style={{ color: Colors.textSecondary, fontSize: 13 }}>
              Add client testimonials to build trust with potential customers.
            </Text>
            <Button
              mode="contained-tonal"
              icon="message-star"
              onPress={() => setTestimonialModalVisible(true)}
              style={{ marginTop: Spacing.md, borderRadius: Radius.sm }}
            >
              Add Testimonial
            </Button>
          </Card.Content>
        </Card>

        {/* Portfolio Media */}
        <Card style={styles.serviceCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>Portfolio Media</Text>
            <Text style={{ color: Colors.textSecondary, fontSize: 13, marginBottom: Spacing.md }}>
              Showcase your best work to attract customers.
            </Text>

            <TextInput
              label="Caption (optional)"
              value={mediaCaption}
              onChangeText={setMediaCaption}
              mode="outlined"
              placeholder="Describe this media..."
              style={styles.input}
              outlineStyle={styles.outline}
            />

            <Button
              mode="contained"
              icon="camera-plus"
              onPress={pickAndUploadMedia}
              loading={uploadingMedia}
              disabled={uploadingMedia}
              style={{ borderRadius: Radius.sm, backgroundColor: Colors.primary, marginBottom: Spacing.md }}
            >
              Upload Photo / Video
            </Button>

            {portfolioItems.length === 0 ? (
              <Text style={{ textAlign: 'center', color: Colors.textMuted, paddingVertical: Spacing.lg }}>
                No portfolio media yet. Upload your best work!
              </Text>
            ) : (
              <View style={styles.portfolioGrid}>
                {portfolioItems.map((item) => (
                  <View key={item.id || item.url} style={styles.portfolioItem}>
                    {item.type === 'video' ? (
                      <View style={styles.portfolioVideoPlaceholder}>
                        <Text style={styles.portfolioVideoIcon}>🎬</Text>
                        <Text style={styles.portfolioVideoLabel}>Video</Text>
                      </View>
                    ) : (
                      <Image source={{ uri: item.url }} style={styles.portfolioImage} resizeMode="cover" />
                    )}
                    {item.caption ? <Text numberOfLines={1} style={styles.portfolioCaption}>{item.caption}</Text> : null}
                  </View>
                ))}
              </View>
            )}
          </Card.Content>
        </Card>

        {/* Raw Material Supplier Catalog */}
        <Card style={styles.serviceCard}>
          <Card.Content>
            <View style={styles.serviceHeader}>
              <Text variant="titleMedium" style={styles.sectionTitle}>Raw Material Supplier Catalog</Text>
              <Button compact mode="contained-tonal" icon="plus" onPress={openAddRawMaterial}>
                Add Item
              </Button>
            </View>
            <Text style={{ color: Colors.textSecondary, fontSize: 13, marginBottom: Spacing.md }}>
              Add supply items with multi-category tags so vendors can quickly source what they need.
            </Text>

            {rawMaterialItems.length === 0 ? (
              <Text style={{ color: Colors.textMuted, textAlign: 'center', paddingVertical: Spacing.md }}>
                No raw material items yet. Add your first item.
              </Text>
            ) : (
              rawMaterialItems.map((item) => (
                <Card key={item.id} style={styles.rawItemCard}>
                  <Card.Content>
                    <View style={styles.rawItemRow}>
                      {item.photoUrl ? <Image source={{ uri: item.photoUrl }} style={styles.rawItemPhoto} /> : null}
                      <View style={{ flex: 1 }}>
                        <Text variant="titleSmall" style={styles.pkgTitle}>{item.itemName}</Text>
                        <Text style={styles.pkgPrice}>{formatCurrency(item.price)}</Text>
                        {item.description ? (
                          <Text numberOfLines={2} style={styles.pkgDesc}>{item.description}</Text>
                        ) : null}
                        <View style={styles.deliverablesRow}>
                          {(Array.isArray(item.categories) ? item.categories : []).map((c) => (
                            <View key={`${item.id}-${c}`} style={styles.deliverableTag}>
                              <Text style={styles.deliverableText}>{catLabel(c)}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                      <View style={styles.pkgActions}>
                        <IconButton icon="pencil" size={16} onPress={() => openEditRawMaterial(item)} />
                        <IconButton icon="delete" size={16} iconColor={Colors.danger} onPress={() => deleteRawMaterialItem(item)} />
                      </View>
                    </View>
                  </Card.Content>
                </Card>
              ))
            )}
          </Card.Content>
        </Card>

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* ===== SERVICE MODAL ===== */}
      <Portal>
        <Modal visible={serviceModalVisible} onDismiss={() => setServiceModalVisible(false)} contentContainerStyle={styles.modal}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text variant="titleLarge" style={styles.modalTitle}>
              {editingService ? `Edit: ${catLabel(editingService.category)}` : 'Add a New Service'}
            </Text>
            <Text style={styles.modalSubtitle}>
              {editingService ? 'Update your service details.' : 'Choose a category and describe what you offer.'}
            </Text>

            <Text variant="labelLarge" style={styles.fieldLabel}>Service Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.md }}>
              {(editingService ? allCategories : availableCategories).map((c) => (
                <Chip
                  key={c}
                  selected={svcCategory === c}
                  disabled={!!editingService}
                  onPress={() => setSvcCategory(c)}
                  style={[styles.catChip, svcCategory === c && styles.catChipActive]}
                  textStyle={svcCategory === c ? styles.catChipTextActive : styles.catChipText}
                >
                  {catLabel(c)}
                </Chip>
              ))}
            </ScrollView>

            <TextInput
              label="Describe This Service *"
              value={svcDescription}
              onChangeText={setSvcDescription}
              mode="outlined"
              multiline
              numberOfLines={5}
              placeholder="What does your service include? Experience, equipment, coverage areas..."
              style={styles.input}
              outlineStyle={styles.outline}
            />

            <View style={styles.modalActions}>
              <Button mode="contained" onPress={saveService} loading={savingService} style={styles.modalSaveBtn}>
                {editingService ? 'Update Service' : 'Add Service'}
              </Button>
              <Button mode="text" onPress={() => setServiceModalVisible(false)}>Cancel</Button>
            </View>
          </ScrollView>
        </Modal>
      </Portal>

      {/* ===== PACKAGE MODAL ===== */}
      <Portal>
        <Modal visible={pkgModalVisible} onDismiss={() => setPkgModalVisible(false)} contentContainerStyle={styles.modal}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text variant="titleLarge" style={styles.modalTitle}>
              {editingPackage ? `Edit: ${editingPackage.title}` : `Add Package to ${catLabel(pkgCategory)}`}
            </Text>

            <TextInput
              label="Package Title *"
              value={pkgTitle}
              onChangeText={setPkgTitle}
              mode="outlined"
              placeholder="e.g. Wedding Premium Package"
              style={styles.input}
              outlineStyle={styles.outline}
            />

            <Text variant="labelLarge" style={styles.fieldLabel}>Tier</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.md }}>
              {TIERS.map((t) => (
                <Chip
                  key={t}
                  selected={pkgTier === t}
                  onPress={() => setPkgTier(t)}
                  style={[styles.catChip, pkgTier === t && styles.catChipActive]}
                  textStyle={pkgTier === t ? styles.catChipTextActive : styles.catChipText}
                >
                  {catLabel(t)}
                </Chip>
              ))}
            </ScrollView>

            <TextInput
              label="Package Description *"
              value={pkgDescription}
              onChangeText={setPkgDescription}
              mode="outlined"
              multiline
              numberOfLines={3}
              placeholder="What's included in this package..."
              style={styles.input}
              outlineStyle={styles.outline}
            />

            <TextInput
              label="Base Price (₹) *"
              value={pkgBasePrice}
              onChangeText={setPkgBasePrice}
              mode="outlined"
              keyboardType="numeric"
              placeholder="e.g. 50000"
              left={<TextInput.Icon icon="currency-inr" />}
              style={styles.input}
              outlineStyle={styles.outline}
            />

            {/* Category-specific pricing */}
            {(CATEGORY_FIELDS[pkgCategory] || []).length > 0 && (
              <>
                <View style={styles.catPricingHeader}>
                  <Text style={styles.catPricingLabel}>{catLabel(pkgCategory)} specific pricing (all optional — fill what applies)</Text>
                </View>
                {(CATEGORY_FIELDS[pkgCategory] || []).map((f) => (
                  <TextInput
                    key={f.name}
                    label={f.label}
                    value={pkgCustomPricing[f.name] || ''}
                    onChangeText={(v) => setPkgCustomPricing((p) => ({ ...p, [f.name]: v }))}
                    mode="outlined"
                    keyboardType="numeric"
                    placeholder={f.placeholder || ''}
                    left={f.prefix ? <TextInput.Icon icon="currency-inr" /> : undefined}
                    style={styles.input}
                    outlineStyle={styles.outline}
                  />
                ))}
              </>
            )}

            {/* Custom Parameters */}
            <View style={styles.catPricingHeader}>
              <Text style={styles.catPricingLabel}>Custom Parameters (add your own pricing fields)</Text>
            </View>
            {pkgCustomParams.map((param, idx) => (
              <View key={idx} style={styles.customParamRow}>
                <TextInput
                  label="Parameter Name"
                  value={param.name}
                  onChangeText={(v) => {
                    const updated = [...pkgCustomParams];
                    updated[idx] = { ...updated[idx], name: v };
                    setPkgCustomParams(updated);
                  }}
                  mode="outlined"
                  dense
                  style={styles.customParamName}
                  outlineStyle={styles.outline}
                />
                <TextInput
                  label="Value"
                  value={param.value}
                  onChangeText={(v) => {
                    const updated = [...pkgCustomParams];
                    updated[idx] = { ...updated[idx], value: v };
                    setPkgCustomParams(updated);
                  }}
                  mode="outlined"
                  dense
                  keyboardType="numeric"
                  left={<TextInput.Icon icon="currency-inr" size={16} />}
                  style={styles.customParamValue}
                  outlineStyle={styles.outline}
                />
                <Button
                  compact
                  mode="text"
                  textColor={Colors.danger}
                  onPress={() => setPkgCustomParams((p) => p.filter((_, i) => i !== idx))}
                  style={{ marginTop: 6 }}
                >
                  ✕
                </Button>
              </View>
            ))}
            <View style={styles.addParamRow}>
              <TextInput
                label="New Parameter"
                value={newParamName}
                onChangeText={setNewParamName}
                mode="outlined"
                dense
                placeholder="e.g. cakeCharge"
                style={styles.customParamName}
                outlineStyle={styles.outline}
              />
              <TextInput
                label="Value"
                value={newParamValue}
                onChangeText={setNewParamValue}
                mode="outlined"
                dense
                keyboardType="numeric"
                placeholder="0"
                style={styles.customParamValue}
                outlineStyle={styles.outline}
              />
              <Button
                compact
                mode="contained-tonal"
                onPress={() => {
                  if (!newParamName.trim()) return;
                  setPkgCustomParams((p) => [...p, { name: newParamName.trim(), value: newParamValue || '0' }]);
                  setNewParamName('');
                  setNewParamValue('');
                }}
                style={{ marginTop: 6 }}
                disabled={!newParamName.trim()}
              >
                + Add
              </Button>
            </View>

            <TextInput
              label="Deliverables (comma-separated)"
              value={pkgDeliverables}
              onChangeText={setPkgDeliverables}
              mode="outlined"
              placeholder="e.g. 500 photos, 1 highlight reel, drone"
              style={styles.input}
              outlineStyle={styles.outline}
            />

            <View style={styles.modalActions}>
              <Button mode="contained" onPress={savePackage} loading={savingPackage} style={styles.modalSaveBtn}>
                {editingPackage ? 'Update Package' : 'Add Package'}
              </Button>
              <Button mode="text" onPress={() => setPkgModalVisible(false)}>Cancel</Button>
            </View>
          </ScrollView>
        </Modal>
      </Portal>

      {/* ===== TESTIMONIAL MODAL ===== */}
      <Portal>
        <Modal visible={rawMaterialModalVisible} onDismiss={() => setRawMaterialModalVisible(false)} contentContainerStyle={styles.modal}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text variant="titleLarge" style={styles.modalTitle}>
              {editingRawMaterial ? `Edit Item: ${editingRawMaterial.itemName}` : 'Add Raw Material Item'}
            </Text>
            <Text style={styles.modalSubtitle}>Add supply item details and tag it to multiple categories.</Text>

            <TextInput
              label="Item Name *"
              value={rmName}
              onChangeText={setRmName}
              mode="outlined"
              placeholder="e.g. Basmati Rice 25kg"
              style={styles.input}
              outlineStyle={styles.outline}
            />

            <TextInput
              label="Description"
              value={rmDescription}
              onChangeText={setRmDescription}
              mode="outlined"
              multiline
              numberOfLines={3}
              placeholder="Quality, unit size, notes..."
              style={styles.input}
              outlineStyle={styles.outline}
            />

            <TextInput
              label="Price (₹)"
              value={rmPrice}
              onChangeText={setRmPrice}
              mode="outlined"
              keyboardType="numeric"
              left={<TextInput.Icon icon="currency-inr" />}
              style={styles.input}
              outlineStyle={styles.outline}
            />

            <Text variant="labelLarge" style={styles.fieldLabel}>Tag Categories (multiple)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.md }}>
              {allCategories.map((c) => (
                <Chip
                  key={`rm-${c}`}
                  selected={rmCategories.includes(c)}
                  onPress={() => toggleRawMaterialCategory(c)}
                  style={[styles.catChip, rmCategories.includes(c) && styles.catChipActive]}
                  textStyle={rmCategories.includes(c) ? styles.catChipTextActive : styles.catChipText}
                >
                  {catLabel(c)}
                </Chip>
              ))}
            </ScrollView>

            <View style={styles.rawPhotoRow}>
              <Button mode="outlined" icon="image-plus" onPress={pickAndUploadRawMaterialPhoto} loading={uploadingRawMaterialPhoto}>
                {rmPhotoUrl ? 'Change Photo' : 'Upload Photo (optional)'}
              </Button>
              {rmPhotoUrl ? (
                <Button mode="text" icon="close" onPress={() => setRmPhotoUrl('')}>Clear</Button>
              ) : null}
            </View>
            {rmPhotoUrl ? <Image source={{ uri: rmPhotoUrl }} style={styles.rawPreviewPhoto} /> : null}

            <View style={styles.modalActions}>
              <Button mode="contained" onPress={saveRawMaterialItem} loading={savingRawMaterial} style={styles.modalSaveBtn}>
                {editingRawMaterial ? 'Update Item' : 'Add Item'}
              </Button>
              <Button mode="text" onPress={() => setRawMaterialModalVisible(false)}>Cancel</Button>
            </View>
          </ScrollView>
        </Modal>
      </Portal>

      {/* ===== TESTIMONIAL MODAL ===== */}
      <Portal>
        <Modal visible={testimonialModalVisible} onDismiss={() => setTestimonialModalVisible(false)} contentContainerStyle={styles.modal}>
          <Text variant="titleLarge" style={styles.modalTitle}>Add Testimonial</Text>

          <TextInput
            label="Client Name *"
            value={testClientName}
            onChangeText={setTestClientName}
            mode="outlined"
            left={<TextInput.Icon icon="account" />}
            style={styles.input}
            outlineStyle={styles.outline}
          />
          <TextInput
            label="Testimonial *"
            value={testContent}
            onChangeText={setTestContent}
            mode="outlined"
            multiline
            numberOfLines={3}
            style={styles.input}
            outlineStyle={styles.outline}
          />
          <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
            <TextInput
              label="Rating (1-5)"
              value={testRating}
              onChangeText={setTestRating}
              mode="outlined"
              keyboardType="numeric"
              style={[styles.input, { flex: 1 }]}
              outlineStyle={styles.outline}
            />
            <TextInput
              label="Source"
              value={testSource}
              onChangeText={setTestSource}
              mode="outlined"
              placeholder="e.g. Google"
              style={[styles.input, { flex: 1 }]}
              outlineStyle={styles.outline}
            />
          </View>

          <View style={styles.modalActions}>
            <Button mode="contained" onPress={saveTestimonial} loading={savingTestimonial} style={styles.modalSaveBtn}>
              Add Testimonial
            </Button>
            <Button mode="text" onPress={() => setTestimonialModalVisible(false)}>Cancel</Button>
          </View>
        </Modal>
      </Portal>
    </Portal.Host>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { padding: Spacing.lg, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xxl },

  // Hero
  heroCard: { marginBottom: Spacing.md, borderRadius: Radius.lg, elevation: 3, backgroundColor: Colors.surface },
  heroRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heroTitle: { fontWeight: '800', color: Colors.textPrimary },
  heroSubtitle: { marginTop: 4, color: Colors.textSecondary, fontSize: 13 },
  heroTags: { flexDirection: 'column', gap: 4, alignItems: 'flex-end' },

  // Add service button
  addServiceBtn: { borderRadius: Radius.sm, backgroundColor: Colors.primary, marginBottom: Spacing.sm },
  addServiceBtnLabel: { fontWeight: '700', fontSize: 15 },
  allCatText: { textAlign: 'center', color: Colors.textMuted, fontSize: 12, marginBottom: Spacing.md },

  // Empty
  emptyCard: { borderRadius: Radius.lg, elevation: 2, backgroundColor: Colors.surface, marginBottom: Spacing.md },

  // Service card
  serviceCard: { marginBottom: Spacing.lg, borderRadius: Radius.lg, elevation: 2, backgroundColor: Colors.surface },
  serviceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  serviceHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  serviceCatChip: { backgroundColor: Colors.primary + '18' },
  serviceCatText: { color: Colors.primary, fontWeight: '700', fontSize: 13 },
  servicePkgCount: { color: Colors.textMuted, fontSize: 12 },
  serviceActions: { flexDirection: 'row' },
  svcDescBox: { backgroundColor: '#f8f9fb', borderRadius: Radius.sm, padding: Spacing.md, marginBottom: Spacing.md },
  svcDescText: { color: '#444', lineHeight: 20, fontSize: 13 },
  noPkgText: { textAlign: 'center', color: Colors.textMuted, paddingVertical: Spacing.lg },

  // Package card
  pkgCard: { borderRadius: Radius.md, elevation: 1, backgroundColor: Colors.surfaceVariant, marginBottom: Spacing.sm },
  pkgHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pkgTitle: { fontWeight: '700', color: Colors.textPrimary, flex: 1, marginRight: Spacing.sm },
  pkgHeaderRight: { flexDirection: 'row', alignItems: 'center' },
  tierChip: { backgroundColor: Colors.primary + '18' },
  tierChipText: { fontSize: 10, color: Colors.primary, fontWeight: '600' },
  pkgDesc: { color: Colors.textSecondary, marginTop: 4, marginBottom: Spacing.sm, lineHeight: 18 },
  pkgPrice: { fontSize: 20, fontWeight: '800', color: Colors.primary, marginBottom: 4 },
  pricingTagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 4 },
  pricingTag: { backgroundColor: '#f0f5ff', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  pricingTagText: { fontSize: 11, color: '#4a6fa5' },
  deliverablesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  deliverableTag: { backgroundColor: '#f5f5f5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  deliverableText: { fontSize: 11, color: Colors.textSecondary },
  pkgFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.sm },
  pkgActions: { flexDirection: 'row' },

  // Add package button
  addPkgBtn: { marginTop: Spacing.md, borderRadius: Radius.sm, borderColor: Colors.primary, borderStyle: 'dashed' },

  // Raw material catalog
  rawItemCard: { borderRadius: Radius.md, elevation: 1, backgroundColor: Colors.surfaceVariant, marginBottom: Spacing.sm },
  rawItemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  rawItemPhoto: { width: 64, height: 64, borderRadius: Radius.sm, backgroundColor: '#ddd' },
  rawPhotoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  rawPreviewPhoto: { width: 120, height: 120, borderRadius: Radius.sm, marginBottom: Spacing.md, backgroundColor: '#ddd' },

  // Section title
  sectionTitle: { fontWeight: '700', color: Colors.textPrimary },

  // Modal
  modal: {
    backgroundColor: Colors.surface,
    margin: Spacing.lg,
    borderRadius: Radius.lg,
    padding: Spacing.xxl,
    maxHeight: '85%',
  },
  modalTitle: { fontWeight: '800', color: Colors.textPrimary, marginBottom: 4 },
  modalSubtitle: { color: Colors.textSecondary, marginBottom: Spacing.lg, fontSize: 13 },
  modalActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg, justifyContent: 'flex-start' },
  modalSaveBtn: { borderRadius: Radius.sm, backgroundColor: Colors.primary },

  // Fields
  fieldLabel: { color: Colors.textSecondary, marginBottom: Spacing.xs, fontWeight: '600' },
  input: { marginBottom: Spacing.md, backgroundColor: Colors.surface },
  outline: { borderRadius: Radius.sm },
  catChip: { marginRight: Spacing.sm, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  catChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  catChipText: { color: Colors.textSecondary, fontSize: 12 },
  catChipTextActive: { color: '#fff', fontSize: 12 },
  catPricingHeader: { backgroundColor: '#f0f5ff', padding: Spacing.md, borderRadius: Radius.sm, marginBottom: Spacing.md, marginTop: Spacing.sm },
  catPricingLabel: { fontWeight: '600', color: '#444', fontSize: 13 },
  customParamRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 6 },
  customParamName: { flex: 2, backgroundColor: '#fff' },
  customParamValue: { flex: 1, backgroundColor: '#fff' },
  addParamRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: Spacing.md },

  // Portfolio
  portfolioGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  portfolioItem: {
    width: (Dimensions.get('window').width - Spacing.lg * 2 - Spacing.md * 2 - Spacing.sm * 2) / 3,
    borderRadius: Radius.sm,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceVariant,
  },
  portfolioImage: { width: '100%', aspectRatio: 1, borderRadius: Radius.sm },
  portfolioVideoPlaceholder: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Radius.sm,
  },
  portfolioVideoIcon: { fontSize: 24 },
  portfolioVideoLabel: { color: '#fff', fontSize: 10, marginTop: 2 },
  portfolioCaption: { fontSize: 10, color: Colors.textMuted, paddingHorizontal: 4, paddingVertical: 2 },
});

export default VendorWorkspaceScreen;
