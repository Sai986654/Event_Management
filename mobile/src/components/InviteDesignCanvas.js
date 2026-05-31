import React, { useMemo, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { Button, Card, Chip, Divider, Text, TextInput } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import LottieView from 'lottie-react-native';
import { Colors, Radius, Spacing } from '../theme';
import { applyColorThemeToLayout, COLOR_THEMES, LOTTIE_STICKERS, STICKER_ASSETS } from '../utils/inviteTemplatePresets';

const STICKER_CATEGORIES = [
  { value: 'all', label: '✨ All' },
  { value: 'wedding', label: '💍 Wedding' },
  { value: 'celebration', label: '🎉 Celebration' },
  { value: 'romantic', label: '❤️ Romantic' },
  { value: 'festive', label: '🎊 Festive' },
];

const DEFAULT_LAYOUT = {
  canvasSize: '1080x1920',
  backgroundColor: '#fff7f2',
  elements: [],
};

const parseCanvasSize = (value) => {
  const [wRaw, hRaw] = String(value || '1080x1920').split('x');
  const width = Math.max(320, Number(wRaw) || 1080);
  const height = Math.max(320, Number(hRaw) || 1920);
  return { width, height };
};

const numberOrFallback = (value, fallback) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return num;
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const cloneLayout = (value) => JSON.parse(JSON.stringify(value || DEFAULT_LAYOUT));

const COLOR_OPTIONS = [
  '#7c2d12', '#9a3412', '#b45309', '#0f172a', '#7B632B', '#be185d',
  '#065f46', '#0f766e', '#1f2937', '#475569', '#111827', '#ffffff',
];

const BACKGROUND_OPTIONS = [
  '#fff7f2', '#fffbeb', '#fff8ea', '#fff1f2', '#f8f3e6', '#f6f8fc', '#ffffff',
];

const InviteDesignCanvas = ({ layout, onLayoutChange, fullScreen = false, onDragStateChange = () => {} }) => {
  const mergedLayout = {
    ...DEFAULT_LAYOUT,
    ...(layout && typeof layout === 'object' ? layout : {}),
    elements: Array.isArray(layout?.elements) ? layout.elements : [],
  };

  const [selectedElementId, setSelectedElementId] = useState(null);
  const [selectedElementIds, setSelectedElementIds] = useState([]);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [showSafeArea, setShowSafeArea] = useState(true);
  const [historyPast, setHistoryPast] = useState([]);
  const [historyFuture, setHistoryFuture] = useState([]);
  const [customImageUrl, setCustomImageUrl] = useState('');
  const [lockPan, setLockPan] = useState(false);
  const [stickerCategory, setStickerCategory] = useState('all');
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const dragRef = useRef({
    activeElementId: null,
    mode: 'move',
    startPageX: 0,
    startPageY: 0,
    startX: 0,
    startY: 0,
    startWidth: 0,
    startHeight: 0,
    groupElementIds: [],
    startPositions: {},
  });

  const selectedElement = useMemo(
    () => mergedLayout.elements.find((element) => element.id === selectedElementId) || null,
    [mergedLayout.elements, selectedElementId]
  );
  const stickerCategoryCounts = useMemo(
    () => LOTTIE_STICKERS.reduce((acc, sticker) => {
      const key = sticker.category || 'festive';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {}),
    []
  );
  const filteredLottieStickers = useMemo(
    () => (stickerCategory === 'all'
      ? LOTTIE_STICKERS
      : LOTTIE_STICKERS.filter((sticker) => sticker.category === stickerCategory)),
    [stickerCategory]
  );

  const canvasSize = parseCanvasSize(mergedLayout.canvasSize);
  let previewWidth = fullScreen ? Math.max(320, screenWidth - 24) : 260;
  let previewHeight = Math.round((canvasSize.height / canvasSize.width) * previewWidth);
  const maxPreviewHeight = fullScreen ? Math.max(420, Math.floor(screenHeight * 0.68)) : 560;
  if (previewHeight > maxPreviewHeight) {
    previewHeight = maxPreviewHeight;
    previewWidth = Math.round((canvasSize.width / canvasSize.height) * previewHeight);
  }

  const commitLayout = (nextLayout, options = {}) => {
    const { trackHistory = true } = options;
    if (trackHistory) {
      setHistoryPast((prev) => [...prev.slice(-39), cloneLayout(mergedLayout)]);
      setHistoryFuture([]);
    }
    onLayoutChange(nextLayout);
  };

  const patchLayout = (patch, options = {}) => {
    commitLayout({ ...mergedLayout, ...patch }, options);
  };

  const patchElement = (elementId, patch, options = {}) => {
    const nextElements = mergedLayout.elements.map((element) =>
      element.id === elementId ? { ...element, ...patch } : element
    );
    patchLayout({ elements: nextElements }, options);
  };

  const clearSelection = () => {
    setSelectedElementId(null);
    setSelectedElementIds([]);
  };

  const isElementSelected = (elementId) =>
    multiSelectMode ? selectedElementIds.includes(elementId) : selectedElementId === elementId;

  const selectElement = (elementId, additive = false) => {
    setSelectedElementId(elementId);
    if (!multiSelectMode) {
      setSelectedElementIds([]);
      return;
    }
    if (!additive) {
      setSelectedElementIds([elementId]);
      return;
    }
    setSelectedElementIds((prev) =>
      prev.includes(elementId) ? prev.filter((id) => id !== elementId) : [...prev, elementId]
    );
  };

  const getActiveSelectionIds = (elementId) => {
    if (!multiSelectMode) return [elementId];
    if (selectedElementIds.includes(elementId) && selectedElementIds.length > 1) return selectedElementIds;
    return [elementId];
  };

  const beginInteractionHistory = () => {
    setHistoryPast((prev) => [...prev.slice(-39), cloneLayout(mergedLayout)]);
    setHistoryFuture([]);
  };

  const undo = () => {
    if (!historyPast.length) return;
    const previous = historyPast[historyPast.length - 1];
    setHistoryPast((prev) => prev.slice(0, -1));
    setHistoryFuture((prev) => [cloneLayout(mergedLayout), ...prev].slice(0, 40));
    onLayoutChange(previous);
    const previousIds = new Set((previous.elements || []).map((element) => element.id));
    setSelectedElementIds((prev) => prev.filter((id) => previousIds.has(id)));
    if (!previousIds.has(selectedElementId)) setSelectedElementId(null);
  };

  const redo = () => {
    if (!historyFuture.length) return;
    const next = historyFuture[0];
    setHistoryFuture((prev) => prev.slice(1));
    setHistoryPast((prev) => [...prev.slice(-39), cloneLayout(mergedLayout)]);
    onLayoutChange(next);
  };

  const addElement = (type) => {
    const id = `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const base = { id, x: 80, y: 200, z: mergedLayout.elements.length };
    const typed =
      type === 'text'
        ? { ...base, type: 'text', text: 'Your text here', fontSize: 42, color: '#7c2d12', textAlign: 'center', fontWeight: '700', width: 860, height: 110 }
        : type === 'shape'
        ? { ...base, type: 'shape', fillColor: '#fcd4b5', borderRadius: 24, width: 860, height: 560 }
        : type === 'divider'
        ? { ...base, type: 'divider', color: '#b45309', width: 640, height: 4 }
        : { ...base, type: 'image', imageUrl: '', width: 480, height: 320 };

    patchLayout({ elements: [...mergedLayout.elements, typed] });
    setSelectedElementId(id);
    setSelectedElementIds((prev) => (multiSelectMode ? [...prev, id] : []));
  };

  const addSticker = (sticker) => {
    if (!sticker) return;
    const id = `sticker-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const base = {
      id,
      x: 120,
      y: 620,
      width: numberOrFallback(sticker.width, 260),
      height: numberOrFallback(sticker.height, 180),
      z: mergedLayout.elements.length,
    };
    const element = {
      ...base,
      type: 'text',
      text: sticker.text || '✨',
      fontSize: numberOrFallback(sticker.fontSize, 56),
      color: '#7c2d12',
      textAlign: 'center',
      fontWeight: '700',
    };
    patchLayout({ elements: [...mergedLayout.elements, element] });
    setSelectedElementId(id);
    setSelectedElementIds((prev) => (multiSelectMode ? [...prev, id] : []));
  };

  const addLottieSticker = (sticker) => {
    const id = `lottie-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const element = {
      id,
      type: 'lottie',
      x: 80,
      y: 400,
      width: sticker.width || 400,
      height: sticker.height || 400,
      z: mergedLayout.elements.length,
      lottieSource: sticker.source,
      loop: sticker.loop !== false,
      autoPlay: true,
    };
    patchLayout({ elements: [...mergedLayout.elements, element] });
    setSelectedElementId(id);
    setSelectedElementIds((prev) => (multiSelectMode ? [...prev, id] : []));
  };

  const addCustomImageSticker = () => {
    const url = String(customImageUrl || '').trim();
    if (!url) return;
    const id = `custom-image-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const element = {
      id, type: 'image', x: 140, y: 680, width: 300, height: 300,
      z: mergedLayout.elements.length, imageUrl: url,
    };
    patchLayout({ elements: [...mergedLayout.elements, element] });
    setSelectedElementId(id);
    setSelectedElementIds((prev) => (multiSelectMode ? [...prev, id] : []));
    setCustomImageUrl('');
  };

  const addImageFromGallery = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') return;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.9,
      });
      if (result.canceled || !result.assets?.length) return;
      const uri = result.assets[0]?.uri;
      if (!uri) return;
      const id = `gallery-image-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const element = {
        id, type: 'image', x: 140, y: 680, width: 320, height: 320,
        z: mergedLayout.elements.length, imageUrl: uri,
      };
      patchLayout({ elements: [...mergedLayout.elements, element] });
      setSelectedElementId(id);
      setSelectedElementIds((prev) => (multiSelectMode ? [...prev, id] : []));
    } catch (_error) {
      // Silent fallback
    }
  };

  const deleteSelected = () => {
    const targetIds = multiSelectMode && selectedElementIds.length
      ? selectedElementIds
      : selectedElement ? [selectedElement.id] : [];
    if (!targetIds.length) return;
    patchLayout({ elements: mergedLayout.elements.filter((element) => !targetIds.includes(element.id)) });
    clearSelection();
  };

  const duplicateSelected = () => {
    const sourceIds = multiSelectMode && selectedElementIds.length
      ? selectedElementIds
      : selectedElement ? [selectedElement.id] : [];
    if (!sourceIds.length) return;
    const sourceElements = mergedLayout.elements.filter((element) => sourceIds.includes(element.id));
    if (!sourceElements.length) return;
    const createdIds = [];
    const duplicated = sourceElements.map((element, idx) => {
      const id = `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${idx}`;
      createdIds.push(id);
      return { ...element, id, x: numberOrFallback(element.x, 80) + 24, y: numberOrFallback(element.y, 80) + 24, z: mergedLayout.elements.length + idx };
    });
    patchLayout({ elements: [...mergedLayout.elements, ...duplicated] });
    if (multiSelectMode) {
      setSelectedElementIds(createdIds);
      setSelectedElementId(createdIds[0] || null);
    } else {
      setSelectedElementId(createdIds[0] || null);
      setSelectedElementIds([]);
    }
  };

  const reorderSelected = (direction) => {
    if (!selectedElement) return;
    const ordered = mergedLayout.elements.slice().sort((a, b) => numberOrFallback(a.z, 0) - numberOrFallback(b.z, 0));
    const index = ordered.findIndex((element) => element.id === selectedElement.id);
    if (index < 0) return;
    const swapIndex = direction === 'up' ? index + 1 : index - 1;
    if (swapIndex < 0 || swapIndex >= ordered.length) return;
    const next = ordered.slice();
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    patchLayout({ elements: next.map((element, idx) => ({ ...element, z: idx })) });
  };

  const onElementDragStart = (element, nativeEvent) => {
    beginInteractionHistory();
    onDragStateChange(true);
    if (multiSelectMode && !selectedElementIds.includes(element.id)) setSelectedElementIds([element.id]);
    const activeIds = getActiveSelectionIds(element.id);
    const activeSet = new Set(activeIds);
    const startPositions = {};
    mergedLayout.elements.forEach((item) => {
      if (activeSet.has(item.id)) {
        startPositions[item.id] = { x: numberOrFallback(item.x, 0), y: numberOrFallback(item.y, 0) };
      }
    });
    dragRef.current = {
      activeElementId: element.id, mode: 'move',
      startPageX: numberOrFallback(nativeEvent?.pageX, 0), startPageY: numberOrFallback(nativeEvent?.pageY, 0),
      startX: numberOrFallback(element.x, 0), startY: numberOrFallback(element.y, 0),
      startWidth: numberOrFallback(element.width, 100), startHeight: numberOrFallback(element.height, 60),
      groupElementIds: activeIds, startPositions,
    };
    setSelectedElementId(element.id);
  };

  const onResizeStart = (element, nativeEvent) => {
    beginInteractionHistory();
    onDragStateChange(true);
    dragRef.current = {
      activeElementId: element.id, mode: 'resize',
      startPageX: numberOrFallback(nativeEvent?.pageX, 0), startPageY: numberOrFallback(nativeEvent?.pageY, 0),
      startX: numberOrFallback(element.x, 0), startY: numberOrFallback(element.y, 0),
      startWidth: numberOrFallback(element.width, 100), startHeight: numberOrFallback(element.height, 60),
      groupElementIds: [element.id],
      startPositions: { [element.id]: { x: numberOrFallback(element.x, 0), y: numberOrFallback(element.y, 0) } },
    };
    setSelectedElementId(element.id);
  };

  const onElementDragMove = (element, nativeEvent) => {
    if (dragRef.current.activeElementId !== element.id) return;
    const pageX = numberOrFallback(nativeEvent?.pageX, dragRef.current.startPageX);
    const pageY = numberOrFallback(nativeEvent?.pageY, dragRef.current.startPageY);
    const deltaPreviewX = pageX - dragRef.current.startPageX;
    const deltaPreviewY = pageY - dragRef.current.startPageY;
    const deltaCanvasX = deltaPreviewX * (canvasSize.width / previewWidth);
    const deltaCanvasY = deltaPreviewY * (canvasSize.height / previewHeight);
    const grid = 16;
    const width = numberOrFallback(element.width, dragRef.current.startWidth || 100);
    const height = numberOrFallback(element.height, dragRef.current.startHeight || 60);

    if (dragRef.current.mode === 'resize') {
      const maxWidth = Math.max(32, canvasSize.width - numberOrFallback(element.x, 0));
      const maxHeight = Math.max(32, canvasSize.height - numberOrFallback(element.y, 0));
      let nextWidth = clamp(dragRef.current.startWidth + deltaCanvasX, 32, maxWidth);
      let nextHeight = clamp(dragRef.current.startHeight + deltaCanvasY, 32, maxHeight);
      if (snapToGrid) {
        nextWidth = Math.max(32, Math.round(nextWidth / grid) * grid);
        nextHeight = Math.max(32, Math.round(nextHeight / grid) * grid);
      }
      patchElement(element.id, { width: Math.round(nextWidth), height: Math.round(nextHeight) }, { trackHistory: false });
      return;
    }

    const selectedIds = dragRef.current.groupElementIds || [];
    if (selectedIds.length > 1) {
      const deltaX = snapToGrid ? Math.round(deltaCanvasX / grid) * grid : deltaCanvasX;
      const deltaY = snapToGrid ? Math.round(deltaCanvasY / grid) * grid : deltaCanvasY;
      const selectedSet = new Set(selectedIds);
      const nextElements = mergedLayout.elements.map((item) => {
        if (!selectedSet.has(item.id)) return item;
        const wv = numberOrFallback(item.width, 100);
        const hv = numberOrFallback(item.height, 60);
        const start = dragRef.current.startPositions[item.id] || { x: numberOrFallback(item.x, 0), y: numberOrFallback(item.y, 0) };
        return {
          ...item,
          x: Math.round(clamp(start.x + deltaX, 0, Math.max(0, canvasSize.width - wv))),
          y: Math.round(clamp(start.y + deltaY, 0, Math.max(0, canvasSize.height - hv))),
        };
      });
      patchLayout({ elements: nextElements }, { trackHistory: false });
      return;
    }

    let nextX = clamp(dragRef.current.startX + deltaCanvasX, 0, Math.max(0, canvasSize.width - width));
    let nextY = clamp(dragRef.current.startY + deltaCanvasY, 0, Math.max(0, canvasSize.height - height));
    if (snapToGrid) { nextX = Math.round(nextX / grid) * grid; nextY = Math.round(nextY / grid) * grid; }
    patchElement(element.id, { x: Math.round(nextX), y: Math.round(nextY) }, { trackHistory: false });
  };

  const onElementDragEnd = (element) => {
    if (dragRef.current.activeElementId === element.id) {
      dragRef.current.activeElementId = null;
      dragRef.current.mode = 'move';
      dragRef.current.groupElementIds = [];
      dragRef.current.startPositions = {};
      if (!lockPan) onDragStateChange(false);
    }
  };

  const selectedMetrics = selectedElement
    ? {
        cx: ((numberOrFallback(selectedElement.x, 0) + numberOrFallback(selectedElement.width, 100) / 2) / canvasSize.width) * previewWidth,
        cy: ((numberOrFallback(selectedElement.y, 0) + numberOrFallback(selectedElement.height, 60) / 2) / canvasSize.height) * previewHeight,
      }
    : null;

  const showVerticalGuide = selectedMetrics && Math.abs(selectedMetrics.cx - previewWidth / 2) <= 6;
  const showHorizontalGuide = selectedMetrics && Math.abs(selectedMetrics.cy - previewHeight / 2) <= 6;

  const ColorSwatchRow = ({ selected, onSelect, options = COLOR_OPTIONS }) => (
    <View style={styles.swatchRow}>
      {options.map((value) => {
        const isActive = String(selected || '').toLowerCase() === String(value).toLowerCase();
        return (
          <TouchableOpacity
            key={value}
            onPress={() => onSelect(value)}
            style={[styles.swatch, { backgroundColor: value }, isActive ? styles.swatchActive : null, value === '#ffffff' ? styles.swatchWhite : null]}
          />
        );
      })}
    </View>
  );

  const ToolTile = ({ icon, label, color = Colors.secondary, bg = '#f3eee0', onPress, disabled = false }) => (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[styles.toolTile, { backgroundColor: bg }, disabled && styles.toolTileDisabled]}
    >
      <Text style={[styles.toolTileIcon, { color }]}>{icon}</Text>
      <Text style={[styles.toolTileLabel, { color: disabled ? '#94a3b8' : color }]}>{label}</Text>
    </TouchableOpacity>
  );

  const ToggleTile = ({ label, active, onPress }) => (
    <TouchableOpacity onPress={onPress} style={[styles.toggleTile, active && styles.toggleTileActive]}>
      <Text style={[styles.toggleTileText, active && styles.toggleTileTextActive]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.wrapper}>
      {/* ── TOOLBAR ROW 1: Add + Emoji Stickers + Actions ── */}
      <View style={styles.toolbarBlock}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.toolRow}>
            <ToolTile icon="Aa" label="Text" color={Colors.secondary} bg="#f3eee0" onPress={() => addElement('text')} />
            <ToolTile icon="▭" label="Shape" color="#7B632B" bg="#fff8e9" onPress={() => addElement('shape')} />
            <ToolTile icon="━" label="Line" color="#d97706" bg="#fffbeb" onPress={() => addElement('divider')} />
            <ToolTile icon="🖼" label="Image" color="#059669" bg="#ecfdf5" onPress={() => addElement('image')} />
            <View style={styles.toolSep} />
            {STICKER_ASSETS.map((asset) => (
              <ToolTile key={asset.key} icon={asset.thumb || '✨'} label={asset.label} color="#be185d" bg="#fdf2f8" onPress={() => addSticker(asset)} />
            ))}
            <View style={styles.toolSep} />
            <ToolTile icon="↩" label="Undo" color="#475569" bg="#f8fafc" onPress={undo} disabled={!historyPast.length} />
            <ToolTile icon="↪" label="Redo" color="#475569" bg="#f8fafc" onPress={redo} disabled={!historyFuture.length} />
            <ToolTile icon="✕" label="Clear" color="#991b1b" bg="#fef2f2" onPress={clearSelection} disabled={!selectedElementId && !selectedElementIds.length} />
            <ToolTile icon="📷" label="Gallery" color="#0891b2" bg="#ecfeff" onPress={addImageFromGallery} />
          </View>
        </ScrollView>

        {/* ── TOOLBAR ROW 1b: Lottie animated stickers ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
          <View style={styles.categoryRow}>
            {STICKER_CATEGORIES.map((category) => (
              <Chip
                key={category.value}
                selected={stickerCategory === category.value}
                onPress={() => setStickerCategory(category.value)}
                compact
                style={[
                  styles.stickerCategoryChip,
                  stickerCategory === category.value && styles.stickerCategoryChipActive,
                ]}
                textStyle={[
                  styles.stickerCategoryText,
                  stickerCategory === category.value && styles.stickerCategoryTextActive,
                ]}
              >
                {category.value === 'all'
                  ? `${category.label} (${LOTTIE_STICKERS.length})`
                  : `${category.label} (${stickerCategoryCounts[category.value] || 0})`}
              </Chip>
            ))}
          </View>
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
          <View style={styles.toolRow}>
            <Text style={[styles.propLabel, { alignSelf: 'center', marginRight: 4, marginBottom: 0 }]}>✨ Animated:</Text>
            {filteredLottieStickers.map((sticker) => (
              <ToolTile
                key={sticker.key}
                icon={sticker.thumb}
                label={sticker.label}
                color="#7B632B"
                bg="#fff8e9"
                onPress={() => addLottieSticker(sticker)}
              />
            ))}
          </View>
        </ScrollView>

        {/* ── TOOLBAR ROW 2: Toggles + Color Themes ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
          <View style={styles.toolRow}>
            <ToggleTile label="⊞ Grid" active={snapToGrid} onPress={() => setSnapToGrid((prev) => !prev)} />
            <ToggleTile label="⬚ Safe" active={showSafeArea} onPress={() => setShowSafeArea((prev) => !prev)} />
            <ToggleTile
              label="⊕ Multi"
              active={multiSelectMode}
              onPress={() => { setMultiSelectMode((prev) => { if (prev) setSelectedElementIds([]); return !prev; }); }}
            />
            <ToggleTile
              label={lockPan ? '🔒 Locked' : '🔓 Pan'}
              active={lockPan}
              onPress={() => { const next = !lockPan; setLockPan(next); onDragStateChange(next); }}
            />
            <View style={styles.toolSep} />
            {Object.entries(COLOR_THEMES).map(([key, theme]) => (
              <TouchableOpacity
                key={key}
                style={[styles.themeChip, { backgroundColor: theme.bg, borderColor: theme.divider }]}
                onPress={() => commitLayout(applyColorThemeToLayout(mergedLayout, key))}
              >
                <Text style={[styles.themeChipText, { color: theme.text }]}>{theme.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* ── CANVAS ── */}
      <View style={styles.canvasSection}>
        <View
          style={[
            styles.canvasPreview,
            { width: previewWidth, height: previewHeight, backgroundColor: mergedLayout.backgroundColor || '#fff7f2' },
          ]}
        >
          {mergedLayout.elements
            .slice()
            .sort((a, b) => numberOrFallback(a.z, 0) - numberOrFallback(b.z, 0))
            .map((element) => {
              const left = (numberOrFallback(element.x, 0) / canvasSize.width) * previewWidth;
              const top = (numberOrFallback(element.y, 0) / canvasSize.height) * previewHeight;
              const width = (numberOrFallback(element.width, 100) / canvasSize.width) * previewWidth;
              const height = (numberOrFallback(element.height, 60) / canvasSize.height) * previewHeight;
              const isSelected = isElementSelected(element.id);

              return (
                <View
                  key={element.id}
                  onStartShouldSetResponder={() => true}
                  onMoveShouldSetResponder={() => true}
                  onResponderGrant={(evt) => onElementDragStart(element, evt.nativeEvent)}
                  onResponderMove={(evt) => onElementDragMove(element, evt.nativeEvent)}
                  onResponderRelease={() => onElementDragEnd(element)}
                  onResponderTerminate={() => onElementDragEnd(element)}
                  onResponderTerminationRequest={() => false}
                  style={[
                    styles.previewElement,
                    { left, top, width, height, borderColor: isSelected ? Colors.primary : 'transparent' },
                  ]}
                >
                  {element.type === 'text' ? (
                    <Text
                      numberOfLines={4}
                      style={{
                        color: element.color || '#2b1d18',
                        fontWeight: element.fontWeight === '400' ? '400' : '700',
                        fontSize: 11,
                        textAlign: element.textAlign || 'center',
                      }}
                    >
                      {element.text || 'Text'}
                    </Text>
                  ) : null}

                  {element.type === 'shape' ? (
                    <View
                      style={{
                        flex: 1,
                        borderRadius: Math.max(0, (numberOrFallback(element.borderRadius, 0) / canvasSize.width) * previewWidth),
                        backgroundColor: element.fillColor || '#fcd4b5',
                      }}
                    />
                  ) : null}

                  {element.type === 'divider' ? (
                    <View style={{ marginTop: Math.max(0, height / 2 - 1), height: 2, width: '100%', backgroundColor: element.color || '#b45309' }} />
                  ) : null}

                  {element.type === 'image' ? (
                    element.imageUrl ? (
                      <Image source={{ uri: element.imageUrl }} resizeMode="cover" style={styles.imageFill} />
                    ) : (
                      <View style={styles.imagePlaceholder}><Text style={styles.imagePlaceholderText}>Image</Text></View>
                    )
                  ) : null}

                  {element.type === 'lottie' ? (
                    element.lottieSource ? (
                      <LottieView
                        source={element.lottieSource}
                        autoPlay={element.autoPlay !== false}
                        loop={element.loop !== false}
                        style={styles.imageFill}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.imagePlaceholder}><Text style={styles.imagePlaceholderText}>🎬</Text></View>
                    )
                  ) : null}

                  {isSelected ? (
                    <View
                      onStartShouldSetResponder={() => true}
                      onMoveShouldSetResponder={() => true}
                      onResponderGrant={(evt) => onResizeStart(element, evt.nativeEvent)}
                      onResponderMove={(evt) => onElementDragMove(element, evt.nativeEvent)}
                      onResponderRelease={() => onElementDragEnd(element)}
                      onResponderTerminate={() => onElementDragEnd(element)}
                      onResponderTerminationRequest={() => false}
                      style={styles.resizeHandle}
                      pointerEvents={multiSelectMode && selectedElementIds.length > 1 ? 'none' : 'auto'}
                    />
                  ) : null}
                </View>
              );
            })}

          {showVerticalGuide ? <View style={styles.guideVertical} /> : null}
          {showHorizontalGuide ? <View style={styles.guideHorizontal} /> : null}
          {showSafeArea ? <View style={styles.safeAreaGuide} pointerEvents="none" /> : null}
        </View>
      </View>

      {/* ── LAYERS BAR ── */}
      {mergedLayout.elements.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.layersBar}>
          <View style={styles.toolRow}>
            {mergedLayout.elements.map((el, idx) => {
              const icons = { text: 'Aa', shape: '▭', divider: '━', image: '🖼', lottie: '🎬' };
              const layerLabel = `${icons[el.type] || '?'} ${idx + 1}`;
              return (
                <TouchableOpacity
                  key={el.id}
                  style={[styles.layerChip, isElementSelected(el.id) && styles.layerChipActive]}
                  onPress={() => selectElement(el.id, multiSelectMode)}
                >
                  <Text style={[styles.layerChipText, isElementSelected(el.id) && styles.layerChipTextActive]}>{layerLabel}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      ) : null}

      {/* ── PROPERTIES PANEL ── */}
      {selectedElement ? (
        <Card style={styles.propsCard}>
          <Card.Content>
            <Text style={styles.propTitle}>
              {selectedElement.type === 'text' ? 'Aa Text'
                : selectedElement.type === 'shape' ? '▭ Shape'
                : selectedElement.type === 'divider' ? '━ Divider'
                : selectedElement.type === 'lottie' ? '🎬 Lottie'
                : '🖼 Image'} Properties
            </Text>

            <View style={styles.grid4}>
              <TextInput mode="outlined" label="X" keyboardType="numeric" dense value={String(selectedElement.x ?? 0)} onChangeText={(v) => patchElement(selectedElement.id, { x: numberOrFallback(v, 0) })} style={styles.propInput} />
              <TextInput mode="outlined" label="Y" keyboardType="numeric" dense value={String(selectedElement.y ?? 0)} onChangeText={(v) => patchElement(selectedElement.id, { y: numberOrFallback(v, 0) })} style={styles.propInput} />
              <TextInput mode="outlined" label="W" keyboardType="numeric" dense value={String(selectedElement.width ?? 100)} onChangeText={(v) => patchElement(selectedElement.id, { width: numberOrFallback(v, 100) })} style={styles.propInput} />
              <TextInput mode="outlined" label="H" keyboardType="numeric" dense value={String(selectedElement.height ?? 60)} onChangeText={(v) => patchElement(selectedElement.id, { height: numberOrFallback(v, 60) })} style={styles.propInput} />
            </View>

            {selectedElement.type === 'text' ? (
              <View>
                <TextInput mode="outlined" label="Text Content" value={selectedElement.text || ''} onChangeText={(v) => patchElement(selectedElement.id, { text: v })} multiline dense style={styles.propInput} />
                <TextInput mode="outlined" label="Font Size" keyboardType="numeric" dense value={String(selectedElement.fontSize ?? 42)} onChangeText={(v) => patchElement(selectedElement.id, { fontSize: numberOrFallback(v, 42) })} style={[styles.propInput, { width: 100 }]} />
                <Text style={styles.propLabel}>Text Color</Text>
                <ColorSwatchRow selected={selectedElement.color || '#2b1d18'} onSelect={(v) => patchElement(selectedElement.id, { color: v })} />
              </View>
            ) : null}

            {selectedElement.type === 'shape' ? (
              <View>
                <TextInput mode="outlined" label="Corner Radius" keyboardType="numeric" dense value={String(selectedElement.borderRadius ?? 24)} onChangeText={(v) => patchElement(selectedElement.id, { borderRadius: numberOrFallback(v, 24) })} style={[styles.propInput, { width: 140 }]} />
                <Text style={styles.propLabel}>Shape Color</Text>
                <ColorSwatchRow selected={selectedElement.fillColor || '#fcd4b5'} onSelect={(v) => patchElement(selectedElement.id, { fillColor: v })} />
              </View>
            ) : null}

            {selectedElement.type === 'divider' ? (
              <View>
                <Text style={styles.propLabel}>Divider Color</Text>
                <ColorSwatchRow selected={selectedElement.color || '#b45309'} onSelect={(v) => patchElement(selectedElement.id, { color: v })} />
              </View>
            ) : null}

            {selectedElement.type === 'image' ? (
              <TextInput mode="outlined" label="Image URL" value={selectedElement.imageUrl || ''} onChangeText={(v) => patchElement(selectedElement.id, { imageUrl: v })} dense style={styles.propInput} />
            ) : null}

            {selectedElement.type === 'lottie' ? (
              <View>
                <TextInput
                  mode="outlined"
                  label="Lottie JSON URL"
                  value={typeof selectedElement.lottieSource === 'object' ? (selectedElement.lottieSource?.uri || '') : ''}
                  onChangeText={(v) => patchElement(selectedElement.id, { lottieSource: { uri: v } })}
                  dense
                  style={styles.propInput}
                  placeholder="https://assets.lottiefiles.com/..."
                />
                <View style={[styles.toolRow, { marginBottom: 8 }]}>
                  <Chip
                    selected={selectedElement.loop !== false}
                    onPress={() => patchElement(selectedElement.id, { loop: !selectedElement.loop })}
                    style={{ marginRight: 8 }}
                  >
                    {selectedElement.loop !== false ? '🔁 Loop on' : '🔂 Loop off'}
                  </Chip>
                  <Chip
                    selected={selectedElement.autoPlay !== false}
                    onPress={() => patchElement(selectedElement.id, { autoPlay: !selectedElement.autoPlay })}
                  >
                    {selectedElement.autoPlay !== false ? '▶ Auto' : '⏸ Manual'}
                  </Chip>
                </View>
              </View>
            ) : null}

            <Divider style={{ marginVertical: 10 }} />
            <View style={styles.toolRow}>
              <Button compact mode="contained-tonal" onPress={() => reorderSelected('up')}>↑ Fwd</Button>
              <Button compact mode="contained-tonal" onPress={() => reorderSelected('down')}>↓ Back</Button>
              <Button compact mode="contained-tonal" onPress={duplicateSelected}>Copy</Button>
              <Button compact mode="contained-tonal" buttonColor="#fde8e8" textColor="#991b1b" onPress={deleteSelected}>Delete</Button>
            </View>
          </Card.Content>
        </Card>
      ) : null}

      {/* ── CANVAS SETTINGS ── */}
      <Card style={styles.settingsCard}>
        <Card.Content>
          <Text style={styles.propTitle}>Canvas Settings</Text>
          <View style={styles.toolRow}>
            {['1080x1920', '1080x1080', '1920x1080'].map((size) => (
              <ToggleTile key={size} label={size} active={mergedLayout.canvasSize === size} onPress={() => patchLayout({ canvasSize: size })} />
            ))}
          </View>
          <Text style={[styles.propLabel, { marginTop: 8 }]}>Background</Text>
          <ColorSwatchRow selected={mergedLayout.backgroundColor || '#fff7f2'} options={BACKGROUND_OPTIONS} onSelect={(v) => patchLayout({ backgroundColor: v })} />
          <Divider style={{ marginVertical: 10 }} />
          <Text style={styles.propLabel}>Custom Image URL</Text>
          <TextInput mode="outlined" label="https://..." value={customImageUrl} onChangeText={setCustomImageUrl} dense style={styles.propInput} />
          <Button mode="contained-tonal" compact onPress={addCustomImageSticker} disabled={!customImageUrl.trim()} style={{ marginTop: 4 }}>
            Add Custom Image
          </Button>
        </Card.Content>
      </Card>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
  toolbarBlock: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 6,
  },
  toolRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingBottom: 4 },
  toolTile: { width: 56, height: 56, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  toolTileIcon: { fontSize: 22, fontWeight: '700', lineHeight: 28 },
  toolTileLabel: { fontSize: 9, fontWeight: '600', marginTop: 1 },
  toolTileDisabled: { opacity: 0.35 },
  toggleTile: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 20, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1' },
  toggleTileActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  toggleTileText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  toggleTileTextActive: { color: '#ffffff' },
  themeChip: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  themeChipText: { fontSize: 12, fontWeight: '700' },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingBottom: 2 },
  stickerCategoryChip: { backgroundColor: '#f8fafc', borderColor: '#cbd5e1' },
  stickerCategoryChipActive: { backgroundColor: '#fff3d5', borderColor: '#d9c89a' },
  stickerCategoryText: { fontSize: 11, color: '#475569', fontWeight: '600' },
  stickerCategoryTextActive: { color: '#6B5220', fontWeight: '700' },
  toolSep: { width: 1, height: 40, backgroundColor: '#e2e8f0', marginHorizontal: 4 },
  canvasSection: { alignItems: 'center', justifyContent: 'center', paddingVertical: 12, backgroundColor: '#f8fafc' },
  canvasPreview: {
    borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0',
    position: 'relative', overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  previewElement: { position: 'absolute', borderWidth: 1, borderRadius: 4, padding: 2, overflow: 'hidden' },
  resizeHandle: { position: 'absolute', width: 16, height: 16, right: -8, bottom: -8, borderRadius: 8, backgroundColor: Colors.primary, borderWidth: 2, borderColor: '#ffffff' },
  guideVertical: { position: 'absolute', top: 0, bottom: 0, left: '50%', width: 1, backgroundColor: '#B9942A', opacity: 0.5 },
  guideHorizontal: { position: 'absolute', left: 0, right: 0, top: '50%', height: 1, backgroundColor: '#B9942A', opacity: 0.5 },
  safeAreaGuide: { position: 'absolute', top: '6%', left: '6%', right: '6%', bottom: '6%', borderWidth: 1, borderStyle: 'dashed', borderColor: '#f59e0b', borderRadius: 10, opacity: 0.7 },
  imagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f4f6' },
  imageFill: { width: '100%', height: '100%' },
  imagePlaceholderText: { color: '#6b7280', fontSize: 10 },
  layersBar: { backgroundColor: '#f8fafc', borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingVertical: 6, paddingHorizontal: 10 },
  layerChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1', marginRight: 6 },
  layerChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  layerChipText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  layerChipTextActive: { color: '#ffffff' },
  propsCard: { borderRadius: Radius.lg, marginHorizontal: 10, marginTop: 10, backgroundColor: Colors.surface, borderWidth: 1, borderColor: '#e2e8f0' },
  propTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, marginBottom: 10 },
  propLabel: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, marginTop: 6, marginBottom: 4 },
  propInput: { marginBottom: 8, backgroundColor: Colors.surface, fontSize: 13 },
  grid4: { flexDirection: 'row', gap: 6, marginBottom: 8, flexWrap: 'wrap' },
  settingsCard: { borderRadius: Radius.lg, marginHorizontal: 10, marginTop: 10, marginBottom: 20, backgroundColor: Colors.surface, borderWidth: 1, borderColor: '#e2e8f0' },
  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4, marginBottom: 8 },
  swatch: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: '#cbd5e1' },
  swatchActive: { borderWidth: 3, borderColor: '#334155' },
  swatchWhite: { borderColor: '#94a3b8' },
});

export default InviteDesignCanvas;
