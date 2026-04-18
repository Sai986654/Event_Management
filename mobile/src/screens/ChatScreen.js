import React, { useContext, useEffect, useRef, useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, TextInput, IconButton, Chip } from 'react-native-paper';
import { chatService } from '../services/chatService';
import { AuthContext } from '../context/AuthContext';
import { SocketContext } from '../context/SocketContext';
import { getErrorMessage } from '../utils/helpers';
import { Colors, Spacing, Radius } from '../theme';

const ChatScreen = ({ route }) => {
  const { threadId } = route.params;
  const { user } = useContext(AuthContext);
  const { socket, joinChat, leaveChat } = useContext(SocketContext);
  const [messages, setMessages] = useState([]);
  const [thread, setThread] = useState(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const flatListRef = useRef(null);

  const loadMessages = useCallback(async () => {
    try {
      const data = await chatService.getMessages(threadId);
      setMessages(data.messages || []);
      setThread(data.thread || null);
    } catch (err) {
      console.error(getErrorMessage(err));
    }
  }, [threadId]);

  useEffect(() => {
    loadMessages();
    joinChat(threadId);
    return () => leaveChat(threadId);
  }, [threadId, loadMessages, joinChat, leaveChat]);

  // Listen for real-time messages
  useEffect(() => {
    if (!socket) return;
    const handleMessage = (msg) => {
      if (msg.threadId === threadId) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }
    };
    const handleClosed = (data) => {
      if (data.threadId === threadId) {
        setThread((prev) => prev ? { ...prev, status: 'closed' } : prev);
      }
    };
    socket.on('chat:message', handleMessage);
    socket.on('chat:thread-closed', handleClosed);
    return () => {
      socket.off('chat:message', handleMessage);
      socket.off('chat:thread-closed', handleClosed);
    };
  }, [socket, threadId]);

  const handleSend = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const data = await chatService.sendMessage(threadId, text.trim());
      setText('');
      // The socket event will add the message, but add it optimistically if not already there
      setMessages((prev) => {
        if (prev.some((m) => m.id === data.message.id)) return prev;
        return [...prev, data.message];
      });
    } catch (err) {
      console.error(getErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  const isClosed = thread?.status === 'closed';

  const renderMessage = ({ item }) => {
    const isMe = item.senderId === user?.id;
    const isStaff = item.sender?.role === 'admin' || item.sender?.role === 'organizer';
    return (
      <View style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowOther]}>
        <View style={[styles.msgBubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
          {!isMe && (
            <Text variant="labelSmall" style={styles.senderName}>
              {item.sender?.name}{isStaff ? ' (Staff)' : ''}
            </Text>
          )}
          <Text variant="bodyMedium" style={isMe ? styles.msgTextMe : styles.msgTextOther}>{item.body}</Text>
          <Text variant="labelSmall" style={[styles.timestamp, isMe ? styles.timestampMe : styles.timestampOther]}>
            {formatTime(item.createdAt)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {isClosed && (
        <View style={styles.closedBanner}>
          <Text variant="bodySmall" style={{ color: Colors.textMuted }}>This conversation has been closed.</Text>
        </View>
      )}

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderMessage}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
      />

      {!isClosed && (
        <View style={styles.inputBar}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Type a message..."
            mode="outlined"
            dense
            style={styles.textInput}
            outlineStyle={styles.inputOutline}
            onSubmitEditing={handleSend}
            returnKeyType="send"
          />
          <IconButton
            icon="send"
            mode="contained"
            containerColor={Colors.primary}
            iconColor="#fff"
            size={22}
            onPress={handleSend}
            disabled={!text.trim() || sending}
            style={styles.sendBtn}
          />
        </View>
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  closedBanner: { padding: Spacing.sm, backgroundColor: Colors.surfaceVariant, alignItems: 'center' },
  messageList: { padding: Spacing.md, paddingBottom: 8 },
  msgRow: { marginBottom: Spacing.sm, maxWidth: '80%' },
  msgRowMe: { alignSelf: 'flex-end' },
  msgRowOther: { alignSelf: 'flex-start' },
  msgBubble: { padding: Spacing.md, borderRadius: Radius.md },
  bubbleMe: { backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: Colors.surface, elevation: 1, borderBottomLeftRadius: 4 },
  senderName: { fontWeight: '700', color: Colors.primary, marginBottom: 2, fontSize: 11 },
  msgTextMe: { color: '#fff' },
  msgTextOther: { color: Colors.textPrimary },
  timestamp: { marginTop: 4, fontSize: 10 },
  timestampMe: { color: 'rgba(255,255,255,0.7)', textAlign: 'right' },
  timestampOther: { color: Colors.textMuted },
  inputBar: { flexDirection: 'row', alignItems: 'center', padding: Spacing.sm, paddingHorizontal: Spacing.md, backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.border },
  textInput: { flex: 1, marginRight: Spacing.sm, backgroundColor: Colors.background },
  inputOutline: { borderRadius: 20 },
  sendBtn: { margin: 0 },
});

export default ChatScreen;
