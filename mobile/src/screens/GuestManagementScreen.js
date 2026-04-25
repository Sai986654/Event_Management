import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Alert, TouchableOpacity, Linking } from 'react-native';
import {
  Text, Card, Button, Chip, FAB, ActivityIndicator, TextInput, Portal, Modal, IconButton, Divider,
} from 'react-native-paper';
import { guestService } from '../services/guestService';
import { getErrorMessage, getStatusColor } from '../utils/helpers';
import { Colors, Spacing, Radius } from '../theme';

const GuestManagementScreen = ({ route }) => {
  const { eventId } = route.params;
  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '' });
  const [submitting, setSubmitting] = useState(false);
  const [inviteTemplates, setInviteTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState('royal-maroon');
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [selectedTone, setSelectedTone] = useState('friendly');
  const [selectedGuestIds, setSelectedGuestIds] = useState([]);
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [generatingGuestId, setGeneratingGuestId] = useState(null);

  const fetchGuests = useCallback(async () => {
    try {
      const data = await guestService.getEventGuests(eventId);
      setGuests(data.guests || []);
    } catch (err) {
      Alert.alert('Error', getErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [eventId]);

  useEffect(() => { fetchGuests(); }, [fetchGuests]);

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        setLoadingTemplates(true);
        const data = await guestService.getInviteTemplates();
        const templates = data?.templates || [];
        setInviteTemplates(templates);
        if (templates.length && !templates.some((t) => t.key === selectedTemplateKey)) {
          setSelectedTemplateKey(templates[0].key);
        }
      } catch (err) {
        Alert.alert('Templates', getErrorMessage(err));
      } finally {
        setLoadingTemplates(false);
      }
    };
    fetchTemplates();
  }, []);

  const handleAddGuest = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Validation', 'Guest name is required');
      return;
    }
    try {
      setSubmitting(true);
      await guestService.addGuest(eventId, formData);
      setShowAddModal(false);
      setFormData({ name: '', email: '', phone: '' });
      fetchGuests();
    } catch (err) {
      Alert.alert('Error', getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckIn = async (guestId) => {
    try {
      await guestService.checkInGuest(guestId);
      fetchGuests();
    } catch (err) {
      Alert.alert('Error', getErrorMessage(err));
    }
  };

  const handleGenerateGuestInvite = async (guest) => {
    try {
      setGeneratingGuestId(guest.id);
      await guestService.generatePersonalizedInvite(guest.id, {
        language: selectedLanguage,
        tone: selectedTone,
        templateKey: selectedTemplateKey,
      });
      Alert.alert('Success', `Invite generated for ${guest.name}`);
      fetchGuests();
    } catch (err) {
      Alert.alert('Error', getErrorMessage(err));
    } finally {
      setGeneratingGuestId(null);
    }
  };

  const handleGenerateAllInvites = async () => {
    try {
      setBulkGenerating(true);
      const payload = {
        defaultLanguage: selectedLanguage,
        defaultTone: selectedTone,
        defaultTemplateKey: selectedTemplateKey,
      };

      if (selectedGuestIds.length) {
        payload.guestIds = selectedGuestIds;
      }

      const result = await guestService.generateBulkPersonalizedInvites(eventId, payload);
      Alert.alert('Generated', `${result.generated}/${result.total} invites generated.`);
      fetchGuests();
    } catch (err) {
      Alert.alert('Error', getErrorMessage(err));
    } finally {
      setBulkGenerating(false);
    }
  };

  const toggleGuestSelection = (guestId) => {
    setSelectedGuestIds((prev) =>
      prev.includes(guestId) ? prev.filter((id) => id !== guestId) : [...prev, guestId]
    );
  };

  const handleOpenInvitePdf = async (url) => {
    if (!url) return;
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert('Cannot open', 'Unable to open invite PDF URL');
      return;
    }
    Linking.openURL(url);
  };

  const handleDeleteGuest = (guestId, guestName) => {
    Alert.alert('Remove Guest', `Remove ${guestName} from the guest list?`, [
      { text: 'Cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await guestService.deleteGuest(guestId);
            fetchGuests();
          } catch (err) {
            Alert.alert('Error', getErrorMessage(err));
          }
        },
      },
    ]);
  };

  const rsvpStats = {
    total: guests.length,
    confirmed: guests.filter((g) => g.rsvpStatus === 'accepted').length,
    pending: guests.filter((g) => g.rsvpStatus === 'pending' || !g.rsvpStatus).length,
    declined: guests.filter((g) => g.rsvpStatus === 'declined').length,
    checkedIn: guests.filter((g) => g.checkedIn).length,
  };

  const selectedTemplate = inviteTemplates.find((template) => template.key === selectedTemplateKey) || null;
  const selectedGuests = guests.filter((guest) => selectedGuestIds.includes(guest.id));
  const previewGuest = selectedGuests[0] || guests[0] || null;
  const extraSelectedCount = Math.max(0, selectedGuests.length - 1);
  const previewGuestName = previewGuest?.name || 'Priya';
  const previewRelationship = previewGuest?.relationship || 'guest';

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color={Colors.primary} />;

  return (
    <View style={styles.container}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchGuests(); }} colors={[Colors.primary]} />}
      >
        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{rsvpStats.total}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: Colors.success }]}>{rsvpStats.confirmed}</Text>
            <Text style={styles.statLabel}>Confirmed</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: Colors.warning }]}>{rsvpStats.pending}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: Colors.danger }]}>{rsvpStats.declined}</Text>
            <Text style={styles.statLabel}>Declined</Text>
          </View>
        </View>

        {/* Checked-in indicator */}
        <Card style={styles.checkinCard}>
          <Card.Content style={styles.checkinRow}>
            <IconButton icon="account-check" iconColor={Colors.success} size={24} />
            <Text variant="titleSmall" style={{ flex: 1, fontWeight: '700' }}>
              {rsvpStats.checkedIn} / {rsvpStats.total} checked in
            </Text>
          </Card.Content>
        </Card>

        {/* Guest List */}
        <Card style={styles.inviteCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.inviteTitle}>Personalized Invite Templates</Text>
            {loadingTemplates ? (
              <ActivityIndicator color={Colors.primary} style={{ marginVertical: 8 }} />
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.templateRow}>
                {inviteTemplates.map((template) => {
                  const selected = selectedTemplateKey === template.key;
                  return (
                    <TouchableOpacity
                      key={template.key}
                      onPress={() => setSelectedTemplateKey(template.key)}
                      style={[
                        styles.templateCard,
                        {
                          borderColor: selected ? (template.preview?.frame || Colors.primary) : Colors.border,
                          backgroundColor: selected ? (template.preview?.background || '#fff') : Colors.surface,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.templateThumb,
                          { backgroundColor: template.preview?.accent || Colors.primary },
                        ]}
                      />
                      <Text style={styles.templateName}>{template.name}</Text>
                      <Text numberOfLines={2} style={styles.templateDescription}>{template.description}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            <View style={styles.choiceRow}>
              <Text style={styles.choiceLabel}>Language</Text>
              <View style={styles.choiceChips}>
                <Chip selected={selectedLanguage === 'en'} onPress={() => setSelectedLanguage('en')} style={styles.choiceChip}>English</Chip>
                <Chip selected={selectedLanguage === 'te'} onPress={() => setSelectedLanguage('te')} style={styles.choiceChip}>Telugu</Chip>
              </View>
            </View>

            <View style={styles.choiceRow}>
              <Text style={styles.choiceLabel}>Tone</Text>
              <View style={styles.choiceChips}>
                {['friendly', 'formal', 'emotional'].map((tone) => (
                  <Chip key={tone} selected={selectedTone === tone} onPress={() => setSelectedTone(tone)} style={styles.choiceChip}>
                    {tone}
                  </Chip>
                ))}
              </View>
            </View>

            <Card
              style={[
                styles.previewCard,
                { backgroundColor: selectedTemplate?.preview?.background || Colors.surface },
              ]}
            >
              <Card.Content>
                <Text style={styles.previewTitle}>{selectedTemplate?.name || 'Template preview'}</Text>
                <Text style={styles.previewMeta}>
                  {selectedLanguage === 'te' ? 'Telugu' : 'English'} • {selectedTone} • {previewRelationship}
                </Text>
                <Text style={styles.previewSalutation}>
                  {selectedLanguage === 'te' ? `Priyamaina ${previewGuestName} garu` : `Dear ${previewGuestName}`}
                </Text>
                <Text style={styles.previewBody}>
                  {selectedLanguage === 'te'
                    ? 'Mana special rojuna mee aashirvadam maaku chala mukhyam.'
                    : 'From our hearts, we would love to have you with us on our special day.'}
                </Text>
                {selectedGuestIds.length ? (
                  <Text style={styles.previewHint}>
                    Selected: {previewGuestName}{extraSelectedCount > 0 ? ` +${extraSelectedCount} more` : ''}
                  </Text>
                ) : (
                  <Text style={styles.previewHint}>Tip: tap guest cards to target selected guests only.</Text>
                )}
              </Card.Content>
            </Card>

            <Button mode="contained" onPress={handleGenerateAllInvites} loading={bulkGenerating} disabled={bulkGenerating || !guests.length}>
              {selectedGuestIds.length
                ? `Generate Invites For Selected (${selectedGuestIds.length})`
                : 'Generate Invites For All Guests'}
            </Button>
          </Card.Content>
        </Card>

        <Text variant="titleMedium" style={styles.sectionTitle}>Guest List</Text>
        {guests.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Card.Content>
              <Text style={styles.emptyText}>No guests yet. Tap + to add guests!</Text>
            </Card.Content>
          </Card>
        ) : (
          guests.map((guest) => (
            <TouchableOpacity key={guest.id} activeOpacity={0.85} onPress={() => toggleGuestSelection(guest.id)}>
            <Card style={[styles.guestCard, selectedGuestIds.includes(guest.id) && styles.guestCardSelected]}>
              <Card.Content>
                <View style={styles.guestRow}>
                  <View style={{ flex: 1 }}>
                    <Text variant="titleSmall" style={styles.guestName}>{guest.name}</Text>
                    {guest.email ? <Text variant="bodySmall" style={styles.guestMeta}>{guest.email}</Text> : null}
                    {guest.phone ? <Text variant="bodySmall" style={styles.guestMeta}>{guest.phone}</Text> : null}
                    {guest.inviteTemplateKey ? <Text variant="bodySmall" style={styles.guestMeta}>Template: {guest.inviteTemplateKey}</Text> : null}
                    {guest.personalizedInvitePdfUrl ? (
                      <Button compact mode="text" onPress={() => handleOpenInvitePdf(guest.personalizedInvitePdfUrl)}>
                        Open Invite PDF
                      </Button>
                    ) : null}
                  </View>
                  <View style={styles.guestActions}>
                    <Chip
                      compact
                      textStyle={{ fontSize: 10, fontWeight: '600' }}
                      style={{ backgroundColor: getStatusColor(guest.rsvpStatus || 'pending') + '22', marginBottom: 4 }}
                    >
                      {guest.rsvpStatus || 'pending'}
                    </Chip>
                    {guest.checkedIn && (
                      <Chip compact icon="check" textStyle={{ fontSize: 10, color: Colors.success }}>In</Chip>
                    )}
                  </View>
                </View>
                <Divider style={{ marginVertical: 8 }} />
                <View style={styles.actionRow}>
                  <Chip
                    compact
                    selected={selectedGuestIds.includes(guest.id)}
                    onPress={() => toggleGuestSelection(guest.id)}
                    style={styles.selectChip}
                  >
                    {selectedGuestIds.includes(guest.id) ? 'Selected' : 'Select'}
                  </Chip>
                  <Button
                    compact
                    mode="contained-tonal"
                    onPress={() => handleGenerateGuestInvite(guest)}
                    loading={generatingGuestId === guest.id}
                    style={styles.actionBtn}
                  >
                    Invite
                  </Button>
                  {!guest.checkedIn && (
                    <Button compact mode="contained-tonal" onPress={() => handleCheckIn(guest.id)} style={styles.actionBtn}>
                      Check In
                    </Button>
                  )}
                  <Button compact mode="text" textColor={Colors.danger} onPress={() => handleDeleteGuest(guest.id, guest.name)}>
                    Remove
                  </Button>
                </View>
              </Card.Content>
            </Card>
            </TouchableOpacity>
          ))
        )}
        <View style={{ height: 90 }} />
      </ScrollView>

      {/* Add Guest Modal */}
      <Portal>
        <Modal
          visible={showAddModal}
          onDismiss={() => setShowAddModal(false)}
          contentContainerStyle={styles.modal}
        >
          <Text variant="titleLarge" style={{ fontWeight: '800', marginBottom: Spacing.lg }}>Add Guest</Text>
          <TextInput
            label="Name *"
            value={formData.name}
            onChangeText={(t) => setFormData((p) => ({ ...p, name: t }))}
            mode="outlined"
            style={styles.input}
          />
          <TextInput
            label="Email"
            value={formData.email}
            onChangeText={(t) => setFormData((p) => ({ ...p, email: t }))}
            mode="outlined"
            keyboardType="email-address"
            autoCapitalize="none"
            style={styles.input}
          />
          <TextInput
            label="Phone"
            value={formData.phone}
            onChangeText={(t) => setFormData((p) => ({ ...p, phone: t }))}
            mode="outlined"
            keyboardType="phone-pad"
            style={styles.input}
          />
          <TextInput
            label="Relationship"
            value={formData.relationship || ''}
            onChangeText={(t) => setFormData((p) => ({ ...p, relationship: t }))}
            mode="outlined"
            style={styles.input}
          />
          {!!inviteTemplates.length && (
            <>
              <Text style={styles.modalLabel}>Invite Template</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modalTemplateRow}>
                {inviteTemplates.map((template) => {
                  const active = (formData.inviteTemplateKey || selectedTemplateKey) === template.key;
                  return (
                    <Chip
                      key={template.key}
                      selected={active}
                      onPress={() => setFormData((p) => ({ ...p, inviteTemplateKey: template.key }))}
                      style={styles.modalTemplateChip}
                    >
                      {template.name}
                    </Chip>
                  );
                })}
              </ScrollView>
            </>
          )}
          <View style={styles.modalActions}>
            <Button mode="text" onPress={() => setShowAddModal(false)}>Cancel</Button>
            <Button mode="contained" onPress={handleAddGuest} loading={submitting} disabled={submitting}>
              Add Guest
            </Button>
          </View>
        </Modal>
      </Portal>

      <FAB
        icon="plus"
        style={styles.fab}
        color={Colors.textOnPrimary}
        onPress={() => setShowAddModal(true)}
        label="Add Guest"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  statCard: {
    flex: 1,
    marginHorizontal: 4,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    elevation: 2,
  },
  statValue: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  statLabel: { fontSize: 11, color: Colors.textSecondary, fontWeight: '600', marginTop: 2 },
  checkinCard: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
    borderRadius: Radius.lg,
    elevation: 1,
    backgroundColor: Colors.surface,
  },
  checkinRow: { flexDirection: 'row', alignItems: 'center' },
  inviteCard: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    elevation: 2,
  },
  inviteTitle: { fontWeight: '800', marginBottom: Spacing.sm, color: Colors.textPrimary },
  templateRow: { paddingBottom: Spacing.sm },
  templateCard: {
    width: 170,
    borderRadius: Radius.lg,
    borderWidth: 2,
    padding: Spacing.md,
    marginRight: Spacing.sm,
  },
  templateThumb: { width: '100%', height: 48, borderRadius: Radius.md, marginBottom: Spacing.sm },
  templateName: { fontWeight: '700', color: Colors.textPrimary, marginBottom: 2 },
  templateDescription: { fontSize: 12, color: Colors.textSecondary },
  choiceRow: { marginTop: Spacing.sm },
  choiceLabel: { fontWeight: '700', color: Colors.textPrimary, marginBottom: 6 },
  choiceChips: { flexDirection: 'row', flexWrap: 'wrap' },
  choiceChip: { marginRight: 8, marginBottom: 8 },
  previewCard: {
    marginVertical: Spacing.sm,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
  },
  previewTitle: { fontWeight: '800', color: Colors.textPrimary },
  previewMeta: { marginTop: 2, color: Colors.textSecondary, textTransform: 'capitalize' },
  previewSalutation: { marginTop: 8, color: Colors.textPrimary, fontWeight: '700' },
  previewBody: { marginTop: 8, color: Colors.textPrimary, lineHeight: 20 },
  previewHint: { marginTop: 8, color: Colors.textSecondary, fontSize: 12 },
  sectionTitle: {
    fontWeight: '800',
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
    color: Colors.textPrimary,
  },
  emptyCard: { marginHorizontal: Spacing.lg, borderRadius: Radius.lg, backgroundColor: Colors.surface },
  emptyText: { textAlign: 'center', color: Colors.textMuted, paddingVertical: 20 },
  guestCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    borderRadius: Radius.lg,
    elevation: 2,
    backgroundColor: Colors.surface,
  },
  guestCardSelected: {
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  guestRow: { flexDirection: 'row', alignItems: 'center' },
  guestName: { fontWeight: '700', color: Colors.textPrimary },
  guestMeta: { color: Colors.textSecondary, marginTop: 2 },
  guestActions: { alignItems: 'flex-end' },
  actionRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  selectChip: { marginRight: Spacing.sm, alignSelf: 'center' },
  actionBtn: { marginRight: Spacing.sm },
  modal: {
    backgroundColor: Colors.surface,
    margin: Spacing.lg,
    padding: Spacing.xl,
    borderRadius: Radius.lg,
  },
  modalLabel: { marginBottom: 8, color: Colors.textPrimary, fontWeight: '700' },
  modalTemplateRow: { paddingBottom: 8 },
  modalTemplateChip: { marginRight: 8 },
  input: { marginBottom: Spacing.md },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: Spacing.md },
  fab: { position: 'absolute', right: 16, bottom: 16, backgroundColor: Colors.primary, borderRadius: Radius.lg },
});

export default GuestManagementScreen;
