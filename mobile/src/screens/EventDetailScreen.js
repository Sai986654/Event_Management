import React, { useContext, useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Card, Chip, Button, Divider, ActivityIndicator } from 'react-native-paper';
import { AuthContext } from '../context/AuthContext';
import { eventService } from '../services/eventService';
import { bookingService } from '../services/bookingService';
import { formatDate, formatCurrency, getErrorMessage, getStatusColor } from '../utils/helpers';

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
        text: 'Delete', style: 'destructive', onPress: async () => {
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

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" />;
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
          <Chip compact style={{ backgroundColor: getStatusColor(event.status) + '22' }}>{event.status}</Chip>
        </View>
        <Text variant="bodySmall" style={styles.meta}>📅 {formatDate(event.date)}</Text>
        <Text variant="bodySmall" style={styles.meta}>📍 {event.venue}{event.city ? `, ${event.city}` : ''}</Text>
        {event.budget > 0 && <Text variant="bodySmall" style={styles.meta}>💰 {formatCurrency(event.budget)}</Text>}
        {event.guestCount > 0 && <Text variant="bodySmall" style={styles.meta}>👥 {event.guestCount} guests</Text>}
        {event.description && <Text variant="bodyMedium" style={styles.description}>{event.description}</Text>}
      </View>

      <Divider />

      {/* Timeline */}
      {timeline.length > 0 && (
        <View style={styles.section}>
          <Text variant="titleMedium" style={styles.sectionTitle}>Timeline</Text>
          {timeline.map((item, i) => (
            <View key={i} style={styles.timelineItem}>
              <Text variant="titleSmall" style={styles.timelineTime}>{item.time}</Text>
              <Text variant="bodyMedium">{item.activity}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Tasks (organizer/admin only) */}
      {isOrganizer && tasks.length > 0 && (
        <View style={styles.section}>
          <Text variant="titleMedium" style={styles.sectionTitle}>Tasks</Text>
          {tasks.map((task, i) => (
            <Card key={i} style={styles.taskCard}>
              <Card.Content style={styles.taskRow}>
                <View style={{ flex: 1 }}>
                  <Text variant="bodyMedium">{task.title}</Text>
                  {task.assignee && <Text variant="bodySmall" style={{ color: '#888' }}>Assigned to: {task.assignee}</Text>}
                </View>
                <Chip compact style={{ backgroundColor: getStatusColor(task.status) + '22' }}>
                  {task.status}
                </Chip>
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
                  <Text variant="titleSmall">{bk.vendor?.businessName || 'Vendor'}</Text>
                  <Text variant="bodySmall" style={{ color: '#666' }}>
                    {formatDate(bk.serviceDate)} • {formatCurrency(bk.price)}
                  </Text>
                </View>
                <Chip compact textStyle={{ color: '#fff', fontSize: 11 }} style={{ backgroundColor: getStatusColor(bk.status) }}>
                  {bk.status}
                </Chip>
              </Card.Content>
            </Card>
          ))}
        </View>
      )}

      {event.isPublic && event.slug ? (
        <View style={styles.section}>
          <Button
            mode="contained-tonal"
            icon="link-variant"
            onPress={() =>
              navigation.navigate('PublicEvent', { slug: event.slug, eventTitle: event.title })
            }
          >
            Public invite (guest view)
          </Button>
        </View>
      ) : null}

      {/* Actions */}
      <View style={styles.section}>
        <Button
          mode="contained"
          style={styles.vendorBtn}
          onPress={() => navigation.navigate('VendorsTab')}
        >
          Browse Vendors
        </Button>
        {(user?.role === 'organizer' || user?.role === 'customer' || user?.role === 'admin') && (
          <Button
            mode="outlined"
            textColor="#ff4d4f"
            style={styles.deleteBtn}
            onPress={handleDeleteEvent}
          >
            Delete Event
          </Button>
        )}
      </View>

      <View style={{ height: 30 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { padding: 16, backgroundColor: '#fff' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontWeight: 'bold', flex: 1, marginRight: 8 },
  meta: { color: '#666', marginTop: 4 },
  description: { marginTop: 12, lineHeight: 22 },
  section: { padding: 16 },
  sectionTitle: { fontWeight: 'bold', marginBottom: 12 },
  timelineItem: { flexDirection: 'row', marginBottom: 10, alignItems: 'center' },
  timelineTime: { width: 60, color: '#667eea', fontWeight: 'bold' },
  taskCard: { marginBottom: 8, borderRadius: 8, elevation: 1 },
  taskRow: { flexDirection: 'row', alignItems: 'center' },
  vendorBtn: { backgroundColor: '#667eea', borderRadius: 8, marginBottom: 12 },
  deleteBtn: { borderColor: '#ff4d4f', borderRadius: 8 },
});

export default EventDetailScreen;
