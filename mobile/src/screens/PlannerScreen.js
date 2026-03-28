import React, { useContext, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Card, Chip, Text, TextInput } from 'react-native-paper';
import { eventService } from '../services/eventService';
import { packageService } from '../services/packageService';
import { orderService } from '../services/orderService';
import { aiService } from '../services/aiService';
import { formatCurrency, getErrorMessage } from '../utils/helpers';
import { AuthContext } from '../context/AuthContext';

const PlannerScreen = () => {
  const { user } = useContext(AuthContext);
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
      } catch (err) {
        setMsg(getErrorMessage(err));
        setMsgType('error');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!eventId) {
      setSelectedEvent(null);
      return;
    }
    (async () => {
      try {
        const res = await eventService.getEventById(Number(eventId));
        setSelectedEvent(res.event || null);
        if (res.event) {
          setScenarioGuests(String(res.event.guestCount ?? ''));
          setScenarioBudget(String(res.event.budget ?? ''));
        }
      } catch {
        setSelectedEvent(null);
      }
    })();
  }, [eventId]);

  const packageIndex = useMemo(() => new Map(packages.map((pkg) => [pkg.id, pkg])), [packages]);

  const selectedPackageList = useMemo(
    () => packages.filter((p) => selected[p.id]),
    [packages, selected]
  );

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
  const visiblePackages =
    selectedCategory === 'all' ? packages : packages.filter((p) => p.category === selectedCategory);

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
    if (!eventId) {
      setMsg('Select an event first');
      setMsgType('error');
      return;
    }
    setAiPlanning(true);
    setMsg('');
    try {
      const res = await aiService.generatePlannerCopilot(Number(eventId));
      const recs = res.plan?.recommendations || [];
      if (!recs.length) {
        setMsg('AI plan did not return recommendations');
        setMsgType('error');
        return;
      }

      const nextSelected = {};
      const nextReasons = {};
      let count = 0;

      recs.forEach((rec) => {
        if (!rec?.packageId) return;
        const pkg = packageIndex.get(rec.packageId);
        if (!pkg) return;
        const rules = pkg.estimationRules || {};
        const guests =
          Number(rules.perGuest || 0) > 0 ? Number(res.plan?.eventSnapshot?.guestCount || 0) : 0;
        const hours = Number(rules.perHour || 0) > 0 ? 4 : 0;
        nextSelected[rec.packageId] = {
          packageId: rec.packageId,
          criteria: { guests, hours },
        };
        if (rec.sector) {
          nextReasons[rec.sector] = rec.reason || 'AI suggested this package.';
        }
        count += 1;
      });

      setSelected((prev) => ({ ...prev, ...nextSelected }));
      setAiReasons((prev) => ({ ...prev, ...nextReasons }));
      setQuote(null);
      setMsg(`AI Co-Pilot applied ${count} package(s). Adjust or generate quote.`);
      setMsgType('success');
    } catch (err) {
      setMsg(getErrorMessage(err));
      setMsgType('error');
    } finally {
      setAiPlanning(false);
    }
  };

  const runBudgetOptimization = async () => {
    if (!eventId) {
      setMsg('Select an event first');
      setMsgType('error');
      return;
    }
    if (!selectedPackageList.length) {
      setMsg('Select at least one package first');
      setMsgType('error');
      return;
    }
    setOptimizingBudget(true);
    setMsg('');
    try {
      const payload = {
        eventId: Number(eventId),
        packageIds: selectedPackageList.map((pkg) => pkg.id),
        guestCount: Number(scenarioGuests || selectedEvent?.guestCount || 0),
        budget: Number(scenarioBudget || selectedEvent?.budget || 0),
      };
      const res = await aiService.optimizeBudget(payload);
      setBudgetOptimization(res.optimization || null);
      setMsg('AI budget simulation ready');
      setMsgType('success');
    } catch (err) {
      setMsg(getErrorMessage(err));
      setMsgType('error');
    } finally {
      setOptimizingBudget(false);
    }
  };

  const runAutoRebalance = async () => {
    if (!eventId) {
      setMsg('Select an event first');
      setMsgType('error');
      return;
    }
    if (!selectedPackageList.length) {
      setMsg('Select at least one package first');
      setMsgType('error');
      return;
    }
    setRebalancing(true);
    setMsg('');
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
      if (!selections.length) {
        setMsg('AI could not rebalance with current data');
        setMsgType('error');
        return;
      }

      const nextSelected = {};
      const nextReasons = {};
      selections.forEach((row) => {
        const pkg = packageIndex.get(row.packageId);
        if (!pkg || !row.sector) return;
        const rules = pkg.estimationRules || {};
        const guests =
          Number(rules.perGuest || 0) > 0 ? Number(selectedEvent?.guestCount || 0) : 0;
        const hours = Number(rules.perHour || 0) > 0 ? 4 : 0;
        nextSelected[row.packageId] = {
          packageId: row.packageId,
          criteria: { guests, hours },
        };
        const swap = (plan.swaps || []).find((s) => s.sector === row.sector && s.toPackageId === row.packageId);
        nextReasons[row.sector] = swap
          ? `AI rebalance: ${swap.reason}`
          : 'AI rebalance kept this package for best budget fit.';
      });

      setSelected((prev) => ({ ...prev, ...nextSelected }));
      setAiReasons((prev) => ({ ...prev, ...nextReasons }));
      setQuote(null);
      setBudgetOptimization((prev) =>
        prev && plan
          ? {
              ...prev,
              projectedTotal: plan.afterTotal,
              delta: Number(plan.afterTotal || 0) - Number(payload.budget || 0),
              status:
                Number(plan.afterTotal || 0) <= Number(payload.budget || 0) ? 'under_budget' : 'over_budget',
            }
          : prev
      );
      setMsg(`AI rebalanced ${selections.length} sector(s). Regenerate quotation.`);
      setMsgType('success');
    } catch (err) {
      setMsg(getErrorMessage(err));
      setMsgType('error');
    } finally {
      setRebalancing(false);
    }
  };

  const generateQuote = async () => {
    if (!['customer', 'admin', 'organizer'].includes(user?.role)) {
      setMsg('Only customer, organizer, or admin can generate a quotation');
      setMsgType('error');
      return;
    }
    if (!eventId) {
      setMsg('Please enter/select a valid event ID');
      setMsgType('error');
      return;
    }
    try {
      setQuoting(true);
      const selections = Object.values(selected);
      if (!selections.length) {
        setMsg('Select at least one package');
        setMsgType('error');
        return;
      }
      const res = await orderService.createQuote({ eventId: Number(eventId), selections });
      setQuote(res.order);
      setMsg('Quote generated');
      setMsgType('success');
    } catch (err) {
      setMsg(getErrorMessage(err));
      setMsgType('error');
    } finally {
      setQuoting(false);
    }
  };

  const placeOrder = async () => {
    if (!quote?.id) {
      setMsg('Generate quote first');
      setMsgType('error');
      return;
    }
    try {
      setPlacing(true);
      const res = await orderService.placeOrder(quote.id);
      setQuote((prev) => ({ ...prev, ...res.order }));
      setMsg('Order placed');
      setMsgType('success');
    } catch (err) {
      setMsg(getErrorMessage(err));
      setMsgType('error');
    } finally {
      setPlacing(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Card style={styles.heroCard}>
        <Card.Content>
          <Text variant="headlineSmall" style={styles.heroTitle}>Event Planner</Text>
          <Text style={styles.heroSubtitle}>Select packages, use AI Co-Pilot, then quote and place — aligned with the web app.</Text>
        </Card.Content>
      </Card>
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium">Event</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            {eventChoices.map((e) => (
              <Chip
                key={e.id}
                style={styles.chip}
                selected={Number(eventId) === e.id}
                onPress={() => setEventId(String(e.id))}
              >
                {e.label}
              </Chip>
            ))}
          </ScrollView>
          {!eventChoices.length ? <Text variant="bodySmall">No events found. Create one first.</Text> : null}
          <TextInput label="Or enter Event ID" mode="outlined" value={eventId} onChangeText={setEventId} style={styles.input} keyboardType="numeric" />
          <Button
            mode="contained-tonal"
            onPress={applyAiCopilot}
            loading={aiPlanning}
            disabled={aiPlanning || !eventId}
            style={{ marginTop: 8 }}
          >
            Generate with AI Co-Pilot
          </Button>
          <Text variant="bodySmall" style={{ marginTop: 6 }}>Auto-picks a package per sector (same API as web).</Text>
          <Text variant="bodySmall" style={{ marginTop: 12 }}>Filter packages</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            {categoryChoices.map((c) => (
              <Chip
                key={c}
                style={styles.chip}
                selected={selectedCategory === c}
                onPress={() => setSelectedCategory(c)}
              >
                {c}
              </Chip>
            ))}
          </ScrollView>
        </Card.Content>
      </Card>
      {loading ? <ActivityIndicator style={{ marginBottom: 12 }} /> : null}

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium">AI budget (optional)</Text>
          <TextInput
            label="Scenario guest count"
            mode="outlined"
            value={scenarioGuests}
            onChangeText={setScenarioGuests}
            keyboardType="numeric"
            style={styles.input}
          />
          <TextInput
            label="Scenario budget"
            mode="outlined"
            value={scenarioBudget}
            onChangeText={setScenarioBudget}
            keyboardType="numeric"
            style={styles.input}
          />
          <View style={styles.row}>
            <Button mode="outlined" onPress={runBudgetOptimization} loading={optimizingBudget} disabled={optimizingBudget}>
              Run budget simulation
            </Button>
            <Button mode="outlined" onPress={runAutoRebalance} loading={rebalancing} disabled={rebalancing} style={{ marginLeft: 8 }}>
              AI rebalance
            </Button>
          </View>
          {budgetOptimization?.suggestions?.length ? (
            <View style={{ marginTop: 8 }}>
              <Text variant="labelLarge">Tips</Text>
              {budgetOptimization.suggestions.map((tip, i) => (
                <Text key={i} variant="bodySmall" style={{ marginTop: 4 }}>• {tip}</Text>
              ))}
            </View>
          ) : null}
        </Card.Content>
      </Card>

      {visiblePackages.map((p) => (
        <Card key={p.id} style={styles.card}>
          <Card.Content>
            <View style={styles.row}>
              <Text variant="titleMedium" style={{ flex: 1 }}>{p.title}</Text>
              <Chip>{p.category}</Chip>
            </View>
            <Text>{p.vendor?.businessName}</Text>
            <Text>{formatCurrency(p.basePrice)}</Text>
            {aiReasons[p.category] ? (
              <Text variant="bodySmall" style={{ marginTop: 4, color: '#5b21b6' }}>AI: {aiReasons[p.category]}</Text>
            ) : null}
            <Text variant="bodySmall" style={{ marginTop: 4 }}>{p.description}</Text>
            <Button mode={selected[p.id] ? 'contained' : 'outlined'} onPress={() => toggleSelect(p)} style={{ marginTop: 8 }}>
              {selected[p.id] ? 'Selected' : 'Select Package'}
            </Button>
            {selected[p.id] ? (
              <>
                <TextInput label="Guests" mode="outlined" keyboardType="numeric" style={styles.input} onChangeText={(v) => setCriteria(p.id, 'guests', v)} />
                <TextInput label="Hours" mode="outlined" keyboardType="numeric" style={styles.input} onChangeText={(v) => setCriteria(p.id, 'hours', v)} />
              </>
            ) : null}
          </Card.Content>
        </Card>
      ))}

      <Button mode="contained" loading={quoting} disabled={quoting} onPress={generateQuote}>Generate Quotation</Button>
      {quote ? (
        <Card style={styles.card}>
          <Card.Content>
            <Text>Order #{quote.id}</Text>
            <Text>Status: {quote.status}</Text>
            <Text>Total: {formatCurrency(quote.quotedTotal)}</Text>
            <Button mode="contained" loading={placing} onPress={placeOrder} disabled={quote.status === 'placed' || placing} style={{ marginTop: 8 }}>
              Place Order
            </Button>
          </Card.Content>
        </Card>
      ) : null}
      {msg ? <Text style={[styles.msg, msgType === 'error' ? styles.msgError : styles.msgSuccess]}>{msg}</Text> : null}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f8fc' },
  heroCard: { marginBottom: 12, borderRadius: 16, elevation: 3, backgroundColor: '#ffffff' },
  heroTitle: { fontWeight: '800', color: '#1d2939' },
  heroSubtitle: { marginTop: 6, color: '#667085' },
  card: { marginBottom: 12, borderRadius: 14, elevation: 2, backgroundColor: '#fff' },
  input: { marginTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  chipRow: { marginTop: 8 },
  chip: { marginRight: 8 },
  msg: { marginTop: 10 },
  msgError: { color: '#c62828' },
  msgSuccess: { color: '#2e7d32' },
});

export default PlannerScreen;
