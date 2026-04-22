import React, { useContext, useEffect, useState, useCallback, useLayoutEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Linking } from 'react-native';
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
    <Text variant="headlineMedium" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5} style={[statStyles.value, color && { color }]}>{value}</Text>
  </View>
);

const statStyles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 100,
    maxWidth: 160,
    marginHorizontal: 5,
    borderRadius: Radius.lg,
    elevation: 2,
    backgroundColor: Colors.surface,
    padding: Spacing.md,
  },
  cardAccent: { borderWidth: 1.5, borderColor: Colors.surfaceVariant },
  label: { color: Colors.textSecondary, fontWeight: '600', fontSize: 12 },
  value: { fontWeight: '800', marginTop: 4, color: Colors.textPrimary, fontSize: 20 },
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
  const [fabOpen, setFabOpen] = useState(false);

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
  const totalBudget = events.reduce((s, e) => s + (parseFloat(e.budget) || 0), 0);

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
        <View style={styles.statsRow}>
          <StatCard label="Events" value={events.length} accent />
          <StatCard label="Upcoming" value={upcoming} color={Colors.primary} />
          <StatCard label="Total Budget" value={formatCurrency(totalBudget)} color={Colors.success} />
        </View>

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
        {(user?.role === 'organizer' || user?.role === 'admin') && events.length > 0 && (
          <ActionCard
            icon="account-group-outline"
            title="Guest Management"
            subtitle="Add guests, track RSVPs, check-ins"
            onPress={() => navigation.navigate('GuestManagement', { eventId: events[0].id })}
          />
        )}
        {(user?.role === 'organizer' || user?.role === 'admin') && events.length > 0 && (
          <ActionCard
            icon="cash-multiple"
            title="Budget Dashboard"
            subtitle="Track allocations and spending"
            onPress={() => navigation.navigate('BudgetDashboard', { eventId: events[0].id })}
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
        <ActionCard
          icon="party-popper"
          title="Surprise Pages ✨"
          subtitle="Create viral interactive surprise experiences"
          onPress={() => navigation.navigate('SurprisePages')}
        />
        <View style={{ height: 90 }} />
      </ScrollView>

      {(user?.role === 'organizer' || user?.role === 'customer' || user?.role === 'admin') && (
        <FAB.Group
          open={fabOpen}
          visible
          icon={fabOpen ? 'close' : 'plus'}
          color="#fff"
          fabStyle={styles.fab}
          actions={[
            {
              icon: 'calendar-plus',
              label: 'New Event',
              color: Colors.primary,
              onPress: () => navigation.navigate('EventCreate'),
              style: { backgroundColor: Colors.surface },
            },
            {
              icon: 'chat-outline',
              label: 'In-App Chat',
              color: Colors.primary,
              onPress: () => navigation.navigate('ChatList'),
              style: { backgroundColor: Colors.surface },
            },
            {
              icon: 'whatsapp',
              label: 'WhatsApp Connect',
              color: '#25D366',
              onPress: () => Linking.openURL('https://wa.me/917093888473?text=Hi%2C%20I%20need%20help%20with%20event%20planning'),
              style: { backgroundColor: Colors.surface },
            },
          ]}
          onStateChange={({ open }) => setFabOpen(open)}
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
    .reduce((s, b) => s + (parseFloat(b.price) || 0), 0);

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

        <View style={vendorStatStyles.grid}>
          <View style={vendorStatStyles.row}>
            <View style={vendorStatStyles.cell}>
              <Text style={vendorStatStyles.label}>Total Bookings</Text>
              <Text style={vendorStatStyles.value}>{bookings.length}</Text>
            </View>
            <View style={vendorStatStyles.cell}>
              <Text style={vendorStatStyles.label}>Pending</Text>
              <Text style={[vendorStatStyles.value, { color: Colors.statusPending }]}>{pending}</Text>
            </View>
          </View>
          <View style={vendorStatStyles.row}>
            <View style={vendorStatStyles.cell}>
              <Text style={vendorStatStyles.label}>Confirmed</Text>
              <Text style={[vendorStatStyles.value, { color: Colors.statusConfirmed }]}>{confirmed}</Text>
            </View>
            <View style={vendorStatStyles.cell}>
              <Text style={vendorStatStyles.label}>Revenue</Text>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={[vendorStatStyles.value, { color: Colors.success }]}>{formatCurrency(revenue)}</Text>
            </View>
          </View>
        </View>

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
        <ActionCard
          icon="account-cog-outline"
          title="Edit Business Profile"
          subtitle="Update info, social links, verification"
          onPress={() => navigation.navigate('ProfileTab')}
        />
        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
};

const vendorStatStyles = StyleSheet.create({
  grid: {
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.sm,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    elevation: 2,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row' },
  cell: {
    flex: 1,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
    borderBottomWidth: 0.5,
    borderRightWidth: 0.5,
    borderColor: Colors.divider,
  },
  label: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600', marginBottom: 4 },
  value: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
});

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
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
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
  fab: { backgroundColor: Colors.primary, borderRadius: Radius.lg },
});

export default DashboardScreen;
