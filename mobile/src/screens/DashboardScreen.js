import React, { useContext, useEffect, useState, useCallback, useLayoutEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Text, Card, Button, Chip, FAB, ActivityIndicator, IconButton } from 'react-native-paper';
import { AuthContext } from '../context/AuthContext';
import { eventService } from '../services/eventService';
import { bookingService } from '../services/bookingService';
import { formatDate, formatCurrency, getErrorMessage, getStatusColor } from '../utils/helpers';

/* ─── Organizer / Admin / Customer dashboard ─── */
const EventsDashboard = ({ user, navigation }) => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchEvents = useCallback(async () => {
    try {
      const data = await eventService.getEvents({ limit: 10 });
      setEvents(data.events || []);
    } catch (err) {
      console.warn(getErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const upcoming = events.filter((e) => new Date(e.date) > new Date()).length;
  const totalBudget = events.reduce((s, e) => s + (e.budget || 0), 0);

  if (loading) return <ActivityIndicator style={styles.loader} size="large" />;

  return (
    <View style={styles.container}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchEvents(); }} />}
      >
        <Card style={styles.heroCard}>
          <Card.Content>
            <Text variant="headlineSmall" style={styles.greeting}>Welcome, {user?.name}! 👋</Text>
            <Text variant="bodySmall" style={styles.heroSubtext}>Track budgets, orders, and execution in one place.</Text>
          </Card.Content>
        </Card>

        {/* Stats row */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statsRow}>
          <Card style={[styles.statCard, styles.statCardPrimary]}><Card.Content>
            <Text variant="bodySmall" style={styles.statLabel}>Events</Text>
            <Text variant="headlineMedium" style={styles.statValue}>{events.length}</Text>
          </Card.Content></Card>
          <Card style={styles.statCard}><Card.Content>
            <Text variant="bodySmall" style={styles.statLabel}>Upcoming</Text>
            <Text variant="headlineMedium" style={[styles.statValue, { color: '#667eea' }]}>{upcoming}</Text>
          </Card.Content></Card>
          <Card style={styles.statCard}><Card.Content>
            <Text variant="bodySmall" style={styles.statLabel}>Total Budget</Text>
            <Text variant="headlineMedium" style={[styles.statValue, { color: '#52c41a' }]}>{formatCurrency(totalBudget)}</Text>
          </Card.Content></Card>
        </ScrollView>

        {/* Event list */}
        <Text variant="titleMedium" style={styles.sectionTitle}>Your Events</Text>
        {events.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Card.Content>
              <Text style={styles.emptyText}>No events yet. Tap + to create your first event!</Text>
            </Card.Content>
          </Card>
        ) : (
          events.map((event) => (
            <Card
              key={event.id}
              style={styles.eventCard}
              onPress={() => navigation.navigate('EventDetail', { eventId: event.id })}
            >
              <Card.Content>
                <View style={styles.eventRow}>
                  <Text variant="titleMedium" numberOfLines={1} style={styles.eventTitle}>{event.title}</Text>
                  <Chip compact textStyle={{ fontSize: 11 }} style={{ backgroundColor: getStatusColor(event.status) + '22' }}>
                    {event.status}
                  </Chip>
                </View>
                <Text variant="bodySmall" style={styles.eventMeta}>
                  📅 {formatDate(event.date)}  •  📍 {event.venue || event.location}
                </Text>
                {event.budget ? (
                  <Text variant="bodySmall" style={styles.eventBudget}>💰 {formatCurrency(event.budget)}</Text>
                ) : null}
              </Card.Content>
            </Card>
          ))
        )}
        {(user?.role === 'customer' || user?.role === 'admin') && (
          <Card style={styles.actionCard} onPress={() => navigation.navigate('Planner')}>
            <Card.Content>
              <Text variant="titleMedium">Plan Event End-to-End</Text>
              <Text variant="bodySmall" style={styles.eventMeta}>Build quotation and place order</Text>
            </Card.Content>
          </Card>
        )}
        {(user?.role === 'organizer' || user?.role === 'admin') && (
          <Card style={styles.actionCard} onPress={() => navigation.navigate('ActivityTracker')}>
            <Card.Content>
              <Text variant="titleMedium">Update Activity Progress</Text>
              <Text variant="bodySmall" style={styles.eventMeta}>Track spend and progress transparently</Text>
            </Card.Content>
          </Card>
        )}
        {(user?.role === 'organizer' || user?.role === 'admin') && (
          <Card style={styles.actionCard} onPress={() => navigation.navigate('InviteIntelligence')}>
            <Card.Content>
              <Text variant="titleMedium">Invite Intelligence</Text>
              <Text variant="bodySmall" style={styles.eventMeta}>Contact segments, WhatsApp reminders, AI collage</Text>
            </Card.Content>
          </Card>
        )}
        {user?.role === 'admin' && (
          <Card style={styles.actionCard} onPress={() => navigation.navigate('AdminControl')}>
            <Card.Content>
              <Text variant="titleMedium">Admin Control Center</Text>
              <Text variant="bodySmall" style={styles.eventMeta}>Verify vendors and create users</Text>
            </Card.Content>
          </Card>
        )}
        <View style={{ height: 80 }} />
      </ScrollView>

      {(user?.role === 'organizer' || user?.role === 'customer' || user?.role === 'admin') && (
        <FAB
          icon="plus"
          style={styles.fab}
          onPress={() => navigation.navigate('EventCreate')}
          label="New Event"
        />
      )}
    </View>
  );
};

/* ─── Vendor dashboard ─── */
const VendorDashboard = ({ user, navigation }) => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBookings = useCallback(async () => {
    try {
      const data = await bookingService.getBookings();
      setBookings(data.bookings || []);
    } catch (err) {
      console.warn(getErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  const pending = bookings.filter((b) => b.status === 'pending').length;
  const confirmed = bookings.filter((b) => b.status === 'confirmed').length;
  const revenue = bookings
    .filter((b) => b.status === 'confirmed' || b.status === 'completed')
    .reduce((s, b) => s + (b.price || 0), 0);

  if (loading) return <ActivityIndicator style={styles.loader} size="large" />;

  return (
    <View style={styles.container}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchBookings(); }} />}
      >
        <Card style={styles.heroCard}>
          <Card.Content>
            <Text variant="headlineSmall" style={styles.greeting}>Welcome, {user?.name}! 👋</Text>
            <Text variant="bodySmall" style={styles.heroSubtext}>Stay updated on bookings and business performance.</Text>
          </Card.Content>
        </Card>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statsRow}>
          <Card style={styles.statCard}><Card.Content>
            <Text variant="bodySmall" style={styles.statLabel}>Total</Text>
            <Text variant="headlineMedium" style={styles.statValue}>{bookings.length}</Text>
          </Card.Content></Card>
          <Card style={styles.statCard}><Card.Content>
            <Text variant="bodySmall" style={styles.statLabel}>Pending</Text>
            <Text variant="headlineMedium" style={[styles.statValue, { color: '#fa8c16' }]}>{pending}</Text>
          </Card.Content></Card>
          <Card style={styles.statCard}><Card.Content>
            <Text variant="bodySmall" style={styles.statLabel}>Confirmed</Text>
            <Text variant="headlineMedium" style={[styles.statValue, { color: '#52c41a' }]}>{confirmed}</Text>
          </Card.Content></Card>
          <Card style={styles.statCard}><Card.Content>
            <Text variant="bodySmall" style={styles.statLabel}>Revenue</Text>
            <Text variant="headlineMedium" style={[styles.statValue, { color: '#52c41a' }]}>{formatCurrency(revenue)}</Text>
          </Card.Content></Card>
        </ScrollView>

        <Text variant="titleMedium" style={styles.sectionTitle}>Recent Bookings</Text>
        {bookings.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Card.Content>
              <Text style={styles.emptyText}>No bookings yet. Customers will find you on the marketplace!</Text>
            </Card.Content>
          </Card>
        ) : (
          bookings.slice(0, 10).map((booking) => (
            <Card key={booking.id} style={styles.eventCard}>
              <Card.Content>
                <View style={styles.eventRow}>
                  <Text variant="titleMedium" numberOfLines={1} style={styles.eventTitle}>
                    {booking.event?.title || 'Event'}
                  </Text>
                  <Chip compact textStyle={{ fontSize: 11, color: '#fff' }} style={{ backgroundColor: getStatusColor(booking.status) }}>
                    {booking.status}
                  </Chip>
                </View>
                <Text variant="bodySmall" style={styles.eventMeta}>
                  📅 {formatDate(booking.serviceDate)}  •  💰 {formatCurrency(booking.price)}
                </Text>
              </Card.Content>
            </Card>
          ))
        )}
        <Card style={styles.actionCard} onPress={() => navigation.navigate('VendorWorkspace')}>
          <Card.Content>
            <Text variant="titleMedium">Manage Services & Packages</Text>
            <Text variant="bodySmall" style={styles.eventMeta}>Add service details, estimation rules, testimonials</Text>
          </Card.Content>
        </Card>
        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
};

/* ─── Main Dashboard ─── */
const DashboardScreen = ({ navigation }) => {
  const { user } = useContext(AuthContext);
  const role = user?.role;

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <IconButton
          icon="bell-outline"
          iconColor="#fff"
          onPress={() => navigation.navigate('Notifications')}
        />
      ),
    });
  }, [navigation]);

  if (role === 'vendor') return <VendorDashboard user={user} navigation={navigation} />;
  return <EventsDashboard user={user} navigation={navigation} />;
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f8fc' },
  loader: { flex: 1, justifyContent: 'center' },
  heroCard: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 10,
    borderRadius: 16,
    elevation: 3,
    backgroundColor: '#ffffff',
  },
  greeting: { fontWeight: '800', marginBottom: 4 },
  heroSubtext: { color: '#667085' },
  statsRow: { paddingHorizontal: 12, marginBottom: 8 },
  statCard: { width: 136, marginHorizontal: 4, borderRadius: 14, elevation: 2, backgroundColor: '#fff' },
  statCardPrimary: { borderWidth: 1, borderColor: '#e7ebff' },
  statLabel: { color: '#667085', fontWeight: '600' },
  statValue: { fontWeight: '800', marginTop: 4, color: '#1d2939' },
  sectionTitle: { fontWeight: '800', marginHorizontal: 16, marginTop: 16, marginBottom: 8, color: '#1d2939' },
  eventCard: { marginHorizontal: 16, marginBottom: 10, borderRadius: 14, elevation: 2, backgroundColor: '#fff' },
  eventRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eventTitle: { flex: 1, marginRight: 8 },
  eventMeta: { color: '#667085', marginTop: 6 },
  eventBudget: { color: '#52c41a', marginTop: 2 },
  emptyCard: { marginHorizontal: 16, borderRadius: 14, backgroundColor: '#fff' },
  actionCard: { marginHorizontal: 16, marginBottom: 10, borderRadius: 14, elevation: 2, backgroundColor: '#fff' },
  emptyText: { textAlign: 'center', color: '#888', paddingVertical: 20 },
  fab: { position: 'absolute', right: 16, bottom: 16, backgroundColor: '#667eea' },
});

export default DashboardScreen;
