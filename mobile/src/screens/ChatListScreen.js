import React, { useCallback, useContext, useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { Text, Card, FAB, Portal, Modal, TextInput, Button, Chip, Badge } from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { chatService } from '../services/chatService';
import { AuthContext } from '../context/AuthContext';
import { SocketContext } from '../context/SocketContext';
import { getErrorMessage } from '../utils/helpers';
import { Colors, Spacing, Radius } from '../theme';

const ChatListScreen = () => {
  const navigation = useNavigation();
  const { user } = useContext(AuthContext);
  const { clearUnreadChat } = useContext(SocketContext);
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [creating, setCreating] = useState(false);

  const loadThreads = useCallback(async () => {
    try {
      const data = await chatService.getThreads();
      setThreads(data.threads || []);
    } catch (err) {
      console.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadThreads();
      clearUnreadChat();
    }, [loadThreads, clearUnreadChat])
  );

  const handleCreate = async () => {
    if (!subject.trim() || !message.trim()) return;
    setCreating(true);
    try {
      const data = await chatService.createThread({ subject: subject.trim(), message: message.trim() });
      setShowCreate(false);
      setSubject('');
      setMessage('');
      navigation.navigate('ChatConversation', { threadId: data.thread.id, threadSubject: data.thread.subject });
    } catch (err) {
      console.error(getErrorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  const formatTime = (dateStr) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  const renderThread = ({ item }) => {
    const lastMsg = item.messages?.[0];
    const isClosed = item.status === 'closed';
    return (
      <TouchableOpacity
        onPress={() => navigation.navigate('ChatConversation', { threadId: item.id, threadSubject: item.subject })}
        activeOpacity={0.7}
      >
        <Card style={[styles.threadCard, isClosed && styles.closedCard]}>
          <Card.Content>
            <View style={styles.threadHeader}>
              <Text variant="titleSmall" style={styles.threadSubject} numberOfLines={1}>{item.subject}</Text>
              {isClosed ? (
                <Chip compact style={styles.closedChip} textStyle={{ fontSize: 10, color: Colors.textMuted }}>Closed</Chip>
              ) : (
                <Text variant="labelSmall" style={{ color: Colors.textMuted }}>{formatTime(item.updatedAt)}</Text>
              )}
            </View>
            {lastMsg && (
              <Text variant="bodySmall" style={styles.lastMsg} numberOfLines={2}>
                {lastMsg.sender?.name}: {lastMsg.body}
              </Text>
            )}
            <View style={styles.threadMeta}>
              <Text variant="labelSmall" style={{ color: Colors.textMuted }}>
                By {item.creator?.name} • {item._count?.messages || 0} messages
              </Text>
            </View>
          </Card.Content>
        </Card>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={threads}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderThread}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadThreads} colors={[Colors.primary]} />}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyBox}>
              <Text variant="titleMedium" style={{ fontWeight: '700', color: Colors.textPrimary }}>No conversations yet</Text>
              <Text variant="bodySmall" style={{ color: Colors.textMuted, marginTop: 4, textAlign: 'center' }}>
                Start a chat with our support team or an organizer.
              </Text>
            </View>
          ) : null
        }
      />

      <FAB icon="chat-plus" style={styles.fab} onPress={() => setShowCreate(true)} color="#fff" />

      <Portal>
        <Modal visible={showCreate} onDismiss={() => setShowCreate(false)} contentContainerStyle={styles.modal}>
          <Text variant="titleLarge" style={styles.modalTitle}>Start a Chat</Text>
          <TextInput
            label="Subject *"
            value={subject}
            onChangeText={setSubject}
            mode="outlined"
            placeholder="e.g. Help with my booking"
            style={styles.input}
            outlineStyle={styles.outline}
          />
          <TextInput
            label="Message *"
            value={message}
            onChangeText={setMessage}
            mode="outlined"
            multiline
            numberOfLines={4}
            placeholder="Describe your query..."
            style={styles.input}
            outlineStyle={styles.outline}
          />
          <Button
            mode="contained"
            onPress={handleCreate}
            loading={creating}
            disabled={creating || !subject.trim() || !message.trim()}
            style={styles.sendBtn}
            labelStyle={{ fontWeight: '700' }}
          >
            Start Chat
          </Button>
        </Modal>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  list: { padding: Spacing.md, paddingBottom: 100 },
  threadCard: { marginBottom: Spacing.md, borderRadius: Radius.md, elevation: 2, backgroundColor: Colors.surface },
  closedCard: { opacity: 0.6 },
  threadHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  threadSubject: { flex: 1, fontWeight: '700', color: Colors.textPrimary, marginRight: 8 },
  closedChip: { backgroundColor: Colors.surfaceVariant },
  lastMsg: { color: Colors.textSecondary, marginBottom: 6 },
  threadMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  emptyBox: { alignItems: 'center', paddingTop: 80 },
  fab: { position: 'absolute', right: Spacing.lg, bottom: Spacing.xl, backgroundColor: Colors.primary, borderRadius: 28 },
  modal: { backgroundColor: Colors.surface, margin: Spacing.xl, borderRadius: Radius.lg, padding: Spacing.xxl },
  modalTitle: { fontWeight: '800', marginBottom: Spacing.lg, color: Colors.textPrimary },
  input: { marginBottom: Spacing.md },
  outline: { borderRadius: Radius.sm },
  sendBtn: { backgroundColor: Colors.primary, borderRadius: Radius.sm, marginTop: Spacing.sm },
});

export default ChatListScreen;
