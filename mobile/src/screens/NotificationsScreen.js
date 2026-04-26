import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Alert } from 'react-native';
import { Text, Card, Button, Chip, ActivityIndicator, IconButton, Divider } from 'react-native-paper';
import { appNotificationService } from '../services/appNotificationService';
import { formatCurrency, getErrorMessage } from '../utils/helpers';
import { Colors, Spacing, Radius } from '../theme';

/* ── Parse body text into structured rows ── */
const parseBody = (body) => {
  if (!body) return [];
  const rows = body
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const idx = line.indexOf(':');
      if (idx === -1) return { label: null, value: line };
      return { label: line.slice(0, idx).trim(), value: line.slice(idx + 1).trim() };
    });

  // Deduplicate: if Customer and Organizer have same value, keep only Customer
  const customer = rows.find((r) => r.label === 'Customer');
  const organizer = rows.find((r) => r.label === 'Organizer');
  if (customer && organizer && customer.value === organizer.value) {
    return rows.filter((r) => r.label !== 'Organizer');
  }
  return rows;
};

/* ── Icon for notification type ── */
const typeIcon = (type) => {
  const map = {
    order_quoted: 'file-document-outline',
    order_confirmed: 'check-decagram',
    order_cancelled: 'close-circle-outline',
    booking_created: 'calendar-plus',
    booking_confirmed: 'calendar-check',
    booking_cancelled: 'calendar-remove',
    vendor_verified: 'shield-check',
    event_created: 'party-popper',
    guest_rsvp: 'account-check',
    guest_checkin: 'account-arrow-right',
  };
  return map[type] || 'bell-outline';
};

/* ── Format value if it looks like currency ── */
const formatValue = (label, value) => {
  if (!label) return value;
  const lower = label.toLowerCase();
  // Format currency values
  if ((lower.includes('total') || lower.includes('price') || lower.includes('amount') || lower.includes('budget')) && /^\d+/.test(value)) {
    return formatCurrency(Number(value));
  }
  // Clean up "Name <email>" to just "Name"
  if ((lower === 'customer' || lower === 'organizer') && value.includes('<')) {
    return value.replace(/<[^>]+>/, '').trim();
  }
  return value;
};

/* ── Notification Card ── */
const NotificationCard = ({ item, onRead, onDelete, onOpenEvent }) => {
  const rows = parseBody(item.body);
  const icon = typeIcon(item.type);
  const typeLabel = (item.type || '').replace(/_/g, ' ');

  return (
    <Card style={[styles.card, !item.read && styles.unread]}>
      <Card.Content>
        {/* Header row */}
        <View style={styles.notifHeader}>
          <IconButton icon={icon} iconColor={Colors.primary} size={22} style={styles.notifIcon} />
          <View style={{ flex: 1 }}>
            <Text variant="titleSmall" numberOfLines={2} style={styles.notifTitle}>{item.title}</Text>
            <View style={styles.metaRow}>
              <Chip compact style={styles.typeChip} textStyle={styles.typeChipText}>{typeLabel}</Chip>
              {!item.read && <Chip compact style={styles.newChip} textStyle={styles.newChipText}>New</Chip>}
            </View>
          </View>
        </View>

        <Divider style={styles.divider} />

        {/* Structured body */}
        {rows.map((row, i) =>
          row.label ? (
            <View key={i} style={styles.bodyRow}>
              <Text style={styles.bodyLabel}>{row.label}</Text>
              <Text style={styles.bodyValue} numberOfLines={1}>{formatValue(row.label, row.value)}</Text>
            </View>
          ) : (
            <Text key={i} style={styles.bodyPlain}>{row.value}</Text>
          )
        )}

        {/* Timestamp */}
        <Text variant="bodySmall" style={styles.date}>
          {new Date(item.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
        </Text>

        {/* Actions */}
        <View style={styles.actions}>
          {item.metadata?.eventId ? (
            <Button mode="contained-tonal" compact icon="open-in-new" onPress={onOpenEvent} style={styles.actionBtn} labelStyle={styles.actionLabel}>
              Open Event
            </Button>
          ) : null}
          {!item.read ? (
            <Button mode="outlined" compact icon="check" onPress={() => onRead(item.id)} style={styles.actionBtn} labelStyle={styles.actionLabel}>
              Mark Read
            </Button>
          ) : null}
          <Button mode="text" compact icon="delete-outline" textColor="#ef4444" onPress={() => onDelete(item.id)} style={styles.actionBtn} labelStyle={styles.actionLabel}>
            Delete
          </Button>
        </View>
      </Card.Content>
    </Card>
  );
};

const NotificationsScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const load = useCallback(async () => {
    try {
      const data = await appNotificationService.list({ limit: 100 });
      setItems(data.notifications || []);
      setUnreadCount(data.unreadCount ?? 0);
    } catch (e) {
      console.warn(getErrorMessage(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRead = async (id) => {
    try { await appNotificationService.markRead(id); await load(); } catch (e) { console.warn(getErrorMessage(e)); }
  };

  const onReadAll = async () => {
    try { await appNotificationService.markAllRead(); await load(); } catch (e) { console.warn(getErrorMessage(e)); }
  };

  const onDelete = async (id) => {
    try { await appNotificationService.deleteOne(id); await load(); } catch (e) { console.warn(getErrorMessage(e)); }
  };

  const onDeleteAll = async () => {
    Alert.alert('Delete All', 'Delete all notifications?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await appNotificationService.deleteAll(); await load(); } catch (e) { console.warn(getErrorMessage(e)); }
      }},
    ]);
  };

  if (loading && !items.length) return <View style={styles.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <View style={styles.unreadBadge}>
          <Text style={styles.unreadCount}>{unreadCount}</Text>
          <Text style={styles.unreadLabel}>unread</Text>
        </View>
        {unreadCount > 0 ? (
          <Button mode="contained-tonal" compact icon="check-all" onPress={onReadAll} style={styles.markAllBtn} labelStyle={{ fontSize: 12 }}>
            Mark all read
          </Button>
        ) : null}
        {items.length > 0 ? (
          <Button mode="text" compact icon="delete-sweep-outline" textColor="#ef4444" onPress={onDeleteAll} labelStyle={{ fontSize: 12 }}>
            Delete all
          </Button>
        ) : null}
      </View>
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[Colors.primary]} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Card style={styles.card}>
            <Card.Content style={{ alignItems: 'center', paddingVertical: Spacing.xxl }}>
              <IconButton icon="bell-off-outline" iconColor={Colors.textMuted} size={40} />
              <Text style={{ color: Colors.textMuted, marginTop: Spacing.sm }}>No notifications yet.</Text>
            </Card.Content>
          </Card>
        }
        renderItem={({ item }) => (
          <NotificationCard
            item={item}
            onRead={onRead}
            onDelete={onDelete}
            onOpenEvent={() => navigation.navigate('EventDetail', { eventId: item.metadata.eventId })}
          />
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  unreadBadge: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  unreadCount: { fontSize: 20, fontWeight: '800', color: Colors.primary },
  unreadLabel: { color: Colors.textSecondary, fontWeight: '600', fontSize: 13 },
  markAllBtn: { borderRadius: Radius.sm },
  list: { padding: Spacing.md, paddingBottom: 30 },

  /* Card */
  card: { marginBottom: Spacing.md, borderRadius: Radius.lg, elevation: 2, backgroundColor: Colors.surface },
  unread: { borderLeftWidth: 4, borderLeftColor: Colors.primary },

  /* Header */
  notifHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  notifIcon: { margin: 0, marginRight: 4, backgroundColor: Colors.surfaceVariant, borderRadius: Radius.sm },
  notifTitle: { fontWeight: '700', color: Colors.textPrimary, lineHeight: 20, marginBottom: 4 },
  metaRow: { flexDirection: 'row', gap: 6 },
  typeChip: { backgroundColor: Colors.surfaceVariant, height: 24 },
  typeChipText: { fontSize: 10, fontWeight: '600', color: Colors.textSecondary, textTransform: 'capitalize' },
  newChip: { backgroundColor: Colors.primary + '20', height: 24 },
  newChipText: { fontSize: 10, fontWeight: '700', color: Colors.primary },

  divider: { marginVertical: Spacing.sm },

  /* Body rows */
  bodyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.divider },
  bodyLabel: { width: 90, fontSize: 11, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.3 },
  bodyValue: { flex: 1, fontSize: 13, color: Colors.textPrimary, fontWeight: '500' },
  bodyPlain: { fontSize: 13, color: Colors.textPrimary, paddingVertical: 2 },

  /* Footer */
  date: { color: Colors.textMuted, marginTop: Spacing.sm, fontSize: 11 },
  actions: { flexDirection: 'row', marginTop: Spacing.sm, gap: Spacing.sm },
  actionBtn: { borderRadius: Radius.sm },
  actionLabel: { fontSize: 12, fontWeight: '600' },
});

export default NotificationsScreen;
