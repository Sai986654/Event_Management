import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Alert } from 'react-native';
import {
  Text, Card, Button, ActivityIndicator, TextInput, ProgressBar, Portal, Modal, Divider,
} from 'react-native-paper';
import { budgetService } from '../services/budgetService';
import { formatCurrency, getErrorMessage } from '../utils/helpers';
import { Colors, Spacing, Radius } from '../theme';

const BudgetDashboardScreen = ({ route }) => {
  const { eventId } = route.params;
  const [budget, setBudget] = useState(null);
  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({ category: '', amount: '' });
  const [submitting, setSubmitting] = useState(false);

  const fetchBudget = useCallback(async () => {
    try {
      const data = await budgetService.getBudget(eventId);
      setBudget(data.budget);
      setAllocations(data.allocations || []);
    } catch (err) {
      // Budget may not exist yet
      console.warn(getErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [eventId]);

  useEffect(() => { fetchBudget(); }, [fetchBudget]);

  const handleAddAllocation = async () => {
    if (!formData.category.trim() || !formData.amount) {
      Alert.alert('Validation', 'Category and amount are required');
      return;
    }
    try {
      setSubmitting(true);
      await budgetService.allocateBudget(budget.id, [
        { category: formData.category, amount: Number(formData.amount) },
      ]);
      setShowAddModal(false);
      setFormData({ category: '', amount: '' });
      fetchBudget();
    } catch (err) {
      Alert.alert('Error', getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleOptimize = async () => {
    try {
      const data = await budgetService.optimizeBudget(eventId, budget?.guestCount);
      setBudget(data.budget);
      setAllocations(data.allocations || []);
      Alert.alert('Success', 'Budget optimized by AI');
    } catch (err) {
      Alert.alert('Error', getErrorMessage(err));
    }
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color={Colors.primary} />;

  if (!budget) {
    return (
      <View style={styles.container}>
        <Card style={styles.emptyCard}>
          <Card.Content>
            <Text style={styles.emptyText}>No budget set up for this event yet.</Text>
            <Button mode="contained" style={{ marginTop: Spacing.md, alignSelf: 'center' }} onPress={() => {
              Alert.alert('Create Budget', 'Set up a budget for this event?', [
                { text: 'Cancel' },
                {
                  text: 'Create',
                  onPress: async () => {
                    try {
                      await budgetService.createBudget(eventId, { totalBudget: 0 });
                      fetchBudget();
                    } catch (err) {
                      Alert.alert('Error', getErrorMessage(err));
                    }
                  },
                },
              ]);
            }}>
              Create Budget
            </Button>
          </Card.Content>
        </Card>
      </View>
    );
  }

  const totalBudget = Number(budget.totalBudget ?? 0);
  const totalSpent = allocations.reduce((sum, a) => sum + Number(a.spent ?? 0), 0);
  const totalAllocated = allocations.reduce((sum, a) => sum + Number(a.allocated ?? 0), 0);
  const percentUsed = totalBudget > 0 ? totalSpent / totalBudget : 0;

  return (
    <View style={styles.container}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchBudget(); }} colors={[Colors.primary]} />}
      >
        {/* Summary Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: Colors.primary }]} numberOfLines={1} adjustsFontSizeToFit>
              {formatCurrency(totalBudget)}
            </Text>
            <Text style={styles.statLabel}>Total Budget</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: Colors.success }]} numberOfLines={1} adjustsFontSizeToFit>
              {formatCurrency(totalAllocated)}
            </Text>
            <Text style={styles.statLabel}>Allocated</Text>
          </View>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: Colors.danger }]} numberOfLines={1} adjustsFontSizeToFit>
              {formatCurrency(totalSpent)}
            </Text>
            <Text style={styles.statLabel}>Spent</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: Colors.warning }]} numberOfLines={1} adjustsFontSizeToFit>
              {formatCurrency(totalBudget - totalAllocated)}
            </Text>
            <Text style={styles.statLabel}>Remaining</Text>
          </View>
        </View>

        {/* Progress */}
        <Card style={styles.progressCard}>
          <Card.Content>
            <Text variant="titleSmall" style={{ fontWeight: '700', marginBottom: Spacing.sm }}>
              Budget Usage
            </Text>
            <ProgressBar
              progress={Math.min(percentUsed, 1)}
              color={percentUsed > 1 ? Colors.danger : Colors.primary}
              style={styles.progressBar}
            />
            <Text variant="bodySmall" style={{ color: Colors.textSecondary, marginTop: Spacing.sm }}>
              {(percentUsed * 100).toFixed(1)}% used
            </Text>
          </Card.Content>
        </Card>

        {/* Allocations */}
        <Text variant="titleMedium" style={styles.sectionTitle}>Allocations</Text>
        {allocations.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Card.Content>
              <Text style={styles.emptyText}>No allocations yet. Add one below.</Text>
            </Card.Content>
          </Card>
        ) : (
          allocations.map((alloc, i) => (
            <Card key={alloc.id || i} style={styles.allocCard}>
              <Card.Content>
                <View style={styles.allocRow}>
                  <Text variant="titleSmall" style={{ fontWeight: '700', flex: 1 }}>{alloc.category}</Text>
                  <Text variant="bodySmall" style={{ color: Colors.primary, fontWeight: '600' }}>
                    {formatCurrency(alloc.allocated)}
                  </Text>
                </View>
                <Divider style={{ marginVertical: 8 }} />
                <View style={styles.allocRow}>
                  <Text variant="bodySmall" style={{ color: Colors.textSecondary }}>
                    Spent: {formatCurrency(alloc.spent || 0)}
                  </Text>
                  <Text variant="bodySmall" style={{ color: Colors.success, fontWeight: '600' }}>
                    Left: {formatCurrency((alloc.allocated || 0) - (alloc.spent || 0))}
                  </Text>
                </View>
              </Card.Content>
            </Card>
          ))
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <Button
            mode="contained-tonal"
            icon="plus"
            onPress={() => setShowAddModal(true)}
            style={styles.actionBtn}
          >
            Add Allocation
          </Button>
          <Button
            mode="contained"
            icon="auto-fix"
            onPress={handleOptimize}
            style={styles.actionBtn}
          >
            AI Optimize
          </Button>
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>

      {/* Add Allocation Modal */}
      <Portal>
        <Modal
          visible={showAddModal}
          onDismiss={() => setShowAddModal(false)}
          contentContainerStyle={styles.modal}
        >
          <Text variant="titleLarge" style={{ fontWeight: '800', marginBottom: Spacing.lg }}>Add Allocation</Text>
          <TextInput
            label="Category"
            placeholder="E.g., Venue, Catering, Decor"
            value={formData.category}
            onChangeText={(t) => setFormData((p) => ({ ...p, category: t }))}
            mode="outlined"
            style={styles.input}
          />
          <TextInput
            label="Amount (₹)"
            value={formData.amount}
            onChangeText={(t) => setFormData((p) => ({ ...p, amount: t.replace(/[^0-9]/g, '') }))}
            mode="outlined"
            keyboardType="numeric"
            style={styles.input}
          />
          <View style={styles.modalActions}>
            <Button mode="text" onPress={() => setShowAddModal(false)}>Cancel</Button>
            <Button mode="contained" onPress={handleAddAllocation} loading={submitting} disabled={submitting}>
              Add
            </Button>
          </View>
        </Modal>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
  },
  statCard: {
    flex: 1,
    marginHorizontal: 4,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    elevation: 2,
    marginTop: Spacing.sm,
  },
  statValue: { fontSize: 18, fontWeight: '800' },
  statLabel: { fontSize: 11, color: Colors.textSecondary, fontWeight: '600', marginTop: 2 },
  progressCard: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    borderRadius: Radius.lg,
    elevation: 2,
    backgroundColor: Colors.surface,
  },
  progressBar: { height: 10, borderRadius: 5 },
  sectionTitle: {
    fontWeight: '800',
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
    color: Colors.textPrimary,
  },
  emptyCard: {
    marginHorizontal: Spacing.lg,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
  },
  emptyText: { textAlign: 'center', color: Colors.textMuted, paddingVertical: 20 },
  allocCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    borderRadius: Radius.lg,
    elevation: 1,
    backgroundColor: Colors.surface,
  },
  allocRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    gap: Spacing.sm,
  },
  actionBtn: { flex: 1, borderRadius: Radius.sm },
  modal: {
    backgroundColor: Colors.surface,
    margin: Spacing.lg,
    padding: Spacing.xl,
    borderRadius: Radius.lg,
  },
  input: { marginBottom: Spacing.md },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: Spacing.md },
});

export default BudgetDashboardScreen;
