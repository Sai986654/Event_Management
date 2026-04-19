import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Alert, Platform } from 'react-native';
import { Searchbar, Card, Text, Chip, ActivityIndicator, Button, Menu, IconButton, Divider } from 'react-native-paper';
import * as Location from 'expo-location';
import { vendorService } from '../services/vendorService';
import { formatCurrency, getErrorMessage } from '../utils/helpers';
import { Colors, Spacing, Radius } from '../theme';

const CATEGORIES = ['all', 'catering', 'photography', 'videography', 'music', 'florist', 'venue', 'decor', 'transportation', 'other'];

const CATEGORY_ICONS = {
  all: 'apps',
  catering: 'silverware-fork-knife',
  photography: 'camera',
  videography: 'video',
  music: 'music',
  florist: 'flower',
  venue: 'office-building',
  decor: 'lamp',
  transportation: 'car',
  other: 'dots-horizontal',
};

const SORT_OPTIONS = [
  { label: 'Top Rated', value: 'top-rated' },
  { label: 'Nearest First', value: 'nearest' },
  { label: 'Price: Low to High', value: 'price-low' },
  { label: 'Price: High to Low', value: 'price-high' },
  { label: 'Most Reviews', value: 'most-reviews' },
];

const VendorListScreen = ({ navigation }) => {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [sortBy, setSortBy] = useState('top-rated');
  const [sortMenuVisible, setSortMenuVisible] = useState(false);

  // Location state
  const [nearMe, setNearMe] = useState(false);
  const [userLocation, setUserLocation] = useState(null); // { latitude, longitude }
  const [locationCity, setLocationCity] = useState('');
  const [radiusKm, setRadiusKm] = useState(50);
  const [nearbyCount, setNearbyCount] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const locationRequested = useRef(false);

  // Request location permission and get current position
  const requestLocation = useCallback(async () => {
    if (locationLoading) return null;
    setLocationLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location Permission', 'Please enable location access in Settings to see nearby vendors.');
        setNearMe(false);
        return null;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      setUserLocation(coords);

      // Reverse-geocode to get city name
      try {
        const [place] = await Location.reverseGeocodeAsync(coords);
        if (place) {
          setLocationCity(place.city || place.subregion || place.region || '');
        }
      } catch (_) { /* ignore reverse geocode failures */ }

      return coords;
    } catch (err) {
      Alert.alert('Location Error', getErrorMessage(err));
      setNearMe(false);
      return null;
    } finally {
      setLocationLoading(false);
    }
  }, [locationLoading]);

  const fetchVendors = useCallback(async (locOverride) => {
    try {
      const params = {};
      if (category !== 'all') params.category = category;

      const loc = locOverride || userLocation;
      if (nearMe && loc) {
        params.lat = loc.latitude;
        params.lng = loc.longitude;
        params.radius = radiusKm;
      } else if (search) {
        // Use search text as city filter when not in "near me" mode
        params.city = search;
      }

      const data = await vendorService.searchVendors(params);
      setVendors(data.vendors || []);
      setNearbyCount(data.nearby != null ? data.nearby : null);
    } catch (err) {
      console.warn(getErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, category, nearMe, userLocation, radiusKm]);

  // Toggle "Near Me" - request location on first enable
  const handleToggleNearMe = useCallback(async () => {
    if (!nearMe) {
      // Turning ON
      setNearMe(true);
      setLoading(true);
      if (!userLocation) {
        const coords = await requestLocation();
        if (!coords) { setLoading(false); return; }
        fetchVendors(coords);
      } else {
        fetchVendors();
      }
    } else {
      // Turning OFF
      setNearMe(false);
      setUserLocation(null);
      setLocationCity('');
      setNearbyCount(null);
      setLoading(true);
      fetchVendors();
    }
  }, [nearMe, userLocation, requestLocation, fetchVendors]);

  useEffect(() => { fetchVendors(); }, [fetchVendors]);

  const sortedVendors = useMemo(() => {
    const sorted = [...vendors];
    switch (sortBy) {
      case 'top-rated':
        sorted.sort((a, b) => Number(b.averageRating || 0) - Number(a.averageRating || 0));
        break;
      case 'nearest':
        sorted.sort((a, b) => {
          const da = a.distance != null ? a.distance : 99999;
          const db = b.distance != null ? b.distance : 99999;
          return da - db;
        });
        break;
      case 'price-low':
        sorted.sort((a, b) => Number(a.basePrice || 0) - Number(b.basePrice || 0));
        break;
      case 'price-high':
        sorted.sort((a, b) => Number(b.basePrice || 0) - Number(a.basePrice || 0));
        break;
      case 'most-reviews':
        sorted.sort((a, b) => Number(b.totalReviews || 0) - Number(a.totalReviews || 0));
        break;
    }
    return sorted;
  }, [vendors, sortBy]);

  const renderVendor = ({ item }) => {
    const packages = item.packages || [];
    const minPrice = packages.length > 0 ? Math.min(...packages.map((p) => Number(p.price))) : Number(item.basePrice);
    const maxPrice = packages.length > 0 ? Math.max(...packages.map((p) => Number(p.price))) : Number(item.basePrice);
    const ratingVal = item.averageRating ? Number(item.averageRating).toFixed(1) : null;

    return (
      <Card style={styles.vendorCard} onPress={() => navigation.navigate('VendorDetail', { vendorId: item.id })}>
        <Card.Content style={styles.cardContent}>
          {/* Top row: Icon + Name + Verified */}
          <View style={styles.topRow}>
            <View style={styles.iconCircle}>
              <Text style={styles.iconText}>
                {(item.businessName || '?').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.nameBlock}>
              <View style={styles.nameRow}>
                <Text variant="titleMedium" style={styles.vendorName} numberOfLines={1}>
                  {item.businessName}
                </Text>
                {item.isVerified && (
                  <View style={styles.verifiedBadge}>
                    <Text style={styles.verifiedIcon}>✓</Text>
                    <Text style={styles.verifiedText}>Verified</Text>
                  </View>
                )}
              </View>
              <View style={styles.tagsRow}>
                <View style={styles.categoryTag}>
                  <Text style={styles.categoryTagText}>
                    {item.category ? item.category.charAt(0).toUpperCase() + item.category.slice(1) : 'Other'}
                  </Text>
                </View>
                {packages.length > 0 && (
                  <View style={styles.packageCountTag}>
                    <Text style={styles.packageCountText}>{packages.length} pkg{packages.length > 1 ? 's' : ''}</Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* Description */}
          {item.description ? (
            <Text variant="bodySmall" numberOfLines={2} style={styles.vendorDesc}>
              {item.description}
            </Text>
          ) : null}

          {/* Rating row */}
          <View style={styles.ratingRow}>
            <View style={styles.starsRow}>
              {ratingVal ? (
                <>
                  <Text style={styles.starIcon}>★</Text>
                  <Text style={styles.ratingValue}>{ratingVal}</Text>
                  <Text style={styles.reviewCount}>({item.totalReviews || 0})</Text>
                </>
              ) : (
                <Text style={styles.noRating}>No reviews yet</Text>
              )}
            </View>
            {item.city && (
              <View style={styles.locationRow}>
                <Text style={styles.locationPin}>📍</Text>
                <Text style={styles.locationText} numberOfLines={1}>
                  {item.city}{item.state ? `, ${item.state}` : ''}
                  {item.distance != null ? ` • ${item.distance} km` : ''}
                </Text>
              </View>
            )}
          </View>

          {/* Price section */}
          <View style={styles.priceSection}>
            <View style={styles.priceBlock}>
              {packages.length > 0 ? (
                <>
                  <Text style={styles.priceLabel}>Package range</Text>
                  <Text style={styles.priceValue}>
                    {formatCurrency(minPrice)} – {formatCurrency(maxPrice)}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.priceLabel}>Starting from</Text>
                  <Text style={styles.priceValue}>{formatCurrency(item.basePrice)}</Text>
                </>
              )}
            </View>
            <Button
              mode="contained"
              compact
              style={styles.viewButton}
              labelStyle={styles.viewButtonLabel}
              onPress={() => navigation.navigate('VendorDetail', { vendorId: item.id })}
            >
              View Details
            </Button>
          </View>
        </Card.Content>
      </Card>
    );
  };

  const sortLabel = SORT_OPTIONS.find((s) => s.value === sortBy)?.label || 'Sort';

  return (
    <View style={styles.container}>
      <Searchbar
        placeholder={nearMe ? 'Showing nearby vendors...' : 'Search by city or vendor name...'}
        value={search}
        onChangeText={setSearch}
        style={styles.searchbar}
        inputStyle={styles.searchInput}
        editable={!nearMe}
      />

      {/* Location bar */}
      <View style={styles.locationBar}>
        <TouchableOpacity
          style={[styles.nearMeBtn, nearMe && styles.nearMeBtnActive]}
          onPress={handleToggleNearMe}
          disabled={locationLoading}
        >
          {locationLoading ? (
            <ActivityIndicator size={14} color={nearMe ? '#fff' : Colors.primary} style={{ marginRight: 6 }} />
          ) : (
            <Text style={[styles.nearMeIcon, nearMe && styles.nearMeIconActive]}>📍</Text>
          )}
          <Text style={[styles.nearMeText, nearMe && styles.nearMeTextActive]}>
            {nearMe ? (locationCity || 'Near Me') : 'Near Me'}
          </Text>
        </TouchableOpacity>
      </View>

      {nearMe && (
        <View style={styles.radiusRow}>
          <Text style={styles.radiusTitle}>Radius:</Text>
          {[10, 25, 50, 100, 200].map((r) => (
            <TouchableOpacity
              key={r}
              style={[styles.radiusChip, radiusKm === r && styles.radiusChipActive]}
              onPress={() => { setRadiusKm(r); setLoading(true); }}
            >
              <Text style={[styles.radiusChipText, radiusKm === r && styles.radiusChipTextActive]}>{r} km</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Category chips */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={CATEGORIES}
        keyExtractor={(item) => item}
        contentContainerStyle={styles.chipRow}
        renderItem={({ item }) => (
          <Chip
            selected={category === item}
            icon={category === item ? 'check' : CATEGORY_ICONS[item]}
            onPress={() => setCategory(item)}
            style={[styles.filterChip, category === item && styles.filterChipActive]}
            textStyle={category === item ? styles.filterChipTextActive : styles.filterChipText}
          >
            {item === 'all' ? 'All' : item.charAt(0).toUpperCase() + item.slice(1)}
          </Chip>
        )}
      />

      {/* Sort bar + count */}
      <View style={styles.sortBar}>
        <Text style={styles.resultCount}>
          {nearMe && nearbyCount != null
            ? `${nearbyCount} nearby within ${radiusKm} km`
            : `${sortedVendors.length} vendor${sortedVendors.length !== 1 ? 's' : ''} found`}
        </Text>
        <Menu
          visible={sortMenuVisible}
          onDismiss={() => setSortMenuVisible(false)}
          anchor={
            <TouchableOpacity style={styles.sortButton} onPress={() => setSortMenuVisible(true)}>
              <Text style={styles.sortButtonText}>{sortLabel}</Text>
              <Text style={styles.sortArrow}>▼</Text>
            </TouchableOpacity>
          }
        >
          {SORT_OPTIONS.map((opt) => (
            <Menu.Item
              key={opt.value}
              title={opt.label}
              leadingIcon={sortBy === opt.value ? 'check' : undefined}
              onPress={() => { setSortBy(opt.value); setSortMenuVisible(false); }}
            />
          ))}
        </Menu>
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} size="large" color={Colors.primary} />
      ) : (
        <FlatList
          data={sortedVendors}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderVendor}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchVendors(); }} colors={[Colors.primary]} />}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>🔍</Text>
              <Text style={styles.emptyTitle}>No vendors found</Text>
              <Text style={styles.emptyText}>Try adjusting your search or category filter</Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  searchbar: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    elevation: 2,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
  },
  searchInput: { fontSize: 14 },

  // Location bar
  locationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xs,
  },
  nearMeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  nearMeBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  nearMeIcon: { fontSize: 14, marginRight: 6 },
  nearMeIconActive: { fontSize: 14, marginRight: 6 },
  nearMeText: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  nearMeTextActive: { color: '#fff' },
  radiusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    gap: 6,
  },
  radiusTitle: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, marginRight: 2 },
  radiusChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  radiusChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  radiusChipText: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary },
  radiusChipTextActive: { color: '#fff' },

  chipRow: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm, height: 48 },
  filterChip: { marginRight: Spacing.sm, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterChipText: { color: Colors.textSecondary, fontSize: 12 },
  filterChipTextActive: { color: Colors.textOnPrimary, fontSize: 12 },

  // Sort bar
  sortBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  resultCount: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sortButtonText: { fontSize: 12, color: Colors.textPrimary, fontWeight: '500' },
  sortArrow: { fontSize: 8, color: Colors.textMuted, marginLeft: 6 },

  loader: { flex: 1, justifyContent: 'center' },
  listContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },

  // Card
  vendorCard: {
    marginBottom: Spacing.md,
    borderRadius: Radius.lg,
    elevation: 2,
    backgroundColor: Colors.surface,
    overflow: 'hidden',
  },
  cardContent: { paddingVertical: Spacing.md },

  // Top row
  topRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: Spacing.sm },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surfaceVariant,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  iconText: { fontSize: 18, fontWeight: '700', color: Colors.primary },
  nameBlock: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  vendorName: { fontWeight: '700', color: Colors.textPrimary, flexShrink: 1 },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  verifiedIcon: { fontSize: 11, color: Colors.success, fontWeight: '700', marginRight: 3 },
  verifiedText: { fontSize: 11, color: Colors.success, fontWeight: '600' },
  tagsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 6 },
  categoryTag: {
    backgroundColor: Colors.surfaceVariant,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  categoryTagText: { fontSize: 11, color: Colors.primary, fontWeight: '500' },
  packageCountTag: {
    backgroundColor: '#fff7ed',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  packageCountText: { fontSize: 11, color: '#ea580c', fontWeight: '500' },

  // Description
  vendorDesc: { color: Colors.textSecondary, marginBottom: Spacing.sm, lineHeight: 20 },

  // Rating row
  ratingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  starsRow: { flexDirection: 'row', alignItems: 'center' },
  starIcon: { fontSize: 16, color: '#f59e0b', marginRight: 4 },
  ratingValue: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, marginRight: 4 },
  reviewCount: { fontSize: 12, color: Colors.textMuted },
  noRating: { fontSize: 12, color: Colors.textMuted, fontStyle: 'italic' },
  locationRow: { flexDirection: 'row', alignItems: 'center', flexShrink: 1, maxWidth: '50%' },
  locationPin: { fontSize: 12, marginRight: 2 },
  locationText: { fontSize: 12, color: Colors.textMuted },

  // Price section
  priceSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  priceBlock: { flex: 1 },
  priceLabel: { fontSize: 11, color: Colors.textMuted, marginBottom: 2 },
  priceValue: { fontSize: 16, fontWeight: '700', color: Colors.primary },
  viewButton: {
    borderRadius: Radius.sm,
    backgroundColor: Colors.primary,
    marginLeft: Spacing.sm,
  },
  viewButtonLabel: { fontSize: 12, marginVertical: 2 },

  // Empty state
  emptyContainer: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 40, marginBottom: Spacing.md },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: Colors.textPrimary, marginBottom: 4 },
  emptyText: { fontSize: 14, color: Colors.textMuted, textAlign: 'center' },
});

export default VendorListScreen;
