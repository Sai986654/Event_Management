import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AutoComplete } from 'antd';
import { v4 as uuidv4 } from 'uuid';
import { locationService } from '../services/locationService';

const LocationAutocomplete = ({ value, onChange, onLocationPick, placeholder = 'Search location' }) => {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const sessionTokenRef = useRef('');
  const debounceRef = useRef(null);

  const ensureSession = () => {
    if (!sessionTokenRef.current) {
      sessionTokenRef.current = uuidv4();
    }
    return sessionTokenRef.current;
  };

  const clearSession = () => {
    sessionTokenRef.current = '';
  };

  const fetchSuggestions = useMemo(() => async (query) => {
    const input = String(query || '').trim();
    if (input.length < 3) {
      setOptions([]);
      return;
    }

    const token = ensureSession();
    setLoading(true);
    try {
      const res = await locationService.autocomplete(input, token);
      const next = (res.suggestions || []).map((item) => ({
        value: item.description,
        label: `${item.mainText}${item.secondaryText ? `, ${item.secondaryText}` : ''}`,
        placeId: item.placeId,
      }));
      setOptions(next);
    } catch {
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const onSearch = (query) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(query);
    }, 320);
  };

  const onSelect = async (_val, option) => {
    if (!option?.placeId) return;
    const token = ensureSession();
    try {
      const res = await locationService.placeDetails(option.placeId, token);
      onLocationPick?.(res.place);
    } finally {
      clearSession();
      setOptions([]);
    }
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <AutoComplete
      value={value}
      options={options}
      onSearch={onSearch}
      onSelect={onSelect}
      onChange={onChange}
      placeholder={placeholder}
      style={{ width: '100%' }}
      allowClear
      notFoundContent={loading ? 'Searching...' : null}
      filterOption={false}
    />
  );
};

export default LocationAutocomplete;
