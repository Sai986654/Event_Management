import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Text, Card, Button, Chip, ActivityIndicator } from 'react-native-paper';
import { appNotificationService } from '../services/appNotificationService';
import { getErrorMessage } from '../utils/helpers';

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

  useEffect(() => {
    load();
  }, [load]);

  const onRead = async (id) => {
    try {
      await appNotificationService.markRead(id);
      await load();
    } catch (e) {
      console.warn(getErrorMessage(e));
    }
  };

  const onReadAll = async () => {
    try {
      await appNotificationService.markAllRead();
      await load();
    } catch (e) {
      console.warn(getErrorMessage(e));
    }
  };

  if (loading && !items.length) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <Text variant="labelLarge" style={styles.unreadLabel}>
          {unreadCount} unread
        </Text>
        {unreadCount > 0 ? (
          <Button mode="outlined" compact onPress={onReadAll}>
            Mark all read
          </Button>
        ) : null}
      </View>
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        ListEmptyComponent={
          <Card style={styles.card}>
            <Card.Content>
              <Text>No notifications yet.</Text>
            </Card.Content>
          </Card>
        }
        renderItem={({ item }) => (
          <Card style={[styles.card, !item.read && styles.unread]}>
            <Card.Content>
              <Text variant="titleSmall" style={styles.title}>
                {item.title}
              </Text>
              <Chip compact style={styles.typeChip}>
                {item.type}
              </Chip>
              <Text style={styles.body} selectable>
                {item.body}
              </Text>
              <Text variant="bodySmall" style={styles.date}>
                {new Date(item.createdAt).toLocaleString()}
              </Text>
              {item.metadata?.eventId ? (
                <Button
                  mode="text"
                  compact
                  onPress={() => navigation.navigate('EventDetail', { eventId: item.metadata.eventId })}
                >
                  Open event
                </Button>
              ) : null}
              {!item.read ? (
                <Button mode="contained-tonal" compact onPress={() => onRead(item.id)} style={styles.readBtn}>
                  Mark read
                </Button>
              ) : null}
            </Card.Content>
          </Card>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f8fc' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12 },
  unreadLabel: { color: '#344054', fontWeight: '600' },
  card: { marginHorizontal: 12, marginBottom: 10, borderRadius: 12 },
  unread: { borderLeftWidth: 3, borderLeftColor: '#667eea' },
  title: { fontWeight: '700', marginBottom: 4 },
  typeChip: { alignSelf: 'flex-start', marginBottom: 6 },
  body: { color: '#344054', marginBottom: 6 },
  date: { color: '#98a2b3', marginBottom: 4 },
  readBtn: { marginTop: 8, alignSelf: 'flex-start' },
});

export default NotificationsScreen;
