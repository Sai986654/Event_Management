import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Searchbar, Card, Text, Chip, ActivityIndicator } from 'react-native-paper';
import { vendorService } from '../services/vendorService';
import { formatCurrency, getErrorMessage } from '../utils/helpers';

const CATEGORIES = ['all', 'catering', 'photography', 'music', 'florist', 'venue', 'decor'];

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
      <Card
        style={styles.vendorCard}
        onPress={() => navigation.navigate('VendorDetail', { vendorId: item.id })}
      >
        <Card.Content>
          <View style={styles.vendorHeader}>
            <Text variant="titleMedium" style={styles.vendorName}>{item.businessName}</Text>
            {item.isVerified && <Chip compact icon="check-circle" textStyle={{ fontSize: 10 }}>Verified</Chip>}
          </View>
          <Chip compact style={styles.categoryChip}>{item.category}</Chip>
          <Text variant="bodySmall" numberOfLines={2} style={styles.vendorDesc}>{item.description}</Text>
          <View style={styles.vendorFooter}>
            <Text variant="bodySmall" style={styles.rating}>⭐ {item.averageRating ? Number(item.averageRating).toFixed(1) : 'N/A'} ({item.totalReviews || 0})</Text>
            <Text variant="titleSmall" style={styles.price}>
              {packages.length > 0 ? `${formatCurrency(minPrice)} – ${formatCurrency(maxPrice)}` : `From ${formatCurrency(item.basePrice)}`}
            </Text>
          </View>
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
      />

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
            onPress={() => setCategory(item)}
            style={styles.filterChip}
          >
            {item === 'all' ? 'All' : item.charAt(0).toUpperCase() + item.slice(1)}
          </Chip>
        )}
      />

      {loading ? (
        <ActivityIndicator style={styles.loader} size="large" />
      ) : (
        <FlatList
          data={vendors}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderVendor}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchVendors(); }} />}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No vendors found. Try a different search.</Text>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  searchbar: { margin: 12, elevation: 2, borderRadius: 12 },
  chipRow: { paddingHorizontal: 12, paddingBottom: 8 },
  filterChip: { marginRight: 8 },
  loader: { flex: 1, justifyContent: 'center' },
  listContent: { paddingHorizontal: 12, paddingBottom: 16 },
  vendorCard: { marginBottom: 12, borderRadius: 12, elevation: 2 },
  vendorHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  vendorName: { fontWeight: 'bold', flex: 1, marginRight: 8 },
  categoryChip: { alignSelf: 'flex-start', marginTop: 6, marginBottom: 6 },
  vendorDesc: { color: '#666', marginBottom: 8 },
  vendorFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rating: { color: '#888' },
  price: { color: '#667eea', fontWeight: 'bold' },
  emptyText: { textAlign: 'center', color: '#888', marginTop: 40 },
});

export default VendorListScreen;
