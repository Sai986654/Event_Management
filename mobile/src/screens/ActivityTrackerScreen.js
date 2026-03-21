import React, { useContext, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { ActivityIndicator, Button, Card, Text, TextInput } from 'react-native-paper';
import { activityService } from '../services/activityService';
import { getErrorMessage } from '../utils/helpers';
import { AuthContext } from '../context/AuthContext';

const ActivityTrackerScreen = () => {
  const { user } = useContext(AuthContext);
  const [orderId, setOrderId] = useState('');
  const [activities, setActivities] = useState([]);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info');
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState(null);

  const load = async () => {
    if (!orderId) {
      setMessage('Order ID is required');
      setMessageType('error');
      return;
    }
    try {
      setLoading(true);
      const res = await activityService.getByOrder(Number(orderId));
      setActivities(res.activities || []);
      setMessage('');
    } catch (err) {
      setMessage(getErrorMessage(err));
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const updateActivity = async (activityId, progressPercent, spendActual) => {
    if (user?.role !== 'organizer' && user?.role !== 'admin') {
      setMessage('Only organizer/admin can update activity progress');
      return;
    }
    try {
      setSavingId(activityId);
      await activityService.updateProgress(activityId, { progressPercent: Number(progressPercent || 0), spendActual: Number(spendActual || 0) });
      await load();
      setMessage('Activity updated');
      setMessageType('success');
    } catch (err) {
      setMessage(getErrorMessage(err));
      setMessageType('error');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Card style={styles.heroCard}>
        <Card.Content>
          <Text variant="headlineSmall" style={styles.heroTitle}>Activity Tracker</Text>
          <Text style={styles.heroSubtitle}>Update delivery progress and real spend transparently.</Text>
        </Card.Content>
      </Card>
      {user?.role !== 'organizer' && user?.role !== 'admin' ? (
        <Text style={{ marginBottom: 10 }}>You are not allowed to access Activity Tracker.</Text>
      ) : null}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium">Activity Tracker</Text>
          <TextInput label="Order ID" mode="outlined" keyboardType="numeric" value={orderId} onChangeText={setOrderId} style={styles.input} />
          <Button mode="contained" loading={loading} disabled={loading} onPress={load}>Load Activities</Button>
        </Card.Content>
      </Card>
      {loading ? <ActivityIndicator style={{ marginBottom: 12 }} /> : null}

      {activities.map((a) => (
        <Card style={styles.card} key={a.id}>
          <Card.Content>
            <Text variant="titleMedium">{a.title}</Text>
            <Text>Status: {a.status}</Text>
            <Text>Progress: {a.progressPercent}%</Text>
            <TextInput
              label="New Progress %"
              mode="outlined"
              keyboardType="numeric"
              style={styles.input}
              onChangeText={(v) => setActivities((prev) => prev.map((x) => (x.id === a.id ? { ...x, _progressDraft: v } : x)))}
            />
            <TextInput
              label="Actual Spend"
              mode="outlined"
              keyboardType="numeric"
              style={styles.input}
              onChangeText={(v) => setActivities((prev) => prev.map((x) => (x.id === a.id ? { ...x, _spendDraft: v } : x)))}
            />
            <Button mode="contained" loading={savingId === a.id} onPress={() => updateActivity(a.id, a._progressDraft, a._spendDraft)}>Save Update</Button>
          </Card.Content>
        </Card>
      ))}
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
  input: { marginVertical: 8 },
  msgError: { color: '#c62828' },
  msgSuccess: { color: '#2e7d32' },
});

export default ActivityTrackerScreen;
