import React, { useContext, useEffect, useState, useCallback, useLayoutEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Text, Card, Button, Chip, FAB, ActivityIndicator, IconButton } from 'react-native-paper';
import { AuthContext } from '../context/AuthContext';
import { eventService } from '../services/eventService';
import { bookingService } from '../services/bookingService';
import { formatDate, formatCurrency, getErrorMessage, getStatusColor } from '../utils/helpers';
import { Colors, Spacing, Radius } from '../theme';

/* ── Stat Card Component ── */
const StatCard = ({ label, value, color, accent }) => (
  <View style={[statStyles.card, accent && statStyles.cardAccent]}>
    <Text variant="bodySmall" style={statStyles.label}>{label}</Text>
    <Text variant="headlineMedium" style={[statStyles.value, color && { color }]}>{value}</Text>
  </View>
);

const statStyles = StyleSheet.create({
  card: {
    width: 140,
    marginHorizontal: 5,
    borderRadius: Radius.lg,
    elevation: 2,
    backgroundColor: Colors.surface,
    padding: Spacing.md,
  },
  cardAccent: { borderWidth: 1.5, borderColor: Colors.surfaceVariant },
  label: { color: Colors.textSecondary, fontWeight: '600', fontSize: 12 },
  value: { fontWeight: '800', marginTop: 4, color: Colors.textPrimary, fontSize: 22 },
});

/* ── Quick Action Card ── */
const ActionCard = ({ icon, title, subtitle, onPress }) => (
  <Card style={qStyles.card} onPress={onPress}>
    <Card.Content style={qStyles.row}>
      <IconButton icon={icon} iconColor={Colors.primary} size={28} style={qStyles.icon} />
      <View style={qStyles.textCol}>
        <Text variant="titleSmall" style={qStyles.title}>{title}</Text>
        <Text variant="bodySmall" style={qStyles.sub}>{subtitle}</Text>
      </View>
      <IconButton icon="chevron-right" iconColor={Colors.textMuted} size={20} />
    </Card.Content>
  </Card>
);

const qStyles = StyleSheet.create({
  card: { marginHorizontal: Spacing.lg, marginBottom: Spacing.sm, borderRadius: Radius.lg, elevation: 2, backgroundColor: Colors.surface },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  icon: { margin: 0, backgroundColor: Colors.surfaceVariant, borderRadius: Radius.sm },
  textCol: { flex: 1, marginLeft: Spacing.sm },
  title: { fontWeight: '700', color: Colors.textPrimary },
  sub: { color: Colors.textSecondary, marginTop: 2, fontSize: 12 },
});

/* ── Organizer / Admin / Customer Dashboard ── */
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

  if (loading) return <ActivityIndicator style={styles.loader} size="large" color={Colors.primary} />;

  return (
    <View style={styles.container}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchEvents(); }} colors={[Colors.primary]} />}
      >
        {/* Hero */}
        <Card style={styles.heroCard}>
          <Card.Content>
            <Text variant="headlineSmall" style={styles.greeting}>Welcome, {user?.name}! 👋</Text>
            <Text variant="bodySmall" style={styles.heroSubtext}>Track budgets, orders, and execution in one place.</Text>
          </Card.Content>
        </Card>

        {/* Stats */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsRow}>
          <StatCard label="Events" value={events.length} accent />
          <StatCard label="Upcoming" value={upcoming} color={Colors.primary} />
          <StatCard label="Total Budget" value={formatCurrency(totalBudget)} color={Colors.success} />
        </ScrollView>

        {/* Event List */}
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
                  <Chip compact textStyle={styles.statusChipText} style={[styles.statusChip, { backgroundColor: getStatusColor(event.status) + '18' }]}>
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

        {/* Quick Actions */}
        <Text variant="titleMedium" style={styles.sectionTitle}>Quick Actions</Text>

        {(user?.role === 'customer' || user?.role === 'admin') && (
          <ActionCard
            icon="clipboard-check-outline"
            title="Plan Event End-to-End"
            subtitle="Build quotation and place order"
            onPress={() => navigation.navigate('Planner')}
          />
        )}
        {(user?.role === 'organizer' || user?.role === 'admin') && (
          <ActionCard
            icon="chart-timeline-variant"
            title="Update Activity Progress"
            subtitle="Track spend and progress transparently"
            onPress={() => navigation.navigate('ActivityTracker')}
          />
        )}
        {(user?.role === 'organizer' || user?.role === 'admin') && (
          <ActionCard
            icon="card-account-phone-outline"
            title="Invite Intelligence"
            subtitle="Contact segments, WhatsApp reminders"
            onPress={() => navigation.navigate('InviteIntelligence')}
          />
        )}
        {user?.role === 'admin' && (
          <ActionCard
            icon="shield-check-outline"
            title="Admin Control Center"
            subtitle="Verify vendors and create users"
            onPress={() => navigation.navigate('AdminControl')}
          />
        )}
        <View style={{ height: 90 }} />
      </ScrollView>

      {(user?.role === 'organizer' || user?.role === 'customer' || user?.role === 'admin') && (
        <FAB
          icon="plus"
          style={styles.fab}
          color={Colors.textOnPrimary}
          onPress={() => navigation.navigate('EventCreate')}
          label="New Event"
        />
      )}
    </View>
  );
};

/* ── Vendor Dashboard ── */
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

  if (loading) return <ActivityIndicator style={styles.loader} size="large" color={Colors.primary} />;

  return (
    <View style={styles.container}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchBookings(); }} colors={[Colors.primary]} />}
      >
        <Card style={styles.heroCard}>
          <Card.Content>
            <Text variant="headlineSmall" style={styles.greeting}>Welcome, {user?.name}! 👋</Text>
            <Text variant="bodySmall" style={styles.heroSubtext}>Stay updated on bookings and business performance.</Text>
          </Card.Content>
        </Card>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsRow}>
          <StatCard label="Total" value={bookings.length} accent />
          <StatCard label="Pending" value={pending} color={Colors.statusPending} />
          <StatCard label="Confirmed" value={confirmed} color={Colors.statusConfirmed} />
          <StatCard label="Revenue" value={formatCurrency(revenue)} color={Colors.success} />
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

        <Text variant="titleMedium" style={styles.sectionTitle}>Quick Actions</Text>
        <ActionCard
          icon="briefcase-outline"
          title="Manage Services & Packages"
          subtitle="Add service details, estimation rules, testimonials"
          onPress={() => navigation.navigate('VendorWorkspace')}
        />
        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
};

/* ── Main Dashboard ── */
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
  container: { flex: 1, backgroundColor: Colors.background },
  loader: { flex: 1, justifyContent: 'center' },
  heroCard: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
    borderRadius: Radius.lg,
    elevation: 3,
    backgroundColor: Colors.surface,
  },
  greeting: { fontWeight: '800', color: Colors.textPrimary, marginBottom: 4 },
  heroSubtext: { color: Colors.textSecondary, lineHeight: 20 },
  statsRow: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  sectionTitle: {
    fontWeight: '800',
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
    color: Colors.textPrimary,
  },
  eventCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    borderRadius: Radius.lg,
    elevation: 2,
    backgroundColor: Colors.surface,
  },
  eventRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eventTitle: { flex: 1, marginRight: Spacing.sm, fontWeight: '700' },
  eventMeta: { color: Colors.textSecondary, marginTop: 6 },
  eventBudget: { color: Colors.success, marginTop: 2, fontWeight: '600' },
  statusChip: { borderRadius: Radius.sm },
  statusChipText: { fontSize: 11, fontWeight: '600' },
  emptyCard: { marginHorizontal: Spacing.lg, borderRadius: Radius.lg, backgroundColor: Colors.surface },
  emptyText: { textAlign: 'center', color: Colors.textMuted, paddingVertical: 20 },
  fab: { position: 'absolute', right: 16, bottom: 16, backgroundColor: Colors.primary, borderRadius: Radius.lg },
});

export default DashboardScreen;
