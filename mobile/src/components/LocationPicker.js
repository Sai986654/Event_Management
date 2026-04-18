import React, { useCallback, useRef, useState } from 'react';
import { View, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { TextInput, Text } from 'react-native-paper';
import { locationService } from '../services/locationService';
import { Colors, Spacing, Radius } from '../theme';

const genToken = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

/**
 * Google Places autocomplete backed by the backend proxy.
 * Props:
 *   value        – current venue/address text
 *   onChange      – called with the text string on typing
 *   onLocationPick – called with { name, formattedAddress, city, state, lat, lng } on selection
 *   label, placeholder, style – passed to the underlying TextInput
 */
const LocationPicker = ({ value, onChange, onLocationPick, label = 'Venue', placeholder, style, ...rest }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const sessionRef = useRef(genToken());
  const debounceRef = useRef(null);

  const search = useCallback((text) => {
    onChange?.(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.trim().length < 3) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await locationService.autocomplete(text.trim(), sessionRef.current);
        setSuggestions(res.suggestions || []);
      } catch { setSuggestions([]); }
      finally { setLoading(false); }
    }, 350);
  }, [onChange]);

  const pick = useCallback(async (item) => {
    onChange?.(item.description);
    setSuggestions([]);
    try {
      const res = await locationService.placeDetails(item.placeId, sessionRef.current);
      sessionRef.current = genToken(); // reset session after selection
      if (res.place) onLocationPick?.(res.place);
    } catch { /* silently fail – venue text is already set */ }
  }, [onChange, onLocationPick]);

  return (
    <View style={style}>
      <TextInput
        label={label}
        value={value}
        onChangeText={search}
        mode="outlined"
        placeholder={placeholder || 'Search location...'}
        left={<TextInput.Icon icon="map-marker-outline" />}
        right={loading ? <TextInput.Icon icon="loading" /> : undefined}
        outlineStyle={styles.outline}
        {...rest}
      />
      {suggestions.length > 0 && (
        <View style={styles.dropdown}>
          <FlatList
            data={suggestions}
            keyExtractor={(item) => item.placeId}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.item} onPress={() => pick(item)} activeOpacity={0.7}>
                <Text variant="bodyMedium" style={styles.mainText}>{item.mainText}</Text>
                {item.secondaryText ? <Text variant="bodySmall" style={styles.secondaryText}>{item.secondaryText}</Text> : null}
              </TouchableOpacity>
            )}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  outline: { borderRadius: Radius.sm },
  dropdown: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: Radius.sm,
    maxHeight: 200,
    marginTop: -4,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    zIndex: 100,
  },
  item: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
  },
  mainText: { fontWeight: '600', color: Colors.textPrimary },
  secondaryText: { color: Colors.textMuted, marginTop: 1 },
});

export default LocationPicker;
