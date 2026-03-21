import React, { useContext, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Card, Chip, Text, TextInput } from 'react-native-paper';
import { AuthContext } from '../context/AuthContext';
import { vendorService } from '../services/vendorService';
import { packageService } from '../services/packageService';
import { getErrorMessage } from '../utils/helpers';

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
  const categories = ['catering', 'decor', 'photography', 'videography', 'music', 'venue', 'florist', 'transportation', 'other'];

  if (user?.role !== 'vendor' && user?.role !== 'admin') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Text>You are not allowed to access Vendor Workspace.</Text>
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
        setForm({
          businessName: mine.businessName || '',
          category: mine.category || 'other',
          description: mine.description || '',
        });
      }
    } catch (err) {
      setStatusMsg(getErrorMessage(err));
      setStatusType('error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveProfile = async () => {
    if (!form.businessName.trim() || !form.category.trim()) {
      setStatusMsg('Business name and category are required');
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
      return;
    }
    try {
      setSavingPackage(true);
      await packageService.createPackage({
        ...pkg,
        basePrice: Number(pkg.basePrice || 0),
        estimationRules: {
          perGuest: Number(pkg.perGuest || 0),
          perHour: Number(pkg.perHour || 0),
        },
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
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Card style={styles.heroCard}>
        <Card.Content>
          <Text variant="headlineSmall" style={styles.heroTitle}>Vendor Workspace</Text>
          <Text style={styles.heroSubtitle}>Craft premium packages and showcase your service quality.</Text>
        </Card.Content>
      </Card>
      {loading ? <ActivityIndicator style={{ marginBottom: 12 }} /> : null}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium">Vendor Workspace</Text>
          <View style={styles.row}>
            <Chip>{vendor?.verificationStatus || 'not submitted'}</Chip>
            {vendor?.isVerified ? <Chip style={{ marginLeft: 8 }}>verified</Chip> : null}
          </View>
          {statusMsg ? <Text style={[styles.msg, statusType === 'error' ? styles.msgError : styles.msgSuccess]}>{statusMsg}</Text> : null}
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium">{vendor ? 'Update Profile' : 'Create Profile'}</Text>
          <TextInput label="Business Name" mode="outlined" value={form.businessName} onChangeText={(v) => setForm((p) => ({ ...p, businessName: v }))} style={styles.input} />
          <Text style={{ marginTop: 8 }}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            {categories.map((c) => (
              <Chip key={c} selected={form.category === c} onPress={() => setForm((p) => ({ ...p, category: c }))} style={styles.chip}>
                {c}
              </Chip>
            ))}
          </ScrollView>
          <TextInput label="Description" mode="outlined" value={form.description} onChangeText={(v) => setForm((p) => ({ ...p, description: v }))} style={styles.input} multiline />
          <Button mode="contained" loading={savingProfile} disabled={savingProfile} onPress={saveProfile}>Save Profile</Button>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium">Add Service Package</Text>
          <TextInput label="Title" mode="outlined" value={pkg.title} onChangeText={(v) => setPkg((p) => ({ ...p, title: v }))} style={styles.input} />
          <Text style={{ marginTop: 8 }}>Package Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            {categories.map((c) => (
              <Chip key={c} selected={pkg.category === c} onPress={() => setPkg((p) => ({ ...p, category: c }))} style={styles.chip}>
                {c}
              </Chip>
            ))}
          </ScrollView>
          <TextInput label="Description" mode="outlined" value={pkg.description} onChangeText={(v) => setPkg((p) => ({ ...p, description: v }))} style={styles.input} multiline />
          <TextInput label="Base Price" mode="outlined" keyboardType="numeric" value={pkg.basePrice} onChangeText={(v) => setPkg((p) => ({ ...p, basePrice: v }))} style={styles.input} />
          <TextInput label="Per Guest" mode="outlined" keyboardType="numeric" value={pkg.perGuest} onChangeText={(v) => setPkg((p) => ({ ...p, perGuest: v }))} style={styles.input} />
          <TextInput label="Per Hour" mode="outlined" keyboardType="numeric" value={pkg.perHour} onChangeText={(v) => setPkg((p) => ({ ...p, perHour: v }))} style={styles.input} />
          <Button mode="contained" loading={savingPackage} disabled={savingPackage} onPress={addPackage}>Add Package</Button>
        </Card.Content>
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f8fc' },
  heroCard: {
    marginBottom: 12,
    borderRadius: 16,
    elevation: 3,
    backgroundColor: '#ffffff',
  },
  heroTitle: { fontWeight: '800', color: '#1d2939' },
  heroSubtitle: { marginTop: 6, color: '#667085' },
  card: { marginBottom: 12, borderRadius: 14, elevation: 2, backgroundColor: '#fff' },
  input: { marginTop: 10 },
  row: { flexDirection: 'row', marginTop: 10 },
  msg: { marginTop: 10, color: '#333' },
  msgError: { color: '#c62828' },
  msgSuccess: { color: '#2e7d32' },
  chipRow: { marginTop: 8 },
  chip: { marginRight: 8 },
});

export default VendorWorkspaceScreen;
