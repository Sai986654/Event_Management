import React, { useContext, useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Alert } from 'react-native';
import { Text, Card, Chip, Button, ActivityIndicator } from 'react-native-paper';
import { AuthContext } from '../context/AuthContext';
import { bookingService } from '../services/bookingService';
import { formatDate, formatCurrency, getErrorMessage, getStatusColor } from '../utils/helpers';

const BookingsScreen = () => {
  const { user } = useContext(AuthContext);
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

  const handleUpdateStatus = async (id, status) => {
    try {
      await bookingService.updateBookingStatus(id, status);
      fetchBookings();
    } catch (err) {
      Alert.alert('Error', getErrorMessage(err));
    }
  };

  const handleCancel = (id) => {
    Alert.alert('Cancel Booking', 'Are you sure you want to cancel this booking?', [
      { text: 'No' },
      { text: 'Yes', style: 'destructive', onPress: () => handleUpdateStatus(id, 'cancelled') },
    ]);
  };

  const renderBooking = ({ item }) => {
    const isVendor = user?.role === 'vendor';
    return (
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.headerRow}>
            <Text variant="titleMedium" style={styles.title} numberOfLines={1}>
              {isVendor ? (item.event?.title || 'Event') : (item.vendor?.businessName || 'Vendor')}
            </Text>
            <Chip
              compact
              textStyle={{ fontSize: 11, color: '#fff' }}
              style={{ backgroundColor: getStatusColor(item.status) }}
            >
              {item.status}
            </Chip>
          </View>

          <Text variant="bodySmall" style={styles.meta}>
            📅 {formatDate(item.serviceDate)}  •  💰 {formatCurrency(item.price)}
          </Text>

          {item.event?.title && !isVendor && (
            <Text variant="bodySmall" style={styles.meta}>🎉 {item.event.title}</Text>
          )}

          {item.vendor?.category && isVendor && (
            <Text variant="bodySmall" style={styles.meta}>📂 {item.vendor.category}</Text>
          )}

          {/* Actions */}
          <View style={styles.actions}>
            {isVendor && item.status === 'pending' && (
              <>
                <Button compact mode="contained" style={styles.confirmBtn} onPress={() => handleUpdateStatus(item.id, 'confirmed')}>
                  Confirm
                </Button>
                <Button compact mode="outlined" style={styles.cancelBtn} textColor="#ff4d4f" onPress={() => handleCancel(item.id)}>
                  Decline
                </Button>
              </>
            )}
            {isVendor && item.status === 'confirmed' && (
              <Button compact mode="contained" style={styles.completeBtn} onPress={() => handleUpdateStatus(item.id, 'completed')}>
                Mark Complete
              </Button>
            )}
            {!isVendor && (item.status === 'pending' || item.status === 'confirmed') && (
              <Button compact mode="outlined" textColor="#ff4d4f" onPress={() => handleCancel(item.id)}>
                Cancel
              </Button>
            )}
          </View>
        </Card.Content>
      </Card>
    );
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" />;

  return (
    <View style={styles.container}>
      <FlatList
        data={bookings}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderBooking}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchBookings(); }} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No bookings yet.</Text>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  listContent: { padding: 12 },
  card: { marginBottom: 12, borderRadius: 12, elevation: 2 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontWeight: 'bold', flex: 1, marginRight: 8 },
  meta: { color: '#666', marginTop: 4 },
  actions: { flexDirection: 'row', marginTop: 12, gap: 8 },
  confirmBtn: { backgroundColor: '#52c41a', borderRadius: 8 },
  cancelBtn: { borderColor: '#ff4d4f', borderRadius: 8 },
  completeBtn: { backgroundColor: '#1890ff', borderRadius: 8 },
  emptyText: { textAlign: 'center', color: '#888', marginTop: 40 },
});

export default BookingsScreen;
