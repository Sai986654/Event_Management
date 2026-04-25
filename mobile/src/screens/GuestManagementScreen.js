import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Alert, TouchableOpacity, Linking } from 'react-native';
import {
  Text, Card, Button, Chip, FAB, ActivityIndicator, TextInput, Portal, Modal, IconButton, Divider,
} from 'react-native-paper';
import { guestService } from '../services/guestService';
import { getErrorMessage, getStatusColor } from '../utils/helpers';
import { Colors, Spacing, Radius } from '../theme';

function getPreviewPalette(template) {
  return {
    background: template?.preview?.background || Colors.surface,
    frame: template?.preview?.frame || Colors.primary,
    accent: template?.preview?.accent || Colors.accent,
    header: template?.preview?.header || template?.preview?.frame || Colors.primary,
    headerText: template?.preview?.headerText || Colors.textOnPrimary,
    badge: template?.preview?.badge || Colors.surfaceVariant,
  };
}

function TemplateMiniInvite({ template, selected, onPress }) {
  const palette = getPreviewPalette(template);
  const ornamentStyle = template?.ornamentStyle || 'traditional';
  const ornamentChar = ornamentStyle === 'floral'
    ? '●'
    : ornamentStyle === 'geometric'
      ? '◆'
      : ornamentStyle === 'minimal'
        ? '─'
        : '✦';

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.templateCard,
        {
          borderColor: selected ? palette.frame : Colors.border,
          backgroundColor: palette.background,
        },
      ]}
      activeOpacity={0.88}
    >
      <View style={[styles.templateCanvas, { backgroundColor: palette.background, borderColor: palette.frame }]}>
        <View style={[styles.templateCanvasHeader, { backgroundColor: palette.header }]}> 
          <Text style={[styles.templateCanvasBrand, { color: palette.headerText }]}>Vedika 360</Text>
        </View>
        <Text style={[styles.templateCanvasCorner, styles.templateCanvasCornerLeft, { color: palette.accent }]}>{ornamentChar}</Text>
        <Text style={[styles.templateCanvasCorner, styles.templateCanvasCornerRight, { color: palette.accent }]}>{ornamentChar}</Text>
        <View style={styles.templateCanvasBody}>
          <View style={styles.templateCanvasDividerRow}>
            <View style={[styles.templateCanvasDivider, { backgroundColor: palette.accent }]} />
            <Text style={[styles.templateCanvasDividerIcon, { color: palette.accent }]}>{ornamentChar}</Text>
            <View style={[styles.templateCanvasDivider, { backgroundColor: palette.accent }]} />
          </View>
          <Text numberOfLines={1} style={[styles.templateCanvasTitle, { color: palette.frame }]}>{template?.name || 'Template'}</Text>
          <View style={[styles.templateCanvasBadge, { backgroundColor: palette.badge, borderColor: palette.accent }]}>
            <Text numberOfLines={1} style={[styles.templateCanvasBadgeText, { color: palette.frame }]}>Wedding Celebration</Text>
          </View>
          <View style={styles.templateCanvasLineGroup}>
            <View style={[styles.templateCanvasLine, { backgroundColor: palette.accent, width: '78%' }]} />
            <View style={[styles.templateCanvasLine, { backgroundColor: palette.accent, width: '66%' }]} />
            <View style={[styles.templateCanvasLine, { backgroundColor: palette.accent, width: '58%' }]} />
          </View>
        </View>
        <View style={[styles.templateCanvasFooter, { backgroundColor: palette.header }]}> 
          <Text style={[styles.templateCanvasFooterDots, { color: palette.headerText }]}>• • •</Text>
        </View>
      </View>
      <Text style={styles.templateName}>{template?.name}</Text>
      <Text numberOfLines={2} style={styles.templateDescription}>{template?.description}</Text>
    </TouchableOpacity>
  );
}

function InviteLivePreview({ template, language, tone, guestName, relationship, previewBody, selectedGuestIds, extraSelectedCount }) {
  const palette = getPreviewPalette(template);
  const ornamentStyle = template?.ornamentStyle || 'traditional';
  const ornamentChar = ornamentStyle === 'floral'
    ? '●'
    : ornamentStyle === 'geometric'
      ? '◆'
      : ornamentStyle === 'minimal'
        ? '─'
        : '✦';

  return (
    <View style={[styles.previewCard, { backgroundColor: palette.background, borderColor: palette.frame }]}> 
      <View style={[styles.previewHeaderBand, { backgroundColor: palette.header }]}> 
        <Text style={[styles.previewHeaderBrand, { color: palette.headerText }]}>Vedika 360</Text>
        <Text style={[styles.previewHeaderSub, { color: palette.headerText }]}>Personalized Wedding Invitation</Text>
      </View>

      <View style={styles.previewInnerFrame}>
        <Text style={[styles.previewOrnament, { color: palette.accent }]}>{ornamentChar}  {ornamentChar}  {ornamentChar}</Text>
        <Text style={[styles.previewTitle, { color: palette.frame }]}>{template?.name || 'Template preview'}</Text>
        <Text style={[styles.previewMeta, { color: Colors.textSecondary }]}>
          {language === 'te' ? 'Telugu' : 'English'} • {tone} • {relationship}
        </Text>

        <View style={styles.previewDividerRow}>
          <View style={[styles.previewDivider, { backgroundColor: palette.accent }]} />
          <Text style={[styles.previewDividerIcon, { color: palette.accent }]}>{ornamentChar}</Text>
          <View style={[styles.previewDivider, { backgroundColor: palette.accent }]} />
        </View>

        <View style={[styles.previewBadge, { backgroundColor: palette.badge, borderColor: palette.accent }]}> 
          <Text style={[styles.previewBadgeText, { color: palette.frame }]}>Saturday • 7:00 PM • Wedding Venue</Text>
        </View>

        <Text style={[styles.previewSalutation, { color: palette.frame }]}>
          {language === 'te' ? `Priyamaina ${guestName} garu` : `Dear ${guestName}`}
        </Text>
        <Text style={[styles.previewBody, { color: Colors.textPrimary }]}>{previewBody}</Text>

        <View style={styles.previewDetailBlock}>
          <Text style={[styles.previewDetailLabel, { color: palette.frame }]}>Guest</Text>
          <Text style={styles.previewDetailValue}>{guestName}</Text>
          <Text style={[styles.previewDetailLabel, { color: palette.frame, marginTop: 8 }]}>Dress Code</Text>
          <Text style={styles.previewDetailValue}>Festive / Traditional</Text>
        </View>

        {selectedGuestIds.length ? (
          <Text style={styles.previewHint}>
            Selected: {guestName}{extraSelectedCount > 0 ? ` +${extraSelectedCount} more` : ''}
          </Text>
        ) : (
          <Text style={styles.previewHint}>Tip: tap guest cards to target selected guests only.</Text>
        )}
      </View>

      <View style={[styles.previewFooterBand, { backgroundColor: palette.header }]}> 
        <Text style={[styles.previewFooterText, { color: palette.headerText }]}>RSVP via QR / Invite Link</Text>
      </View>
    </View>
  );
}

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
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  const [quickAddText, setQuickAddText] = useState('');
  const [quickAdding, setQuickAdding] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [selectedSendChannel, setSelectedSendChannel] = useState('email');
  const [sendingInvites, setSendingInvites] = useState(false);

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

  const handleQuickAddGuests = async () => {
    if (!quickAddText.trim()) {
      Alert.alert('Validation', 'Paste guest names, emails, and phones (one per line or comma-separated)');
      return;
    }
    try {
      setQuickAdding(true);
      const result = await guestService.quickAddGuests(eventId, quickAddText);
      Alert.alert('Success', `Added ${result.count} guests`);
      setQuickAddText('');
      setShowQuickAddModal(false);
      fetchGuests();
    } catch (err) {
      Alert.alert('Error', getErrorMessage(err));
    } finally {
      setQuickAdding(false);
    }
  };

  const handleGenerateAndSendInvites = async () => {
    try {
      setSendingInvites(true);
      const payload = {
        sendVia: selectedSendChannel,
        defaultLanguage: selectedLanguage,
        defaultTone: selectedTone,
        defaultTemplateKey: selectedTemplateKey,
      };

      if (selectedGuestIds.length) {
        payload.guestIds = selectedGuestIds;
      }

      const result = await guestService.generateAndSendInvites(eventId, payload);
      Alert.alert(
        'Success',
        `Generated ${result.generated} invites.\nSent to ${result.sent} guests via ${selectedSendChannel}.`
      );
      setShowSendModal(false);
      setSelectedGuestIds([]);
      fetchGuests();
    } catch (err) {
      Alert.alert('Error', getErrorMessage(err));
    } finally {
      setSendingInvites(false);
    }
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
  const previewGuestName = previewGuest?.name || 'Guest';
  const previewRelationship = previewGuest?.relationship || 'guest';
  const sampleCopy = {
    en: {
      formal: 'It would be our honor to have your gracious presence at our wedding celebration.',
      friendly: 'We are super excited to celebrate with you. Please join us and make it unforgettable.',
      emotional: 'From our hearts, we would love to have you with us on our special day.',
    },
    te: {
      formal: 'Mana vivaha vedukaku mee sannidhi maaku gauravam.',
      friendly: 'Mana celebration ni kalisi santhoshanga jarupukundam, tappakunda randi.',
      emotional: 'Mana special rojuna mee aashirvadam maaku chala mukhyam.',
    },
  };
  const previewBody = sampleCopy[selectedLanguage]?.[selectedTone] || sampleCopy.en.friendly;

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
                    <TemplateMiniInvite
                      key={template.key}
                      template={template}
                      selected={selected}
                      onPress={() => setSelectedTemplateKey(template.key)}
                    />
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
            <InviteLivePreview
              template={selectedTemplate}
              language={selectedLanguage}
              tone={selectedTone}
              guestName={previewGuestName}
              relationship={previewRelationship}
              previewBody={previewBody}
              selectedGuestIds={selectedGuestIds}
              extraSelectedCount={extraSelectedCount}
            />

            <Button mode="contained" onPress={handleGenerateAllInvites} loading={bulkGenerating} disabled={bulkGenerating || !guests.length}>
              {selectedGuestIds.length
                ? `Generate Invites For Selected (${selectedGuestIds.length})`
                : 'Generate Invites For All Guests'}
            </Button>

            <Button 
              mode="contained-tonal" 
              onPress={() => setShowSendModal(true)} 
              loading={sendingInvites} 
              disabled={sendingInvites || !guests.length}
              style={{ marginTop: Spacing.md }}
            >
              {selectedGuestIds.length
                ? `Generate & Send To Selected (${selectedGuestIds.length})`
                : 'Generate & Send To All Guests'}
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

        {/* Quick Add Modal */}
        <Modal
          visible={showQuickAddModal}
          onDismiss={() => setShowQuickAddModal(false)}
          contentContainerStyle={styles.modal}
        >
          <Text variant="titleLarge" style={{ fontWeight: '800', marginBottom: Spacing.lg }}>Quick Add Guests</Text>
          <Text style={{ color: Colors.textSecondary, marginBottom: Spacing.md, fontSize: 12 }}>
            Paste names, emails, and phone numbers (one per line or comma-separated)
          </Text>
          <TextInput
            label="Guest Data"
            value={quickAddText}
            onChangeText={setQuickAddText}
            mode="outlined"
            multiline
            numberOfLines={8}
            placeholder="John Doe john@email.com +91-9999999999"
            style={[styles.input, { height: 200 }]}
          />
          <View style={styles.modalActions}>
            <Button mode="text" onPress={() => setShowQuickAddModal(false)}>Cancel</Button>
            <Button mode="contained" onPress={handleQuickAddGuests} loading={quickAdding} disabled={quickAdding}>
              Add {quickAddText.split('\n').filter((l) => l.trim()).length} Guests
            </Button>
          </View>
        </Modal>

        {/* Generate & Send Modal */}
        <Modal
          visible={showSendModal}
          onDismiss={() => setShowSendModal(false)}
          contentContainerStyle={styles.modal}
        >
          <Text variant="titleLarge" style={{ fontWeight: '800', marginBottom: Spacing.lg }}>Generate & Send Invites</Text>
          <Text style={{ color: Colors.textSecondary, marginBottom: Spacing.md, fontSize: 12 }}>
            Send invite links to guests via email or WhatsApp (free, zero cost)
          </Text>

          <Text style={{ fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.sm }}>Delivery Channel</Text>
          <View style={styles.choiceChips}>
            {['email', 'whatsapp', 'both'].map((channel) => (
              <Chip
                key={channel}
                selected={selectedSendChannel === channel}
                onPress={() => setSelectedSendChannel(channel)}
                style={styles.choiceChip}
              >
                {channel === 'both' ? 'Email + WhatsApp' : channel.charAt(0).toUpperCase() + channel.slice(1)}
              </Chip>
            ))}
          </View>

          <Card style={{ marginVertical: Spacing.lg, backgroundColor: '#f0f4ff' }}>
            <Card.Content>
              <Text style={{ fontSize: 12, color: Colors.textSecondary }}>
                ✓ Template: <Text style={{ fontWeight: '700', color: Colors.textPrimary }}>{selectedTemplate?.name}</Text>
                {'\n'}✓ Language: <Text style={{ fontWeight: '700', color: Colors.textPrimary }}>{selectedLanguage === 'te' ? 'Telugu' : 'English'}</Text>
                {'\n'}✓ Tone: <Text style={{ fontWeight: '700', color: Colors.textPrimary }}>{selectedTone}</Text>
              </Text>
            </Card.Content>
          </Card>

          <View style={styles.modalActions}>
            <Button mode="text" onPress={() => setShowSendModal(false)}>Cancel</Button>
            <Button mode="contained" onPress={handleGenerateAndSendInvites} loading={sendingInvites} disabled={sendingInvites}>
              Generate & Send
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

      <FAB
        icon="lightning-bolt"
        style={[styles.fab, { bottom: 80 }]}
        color={Colors.textOnPrimary}
        onPress={() => setShowQuickAddModal(true)}
        label="Quick Add"
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
  templateCanvas: {
    width: '100%',
    height: 150,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  templateCanvasHeader: {
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  templateCanvasBrand: { fontSize: 10, fontWeight: '800' },
  templateCanvasCorner: {
    position: 'absolute',
    top: 34,
    fontSize: 11,
    fontWeight: '800',
  },
  templateCanvasCornerLeft: { left: 10 },
  templateCanvasCornerRight: { right: 10 },
  templateCanvasBody: {
    flex: 1,
    paddingHorizontal: 10,
    paddingTop: 16,
    alignItems: 'center',
  },
  templateCanvasDividerRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  templateCanvasDivider: { height: 1, flex: 1, opacity: 0.65 },
  templateCanvasDividerIcon: { marginHorizontal: 6, fontSize: 10, fontWeight: '800' },
  templateCanvasTitle: { fontSize: 12, fontWeight: '800', textAlign: 'center' },
  templateCanvasBadge: {
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  templateCanvasBadgeText: { fontSize: 9, fontWeight: '700' },
  templateCanvasLineGroup: { width: '100%', alignItems: 'center', marginTop: 12, gap: 6 },
  templateCanvasLine: { height: 3, borderRadius: Radius.full, opacity: 0.35 },
  templateCanvasFooter: {
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  templateCanvasFooterDots: { fontSize: 9, fontWeight: '800', letterSpacing: 1 },
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
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  previewHeaderBand: {
    paddingTop: 12,
    paddingBottom: 10,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
  },
  previewHeaderBrand: { fontSize: 15, fontWeight: '800' },
  previewHeaderSub: { fontSize: 10, marginTop: 2, opacity: 0.95 },
  previewInnerFrame: {
    margin: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  previewOrnament: {
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 8,
  },
  previewDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
  },
  previewDivider: { flex: 1, height: 1, opacity: 0.55 },
  previewDividerIcon: { marginHorizontal: 8, fontSize: 11, fontWeight: '800' },
  previewBadge: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginBottom: 12,
  },
  previewBadgeText: { textAlign: 'center', fontSize: 12, fontWeight: '700' },
  previewDetailBlock: {
    marginTop: 12,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: '#ffffffaa',
  },
  previewDetailLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  previewDetailValue: { marginTop: 2, color: Colors.textPrimary, fontSize: 13 },
  previewFooterBand: {
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewFooterText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },
  previewTitle: { fontWeight: '800', color: Colors.textPrimary, textAlign: 'center', fontSize: 18 },
  previewMeta: { marginTop: 4, color: Colors.textSecondary, textTransform: 'capitalize', textAlign: 'center' },
  previewSalutation: { marginTop: 4, color: Colors.textPrimary, fontWeight: '700', fontSize: 15 },
  previewBody: { marginTop: 8, color: Colors.textPrimary, lineHeight: 22, fontSize: 14 },
  previewHint: { marginTop: 10, color: Colors.textSecondary, fontSize: 12, textAlign: 'center' },
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
