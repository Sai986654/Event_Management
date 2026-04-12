import React, { useContext, useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Card, Chip, Button, Divider, ActivityIndicator } from 'react-native-paper';
import { AuthContext } from '../context/AuthContext';
import { eventService } from '../services/eventService';
import { bookingService } from '../services/bookingService';
import { formatDate, formatCurrency, getErrorMessage, getStatusColor } from '../utils/helpers';
import { Colors, Spacing, Radius } from '../theme';

const EventDetailScreen = ({ route, navigation }) => {
  const { eventId } = route.params;
  const { user } = useContext(AuthContext);
  const [event, setEvent] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [evtData, bkData] = await Promise.all([
          eventService.getEventById(eventId),
          bookingService.getEventBookings(eventId),
        ]);
        setEvent(evtData.event || evtData);
        setBookings(bkData.bookings || []);
      } catch (err) {
        Alert.alert('Error', getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [eventId]);

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

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color={Colors.primary} />;
  if (!event) return <Text style={{ textAlign: 'center', marginTop: 40 }}>Event not found</Text>;

  const timeline = event.timeline || [];
  const tasks = event.tasks || [];
  const isOrganizer = user?.role === 'organizer' || user?.role === 'admin';

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text variant="headlineSmall" style={styles.name}>{event.title}</Text>
          <Chip compact textStyle={{ fontSize: 11, fontWeight: '600' }} style={{ backgroundColor: getStatusColor(event.status) + '22' }}>{event.status}</Chip>
        </View>
        <View style={styles.metaGrid}>
          <Text variant="bodySmall" style={styles.metaItem}>📅 {formatDate(event.date)}</Text>
          <Text variant="bodySmall" style={styles.metaItem}>📍 {event.venue}{event.city ? `, ${event.city}` : ''}</Text>
          {event.budget > 0 && <Text variant="bodySmall" style={styles.metaItem}>💰 {formatCurrency(event.budget)}</Text>}
          {event.guestCount > 0 && <Text variant="bodySmall" style={styles.metaItem}>👥 {event.guestCount} guests</Text>}
        </View>
        {event.description && <Text variant="bodyMedium" style={styles.description}>{event.description}</Text>}
      </View>

      <Divider />

      {/* Timeline */}
      {timeline.length > 0 && (
        <View style={styles.section}>
          <Text variant="titleMedium" style={styles.sectionTitle}>Timeline</Text>
          {timeline.map((item, i) => (
            <View key={i} style={styles.timelineItem}>
              <View style={styles.timelineDot} />
              <View style={styles.timelineContent}>
                <Text variant="labelMedium" style={styles.timelineTime}>{item.time}</Text>
                <Text variant="bodyMedium" style={styles.timelineActivity}>{item.activity}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Tasks */}
      {isOrganizer && tasks.length > 0 && (
        <View style={styles.section}>
          <Text variant="titleMedium" style={styles.sectionTitle}>Tasks</Text>
          {tasks.map((task, i) => (
            <Card key={i} style={styles.taskCard}>
              <Card.Content style={styles.taskRow}>
                <View style={{ flex: 1 }}>
                  <Text variant="bodyMedium" style={{ fontWeight: '600' }}>{task.title}</Text>
                  {task.assignee && <Text variant="bodySmall" style={{ color: Colors.textSecondary }}>Assigned to: {task.assignee}</Text>}
                </View>
                <Chip compact style={{ backgroundColor: getStatusColor(task.status) + '22' }}>{task.status}</Chip>
              </Card.Content>
            </Card>
          ))}
        </View>
      )}

      {/* Booked Vendors */}
      {bookings.length > 0 && (
        <View style={styles.section}>
          <Text variant="titleMedium" style={styles.sectionTitle}>Booked Vendors</Text>
          {bookings.map((bk) => (
            <Card key={bk.id} style={styles.taskCard}>
              <Card.Content style={styles.taskRow}>
                <View style={{ flex: 1 }}>
                  <Text variant="titleSmall" style={{ fontWeight: '600' }}>{bk.vendor?.businessName || 'Vendor'}</Text>
                  <Text variant="bodySmall" style={{ color: Colors.textSecondary }}>{formatDate(bk.serviceDate)} • {formatCurrency(bk.price)}</Text>
                </View>
                <Chip compact textStyle={{ color: '#fff', fontSize: 11 }} style={{ backgroundColor: getStatusColor(bk.status) }}>{bk.status}</Chip>
              </Card.Content>
            </Card>
          ))}
        </View>
      )}

      {/* Public Event Link */}
      {event.isPublic && event.slug ? (
        <View style={styles.section}>
          <Button mode="contained-tonal" icon="link-variant" onPress={() => navigation.navigate('PublicEvent', { slug: event.slug, eventTitle: event.title })}>
            Public invite (guest view)
          </Button>
        </View>
      ) : null}

      {/* Actions */}
      <View style={styles.section}>
        <Button mode="contained" style={styles.vendorBtn} labelStyle={{ fontWeight: '600' }} onPress={() => navigation.navigate('VendorsTab')}>Browse Vendors</Button>
        {(user?.role === 'organizer' || user?.role === 'customer' || user?.role === 'admin') && (
          <Button mode="outlined" textColor={Colors.danger} style={styles.deleteBtn} onPress={handleDeleteEvent}>Delete Event</Button>
        )}
      </View>

      <View style={{ height: 30 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { padding: Spacing.lg, backgroundColor: Colors.surface },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontWeight: '800', flex: 1, marginRight: Spacing.sm, color: Colors.textPrimary },
  metaGrid: { marginTop: Spacing.sm },
  metaItem: { color: Colors.textSecondary, marginTop: 4 },
  description: { marginTop: Spacing.md, lineHeight: 22, color: Colors.textPrimary },
  section: { padding: Spacing.lg },
  sectionTitle: { fontWeight: '700', marginBottom: Spacing.md, color: Colors.textPrimary },
  timelineItem: { flexDirection: 'row', marginBottom: Spacing.md, alignItems: 'flex-start' },
  timelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary, marginTop: 5, marginRight: Spacing.md },
  timelineContent: { flex: 1 },
  timelineTime: { color: Colors.primary, fontWeight: '700' },
  timelineActivity: { color: Colors.textPrimary, marginTop: 2 },
  taskCard: { marginBottom: Spacing.sm, borderRadius: Radius.sm, elevation: 1, backgroundColor: Colors.surface },
  taskRow: { flexDirection: 'row', alignItems: 'center' },
  vendorBtn: { backgroundColor: Colors.primary, borderRadius: Radius.sm, marginBottom: Spacing.md },
  deleteBtn: { borderColor: Colors.danger, borderRadius: Radius.sm },
});

export default EventDetailScreen;
