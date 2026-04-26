import React, { useContext, useEffect, useState, useCallback } from 'react';
import { ScrollView, StyleSheet, View, Alert, RefreshControl } from 'react-native';
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
  const [placesSyncForm, setPlacesSyncForm] = useState({ query: '', city: '', state: '', lat: '', lng: '', limit: '50', radiusMeters: '15000', type: '', forceCategory: '', defaultPassword: '' });
  const [lastSyncResult, setLastSyncResult] = useState(null);

  // ── Create User ─────────────────────────────────────────────────
  const [creating, setCreating] = useState(false);
  const [userForm, setUserForm] = useState({ name: '', email: '', role: 'organizer', password: '', phone: '', businessName: '' });
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info');

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

  const loadAll = useCallback(async () => {
    await Promise.all([loadVerificationQueue(), loadCategories(), loadAllVendors()]);
    setRefreshing(false);
  }, [loadVerificationQueue, loadCategories, loadAllVendors]);

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
          <Text style={styles.heroSubtitle}>Manage categories, vendors, verification, and users.</Text>
        </Card.Content>
      </Card>

      {/* Tab Switcher */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll}>
        {[
          { value: 'categories', label: 'Categories' },
          { value: 'vendors', label: 'Vendors' },
          { value: 'verification', label: 'Verification' },
          { value: 'onboarding', label: 'Onboarding' },
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
          {activeTab === 'vendors' && renderVendorManagement()}
          {activeTab === 'verification' && renderVerificationQueue()}
          {activeTab === 'onboarding' && renderOnboarding()}
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
  msgError: { color: Colors.danger, marginTop: Spacing.sm, fontSize: 13 },
  msgSuccess: { color: Colors.success, marginTop: Spacing.sm, fontSize: 13 },
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
