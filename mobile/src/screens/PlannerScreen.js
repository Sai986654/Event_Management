import React, { useContext, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View, TouchableOpacity } from 'react-native';
import { ActivityIndicator, Button, Card, Chip, Text, TextInput } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { eventService } from '../services/eventService';
import { packageService } from '../services/packageService';
import { orderService } from '../services/orderService';
import { aiService } from '../services/aiService';
import { formatCurrency, getErrorMessage } from '../utils/helpers';
import { AuthContext } from '../context/AuthContext';
import { Colors, Spacing, Radius } from '../theme';

const PlannerScreen = () => {
  const { user } = useContext(AuthContext);
  const navigation = useNavigation();
  const [events, setEvents] = useState([]);
  const [packages, setPackages] = useState([]);
  const [eventId, setEventId] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selected, setSelected] = useState({});
  const [quote, setQuote] = useState(null);
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState('info');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(false);
  const [quoting, setQuoting] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [aiPlanning, setAiPlanning] = useState(false);
  const [optimizingBudget, setOptimizingBudget] = useState(false);
  const [rebalancing, setRebalancing] = useState(false);
  const [budgetOptimization, setBudgetOptimization] = useState(null);
  const [scenarioGuests, setScenarioGuests] = useState('');
  const [scenarioBudget, setScenarioBudget] = useState('');
  const [aiReasons, setAiReasons] = useState({});

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [e, p] = await Promise.all([eventService.getEvents({ limit: 20 }), packageService.getPublicPackages()]);
        setEvents(e.events || []);
        setPackages(p.packages || []);
      } catch (err) { setMsg(getErrorMessage(err)); setMsgType('error'); }
      finally { setLoading(false); }
    })();
  }, []);

  useEffect(() => {
    if (!eventId) { setSelectedEvent(null); return; }
    (async () => {
      try {
        const res = await eventService.getEventById(Number(eventId));
        setSelectedEvent(res.event || null);
        if (res.event) {
          setScenarioGuests(String(res.event.guestCount ?? ''));
          setScenarioBudget(String(res.event.budget ?? ''));
        }
      } catch { setSelectedEvent(null); }
    })();
  }, [eventId]);

  const packageIndex = useMemo(() => new Map(packages.map((pkg) => [pkg.id, pkg])), [packages]);
  const selectedPackageList = useMemo(() => packages.filter((p) => selected[p.id]), [packages, selected]);

  const toggleSelect = (pkg) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[pkg.id]) delete next[pkg.id];
      else next[pkg.id] = { packageId: pkg.id, criteria: { guests: 0, hours: 0 } };
      return next;
    });
  };

  const eventChoices = events.map((e) => ({ id: e.id, label: `#${e.id} ${e.title}` }));
  const categoryChoices = ['all', ...new Set(packages.map((p) => p.category))];
  const visiblePackages = selectedCategory === 'all' ? packages : packages.filter((p) => p.category === selectedCategory);

  const setCriteria = (packageId, field, value) => {
    setSelected((prev) => ({
      ...prev,
      [packageId]: {
        ...(prev[packageId] || { packageId, criteria: {} }),
        criteria: { ...((prev[packageId] || {}).criteria || {}), [field]: Number(value || 0) },
      },
    }));
  };

  const applyAiCopilot = async () => {
    if (!eventId) { setMsg('Select an event first'); setMsgType('error'); return; }
    setAiPlanning(true); setMsg('');
    try {
      const res = await aiService.generatePlannerCopilot(Number(eventId));
      const recs = res.plan?.recommendations || [];
      if (!recs.length) { setMsg('AI plan did not return recommendations'); setMsgType('error'); return; }
      const nextSelected = {}; const nextReasons = {}; let count = 0;
      recs.forEach((rec) => {
        if (!rec?.packageId) return;
        const pkg = packageIndex.get(rec.packageId);
        if (!pkg) return;
        const rules = pkg.estimationRules || {};
        const guests = Number(rules.perGuest || 0) > 0 ? Number(res.plan?.eventSnapshot?.guestCount || 0) : 0;
        const hours = Number(rules.perHour || 0) > 0 ? 4 : 0;
        nextSelected[rec.packageId] = { packageId: rec.packageId, criteria: { guests, hours } };
        if (rec.sector) nextReasons[rec.sector] = rec.reason || 'AI suggested this package.';
        count += 1;
      });
      setSelected((prev) => ({ ...prev, ...nextSelected }));
      setAiReasons((prev) => ({ ...prev, ...nextReasons }));
      setQuote(null);
      setMsg(`AI Co-Pilot applied ${count} package(s). Adjust or generate quote.`);
      setMsgType('success');
    } catch (err) { setMsg(getErrorMessage(err)); setMsgType('error'); }
    finally { setAiPlanning(false); }
  };

  const runBudgetOptimization = async () => {
    if (!eventId) { setMsg('Select an event first'); setMsgType('error'); return; }
    if (!selectedPackageList.length) { setMsg('Select at least one package first'); setMsgType('error'); return; }
    setOptimizingBudget(true); setMsg('');
    try {
      const payload = {
        eventId: Number(eventId),
        packageIds: selectedPackageList.map((pkg) => pkg.id),
        guestCount: Number(scenarioGuests || selectedEvent?.guestCount || 0),
        budget: Number(scenarioBudget || selectedEvent?.budget || 0),
      };
      const res = await aiService.optimizeBudget(payload);
      setBudgetOptimization(res.optimization || null);
      setMsg('AI budget simulation ready'); setMsgType('success');
    } catch (err) { setMsg(getErrorMessage(err)); setMsgType('error'); }
    finally { setOptimizingBudget(false); }
  };

  const runAutoRebalance = async () => {
    if (!eventId) { setMsg('Select an event first'); setMsgType('error'); return; }
    if (!selectedPackageList.length) { setMsg('Select at least one package first'); setMsgType('error'); return; }
    setRebalancing(true); setMsg('');
    try {
      const payload = {
        eventId: Number(eventId),
        packageIds: selectedPackageList.map((pkg) => pkg.id),
        guestCount: Number(scenarioGuests || selectedEvent?.guestCount || 0),
        budget: Number(scenarioBudget || selectedEvent?.budget || 0),
      };
      const res = await aiService.autoRebalance(payload);
      const plan = res.rebalance;
      const selections = plan?.selections || [];
      if (!selections.length) { setMsg('AI could not rebalance with current data'); setMsgType('error'); return; }
      const nextSelected = {}; const nextReasons = {};
      selections.forEach((row) => {
        const pkg = packageIndex.get(row.packageId);
        if (!pkg || !row.sector) return;
        const rules = pkg.estimationRules || {};
        const guests = Number(rules.perGuest || 0) > 0 ? Number(selectedEvent?.guestCount || 0) : 0;
        const hours = Number(rules.perHour || 0) > 0 ? 4 : 0;
        nextSelected[row.packageId] = { packageId: row.packageId, criteria: { guests, hours } };
        const swap = (plan.swaps || []).find((s) => s.sector === row.sector && s.toPackageId === row.packageId);
        nextReasons[row.sector] = swap ? `AI rebalance: ${swap.reason}` : 'AI rebalance kept this package.';
      });
      setSelected((prev) => ({ ...prev, ...nextSelected }));
      setAiReasons((prev) => ({ ...prev, ...nextReasons }));
      setQuote(null);
      setBudgetOptimization((prev) => prev && plan ? {
        ...prev, projectedTotal: plan.afterTotal, delta: Number(plan.afterTotal || 0) - Number(payload.budget || 0),
        status: Number(plan.afterTotal || 0) <= Number(payload.budget || 0) ? 'under_budget' : 'over_budget',
      } : prev);
      setMsg(`AI rebalanced ${selections.length} sector(s). Regenerate quotation.`); setMsgType('success');
    } catch (err) { setMsg(getErrorMessage(err)); setMsgType('error'); }
    finally { setRebalancing(false); }
  };

  const generateQuote = async () => {
    if (!['customer', 'admin', 'organizer'].includes(user?.role)) { setMsg('Only customer/organizer/admin can quote'); setMsgType('error'); return; }
    if (!eventId) { setMsg('Please select a valid event'); setMsgType('error'); return; }
    try {
      setQuoting(true);
      const selections = Object.values(selected);
      if (!selections.length) { setMsg('Select at least one package'); setMsgType('error'); return; }
      const res = await orderService.createQuote({ eventId: Number(eventId), selections });
      setQuote(res.order); setMsg('Quote generated'); setMsgType('success');
    } catch (err) { setMsg(getErrorMessage(err)); setMsgType('error'); }
    finally { setQuoting(false); }
  };

  const placeOrder = async () => {
    if (!quote?.id) { setMsg('Generate quote first'); setMsgType('error'); return; }
    try {
      setPlacing(true);
      const res = await orderService.placeOrder(quote.id);
      setQuote((prev) => ({ ...prev, ...res.order }));
      setMsg('Order placed'); setMsgType('success');
    } catch (err) { setMsg(getErrorMessage(err)); setMsgType('error'); }
    finally { setPlacing(false); }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Hero */}
      <Card style={styles.heroCard}>
        <Card.Content>
          <Text variant="headlineSmall" style={styles.heroTitle}>Event Planner</Text>
          <Text style={styles.heroSubtitle}>Select packages, use AI Co-Pilot, then quote and place your order.</Text>
        </Card.Content>
      </Card>

      {/* Event Selection */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>Select Event</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
            {eventChoices.map((e) => (
              <Chip key={e.id} style={styles.chip} selected={Number(eventId) === e.id} onPress={() => setEventId(String(e.id))}>
                {e.label}
              </Chip>
            ))}
          </ScrollView>
          {!eventChoices.length ? <Text variant="bodySmall" style={{ color: Colors.textMuted }}>No events found. Create one first.</Text> : null}
          <TextInput label="Or enter Event ID" mode="outlined" value={eventId} onChangeText={setEventId} style={styles.input} outlineStyle={styles.outline} keyboardType="numeric" />
          <Button mode="contained-tonal" onPress={applyAiCopilot} loading={aiPlanning} disabled={aiPlanning || !eventId} style={styles.aiBtn} icon="robot">
            AI Co-Pilot
          </Button>
          <Text variant="bodySmall" style={{ marginTop: 4, color: Colors.textMuted }}>Auto-picks a package per sector.</Text>
        </Card.Content>
      </Card>

      {/* Budget Simulation */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>AI Budget (optional)</Text>
          <TextInput label="Scenario guest count" mode="outlined" value={scenarioGuests} onChangeText={setScenarioGuests} keyboardType="numeric" style={styles.input} outlineStyle={styles.outline} />
          <TextInput label="Scenario budget (₹)" mode="outlined" value={scenarioBudget} onChangeText={setScenarioBudget} keyboardType="numeric" style={styles.input} outlineStyle={styles.outline} />
          <View style={styles.row}>
            <Button mode="outlined" onPress={runBudgetOptimization} loading={optimizingBudget} disabled={optimizingBudget} style={styles.halfBtn}>Simulate</Button>
            <Button mode="outlined" onPress={runAutoRebalance} loading={rebalancing} disabled={rebalancing} style={styles.halfBtn}>AI Rebalance</Button>
          </View>
          {budgetOptimization?.suggestions?.length ? (
            <View style={styles.tipsBox}>
              <Text variant="labelLarge" style={{ fontWeight: '700' }}>Tips</Text>
              {budgetOptimization.suggestions.map((tip, i) => (
                <Text key={i} variant="bodySmall" style={{ marginTop: 4, color: Colors.textSecondary }}>• {tip}</Text>
              ))}
            </View>
          ) : null}
        </Card.Content>
      </Card>

      {/* Filter */}
      <Text variant="labelLarge" style={styles.filterLabel}>Filter packages</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
        {categoryChoices.map((c) => (
          <Chip key={c} style={[styles.chip, selectedCategory === c && styles.chipActive]} selected={selectedCategory === c} onPress={() => setSelectedCategory(c)} textStyle={selectedCategory === c ? { color: Colors.textOnPrimary } : undefined}>
            {c === 'all' ? 'All' : c.charAt(0).toUpperCase() + c.slice(1)}
          </Chip>
        ))}
      </ScrollView>

      {loading ? <ActivityIndicator style={{ marginVertical: Spacing.md }} color={Colors.primary} /> : null}

      {/* Packages */}
      {visiblePackages.map((p) => (
        <Card key={p.id} style={styles.card}>
          <Card.Content>
            <View style={styles.pkgHeader}>
              <Text variant="titleMedium" style={{ flex: 1, fontWeight: '700' }}>{p.title}</Text>
              <Chip compact textStyle={{ textTransform: 'capitalize', fontSize: 11 }}>{p.category}</Chip>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('PlannerVendorDetail', { vendorId: p.vendorId })}>
              <Text variant="bodySmall" style={styles.vendorLink}>{p.vendor?.businessName}</Text>
            </TouchableOpacity>
            <Text variant="titleSmall" style={{ color: Colors.primary, fontWeight: '700', marginTop: 4 }}>{formatCurrency(p.basePrice)}</Text>
            {aiReasons[p.category] ? (
              <Text variant="bodySmall" style={styles.aiReason}>🤖 {aiReasons[p.category]}</Text>
            ) : null}
            <Text variant="bodySmall" style={{ marginTop: 4, color: Colors.textSecondary }}>{p.description}</Text>
            <Button mode={selected[p.id] ? 'contained' : 'outlined'} onPress={() => toggleSelect(p)} style={styles.selectBtn} labelStyle={{ fontWeight: '600' }}>
              {selected[p.id] ? '✓ Selected' : 'Select'}
            </Button>
            {selected[p.id] ? (
              <View style={styles.criteriaRow}>
                <TextInput label="Guests" mode="outlined" keyboardType="numeric" style={styles.criteriaInput} outlineStyle={styles.outline} onChangeText={(v) => setCriteria(p.id, 'guests', v)} />
                <TextInput label="Hours" mode="outlined" keyboardType="numeric" style={styles.criteriaInput} outlineStyle={styles.outline} onChangeText={(v) => setCriteria(p.id, 'hours', v)} />
              </View>
            ) : null}
          </Card.Content>
        </Card>
      ))}

      {/* Quote */}
      <Button mode="contained" loading={quoting} disabled={quoting} onPress={generateQuote} style={styles.quoteBtn} labelStyle={{ fontWeight: '700', fontSize: 15 }}>Generate Quotation</Button>

      {quote ? (
        <Card style={[styles.card, styles.quoteCard]}>
          <Card.Content>
            <Text variant="titleMedium" style={{ fontWeight: '700' }}>Order #{quote.id}</Text>
            <Text variant="bodySmall" style={{ color: Colors.textSecondary, marginTop: 4 }}>Status: {quote.status}</Text>
            <Text variant="titleLarge" style={styles.quoteTotal}>{formatCurrency(quote.quotedTotal)}</Text>
            <Button mode="contained" loading={placing} onPress={placeOrder} disabled={quote.status === 'placed' || placing} style={styles.placeBtn} labelStyle={{ fontWeight: '700' }}>
              Place Order
            </Button>
          </Card.Content>
        </Card>
      ) : null}

      {msg ? <Text style={msgType === 'error' ? styles.msgError : styles.msgSuccess}>{msg}</Text> : null}
      <View style={{ height: 30 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { padding: Spacing.lg, paddingBottom: 40 },
  heroCard: { marginBottom: Spacing.md, borderRadius: Radius.lg, elevation: 3, backgroundColor: Colors.surface },
  heroTitle: { fontWeight: '800', color: Colors.textPrimary },
  heroSubtitle: { marginTop: 6, color: Colors.textSecondary, lineHeight: 20 },
  card: { marginBottom: Spacing.md, borderRadius: Radius.lg, elevation: 2, backgroundColor: Colors.surface },
  sectionTitle: { fontWeight: '700', marginBottom: Spacing.sm, color: Colors.textPrimary },
  input: { marginBottom: Spacing.sm },
  outline: { borderRadius: Radius.sm },
  chipScroll: { marginBottom: Spacing.sm },
  chip: { marginRight: Spacing.sm },
  chipActive: { backgroundColor: Colors.primary },
  aiBtn: { marginTop: Spacing.sm, borderRadius: Radius.sm },
  row: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  halfBtn: { flex: 1, borderRadius: Radius.sm },
  tipsBox: { marginTop: Spacing.md, padding: Spacing.md, backgroundColor: Colors.surfaceVariant, borderRadius: Radius.sm },
  filterLabel: { marginBottom: Spacing.xs, marginLeft: Spacing.xs, color: Colors.textSecondary, fontWeight: '600' },
  pkgHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  vendorLink: { color: Colors.primary, fontWeight: '600', textDecorationLine: 'underline' },
  aiReason: { marginTop: 4, color: '#7c3aed', fontStyle: 'italic' },
  selectBtn: { marginTop: Spacing.sm, borderRadius: Radius.sm },
  criteriaRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  criteriaInput: { flex: 1 },
  quoteBtn: { backgroundColor: Colors.primary, borderRadius: Radius.sm, marginBottom: Spacing.md },
  quoteCard: { borderWidth: 1.5, borderColor: Colors.primary + '44' },
  quoteTotal: { fontWeight: '800', color: Colors.primary, marginTop: Spacing.sm },
  placeBtn: { marginTop: Spacing.md, backgroundColor: Colors.success, borderRadius: Radius.sm },
  msgError: { color: Colors.danger, marginTop: Spacing.sm, fontSize: 13 },
  msgSuccess: { color: Colors.success, marginTop: Spacing.sm, fontSize: 13 },
});

export default PlannerScreen;
