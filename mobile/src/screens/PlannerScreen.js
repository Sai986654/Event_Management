import React, { useContext, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Card, Chip, Text, TextInput } from 'react-native-paper';
import { eventService } from '../services/eventService';
import { packageService } from '../services/packageService';
import { orderService } from '../services/orderService';
import { formatCurrency, getErrorMessage } from '../utils/helpers';
import { AuthContext } from '../context/AuthContext';

const PlannerScreen = () => {
  const { user } = useContext(AuthContext);
  const [events, setEvents] = useState([]);
  const [packages, setPackages] = useState([]);
  const [eventId, setEventId] = useState('');
  const [selected, setSelected] = useState({});
  const [quote, setQuote] = useState(null);
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState('info');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(false);
  const [quoting, setQuoting] = useState(false);
  const [placing, setPlacing] = useState(false);

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
    selectedCategory === 'all'
      ? packages
      : packages.filter((p) => p.category === selectedCategory);

  const setCriteria = (packageId, field, value) => {
    setSelected((prev) => ({
      ...prev,
      [packageId]: {
        ...(prev[packageId] || { packageId, criteria: {} }),
        criteria: { ...((prev[packageId] || {}).criteria || {}), [field]: Number(value || 0) },
      },
    }));
  };

  const generateQuote = async () => {
    if (user?.role !== 'customer' && user?.role !== 'admin') {
      setMsg('Only customer/admin can generate quotation');
      return;
    }
    if (!eventId) {
      setMsg('Please enter/select a valid event ID');
      return;
    }
    try {
      setQuoting(true);
      const selections = Object.values(selected);
      if (!selections.length) {
        setMsg('Select at least one package');
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
          <Text style={styles.heroSubtitle}>Select categories, compare packages, and place with confidence.</Text>
        </Card.Content>
      </Card>
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium">Event Planner</Text>
          <Text variant="bodySmall">Select Event</Text>
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
          <Text variant="bodySmall" style={{ marginTop: 6 }}>Filter Packages by Category</Text>
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

      {visiblePackages.map((p) => (
        <Card key={p.id} style={styles.card}>
          <Card.Content>
            <View style={styles.row}>
              <Text variant="titleMedium" style={{ flex: 1 }}>{p.title}</Text>
              <Chip>{p.category}</Chip>
            </View>
            <Text>{p.vendor?.businessName}</Text>
            <Text>{formatCurrency(p.basePrice)}</Text>
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
  row: { flexDirection: 'row', alignItems: 'center' },
  chipRow: { marginTop: 8 },
  chip: { marginRight: 8 },
  msg: { marginTop: 10 },
  msgError: { color: '#c62828' },
  msgSuccess: { color: '#2e7d32' },
});

export default PlannerScreen;
