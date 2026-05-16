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

const CORE_RULE_KEYS = new Set(['fixed', 'perGuest', 'perPlate', 'perHour', 'minPlates']);

const toRuleLabel = (key) =>
  key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^./, (s) => s.toUpperCase())
    .trim();

const getAddonKeys = (pkg) => {
  const rules = pkg?.estimationRules || {};
  return Object.entries(rules)
    .filter(([key, value]) => !CORE_RULE_KEYS.has(key) && Number(value) > 0)
    .map(([key]) => key);
};

/* ── Price estimation (mirrors backend estimatePackagePrice) ── */
const estimatePrice = (pkg, criteria = {}) => {
  const rules = pkg.estimationRules || {};
  const guestsInput = Number(criteria.guests || 0);
  const hours = Number(criteria.hours || 0);
  const minGuests = Number(rules.minPlates || 0);
  const guests = guestsInput > 0 ? Math.max(guestsInput, minGuests) : 0;
  const base = Number(pkg.basePrice || 0);
  const perGuest = Number(rules.perGuest || rules.perPlate || 0);
  const perHour = Number(rules.perHour || 0);
  const fixed = Number(rules.fixed || 0);

  const addonQty = criteria.addons || {};
  const addonTotal = Object.entries(addonQty).reduce((sum, [key, qtyRaw]) => {
    const rate = Number(rules[key] || 0);
    const qty = Number(qtyRaw || 0);
    if (rate <= 0 || qty <= 0) return sum;
    return sum + rate * qty;
  }, 0);

  return Math.max(0, Math.round((base + fixed + perGuest * guests + perHour * hours + addonTotal) * 100) / 100);
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
  const [criteriaMap, setCriteriaMap] = useState({}); // { [pkgId]: { guests, hours, addons: { ruleKey: qty } } }

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

  const updateAddonQty = (pkgId, addonKey, value) => {
    const parsed = value === '' ? '' : String(value).replace(/[^0-9]/g, '');
    setCriteriaMap((prev) => ({
      ...prev,
      [pkgId]: {
        ...prev[pkgId],
        addons: {
          ...(prev[pkgId]?.addons || {}),
          [addonKey]: parsed,
        },
      },
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
      const addonSummary = Object.entries(criteria.addons || {})
        .filter(([, qty]) => Number(qty || 0) > 0)
        .map(([key, qty]) => `${toRuleLabel(key)} x ${qty}`)
        .join(', ');
      await bookingService.createBooking({
        vendor: vendorId,
        event: selectedEvent,
        price,
        serviceDate: new Date(serviceDate).toISOString(),
        notes: notes || `Package: ${selectedPackage?.title || 'Standard'}${criteria.guests ? ` | Guests: ${criteria.guests}` : ''}${criteria.hours ? ` | Hours: ${criteria.hours}` : ''}${addonSummary ? ` | Add-ons: ${addonSummary}` : ''}`,
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
    const minPlates = Number(rules.minPlates || 0);
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
        {hasPerGuest && minPlates > 0 && (
          <Text variant="bodySmall" style={{ color: Colors.textMuted, marginTop: 6 }}>
            Minimum billable guests/plates: {minPlates}
          </Text>
        )}
        {(Number(criteria.guests || 0) > 0 || Number(criteria.hours || 0) > 0) && (
          <View style={styles.estimatedRow}>
            <Text variant="labelMedium" style={{ color: Colors.textSecondary }}>Estimated Total:</Text>
            <Text variant="titleMedium" style={styles.estimatedPrice}>{formatCurrency(estimated)}</Text>
          </View>
        )}
      </View>
    );
  };

  const renderAddonCustomizer = (pkg) => {
    const addonKeys = getAddonKeys(pkg);
    if (addonKeys.length === 0) return null;

    const criteria = criteriaMap[pkg.id] || {};
    const addonQty = criteria.addons || {};

    return (
      <View style={styles.addonBox}>
        <Text variant="labelLarge" style={styles.addonTitle}>Customize Add-ons</Text>
        {addonKeys.map((key) => {
          const rate = Number(pkg.estimationRules?.[key] || 0);
          const qtyVal = addonQty[key]?.toString() || '';
          const qtyNum = Number(qtyVal || 0);
          const lineTotal = rate * qtyNum;

          return (
            <View key={key} style={styles.addonRow}>
              <View style={{ flex: 1, paddingRight: Spacing.sm }}>
                <Text style={styles.addonName}>{toRuleLabel(key)}</Text>
                <Text style={styles.addonRate}>{formatCurrency(rate)} each</Text>
              </View>
              <TextInput
                label="Qty"
                value={qtyVal}
                onChangeText={(v) => updateAddonQty(pkg.id, key, v)}
                keyboardType="numeric"
                mode="outlined"
                dense
                style={styles.addonQtyInput}
                outlineStyle={{ borderRadius: Radius.sm }}
              />
              <Text style={styles.addonLineTotal}>{lineTotal > 0 ? formatCurrency(lineTotal) : '—'}</Text>
            </View>
          );
        })}
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
                        {pkg.unitLabel ? <Text variant="labelSmall" style={styles.unitLabel}>per {String(pkg.unitLabel).replace(/^per\s+/i, '')}</Text> : null}
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

                    {/* Add-on customization */}
                    {canBook && renderAddonCustomizer(pkg)}

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
                  const addonParts = Object.entries(c.addons || {})
                    .filter(([, qty]) => Number(qty || 0) > 0)
                    .map(([key, qty]) => `${toRuleLabel(key)} x ${qty}`);
                  if (addonParts.length > 0) parts.push(...addonParts);
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
  addonBox: { backgroundColor: '#fffaf1', borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.md, borderWidth: 1, borderColor: '#f1d8a5' },
  addonTitle: { fontWeight: '700', color: '#8a6d2b', marginBottom: Spacing.sm },
  addonRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm },
  addonName: { color: Colors.textPrimary, fontWeight: '600', fontSize: 13 },
  addonRate: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  addonQtyInput: { width: 88, marginRight: Spacing.sm, backgroundColor: '#fff' },
  addonLineTotal: { minWidth: 78, textAlign: 'right', color: Colors.primary, fontWeight: '700', fontSize: 12 },
  bookBtn: { marginTop: Spacing.md, backgroundColor: Colors.primary, borderRadius: Radius.sm },
  modal: { backgroundColor: Colors.surface, margin: Spacing.lg, borderRadius: Radius.lg, padding: Spacing.xl, maxHeight: '85%' },
  modalTitle: { fontWeight: '800', marginBottom: Spacing.lg, color: Colors.textPrimary },
  modalEstimate: { marginTop: Spacing.sm, padding: Spacing.md, backgroundColor: Colors.background, borderRadius: Radius.sm, alignItems: 'center' },
});

export default VendorPackagesScreen;
