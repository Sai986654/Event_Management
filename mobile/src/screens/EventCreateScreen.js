import React, { useContext, useState } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { TextInput, Button, Text, SegmentedButtons } from 'react-native-paper';
import { AuthContext } from '../context/AuthContext';
import { eventService } from '../services/eventService';
import { getErrorMessage } from '../utils/helpers';
import { Colors, Spacing, Radius } from '../theme';

const EVENT_TYPES = [
  { value: 'wedding', label: 'Wedding' },
  { value: 'corporate', label: 'Corporate' },
  { value: 'birthday', label: 'Birthday' },
  { value: 'conference', label: 'Conference' },
  { value: 'concert', label: 'Concert' },
  { value: 'other', label: 'Other' },
];

const EventCreateScreen = ({ navigation }) => {
  const { user } = useContext(AuthContext);
  const [title, setTitle] = useState('');
  const [type, setType] = useState('wedding');
  const [date, setDate] = useState('');
  const [venue, setVenue] = useState('');
  const [city, setCity] = useState('');
  const [budget, setBudget] = useState('');
  const [guestCount, setGuestCount] = useState('');
  const [description, setDescription] = useState('');
  const [vendorIdsText, setVendorIdsText] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!title || !date || !venue) {
      Alert.alert('Missing fields', 'Please fill in title, date, and venue');
      return;
    }
    try {
      setLoading(true);
      const eventData = {
        title: title.trim(),
        type,
        date: new Date(date).toISOString(),
        venue: venue.trim(),
        city: city.trim() || undefined,
        budget: budget ? Number(budget) : undefined,
        guestCount: guestCount ? Number(guestCount) : undefined,
        description: description.trim() || undefined,
      };
      const vendorIds = vendorIdsText
        .split(/[\s,]+/)
        .map((s) => Number(String(s).trim()))
        .filter((n) => Number.isFinite(n) && n > 0);
      if (vendorIds.length) eventData.concernedVendorIds = vendorIds;
      await eventService.createEvent(eventData);
      Alert.alert('Success', 'Event created!', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (err) {
      Alert.alert('Error', getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text variant="headlineSmall" style={styles.title}>Create New Event</Text>

        <TextInput label="Event Title *" value={title} onChangeText={setTitle} mode="outlined" style={styles.input} outlineStyle={styles.outline} left={<TextInput.Icon icon="calendar-star" />} />

        <Text variant="labelLarge" style={styles.fieldLabel}>Event Type</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeRow}>
          {EVENT_TYPES.map((t) => (
            <Button
              key={t.value}
              mode={type === t.value ? 'contained' : 'outlined'}
              compact
              onPress={() => setType(t.value)}
              style={styles.typeBtn}
              buttonColor={type === t.value ? Colors.primary : undefined}
            >
              {t.label}
            </Button>
          ))}
        </ScrollView>

        <TextInput label="Date (YYYY-MM-DD) *" value={date} onChangeText={setDate} mode="outlined" style={styles.input} outlineStyle={styles.outline} left={<TextInput.Icon icon="calendar" />} />
        <TextInput label="Venue *" value={venue} onChangeText={setVenue} mode="outlined" placeholder="e.g. Convention hall, lawn, resort" style={styles.input} outlineStyle={styles.outline} left={<TextInput.Icon icon="map-marker-outline" />} />
        <TextInput label="City" value={city} onChangeText={setCity} mode="outlined" placeholder="e.g. Hyderabad, Bengaluru" style={styles.input} outlineStyle={styles.outline} left={<TextInput.Icon icon="city-variant-outline" />} />
        <TextInput label="Budget (₹)" value={budget} onChangeText={setBudget} mode="outlined" keyboardType="numeric" placeholder="Total in Indian Rupees" style={styles.input} outlineStyle={styles.outline} left={<TextInput.Icon icon="currency-inr" />} />
        <TextInput label="Expected Guests" value={guestCount} onChangeText={setGuestCount} mode="outlined" keyboardType="numeric" style={styles.input} outlineStyle={styles.outline} left={<TextInput.Icon icon="account-group-outline" />} />
        <TextInput label="Description" value={description} onChangeText={setDescription} mode="outlined" multiline numberOfLines={4} style={styles.input} outlineStyle={styles.outline} />
        <TextInput label="Notify vendor IDs (optional)" value={vendorIdsText} onChangeText={setVendorIdsText} mode="outlined" placeholder="e.g. 1, 2, 3 — from marketplace" style={styles.input} outlineStyle={styles.outline} left={<TextInput.Icon icon="store-outline" />} />

        <Button
          mode="contained"
          onPress={handleCreate}
          loading={loading}
          disabled={loading}
          style={styles.button}
          contentStyle={styles.buttonContent}
          labelStyle={{ fontWeight: '700', fontSize: 15 }}
        >
          Create Event
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.lg, paddingBottom: 40 },
  title: { fontWeight: '800', marginBottom: Spacing.xl, color: Colors.primary },
  input: { marginBottom: Spacing.md },
  outline: { borderRadius: Radius.sm },
  fieldLabel: { marginBottom: Spacing.sm, color: Colors.textPrimary, fontWeight: '600' },
  typeRow: { marginBottom: Spacing.md },
  typeBtn: { marginRight: Spacing.sm, borderRadius: Radius.xl },
  button: { marginTop: Spacing.sm, backgroundColor: Colors.primary, borderRadius: Radius.sm },
  buttonContent: { paddingVertical: 8 },
});

export default EventCreateScreen;
