import React, { useContext, useEffect, useState, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Card, Button, Chip, Divider, ActivityIndicator, Portal, Modal, TextInput } from 'react-native-paper';
import { AuthContext } from '../context/AuthContext';
import { vendorService } from '../services/vendorService';
import { bookingService } from '../services/bookingService';
import { eventService } from '../services/eventService';
import { paymentService } from '../services/paymentService';
import { formatCurrency, getErrorMessage, getPaymentRequirement } from '../utils/helpers';
import { Colors, Spacing, Radius } from '../theme';
import DatePickerInput from '../components/DatePickerInput';

/* ── Category-specific pricing field labels (mirrors VendorWorkspaceScreen) ── */
const CATEGORY_FIELDS = {
  catering: [
    { name: 'perPlate', label: 'Per Plate Cost', prefix: '₹' },
    { name: 'extraSweetCost', label: 'Extra Sweet (per item)', prefix: '₹' },
    { name: 'extraStarterCost', label: 'Extra Starter (per item)', prefix: '₹' },
    { name: 'extraMainCourseCost', label: 'Extra Main Course (per item)', prefix: '₹' },
    { name: 'minPlates', label: 'Minimum Plates' },
    { name: 'liveCounterCost', label: 'Live Counter Charge', prefix: '₹' },
  ],
  photography: [
    { name: 'perHour', label: 'Per Hour', prefix: '₹' },
    { name: 'extraCameraCost', label: 'Extra Camera/Photographer', prefix: '₹' },
    { name: 'editedPhotos', label: 'Edited Photos Included' },
    { name: 'albumCost', label: 'Album Cost', prefix: '₹' },
    { name: 'droneCost', label: 'Drone Coverage', prefix: '₹' },
  ],
  videography: [
    { name: 'perHour', label: 'Per Hour', prefix: '₹' },
    { name: 'extraCameraCost', label: 'Extra Cameraman', prefix: '₹' },
    { name: 'droneCost', label: 'Drone Coverage', prefix: '₹' },
    { name: 'highlightReelCost', label: 'Highlight Reel', prefix: '₹' },
    { name: 'trailerCost', label: 'Wedding Trailer', prefix: '₹' },
  ],
  decor: [
    { name: 'perTable', label: 'Per Table Setup', prefix: '₹' },
    { name: 'stageCost', label: 'Stage Decoration', prefix: '₹' },
    { name: 'entranceCost', label: 'Entrance Decoration', prefix: '₹' },
    { name: 'extraItemCost', label: 'Extra Item / Add-on', prefix: '₹' },
    { name: 'lightingCost', label: 'Lighting Package', prefix: '₹' },
  ],
  music: [
    { name: 'perHour', label: 'Per Hour', prefix: '₹' },
    { name: 'soundSystemCost', label: 'Sound System Charge', prefix: '₹' },
    { name: 'extraArtistCost', label: 'Extra Artist / Singer', prefix: '₹' },
    { name: 'djCost', label: 'DJ Setup', prefix: '₹' },
  ],
  venue: [
    { name: 'perDay', label: 'Per Day Rental', prefix: '₹' },
    { name: 'perHour', label: 'Per Hour (if applicable)', prefix: '₹' },
    { name: 'cleaningCharge', label: 'Cleaning Charge', prefix: '₹' },
    { name: 'securityDeposit', label: 'Security Deposit', prefix: '₹' },
    { name: 'acCharge', label: 'AC / Generator Charge', prefix: '₹' },
  ],
  florist: [
    { name: 'perArrangement', label: 'Per Arrangement', prefix: '₹' },
    { name: 'bouquetCost', label: 'Bouquet Cost', prefix: '₹' },
    { name: 'perTableCenterpiece', label: 'Table Centerpiece', prefix: '₹' },
    { name: 'carDecorationCost', label: 'Car Decoration', prefix: '₹' },
  ],
  transportation: [
    { name: 'perTrip', label: 'Per Trip', prefix: '₹' },
    { name: 'perKm', label: 'Per Km', prefix: '₹' },
    { name: 'waitingChargePerHour', label: 'Waiting Charge / Hr', prefix: '₹' },
    { name: 'driverAllowance', label: 'Driver Allowance', prefix: '₹' },
  ],
  other: [
    { name: 'perUnit', label: 'Per Unit Cost', prefix: '₹' },
    { name: 'perHour', label: 'Per Hour', prefix: '₹' },
  ],
};

/* ── Price estimation (mirrors backend estimatePackagePrice) ── */
const estimatePrice = (pkg, criteria = {}) => {
  const rules = pkg.estimationRules || {};
  const guests = Number(criteria.guests || 0);
  const hours = Number(criteria.hours || 0);
  const base = Number(pkg.basePrice || 0);
  const perGuest = Number(rules.perGuest || rules.perPlate || 0);
  const perHour = Number(rules.perHour || 0);
  const fixed = Number(rules.fixed || 0);
  return Math.max(0, Math.round((base + fixed + perGuest * guests + perHour * hours) * 100) / 100);
};

const VendorPackagesScreen = ({ route, navigation }) => {
  const { vendorId, vendor: passedVendor } = route.params;
  const { user } = useContext(AuthContext);
  const [vendor, setVendor] = useState(passedVendor || null);
  const [loading, setLoading] = useState(!passedVendor);
  const [bookingModal, setBookingModal] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [serviceDate, setServiceDate] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [criteriaMap, setCriteriaMap] = useState({}); // { [pkgId]: { guests, hours } }

  useEffect(() => {
    const load = async () => {
      try {
        if (!passedVendor) {
          const data = await vendorService.getVendorById(vendorId);
          setVendor(data.vendor || data);
        }
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

  const updateCriteria = (pkgId, field, value) => {
    setCriteriaMap((prev) => ({
      ...prev,
      [pkgId]: { ...prev[pkgId], [field]: value },
    }));
  };

  const openBooking = (pkg) => {
    setSelectedPackage(pkg);
    setBookingModal(true);
  };

  const handleBook = async () => {
    if (!selectedEvent || !serviceDate) {
      Alert.alert('Missing info', 'Please select an event and enter a service date');
      return;
    }
    try {
      setSubmitting(true);
      const criteria = selectedPackage ? (criteriaMap[selectedPackage.id] || {}) : {};
      const price = selectedPackage ? estimatePrice(selectedPackage, criteria) : Number(vendor.basePrice || 0);
      await bookingService.createBooking({
        vendor: vendorId,
        event: selectedEvent,
        price,
        serviceDate: new Date(serviceDate).toISOString(),
        notes: notes || `Package: ${selectedPackage?.title || 'Standard'}${criteria.guests ? ` | Guests: ${criteria.guests}` : ''}${criteria.hours ? ` | Hours: ${criteria.hours}` : ''}`,
      });
      Alert.alert('Success', 'Booking request sent!', [
        { text: 'OK', onPress: () => { setBookingModal(false); navigation.goBack(); } },
      ]);
    } catch (err) {
      const paymentRequirement = getPaymentRequirement(err);
      if (paymentRequirement) {
        try {
          await paymentService.checkoutForRequirement(
            paymentRequirement,
            `Booking #${paymentRequirement.entityId} confirmation`
          );
          await bookingService.updateBookingStatus(paymentRequirement.entityId, 'confirmed');
          Alert.alert('Success', 'Booking created and payment completed!', [
            { text: 'OK', onPress: () => { setBookingModal(false); navigation.goBack(); } },
          ]);
          return;
        } catch (paymentError) {
          Alert.alert('Payment Error', getErrorMessage(paymentError));
          return;
        }
      }
      Alert.alert('Error', getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color={Colors.primary} />;
  if (!vendor) return <Text style={{ textAlign: 'center', marginTop: 40 }}>Vendor not found</Text>;

  const packageCatalog = vendor.packageCatalog || [];
  const canBook = user && ['organizer', 'customer', 'admin'].includes(user.role);

  /* ── Render category-specific pricing tags for a package ── */
  const renderPricingDetails = (pkg) => {
    const rules = pkg.estimationRules || {};
    const fields = CATEGORY_FIELDS[pkg.category] || CATEGORY_FIELDS.other || [];
    const knownKeys = new Set(fields.map((f) => f.name));
    const tags = [];
    // Known category fields
    fields.forEach((f) => {
      const val = rules[f.name];
      if (val && Number(val) > 0) {
        const display = f.prefix ? `${f.prefix}${Number(val).toLocaleString('en-IN')}` : String(val);
        tags.push(
          <Chip key={f.name} compact style={styles.pricingChip} textStyle={styles.pricingChipText}>
            {display} {f.label.toLowerCase()}
          </Chip>
        );
      }
    });
    // Custom parameters (vendor-defined)
    Object.entries(rules).forEach(([k, v]) => {
      if (!knownKeys.has(k) && Number(v) > 0) {
        const label = k.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
        tags.push(
          <Chip key={k} compact style={styles.customPricingChip} textStyle={styles.customPricingChipText}>
            ₹{Number(v).toLocaleString('en-IN')} {label.toLowerCase()}
          </Chip>
        );
      }
    });
    return tags.length > 0 ? <View style={styles.pricingTagsRow}>{tags}</View> : null;
  };

  /* ── Criteria input fields per package (guests / hours) ── */
  const renderCriteriaInputs = (pkg) => {
    const rules = pkg.estimationRules || {};
    const hasPerGuest = Number(rules.perGuest || rules.perPlate || 0) > 0;
    const hasPerHour = Number(rules.perHour || 0) > 0;
    if (!hasPerGuest && !hasPerHour) return null;

    const criteria = criteriaMap[pkg.id] || {};
    const estimated = estimatePrice(pkg, criteria);

    return (
      <View style={styles.criteriaBox}>
        <Text variant="labelLarge" style={styles.criteriaTitle}>Estimate Your Price</Text>
        <View style={styles.criteriaRow}>
          {hasPerGuest && (
            <TextInput
              label="Guests"
              value={criteria.guests?.toString() || ''}
              onChangeText={(v) => updateCriteria(pkg.id, 'guests', v.replace(/[^0-9]/g, ''))}
              keyboardType="numeric"
              mode="outlined"
              dense
              style={styles.criteriaInput}
              outlineStyle={{ borderRadius: Radius.sm }}
            />
          )}
          {hasPerHour && (
            <TextInput
              label="Hours"
              value={criteria.hours?.toString() || ''}
              onChangeText={(v) => updateCriteria(pkg.id, 'hours', v.replace(/[^0-9]/g, ''))}
              keyboardType="numeric"
              mode="outlined"
              dense
              style={styles.criteriaInput}
              outlineStyle={{ borderRadius: Radius.sm }}
            />
          )}
        </View>
        {(Number(criteria.guests || 0) > 0 || Number(criteria.hours || 0) > 0) && (
          <View style={styles.estimatedRow}>
            <Text variant="labelMedium" style={{ color: Colors.textSecondary }}>Estimated Total:</Text>
            <Text variant="titleMedium" style={styles.estimatedPrice}>{formatCurrency(estimated)}</Text>
          </View>
        )}
      </View>
    );
  };

  /* ── Estimated price for the booking modal ── */
  const bookingEstimatedPrice = useMemo(() => {
    if (!selectedPackage) return Number(vendor.basePrice || 0);
    return estimatePrice(selectedPackage, criteriaMap[selectedPackage.id] || {});
  }, [selectedPackage, criteriaMap, vendor]);

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Vendor Summary */}
        <View style={styles.summaryBar}>
          <View style={styles.summaryAvatar}>
            <Text style={styles.summaryAvatarText}>{(vendor.businessName || 'V')[0].toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="titleMedium" style={{ fontWeight: '700', color: Colors.textPrimary }}>{vendor.businessName}</Text>
            <Text variant="bodySmall" style={{ color: Colors.textSecondary }}>{vendor.category} • ⭐ {vendor.averageRating ? Number(vendor.averageRating).toFixed(1) : 'N/A'}</Text>
          </View>
        </View>

        <Divider />

        {/* Package Catalog */}
        {packageCatalog.length === 0 ? (
          <View style={styles.emptySection}>
            <Text variant="bodyLarge" style={{ color: Colors.textMuted, textAlign: 'center' }}>No packages available yet.</Text>
            {canBook && (
              <Button mode="contained" style={styles.bookBtn} onPress={() => openBooking(null)}>
                Book at Base Price — {formatCurrency(vendor.basePrice)}
              </Button>
            )}
          </View>
        ) : (
          <View style={styles.section}>
            <Text variant="titleMedium" style={styles.sectionTitle}>Available Packages ({packageCatalog.length})</Text>
            {packageCatalog.map((pkg) => {
              const deliverables = Array.isArray(pkg.deliverables) ? pkg.deliverables : [];
              return (
                <Card key={pkg.id} style={styles.packageCard}>
                  <Card.Content>
                    {/* Title + Price Row */}
                    <View style={styles.pkgTitleRow}>
                      <View style={{ flex: 1 }}>
                        <Text variant="titleMedium" style={styles.pkgTitle}>{pkg.title}</Text>
                        <View style={styles.pkgChipRow}>
                          <Chip compact style={styles.tierChip} textStyle={styles.tierChipText}>{pkg.tier}</Chip>
                          <Chip compact style={styles.catLabelChip} textStyle={{ textTransform: 'capitalize', fontSize: 11 }}>{pkg.category}</Chip>
                        </View>
                      </View>
                      <View style={styles.priceBlock}>
                        <Text variant="headlineSmall" style={styles.pkgPrice}>{formatCurrency(pkg.basePrice)}</Text>
                        {pkg.unitLabel ? <Text variant="labelSmall" style={styles.unitLabel}>per {pkg.unitLabel}</Text> : null}
                      </View>
                    </View>

                    {/* Description */}
                    <Text variant="bodyMedium" style={styles.pkgDesc}>{pkg.description}</Text>

                    {/* Category-specific pricing details */}
                    {renderPricingDetails(pkg)}

                    {/* Deliverables */}
                    {deliverables.length > 0 && (
                      <View style={styles.deliverablesList}>
                        <Text variant="labelLarge" style={styles.deliverablesTitle}>What's Included:</Text>
                        {deliverables.map((d, i) => (
                          <Text key={i} variant="bodySmall" style={styles.deliverableItem}>✓  {typeof d === 'string' ? d : d.item || d.name || JSON.stringify(d)}</Text>
                        ))}
                      </View>
                    )}

                    {/* Criteria inputs for price estimation */}
                    {canBook && renderCriteriaInputs(pkg)}

                    {/* Book Button */}
                    {canBook && (
                      <Button
                        mode="contained"
                        icon="cart-plus"
                        style={styles.bookBtn}
                        contentStyle={{ paddingVertical: 4 }}
                        labelStyle={{ fontWeight: '700' }}
                        onPress={() => openBooking(pkg)}
                      >
                        Book This Package
                      </Button>
                    )}
                  </Card.Content>
                </Card>
              );
            })}
          </View>
        )}

        <View style={{ height: 30 }} />
      </ScrollView>

      {/* Booking Modal */}
      <Portal>
        <Modal visible={bookingModal} onDismiss={() => setBookingModal(false)} contentContainerStyle={styles.modal}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text variant="titleLarge" style={styles.modalTitle}>Book {vendor.businessName}</Text>
            {selectedPackage && (
              <>
                <Chip icon="package-variant" style={{ alignSelf: 'flex-start', marginBottom: Spacing.sm }}>
                  {selectedPackage.title} — {formatCurrency(selectedPackage.basePrice)}
                </Chip>
                {renderPricingDetails(selectedPackage)}
                {(() => {
                  const c = criteriaMap[selectedPackage.id] || {};
                  const parts = [];
                  if (Number(c.guests || 0) > 0) parts.push(`${c.guests} guests`);
                  if (Number(c.hours || 0) > 0) parts.push(`${c.hours} hours`);
                  return parts.length > 0 ? (
                    <View style={styles.modalEstimate}>
                      <Text variant="bodySmall" style={{ color: Colors.textSecondary }}>{parts.join(' • ')}</Text>
                      <Text variant="titleLarge" style={styles.estimatedPrice}>Estimated: {formatCurrency(bookingEstimatedPrice)}</Text>
                    </View>
                  ) : null;
                })()}
              </>
            )}

            <Divider style={{ marginVertical: Spacing.md }} />

            <Text variant="labelLarge" style={{ marginBottom: 4, fontWeight: '600' }}>Select Event</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.md, maxHeight: 44 }}>
              {events.map((evt) => (
                <Chip key={evt.id} selected={selectedEvent === evt.id} onPress={() => setSelectedEvent(evt.id)} style={{ marginRight: Spacing.sm }}>
                  {evt.title}
                </Chip>
              ))}
            </ScrollView>
            {events.length === 0 && (
              <Text variant="bodySmall" style={{ color: Colors.warning, marginBottom: Spacing.sm }}>No events found. Create an event first.</Text>
            )}
            <DatePickerInput label="Service Date" value={serviceDate} onChange={setServiceDate} style={{ marginBottom: Spacing.md }} />
            <TextInput label="Notes (optional)" value={notes} onChangeText={setNotes} mode="outlined" multiline numberOfLines={3} style={{ marginBottom: Spacing.lg }} outlineStyle={{ borderRadius: Radius.sm }} />
            <Button mode="contained" onPress={handleBook} loading={submitting} disabled={submitting || !selectedEvent || !serviceDate} style={styles.bookBtn} labelStyle={{ fontWeight: '600' }}>
              Confirm Booking — {formatCurrency(bookingEstimatedPrice)}
            </Button>
          </ScrollView>
        </Modal>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  summaryBar: { flexDirection: 'row', alignItems: 'center', padding: Spacing.lg, gap: Spacing.md, backgroundColor: Colors.surface },
  summaryAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  summaryAvatarText: { color: '#fff', fontSize: 20, fontWeight: '800' },
  section: { padding: Spacing.lg },
  sectionTitle: { fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.md },
  emptySection: { padding: Spacing.xxl, alignItems: 'center' },
  packageCard: { marginBottom: Spacing.lg, borderRadius: Radius.lg, elevation: 3, backgroundColor: Colors.surface },
  pkgTitleRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm },
  pkgTitle: { fontWeight: '800', color: Colors.textPrimary, marginBottom: 4 },
  pkgChipRow: { flexDirection: 'row', gap: Spacing.xs },
  tierChip: { backgroundColor: Colors.primary + '18' },
  tierChipText: { color: Colors.primary, fontWeight: '600', fontSize: 11 },
  catLabelChip: { backgroundColor: Colors.surfaceVariant },
  priceBlock: { alignItems: 'flex-end' },
  pkgPrice: { fontWeight: '800', color: Colors.primary },
  unitLabel: { color: Colors.textMuted },
  pkgDesc: { color: Colors.textSecondary, lineHeight: 22, marginBottom: Spacing.md },
  pricingTagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: Spacing.md },
  pricingChip: { backgroundColor: '#fff5e6', borderWidth: 1, borderColor: '#d4a64233' },
  pricingChipText: { color: '#8a6d2b', fontSize: 11, fontWeight: '600' },
  customPricingChip: { backgroundColor: '#e8f5e9', borderWidth: 1, borderColor: '#4caf5033' },
  customPricingChipText: { color: '#2e7d32', fontSize: 11, fontWeight: '600' },
  deliverablesList: { marginBottom: Spacing.md, padding: Spacing.md, backgroundColor: Colors.background, borderRadius: Radius.sm },
  deliverablesTitle: { fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.sm },
  deliverableItem: { color: Colors.success, marginBottom: 4, paddingLeft: 4 },
  criteriaBox: { backgroundColor: '#f0f5ff', borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.md },
  criteriaTitle: { fontWeight: '700', color: Colors.primary, marginBottom: Spacing.sm },
  criteriaRow: { flexDirection: 'row', gap: Spacing.md },
  criteriaInput: { flex: 1, backgroundColor: '#fff' },
  estimatedRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.md, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.primary + '22' },
  estimatedPrice: { fontWeight: '800', color: Colors.primary },
  bookBtn: { marginTop: Spacing.md, backgroundColor: Colors.primary, borderRadius: Radius.sm },
  modal: { backgroundColor: Colors.surface, margin: Spacing.lg, borderRadius: Radius.lg, padding: Spacing.xl, maxHeight: '85%' },
  modalTitle: { fontWeight: '800', marginBottom: Spacing.lg, color: Colors.textPrimary },
  modalEstimate: { marginTop: Spacing.sm, padding: Spacing.md, backgroundColor: Colors.background, borderRadius: Radius.sm, alignItems: 'center' },
});

export default VendorPackagesScreen;
