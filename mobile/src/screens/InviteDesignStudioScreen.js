import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, View, Linking, Share } from 'react-native';
import { Button, Card, Chip, Divider, Text, TextInput } from 'react-native-paper';
import { inviteDesignService } from '../services/inviteDesignService';
import { eventService } from '../services/eventService';
import { getErrorMessage } from '../utils/helpers';
import { Colors, Radius, Spacing } from '../theme';
import { runWithPaymentRetry } from '../utils/paymentRetry';
import InviteDesignCanvas from '../components/InviteDesignCanvas';
import {
  OCCASION_PACKS,
  applyOccasionPackToLayout,
  autoBeautifyLayout,
  buildInviteStarterLayout,
} from '../utils/inviteTemplatePresets';

const TOKEN_LABELS = {
  'guest.name': 'Guest Name',
  'guest.relationship': 'Guest Relationship',
  'guest.invitationMessage': 'Guest Invitation Message',
  'event.title': 'Event Title',
  'event.brideName': 'Bride Name',
  'event.groomName': 'Groom Name',
  'event.dateText': 'Event Date',
  'event.timeText': 'Event Time',
  'event.venue': 'Venue',
  'event.city': 'City',
  'hosts.blessingLine': 'Blessing Line',
};

const normalizeToken = (token) => String(token || '').replace(/^\{\{\s*|\s*\}\}$/g, '').trim();

const extractTemplateTokens = (value) => {
  const tokenSet = new Set();

  const walk = (node) => {
    if (typeof node === 'string') {
      const matches = node.match(/\{\{\s*[\w.]+\s*\}\}/g) || [];
      matches.forEach((match) => tokenSet.add(normalizeToken(match)));
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (node && typeof node === 'object') {
      Object.values(node).forEach(walk);
    }
  };

  walk(value);
  return Array.from(tokenSet);
};

const getValueByPath = (source, path) => String(path || '')
  .split('.')
  .filter(Boolean)
  .reduce((acc, segment) => (acc && acc[segment] !== undefined ? acc[segment] : undefined), source);

const setValueByPath = (source, path, value) => {
  const segments = String(path || '').split('.').filter(Boolean);
  if (!segments.length) return source;
  const next = { ...(source || {}) };
  let cursor = next;
  for (let i = 0; i < segments.length - 1; i += 1) {
    const key = segments[i];
    cursor[key] = cursor[key] && typeof cursor[key] === 'object' && !Array.isArray(cursor[key]) ? { ...cursor[key] } : {};
    cursor = cursor[key];
  }
  cursor[segments[segments.length - 1]] = value;
  return next;
};

const InviteDesignStudioScreen = ({ route }) => {
  const { eventId } = route.params;

  const [event, setEvent] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [designs, setDesigns] = useState([]);
  const [selectedDesign, setSelectedDesign] = useState(null);
  const [exportsList, setExportsList] = useState([]);

  const [newDesignName, setNewDesignName] = useState('');
  const [selectedTemplateKey, setSelectedTemplateKey] = useState('');
  const [createMode, setCreateMode] = useState('template');
  const [selectedOccasionPack, setSelectedOccasionPack] = useState('wedding-royal');

  const [designName, setDesignName] = useState('');
  const [designStatus, setDesignStatus] = useState('draft');
  const [layoutText, setLayoutText] = useState('{}');
  const [canvasLayout, setCanvasLayout] = useState({});
  const [placeholderDraft, setPlaceholderDraft] = useState({ hosts: {}, custom: {}, event: {}, guest: {} });
  const [activePlaceholderToken, setActivePlaceholderToken] = useState('');
  const [editorMode, setEditorMode] = useState('canvas');
  const [sendVia, setSendVia] = useState('email');
  const [canvasFullScreenVisible, setCanvasFullScreenVisible] = useState(false);
  const [canvasDragging, setCanvasDragging] = useState(false);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const selectedLayoutTokens = useMemo(() => extractTemplateTokens(canvasLayout), [canvasLayout]);
  const placeholderOptions = useMemo(() => {
    const tokens = Array.from(new Set(selectedLayoutTokens.filter(Boolean)));
    return tokens.map((token) => ({
      token,
      label: TOKEN_LABELS[token] || token,
    }));
  }, [selectedLayoutTokens]);
  const activePlaceholderPath = useMemo(() => normalizeToken(activePlaceholderToken), [activePlaceholderToken]);
  const activePlaceholderEditTarget = useMemo(() => {
    if (!activePlaceholderPath) return null;
    const [scope, ...rest] = activePlaceholderPath.split('.');
    if (!['event', 'guest', 'hosts', 'custom'].includes(scope)) return null;
    if (!rest.length) return null;
    if (scope === 'guest' && rest.join('.') !== 'invitationMessage') return null;
    return { scope, key: rest.join('.') };
  }, [activePlaceholderPath]);
  const activePlaceholderValue = useMemo(() => {
    if (!activePlaceholderPath) return '';
    const value = getValueByPath(placeholderDraft, activePlaceholderPath);
    return value === undefined || value === null ? '' : String(value);
  }, [activePlaceholderPath, placeholderDraft]);

  useEffect(() => {
    if (!activePlaceholderToken && placeholderOptions.length) {
      setActivePlaceholderToken(placeholderOptions[0].token);
    }
  }, [activePlaceholderToken, placeholderOptions]);

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
      setCanvasLayout(design.jsonLayout || {});
      setPlaceholderDraft(design.jsonLayout?.mergeData || { hosts: {}, custom: {}, event: {}, guest: {} });
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
      const starterLayout = buildInviteStarterLayout({
        templateKey: selectedTemplateKey,
        event,
        mode: createMode,
      });

      const res = await inviteDesignService.createDesign({
        eventId,
        name,
        category: event?.type || 'general',
        status: 'draft',
        language: 'en',
        jsonLayout: { ...starterLayout, mergeData: { hosts: {}, custom: {}, event: {}, guest: {} } },
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
    if (editorMode === 'canvas') {
      parsedLayout = canvasLayout || {};
      setLayoutText(JSON.stringify(parsedLayout, null, 2));
    } else {
      try {
        parsedLayout = JSON.parse(layoutText || '{}');
      } catch (_err) {
        Alert.alert('Invalid JSON', 'Layout JSON is not valid.');
        return;
      }
      setCanvasLayout(parsedLayout);
    }

    const nextLayout = {
      ...parsedLayout,
      mergeData: placeholderDraft,
    };
    setCanvasLayout(nextLayout);
    setLayoutText(JSON.stringify(nextLayout, null, 2));

    setBusy(true);
    try {
      await inviteDesignService.updateDesign(selectedDesign.id, {
        name: designName || selectedDesign.name,
        status: designStatus,
        jsonLayout: nextLayout,
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

  const applyTemplateToCurrentDesign = async () => {
    if (!selectedDesign) {
      Alert.alert('Select design', 'Choose a design first.');
      return;
    }

    const templateLayout = buildInviteStarterLayout({
      templateKey: selectedTemplateKey,
      event,
      mode: 'template',
    });

    Alert.alert(
      'Apply Template',
      'This will replace the current canvas content with the selected template starter. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Apply',
          onPress: () => {
            const nextLayout = { ...templateLayout, mergeData: placeholderDraft };
            setCanvasLayout(nextLayout);
            setLayoutText(JSON.stringify(nextLayout, null, 2));
            setEditorMode('canvas');
          },
        },
      ]
    );
  };

  const applyOccasionPack = () => {
    if (!selectedDesign) {
      Alert.alert('Select design', 'Choose a design first.');
      return;
    }

    const nextLayout = applyOccasionPackToLayout({
      layout: canvasLayout,
      packKey: selectedOccasionPack,
      event,
    });

    const mergedLayout = { ...nextLayout, mergeData: placeholderDraft };
    setCanvasLayout(mergedLayout);
    setLayoutText(JSON.stringify(mergedLayout, null, 2));
    setEditorMode('canvas');
    Alert.alert('Pack Applied', 'Occasion style pack has been applied. You can continue editing.');
  };

  const autoBeautifyCanvas = () => {
    if (!selectedDesign) {
      Alert.alert('Select design', 'Choose a design first.');
      return;
    }

    const nextLayout = autoBeautifyLayout(canvasLayout);
    const mergedLayout = { ...nextLayout, mergeData: placeholderDraft };
    setCanvasLayout(mergedLayout);
    setLayoutText(JSON.stringify(mergedLayout, null, 2));
    setEditorMode('canvas');
    Alert.alert('Beautified', 'Layout spacing and alignment were polished automatically.');
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

  const exportPdf = async () => {
    if (!selectedDesign) {
      Alert.alert('Select design', 'Choose a design first.');
      return;
    }

    setBusy(true);
    try {
      await runWithPaymentRetry({
        action: async () => {
          await inviteDesignService.exportDesign(selectedDesign.id, { format: 'pdf' });
          const exportRes = await inviteDesignService.listExports(selectedDesign.id);
          setExportsList(exportRes.exports || []);
          Alert.alert('Exported', 'PDF export created.');
        },
        paymentDescription: `Invite design export`,
        onPaymentError: (err) => {
          Alert.alert('Payment Error', getErrorMessage(err));
        },
      });
    } catch (err) {
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

  const openExportUrl = async (fileUrl) => {
    const url = String(fileUrl || '').trim();
    if (!url) {
      Alert.alert('No URL', 'This export does not have a valid file URL.');
      return;
    }

    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert('Cannot Open', 'No app available to open this PDF URL on this device.');
        return;
      }
      await Linking.openURL(url);
    } catch (_err) {
      Alert.alert('Open Failed', 'Could not open this export URL.');
    }
  };

  const shareExportUrl = async (fileUrl) => {
    const url = String(fileUrl || '').trim();
    if (!url) {
      Alert.alert('No URL', 'This export does not have a valid file URL.');
      return;
    }

    try {
      await Share.share({ message: url });
    } catch (_err) {
      Alert.alert('Share Failed', 'Could not share this export URL.');
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
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 28 }}
      scrollEnabled={!canvasDragging}
    >
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

          <View style={styles.rowWrap}>
            <Chip selected={createMode === 'template'} onPress={() => setCreateMode('template')} style={styles.chip}>
              From Template
            </Chip>
            <Chip selected={createMode === 'scratch'} onPress={() => setCreateMode('scratch')} style={styles.chip}>
              From Scratch
            </Chip>
          </View>

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
          <Text style={styles.subtitle}>
            {createMode === 'template'
              ? 'Templates come with editable layout, colors, emojis, and cartoon sticker starters.'
              : 'Scratch starts with a blank professional canvas and one starter title block.'}
          </Text>
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

            <View style={styles.rowWrap}>
              <Chip selected={editorMode === 'canvas'} onPress={() => setEditorMode('canvas')} style={styles.chip}>
                Canvas Editor
              </Chip>
              <Chip selected={editorMode === 'json'} onPress={() => setEditorMode('json')} style={styles.chip}>
                JSON Editor
              </Chip>
            </View>

            <Text style={styles.subtitle}>Occasion Packs</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              <View style={styles.rowWrap}>
                {OCCASION_PACKS.map((pack) => (
                  <Chip
                    key={pack.key}
                    selected={selectedOccasionPack === pack.key}
                    onPress={() => setSelectedOccasionPack(pack.key)}
                    style={styles.chip}
                  >
                    {pack.name}
                  </Chip>
                ))}
              </View>
            </ScrollView>

            <View style={[styles.rowWrap, { marginBottom: 8 }]}>
              <Button mode="outlined" onPress={applyTemplateToCurrentDesign} icon="palette-outline" disabled={busy}>
                Apply Selected Template
              </Button>
              <Button mode="outlined" onPress={applyOccasionPack} icon="brush-variant" disabled={busy}>
                Apply Occasion Pack
              </Button>
              <Button mode="outlined" onPress={autoBeautifyCanvas} icon="auto-fix" disabled={busy}>
                Auto Beautify
              </Button>
            </View>

            {editorMode === 'canvas' ? (
              <Card style={styles.canvasLaunchCard}>
                <Card.Content>
                  <Text style={styles.sectionTitle}>Canvas Editor</Text>
                  <Text style={styles.subtitle}>Open the canvas in full-screen for comfortable drag and resize controls.</Text>
                  <View style={styles.rowWrap}>
                    <Button mode="contained" icon="fullscreen" onPress={() => setCanvasFullScreenVisible(true)}>
                      Open Full Screen Canvas
                    </Button>
                    <Button mode="outlined" onPress={autoBeautifyCanvas} icon="auto-fix" disabled={busy}>
                      Quick Beautify
                    </Button>
                  </View>
                </Card.Content>
              </Card>
            ) : (
              <TextInput
                mode="outlined"
                label="Layout JSON"
                value={layoutText}
                onChangeText={setLayoutText}
                multiline
                numberOfLines={10}
                style={styles.input}
              />
            )}

            <Card style={styles.placeholderCard}>
              <Card.Content>
                <Text style={styles.sectionTitle}>Template Placeholders</Text>
                <Text style={styles.subtitle}>Only placeholders detected in the current template are shown here.</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 8 }}>
                  <View style={styles.rowWrap}>
                    {placeholderOptions.length ? placeholderOptions.map((placeholder) => (
                      <Chip
                        key={placeholder.token}
                        selected={activePlaceholderToken === placeholder.token}
                        onPress={() => setActivePlaceholderToken(placeholder.token)}
                        style={styles.chip}
                      >
                        {placeholder.label}
                      </Chip>
                    )) : <Text style={styles.subtitle}>No placeholders detected in this layout.</Text>}
                  </View>
                </ScrollView>

                {activePlaceholderEditTarget ? (
                  <TextInput
                    mode="outlined"
                    label={TOKEN_LABELS[activePlaceholderPath] || activePlaceholderPath}
                    value={activePlaceholderValue}
                    onChangeText={(text) => {
                      setPlaceholderDraft((prev) => setValueByPath(prev, activePlaceholderPath, text));
                    }}
                    multiline={activePlaceholderEditTarget.scope === 'guest' && activePlaceholderEditTarget.key === 'invitationMessage'}
                    style={styles.input}
                  />
                ) : (
                  <Text style={styles.subtitle}>Select a placeholder token to edit its draft value.</Text>
                )}
              </Card.Content>
            </Card>

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
              <Card key={item.id} style={styles.exportCard}>
                <Card.Content>
                  <Text style={styles.exportTitle}>{item.format.toUpperCase()} export</Text>
                  <Text numberOfLines={3} style={styles.exportUrl}>{item.fileUrl}</Text>
                  <View style={styles.rowWrap}>
                    <Button mode="contained-tonal" icon="open-in-new" onPress={() => openExportUrl(item.fileUrl)}>
                      Open
                    </Button>
                    <Button mode="outlined" icon="share-variant" onPress={() => shareExportUrl(item.fileUrl)}>
                      Share URL
                    </Button>
                  </View>
                </Card.Content>
              </Card>
            )) : <Text style={styles.subtitle}>No exports yet.</Text>}
          </Card.Content>
        </Card>
      ) : null}

      <Modal
        visible={canvasFullScreenVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setCanvasFullScreenVisible(false)}
      >
        <View style={styles.fullScreenContainer}>
          <View style={styles.fullScreenHeader}>
            <Text variant="titleMedium" style={styles.fullScreenTitle}>Canvas Editor</Text>
            <View style={styles.rowWrap}>
              <Button mode="outlined" onPress={autoBeautifyCanvas} icon="auto-fix" disabled={busy}>
                Beautify
              </Button>
              <Button mode="contained" onPress={saveDesign} loading={busy} disabled={busy}>
                Save
              </Button>
              <Button mode="text" onPress={() => setCanvasFullScreenVisible(false)}>
                Done
              </Button>
            </View>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: Spacing.md, paddingBottom: Spacing.xxl }}
            scrollEnabled={!canvasDragging}
          >
            <InviteDesignCanvas
              layout={canvasLayout}
              fullScreen
              onDragStateChange={setCanvasDragging}
              onLayoutChange={(nextLayout) => {
                setCanvasLayout(nextLayout || {});
              }}
            />
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#eef2ff', padding: Spacing.md },
  card: {
    borderRadius: Radius.xl,
    marginBottom: Spacing.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: '#dde3f0',
    shadowColor: '#1f2937',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  title: { fontWeight: '900', color: Colors.textPrimary },
  subtitle: { color: Colors.textSecondary, marginTop: 4 },
  sectionTitle: { fontWeight: '700', marginBottom: 8, color: Colors.textPrimary },
  input: { marginBottom: 10, backgroundColor: Colors.surface },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  chip: { marginRight: 8, marginBottom: 8, backgroundColor: '#ede9fe' },
  placeholderCard: { marginBottom: 8, borderRadius: Radius.md, backgroundColor: Colors.surfaceVariant },
  exportCard: { marginBottom: 8, borderRadius: Radius.md, backgroundColor: Colors.surfaceVariant },
  exportTitle: { fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  exportUrl: { color: Colors.textSecondary, marginBottom: 8 },
  canvasLaunchCard: {
    borderRadius: Radius.lg,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
  },
  fullScreenContainer: {
    flex: 1,
    backgroundColor: '#eef2ff',
  },
  fullScreenHeader: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#dbe4f0',
    backgroundColor: '#ffffff',
  },
  fullScreenTitle: {
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
});

export default InviteDesignStudioScreen;
