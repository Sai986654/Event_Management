import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Text, Card, Button, Chip, ActivityIndicator } from 'react-native-paper';
import { appNotificationService } from '../services/appNotificationService';
import { getErrorMessage } from '../utils/helpers';
import { Colors, Spacing, Radius } from '../theme';

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

  if (loading && !items.length) return <View style={styles.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <Text variant="labelLarge" style={styles.unreadLabel}>{unreadCount} unread</Text>
        {unreadCount > 0 ? <Button mode="outlined" compact onPress={onReadAll} style={styles.markAllBtn}>Mark all read</Button> : null}
      </View>
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[Colors.primary]} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Card style={styles.card}><Card.Content><Text style={{ color: Colors.textMuted }}>No notifications yet.</Text></Card.Content></Card>
        }
        renderItem={({ item }) => (
          <Card style={[styles.card, !item.read && styles.unread]}>
            <Card.Content>
              <View style={styles.notifHeader}>
                <Text variant="titleSmall" style={styles.notifTitle}>{item.title}</Text>
                <Chip compact style={styles.typeChip} textStyle={{ fontSize: 10 }}>{item.type}</Chip>
              </View>
              <Text style={styles.body} selectable>{item.body}</Text>
              <Text variant="bodySmall" style={styles.date}>{new Date(item.createdAt).toLocaleString()}</Text>
              <View style={styles.actions}>
                {item.metadata?.eventId ? (
                  <Button mode="text" compact onPress={() => navigation.navigate('EventDetail', { eventId: item.metadata.eventId })}>Open event</Button>
                ) : null}
                {!item.read ? (
                  <Button mode="contained-tonal" compact onPress={() => onRead(item.id)} style={styles.readBtn}>Mark read</Button>
                ) : null}
              </View>
            </Card.Content>
          </Card>
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
  unreadLabel: { color: Colors.textPrimary, fontWeight: '700' },
  markAllBtn: { borderRadius: Radius.sm },
  list: { padding: Spacing.md },
  card: { marginBottom: Spacing.sm, borderRadius: Radius.lg, elevation: 2, backgroundColor: Colors.surface },
  unread: { borderLeftWidth: 3, borderLeftColor: Colors.primary },
  notifHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  notifTitle: { fontWeight: '700', flex: 1, marginRight: Spacing.sm, color: Colors.textPrimary },
  typeChip: { backgroundColor: Colors.surfaceVariant },
  body: { color: Colors.textSecondary, marginTop: Spacing.xs, lineHeight: 20 },
  date: { color: Colors.textMuted, marginTop: Spacing.sm },
  actions: { flexDirection: 'row', marginTop: Spacing.sm, gap: Spacing.sm },
  readBtn: { borderRadius: Radius.sm },
});

export default NotificationsScreen;
