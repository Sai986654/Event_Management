import React, { useContext, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { ActivityIndicator, Button, Card, Text, TextInput } from 'react-native-paper';
import { activityService } from '../services/activityService';
import { getErrorMessage } from '../utils/helpers';
import { AuthContext } from '../context/AuthContext';
import { Colors, Spacing, Radius } from '../theme';

const ActivityTrackerScreen = () => {
  const { user } = useContext(AuthContext);
  const [orderId, setOrderId] = useState('');
  const [activities, setActivities] = useState([]);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info');
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState(null);

  const load = async () => {
    if (!orderId) { setMessage('Order ID is required'); setMessageType('error'); return; }
    try {
      setLoading(true);
      const res = await activityService.getByOrder(Number(orderId));
      setActivities(res.activities || []);
      setMessage('');
    } catch (err) {
      setMessage(getErrorMessage(err)); setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const updateActivity = async (activityId, progressPercent, spendActual) => {
    if (user?.role !== 'organizer' && user?.role !== 'admin') {
      setMessage('Only organizer/admin can update'); return;
    }
    try {
      setSavingId(activityId);
      await activityService.updateProgress(activityId, { progressPercent: Number(progressPercent || 0), spendActual: Number(spendActual || 0) });
      await load();
      setMessage('Activity updated'); setMessageType('success');
    } catch (err) {
      setMessage(getErrorMessage(err)); setMessageType('error');
    } finally {
      setSavingId(null);
    }
  };

  const isAllowed = user?.role === 'organizer' || user?.role === 'admin';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <Card style={styles.heroCard}>
        <Card.Content>
          <Text variant="headlineSmall" style={styles.heroTitle}>Activity Tracker</Text>
          <Text style={styles.heroSubtitle}>Update delivery progress and real spend transparently.</Text>
        </Card.Content>
      </Card>

      {!isAllowed ? (
        <Card style={styles.card}>
          <Card.Content>
            <Text style={{ color: Colors.textSecondary }}>Only organizers and admins can use Activity Tracker.</Text>
          </Card.Content>
        </Card>
      ) : null}

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>Load by Order</Text>
          <TextInput label="Order ID" mode="outlined" keyboardType="numeric" value={orderId} onChangeText={setOrderId} style={styles.input} outlineStyle={styles.outline} />
          <Button mode="contained" loading={loading} disabled={loading} onPress={load} style={styles.btn} labelStyle={{ fontWeight: '600' }}>Load Activities</Button>
        </Card.Content>
      </Card>

      {loading ? <ActivityIndicator style={{ marginBottom: Spacing.md }} color={Colors.primary} /> : null}

      {activities.map((a) => (
        <Card style={styles.card} key={a.id}>
          <Card.Content>
            <Text variant="titleMedium" style={{ fontWeight: '700', color: Colors.textPrimary }}>{a.title}</Text>
            <Text variant="bodySmall" style={{ color: Colors.textSecondary, marginTop: 4 }}>Status: {a.status} • Progress: {a.progressPercent}%</Text>
            <TextInput
              label="New Progress %"
              mode="outlined"
              keyboardType="numeric"
              style={styles.input}
              outlineStyle={styles.outline}
              onChangeText={(v) => setActivities((prev) => prev.map((x) => (x.id === a.id ? { ...x, _progressDraft: v } : x)))}
            />
            <TextInput
              label="Actual Spend (₹)"
              mode="outlined"
              keyboardType="numeric"
              style={styles.input}
              outlineStyle={styles.outline}
              onChangeText={(v) => setActivities((prev) => prev.map((x) => (x.id === a.id ? { ...x, _spendDraft: v } : x)))}
            />
            <Button mode="contained" loading={savingId === a.id} onPress={() => updateActivity(a.id, a._progressDraft, a._spendDraft)} style={styles.btn} labelStyle={{ fontWeight: '600' }}>Save Update</Button>
          </Card.Content>
        </Card>
      ))}

      {message ? <Text style={messageType === 'error' ? styles.msgError : styles.msgSuccess}>{message}</Text> : null}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { padding: Spacing.lg, paddingBottom: 40 },
  heroCard: { marginBottom: Spacing.md, borderRadius: Radius.lg, elevation: 3, backgroundColor: Colors.surface },
  heroTitle: { fontWeight: '800', color: Colors.textPrimary },
  heroSubtitle: { marginTop: 6, color: Colors.textSecondary },
  card: { marginBottom: Spacing.md, borderRadius: Radius.lg, elevation: 2, backgroundColor: Colors.surface },
  sectionTitle: { fontWeight: '700', marginBottom: Spacing.sm, color: Colors.textPrimary },
  input: { marginVertical: Spacing.xs },
  outline: { borderRadius: Radius.sm },
  btn: { marginTop: Spacing.sm, backgroundColor: Colors.primary, borderRadius: Radius.sm },
  msgError: { color: Colors.danger, marginTop: Spacing.sm, fontSize: 13 },
  msgSuccess: { color: Colors.success, marginTop: Spacing.sm, fontSize: 13 },
});

export default ActivityTrackerScreen;
