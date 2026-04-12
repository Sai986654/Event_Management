import React, { useContext, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Card, Chip, Text, TextInput } from 'react-native-paper';
import { AuthContext } from '../context/AuthContext';
import { vendorService } from '../services/vendorService';
import { packageService } from '../services/packageService';
import { getErrorMessage } from '../utils/helpers';
import { Colors, Spacing, Radius } from '../theme';

const categories = ['catering', 'decor', 'photography', 'videography', 'music', 'venue', 'florist', 'transportation', 'other'];

const VendorWorkspaceScreen = () => {
  const { user } = useContext(AuthContext);
  const [vendor, setVendor] = useState(null);
  const [statusMsg, setStatusMsg] = useState('');
  const [statusType, setStatusType] = useState('info');
  const [loading, setLoading] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPackage, setSavingPackage] = useState(false);
  const [form, setForm] = useState({ businessName: '', category: 'other', description: '' });
  const [pkg, setPkg] = useState({ title: '', category: 'other', description: '', basePrice: '', perGuest: '', perHour: '' });

  if (user?.role !== 'vendor' && user?.role !== 'admin') {
    return (
      <View style={styles.centered}>
        <Text variant="titleMedium" style={{ color: Colors.textPrimary }}>Access Restricted</Text>
        <Text style={{ color: Colors.textSecondary, marginTop: Spacing.sm }}>Only vendors can access the workspace.</Text>
      </View>
    );
  }

  const load = async () => {
    setLoading(true);
    try {
      const res = await vendorService.searchVendors({ limit: 100 });
      const mine = (res.vendors || []).find((v) => v.user?.id === user?.id);
      setVendor(mine || null);
      if (mine) {
        setForm({ businessName: mine.businessName || '', category: mine.category || 'other', description: mine.description || '' });
      }
    } catch (err) {
      setStatusMsg(getErrorMessage(err));
      setStatusType('error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const saveProfile = async () => {
    if (!form.businessName.trim() || !form.category.trim()) {
      setStatusMsg('Business name and category are required');
      setStatusType('error');
      return;
    }
    try {
      setSavingProfile(true);
      if (vendor) await vendorService.updateVendorProfile(vendor.id, form);
      else await vendorService.createVendorProfile(form);
      setStatusMsg('Profile saved');
      setStatusType('success');
      await load();
    } catch (err) {
      setStatusMsg(getErrorMessage(err));
      setStatusType('error');
    } finally {
      setSavingProfile(false);
    }
  };

  const addPackage = async () => {
    if (!pkg.title.trim() || !pkg.category.trim() || !pkg.description.trim()) {
      setStatusMsg('Title, category, and description are required');
      setStatusType('error');
      return;
    }
    try {
      setSavingPackage(true);
      await packageService.createPackage({
        ...pkg,
        basePrice: Number(pkg.basePrice || 0),
        estimationRules: { perGuest: Number(pkg.perGuest || 0), perHour: Number(pkg.perHour || 0) },
      });
      setPkg({ title: '', category: 'other', description: '', basePrice: '', perGuest: '', perHour: '' });
      setStatusMsg('Package added');
      setStatusType('success');
    } catch (err) {
      setStatusMsg(getErrorMessage(err));
      setStatusType('error');
    } finally {
      setSavingPackage(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <Card style={styles.heroCard}>
        <Card.Content>
          <Text variant="headlineSmall" style={styles.heroTitle}>Vendor Workspace</Text>
          <Text style={styles.heroSubtitle}>Craft premium packages and showcase your service quality.</Text>
        </Card.Content>
      </Card>

      {loading ? <ActivityIndicator style={{ marginBottom: Spacing.md }} color={Colors.primary} /> : null}

      {/* Status */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>Verification Status</Text>
          <View style={styles.chipRow}>
            <Chip compact>{vendor?.verificationStatus || 'not submitted'}</Chip>
            {vendor?.isVerified ? <Chip compact icon="check-circle" style={{ backgroundColor: Colors.success + '18' }}>Verified</Chip> : null}
          </View>
          {statusMsg ? <Text style={statusType === 'error' ? styles.msgError : styles.msgSuccess}>{statusMsg}</Text> : null}
        </Card.Content>
      </Card>

      {/* Profile Form */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>{vendor ? 'Update Profile' : 'Create Profile'}</Text>
          <TextInput label="Business Name" mode="outlined" value={form.businessName} onChangeText={(v) => setForm((p) => ({ ...p, businessName: v }))} style={styles.input} outlineStyle={styles.outline} />
          <Text variant="labelMedium" style={styles.fieldLabel}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
            {categories.map((c) => (
              <Chip key={c} selected={form.category === c} onPress={() => setForm((p) => ({ ...p, category: c }))} style={styles.chip} textStyle={{ textTransform: 'capitalize' }}>{c}</Chip>
            ))}
          </ScrollView>
          <TextInput label="Description" mode="outlined" value={form.description} onChangeText={(v) => setForm((p) => ({ ...p, description: v }))} multiline style={styles.input} outlineStyle={styles.outline} />
          <Button mode="contained" loading={savingProfile} disabled={savingProfile} onPress={saveProfile} style={styles.btn} labelStyle={{ fontWeight: '600' }}>Save Profile</Button>
        </Card.Content>
      </Card>

      {/* Package Form */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>Add Service Package</Text>
          <TextInput label="Title" mode="outlined" value={pkg.title} onChangeText={(v) => setPkg((p) => ({ ...p, title: v }))} style={styles.input} outlineStyle={styles.outline} />
          <Text variant="labelMedium" style={styles.fieldLabel}>Package Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
            {categories.map((c) => (
              <Chip key={c} selected={pkg.category === c} onPress={() => setPkg((p) => ({ ...p, category: c }))} style={styles.chip} textStyle={{ textTransform: 'capitalize' }}>{c}</Chip>
            ))}
          </ScrollView>
          <TextInput label="Description" mode="outlined" value={pkg.description} onChangeText={(v) => setPkg((p) => ({ ...p, description: v }))} multiline style={styles.input} outlineStyle={styles.outline} />
          <TextInput label="Base Price (₹)" mode="outlined" keyboardType="numeric" value={pkg.basePrice} onChangeText={(v) => setPkg((p) => ({ ...p, basePrice: v }))} style={styles.input} outlineStyle={styles.outline} />
          <TextInput label="Per Guest (₹)" mode="outlined" keyboardType="numeric" value={pkg.perGuest} onChangeText={(v) => setPkg((p) => ({ ...p, perGuest: v }))} style={styles.input} outlineStyle={styles.outline} />
          <TextInput label="Per Hour (₹)" mode="outlined" keyboardType="numeric" value={pkg.perHour} onChangeText={(v) => setPkg((p) => ({ ...p, perHour: v }))} style={styles.input} outlineStyle={styles.outline} />
          <Button mode="contained" loading={savingPackage} disabled={savingPackage} onPress={addPackage} style={styles.btn} labelStyle={{ fontWeight: '600' }}>Add Package</Button>
        </Card.Content>
      </Card>
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
  card: { marginBottom: Spacing.md, borderRadius: Radius.lg, elevation: 2, backgroundColor: Colors.surface },
  sectionTitle: { fontWeight: '700', marginBottom: Spacing.sm, color: Colors.textPrimary },
  fieldLabel: { marginTop: Spacing.sm, marginBottom: Spacing.xs, color: Colors.textSecondary, fontWeight: '600' },
  input: { marginTop: Spacing.sm },
  outline: { borderRadius: Radius.sm },
  chipRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  chipScroll: { marginTop: Spacing.xs, marginBottom: Spacing.sm },
  chip: { marginRight: Spacing.sm },
  btn: { marginTop: Spacing.md, backgroundColor: Colors.primary, borderRadius: Radius.sm },
  msgError: { color: Colors.danger, marginTop: Spacing.sm, fontSize: 13 },
  msgSuccess: { color: Colors.success, marginTop: Spacing.sm, fontSize: 13 },
});

export default VendorWorkspaceScreen;
