import React, { useContext, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, Image, Dimensions, Modal as RNModal, TouchableOpacity, Animated } from 'react-native';
import { Text, Card, Button, Chip, Divider, ActivityIndicator } from 'react-native-paper';
import { PinchGestureHandler, State as GestureState } from 'react-native-gesture-handler';
import { AuthContext } from '../context/AuthContext';
import { vendorService } from '../services/vendorService';
import { aiService } from '../services/aiService';
import { formatCurrency, getErrorMessage } from '../utils/helpers';
import { Colors, Spacing, Radius } from '../theme';

const { width: SCREEN_W } = Dimensions.get('window');

const VendorDetailScreen = ({ route, navigation }) => {
  const { vendorId } = route.params;
  const { user } = useContext(AuthContext);
  const [vendor, setVendor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reviewSummary, setReviewSummary] = useState(null);
  const [loadingReviewSummary, setLoadingReviewSummary] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerImageIndex, setViewerImageIndex] = useState(0);
  const [viewerZoom, setViewerZoom] = useState(1);
  const baseScale = useRef(new Animated.Value(1)).current;
  const pinchScale = useRef(new Animated.Value(1)).current;
  const lastScaleRef = useRef(1);
  const animatedScale = Animated.multiply(baseScale, pinchScale);

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
  if (!vendor) return <Text style={{ textAlign: 'center', marginTop: 40 }}>Wedding vendor not found</Text>;

  const portfolio = Array.isArray(vendor.portfolio) ? vendor.portfolio : [];
  const testimonials = vendor.testimonials || [];
  const reviews = vendor.reviews || [];
  const packageCatalog = vendor.packageCatalog || [];
  const portfolioImages = portfolio.filter((item) => {
    const url = typeof item === 'string' ? item : item?.url;
    return Boolean(url);
  });
  const canBook = user && ['organizer', 'customer', 'admin'].includes(user.role);
  const contactInfo = [
    vendor.contactPhone && { icon: '📞', value: vendor.contactPhone },
    vendor.contactEmail && { icon: '📧', value: vendor.contactEmail },
    vendor.website && { icon: '🌐', value: vendor.website },
  ].filter(Boolean);
  const socialLinks = vendor.socialLinks && typeof vendor.socialLinks === 'object' ? vendor.socialLinks : {};
  const hasSocials = Object.values(socialLinks).some(Boolean);

  const openImageViewer = (index) => {
    setViewerImageIndex(index);
    setViewerZoom(1);
    lastScaleRef.current = 1;
    baseScale.setValue(1);
    pinchScale.setValue(1);
    setViewerVisible(true);
  };

  const closeImageViewer = () => {
    setViewerVisible(false);
    setViewerZoom(1);
    lastScaleRef.current = 1;
    baseScale.setValue(1);
    pinchScale.setValue(1);
  };

  const zoomIn = () => {
    setViewerZoom((z) => {
      const next = Math.min(3, Number((z + 0.25).toFixed(2)));
      lastScaleRef.current = next;
      baseScale.setValue(next);
      pinchScale.setValue(1);
      return next;
    });
  };
  const zoomOut = () => {
    setViewerZoom((z) => {
      const next = Math.max(1, Number((z - 0.25).toFixed(2)));
      lastScaleRef.current = next;
      baseScale.setValue(next);
      pinchScale.setValue(1);
      return next;
    });
  };
  const onPinchGestureEvent = Animated.event(
    [{ nativeEvent: { scale: pinchScale } }],
    { useNativeDriver: true }
  );
  const onPinchStateChange = (event) => {
    if (event.nativeEvent.oldState === GestureState.ACTIVE) {
      const next = Math.min(3, Math.max(1, lastScaleRef.current * event.nativeEvent.scale));
      lastScaleRef.current = next;
      baseScale.setValue(next);
      pinchScale.setValue(1);
      setViewerZoom(Number(next.toFixed(2)));
    }
  };
  const currentImage = portfolioImages[viewerImageIndex];
  const currentImageUrl = currentImage ? (typeof currentImage === 'string' ? currentImage : currentImage.url) : null;

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
          <Text variant="titleMedium" style={styles.basePrice}>Starting at {formatCurrency(
            packageCatalog.length > 0
              ? Math.min(...packageCatalog.map((p) => Number(p.basePrice ?? 0)), Number(vendor.basePrice ?? 0))
              : Number(vendor.basePrice ?? 0)
          )}</Text>
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
            <Text variant="titleMedium" style={styles.sectionTitle}>Wedding Portfolio ({portfolio.length})</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mediaScroll}>
              {portfolio.map((item, idx) => {
                const url = typeof item === 'string' ? item : item.url;
                if (!url) return null;
                return (
                  <TouchableOpacity key={idx} style={styles.mediaThumb} activeOpacity={0.9} onPress={() => openImageViewer(idx)}>
                    <Image source={{ uri: url }} style={styles.mediaImage} resizeMode="cover" />
                    <View style={styles.fullscreenHint}>
                      <Text variant="labelSmall" style={styles.fullscreenHintText}>Tap to view full screen</Text>
                    </View>
                    {typeof item === 'object' && item.caption ? (
                      <Text variant="labelSmall" style={styles.mediaCaption} numberOfLines={1}>{item.caption}</Text>
                    ) : null}
                  </TouchableOpacity>
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
                      <Text variant="bodySmall" style={{ color: Colors.primaryDark }}>{'★'.repeat(t.rating)}{'☆'.repeat(5 - t.rating)}</Text>
                    </View>
                  </View>
                  <Text variant="bodyMedium" style={styles.testimonialContent}>"{t.content}"</Text>
                  {t.source ? <Text variant="labelSmall" style={{ color: Colors.textMuted, marginTop: 4 }}>— via {t.source}</Text> : null}
                </Card.Content>
              </Card>
            ))}
          </View>
        )}

        {/* ── AI Review Summary ── */}
        {reviews.length >= 2 && (
          <View style={styles.section}>
            <Text variant="titleMedium" style={styles.sectionTitle}>AI Review Summary</Text>
            {!reviewSummary ? (
              <Button mode="contained-tonal" icon="brain" loading={loadingReviewSummary} onPress={async () => {
                setLoadingReviewSummary(true);
                try {
                  const res = await aiService.getVendorReviewSummary(vendorId);
                  setReviewSummary(res);
                } catch (err) { Alert.alert('Error', getErrorMessage(err)); }
                finally { setLoadingReviewSummary(false); }
              }} style={{ borderRadius: Radius.sm }}>
                Summarize Reviews with AI
              </Button>
            ) : (
              <Card style={styles.reviewCard}>
                <Card.Content>
                  <Chip compact style={{ alignSelf: 'flex-start', marginBottom: 8 }}>{reviewSummary.source === 'groq' ? 'Groq AI' : reviewSummary.source === 'openai' ? 'OpenAI' : 'Rule-based'}</Chip>
                  <Text variant="bodyMedium" style={{ color: Colors.textPrimary, marginBottom: 8 }}>{reviewSummary.summary}</Text>
                  {reviewSummary.strengths?.length ? (
                    <View style={{ marginBottom: 6 }}>
                      <Text variant="labelLarge" style={{ fontWeight: '700' }}>Strengths</Text>
                      {reviewSummary.strengths.map((s, i) => <Text key={i} variant="bodySmall" style={{ color: Colors.textSecondary }}>• {s}</Text>)}
                    </View>
                  ) : null}
                  {reviewSummary.watchOuts?.length ? (
                    <View style={{ marginBottom: 6 }}>
                      <Text variant="labelLarge" style={{ fontWeight: '700' }}>Watch out for</Text>
                      {reviewSummary.watchOuts.map((s, i) => <Text key={i} variant="bodySmall" style={{ color: Colors.textSecondary }}>• {s}</Text>)}
                    </View>
                  ) : null}
                  {reviewSummary.bestFor ? <Text variant="bodySmall" style={{ color: Colors.primary, fontWeight: '600' }}>Best for: {reviewSummary.bestFor}</Text> : null}
                </Card.Content>
              </Card>
            )}
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
                    <Text variant="bodySmall" style={{ color: Colors.primaryDark }}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</Text>
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

      <RNModal visible={viewerVisible} animationType="fade" transparent onRequestClose={closeImageViewer}>
        <View style={styles.viewerOverlay}>
          <View style={styles.viewerTopBar}>
            <TouchableOpacity onPress={zoomOut} style={styles.viewerTopBtn}><Text style={styles.viewerTopBtnText}>-</Text></TouchableOpacity>
            <Text style={styles.viewerZoomText}>{Math.round(viewerZoom * 100)}%</Text>
            <TouchableOpacity onPress={zoomIn} style={styles.viewerTopBtn}><Text style={styles.viewerTopBtnText}>+</Text></TouchableOpacity>
            <TouchableOpacity onPress={closeImageViewer} style={styles.viewerTopBtn}><Text style={styles.viewerTopBtnText}>Close</Text></TouchableOpacity>
          </View>

          <View style={styles.viewerBody}>
            {currentImageUrl ? (
              <PinchGestureHandler onGestureEvent={onPinchGestureEvent} onHandlerStateChange={onPinchStateChange}>
                <Animated.View style={styles.viewerPinchArea}>
                  <Animated.Image
                    source={{ uri: currentImageUrl }}
                    style={[styles.viewerImage, { transform: [{ scale: animatedScale }] }]}
                    resizeMode="contain"
                  />
                </Animated.View>
              </PinchGestureHandler>
            ) : null}
          </View>

          <View style={styles.viewerBottomBar}>
            <TouchableOpacity
              disabled={viewerImageIndex <= 0}
              onPress={() => {
                setViewerImageIndex((i) => Math.max(0, i - 1));
                setViewerZoom(1);
                lastScaleRef.current = 1;
                baseScale.setValue(1);
                pinchScale.setValue(1);
              }}
              style={[styles.viewerNavBtn, viewerImageIndex <= 0 && styles.viewerNavBtnDisabled]}
            >
              <Text style={styles.viewerNavBtnText}>Prev</Text>
            </TouchableOpacity>
            <Text style={styles.viewerCountText}>{portfolioImages.length ? `${viewerImageIndex + 1} / ${portfolioImages.length}` : ''}</Text>
            <TouchableOpacity
              disabled={viewerImageIndex >= portfolioImages.length - 1}
              onPress={() => {
                setViewerImageIndex((i) => Math.min(portfolioImages.length - 1, i + 1));
                setViewerZoom(1);
                lastScaleRef.current = 1;
                baseScale.setValue(1);
                pinchScale.setValue(1);
              }}
              style={[styles.viewerNavBtn, viewerImageIndex >= portfolioImages.length - 1 && styles.viewerNavBtnDisabled]}
            >
              <Text style={styles.viewerNavBtnText}>Next</Text>
            </TouchableOpacity>
          </View>
        </View>
      </RNModal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  hero: { alignItems: 'center', padding: Spacing.xl, paddingTop: Spacing.xxl, backgroundColor: Colors.secondary, borderBottomLeftRadius: Radius.lg, borderBottomRightRadius: Radius.lg },
  avatarCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.md,
  },
  avatarLetter: { color: Colors.textOnPrimary, fontSize: 32, fontWeight: '800' },
  bizName: { fontWeight: '800', color: Colors.textOnDark, textAlign: 'center' },
  chipRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  catChip: { backgroundColor: Colors.surfaceVariant },
  catChipText: { textTransform: 'capitalize' },
  verifiedChip: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.success + '44' },
  ratingLine: { color: Colors.textOnDark, marginTop: Spacing.sm },
  locationLine: { color: 'rgba(249, 244, 232, 0.86)', marginTop: 2 },
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
  fullscreenHint: { position: 'absolute', right: 6, bottom: 6, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  fullscreenHintText: { color: Colors.textOnDark, fontSize: 10, fontWeight: '600' },
  mediaCaption: { color: Colors.textMuted, paddingHorizontal: 6, paddingVertical: 4 },
  viewerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)' },
  viewerTopBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', paddingTop: Spacing.xxl, paddingHorizontal: Spacing.lg, gap: Spacing.sm },
  viewerTopBtn: { backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6 },
  viewerTopBtnText: { color: Colors.textOnDark, fontWeight: '700' },
  viewerZoomText: { color: Colors.textOnDark, fontWeight: '700', marginRight: Spacing.sm },
  viewerBody: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.md },
  viewerPinchArea: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  viewerImage: { width: SCREEN_W * 0.92, height: '85%' },
  viewerBottomBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xl },
  viewerNavBtn: { backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8 },
  viewerNavBtnDisabled: { opacity: 0.35 },
  viewerNavBtnText: { color: Colors.textOnDark, fontWeight: '700' },
  viewerCountText: { color: Colors.textOnDark, fontWeight: '600' },
  testimonialCard: { marginBottom: Spacing.md, borderRadius: Radius.md, elevation: 1, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  testimonialHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  testimonialAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  testimonialAvatarText: { color: Colors.textOnPrimary, fontWeight: '700', fontSize: 16 },
  testimonialContent: { color: Colors.textSecondary, fontStyle: 'italic', lineHeight: 22 },
  reviewCard: { marginBottom: Spacing.sm, borderRadius: Radius.sm, elevation: 1, backgroundColor: Colors.surface },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reviewComment: { color: Colors.textSecondary, marginTop: 4 },
  viewPackagesBtn: { backgroundColor: Colors.primary, borderRadius: Radius.md },
});

export default VendorDetailScreen;
