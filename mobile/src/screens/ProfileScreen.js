import React, { useContext, useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  Text, Card, Button, Avatar, Chip, Divider, TextInput, ActivityIndicator,
  SegmentedButtons,
} from 'react-native-paper';
import { AuthContext } from '../context/AuthContext';
import { authService } from '../services/authService';
import { vendorService } from '../services/vendorService';
import { adminService } from '../services/adminService';
import { getRoleColor, getErrorMessage } from '../utils/helpers';
import { Colors, Spacing, Radius } from '../theme';

const FALLBACK_CATEGORIES = ['catering', 'decor', 'photography', 'videography', 'music', 'venue', 'florist', 'transportation', 'other'];

const ProfileScreen = () => {
  const { user, setUser, logout } = useContext(AuthContext);
  const isVendor = user?.role === 'vendor';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState('account');

  // Account state
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [savingUser, setSavingUser] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [deletePassword, setDeletePassword] = useState('');

  // Vendor state
  const [vendor, setVendor] = useState(null);
  const [categories, setCategories] = useState(FALLBACK_CATEGORIES);
  const [savingVendor, setSavingVendor] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [category, setCategory] = useState('other');
  const [description, setDescription] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [facebook, setFacebook] = useState('');
  const [instagram, setInstagram] = useState('');
  const [twitter, setTwitter] = useState('');
  const [youtube, setYoutube] = useState('');

  const loadData = useCallback(async () => {
    try {
      // Load categories
      try {
        const catRes = await adminService.getCategories();
        const cats = (catRes.categories || []).map((c) => c.name);
        if (cats.length > 0) setCategories(cats);
      } catch (_) { /* fallback */ }

      // Load fresh profile
      const profileRes = await authService.getProfile();
      const u = profileRes.user || profileRes;
      if (setUser) setUser(u);
      setName(u.name || '');
      setPhone(u.phone || '');

      // Load vendor profile if vendor role
      if (isVendor) {
        const vendorsRes = await vendorService.searchVendors({ limit: 100 });
        const mine = (vendorsRes.vendors || []).find((v) => v.user?.id === user?.id);
        setVendor(mine || null);
        if (mine) {
          setBusinessName(mine.businessName || '');
          setCategory(mine.category || 'other');
          setDescription(mine.description || '');
          setCity(mine.city || '');
          setState(mine.state || '');
          setContactPhone(mine.contactPhone || '');
          setContactEmail(mine.contactEmail || '');
          setWebsite(mine.website || '');
          const links = mine.socialLinks || {};
          setFacebook(links.facebook || '');
          setInstagram(links.instagram || '');
          setTwitter(links.twitter || '');
          setYoutube(links.youtube || '');
        }
      }
    } catch (err) {
      Alert.alert('Error', getErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isVendor, user?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSaveAccount = async () => {
    if (!name.trim()) { Alert.alert('Error', 'Name is required'); return; }
    setSavingUser(true);
    try {
      const res = await authService.updateProfile({ name: name.trim(), phone: phone.trim() });
      if (res.user && setUser) setUser(res.user);
      Alert.alert('Success', 'Profile updated');
    } catch (err) {
      Alert.alert('Error', getErrorMessage(err));
    } finally {
      setSavingUser(false);
    }
  };

  const handleSaveVendor = async () => {
    if (!businessName.trim()) { Alert.alert('Error', 'Business name is required'); return; }
    setSavingVendor(true);
    try {
      const payload = {
        businessName: businessName.trim(),
        category,
        description: description.trim(),
        city: city.trim(),
        state: state.trim(),
        contactPhone: contactPhone.trim(),
        contactEmail: contactEmail.trim(),
        website: website.trim(),
        socialLinks: {
          ...(facebook ? { facebook } : {}),
          ...(instagram ? { instagram } : {}),
          ...(twitter ? { twitter } : {}),
          ...(youtube ? { youtube } : {}),
        },
      };
      if (vendor) {
        await vendorService.updateVendorProfile(vendor.id, payload);
        Alert.alert('Success', 'Business profile updated');
      } else {
        await vendorService.createVendorProfile(payload);
        Alert.alert('Success', 'Business profile created');
      }
      await loadData();
    } catch (err) {
      Alert.alert('Error', getErrorMessage(err));
    } finally {
      setSavingVendor(false);
    }
  };

  const handlePickAvatar = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow photo library access to update your profile picture.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.[0]) return;

      setUploadingAvatar(true);
      const response = await authService.uploadAvatar(result.assets[0]);
      if (response.user && setUser) setUser(response.user);
      Alert.alert('Success', 'Profile picture updated');
    } catch (err) {
      Alert.alert('Error', getErrorMessage(err));
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Validation', 'Fill in all password fields');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Validation', 'New password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Validation', 'New password and confirmation do not match');
      return;
    }

    setChangingPassword(true);
    try {
      await authService.changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Success', 'Password changed successfully');
    } catch (err) {
      Alert.alert('Error', getErrorMessage(err));
    } finally {
      setChangingPassword(false);
    }
  };

  const confirmDeleteAccount = () => {
    if (!deletePassword) {
      Alert.alert('Validation', 'Enter your current password to delete your account');
      return;
    }

    Alert.alert('Delete Account', 'This permanently removes your account if there are no active dependencies. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeletingAccount(true);
          try {
            await authService.deleteAccount({ currentPassword: deletePassword });
            setDeletePassword('');
            await logout();
          } catch (err) {
            Alert.alert('Error', getErrorMessage(err));
          } finally {
            setDeletingAccount(false);
          }
        },
      },
    ]);
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: () => logout() },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const statusColor = { approved: Colors.success, pending: Colors.warning, rejected: Colors.danger }[vendor?.verificationStatus] || Colors.textMuted;
  const statusLabel = vendor?.isVerified ? 'Verified' : (vendor?.verificationStatus || 'Not submitted');

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} colors={[Colors.primary]} />}
    >
      {/* Profile hero */}
      <Card style={styles.heroCard}>
        <Card.Content style={styles.heroContent}>
          {user?.avatar ? (
            <Avatar.Image size={76} source={{ uri: user.avatar }} />
          ) : (
            <Avatar.Text
              size={76}
              label={user?.name?.charAt(0)?.toUpperCase() || 'U'}
              style={{ backgroundColor: getRoleColor(user?.role) }}
              labelStyle={{ fontWeight: '800', fontSize: 30 }}
            />
          )}
          <Text variant="headlineSmall" style={styles.heroName}>{user?.name}</Text>
          <Text variant="bodyMedium" style={styles.heroEmail}>{user?.email}</Text>
          <Button mode="outlined" onPress={handlePickAvatar} loading={uploadingAvatar} icon="camera-outline" style={styles.avatarBtn}>
            Update Picture
          </Button>
          <View style={styles.heroTags}>
            <Chip compact style={[styles.roleChip, { backgroundColor: getRoleColor(user?.role) }]} textStyle={styles.roleChipText}>
              {user?.role?.charAt(0).toUpperCase() + user?.role?.slice(1)}
            </Chip>
            {isVendor && vendor && (
              <Chip compact style={[styles.statusChip, { backgroundColor: statusColor + '20' }]} textStyle={[styles.statusChipText, { color: statusColor }]}>
                {statusLabel}
              </Chip>
            )}
          </View>
        </Card.Content>
      </Card>

      {/* Tabs for vendor */}
      {isVendor && (
        <SegmentedButtons
          value={tab}
          onValueChange={setTab}
          buttons={[
            { value: 'account', label: 'Account', icon: 'account' },
            { value: 'business', label: 'Business', icon: 'store' },
            { value: 'social', label: 'Social', icon: 'share-variant' },
          ]}
          style={styles.tabs}
        />
      )}

      {/* Account Tab */}
      {(tab === 'account' || !isVendor) && (
        <Card style={styles.sectionCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>Account Details</Text>
            <Divider style={styles.divider} />

            <TextInput
              label="Email"
              value={user?.email || ''}
              disabled
              mode="outlined"
              left={<TextInput.Icon icon="email-outline" />}
              style={styles.input}
              outlineStyle={styles.inputOutline}
            />

            <TextInput
              label="Full Name"
              value={name}
              onChangeText={setName}
              mode="outlined"
              left={<TextInput.Icon icon="account-outline" />}
              style={styles.input}
              outlineStyle={styles.inputOutline}
            />

            <TextInput
              label="Phone"
              value={phone}
              onChangeText={setPhone}
              mode="outlined"
              keyboardType="phone-pad"
              left={<TextInput.Icon icon="phone-outline" />}
              placeholder="+91 9876543210"
              style={styles.input}
              outlineStyle={styles.inputOutline}
            />

            <Button
              mode="contained"
              onPress={handleSaveAccount}
              loading={savingUser}
              style={styles.saveBtn}
              icon="content-save"
            >
              Save Account
            </Button>

            <Divider style={styles.divider} />

            <Text variant="titleMedium" style={styles.sectionTitle}>Security</Text>

            <TextInput
              label="Current Password"
              value={currentPassword}
              onChangeText={setCurrentPassword}
              mode="outlined"
              secureTextEntry
              left={<TextInput.Icon icon="lock-outline" />}
              style={styles.input}
              outlineStyle={styles.inputOutline}
            />

            <TextInput
              label="New Password"
              value={newPassword}
              onChangeText={setNewPassword}
              mode="outlined"
              secureTextEntry
              left={<TextInput.Icon icon="lock-reset" />}
              style={styles.input}
              outlineStyle={styles.inputOutline}
            />

            <TextInput
              label="Confirm New Password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              mode="outlined"
              secureTextEntry
              left={<TextInput.Icon icon="shield-check-outline" />}
              style={styles.input}
              outlineStyle={styles.inputOutline}
            />

            <Button
              mode="outlined"
              onPress={handleChangePassword}
              loading={changingPassword}
              style={styles.secondaryBtn}
              icon="lock-reset"
            >
              Change Password
            </Button>

            <Divider style={styles.divider} />

            <Text variant="titleMedium" style={styles.sectionTitle}>Delete Account</Text>
            <Text style={styles.dangerText}>Enter your current password to permanently remove this account.</Text>

            <TextInput
              label="Password For Deletion"
              value={deletePassword}
              onChangeText={setDeletePassword}
              mode="outlined"
              secureTextEntry
              left={<TextInput.Icon icon="alert-circle-outline" />}
              style={styles.input}
              outlineStyle={styles.inputOutline}
            />

            <Button
              mode="contained-tonal"
              onPress={confirmDeleteAccount}
              loading={deletingAccount}
              buttonColor="#fee2e2"
              textColor={Colors.danger}
              icon="delete-outline"
            >
              Delete Account
            </Button>
          </Card.Content>
        </Card>
      )}

      {/* Business Tab - Vendor only */}
      {isVendor && tab === 'business' && (
        <Card style={styles.sectionCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              {vendor ? 'Business Profile' : 'Create Business Profile'}
            </Text>
            <Divider style={styles.divider} />

            {vendor?.verificationNotes ? (
              <View style={styles.adminNote}>
                <Text style={styles.adminNoteLabel}>Admin Notes:</Text>
                <Text style={styles.adminNoteText}>{vendor.verificationNotes}</Text>
              </View>
            ) : null}

            <TextInput
              label="Business Name *"
              value={businessName}
              onChangeText={setBusinessName}
              mode="outlined"
              left={<TextInput.Icon icon="store" />}
              style={styles.input}
              outlineStyle={styles.inputOutline}
            />

            {/* Category picker */}
            <Text variant="labelLarge" style={styles.fieldLabel}>Primary Category *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
              {categories.map((cat) => (
                <Chip
                  key={cat}
                  selected={category === cat}
                  onPress={() => setCategory(cat)}
                  style={[styles.catChip, category === cat && styles.catChipActive]}
                  textStyle={category === cat ? styles.catChipTextActive : styles.catChipText}
                >
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </Chip>
              ))}
            </ScrollView>

            <TextInput
              label="About Your Business"
              value={description}
              onChangeText={setDescription}
              mode="outlined"
              multiline
              numberOfLines={4}
              placeholder="Describe your services, experience, specialties..."
              style={styles.input}
              outlineStyle={styles.inputOutline}
            />

            <View style={styles.row}>
              <TextInput
                label="City"
                value={city}
                onChangeText={setCity}
                mode="outlined"
                style={[styles.input, styles.halfInput]}
                outlineStyle={styles.inputOutline}
              />
              <TextInput
                label="State"
                value={state}
                onChangeText={setState}
                mode="outlined"
                style={[styles.input, styles.halfInput]}
                outlineStyle={styles.inputOutline}
              />
            </View>

            <TextInput
              label="Business Phone"
              value={contactPhone}
              onChangeText={setContactPhone}
              mode="outlined"
              keyboardType="phone-pad"
              left={<TextInput.Icon icon="phone" />}
              style={styles.input}
              outlineStyle={styles.inputOutline}
            />

            <TextInput
              label="Business Email"
              value={contactEmail}
              onChangeText={setContactEmail}
              mode="outlined"
              keyboardType="email-address"
              autoCapitalize="none"
              left={<TextInput.Icon icon="email" />}
              style={styles.input}
              outlineStyle={styles.inputOutline}
            />

            <TextInput
              label="Website"
              value={website}
              onChangeText={setWebsite}
              mode="outlined"
              autoCapitalize="none"
              left={<TextInput.Icon icon="web" />}
              placeholder="https://..."
              style={styles.input}
              outlineStyle={styles.inputOutline}
            />

            <Button
              mode="contained"
              onPress={handleSaveVendor}
              loading={savingVendor}
              style={styles.saveBtn}
              icon="content-save"
            >
              {vendor ? 'Save Business Profile' : 'Create Business Profile'}
            </Button>
          </Card.Content>
        </Card>
      )}

      {/* Social Media Tab - Vendor only */}
      {isVendor && tab === 'social' && (
        <Card style={styles.sectionCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>Social Media Links</Text>
            <Divider style={styles.divider} />

            <TextInput
              label="Facebook"
              value={facebook}
              onChangeText={setFacebook}
              mode="outlined"
              autoCapitalize="none"
              left={<TextInput.Icon icon="facebook" color="#1877F2" />}
              placeholder="https://facebook.com/..."
              style={styles.input}
              outlineStyle={styles.inputOutline}
            />

            <TextInput
              label="Instagram"
              value={instagram}
              onChangeText={setInstagram}
              mode="outlined"
              autoCapitalize="none"
              left={<TextInput.Icon icon="instagram" color="#E4405F" />}
              placeholder="https://instagram.com/..."
              style={styles.input}
              outlineStyle={styles.inputOutline}
            />

            <TextInput
              label="Twitter / X"
              value={twitter}
              onChangeText={setTwitter}
              mode="outlined"
              autoCapitalize="none"
              left={<TextInput.Icon icon="twitter" color="#1DA1F2" />}
              placeholder="https://x.com/..."
              style={styles.input}
              outlineStyle={styles.inputOutline}
            />

            <TextInput
              label="YouTube"
              value={youtube}
              onChangeText={setYoutube}
              mode="outlined"
              autoCapitalize="none"
              left={<TextInput.Icon icon="youtube" color="#FF0000" />}
              placeholder="https://youtube.com/..."
              style={styles.input}
              outlineStyle={styles.inputOutline}
            />

            <Button
              mode="contained"
              onPress={handleSaveVendor}
              loading={savingVendor}
              style={styles.saveBtn}
              icon="content-save"
            >
              Save Social Links
            </Button>
          </Card.Content>
        </Card>
      )}

      {/* Logout */}
      <Button
        mode="contained"
        onPress={handleLogout}
        style={styles.logoutBtn}
        buttonColor={Colors.danger}
        icon="logout"
        contentStyle={{ paddingVertical: 6 }}
        labelStyle={{ fontWeight: '700', fontSize: 15 }}
      >
        Log Out
      </Button>

      <Text variant="bodySmall" style={styles.version}>Vedika 360 v1.0.0</Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { padding: Spacing.lg, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Hero
  heroCard: { borderRadius: Radius.lg, elevation: 3, marginBottom: Spacing.lg, backgroundColor: Colors.surface },
  heroContent: { alignItems: 'center', paddingVertical: Spacing.xxl },
  heroName: { fontWeight: '800', marginTop: Spacing.md, color: Colors.textPrimary },
  heroEmail: { color: Colors.textSecondary, marginTop: Spacing.xs },
  avatarBtn: { marginTop: Spacing.md, borderRadius: Radius.full },
  heroTags: { flexDirection: 'row', gap: 8, marginTop: Spacing.sm, flexWrap: 'wrap', justifyContent: 'center' },
  roleChip: { borderRadius: 12 },
  roleChipText: { color: '#fff', fontWeight: '600', fontSize: 12 },
  statusChip: { borderRadius: 12 },
  statusChipText: { fontWeight: '600', fontSize: 12 },

  // Tabs
  tabs: { marginBottom: Spacing.lg },

  // Section card
  sectionCard: { borderRadius: Radius.lg, elevation: 2, marginBottom: Spacing.lg, backgroundColor: Colors.surface },
  sectionTitle: { fontWeight: '700', color: Colors.textPrimary },
  divider: { marginVertical: Spacing.md },

  // Inputs
  input: { marginBottom: Spacing.md, backgroundColor: Colors.surface },
  inputOutline: { borderRadius: Radius.sm },
  fieldLabel: { color: Colors.textSecondary, marginBottom: Spacing.sm, marginTop: Spacing.xs },
  row: { flexDirection: 'row', gap: Spacing.sm },
  halfInput: { flex: 1 },

  // Category chips
  catScroll: { marginBottom: Spacing.md },
  catChip: { marginRight: Spacing.sm, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  catChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  catChipText: { color: Colors.textSecondary, fontSize: 12 },
  catChipTextActive: { color: '#fff', fontSize: 12 },

  // Admin note
  adminNote: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderRadius: Radius.sm,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  adminNoteLabel: { fontWeight: '700', color: '#9a3412', marginBottom: 4 },
  adminNoteText: { color: '#9a3412' },

  // Save button
  saveBtn: { borderRadius: Radius.sm, marginTop: Spacing.sm, backgroundColor: Colors.primary },
  secondaryBtn: { borderRadius: Radius.sm, marginTop: Spacing.sm },
  dangerText: { color: Colors.textSecondary, marginBottom: Spacing.md },

  // Logout
  logoutBtn: { borderRadius: Radius.sm, marginTop: Spacing.sm },
  version: { textAlign: 'center', color: Colors.textMuted, marginTop: Spacing.xl },
});

export default ProfileScreen;
