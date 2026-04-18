import React, { useContext, useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, Image, Dimensions } from 'react-native';
import { Text, Card, Button, Chip, Divider, ActivityIndicator } from 'react-native-paper';
import { AuthContext } from '../context/AuthContext';
import { vendorService } from '../services/vendorService';
import { formatCurrency, getErrorMessage } from '../utils/helpers';
import { Colors, Spacing, Radius } from '../theme';

const { width: SCREEN_W } = Dimensions.get('window');

const VendorDetailScreen = ({ route, navigation }) => {
  const { vendorId } = route.params;
  const { user } = useContext(AuthContext);
  const [vendor, setVendor] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await vendorService.getVendorById(vendorId);
        setVendor(data.vendor || data);
      } catch (err) {
        Alert.alert('Error', getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [vendorId]);

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color={Colors.primary} />;
  if (!vendor) return <Text style={{ textAlign: 'center', marginTop: 40 }}>Vendor not found</Text>;

  const portfolio = Array.isArray(vendor.portfolio) ? vendor.portfolio : [];
  const testimonials = vendor.testimonials || [];
  const reviews = vendor.reviews || [];
  const packageCatalog = vendor.packageCatalog || [];
  const canBook = user && ['organizer', 'customer', 'admin'].includes(user.role);
  const contactInfo = [
    vendor.contactPhone && { icon: '📞', value: vendor.contactPhone },
    vendor.contactEmail && { icon: '📧', value: vendor.contactEmail },
    vendor.website && { icon: '🌐', value: vendor.website },
  ].filter(Boolean);
  const socialLinks = vendor.socialLinks && typeof vendor.socialLinks === 'object' ? vendor.socialLinks : {};
  const hasSocials = Object.values(socialLinks).some(Boolean);

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* ── Hero / Header ── */}
        <View style={styles.hero}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarLetter}>{(vendor.businessName || 'V')[0].toUpperCase()}</Text>
          </View>
          <Text variant="headlineMedium" style={styles.bizName}>{vendor.businessName}</Text>
          <View style={styles.chipRow}>
            <Chip compact style={styles.catChip} textStyle={styles.catChipText}>{vendor.category}</Chip>
            {vendor.isVerified && (
              <Chip compact icon="check-decagram" style={styles.verifiedChip} textStyle={{ color: Colors.success }}>Verified</Chip>
            )}
          </View>
          <Text variant="bodyMedium" style={styles.ratingLine}>
            ⭐ {vendor.averageRating ? Number(vendor.averageRating).toFixed(1) : 'N/A'} ({vendor.totalReviews || 0} reviews)
          </Text>
          {(vendor.city || vendor.state) && (
            <Text variant="bodySmall" style={styles.locationLine}>📍 {[vendor.city, vendor.state].filter(Boolean).join(', ')}</Text>
          )}
          <Text variant="titleMedium" style={styles.basePrice}>Starting at {formatCurrency(vendor.basePrice)}</Text>
        </View>

        {/* ── About ── */}
        {vendor.description ? (
          <View style={styles.section}>
            <Text variant="titleMedium" style={styles.sectionTitle}>About</Text>
            <Text variant="bodyMedium" style={styles.aboutText}>{vendor.description}</Text>
          </View>
        ) : null}

        {/* ── Contact Info ── */}
        {(contactInfo.length > 0 || hasSocials) && (
          <View style={styles.section}>
            <Text variant="titleMedium" style={styles.sectionTitle}>Contact</Text>
            {contactInfo.map((c, i) => (
              <Text key={i} variant="bodyMedium" style={styles.contactItem}>{c.icon}  {c.value}</Text>
            ))}
            {hasSocials && (
              <View style={styles.socialRow}>
                {socialLinks.instagram ? <Chip compact icon="instagram" style={styles.socialChip}>{socialLinks.instagram}</Chip> : null}
                {socialLinks.facebook ? <Chip compact icon="facebook" style={styles.socialChip}>{socialLinks.facebook}</Chip> : null}
                {socialLinks.youtube ? <Chip compact icon="youtube" style={styles.socialChip}>{socialLinks.youtube}</Chip> : null}
              </View>
            )}
          </View>
        )}

        <Divider style={styles.divider} />

        {/* ── Portfolio / Media ── */}
        {portfolio.length > 0 && (
          <View style={styles.section}>
            <Text variant="titleMedium" style={styles.sectionTitle}>Portfolio ({portfolio.length})</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mediaScroll}>
              {portfolio.map((item, idx) => {
                const url = typeof item === 'string' ? item : item.url;
                if (!url) return null;
                return (
                  <View key={idx} style={styles.mediaThumb}>
                    <Image source={{ uri: url }} style={styles.mediaImage} resizeMode="cover" />
                    {typeof item === 'object' && item.caption ? (
                      <Text variant="labelSmall" style={styles.mediaCaption} numberOfLines={1}>{item.caption}</Text>
                    ) : null}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}

        <Divider style={styles.divider} />

        {/* ── Testimonials ── */}
        {testimonials.length > 0 && (
          <View style={styles.section}>
            <Text variant="titleMedium" style={styles.sectionTitle}>Testimonials ({testimonials.length})</Text>
            {testimonials.map((t) => (
              <Card key={t.id} style={styles.testimonialCard}>
                <Card.Content>
                  <View style={styles.testimonialHeader}>
                    <View style={styles.testimonialAvatar}>
                      <Text style={styles.testimonialAvatarText}>{(t.clientName || 'C')[0].toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text variant="titleSmall" style={{ fontWeight: '700', color: Colors.textPrimary }}>{t.clientName}</Text>
                      <Text variant="bodySmall" style={{ color: '#d4a642' }}>{'★'.repeat(t.rating)}{'☆'.repeat(5 - t.rating)}</Text>
                    </View>
                  </View>
                  <Text variant="bodyMedium" style={styles.testimonialContent}>"{t.content}"</Text>
                  {t.source ? <Text variant="labelSmall" style={{ color: Colors.textMuted, marginTop: 4 }}>— via {t.source}</Text> : null}
                </Card.Content>
              </Card>
            ))}
          </View>
        )}

        {/* ── Reviews ── */}
        {reviews.length > 0 && (
          <View style={styles.section}>
            <Text variant="titleMedium" style={styles.sectionTitle}>Reviews ({reviews.length})</Text>
            {reviews.map((review) => (
              <Card key={review.id} style={styles.reviewCard}>
                <Card.Content>
                  <View style={styles.reviewHeader}>
                    <Text variant="titleSmall" style={{ fontWeight: '600' }}>{review.user?.name || 'User'}</Text>
                    <Text variant="bodySmall" style={{ color: '#d4a642' }}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</Text>
                  </View>
                  <Text variant="bodySmall" style={styles.reviewComment}>{review.comment}</Text>
                </Card.Content>
              </Card>
            ))}
          </View>
        )}

        <Divider style={styles.divider} />

        {/* ── View Packages Button ── */}
        <View style={styles.section}>
          <Button
            mode="contained"
            icon="package-variant"
            style={styles.viewPackagesBtn}
            contentStyle={{ paddingVertical: 8 }}
            labelStyle={{ fontSize: 16, fontWeight: '700' }}
            onPress={() => navigation.navigate('VendorPackages', { vendorId, vendor })}
          >
            View Packages & Book ({packageCatalog.length})
          </Button>
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  hero: { alignItems: 'center', padding: Spacing.xl, paddingTop: Spacing.xxl, backgroundColor: Colors.surface },
  avatarCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.md,
  },
  avatarLetter: { color: '#fff', fontSize: 32, fontWeight: '800' },
  bizName: { fontWeight: '800', color: Colors.textPrimary, textAlign: 'center' },
  chipRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  catChip: { backgroundColor: Colors.surfaceVariant },
  catChipText: { textTransform: 'capitalize' },
  verifiedChip: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.success + '44' },
  ratingLine: { color: Colors.textSecondary, marginTop: Spacing.sm },
  locationLine: { color: Colors.textMuted, marginTop: 2 },
  basePrice: { color: Colors.primary, fontWeight: '800', marginTop: Spacing.md },
  section: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  sectionTitle: { fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.md },
  aboutText: { color: Colors.textSecondary, lineHeight: 22 },
  contactItem: { color: Colors.textPrimary, marginBottom: 6 },
  socialRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.sm },
  socialChip: { backgroundColor: Colors.surfaceVariant },
  divider: { marginHorizontal: Spacing.lg },
  mediaScroll: { marginBottom: Spacing.sm },
  mediaThumb: { width: SCREEN_W * 0.55, marginRight: Spacing.md, borderRadius: Radius.md, overflow: 'hidden', backgroundColor: Colors.surfaceVariant },
  mediaImage: { width: '100%', height: SCREEN_W * 0.4, borderRadius: Radius.md },
  mediaCaption: { color: Colors.textMuted, paddingHorizontal: 6, paddingVertical: 4 },
  testimonialCard: { marginBottom: Spacing.md, borderRadius: Radius.md, elevation: 1, backgroundColor: Colors.surface },
  testimonialHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  testimonialAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#d4a642', justifyContent: 'center', alignItems: 'center' },
  testimonialAvatarText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  testimonialContent: { color: Colors.textSecondary, fontStyle: 'italic', lineHeight: 22 },
  reviewCard: { marginBottom: Spacing.sm, borderRadius: Radius.sm, elevation: 1, backgroundColor: Colors.surface },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reviewComment: { color: Colors.textSecondary, marginTop: 4 },
  viewPackagesBtn: { backgroundColor: Colors.primary, borderRadius: Radius.md },
});

export default VendorDetailScreen;
