import React, { useContext, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Card, Chip, Text, TextInput } from 'react-native-paper';
import { vendorService } from '../services/vendorService';
import { adminService } from '../services/adminService';
import { getErrorMessage } from '../utils/helpers';
import { AuthContext } from '../context/AuthContext';

const AdminControlScreen = () => {
  const { user } = useContext(AuthContext);
  const [vendors, setVendors] = useState([]);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [verifyingId, setVerifyingId] = useState(null);
  const [userForm, setUserForm] = useState({ name: '', email: '', role: 'organizer', password: '' });
  const roles = ['admin', 'organizer', 'customer', 'vendor', 'guest'];

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

  useEffect(() => {
    load();
  }, []);

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

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Card style={styles.heroCard}>
        <Card.Content>
          <Text variant="headlineSmall" style={styles.heroTitle}>Admin Control</Text>
          <Text style={styles.heroSubtitle}>Moderate vendors and manage onboarding roles.</Text>
        </Card.Content>
      </Card>
      {user?.role !== 'admin' ? (
        <Text style={{ marginBottom: 10 }}>You are not allowed to access Admin Control.</Text>
      ) : null}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium">Admin Control</Text>
          {loading ? <ActivityIndicator style={{ marginVertical: 8 }} /> : null}
          {vendors.map((v) => (
            <Card key={v.id} style={styles.inner}>
              <Card.Content>
                <Text>{v.businessName} ({v.category})</Text>
                <Text>Status: {v.verificationStatus || 'pending'}</Text>
                <Button mode="contained" loading={verifyingId === v.id} onPress={() => verify(v.id, 'approved')} style={styles.btn}>Approve</Button>
                <Button mode="outlined" loading={verifyingId === v.id} onPress={() => verify(v.id, 'rejected')}>Reject</Button>
              </Card.Content>
            </Card>
          ))}
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium">Create User</Text>
          <TextInput label="Name" mode="outlined" value={userForm.name} onChangeText={(v) => setUserForm((p) => ({ ...p, name: v }))} style={styles.input} />
          <TextInput label="Email" mode="outlined" value={userForm.email} onChangeText={(v) => setUserForm((p) => ({ ...p, email: v }))} style={styles.input} />
          <Text style={{ marginTop: 8 }}>Role</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
            <View style={styles.row}>
              {roles.map((r) => (
                <Chip key={r} selected={userForm.role === r} onPress={() => setUserForm((p) => ({ ...p, role: r }))} style={styles.chip}>
                  {r}
                </Chip>
              ))}
            </View>
          </ScrollView>
          <TextInput label="Password" mode="outlined" value={userForm.password} onChangeText={(v) => setUserForm((p) => ({ ...p, password: v }))} style={styles.input} secureTextEntry />
          <Button mode="contained" loading={creating} disabled={creating} onPress={createUser}>Create User</Button>
        </Card.Content>
      </Card>
      {message ? <Text style={messageType === 'error' ? styles.msgError : styles.msgSuccess}>{message}</Text> : null}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f8fc' },
  heroCard: { marginBottom: 12, borderRadius: 16, elevation: 3, backgroundColor: '#ffffff' },
  heroTitle: { fontWeight: '800', color: '#1d2939' },
  heroSubtitle: { marginTop: 6, color: '#667085' },
  card: { marginBottom: 12, borderRadius: 14, elevation: 2, backgroundColor: '#fff' },
  inner: { marginTop: 8, borderRadius: 10, backgroundColor: '#fff' },
  input: { marginTop: 8 },
  btn: { marginTop: 8, marginBottom: 8 },
  row: { flexDirection: 'row' },
  chip: { marginRight: 8 },
  msgError: { color: '#c62828' },
  msgSuccess: { color: '#2e7d32' },
});

export default AdminControlScreen;
