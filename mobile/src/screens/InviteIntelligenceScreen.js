import React, { useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  Card,
  Chip,
  Text,
  TextInput,
  Snackbar,
} from 'react-native-paper';
import { AuthContext } from '../context/AuthContext';
import { eventService } from '../services/eventService';
import { notificationService } from '../services/notificationService';
import { aiService } from '../services/aiService';
import { getErrorMessage } from '../utils/helpers';

const parseContactsFromText = (value) =>
  String(value || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(',').map((p) => p.trim());
      const [name, phone, relationLabel, email] = parts;
      return { name, phone, relationLabel, email };
    })
    .filter((row) => row.name && (row.phone || row.email));

const GROUPS = [
  { value: 'all', label: 'All' },
  { value: 'relatives', label: 'Relatives' },
  { value: 'friends', label: 'Friends' },
  { value: 'work', label: 'Work' },
  { value: 'others', label: 'Others' },
];

const STYLES = [
  { value: 'traditional', label: 'Traditional' },
  { value: 'modern', label: 'Modern' },
  { value: 'cinematic', label: 'Cinematic' },
];

const InviteIntelligenceScreen = () => {
  const { user } = useContext(AuthContext);
  const allowed = user?.role === 'organizer' || user?.role === 'admin';

  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState('');
  const [contactsInput, setContactsInput] = useState('');
  const [csvPaste, setCsvPaste] = useState('');
  const [analyzed, setAnalyzed] = useState(null);
  const [targetGroup, setTargetGroup] = useState('all');
  const [reminderMessage, setReminderMessage] = useState(
    'Namaste! Invitation reminder from EventOS. Please check your invite and RSVP.'
  );
  const [collageStyle, setCollageStyle] = useState('traditional');
  const [collageStatus, setCollageStatus] = useState(null);

  const [loadingEvents, setLoadingEvents] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [sending, setSending] = useState(false);
  const [runningCollage, setRunningCollage] = useState(false);
  const [fetchingCollage, setFetchingCollage] = useState(false);

  const [snack, setSnack] = useState({ visible: false, text: '', type: 'info' });

  const showSnack = (text, type = 'info') => setSnack({ visible: true, text, type });

  const loadEvents = useCallback(async () => {
    setLoadingEvents(true);
    try {
      const data = await eventService.getEvents({ limit: 100 });
      setEvents(data.events || []);
    } catch (err) {
      showSnack(getErrorMessage(err), 'error');
    } finally {
      setLoadingEvents(false);
    }
  }, []);

  useEffect(() => {
    if (allowed) loadEvents();
  }, [allowed, loadEvents]);

  const parsedContacts = useMemo(() => parseContactsFromText(contactsInput), [contactsInput]);

  const analyzeContacts = async () => {
    const hasCsv = Boolean(csvPaste.trim());
    if (!hasCsv && !parsedContacts.length) {
      showSnack('Paste Google CSV or add manual lines (name, phone, relation, email).', 'error');
      return;
    }
    setAnalyzing(true);
    try {
      const res = hasCsv
        ? await notificationService.analyzeContacts({ csv: csvPaste, useOpenAi: true })
        : await notificationService.analyzeContacts({ contacts: parsedContacts, useOpenAi: true });
      setAnalyzed(res);
      showSnack(res.importMeta ? `Imported ${res.importMeta.imported} from CSV.` : 'Contacts analyzed.');
    } catch (err) {
      showSnack(getErrorMessage(err), 'error');
    } finally {
      setAnalyzing(false);
    }
  };

  const sendReminder = async () => {
    const eid = Number(eventId);
    if (!eid) {
      showSnack('Enter a valid event ID.', 'error');
      return;
    }
    setSending(true);
    try {
      const res = await notificationService.sendWhatsAppReminders({
        eventId: eid,
        group: targetGroup,
        message: reminderMessage,
        templateName: 'invitation_reminder',
      });
      showSnack(`Reminders sent: ${res.sentCount ?? 0}`);
    } catch (err) {
      showSnack(getErrorMessage(err), 'error');
    } finally {
      setSending(false);
    }
  };

  const refreshCollageStatus = async () => {
    const eid = Number(eventId);
    if (!eid) return;
    setFetchingCollage(true);
    try {
      const res = await aiService.getEventCollageStatus(eid);
      setCollageStatus(res.job || null);
      showSnack(res.job ? 'Status loaded.' : 'No collage job yet.');
    } catch (err) {
      showSnack(getErrorMessage(err), 'error');
    } finally {
      setFetchingCollage(false);
    }
  };

  const runCollage = async () => {
    const eid = Number(eventId);
    if (!eid) {
      showSnack('Enter a valid event ID.', 'error');
      return;
    }
    setRunningCollage(true);
    try {
      const res = await aiService.createEventCollage(eid, collageStyle);
      setCollageStatus(res.job || null);
      showSnack('AI collage generated and added to gallery.');
    } catch (err) {
      showSnack(getErrorMessage(err), 'error');
    } finally {
      setRunningCollage(false);
    }
  };

  if (!allowed) {
    return (
      <View style={styles.blocked}>
        <Text variant="titleMedium">Invite Intelligence</Text>
        <Text style={styles.muted}>Only organizers and admins can use this screen.</Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Card style={styles.heroCard}>
          <Card.Content>
            <Text variant="headlineSmall" style={styles.heroTitle}>
              Invite Intelligence
            </Text>
            <Text style={styles.heroSubtitle}>
              Segment contacts, send WhatsApp reminders, and generate remote-blessing collages.
            </Text>
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              1) Google CSV or manual lines
            </Text>
            <Text style={styles.hint}>Export CSV from Google Contacts and paste below, or enter manual lines.</Text>
            <TextInput
              mode="outlined"
              multiline
              numberOfLines={5}
              value={csvPaste}
              onChangeText={setCsvPaste}
              placeholder="Paste full contacts.csv content here…"
              style={styles.textArea}
            />
            <Text style={styles.hint}>Manual (one per line: name, phone, relation, email)</Text>
            <TextInput
              mode="outlined"
              multiline
              numberOfLines={5}
              value={contactsInput}
              onChangeText={setContactsInput}
              placeholder="Amma, +9198..., Mother, a@x.com"
              style={styles.textArea}
            />
            <Text style={styles.muted}>Manual parsed: {parsedContacts.length}</Text>
            <Button mode="contained" onPress={analyzeContacts} loading={analyzing} style={styles.btn}>
              Analyze contact graph
            </Button>
          </Card.Content>
        </Card>

        {analyzed?.summary ? (
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                2) Segmentation
              </Text>
              <View style={styles.chipRow}>
                <Chip compact>Total {analyzed.summary.total}</Chip>
                <Chip compact>Relatives {analyzed.summary.relatives}</Chip>
                <Chip compact>Friends {analyzed.summary.friends}</Chip>
                <Chip compact>Work {analyzed.summary.work ?? 0}</Chip>
                <Chip compact>WhatsApp {analyzed.summary.whatsAppEligible}</Chip>
              </View>
              {(analyzed.contacts || []).slice(0, 12).map((c, i) => (
                <Text key={`${c.name}-${i}`} style={styles.rowLine} numberOfLines={2}>
                  {c.name} · {c.group} · {c.inferredRelation}
                </Text>
              ))}
              {(analyzed.contacts || []).length > 12 ? (
                <Text style={styles.muted}>+{(analyzed.contacts || []).length - 12} more</Text>
              ) : null}
            </Card.Content>
          </Card>
        ) : null}

        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              3) Event & WhatsApp reminder
            </Text>
            {loadingEvents ? <ActivityIndicator /> : null}
            <Text style={styles.hint}>Pick event ID (from your events list)</Text>
            <TextInput
              mode="outlined"
              keyboardType="number-pad"
              value={eventId}
              onChangeText={setEventId}
              placeholder="Event ID e.g. 1"
              style={styles.input}
            />
            {events.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.eventChips}>
                {events.slice(0, 15).map((e) => (
                  <Chip key={e.id} style={styles.eventChip} onPress={() => setEventId(String(e.id))}>
                    #{e.id} {e.title?.slice(0, 18)}
                  </Chip>
                ))}
              </ScrollView>
            ) : null}
            <Text style={styles.hint}>Audience</Text>
            <View style={styles.chipRow}>
              {GROUPS.map((g) => (
                <Chip
                  key={g.value}
                  selected={targetGroup === g.value}
                  onPress={() => setTargetGroup(g.value)}
                  style={styles.filterChip}
                >
                  {g.label}
                </Chip>
              ))}
            </View>
            <TextInput
              mode="outlined"
              multiline
              value={reminderMessage}
              onChangeText={setReminderMessage}
              style={styles.textAreaSmall}
            />
            <Button mode="contained" onPress={sendReminder} loading={sending} disabled={!eventId}>
              Send WhatsApp reminder
            </Button>
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              4) AI remote-blessing collage
            </Text>
            <Text style={styles.hint}>Uses blessing photos guests uploaded (web public page).</Text>
            <View style={styles.chipRow}>
              {STYLES.map((s) => (
                <Chip
                  key={s.value}
                  selected={collageStyle === s.value}
                  onPress={() => setCollageStyle(s.value)}
                  style={styles.filterChip}
                >
                  {s.label}
                </Chip>
              ))}
            </View>
            <View style={styles.rowBtns}>
              <Button mode="contained" onPress={runCollage} loading={runningCollage} disabled={!eventId}>
                Generate collage
              </Button>
              <Button mode="outlined" onPress={refreshCollageStatus} loading={fetchingCollage} disabled={!eventId}>
                Status
              </Button>
            </View>
            {collageStatus ? (
              <View style={styles.statusBox}>
                <Text variant="labelLarge">Status: {collageStatus.status}</Text>
                {collageStatus.style ? <Text>Style: {collageStatus.style}</Text> : null}
                {collageStatus.usedPhotos != null ? <Text>Photos: {collageStatus.usedPhotos}</Text> : null}
                {collageStatus.resultUrl ? (
                  <Text selectable numberOfLines={2} style={styles.url}>
                    {collageStatus.resultUrl}
                  </Text>
                ) : null}
              </View>
            ) : (
              <Text style={styles.muted}>No job loaded. Generate or refresh.</Text>
            )}
          </Card.Content>
        </Card>

        <View style={{ height: 32 }} />
      </ScrollView>

      <Snackbar
        visible={snack.visible}
        onDismiss={() => setSnack((s) => ({ ...s, visible: false }))}
        duration={3000}
        style={snack.type === 'error' ? styles.snackError : undefined}
      >
        {snack.text}
      </Snackbar>
    </>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f8fc' },
  content: { padding: 16, paddingBottom: 40 },
  blocked: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  heroCard: {
    marginBottom: 12,
    borderRadius: 16,
    backgroundColor: '#667eea',
  },
  heroTitle: { color: '#fff', fontWeight: '800' },
  heroSubtitle: { color: 'rgba(255,255,255,0.9)', marginTop: 6 },
  card: { marginBottom: 12, borderRadius: 14, backgroundColor: '#fff' },
  sectionTitle: { fontWeight: '700', marginBottom: 8 },
  hint: { color: '#667085', fontSize: 12, marginBottom: 6 },
  muted: { color: '#98a2b3', fontSize: 12, marginVertical: 6 },
  textArea: { minHeight: 120, marginBottom: 8 },
  textAreaSmall: { minHeight: 72, marginBottom: 8 },
  input: { marginBottom: 8 },
  btn: { marginTop: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 8 },
  filterChip: { marginRight: 4, marginBottom: 4 },
  eventChips: { maxHeight: 44, marginBottom: 8 },
  eventChip: { marginRight: 6 },
  rowBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  rowLine: { fontSize: 13, color: '#344054', marginBottom: 4 },
  statusBox: { marginTop: 12, padding: 10, backgroundColor: '#f8f9fc', borderRadius: 8 },
  url: { fontSize: 11, color: '#667eea', marginTop: 4 },
  snackError: { backgroundColor: '#c0392b' },
});

export default InviteIntelligenceScreen;
