import React, { useContext, useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, Share, Linking } from 'react-native';
import {
  Text, Card, Chip, Button, Divider, ActivityIndicator, IconButton, TextInput, Portal, Modal, Switch,
} from 'react-native-paper';
import { AuthContext } from '../context/AuthContext';
import { eventService } from '../services/eventService';
import { bookingService } from '../services/bookingService';
import { guestService } from '../services/guestService';
import { formatDate, formatCurrency, getErrorMessage, getPaymentRequirement, getStatusColor } from '../utils/helpers';
import { aiService } from '../services/aiService';
import { Colors, Spacing, Radius } from '../theme';
import LocationPicker from '../components/LocationPicker';
import { paymentService } from '../services/paymentService';

const EventDetailScreen = ({ route, navigation }) => {
  const { eventId } = route.params;
  const { user } = useContext(AuthContext);
  const [event, setEvent] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  // Edit state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);

  // Netlify / Share state
  const [publishingNetlify, setPublishingNetlify] = useState(false);
  const [shareDestinationUrl, setShareDestinationUrl] = useState('');
  const [generatingChecklist, setGeneratingChecklist] = useState(false);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [postEventInsights, setPostEventInsights] = useState(null);

  // Status options
  const statusOptions = ['draft', 'planning', 'confirmed', 'completed', 'cancelled'];

  const load = async () => {
    try {
      const [evtData, bkData, gData] = await Promise.all([
        eventService.getEventById(eventId),
        bookingService.getEventBookings(eventId),
        guestService.getEventGuests(eventId).catch(() => ({ guests: [] })),
      ]);
      const evt = evtData.event || evtData;
      setEvent(evt);
      setBookings(bkData.bookings || []);
      setGuests(gData.guests || []);
      setShareDestinationUrl(evtData.shareDestinationUrl || evt.netlifySiteUrl || '');
    } catch (err) {
      Alert.alert('Error', getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [eventId]);

  const handleDeleteEvent = () => {
    Alert.alert('Delete Event', 'This action cannot be undone. Continue?', [
      { text: 'Cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await eventService.deleteEvent(eventId);
            navigation.goBack();
          } catch (err) {
            Alert.alert('Error', getErrorMessage(err));
          }
        },
      },
    ]);
  };

  const handleStatusChange = (newStatus) => {
    Alert.alert('Change Status', `Change event status to "${newStatus}"?`, [
      { text: 'Cancel' },
      {
        text: 'Confirm',
        onPress: async () => {
          try {
            const res = await eventService.updateEvent(eventId, { status: newStatus });
            setEvent(res.event || res);
          } catch (err) {
            Alert.alert('Error', getErrorMessage(err));
          }
        },
      },
    ]);
  };

  const openEditModal = () => {
    setEditForm({
      title: event.title || '',
      description: event.description || '',
      venue: event.venue || '',
      city: event.city || '',
      guestCount: String(event.guestCount || ''),
      budget: String(event.budget || ''),
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      const payload = {
        title: editForm.title,
        description: editForm.description,
        venue: editForm.venue,
        city: editForm.city,
        guestCount: parseInt(editForm.guestCount) || 0,
        budget: parseFloat(editForm.budget) || 0,
      };
      const res = await eventService.updateEvent(eventId, payload);
      setEvent(res.event || res);
      setShowEditModal(false);
    } catch (err) {
      Alert.alert('Error', getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleBookingAction = (bookingId, status, label) => {
    Alert.alert(label, `Are you sure you want to ${label.toLowerCase()} this booking?`, [
      { text: 'Cancel' },
      {
        text: label,
        style: status === 'cancelled' ? 'destructive' : 'default',
        onPress: async () => {
          try {
            await bookingService.updateBookingStatus(bookingId, status);
            setBookings((prev) => prev.map((b) => (b.id === bookingId ? { ...b, status } : b)));
          } catch (err) {
            const paymentRequirement = getPaymentRequirement(err);
            if (paymentRequirement) {
              try {
                const order = await paymentService.createPaymentOrderFromRequirement(
                  paymentRequirement,
                  `Booking #${paymentRequirement.entityId} confirmation`
                );
                Alert.alert(
                  'Payment Initiated',
                  `Amount: INR ${order.amount}. Complete this payment from the web app, then retry this action.`
                );
                return;
              } catch (paymentErr) {
                Alert.alert('Payment Error', getErrorMessage(paymentErr));
                return;
              }
            }
            Alert.alert('Error', getErrorMessage(err));
          }
        },
      },
    ]);
  };

  const handleShareEvent = async () => {
    try {
      const link = shareDestinationUrl || (event.isPublic && event.slug ? `https://${event.slug}.netlify.app` : '');
      const parts = [
        `🎉 ${event.title}`,
        `📅 ${formatDate(event.date)}`,
        event.venue ? `📍 ${event.venue}${event.city ? `, ${event.city}` : ''}` : '',
        '',
        link ? `View event & RSVP: ${link}` : 'Join us!',
      ].filter(Boolean);
      await Share.share({ message: parts.join('\n'), title: event.title });
    } catch (err) {
      // user cancelled
    }
  };

  const handlePublishNetlify = async () => {
    setPublishingNetlify(true);
    try {
      const res = await eventService.publishNetlifyMicrosite(eventId);
      const evt = res.event || event;
      setEvent(evt);
      setShareDestinationUrl(res.shareDestinationUrl || evt.netlifySiteUrl || '');
      Alert.alert('Success', 'Netlify event microsite published!');
    } catch (err) {
      Alert.alert('Error', getErrorMessage(err));
    } finally {
      setPublishingNetlify(false);
    }
  };

  const handleOpenShareUrl = () => {
    const url = shareDestinationUrl || event.netlifySiteUrl;
    if (url) {
      Linking.openURL(url);
    } else {
      Alert.alert('No Link', 'Publish the Netlify site first or enable public event.');
    }
  };

  const handleCopyShareLink = async () => {
    const url = shareDestinationUrl || event.netlifySiteUrl;
    if (!url) {
      Alert.alert('No Link', 'Publish the Netlify site first.');
      return;
    }
    try {
      const Clipboard = require('react-native').Clipboard || require('@react-native-clipboard/clipboard').default;
      if (Clipboard?.setString) {
        Clipboard.setString(url);
        Alert.alert('Copied', 'Share link copied to clipboard.');
      } else {
        // fallback: use Share
        await Share.share({ message: url });
      }
    } catch {
      await Share.share({ message: url });
    }
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color={Colors.primary} />;
  if (!event) return <Text style={{ textAlign: 'center', marginTop: 40 }}>Event not found</Text>;

  const isOrganizer = user?.role === 'organizer' || user?.role === 'admin';
  const isCustomer = user?.role === 'customer';
  const timeline = event.timeline || [];
  const tasks = event.tasks || [];
  const rsvpConfirmed = guests.filter((g) => g.rsvpStatus === 'confirmed').length;
  const checkedIn = guests.filter((g) => g.checkedIn).length;

  // ── Tab selector ──
  const tabs = [
    { value: 'overview', label: 'Overview' },
    ...(isOrganizer ? [{ value: 'guests', label: `Guests (${guests.length})` }] : []),
    { value: 'vendors', label: `Vendors (${bookings.length})` },
    ...(isOrganizer ? [{ value: 'manage', label: 'Manage' }] : []),
  ];

  return (
    <View style={styles.container}>
      <ScrollView>
        {/* ── Header Card ── */}
        <Card style={styles.heroCard}>
          <Card.Content>
            <View style={styles.headerRow}>
              <Text variant="headlineSmall" style={styles.name} numberOfLines={2}>{event.title}</Text>
              <Chip compact textStyle={styles.statusText} style={[styles.statusChip, { backgroundColor: getStatusColor(event.status) + '22' }]}>
                {event.status}
              </Chip>
            </View>

            {/* Meta info */}
            <View style={styles.metaGrid}>
              <View style={styles.metaItem}><Text style={styles.metaIcon}>📅</Text><Text style={styles.metaText}>{formatDate(event.date)}</Text></View>
              <View style={styles.metaItem}><Text style={styles.metaIcon}>📍</Text><Text style={styles.metaText}>{event.venue}{event.city ? `, ${event.city}` : ''}</Text></View>
              {parseFloat(event.budget) > 0 && <View style={styles.metaItem}><Text style={styles.metaIcon}>💰</Text><Text style={[styles.metaText, { color: Colors.success, fontWeight: '700' }]}>{formatCurrency(event.budget)}</Text></View>}
              {event.guestCount > 0 && <View style={styles.metaItem}><Text style={styles.metaIcon}>👥</Text><Text style={styles.metaText}>{event.guestCount} guests</Text></View>}
              {event.type && <View style={styles.metaItem}><Text style={styles.metaIcon}>🎯</Text><Text style={styles.metaText}>{event.type}</Text></View>}
            </View>
            {event.description ? <Text style={styles.description}>{event.description}</Text> : null}

            {/* Quick action row */}
            <View style={styles.quickActions}>
              {(isOrganizer || isCustomer) && (
                <IconButton icon="pencil" iconColor={Colors.primary} size={20} style={styles.qAction} onPress={openEditModal} />
              )}
              <IconButton icon="share-variant" iconColor={Colors.primary} size={20} style={styles.qAction} onPress={handleShareEvent} />
              {event.isPublic && event.slug && (
                <IconButton icon="link-variant" iconColor={Colors.primary} size={20} style={styles.qAction} onPress={() => navigation.navigate('PublicEvent', { slug: event.slug, eventTitle: event.title })} />
              )}
              {isOrganizer && (
                <IconButton icon="delete-outline" iconColor={Colors.danger} size={20} style={styles.qAction} onPress={handleDeleteEvent} />
              )}
            </View>
          </Card.Content>
        </Card>

        {/* ── Tab Switcher ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll} contentContainerStyle={styles.tabRow}>
          {tabs.map((tab) => (
            <Chip
              key={tab.value}
              selected={activeTab === tab.value}
              onPress={() => setActiveTab(tab.value)}
              style={[styles.tabChip, activeTab === tab.value && styles.tabChipActive]}
              textStyle={[styles.tabChipText, activeTab === tab.value && styles.tabChipTextActive]}
            >
              {tab.label}
            </Chip>
          ))}
        </ScrollView>

        {/* ── Overview Tab ── */}
        {activeTab === 'overview' && (
          <View style={styles.section}>
            {/* Status Change */}
            {isOrganizer && (
              <Card style={styles.card}>
                <Card.Content>
                  <Text variant="titleSmall" style={styles.cardTitle}>Event Status</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {statusOptions.map((s) => (
                      <Chip
                        key={s}
                        selected={event.status === s}
                        onPress={() => event.status !== s && handleStatusChange(s)}
                        style={[styles.statusOption, event.status === s && { backgroundColor: getStatusColor(s) + '33' }]}
                        textStyle={{ textTransform: 'capitalize', fontSize: 12, fontWeight: event.status === s ? '700' : '400' }}
                      >
                        {s}
                      </Chip>
                    ))}
                  </ScrollView>
                </Card.Content>
              </Card>
            )}

            {/* Stats Cards */}
            {isOrganizer && (
              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{guests.length}</Text>
                  <Text style={styles.statLabel}>Guests</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={[styles.statValue, { color: Colors.success }]}>{rsvpConfirmed}</Text>
                  <Text style={styles.statLabel}>RSVP'd</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={[styles.statValue, { color: Colors.primary }]}>{checkedIn}</Text>
                  <Text style={styles.statLabel}>Checked In</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={[styles.statValue, { color: Colors.warning }]}>{bookings.length}</Text>
                  <Text style={styles.statLabel}>Vendors</Text>
                </View>
              </View>
            )}

            {/* Timeline */}
            {timeline.length > 0 && (
              <Card style={styles.card}>
                <Card.Content>
                  <Text variant="titleSmall" style={styles.cardTitle}>Timeline</Text>
                  {timeline.map((item, i) => (
                    <View key={i} style={styles.timelineItem}>
                      <View style={styles.timelineDot} />
                      <View style={styles.timelineContent}>
                        <Text style={styles.timelineTime}>{item.time}</Text>
                        <Text style={styles.timelineActivity}>{item.activity}</Text>
                      </View>
                    </View>
                  ))}
                </Card.Content>
              </Card>
            )}

            {/* Tasks */}
            {tasks.length > 0 && (
              <Card style={styles.card}>
                <Card.Content>
                  <Text variant="titleSmall" style={styles.cardTitle}>Tasks</Text>
                  {tasks.map((task, i) => (
                    <View key={i} style={styles.taskRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: '600', color: Colors.textPrimary }}>{task.title}</Text>
                        {task.assignee && <Text style={{ fontSize: 12, color: Colors.textSecondary }}>→ {task.assignee}</Text>}
                      </View>
                      <Chip compact textStyle={{ fontSize: 10 }} style={{ backgroundColor: getStatusColor(task.status) + '22' }}>{task.status}</Chip>
                    </View>
                  ))}
                </Card.Content>
              </Card>
            )}

            {/* Details Table */}
            <Card style={styles.card}>
              <Card.Content>
                <Text variant="titleSmall" style={styles.cardTitle}>Details</Text>
                {[
                  ['Type', event.type],
                  ['Date', formatDate(event.date)],
                  ['Location', [event.venue, event.city, event.state].filter(Boolean).join(', ') || '—'],
                  ['Budget', formatCurrency(event.budget)],
                  ['Guest Count', event.guestCount],
                  ['Status', event.status],
                ].map(([label, value], i) => (
                  <View key={i} style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{label}</Text>
                    <Text style={styles.detailValue}>{value || '—'}</Text>
                  </View>
                ))}
              </Card.Content>
            </Card>
          </View>
        )}

        {/* ── Guests Tab ── */}
        {activeTab === 'guests' && isOrganizer && (
          <View style={styles.section}>
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{guests.length}</Text>
                <Text style={styles.statLabel}>Total</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statValue, { color: Colors.success }]}>{rsvpConfirmed}</Text>
                <Text style={styles.statLabel}>Confirmed</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statValue, { color: Colors.primary }]}>{checkedIn}</Text>
                <Text style={styles.statLabel}>Checked In</Text>
              </View>
            </View>

            {guests.length === 0 ? (
              <Card style={styles.card}><Card.Content><Text style={styles.emptyText}>No guests added yet.</Text></Card.Content></Card>
            ) : (
              guests.map((g) => (
                <Card key={g.id} style={styles.card}>
                  <Card.Content style={styles.guestRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '700', color: Colors.textPrimary }}>{g.name}</Text>
                      {g.phone && <Text style={{ fontSize: 12, color: Colors.textSecondary }}>{g.phone}</Text>}
                      {g.email && <Text style={{ fontSize: 12, color: Colors.textSecondary }}>{g.email}</Text>}
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <Chip compact textStyle={{ fontSize: 10 }} style={{ backgroundColor: getStatusColor(g.rsvpStatus || 'pending') + '22' }}>
                        {g.rsvpStatus || 'pending'}
                      </Chip>
                      {g.checkedIn && <Chip compact icon="check" textStyle={{ fontSize: 10, color: Colors.success }}>In</Chip>}
                    </View>
                  </Card.Content>
                </Card>
              ))
            )}

            <Button mode="contained" icon="account-group" style={styles.fullBtn} onPress={() => navigation.navigate('GuestManagement', { eventId })}>
              Full Guest Management
            </Button>
          </View>
        )}

        {/* ── Vendors Tab ── */}
        {activeTab === 'vendors' && (
          <View style={styles.section}>
            {bookings.length === 0 ? (
              <Card style={styles.card}><Card.Content><Text style={styles.emptyText}>No vendors booked yet.</Text></Card.Content></Card>
            ) : (
              bookings.map((bk) => (
                <Card key={bk.id} style={styles.card}>
                  <Card.Content>
                    <View style={styles.guestRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: '700', color: Colors.textPrimary }}>{bk.vendor?.businessName || 'Vendor'}</Text>
                        <Text style={{ fontSize: 12, color: Colors.textSecondary }}>
                          {bk.vendor?.category || '—'} • {formatDate(bk.serviceDate)}
                        </Text>
                        <Text style={{ fontSize: 13, color: Colors.success, fontWeight: '600', marginTop: 2 }}>
                          {formatCurrency(bk.price)}
                        </Text>
                      </View>
                      <Chip compact textStyle={{ color: '#fff', fontSize: 11 }} style={{ backgroundColor: getStatusColor(bk.status) }}>{bk.status}</Chip>
                    </View>

                    {/* Booking Actions */}
                    {isOrganizer && (
                      <View style={styles.bookingActions}>
                        {bk.status === 'pending' && (
                          <Button compact mode="contained" style={styles.confirmBtn} labelStyle={{ fontSize: 11 }} onPress={() => handleBookingAction(bk.id, 'confirmed', 'Confirm')}>
                            Confirm
                          </Button>
                        )}
                        {bk.status === 'confirmed' && (
                          <Button compact mode="contained-tonal" labelStyle={{ fontSize: 11 }} onPress={() => handleBookingAction(bk.id, 'completed', 'Complete')}>
                            Complete
                          </Button>
                        )}
                        {(bk.status === 'pending' || bk.status === 'confirmed') && (
                          <Button compact mode="outlined" textColor={Colors.danger} labelStyle={{ fontSize: 11 }} onPress={() => handleBookingAction(bk.id, 'cancelled', 'Cancel')}>
                            Cancel
                          </Button>
                        )}
                      </View>
                    )}
                  </Card.Content>
                </Card>
              ))
            )}

            <Button mode="contained" icon="store" style={styles.fullBtn} onPress={() => navigation.navigate('VendorsTab')}>
              Browse Vendors
            </Button>
          </View>
        )}

        {/* ── Manage Tab ── */}
        {activeTab === 'manage' && isOrganizer && (
          <View style={styles.section}>
            <Card style={styles.card}>
              <Card.Content>
                <Text variant="titleSmall" style={styles.cardTitle}>Quick Actions</Text>
                <Button mode="contained-tonal" icon="account-group" style={styles.manageBtn} onPress={() => navigation.navigate('GuestManagement', { eventId })}>
                  Guest Management
                </Button>
                <Button mode="contained-tonal" icon="cash-multiple" style={styles.manageBtn} onPress={() => navigation.navigate('BudgetDashboard', { eventId })}>
                  Budget Dashboard
                </Button>
                <Button mode="contained-tonal" icon="chart-timeline-variant" style={styles.manageBtn} onPress={() => navigation.navigate('ActivityTracker')}>
                  Activity Tracker
                </Button>
                <Button mode="contained-tonal" icon="clipboard-check-outline" style={styles.manageBtn} loading={generatingChecklist} onPress={async () => {
                  setGeneratingChecklist(true);
                  try {
                    const res = await aiService.generateChecklist(eventId);
                    Alert.alert('AI Checklist', `Generated ${res.taskCount} tasks (${res.source}). Refresh to see them.`);
                    load();
                  } catch (err) { Alert.alert('Error', getErrorMessage(err)); }
                  finally { setGeneratingChecklist(false); }
                }}>
                  AI Checklist
                </Button>
                <Button mode="contained-tonal" icon="lightbulb-on-outline" style={styles.manageBtn} loading={loadingInsights} onPress={async () => {
                  setLoadingInsights(true);
                  try {
                    const res = await aiService.getPostEventInsights(eventId);
                    setPostEventInsights(res);
                    const msg = `${res.overallSummary}\n\nAttendance: ${res.attendanceInsight}\n\nBudget: ${res.budgetInsight}`;
                    Alert.alert('Post-Event Insights', msg);
                  } catch (err) { Alert.alert('Error', getErrorMessage(err)); }
                  finally { setLoadingInsights(false); }
                }}>
                  Post-Event Insights
                </Button>
                <Button mode="contained-tonal" icon="video-wireless-outline" style={styles.manageBtn} onPress={() => navigation.navigate('InviteVideos', { eventId, eventTitle: event.title, eventType: event.type })}>
                  Invite Videos
                </Button>
                <Button mode="contained-tonal" icon="brush-variant" style={styles.manageBtn} onPress={() => navigation.navigate('InviteDesignStudio', { eventId, eventTitle: event.title })}>
                  Invite Studio
                </Button>
              </Card.Content>
            </Card>

            {/* Netlify Microsite */}
            <Card style={styles.card}>
              <Card.Content>
                <Text variant="titleSmall" style={styles.cardTitle}>Event Microsite</Text>
                {event.netlifySiteUrl ? (
                  <View style={styles.netlifyInfo}>
                    <IconButton icon="web" iconColor={Colors.success} size={20} style={{ margin: 0 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, color: Colors.success, fontWeight: '600' }}>Published</Text>
                      <Text style={{ fontSize: 11, color: Colors.textSecondary }} numberOfLines={1}>{event.netlifySiteUrl}</Text>
                    </View>
                  </View>
                ) : (
                  <Text style={{ color: Colors.textMuted, fontSize: 12, marginBottom: Spacing.sm }}>No microsite published yet.</Text>
                )}
                <Button
                  mode="contained"
                  icon="rocket-launch"
                  style={[styles.manageBtn, { backgroundColor: Colors.primary }]}
                  loading={publishingNetlify}
                  disabled={publishingNetlify}
                  onPress={handlePublishNetlify}
                >
                  {event.netlifySiteUrl ? 'Update Netlify Site' : 'Publish Netlify Site'}
                </Button>
              </Card.Content>
            </Card>

            {/* Share & Links */}
            <Card style={styles.card}>
              <Card.Content>
                <Text variant="titleSmall" style={styles.cardTitle}>Share & Links</Text>
                {shareDestinationUrl ? (
                  <View style={styles.netlifyInfo}>
                    <IconButton icon="link-variant" iconColor={Colors.primary} size={18} style={{ margin: 0 }} />
                    <Text style={{ flex: 1, fontSize: 12, color: Colors.primary }} numberOfLines={1}>{shareDestinationUrl}</Text>
                  </View>
                ) : null}
                <Button mode="contained-tonal" icon="content-copy" style={styles.manageBtn} onPress={handleCopyShareLink} disabled={!shareDestinationUrl && !event.netlifySiteUrl}>
                  Copy Share Link
                </Button>
                <Button mode="contained-tonal" icon="open-in-new" style={styles.manageBtn} onPress={handleOpenShareUrl} disabled={!shareDestinationUrl && !event.netlifySiteUrl}>
                  Open Share Destination
                </Button>
                {event.isPublic && event.slug && (
                  <Button mode="contained-tonal" icon="eye-outline" style={styles.manageBtn} onPress={() => navigation.navigate('PublicEvent', { slug: event.slug, eventTitle: event.title })}>
                    View Public Invite Page
                  </Button>
                )}
                <Button mode="contained-tonal" icon="share-variant" style={styles.manageBtn} onPress={handleShareEvent}>
                  Share with Guests
                </Button>
              </Card.Content>
            </Card>

            {/* Danger Zone */}
            <Card style={[styles.card, { borderColor: Colors.danger + '33', borderWidth: 1 }]}>
              <Card.Content>
                <Text variant="titleSmall" style={[styles.cardTitle, { color: Colors.danger }]}>Danger Zone</Text>
                <Button mode="outlined" textColor={Colors.danger} icon="delete" onPress={handleDeleteEvent}>
                  Delete Event
                </Button>
              </Card.Content>
            </Card>
          </View>
        )}

        <View style={{ height: 30 }} />
      </ScrollView>

      {/* ── Edit Event Modal ── */}
      <Portal>
        <Modal visible={showEditModal} onDismiss={() => setShowEditModal(false)} contentContainerStyle={styles.modal}>
          <ScrollView>
            <Text variant="titleLarge" style={{ fontWeight: '800', marginBottom: Spacing.lg }}>Edit Event</Text>
            <TextInput label="Title" value={editForm.title} onChangeText={(v) => setEditForm((p) => ({ ...p, title: v }))} mode="outlined" style={styles.input} />
            <TextInput label="Description" value={editForm.description} onChangeText={(v) => setEditForm((p) => ({ ...p, description: v }))} mode="outlined" multiline numberOfLines={3} style={styles.input} />
            <LocationPicker label="Venue" value={editForm.venue} onChange={(v) => setEditForm((p) => ({ ...p, venue: v }))} onLocationPick={(loc) => setEditForm((p) => ({ ...p, venue: loc.name || loc.formattedAddress, city: loc.city || p.city }))} placeholder="Search venue..." />
            <TextInput label="City" value={editForm.city} onChangeText={(v) => setEditForm((p) => ({ ...p, city: v }))} mode="outlined" style={styles.input} placeholder="Auto-filled from venue" />
            <TextInput label="Guest Count" value={editForm.guestCount} onChangeText={(v) => setEditForm((p) => ({ ...p, guestCount: v.replace(/[^0-9]/g, '') }))} mode="outlined" keyboardType="numeric" style={styles.input} />
            <TextInput label="Budget (₹)" value={editForm.budget} onChangeText={(v) => setEditForm((p) => ({ ...p, budget: v.replace(/[^0-9.]/g, '') }))} mode="outlined" keyboardType="numeric" style={styles.input} />
            <View style={styles.modalActions}>
              <Button mode="text" onPress={() => setShowEditModal(false)}>Cancel</Button>
              <Button mode="contained" onPress={handleSaveEdit} loading={saving} disabled={saving}>Save</Button>
            </View>
          </ScrollView>
        </Modal>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  heroCard: { margin: Spacing.md, borderRadius: Radius.lg, elevation: 3, backgroundColor: Colors.surface },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  name: { fontWeight: '800', flex: 1, marginRight: Spacing.sm, color: Colors.textPrimary },
  statusChip: { borderRadius: Radius.sm },
  statusText: { fontSize: 11, fontWeight: '600' },
  metaGrid: { marginTop: Spacing.md },
  metaItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  metaIcon: { fontSize: 14, marginRight: 8, width: 20 },
  metaText: { fontSize: 13, color: Colors.textSecondary },
  description: { marginTop: Spacing.md, lineHeight: 22, color: Colors.textPrimary, fontSize: 14 },
  quickActions: { flexDirection: 'row', marginTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.divider, paddingTop: Spacing.sm },
  qAction: { margin: 0, backgroundColor: Colors.surfaceVariant, borderRadius: Radius.sm, marginRight: Spacing.sm },

  /* Tabs */
  tabScroll: { marginBottom: Spacing.sm },
  tabRow: { paddingHorizontal: Spacing.md },
  tabChip: { marginRight: Spacing.sm, backgroundColor: Colors.surface, borderRadius: Radius.full },
  tabChipActive: { backgroundColor: Colors.primary },
  tabChipText: { color: Colors.textSecondary, fontWeight: '600' },
  tabChipTextActive: { color: Colors.textOnPrimary },

  /* Section / Cards */
  section: { paddingHorizontal: Spacing.md },
  card: { marginBottom: Spacing.sm, borderRadius: Radius.lg, elevation: 1, backgroundColor: Colors.surface },
  cardTitle: { fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.sm },

  /* Stats */
  statsRow: { flexDirection: 'row', marginBottom: Spacing.sm },
  statCard: { flex: 1, marginHorizontal: 3, backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.sm, alignItems: 'center', elevation: 1 },
  statValue: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  statLabel: { fontSize: 10, color: Colors.textSecondary, fontWeight: '600', marginTop: 2 },

  /* Status selector */
  statusOption: { marginRight: Spacing.xs },

  /* Timeline */
  timelineItem: { flexDirection: 'row', marginBottom: Spacing.md, alignItems: 'flex-start' },
  timelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary, marginTop: 5, marginRight: Spacing.md },
  timelineContent: { flex: 1 },
  timelineTime: { color: Colors.primary, fontWeight: '700', fontSize: 12 },
  timelineActivity: { color: Colors.textPrimary, marginTop: 2, fontSize: 13 },

  /* Tasks */
  taskRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.xs, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.divider },

  /* Details */
  detailRow: { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.divider },
  detailLabel: { width: 100, fontSize: 12, fontWeight: '600', color: Colors.textMuted },
  detailValue: { flex: 1, fontSize: 13, color: Colors.textPrimary },

  /* Guest / Vendor rows */
  guestRow: { flexDirection: 'row', alignItems: 'center' },
  emptyText: { textAlign: 'center', color: Colors.textMuted, paddingVertical: Spacing.lg },

  /* Booking actions */
  bookingActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.divider, paddingTop: Spacing.sm },
  confirmBtn: { backgroundColor: Colors.success, borderRadius: Radius.sm },

  /* Manage */
  manageBtn: { marginBottom: Spacing.sm, borderRadius: Radius.sm },
  fullBtn: { marginTop: Spacing.sm, backgroundColor: Colors.primary, borderRadius: Radius.sm },
  netlifyInfo: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.sm, backgroundColor: Colors.surfaceVariant, borderRadius: Radius.sm, padding: Spacing.sm },

  /* Modal */
  modal: { backgroundColor: Colors.surface, margin: Spacing.lg, padding: Spacing.xl, borderRadius: Radius.lg, maxHeight: '85%' },
  input: { marginBottom: Spacing.md },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: Spacing.md },
});

export default EventDetailScreen;
