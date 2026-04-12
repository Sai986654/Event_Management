import React, { useContext, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Card, Chip, Text, TextInput } from 'react-native-paper';
import { vendorService } from '../services/vendorService';
import { adminService } from '../services/adminService';
import { getErrorMessage } from '../utils/helpers';
import { AuthContext } from '../context/AuthContext';
import { Colors, Spacing, Radius } from '../theme';

const roles = ['admin', 'organizer', 'customer', 'vendor', 'guest'];

const AdminControlScreen = () => {
  const { user } = useContext(AuthContext);
  const [vendors, setVendors] = useState([]);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [verifyingId, setVerifyingId] = useState(null);
  const [userForm, setUserForm] = useState({ name: '', email: '', role: 'organizer', password: '' });

  const load = async () => {
    setLoading(true);
    try {
      const res = await vendorService.searchVendors({ limit: 100 });
      setVendors(res.vendors || []);
    } catch (err) {
      setMessage(getErrorMessage(err));
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const verify = async (vendorId, status) => {
    setVerifyingId(vendorId);
    try {
      await adminService.verifyVendor(vendorId, status);
      setMessage(`Vendor ${status}`);
      setMessageType('success');
      await load();
    } catch (err) {
      setMessage(getErrorMessage(err));
      setMessageType('error');
    } finally {
      setVerifyingId(null);
    }
  };

  const createUser = async () => {
    if (!userForm.name.trim() || !userForm.email.trim() || !userForm.role.trim()) {
      setMessage('Name, email, and role are required');
      setMessageType('error');
      return;
    }
    try {
      setCreating(true);
      await adminService.createUser(userForm);
      setMessage('User created');
      setMessageType('success');
      setUserForm({ name: '', email: '', role: 'organizer', password: '' });
    } catch (err) {
      setMessage(getErrorMessage(err));
      setMessageType('error');
    } finally {
      setCreating(false);
    }
  };

  if (user?.role !== 'admin') {
    return (
      <View style={styles.centered}>
        <Text variant="titleMedium" style={{ color: Colors.textPrimary }}>Admin Only</Text>
        <Text style={{ color: Colors.textSecondary, marginTop: Spacing.sm }}>You are not authorized to access this page.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <Card style={styles.heroCard}>
        <Card.Content>
          <Text variant="headlineSmall" style={styles.heroTitle}>Admin Control</Text>
          <Text style={styles.heroSubtitle}>Moderate vendors and manage user onboarding.</Text>
        </Card.Content>
      </Card>

      {/* Vendor Verification */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>Vendor Verification</Text>
          {loading ? <ActivityIndicator style={{ marginVertical: Spacing.sm }} color={Colors.primary} /> : null}
          {vendors.length === 0 && !loading ? <Text style={{ color: Colors.textMuted }}>No vendors found.</Text> : null}
          {vendors.map((v) => (
            <Card key={v.id} style={styles.vendorCard}>
              <Card.Content>
                <View style={styles.vendorRow}>
                  <View style={{ flex: 1 }}>
                    <Text variant="titleSmall" style={{ fontWeight: '700' }}>{v.businessName}</Text>
                    <Text variant="bodySmall" style={{ color: Colors.textSecondary }}>{v.category} • {v.verificationStatus || 'pending'}</Text>
                  </View>
                  <View style={styles.vendorActions}>
                    <Button compact mode="contained" loading={verifyingId === v.id} onPress={() => verify(v.id, 'approved')} style={styles.approveBtn} labelStyle={{ fontWeight: '600', fontSize: 12 }}>Approve</Button>
                    <Button compact mode="outlined" loading={verifyingId === v.id} onPress={() => verify(v.id, 'rejected')} textColor={Colors.danger} style={styles.rejectBtn}>Reject</Button>
                  </View>
                </View>
              </Card.Content>
            </Card>
          ))}
        </Card.Content>
      </Card>

      {/* Create User */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>Create User</Text>
          <TextInput label="Name" mode="outlined" value={userForm.name} onChangeText={(v) => setUserForm((p) => ({ ...p, name: v }))} style={styles.input} outlineStyle={styles.outline} />
          <TextInput label="Email" mode="outlined" value={userForm.email} onChangeText={(v) => setUserForm((p) => ({ ...p, email: v }))} keyboardType="email-address" autoCapitalize="none" style={styles.input} outlineStyle={styles.outline} />
          <Text variant="labelMedium" style={styles.fieldLabel}>Role</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.sm }}>
            {roles.map((r) => (
              <Chip key={r} selected={userForm.role === r} onPress={() => setUserForm((p) => ({ ...p, role: r }))} style={styles.chip} textStyle={{ textTransform: 'capitalize' }}>{r}</Chip>
            ))}
          </ScrollView>
          <TextInput label="Password" mode="outlined" value={userForm.password} onChangeText={(v) => setUserForm((p) => ({ ...p, password: v }))} secureTextEntry style={styles.input} outlineStyle={styles.outline} />
          <Button mode="contained" loading={creating} disabled={creating} onPress={createUser} style={styles.btn} labelStyle={{ fontWeight: '600' }}>Create User</Button>
        </Card.Content>
      </Card>

      {message ? <Text style={messageType === 'error' ? styles.msgError : styles.msgSuccess}>{message}</Text> : null}
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
  sectionTitle: { fontWeight: '700', marginBottom: Spacing.md, color: Colors.textPrimary },
  fieldLabel: { marginTop: Spacing.sm, marginBottom: Spacing.xs, color: Colors.textSecondary, fontWeight: '600' },
  vendorCard: { marginBottom: Spacing.sm, borderRadius: Radius.sm, elevation: 1, backgroundColor: Colors.background },
  vendorRow: { flexDirection: 'row', alignItems: 'center' },
  vendorActions: { flexDirection: 'row', gap: Spacing.xs },
  approveBtn: { backgroundColor: Colors.success, borderRadius: Radius.sm },
  rejectBtn: { borderColor: Colors.danger, borderRadius: Radius.sm },
  input: { marginBottom: Spacing.md },
  outline: { borderRadius: Radius.sm },
  chip: { marginRight: Spacing.sm },
  btn: { marginTop: Spacing.sm, backgroundColor: Colors.primary, borderRadius: Radius.sm },
  msgError: { color: Colors.danger, marginTop: Spacing.sm, fontSize: 13 },
  msgSuccess: { color: Colors.success, marginTop: Spacing.sm, fontSize: 13 },
});

export default AdminControlScreen;
