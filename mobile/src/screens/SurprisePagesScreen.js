import React, { useCallback, useEffect, useState } from 'react';
import {
  ScrollView, StyleSheet, View, Alert, RefreshControl, Share, Clipboard,
} from 'react-native';
import {
  ActivityIndicator, Button, Card, Chip, Divider, FAB, IconButton,
  Snackbar, Text, TextInput, Portal, Modal,
} from 'react-native-paper';
import { Colors, Radius, Spacing } from '../theme';
import { getErrorMessage } from '../utils/helpers';
import { surpriseService } from '../services/surpriseService';

const CATEGORIES = [
  { key: 'proposal', label: 'Proposal', emoji: '💍', color: '#f093fb' },
  { key: 'birthday', label: 'Birthday', emoji: '🎂', color: '#4facfe' },
  { key: 'anniversary', label: 'Anniversary', emoji: '💕', color: '#fa709a' },
  { key: 'apology', label: 'Apology', emoji: '🥺', color: '#a18cd1' },
  { key: 'congratulations', label: 'Congrats', emoji: '🎉', color: '#84fab0' },
  { key: 'other', label: 'Other', emoji: '✨', color: '#667eea' },
];

const TIERS = [
  { key: 'free', label: 'Free' },
  { key: 'basic', label: 'Basic - ₹199' },
  { key: 'premium', label: 'Premium - ₹499' },
  { key: 'ultimate', label: 'Ultimate - ₹999' },
];

const statusColor = (s) => {
  if (s === 'active') return Colors.success;
  if (s === 'draft') return Colors.warning;
  if (s === 'expired') return Colors.danger;
  return Colors.textMuted;
};

const SurprisePagesScreen = ({ navigation }) => {
  const [tab, setTab] = useState('templates');
  const [templates, setTemplates] = useState([]);
  const [myPages, setMyPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterCategory, setFilterCategory] = useState(null);
  const [snack, setSnack] = useState('');

  // Create form state
  const [createVisible, setCreateVisible] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [formTitle, setFormTitle] = useState('');
  const [formRecipient, setFormRecipient] = useState('');
  const [formSender, setFormSender] = useState('');
  const [formCategory, setFormCategory] = useState('proposal');
  const [formMessage, setFormMessage] = useState('');
  const [formVideoUrl, setFormVideoUrl] = useState('');
  const [formMusicUrl, setFormMusicUrl] = useState('');
  const [creating, setCreating] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [tRes, pRes] = await Promise.all([
        surpriseService.getTemplates(),
        surpriseService.getMySurprisePages(),
      ]);
      setTemplates(tRes.templates || []);
      setMyPages(pRes.pages || []);
    } catch (err) {
      console.warn(getErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = useCallback(() => { setRefreshing(true); loadData(); }, [loadData]);

  const openCreate = (template) => {
    setSelectedTemplate(template || null);
    setFormTitle('');
    setFormRecipient('');
    setFormSender('');
    setFormCategory(template?.category || 'proposal');
    setFormMessage('');
    setFormVideoUrl('');
    setFormMusicUrl('');
    setCreateVisible(true);
  };

  const handleCreate = async () => {
    if (!formTitle.trim() || !formRecipient.trim() || !formSender.trim()) {
      Alert.alert('Missing fields', 'Title, recipient name, and your name are required.');
      return;
    }
    setCreating(true);
    try {
      await surpriseService.createSurprisePage({
        title: formTitle,
        recipientName: formRecipient,
        senderName: formSender,
        category: formCategory,
        finalMessage: formMessage,
        videoUrl: formVideoUrl || undefined,
        musicUrl: formMusicUrl || undefined,
        templateId: selectedTemplate?.id || undefined,
        steps: selectedTemplate?.steps || [],
      });
      setSnack('Surprise page created! 🎉');
      setCreateVisible(false);
      loadData();
    } catch (err) {
      Alert.alert('Error', getErrorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = (page) => {
    Alert.alert('Delete Surprise', `Delete "${page.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await surpriseService.deleteSurprisePage(page.id);
            setSnack('Deleted');
            loadData();
          } catch (err) { Alert.alert('Error', getErrorMessage(err)); }
        },
      },
    ]);
  };

  const getPageUrl = (page) =>
    page.deployedUrl || `https://vedika360.vercel.app/surprise/${page.slug}`;

  const handleShare = async (page) => {
    const url = getPageUrl(page);
    try {
      await Share.share({
        message: `✨ ${page.recipientName}, someone has a surprise for you!\n\n${url}`,
        url,
      });
    } catch { /* user cancelled */ }
  };

  const copyLink = (page) => {
    Clipboard.setString(getPageUrl(page));
    setSnack('Link copied! Share it with your special person 💕');
  };

  const handlePublish = async (page) => {
    try {
      setSnack('Deploying your surprise...');
      const res = await surpriseService.publishPage(page.id, 'auto');
      setSnack(`Published to ${res.deploy.target}! 🚀`);
      loadData();
    } catch (err) { Alert.alert('Error', getErrorMessage(err)); }
  };

  const handleUnpublish = async (page) => {
    try {
      await surpriseService.unpublishPage(page.id);
      setSnack('Page unpublished');
      loadData();
    } catch (err) { Alert.alert('Error', getErrorMessage(err)); }
  };

  const filteredTemplates = filterCategory
    ? templates.filter((t) => t.category === filterCategory)
    : templates;

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={s.loadingText}>Loading surprise magic… ✨</Text>
      </View>
    );
  }

  return (
    <View style={s.screen}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
        contentContainerStyle={s.scrollPad}
      >
        {/* Hero Section */}
        <Card style={s.heroCard}>
          <Card.Content style={s.heroContent}>
            <Text variant="headlineSmall" style={s.heroTitle}>✨ Interactive Surprise Pages</Text>
            <Text style={s.heroSub}>
              Create unforgettable digital experiences — proposals, birthdays, apologies & more.
            </Text>
          </Card.Content>
        </Card>

        {/* Tab Chips */}
        <View style={s.tabRow}>
          <Chip
            selected={tab === 'templates'}
            onPress={() => setTab('templates')}
            style={s.tabChip}
            icon="rocket-launch"
          >
            Templates
          </Chip>
          <Chip
            selected={tab === 'my-pages'}
            onPress={() => setTab('my-pages')}
            style={s.tabChip}
            icon="heart"
          >
            My Pages ({myPages.length})
          </Chip>
        </View>

        {/* Templates Tab */}
        {tab === 'templates' && (
          <>
            {/* Category Filter */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterRow}>
              <Chip
                selected={!filterCategory}
                onPress={() => setFilterCategory(null)}
                style={s.filterChip}
              >
                All
              </Chip>
              {CATEGORIES.map((c) => (
                <Chip
                  key={c.key}
                  selected={filterCategory === c.key}
                  onPress={() => setFilterCategory(filterCategory === c.key ? null : c.key)}
                  style={s.filterChip}
                >
                  {c.emoji} {c.label}
                </Chip>
              ))}
            </ScrollView>

            {filteredTemplates.map((t) => {
              const cat = CATEGORIES.find((c) => c.key === t.category);
              return (
                <Card key={t.id} style={s.templateCard}>
                  <View style={[s.templateBanner, { backgroundColor: cat?.color || Colors.primary }]}>
                    <Text style={s.templateEmoji}>{cat?.emoji || '✨'}</Text>
                  </View>
                  <Card.Content style={s.templateBody}>
                    <Text variant="titleMedium" style={s.templateName}>{t.name}</Text>
                    <Text style={s.templateDesc} numberOfLines={2}>{t.description}</Text>
                    <View style={s.chipRow}>
                      <Chip compact textStyle={s.chipText}>{cat?.label}</Chip>
                      <Chip compact textStyle={s.chipText}>
                        {TIERS.find((x) => x.key === t.tier)?.label || 'Free'}
                      </Chip>
                      <Text style={s.stepCount}>{t.steps?.length || 0} steps</Text>
                    </View>
                  </Card.Content>
                  <Card.Actions>
                    <Button mode="contained" onPress={() => openCreate(t)} icon="rocket-launch">
                      Use Template
                    </Button>
                  </Card.Actions>
                </Card>
              );
            })}

            {filteredTemplates.length === 0 && (
              <View style={s.empty}>
                <Text style={s.emptyText}>No templates in this category yet</Text>
              </View>
            )}
          </>
        )}

        {/* My Pages Tab */}
        {tab === 'my-pages' && (
          <>
            {myPages.length === 0 ? (
              <View style={s.empty}>
                <Text style={s.emptyIcon}>💌</Text>
                <Text style={s.emptyText}>No surprise pages yet</Text>
                <Button mode="contained" onPress={() => openCreate(null)} style={{ marginTop: Spacing.md }}>
                  Create Your First Surprise
                </Button>
              </View>
            ) : (
              myPages.map((p) => {
                const cat = CATEGORIES.find((c) => c.key === p.category);
                return (
                  <Card key={p.id} style={s.pageCard}>
                    <Card.Content>
                      <View style={s.pageHeader}>
                        <Text variant="titleMedium" style={s.pageName}>{p.title}</Text>
                        <Chip
                          compact
                          textStyle={[s.chipText, { color: '#fff' }]}
                          style={{ backgroundColor: statusColor(p.status) }}
                        >
                          {p.status}
                        </Chip>
                      </View>
                      <Divider style={{ marginVertical: Spacing.sm }} />
                      <Text style={s.pageDetail}>To: <Text style={s.bold}>{p.recipientName}</Text></Text>
                      <Text style={s.pageDetail}>From: <Text style={s.bold}>{p.senderName}</Text></Text>
                      <View style={[s.chipRow, { marginTop: Spacing.sm }]}>
                        <Chip compact icon="eye">{p.viewCount || 0} views</Chip>
                        <Chip compact icon="heart">{p.completedCount || 0} done</Chip>
                        {cat && <Chip compact>{cat.emoji} {cat.label}</Chip>}
                      </View>
                    </Card.Content>
                    {p.deployedUrl && (
                      <View style={{ paddingHorizontal: 16, paddingBottom: 4 }}>
                        <Chip compact icon={p.deployTarget === 'netlify' ? 'web' : p.deployTarget === 'r2' ? 'cloud' : 'link'}>
                          {p.deployTarget === 'netlify' ? 'Netlify' : p.deployTarget === 'r2' ? 'R2' : 'Internal'}
                        </Chip>
                      </View>
                    )}
                    <Card.Actions style={s.pageActions}>
                      {p.status !== 'active' ? (
                        <Button mode="contained" compact onPress={() => handlePublish(p)} icon="rocket-launch">
                          Publish
                        </Button>
                      ) : (
                        <Button mode="outlined" compact onPress={() => handleUnpublish(p)} icon="close-circle">
                          Unpublish
                        </Button>
                      )}
                      <IconButton icon="share-variant" onPress={() => handleShare(p)} />
                      <IconButton icon="content-copy" onPress={() => copyLink(p)} />
                      <IconButton
                        icon="open-in-new"
                        onPress={() => navigation.navigate('SurpriseViewer', { slug: p.slug })}
                      />
                      <IconButton icon="delete" iconColor={Colors.danger} onPress={() => handleDelete(p)} />
                    </Card.Actions>
                  </Card>
                );
              })
            )}
          </>
        )}
      </ScrollView>

      {/* FAB */}
      <FAB
        icon="plus"
        label="Create"
        style={s.fab}
        onPress={() => openCreate(null)}
      />

      {/* Create Modal */}
      <Portal>
        <Modal
          visible={createVisible}
          onDismiss={() => setCreateVisible(false)}
          contentContainerStyle={s.modal}
        >
          <ScrollView>
            <Text variant="titleLarge" style={s.modalTitle}>
              {selectedTemplate ? `Use: ${selectedTemplate.name}` : 'Create Surprise'}
            </Text>

            <TextInput
              label="Title *"
              value={formTitle}
              onChangeText={setFormTitle}
              mode="outlined"
              style={s.input}
            />
            <TextInput
              label="Recipient Name *"
              value={formRecipient}
              onChangeText={setFormRecipient}
              mode="outlined"
              style={s.input}
            />
            <TextInput
              label="Your Name *"
              value={formSender}
              onChangeText={setFormSender}
              mode="outlined"
              style={s.input}
            />

            <Text style={s.label}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.catRow}>
              {CATEGORIES.map((c) => (
                <Chip
                  key={c.key}
                  selected={formCategory === c.key}
                  onPress={() => setFormCategory(c.key)}
                  style={s.catChip}
                >
                  {c.emoji} {c.label}
                </Chip>
              ))}
            </ScrollView>

            <TextInput
              label="Final Message"
              value={formMessage}
              onChangeText={setFormMessage}
              mode="outlined"
              multiline
              numberOfLines={3}
              style={s.input}
              placeholder="Your heartfelt message at the final reveal…"
            />
            <TextInput
              label="Video URL (optional)"
              value={formVideoUrl}
              onChangeText={setFormVideoUrl}
              mode="outlined"
              style={s.input}
              placeholder="https://..."
            />
            <TextInput
              label="Music URL (optional)"
              value={formMusicUrl}
              onChangeText={setFormMusicUrl}
              mode="outlined"
              style={s.input}
              placeholder="https://..."
            />

            {selectedTemplate && (
              <Card style={s.infoCard}>
                <Card.Content>
                  <Text style={s.infoText}>
                    🎯 Using template: {selectedTemplate.name}{'\n'}
                    {selectedTemplate.steps?.length || 0} interactive steps included
                  </Text>
                </Card.Content>
              </Card>
            )}

            <Button
              mode="contained"
              onPress={handleCreate}
              loading={creating}
              disabled={creating}
              style={s.createBtn}
              icon="rocket-launch"
            >
              Create Surprise Page
            </Button>
          </ScrollView>
        </Modal>
      </Portal>

      <Snackbar visible={!!snack} onDismiss={() => setSnack('')} duration={3000}>
        {snack}
      </Snackbar>
    </View>
  );
};

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  scrollPad: { padding: Spacing.lg, paddingBottom: 100 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  loadingText: { marginTop: Spacing.md, color: Colors.textSecondary },

  heroCard: {
    borderRadius: Radius.lg,
    marginBottom: Spacing.lg,
    overflow: 'hidden',
  },
  heroContent: {
    backgroundColor: Colors.primary,
    padding: Spacing.xl,
  },
  heroTitle: { fontWeight: '800', color: '#fff', marginBottom: Spacing.xs },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: 14, lineHeight: 20 },

  tabRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  tabChip: { flex: 1 },

  filterRow: { marginBottom: Spacing.md },
  filterChip: { marginRight: Spacing.sm },

  templateCard: {
    borderRadius: Radius.lg,
    marginBottom: Spacing.md,
    overflow: 'hidden',
    elevation: 2,
  },
  templateBanner: {
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  templateEmoji: { fontSize: 48 },
  templateBody: { paddingTop: Spacing.md },
  templateName: { fontWeight: '700', marginBottom: Spacing.xs },
  templateDesc: { color: Colors.textSecondary, marginBottom: Spacing.sm, fontSize: 13 },
  chipRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center', flexWrap: 'wrap' },
  chipText: { fontSize: 11 },
  stepCount: { color: Colors.textMuted, fontSize: 12 },

  empty: { alignItems: 'center', paddingVertical: Spacing.xxxl },
  emptyIcon: { fontSize: 48, marginBottom: Spacing.md },
  emptyText: { color: Colors.textSecondary, fontSize: 15 },

  pageCard: {
    borderRadius: Radius.lg,
    marginBottom: Spacing.md,
    elevation: 2,
  },
  pageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pageName: { fontWeight: '700', flex: 1, marginRight: Spacing.sm },
  pageDetail: { color: Colors.textSecondary, fontSize: 13, marginBottom: 2 },
  bold: { fontWeight: '700', color: Colors.textPrimary },
  pageActions: { flexWrap: 'wrap' },

  fab: {
    position: 'absolute',
    bottom: Spacing.xl,
    right: Spacing.xl,
    backgroundColor: Colors.primary,
  },

  modal: {
    backgroundColor: Colors.surface,
    margin: Spacing.lg,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    maxHeight: '85%',
  },
  modalTitle: { fontWeight: '800', marginBottom: Spacing.lg },
  input: { marginBottom: Spacing.md },
  label: { color: Colors.textSecondary, fontSize: 13, marginBottom: Spacing.xs },
  catRow: { marginBottom: Spacing.md },
  catChip: { marginRight: Spacing.sm },
  infoCard: { backgroundColor: Colors.surfaceVariant, marginBottom: Spacing.md, borderRadius: Radius.md },
  infoText: { fontSize: 13, color: Colors.textSecondary, lineHeight: 20 },
  createBtn: { marginTop: Spacing.md },
});

export default SurprisePagesScreen;
