import React, { useContext, useEffect, useState, useCallback, useLayoutEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Linking, TouchableOpacity, Alert, Image } from 'react-native';
import { Text, Card, Button, Chip, FAB, ActivityIndicator, IconButton, Menu, Avatar } from 'react-native-paper';
import * as Location from 'expo-location';
import { MotiView } from 'moti';
import { Easing } from 'react-native-reanimated';
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

const AnimatedEntrance = ({ children, delay = 0, style }) => (
  <MotiView
    from={{ opacity: 0, translateY: 18, scale: 0.98 }}
    animate={{ opacity: 1, translateY: 0, scale: 1 }}
    transition={{ type: 'timing', duration: 480, delay, easing: Easing.out(Easing.cubic) }}
    style={style}
  >
    {children}
  </MotiView>
);

const AmbientOrbs = () => (
  <View pointerEvents="none" style={styles.ambientLayer}>
    <MotiView
      style={[styles.orb, styles.orbOne]}
      animate={{ translateX: [0, 14, 0], translateY: [0, -12, 0], opacity: [0.2, 0.34, 0.2] }}
      transition={{ type: 'timing', duration: 7000, loop: true, easing: Easing.inOut(Easing.ease) }}
    />
    <MotiView
      style={[styles.orb, styles.orbTwo]}
      animate={{ translateX: [0, -16, 0], translateY: [0, 10, 0], opacity: [0.14, 0.28, 0.14] }}
      transition={{ type: 'timing', duration: 8600, loop: true, easing: Easing.inOut(Easing.ease) }}
    />
  </View>
);

/* ── Organizer / Admin / Customer Dashboard ── */
const SORT_OPTIONS = [
  { key: 'date', label: 'Ceremony Date' },
  { key: 'budget', label: 'Budget' },
  { key: 'createdAt', label: 'Created' },
  { key: 'distance', label: 'Nearest' },
];

// Haversine distance in km
const haversine = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const EventsDashboard = ({ user, navigation }) => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('active');
  const [fabOpen, setFabOpen] = useState(false);
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('asc');
  const [userLocation, setUserLocation] = useState(null); // { latitude, longitude }
  const [locLoading, setLocLoading] = useState(false);
  const [sortMenuVisible, setSortMenuVisible] = useState(false);

  const fetchEvents = useCallback(async () => {
    try {
      const data = await eventService.getEvents({ limit: 'all' });
      setEvents(data.events || []);
    } catch (err) {
      console.warn(getErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const requestLocation = useCallback(async () => {
    setLocLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location Permission', 'Enable location to sort events by distance.');
        setSortBy('date');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
    } catch {
      Alert.alert('Location Error', 'Could not get your current location.');
      setSortBy('date');
    } finally {
      setLocLoading(false);
    }
  }, []);

  const handleSortChange = useCallback((key) => {
    setSortBy(key);
    setSortMenuVisible(false);
    if (key === 'distance' && !userLocation) {
      requestLocation();
    }
  }, [userLocation, requestLocation]);

  const toggleSortOrder = useCallback(() => {
    setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
  }, []);

  // Apply client-side sort to any event array
  const applySortToList = useCallback((list) => {
    const dir = sortOrder === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      if (sortBy === 'budget') return dir * ((parseFloat(a.budget) || 0) - (parseFloat(b.budget) || 0));
      if (sortBy === 'createdAt') return dir * (new Date(a.createdAt) - new Date(b.createdAt));
      if (sortBy === 'distance') {
        if (!userLocation) return 0;
        const da = a.lat != null && a.lng != null ? haversine(userLocation.latitude, userLocation.longitude, a.lat, a.lng) : Infinity;
        const db = b.lat != null && b.lng != null ? haversine(userLocation.latitude, userLocation.longitude, b.lat, b.lng) : Infinity;
        return dir * (da - db);
      }
      // date (default)
      return dir * (new Date(a.date) - new Date(b.date));
    });
  }, [sortBy, sortOrder, userLocation]);

  // Segregate events for better tracking visibility.
  const completedEvents = applySortToList(
    events.filter((e) => String(e.status || '').toLowerCase() === 'completed')
  );
  const activeEvents = applySortToList(
    events.filter((e) => (e._count?.bookings || 0) > 0 && String(e.status || '').toLowerCase() !== 'completed')
  );
  const draftEvents = applySortToList(
    events.filter((e) => (e._count?.bookings || 0) === 0 && String(e.status || '').toLowerCase() !== 'completed')
  );
  const visibleEvents =
    activeTab === 'active'
      ? activeEvents
      : activeTab === 'completed'
        ? completedEvents
        : draftEvents;

  const upcoming = events.filter((e) => new Date(e.date) > new Date()).length;
  // Budget computed across ALL events regardless of tab
  const totalBudget = events.reduce((s, e) => s + (parseFloat(e.budget) || 0), 0);

  if (loading) return <ActivityIndicator style={styles.loader} size="large" color={Colors.primary} />;

  return (
    <View style={styles.container}>
      <AmbientOrbs />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchEvents(); }} colors={[Colors.primary]} />}
      >
        {/* Hero */}
        <AnimatedEntrance delay={60}>
          <Card style={styles.heroCard}>
            <Card.Content style={styles.heroRow}>
              {user?.avatar ? (
                <Avatar.Image size={54} source={{ uri: user.avatar }} style={styles.heroAvatar} />
              ) : (
                <Avatar.Text size={54} label={user?.name?.charAt(0)?.toUpperCase() || 'U'} style={[styles.heroAvatar, { backgroundColor: Colors.primaryDark }]} labelStyle={{ fontWeight: '800', fontSize: 22 }} />
              )}
              <View style={{ flex: 1 }}>
                <Text variant="headlineSmall" style={styles.greeting}>Welcome, {user?.name}! 👋</Text>
                <Text variant="bodySmall" style={styles.heroSubtext}>Track families, budgets, vendors, and function progress in one command center.</Text>
              </View>
            </Card.Content>
          </Card>
        </AnimatedEntrance>

        {/* Stats */}
        <AnimatedEntrance delay={120}>
          <View style={styles.statsRow}>
            <StatCard label="Events" value={events.length} accent />
            <StatCard label="Upcoming" value={upcoming} color={Colors.primaryDark} />
            <StatCard label="Budget" value={formatCurrency(totalBudget)} color={Colors.textPrimary} />
          </View>
        </AnimatedEntrance>

        {/* Event Tabs */}
        <View style={sortStyles.headerRow}>
          <Text variant="titleMedium" style={[styles.sectionTitle, { marginTop: 0, marginBottom: 0 }]}>Wedding Events</Text>
          <View style={sortStyles.controls}>
            <Menu
              visible={sortMenuVisible}
              onDismiss={() => setSortMenuVisible(false)}
              anchor={
                <TouchableOpacity style={sortStyles.sortBtn} onPress={() => setSortMenuVisible(true)}>
                  {locLoading
                    ? <ActivityIndicator size={14} color={Colors.primary} style={{ marginRight: 4 }} />
                    : <IconButton icon="sort" size={16} iconColor={Colors.primary} style={{ margin: 0, padding: 0 }} />}
                  <Text style={sortStyles.sortBtnText}>
                    {SORT_OPTIONS.find((o) => o.key === sortBy)?.label || 'Sort'}
                  </Text>
                </TouchableOpacity>
              }
            >
              {SORT_OPTIONS.map((opt) => (
                <Menu.Item
                  key={opt.key}
                  onPress={() => handleSortChange(opt.key)}
                  title={opt.label}
                  leadingIcon={sortBy === opt.key ? 'check' : undefined}
                />
              ))}
            </Menu>
            <TouchableOpacity style={sortStyles.orderBtn} onPress={toggleSortOrder}>
              <IconButton
                icon={sortOrder === 'asc' ? 'sort-ascending' : 'sort-descending'}
                size={18}
                iconColor={Colors.primary}
                style={{ margin: 0 }}
              />
            </TouchableOpacity>
          </View>
        </View>
        <View style={tabStyles.tabRow}>
          <TouchableOpacity
            style={[tabStyles.tab, activeTab === 'active' && tabStyles.tabActive]}
            onPress={() => setActiveTab('active')}
          >
            <Text style={[tabStyles.tabText, activeTab === 'active' && tabStyles.tabTextActive]}>
              Live ({activeEvents.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[tabStyles.tab, activeTab === 'drafts' && tabStyles.tabActive]}
            onPress={() => setActiveTab('drafts')}
          >
            <Text style={[tabStyles.tabText, activeTab === 'drafts' && tabStyles.tabTextActive]}>
              Planned ({draftEvents.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[tabStyles.tab, activeTab === 'completed' && tabStyles.tabActive]}
            onPress={() => setActiveTab('completed')}
          >
            <Text style={[tabStyles.tabText, activeTab === 'completed' && tabStyles.tabTextActive]}>
              Completed ({completedEvents.length})
            </Text>
          </TouchableOpacity>
        </View>

        {visibleEvents.length === 0 ? (
          <AnimatedEntrance delay={190}>
            <Card style={styles.emptyCard}>
              <Card.Content>
                <Text style={styles.emptyText}>
                  {activeTab === 'active'
                    ? 'No live events yet. Book your first vendor to activate this list.'
                    : activeTab === 'completed'
                      ? 'No completed events yet. Completed events will appear here for tracking.'
                      : 'No draft events. Tap + to create your first event!'}
                </Text>
              </Card.Content>
            </Card>
          </AnimatedEntrance>
        ) : (
          visibleEvents.map((event, index) => (
            <AnimatedEntrance key={event.id} delay={180 + index * 60}>
              <Card
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
            </AnimatedEntrance>
          ))
        )}

        {/* Quick Actions */}
        <Text variant="titleMedium" style={styles.sectionTitle}>Family Quick Actions</Text>

        {(user?.role === 'customer' || user?.role === 'admin') && (
          <AnimatedEntrance delay={280}>
            <ActionCard
              icon="clipboard-check-outline"
              title="Plan Event End-to-End"
              subtitle="Build quotation and confirm bookings"
              onPress={() => navigation.navigate('Planner')}
            />
          </AnimatedEntrance>
        )}
        {(user?.role === 'organizer' || user?.role === 'admin') && (
          <AnimatedEntrance delay={320}>
            <ActionCard
              icon="chart-timeline-variant"
              title="Update Activity Progress"
              subtitle="Track spend and family progress transparently"
              onPress={() => navigation.navigate('ActivityTracker')}
            />
          </AnimatedEntrance>
        )}
        {(user?.role === 'organizer' || user?.role === 'admin') && events.length > 0 && (
          <AnimatedEntrance delay={360}>
            <ActionCard
              icon="account-group-outline"
              title="Guest Management"
              subtitle="Add families, track RSVPs and check-ins"
              onPress={() => navigation.navigate('GuestManagement', { eventId: events[0].id })}
            />
          </AnimatedEntrance>
        )}
        {(user?.role === 'organizer' || user?.role === 'admin') && events.length > 0 && (
          <AnimatedEntrance delay={400}>
            <ActionCard
              icon="cash-multiple"
              title="Budget Dashboard"
              subtitle="Track wedding allocations and spending"
              onPress={() => navigation.navigate('BudgetDashboard', { eventId: events[0].id })}
            />
          </AnimatedEntrance>
        )}

        {user?.role === 'admin' && (
          <AnimatedEntrance delay={440}>
            <ActionCard
              icon="shield-check-outline"
              title="Admin Control Center"
              subtitle="Verify vendors and manage accounts"
              onPress={() => navigation.navigate('AdminControl')}
            />
          </AnimatedEntrance>
        )}
        <AnimatedEntrance delay={480}>
          <ActionCard
            icon="party-popper"
            title="Surprise Pages ✨"
              subtitle="Create emotional interactive surprise moments"
            onPress={() => navigation.navigate('SurprisePages')}
          />
        </AnimatedEntrance>
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
          <Card.Content style={styles.heroRow}>
            {user?.avatar ? (
              <Avatar.Image size={54} source={{ uri: user.avatar }} style={styles.heroAvatar} />
            ) : (
              <Avatar.Text size={54} label={user?.name?.charAt(0)?.toUpperCase() || 'U'} style={[styles.heroAvatar, { backgroundColor: Colors.primaryDark }]} labelStyle={{ fontWeight: '800', fontSize: 22 }} />
            )}
            <View style={{ flex: 1 }}>
              <Text variant="headlineSmall" style={styles.greeting}>Welcome, {user?.name}! 👋</Text>
              <Text variant="bodySmall" style={styles.heroSubtext}>Stay updated on wedding bookings and service performance.</Text>
            </View>
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
              <Text style={styles.emptyText}>No bookings yet. Families and planners will discover you in the marketplace.</Text>
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
                  <Chip compact textStyle={{ fontSize: 11, color: Colors.textOnDark }} style={{ backgroundColor: getStatusColor(booking.status) }}>
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
  const [unreadCount, setUnreadCount] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    const fetchUnread = async () => {
      try {
        const { appNotificationService } = require('../services/appNotificationService');
        const data = await appNotificationService.list({ limit: 1 });
        if (!cancelled) setUnreadCount(data.unreadCount ?? 0);
      } catch (_) {}
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity
            onPress={() => navigation.navigate('ProfileTab')}
            style={{ marginRight: 4, marginLeft: 8 }}
          >
            {user?.avatar ? (
              <Image
                source={{ uri: user.avatar }}
                style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)' }}
              />
            ) : (
              <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.primaryDark, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)' }}>
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>{user?.name?.charAt(0)?.toUpperCase() || 'U'}</Text>
              </View>
            )}
          </TouchableOpacity>
          <View>
          <IconButton
            icon="bell-outline"
            iconColor={Colors.textOnDark}
            onPress={() => navigation.navigate('Notifications')}
          />
          {unreadCount > 0 && (
            <View style={{
              position: 'absolute', top: 6, right: 6,
              backgroundColor: Colors.danger, borderRadius: 10,
              minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center',
              paddingHorizontal: 4, borderWidth: 2, borderColor: Colors.secondary,
            }}>
              <Text style={{ color: Colors.textOnDark, fontSize: 10, fontWeight: '800', lineHeight: 13 }}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </Text>
            </View>
          )}
          </View>
        </View>
      ),
    });
  }, [navigation, unreadCount, user]);

  if (role === 'vendor') return <VendorDashboard user={user} navigation={navigation} />;
  return <EventsDashboard user={user} navigation={navigation} />;
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingBottom: Spacing.sm },
  ambientLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  orb: {
    position: 'absolute',
    borderRadius: 999,
  },
  orbOne: {
    width: 220,
    height: 220,
    backgroundColor: 'rgba(212, 175, 55, 0.26)',
    top: -56,
    right: -64,
  },
  orbTwo: {
    width: 190,
    height: 190,
    backgroundColor: 'rgba(30, 41, 59, 0.2)',
    bottom: 120,
    left: -76,
  },
  loader: { flex: 1, justifyContent: 'center' },
  heroCard: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
    borderRadius: Radius.lg,
    elevation: 3,
    backgroundColor: Colors.surface,
  },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  heroAvatar: { flexShrink: 0 },
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

const sortStyles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surfaceVariant,
  },
  sortBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
  orderBtn: {
    marginLeft: 4,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surfaceVariant,
  },
});

const tabStyles = StyleSheet.create({
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceVariant,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: Radius.sm,
  },
  tabActive: {
    backgroundColor: Colors.primary,
    elevation: 2,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.textOnPrimary,
  },
});

export default DashboardScreen;
