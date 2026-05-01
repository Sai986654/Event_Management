import React, { useEffect, useState } from 'react';
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
  const [editorMode, setEditorMode] = useState('canvas');
  const [sendVia, setSendVia] = useState('email');
  const [canvasFullScreenVisible, setCanvasFullScreenVisible] = useState(false);
  const [canvasDragging, setCanvasDragging] = useState(false);

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
      setCanvasLayout(design.jsonLayout || {});
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
        jsonLayout: starterLayout,
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
            setCanvasLayout(templateLayout);
            setLayoutText(JSON.stringify(templateLayout, null, 2));
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

    setCanvasLayout(nextLayout);
    setLayoutText(JSON.stringify(nextLayout, null, 2));
    setEditorMode('canvas');
    Alert.alert('Pack Applied', 'Occasion style pack has been applied. You can continue editing.');
  };

  const autoBeautifyCanvas = () => {
    if (!selectedDesign) {
      Alert.alert('Select design', 'Choose a design first.');
      return;
    }

    const nextLayout = autoBeautifyLayout(canvasLayout);
    setCanvasLayout(nextLayout);
    setLayoutText(JSON.stringify(nextLayout, null, 2));
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
