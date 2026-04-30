import React, { useContext, useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Alert } from 'react-native';
import { Text, Card, Chip, Button, ActivityIndicator } from 'react-native-paper';
import { AuthContext } from '../context/AuthContext';
import { bookingService } from '../services/bookingService';
import { formatDate, formatCurrency, getErrorMessage, getPaymentRequirement, getStatusColor } from '../utils/helpers';
import { Colors, Spacing, Radius } from '../theme';
import { paymentService } from '../services/paymentService';

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
      const paymentRequirement = getPaymentRequirement(err);
      if (paymentRequirement) {
        try {
          const order = await paymentService.createPaymentOrderFromRequirement(
            paymentRequirement,
            `Booking #${paymentRequirement.entityId} ${status}`
          );
          Alert.alert(
            'Payment Initiated',
            `Amount: INR ${order.amount}. Complete payment on web app and retry this action.`
          );
          return;
        } catch (paymentErr) {
          Alert.alert('Payment Error', getErrorMessage(paymentErr));
          return;
        }
      }
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
            <Chip compact textStyle={{ fontSize: 11, color: '#fff', fontWeight: '600' }} style={{ backgroundColor: getStatusColor(item.status), borderRadius: Radius.sm }}>
              {item.status}
            </Chip>
          </View>
          <Text variant="bodySmall" style={styles.meta}>📅 {formatDate(item.serviceDate)}  •  💰 {formatCurrency(item.price)}</Text>
          {item.event?.title && !isVendor && <Text variant="bodySmall" style={styles.meta}>🎉 {item.event.title}</Text>}
          {item.vendor?.category && isVendor && <Text variant="bodySmall" style={styles.meta}>📂 {item.vendor.category}</Text>}
          <View style={styles.actions}>
            {isVendor && item.status === 'pending' && (
              <>
                <Button compact mode="contained" style={styles.confirmBtn} labelStyle={styles.actionLabel} onPress={() => handleUpdateStatus(item.id, 'confirmed')}>Confirm</Button>
                <Button compact mode="outlined" style={styles.cancelBtn} textColor={Colors.danger} labelStyle={styles.actionLabel} onPress={() => handleCancel(item.id)}>Decline</Button>
              </>
            )}
            {isVendor && item.status === 'confirmed' && (
              <Button compact mode="contained" style={styles.completeBtn} labelStyle={styles.actionLabel} onPress={() => handleUpdateStatus(item.id, 'completed')}>Mark Complete</Button>
            )}
            {!isVendor && (item.status === 'pending' || item.status === 'confirmed') && (
              <Button compact mode="outlined" textColor={Colors.danger} onPress={() => handleCancel(item.id)}>Cancel</Button>
            )}
          </View>
        </Card.Content>
      </Card>
    );
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color={Colors.primary} />;

  return (
    <View style={styles.container}>
      <FlatList
        data={bookings}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderBooking}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchBookings(); }} colors={[Colors.primary]} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.emptyText}>No bookings yet.</Text>}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  listContent: { padding: Spacing.md },
  card: { marginBottom: Spacing.md, borderRadius: Radius.lg, elevation: 2, backgroundColor: Colors.surface },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontWeight: '700', flex: 1, marginRight: Spacing.sm, color: Colors.textPrimary },
  meta: { color: Colors.textSecondary, marginTop: 4 },
  actions: { flexDirection: 'row', marginTop: Spacing.md, gap: Spacing.sm },
  actionLabel: { fontWeight: '600' },
  confirmBtn: { backgroundColor: Colors.success, borderRadius: Radius.sm },
  cancelBtn: { borderColor: Colors.danger, borderRadius: Radius.sm },
  completeBtn: { backgroundColor: Colors.info, borderRadius: Radius.sm },
  emptyText: { textAlign: 'center', color: Colors.textMuted, marginTop: 40 },
});

export default BookingsScreen;
