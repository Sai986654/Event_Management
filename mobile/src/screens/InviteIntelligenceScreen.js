import React, { useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Card, Chip, Text, TextInput, Snackbar } from 'react-native-paper';
import { AuthContext } from '../context/AuthContext';
import { eventService } from '../services/eventService';
import { notificationService } from '../services/notificationService';
import { aiService } from '../services/aiService';
import { getErrorMessage } from '../utils/helpers';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Spacing, Radius } from '../theme';

const CONTACT_INTEL_STORAGE_KEY = 'vedika360_contact_intelligence_v1';

const LIST_OWNER_OPTIONS = [
  { value: 'unspecified', label: 'Unspecified' },
  { value: 'groom', label: 'Groom' },
  { value: 'bride', label: 'Bride' },
  { value: 'groom_father', label: 'Groom father' },
  { value: 'groom_mother', label: 'Groom mother' },
  { value: 'bride_father', label: 'Bride father' },
  { value: 'bride_mother', label: 'Bride mother' },
  { value: 'other', label: 'Other' },
];

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

const parseContactsFromText = (value) =>
  String(value || '').split('\n').map((l) => l.trim()).filter(Boolean)
    .map((line) => { const [name, phone, relationLabel, email] = line.split(',').map((p) => p.trim()); return { name, phone, relationLabel, email }; })
    .filter((r) => r.name && (r.phone || r.email));

const InviteIntelligenceScreen = () => {
  const { user } = useContext(AuthContext);
  const allowed = user?.role === 'organizer' || user?.role === 'admin';

  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState('');
  const [contactsInput, setContactsInput] = useState('');
  const [csvPaste, setCsvPaste] = useState('');
  const [listOwnerContext, setListOwnerContext] = useState('unspecified');
  const [listOwnerNotes, setListOwnerNotes] = useState('');
  const [analyzed, setAnalyzed] = useState(null);
  const [targetGroup, setTargetGroup] = useState('all');
  const [reminderMessage, setReminderMessage] = useState('Namaste! Invitation reminder from Vedika 360. Please check your invite and RSVP.');
  const [collageStyle, setCollageStyle] = useState('traditional');
  const [collageStatus, setCollageStatus] = useState(null);

  const [loadingEvents, setLoadingEvents] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [sending, setSending] = useState(false);
  const [runningCollage, setRunningCollage] = useState(false);
  const [fetchingCollage, setFetchingCollage] = useState(false);
  const [generatingStrategy, setGeneratingStrategy] = useState(false);
  const [inviteStrategy, setInviteStrategy] = useState(null);
  const [snack, setSnack] = useState({ visible: false, text: '', type: 'info' });

  const showSnack = (text, type = 'info') => setSnack({ visible: true, text, type });

  const loadEvents = useCallback(async () => {
    setLoadingEvents(true);
    try { const data = await eventService.getEvents({ limit: 100 }); setEvents(data.events || []); }
    catch (err) { showSnack(getErrorMessage(err), 'error'); }
    finally { setLoadingEvents(false); }
  }, []);

  useEffect(() => { if (allowed) loadEvents(); }, [allowed, loadEvents]);

  const parsedContacts = useMemo(() => parseContactsFromText(contactsInput), [contactsInput]);

  const analyzeContacts = async () => {
    const hasCsv = Boolean(csvPaste.trim());
    if (!hasCsv && !parsedContacts.length) { showSnack('Paste Google CSV or add manual lines.', 'error'); return; }
    setAnalyzing(true);
    try {
      const res = hasCsv
        ? await notificationService.analyzeContacts({ csv: csvPaste, useOpenAi: true, listOwnerContext, listOwnerNotes })
        : await notificationService.analyzeContacts({ contacts: parsedContacts, useOpenAi: true, listOwnerContext, listOwnerNotes });
      setInviteStrategy(null); setAnalyzed(res);
      try {
        await AsyncStorage.setItem(CONTACT_INTEL_STORAGE_KEY, JSON.stringify({
          version: 1, savedAt: new Date().toISOString(), listOwnerContext, listOwnerNotes,
          contacts: res.contacts, summary: res.summary, aiUsed: res.aiUsed, aiOverview: res.aiOverview,
          openAiRefinedCount: res.openAiRefinedCount, openAiWarning: res.openAiWarning,
          openAiBatches: res.openAiBatches, importMeta: res.importMeta,
        }));
      } catch {}
      showSnack(res.openAiWarning || (res.importMeta ? `Imported ${res.importMeta.imported} from CSV.` : 'Contacts analyzed.'), res.openAiWarning ? 'error' : 'info');
    } catch (err) { showSnack(getErrorMessage(err), 'error'); }
    finally { setAnalyzing(false); }
  };

  const runInviteStrategy = async () => {
    const contacts = analyzed?.contacts || [];
    if (!contacts.length) { showSnack('Analyze contacts first.', 'error'); return; }
    setGeneratingStrategy(true); setInviteStrategy(null);
    try {
      const res = await notificationService.generateInviteStrategy({ contacts, listOwnerContext, listOwnerNotes });
      setInviteStrategy(res);
      showSnack(res.source === 'openai' || res.source === 'groq' ? 'AI strategy ready.' : 'Rules-only strategy ready.');
    } catch (err) { showSnack(getErrorMessage(err), 'error'); }
    finally { setGeneratingStrategy(false); }
  };

  const sendReminder = async () => {
    const eid = Number(eventId);
    if (!eid) { showSnack('Enter a valid event ID.', 'error'); return; }
    setSending(true);
    try {
      const res = await notificationService.sendWhatsAppReminders({ eventId: eid, group: targetGroup, message: reminderMessage, templateName: 'invitation_reminder' });
      showSnack(`Reminders sent: ${res.sentCount ?? 0}`);
    } catch (err) { showSnack(getErrorMessage(err), 'error'); }
    finally { setSending(false); }
  };

  const refreshCollageStatus = async () => {
    const eid = Number(eventId); if (!eid) return;
    setFetchingCollage(true);
    try { const res = await aiService.getEventCollageStatus(eid); setCollageStatus(res.job || null); showSnack(res.job ? 'Status loaded.' : 'No collage job yet.'); }
    catch (err) { showSnack(getErrorMessage(err), 'error'); }
    finally { setFetchingCollage(false); }
  };

  const runCollage = async () => {
    const eid = Number(eventId); if (!eid) { showSnack('Enter a valid event ID.', 'error'); return; }
    setRunningCollage(true);
    try { const res = await aiService.createEventCollage(eid, collageStyle); setCollageStatus(res.job || null); showSnack('AI collage generated.'); }
    catch (err) { showSnack(getErrorMessage(err), 'error'); }
    finally { setRunningCollage(false); }
  };

  if (!allowed) {
    return <View style={styles.centered}><Text variant="titleMedium">Invite Intelligence</Text><Text style={styles.muted}>Only organizers and admins can use this screen.</Text></View>;
  }

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        {/* Hero */}
        <Card style={styles.heroCard}>
          <Card.Content>
            <Text variant="headlineSmall" style={styles.heroTitle}>Invite Intelligence</Text>
            <Text style={styles.heroSubtitle}>Segment contacts, send WhatsApp reminders, and generate AI collages.</Text>
          </Card.Content>
        </Card>

        {/* Step 1: List Owner */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>1) Whose contact list?</Text>
            <Text style={styles.hint}>AI reads Telugu/English labels in the right family context.</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
              {LIST_OWNER_OPTIONS.map((o) => (
                <Chip key={o.value} selected={listOwnerContext === o.value} onPress={() => setListOwnerContext(o.value)} style={styles.chip}>{o.label}</Chip>
              ))}
            </ScrollView>
            <TextInput mode="outlined" multiline numberOfLines={2} value={listOwnerNotes} onChangeText={setListOwnerNotes} placeholder="Optional notes for the AI" style={styles.textAreaSmall} outlineStyle={styles.outline} />
          </Card.Content>
        </Card>

        {/* Step 2: Contacts */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>2) Google CSV or manual lines</Text>
            <Text style={styles.hint}>Export CSV from Google Contacts and paste below.</Text>
            <TextInput mode="outlined" multiline numberOfLines={5} value={csvPaste} onChangeText={setCsvPaste} placeholder="Paste full contacts.csv content…" style={styles.textArea} outlineStyle={styles.outline} />
            <Text style={styles.hint}>Manual (one per line: name, phone, relation, email)</Text>
            <TextInput mode="outlined" multiline numberOfLines={5} value={contactsInput} onChangeText={setContactsInput} placeholder="Amma, +9198..., Mother, a@x.com" style={styles.textArea} outlineStyle={styles.outline} />
            <Text style={styles.muted}>Manual parsed: {parsedContacts.length}</Text>
            <Text style={styles.hint}>Large lists use several AI batches — can take 1–3 minutes.</Text>
            <Button mode="contained" onPress={analyzeContacts} loading={analyzing} disabled={analyzing} style={styles.btn} labelStyle={{ fontWeight: '600' }}>Analyze Contact Graph</Button>
          </Card.Content>
        </Card>

        {/* Step 3: Segmentation Results */}
        {analyzed?.summary ? (
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.sectionTitle}>3) Segmentation</Text>
              {analyzed.aiOverview ? <Text style={styles.overview}>{analyzed.aiOverview}</Text> : null}
              {analyzed.openAiWarning ? <Text style={styles.warnText}>{analyzed.openAiWarning}</Text> : null}
              <View style={styles.chipRow}>
                <Chip compact>Total {analyzed.summary.total}</Chip>
                <Chip compact>Relatives {analyzed.summary.relatives}</Chip>
                <Chip compact>Friends {analyzed.summary.friends}</Chip>
                <Chip compact>Work {analyzed.summary.work ?? 0}</Chip>
                <Chip compact>WhatsApp {analyzed.summary.whatsAppEligible}</Chip>
                {analyzed.aiUsed ? <Chip compact>AI</Chip> : null}
              </View>
              {(analyzed.contacts || []).slice(0, 12).map((c, i) => (
                <Text key={`${c.name}-${i}`} style={styles.rowLine} numberOfLines={4}>
                  {c.name} · {c.relationTelugu || '—'} · {c.group} · {c.inferredRelation}
                </Text>
              ))}
              {(analyzed.contacts || []).length > 12 ? <Text style={styles.muted}>+{(analyzed.contacts || []).length - 12} more</Text> : null}

              <Text variant="titleSmall" style={styles.subsectionTitle}>AI Invite Strategy</Text>
              <Text style={styles.hint}>Generate practical send order, tone, and message variants using your segments.</Text>
              <Button mode="contained-tonal" onPress={runInviteStrategy} loading={generatingStrategy} disabled={generatingStrategy} style={styles.btn}>
                Generate strategy
              </Button>
              {inviteStrategy ? (
                <View style={styles.correlationBox}>
                  <Text variant="labelLarge" style={{ fontWeight: '700' }}>{inviteStrategy.source === 'groq' ? 'Groq' : inviteStrategy.source === 'openai' ? 'OpenAI' : 'Rules-only'}</Text>
                  <Text style={styles.overview}>{inviteStrategy.strategySummary}</Text>
                  {Array.isArray(inviteStrategy.priorities) && inviteStrategy.priorities.map((p, j) => (
                    <Text key={`pr-${j}`} style={styles.rowLine} numberOfLines={3}>{j + 1}. {p.group} · {p.reason}{p.recommendedWindow ? ` · ${p.recommendedWindow}` : ''}</Text>
                  ))}
                  {Array.isArray(inviteStrategy.messageVariants) && inviteStrategy.messageVariants.map((m, j) => (
                    <Text key={`mv-${j}`} style={styles.rowLine} numberOfLines={4}>{m.group}: {m.text}</Text>
                  ))}
                </View>
              ) : null}
            </Card.Content>
          </Card>
        ) : null}

        {/* Step 4: WhatsApp Reminder */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>4) Event & WhatsApp Reminder</Text>
            {loadingEvents ? <ActivityIndicator color={Colors.primary} /> : null}
            <Text style={styles.hint}>Pick event ID</Text>
            <TextInput mode="outlined" keyboardType="number-pad" value={eventId} onChangeText={setEventId} placeholder="Event ID e.g. 1" style={styles.input} outlineStyle={styles.outline} />
            {events.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                {events.slice(0, 15).map((e) => (
                  <Chip key={e.id} style={styles.chip} onPress={() => setEventId(String(e.id))}>#{e.id} {e.title?.slice(0, 18)}</Chip>
                ))}
              </ScrollView>
            ) : null}
            <Text style={styles.hint}>Audience</Text>
            <View style={styles.chipRow}>
              {GROUPS.map((g) => (<Chip key={g.value} selected={targetGroup === g.value} onPress={() => setTargetGroup(g.value)} style={styles.chip}>{g.label}</Chip>))}
            </View>
            <TextInput mode="outlined" multiline value={reminderMessage} onChangeText={setReminderMessage} style={styles.textAreaSmall} outlineStyle={styles.outline} />
            <Button mode="contained" onPress={sendReminder} loading={sending} disabled={!eventId} style={styles.btn} labelStyle={{ fontWeight: '600' }}>Send WhatsApp Reminder</Button>
          </Card.Content>
        </Card>

        {/* Step 5: AI Collage */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>5) AI Remote-Blessing Collage</Text>
            <Text style={styles.hint}>Uses blessing photos guests uploaded via the public page.</Text>
            <View style={styles.chipRow}>
              {STYLES.map((s) => (<Chip key={s.value} selected={collageStyle === s.value} onPress={() => setCollageStyle(s.value)} style={styles.chip}>{s.label}</Chip>))}
            </View>
            <View style={styles.rowBtns}>
              <Button mode="contained" onPress={runCollage} loading={runningCollage} disabled={!eventId} style={styles.halfBtn} labelStyle={{ fontWeight: '600' }}>Generate</Button>
              <Button mode="outlined" onPress={refreshCollageStatus} loading={fetchingCollage} disabled={!eventId} style={styles.halfBtn}>Status</Button>
            </View>
            {collageStatus ? (
              <View style={styles.statusBox}>
                <Text variant="labelLarge" style={{ fontWeight: '700' }}>Status: {collageStatus.status}</Text>
                {collageStatus.style ? <Text style={{ color: Colors.textSecondary }}>Style: {collageStatus.style}</Text> : null}
                {collageStatus.usedPhotos != null ? <Text style={{ color: Colors.textSecondary }}>Photos: {collageStatus.usedPhotos}</Text> : null}
                {collageStatus.resultUrl ? <Text selectable numberOfLines={2} style={styles.url}>{collageStatus.resultUrl}</Text> : null}
              </View>
            ) : <Text style={styles.muted}>No job loaded. Generate or refresh.</Text>}
          </Card.Content>
        </Card>

        <View style={{ height: 32 }} />
      </ScrollView>

      <Snackbar visible={snack.visible} onDismiss={() => setSnack((s) => ({ ...s, visible: false }))} duration={3000} style={snack.type === 'error' ? styles.snackError : undefined}>
        {snack.text}
      </Snackbar>
    </>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { padding: Spacing.lg, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xxl },
  heroCard: { marginBottom: Spacing.md, borderRadius: Radius.lg, backgroundColor: Colors.primary },
  heroTitle: { color: '#fff', fontWeight: '800' },
  heroSubtitle: { color: 'rgba(255,255,255,0.88)', marginTop: 6, lineHeight: 20 },
  card: { marginBottom: Spacing.md, borderRadius: Radius.lg, backgroundColor: Colors.surface, elevation: 2 },
  sectionTitle: { fontWeight: '700', marginBottom: Spacing.sm, color: Colors.textPrimary },
  subsectionTitle: { fontWeight: '600', marginTop: Spacing.md, marginBottom: 6, color: Colors.textPrimary },
  hint: { color: Colors.textSecondary, fontSize: 12, marginBottom: 6 },
  muted: { color: Colors.textMuted, fontSize: 12, marginVertical: 6 },
  input: { marginBottom: Spacing.sm },
  outline: { borderRadius: Radius.sm },
  textArea: { minHeight: 120, marginBottom: Spacing.sm },
  textAreaSmall: { minHeight: 72, marginBottom: Spacing.sm },
  chipScroll: { marginBottom: Spacing.sm },
  chip: { marginRight: Spacing.sm, marginBottom: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginVertical: Spacing.sm },
  btn: { marginTop: Spacing.sm, borderRadius: Radius.sm, backgroundColor: Colors.primary },
  halfBtn: { flex: 1, borderRadius: Radius.sm },
  rowBtns: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  overview: { fontSize: 13, color: Colors.textPrimary, marginBottom: Spacing.sm, lineHeight: 20 },
  warnText: { fontSize: 12, color: Colors.danger, marginBottom: Spacing.sm, lineHeight: 18 },
  rowLine: { fontSize: 13, color: Colors.textPrimary, marginBottom: 4 },
  correlationBox: { marginTop: Spacing.md, padding: Spacing.md, backgroundColor: '#f4f0ff', borderRadius: Radius.sm, borderWidth: 1, borderColor: '#e0d4ff' },
  statusBox: { marginTop: Spacing.md, padding: Spacing.md, backgroundColor: Colors.surfaceVariant, borderRadius: Radius.sm },
  url: { fontSize: 11, color: Colors.primary, marginTop: 4 },
  snackError: { backgroundColor: Colors.danger },
});

export default InviteIntelligenceScreen;
