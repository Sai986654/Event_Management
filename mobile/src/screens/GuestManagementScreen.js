import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Alert } from 'react-native';
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
    confirmed: guests.filter((g) => g.rsvpStatus === 'confirmed').length,
    pending: guests.filter((g) => g.rsvpStatus === 'pending' || !g.rsvpStatus).length,
    declined: guests.filter((g) => g.rsvpStatus === 'declined').length,
    checkedIn: guests.filter((g) => g.checkedIn).length,
  };

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
        <Text variant="titleMedium" style={styles.sectionTitle}>Guest List</Text>
        {guests.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Card.Content>
              <Text style={styles.emptyText}>No guests yet. Tap + to add guests!</Text>
            </Card.Content>
          </Card>
        ) : (
          guests.map((guest) => (
            <Card key={guest.id} style={styles.guestCard}>
              <Card.Content>
                <View style={styles.guestRow}>
                  <View style={{ flex: 1 }}>
                    <Text variant="titleSmall" style={styles.guestName}>{guest.name}</Text>
                    {guest.email ? <Text variant="bodySmall" style={styles.guestMeta}>{guest.email}</Text> : null}
                    {guest.phone ? <Text variant="bodySmall" style={styles.guestMeta}>{guest.phone}</Text> : null}
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
  guestRow: { flexDirection: 'row', alignItems: 'center' },
  guestName: { fontWeight: '700', color: Colors.textPrimary },
  guestMeta: { color: Colors.textSecondary, marginTop: 2 },
  guestActions: { alignItems: 'flex-end' },
  actionRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  actionBtn: { marginRight: Spacing.sm },
  modal: {
    backgroundColor: Colors.surface,
    margin: Spacing.lg,
    padding: Spacing.xl,
    borderRadius: Radius.lg,
  },
  input: { marginBottom: Spacing.md },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: Spacing.md },
  fab: { position: 'absolute', right: 16, bottom: 16, backgroundColor: Colors.primary, borderRadius: Radius.lg },
});

export default GuestManagementScreen;
