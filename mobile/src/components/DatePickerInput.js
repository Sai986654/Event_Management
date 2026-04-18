import React, { useState } from 'react';
import { View, Platform, TouchableOpacity, StyleSheet } from 'react-native';
import { TextInput } from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors, Radius } from '../theme';

/**
 * Reusable date picker input.
 * Props: value (YYYY-MM-DD string), onChange(dateString), label, style, mode ('date'|'datetime')
 */
const DatePickerInput = ({ value, onChange, label = 'Date', style, pickerMode = 'date', ...rest }) => {
  const [show, setShow] = useState(false);

  const parsed = value ? new Date(value) : new Date();
  const displayDate = isNaN(parsed.getTime()) ? new Date() : parsed;

  const formatDisplay = (d) => {
    if (!value) return '';
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    if (pickerMode === 'datetime') {
      const hh = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
    }
    return `${yyyy}-${mm}-${dd}`;
  };

  const handleChange = (event, selectedDate) => {
    if (Platform.OS === 'android') setShow(false);
    if (selectedDate) {
      const yyyy = selectedDate.getFullYear();
      const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const dd = String(selectedDate.getDate()).padStart(2, '0');
      onChange(`${yyyy}-${mm}-${dd}`);
    }
  };

  return (
    <View style={style}>
      <TouchableOpacity activeOpacity={0.7} onPress={() => setShow(true)}>
        <View pointerEvents="none">
          <TextInput
            label={label}
            value={formatDisplay(displayDate)}
            mode="outlined"
            editable={false}
            left={<TextInput.Icon icon="calendar" />}
            right={<TextInput.Icon icon="chevron-down" />}
            outlineStyle={styles.outline}
            {...rest}
          />
        </View>
      </TouchableOpacity>
      {show && (
        <DateTimePicker
          value={displayDate}
          mode={pickerMode === 'datetime' ? 'date' : 'date'}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleChange}
          minimumDate={new Date(2020, 0, 1)}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  outline: { borderRadius: Radius.sm },
});

export default DatePickerInput;
