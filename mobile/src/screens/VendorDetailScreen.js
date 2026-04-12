import React, { useContext, useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Card, Button, Chip, Divider, ActivityIndicator, Portal, Modal, TextInput } from 'react-native-paper';
import { AuthContext } from '../context/AuthContext';
import { vendorService } from '../services/vendorService';
import { bookingService } from '../services/bookingService';
import { eventService } from '../services/eventService';
import { formatCurrency, formatDate, getErrorMessage, getStatusColor } from '../utils/helpers';
import { Colors, Spacing, Radius } from '../theme';

const VendorDetailScreen = ({ route, navigation }) => {
  const { vendorId } = route.params;
  const { user } = useContext(AuthContext);
  const [vendor, setVendor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bookingModal, setBookingModal] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [serviceDate, setServiceDate] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await vendorService.getVendorById(vendorId);
        setVendor(data.vendor || data);
        if (user && ['organizer', 'customer', 'admin'].includes(user.role)) {
          const evtData = await eventService.getEvents({ limit: 50 });
          setEvents(evtData.events || []);
        }
      } catch (err) {
        Alert.alert('Error', getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [vendorId, user]);

  const handleBook = async () => {
    if (!selectedEvent || !serviceDate) {
      Alert.alert('Missing info', 'Please select an event and enter a service date');
      return;
    }
    try {
      setSubmitting(true);
      await bookingService.createBooking({
        vendor: vendorId,
        event: selectedEvent,
        price: selectedPackage?.price || vendor.basePrice,
        serviceDate: new Date(serviceDate).toISOString(),
        notes: notes || `Package: ${selectedPackage?.name || 'Standard'}`,
      });
      Alert.alert('Success', 'Booking request sent!', [
        { text: 'OK', onPress: () => { setBookingModal(false); navigation.goBack(); } },
      ]);
    } catch (err) {
      Alert.alert('Error', getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color={Colors.primary} />;
  if (!vendor) return <Text style={{ textAlign: 'center', marginTop: 40 }}>Vendor not found</Text>;

  const packages = vendor.packages || [];
  const reviews = vendor.reviews || [];
  const canBook = user && ['organizer', 'customer', 'admin'].includes(user.role);

  return (
    <View style={styles.container}>
      <ScrollView>
        {/* Header */}
        <View style={styles.header}>
          <Text variant="headlineSmall" style={styles.name}>{vendor.businessName}</Text>
          <View style={styles.chipGroup}>
            <Chip compact style={styles.catChip} textStyle={{ textTransform: 'capitalize' }}>{vendor.category}</Chip>
            {vendor.isVerified && <Chip compact icon="check-circle" style={styles.verifiedChip} textStyle={{ color: Colors.success }}>Verified</Chip>}
          </View>
          <Text variant="bodySmall" style={styles.meta}>
            ⭐ {vendor.averageRating ? Number(vendor.averageRating).toFixed(1) : 'N/A'} ({vendor.totalReviews || 0} reviews) • 📍 {vendor.city}, {vendor.state}
          </Text>
          {vendor.description && <Text variant="bodyMedium" style={styles.description}>{vendor.description}</Text>}
        </View>

        <Divider />

        {/* Packages */}
        {packages.length > 0 && (
          <View style={styles.section}>
            <Text variant="titleMedium" style={styles.sectionTitle}>Packages</Text>
            {packages.map((pkg) => (
              <Card key={pkg.id} style={styles.packageCard}>
                <Card.Content>
                  <View style={styles.pkgHeader}>
                    <Text variant="titleMedium" style={{ fontWeight: '700' }}>{pkg.name}</Text>
                    <Text variant="titleMedium" style={styles.pkgPrice}>{formatCurrency(pkg.price)}</Text>
                  </View>
                  <Text variant="bodySmall" style={styles.pkgDesc}>{pkg.description}</Text>
                  {(pkg.includes || []).map((item, i) => (
                    <Text key={i} variant="bodySmall" style={styles.pkgItem}>✓ {item}</Text>
                  ))}
                  {canBook && (
                    <Button mode="contained" compact style={styles.bookBtn} labelStyle={{ fontWeight: '600' }} onPress={() => { setSelectedPackage(pkg); setBookingModal(true); }}>
                      Book {pkg.name}
                    </Button>
                  )}
                </Card.Content>
              </Card>
            ))}
          </View>
        )}

        {/* Reviews */}
        {reviews.length > 0 && (
          <View style={styles.section}>
            <Text variant="titleMedium" style={styles.sectionTitle}>Reviews</Text>
            {reviews.map((review) => (
              <Card key={review.id} style={styles.reviewCard}>
                <Card.Content>
                  <View style={styles.reviewHeader}>
                    <Text variant="titleSmall" style={{ fontWeight: '600' }}>{review.user?.name || 'User'}</Text>
                    <Text variant="bodySmall">{'⭐'.repeat(review.rating)}</Text>
                  </View>
                  <Text variant="bodySmall" style={styles.reviewComment}>{review.comment}</Text>
                  <Text variant="labelSmall" style={{ color: Colors.textMuted, marginTop: 4 }}>{formatDate(review.createdAt)}</Text>
                </Card.Content>
              </Card>
            ))}
          </View>
        )}

        {/* Fallback book button */}
        {packages.length === 0 && canBook && (
          <View style={styles.section}>
            <Button mode="contained" style={styles.bookBtn} labelStyle={{ fontWeight: '600' }} onPress={() => setBookingModal(true)}>
              Book This Vendor — {formatCurrency(vendor.basePrice)}
            </Button>
          </View>
        )}

        <View style={{ height: 30 }} />
      </ScrollView>

      {/* Booking Modal */}
      <Portal>
        <Modal visible={bookingModal} onDismiss={() => setBookingModal(false)} contentContainerStyle={styles.modal}>
          <Text variant="titleLarge" style={styles.modalTitle}>Book {vendor.businessName}</Text>
          {selectedPackage && (
            <Chip style={{ alignSelf: 'flex-start', marginBottom: Spacing.md }}>
              {selectedPackage.name} — {formatCurrency(selectedPackage.price)}
            </Chip>
          )}
          <Text variant="labelLarge" style={{ marginBottom: 4, fontWeight: '600' }}>Select Event</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.md }}>
            {events.map((evt) => (
              <Chip key={evt.id} selected={selectedEvent === evt.id} onPress={() => setSelectedEvent(evt.id)} style={{ marginRight: Spacing.sm }}>
                {evt.title}
              </Chip>
            ))}
          </ScrollView>
          {events.length === 0 && (
            <Text variant="bodySmall" style={{ color: Colors.warning, marginBottom: Spacing.sm }}>No events found. Create an event first.</Text>
          )}
          <TextInput label="Service Date (YYYY-MM-DD)" value={serviceDate} onChangeText={setServiceDate} mode="outlined" style={{ marginBottom: Spacing.md }} outlineStyle={{ borderRadius: Radius.sm }} />
          <TextInput label="Notes (optional)" value={notes} onChangeText={setNotes} mode="outlined" multiline numberOfLines={3} style={{ marginBottom: Spacing.lg }} outlineStyle={{ borderRadius: Radius.sm }} />
          <Button mode="contained" onPress={handleBook} loading={submitting} disabled={submitting || !selectedEvent || !serviceDate} style={styles.bookBtn} labelStyle={{ fontWeight: '600' }}>
            Confirm Booking
          </Button>
        </Modal>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { padding: Spacing.lg, backgroundColor: Colors.surface },
  name: { fontWeight: '800', color: Colors.textPrimary },
  chipGroup: { flexDirection: 'row', marginTop: Spacing.sm, gap: Spacing.sm },
  catChip: { backgroundColor: Colors.surfaceVariant },
  verifiedChip: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.success + '44' },
  meta: { color: Colors.textSecondary, marginTop: Spacing.sm },
  description: { marginTop: Spacing.md, lineHeight: 22, color: Colors.textPrimary },
  section: { padding: Spacing.lg },
  sectionTitle: { fontWeight: '700', marginBottom: Spacing.md, color: Colors.textPrimary },
  packageCard: { marginBottom: Spacing.md, borderRadius: Radius.lg, elevation: 2, backgroundColor: Colors.surface },
  pkgHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  pkgPrice: { color: Colors.primary, fontWeight: '700' },
  pkgDesc: { color: Colors.textSecondary, marginBottom: Spacing.sm },
  pkgItem: { color: Colors.success, marginBottom: 2 },
  bookBtn: { marginTop: Spacing.md, backgroundColor: Colors.primary, borderRadius: Radius.sm },
  reviewCard: { marginBottom: Spacing.sm, borderRadius: Radius.sm, elevation: 1, backgroundColor: Colors.surface },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reviewComment: { color: Colors.textSecondary, marginTop: 4 },
  modal: { backgroundColor: Colors.surface, margin: Spacing.xl, borderRadius: Radius.lg, padding: Spacing.xxl },
  modalTitle: { fontWeight: '800', marginBottom: Spacing.lg, color: Colors.textPrimary },
});

export default VendorDetailScreen;
