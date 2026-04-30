import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Chip, Divider, Text, TextInput } from 'react-native-paper';
import { inviteDesignService } from '../services/inviteDesignService';
import { eventService } from '../services/eventService';
import { getErrorMessage, getPaymentRequirement } from '../utils/helpers';
import { Colors, Radius, Spacing } from '../theme';
import { paymentService } from '../services/paymentService';

const InviteDesignStudioScreen = ({ route }) => {
  const { eventId } = route.params;

  const [event, setEvent] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [designs, setDesigns] = useState([]);
  const [selectedDesign, setSelectedDesign] = useState(null);
  const [exportsList, setExportsList] = useState([]);

  const [newDesignName, setNewDesignName] = useState('');
  const [selectedTemplateKey, setSelectedTemplateKey] = useState('');

  const [designName, setDesignName] = useState('');
  const [designStatus, setDesignStatus] = useState('draft');
  const [layoutText, setLayoutText] = useState('{}');
  const [sendVia, setSendVia] = useState('email');

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const loadDesign = async (designId) => {
    try {
      const [designRes, exportRes] = await Promise.all([
        inviteDesignService.getDesign(designId),
        inviteDesignService.listExports(designId),
      ]);
      const design = designRes.design;
      setSelectedDesign(design);
      setDesignName(design.name || '');
      setDesignStatus(design.status || 'draft');
      setLayoutText(JSON.stringify(design.jsonLayout || {}, null, 2));
      setExportsList(exportRes.exports || []);
    } catch (err) {
      Alert.alert('Error', getErrorMessage(err));
    }
  };

  const load = async () => {
    try {
      setLoading(true);
      const [eventRes, templateRes, designRes] = await Promise.all([
        eventService.getEventById(eventId),
        inviteDesignService.getTemplates(),
        inviteDesignService.listDesigns(eventId),
      ]);

      setEvent(eventRes.event || null);
      setTemplates(templateRes.templates || []);
      setDesigns(designRes.designs || []);

      const firstTemplate = (templateRes.templates || [])[0];
      if (firstTemplate) setSelectedTemplateKey(firstTemplate.key);

      if (designRes.designs?.length) {
        await loadDesign(designRes.designs[0].id);
      }
    } catch (err) {
      Alert.alert('Error', getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const createDesign = async () => {
    const name = newDesignName.trim();
    if (!name) {
      Alert.alert('Name required', 'Please enter a design name.');
      return;
    }

    setBusy(true);
    try {
      const res = await inviteDesignService.createDesign({
        eventId,
        name,
        category: event?.type || 'general',
        status: 'draft',
        language: 'en',
        jsonLayout: {
          templateKey: selectedTemplateKey || null,
          title: event?.title || '',
          venue: event?.venue || '',
          date: event?.date || null,
        },
      });

      setNewDesignName('');
      const listRes = await inviteDesignService.listDesigns(eventId);
      setDesigns(listRes.designs || []);
      await loadDesign(res.design.id);
      Alert.alert('Success', 'Design created.');
    } catch (err) {
      Alert.alert('Error', getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const saveDesign = async () => {
    if (!selectedDesign) {
      Alert.alert('Select design', 'Choose a design first.');
      return;
    }

    let parsedLayout = {};
    try {
      parsedLayout = JSON.parse(layoutText || '{}');
    } catch (_err) {
      Alert.alert('Invalid JSON', 'Layout JSON is not valid.');
      return;
    }

    setBusy(true);
    try {
      await inviteDesignService.updateDesign(selectedDesign.id, {
        name: designName || selectedDesign.name,
        status: designStatus,
        jsonLayout: parsedLayout,
      });
      const listRes = await inviteDesignService.listDesigns(eventId);
      setDesigns(listRes.designs || []);
      await loadDesign(selectedDesign.id);
      Alert.alert('Saved', 'Design updated.');
    } catch (err) {
      Alert.alert('Error', getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const duplicateDesign = async () => {
    if (!selectedDesign) {
      Alert.alert('Select design', 'Choose a design first.');
      return;
    }

    setBusy(true);
    try {
      const res = await inviteDesignService.duplicateDesign(selectedDesign.id, {
        name: `${selectedDesign.name} Copy`,
      });
      const listRes = await inviteDesignService.listDesigns(eventId);
      setDesigns(listRes.designs || []);
      await loadDesign(res.design.id);
      Alert.alert('Done', 'Design duplicated.');
    } catch (err) {
      Alert.alert('Error', getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const exportPdf = async (hasRetriedAfterPayment = false) => {
    if (!selectedDesign) {
      Alert.alert('Select design', 'Choose a design first.');
      return;
    }

    setBusy(true);
    try {
      await inviteDesignService.exportDesign(selectedDesign.id, { format: 'pdf' });
      const exportRes = await inviteDesignService.listExports(selectedDesign.id);
      setExportsList(exportRes.exports || []);
      Alert.alert('Exported', 'PDF export created.');
    } catch (err) {
      const paymentRequirement = getPaymentRequirement(err);
      if (paymentRequirement && !hasRetriedAfterPayment) {
        try {
          await paymentService.checkoutForRequirement(
            paymentRequirement,
            `Invite design #${paymentRequirement.entityId} export`
          );
          await exportPdf(true);
          return;
        } catch (paymentErr) {
          Alert.alert('Payment Error', getErrorMessage(paymentErr));
          return;
        }
      }
      Alert.alert('Error', getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const generateAndSend = async () => {
    if (!selectedDesign) {
      Alert.alert('Select design', 'Choose a design first.');
      return;
    }

    setBusy(true);
    try {
      const res = await inviteDesignService.generateAndSend(selectedDesign.id, {
        sendVia,
      });
      Alert.alert('Sent', `Generated ${res.generated || 0} and sent ${res.sent || 0} invites.`);
    } catch (err) {
      Alert.alert('Error', getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <Text>Loading Invite Studio...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 28 }}>
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.title}>Invite Design Studio</Text>
          <Text style={styles.subtitle}>{event?.title || `Event #${eventId}`}</Text>
          <Button mode="outlined" onPress={load} style={{ marginTop: 10 }}>
            Refresh
          </Button>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleSmall" style={styles.sectionTitle}>Create Design</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
            <View style={styles.rowWrap}>
              {templates.map((template) => (
                <Chip
                  key={template.key}
                  selected={selectedTemplateKey === template.key}
                  onPress={() => setSelectedTemplateKey(template.key)}
                  style={styles.chip}
                >
                  {template.name}
                </Chip>
              ))}
            </View>
          </ScrollView>
          <TextInput
            mode="outlined"
            label="Design Name"
            value={newDesignName}
            onChangeText={setNewDesignName}
            style={styles.input}
          />
          <Button mode="contained" onPress={createDesign} loading={busy} disabled={busy}>
            Create
          </Button>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleSmall" style={styles.sectionTitle}>Designs</Text>
          <View style={styles.rowWrap}>
            {designs.length ? designs.map((design) => (
              <Chip key={design.id} selected={selectedDesign?.id === design.id} onPress={() => loadDesign(design.id)} style={styles.chip}>
                {design.name}
              </Chip>
            )) : <Text style={styles.subtitle}>No designs yet.</Text>}
          </View>
        </Card.Content>
      </Card>

      {selectedDesign ? (
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleSmall" style={styles.sectionTitle}>Edit Design</Text>
            <TextInput mode="outlined" label="Name" value={designName} onChangeText={setDesignName} style={styles.input} />
            <View style={styles.rowWrap}>
              {['draft', 'published', 'archived'].map((status) => (
                <Chip key={status} selected={designStatus === status} onPress={() => setDesignStatus(status)} style={styles.chip}>
                  {status}
                </Chip>
              ))}
            </View>
            <TextInput
              mode="outlined"
              label="Layout JSON"
              value={layoutText}
              onChangeText={setLayoutText}
              multiline
              numberOfLines={10}
              style={styles.input}
            />

            <View style={styles.rowWrap}>
              <Button mode="contained" onPress={saveDesign} loading={busy} disabled={busy}>Save</Button>
              <Button mode="contained-tonal" onPress={duplicateDesign} loading={busy} disabled={busy}>Duplicate</Button>
              <Button mode="contained-tonal" onPress={exportPdf} loading={busy} disabled={busy}>Export PDF</Button>
            </View>

            <Divider style={{ marginVertical: 12 }} />

            <Text style={{ marginBottom: 8 }}>Send via</Text>
            <View style={styles.rowWrap}>
              {['email', 'whatsapp', 'both'].map((mode) => (
                <Chip key={mode} selected={sendVia === mode} onPress={() => setSendVia(mode)} style={styles.chip}>
                  {mode}
                </Chip>
              ))}
            </View>
            <Button mode="contained" onPress={generateAndSend} loading={busy} disabled={busy} style={{ marginTop: 8 }}>
              Generate + Send
            </Button>

            <Divider style={{ marginVertical: 12 }} />
            <Text variant="titleSmall" style={styles.sectionTitle}>Exports</Text>
            {exportsList.length ? exportsList.map((item) => (
              <Text key={item.id} style={{ marginBottom: 6 }}>
                {item.format.toUpperCase()}: {item.fileUrl}
              </Text>
            )) : <Text style={styles.subtitle}>No exports yet.</Text>}
          </Card.Content>
        </Card>
      ) : null}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.md },
  card: { borderRadius: Radius.lg, marginBottom: Spacing.md, backgroundColor: Colors.surface },
  title: { fontWeight: '800', color: Colors.textPrimary },
  subtitle: { color: Colors.textSecondary, marginTop: 4 },
  sectionTitle: { fontWeight: '700', marginBottom: 8, color: Colors.textPrimary },
  input: { marginBottom: 10, backgroundColor: Colors.surface },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  chip: { marginRight: 8, marginBottom: 8 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
});

export default InviteDesignStudioScreen;
