import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Searchbar, Card, Text, Chip, ActivityIndicator } from 'react-native-paper';
import { vendorService } from '../services/vendorService';
import { formatCurrency, getErrorMessage } from '../utils/helpers';
import { Colors, Spacing, Radius } from '../theme';

const CATEGORIES = ['all', 'catering', 'photography', 'videography', 'music', 'florist', 'venue', 'decor', 'transportation', 'other'];

const VendorListScreen = ({ navigation }) => {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');

  const fetchVendors = useCallback(async () => {
    try {
      const params = {};
      if (search) params.search = search;
      if (category !== 'all') params.category = category;
      const data = await vendorService.searchVendors(params);
      setVendors(data.vendors || []);
    } catch (err) {
      console.warn(getErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, category]);

  useEffect(() => { fetchVendors(); }, [fetchVendors]);

  const renderVendor = ({ item }) => {
    const packages = item.packages || [];
    const minPrice = packages.length > 0 ? Math.min(...packages.map((p) => p.price)) : item.basePrice;
    const maxPrice = packages.length > 0 ? Math.max(...packages.map((p) => p.price)) : item.basePrice;

    return (
      <Card style={styles.vendorCard} onPress={() => navigation.navigate('VendorDetail', { vendorId: item.id })}>
        <Card.Content>
          <View style={styles.vendorHeader}>
            <Text variant="titleMedium" style={styles.vendorName}>{item.businessName}</Text>
            {item.isVerified && <Chip compact icon="check-circle" textStyle={{ fontSize: 10, color: Colors.success }}>Verified</Chip>}
          </View>
          <Chip compact style={styles.categoryChip} textStyle={{ fontSize: 11, textTransform: 'capitalize' }}>{item.category}</Chip>
          <Text variant="bodySmall" numberOfLines={2} style={styles.vendorDesc}>{item.description}</Text>
          <View style={styles.vendorFooter}>
            <Text variant="bodySmall" style={styles.rating}>⭐ {item.averageRating ? Number(item.averageRating).toFixed(1) : 'N/A'} ({item.totalReviews || 0})</Text>
            <Text variant="titleSmall" style={styles.price}>
              {packages.length > 0 ? `${formatCurrency(minPrice)} – ${formatCurrency(maxPrice)}` : `From ${formatCurrency(item.basePrice)}`}
            </Text>
          </View>
          {item.city && <Text variant="bodySmall" style={styles.location}>📍 {item.city}{item.state ? `, ${item.state}` : ''}</Text>}
        </Card.Content>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <Searchbar
        placeholder="Search vendors..."
        value={search}
        onChangeText={setSearch}
        style={styles.searchbar}
        inputStyle={styles.searchInput}
      />
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={CATEGORIES}
        keyExtractor={(item) => item}
        contentContainerStyle={styles.chipRow}
        renderItem={({ item }) => (
          <Chip
            selected={category === item}
            onPress={() => setCategory(item)}
            style={[styles.filterChip, category === item && styles.filterChipActive]}
            textStyle={category === item ? styles.filterChipTextActive : styles.filterChipText}
          >
            {item === 'all' ? 'All' : item.charAt(0).toUpperCase() + item.slice(1)}
          </Chip>
        )}
      />
      {loading ? (
        <ActivityIndicator style={styles.loader} size="large" color={Colors.primary} />
      ) : (
        <FlatList
          data={vendors}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderVendor}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchVendors(); }} colors={[Colors.primary]} />}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Text style={styles.emptyText}>No vendors found. Try a different search.</Text>}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  searchbar: { margin: Spacing.md, elevation: 2, borderRadius: Radius.lg, backgroundColor: Colors.surface },
  searchInput: { fontSize: 14 },
  chipRow: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm },
  filterChip: { marginRight: Spacing.sm, backgroundColor: Colors.surface },
  filterChipActive: { backgroundColor: Colors.primary },
  filterChipText: { color: Colors.textSecondary },
  filterChipTextActive: { color: Colors.textOnPrimary },
  loader: { flex: 1, justifyContent: 'center' },
  listContent: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.lg },
  vendorCard: { marginBottom: Spacing.md, borderRadius: Radius.lg, elevation: 2, backgroundColor: Colors.surface },
  vendorHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  vendorName: { fontWeight: '700', flex: 1, marginRight: Spacing.sm, color: Colors.textPrimary },
  categoryChip: { alignSelf: 'flex-start', marginTop: 6, marginBottom: 6, backgroundColor: Colors.surfaceVariant },
  vendorDesc: { color: Colors.textSecondary, marginBottom: Spacing.sm, lineHeight: 20 },
  vendorFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rating: { color: Colors.textSecondary },
  price: { color: Colors.primary, fontWeight: '700' },
  location: { color: Colors.textMuted, marginTop: 4 },
  emptyText: { textAlign: 'center', color: Colors.textMuted, marginTop: 40 },
});

export default VendorListScreen;
