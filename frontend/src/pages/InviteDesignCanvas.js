import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Card,
  Row,
  Col,
  Grid,
  Button,
  Space,
  Input,
  Select,
  InputNumber,
  ColorPicker,
  Divider,
  Empty,
  Tag,
  Tooltip,
  Popconfirm,
  Switch,
} from 'antd';
import {
  DeleteOutlined,
  CopyOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  LockOutlined,
  UnlockOutlined,
} from '@ant-design/icons';
import Lottie from 'lottie-react';
import './InviteDesignCanvas.css';
import { resolveTemplateString } from '../utils/invitePlaceholders';

const LOTTIE_STICKERS = [
  {
    key: 'lottie-confetti',
    label: 'Confetti',
    thumb: '🎊',
    sourceUrl: 'https://assets1.lottiefiles.com/packages/lf20_jcikwtux.json',
    width: 400,
    height: 400,
    loop: true,
  },
  {
    key: 'lottie-birthday',
    label: 'Birthday',
    thumb: '🎂',
    sourceUrl: 'https://assets4.lottiefiles.com/packages/lf20_49rdyysj.json',
    width: 380,
    height: 380,
    loop: true,
  },
  {
    key: 'lottie-hearts',
    label: 'Hearts',
    thumb: '❤️',
    sourceUrl: 'https://assets5.lottiefiles.com/packages/lf20_ydo1amjm.json',
    width: 360,
    height: 360,
    loop: true,
  },
  {
    key: 'lottie-fireworks',
    label: 'Fireworks',
    thumb: '🎆',
    sourceUrl: 'https://assets9.lottiefiles.com/packages/lf20_M9p23l.json',
    width: 420,
    height: 420,
    loop: false,
  },
  {
    key: 'lottie-stars',
    label: 'Stars',
    thumb: '⭐',
    sourceUrl: 'https://assets6.lottiefiles.com/packages/lf20_aZTdD5.json',
    width: 360,
    height: 360,
    loop: true,
  },
  {
    key: 'lottie-wedding',
    label: 'Wedding',
    thumb: '💍',
    sourceUrl: 'https://assets6.lottiefiles.com/packages/lf20_kkflmtur.json',
    width: 400,
    height: 400,
    loop: true,
  },
  {
    key: 'lottie-balloons',
    label: 'Balloons',
    thumb: '🎈',
    sourceUrl: 'https://assets10.lottiefiles.com/packages/lf20_touohxv0.json',
    width: 380,
    height: 400,
    loop: true,
  },
  {
    key: 'lottie-celebration',
    label: 'Celebrate',
    thumb: '🥳',
    sourceUrl: 'https://assets7.lottiefiles.com/packages/lf20_2cwDXD.json',
    width: 400,
    height: 400,
    loop: true,
  },
  {
    key: 'lottie-sparkles',
    label: 'Sparkles',
    thumb: '✨',
    sourceUrl: 'https://assets8.lottiefiles.com/packages/lf20_49rdyysj.json',
    width: 360,
    height: 360,
    loop: true,
  },
  {
    key: 'lottie-party',
    label: 'Party',
    thumb: '🎉',
    sourceUrl: 'https://assets9.lottiefiles.com/packages/lf20_jcikwtux.json',
    width: 380,
    height: 380,
    loop: true,
  },
  {
    key: 'lottie-stars-plus',
    label: 'Stars+',
    thumb: '🌟',
    sourceUrl: 'https://assets10.lottiefiles.com/packages/lf20_ydo1amjm.json',
    width: 360,
    height: 360,
    loop: true,
  },
];

const resolveLottieUrl = (source) => {
  if (!source) return '';
  if (typeof source === 'string') return source;
  if (typeof source === 'object' && typeof source.uri === 'string') return source.uri;
  return '';
};

const getLottieMirrorUrls = (url) => {
  const normalized = String(url || '').trim();
  if (!normalized) return [];

  const packageMatch = normalized.match(/\/packages\/([^/?#]+\.json)/i);
  if (!packageMatch?.[1]) {
    return [normalized];
  }

  const packageFile = packageMatch[1];
  const variants = Array.from({ length: 10 }, (_, index) => `https://assets${index + 1}.lottiefiles.com/packages/${packageFile}`);
  return [normalized, ...variants.filter((candidate) => candidate !== normalized)];
};

const InviteDesignCanvas = ({
  layout = {},
  templateMeta = null,
  onLayoutChange = () => {},
  placeholderTokens = [],
  previewMergeContext = null,
  quickTextBlocks = [],
  sectionBlocks = [],
}) => {
  const screens = Grid.useBreakpoint();
  const [elements, setElements] = useState(layout.elements || []);
  const [selectedElementId, setSelectedElementId] = useState(null);
  const [canvasSize, setCanvasSize] = useState(layout.canvasSize || '1080x1920');
  const [backgroundColor, setBackgroundColor] = useState(layout.backgroundColor || '#ffffff');
  const [showGrid, setShowGrid] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [gridSize, setGridSize] = useState(16);
  const [isShiftSnapBypass, setIsShiftSnapBypass] = useState(false);
  const [sectionGuide, setSectionGuide] = useState({ show: false, topYCanvas: 0, centerV: false });
  const [dragGuide, setDragGuide] = useState({ show: false, xCanvas: null, yCanvas: null });
  const [lottieDataMap, setLottieDataMap] = useState({});
  const [placeholderAutocomplete, setPlaceholderAutocomplete] = useState({
    active: false,
    start: -1,
    cursor: -1,
    query: '',
    suggestions: [],
    activeIndex: 0,
  });
  const textAreaRef = useRef(null);
  const guideTimerRef = useRef(null);
  const canvasRef = useRef(null);
  const elementsRef = useRef(elements);
  const dragStateRef = useRef(null);

  const selectedElement = elements.find((el) => el.id === selectedElementId);

  // Parse canvas size early so callbacks can safely reference these constants.
  const [canvasWidth, canvasHeight] = canvasSize.split('x').map(Number);
  const aspectRatio = canvasWidth / canvasHeight;
  const maxPreviewWidth = screens.xxl ? 420 : screens.xl ? 380 : screens.lg ? 330 : screens.md ? 300 : 250;
  const previewWidth = maxPreviewWidth;
  const previewHeight = maxPreviewWidth / aspectRatio;

  useEffect(() => {
    setElements(layout.elements || []);
    setCanvasSize(layout.canvasSize || '1080x1920');
    setBackgroundColor(layout.backgroundColor || '#ffffff');
  }, [layout.backgroundColor, layout.canvasSize, layout.elements]);

  useEffect(() => {
    elementsRef.current = elements;
  }, [elements]);

  useEffect(() => {
    const urls = Array.from(
      new Set(
        (elements || [])
          .filter((element) => element.type === 'lottie')
          .map((element) => resolveLottieUrl(element.lottieSource))
          .filter(Boolean)
      )
    );
    const missing = urls.filter((url) => !lottieDataMap[url]);
    if (!missing.length) return;

    let cancelled = false;

    Promise.all(
      missing.map(async (requestedUrl) => {
        const candidates = getLottieMirrorUrls(requestedUrl);
        for (const candidateUrl of candidates) {
          try {
            const response = await fetch(candidateUrl);
            if (!response.ok) continue;
            const json = await response.json();
            const hasFrames = Array.isArray(json?.layers) || Array.isArray(json?.assets);
            if (!hasFrames) continue;
            return [requestedUrl, candidateUrl, json];
          } catch (_error) {
            // Try mirror domains when a source fails due to host or CORS policy.
          }
        }
        return null;
      })
    ).then((results) => {
      if (cancelled) return;
      const entries = results.filter(Boolean);
      if (!entries.length) return;
      setLottieDataMap((prev) => {
        const next = { ...prev };
        entries.forEach(([requestedUrl, resolvedUrl, data]) => {
          if (!next[requestedUrl]) next[requestedUrl] = data;
          if (!next[resolvedUrl]) next[resolvedUrl] = data;
        });
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [elements, lottieDataMap]);

  useEffect(() => {
    return () => {
      if (guideTimerRef.current) {
        clearTimeout(guideTimerRef.current);
      }
    };
  }, []);

  // Generate unique ID
  const generateId = useCallback(() => `element-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`, []);

  // Update layout
  const updateLayout = useCallback((newElements) => {
    onLayoutChange({
      elements: newElements,
      canvasSize,
      backgroundColor,
      templateKey: layout.templateKey || null,
      mergeData: layout.mergeData || {},
      eventType: layout.eventType || null,
    });
  }, [onLayoutChange, canvasSize, backgroundColor, layout.templateKey, layout.mergeData, layout.eventType]);

  const snapValue = useCallback(
    (value) => {
      if (!snapToGrid) return value;
      const size = Math.max(1, Number(gridSize) || 1);
      return Math.round(Number(value || 0) / size) * size;
    },
    [gridSize, snapToGrid]
  );

  // Add new element
  const handleAddElement = useCallback(
    (type) => {
      const newElement = {
        id: generateId(),
        type,
        locked: false,
        x: 20,
        y: 20,
        width: type === 'image' ? 200 : 300,
        height: type === 'image' ? 200 : 'auto',
        z: elements.length,
        ...(type === 'text' && {
          text: 'Click to edit',
          fontSize: 24,
          fontWeight: 'normal',
          color: '#000000',
          textAlign: 'left',
          fontFamily: 'Arial',
        }),
        ...(type === 'image' && {
          src: '',
          objectFit: 'cover',
        }),
        ...(type === 'shape' && {
          shapeType: 'rectangle',
          fillColor: '#667eea',
          strokeColor: '#000000',
          strokeWidth: 2,
          borderRadius: 0,
        }),
        ...(type === 'divider' && {
          color: '#cccccc',
          thickness: 2,
          orientation: 'horizontal',
        }),
        ...(type === 'lottie' && {
          lottieSource: LOTTIE_STICKERS[0]?.sourceUrl || '',
          loop: true,
          autoPlay: true,
          width: 260,
          height: 260,
        }),
      };

      const newElements = [...elements, newElement];
      setElements(newElements);
      setSelectedElementId(newElement.id);
      updateLayout(newElements);
    },
    [elements, generateId, updateLayout]
  );

  // Update element
  const handleUpdateElement = useCallback(
    (id, updates) => {
      const newElements = elements.map((el) =>
        el.id === id ? { ...el, ...updates } : el
      );
      setElements(newElements);
      updateLayout(newElements);
    },
    [elements, updateLayout]
  );

  const handleAddQuickTextBlock = useCallback(
    (text) => {
      const newElement = {
        id: generateId(),
        type: 'text',
        locked: false,
        x: 24,
        y: 24 + elements.length * 18,
        width: 360,
        height: 'auto',
        z: elements.length,
        text,
        fontSize: 24,
        fontWeight: 'normal',
        color: '#000000',
        textAlign: 'left',
        fontFamily: 'Arial',
      };
      const newElements = [...elements, newElement];
      setElements(newElements);
      setSelectedElementId(newElement.id);
      updateLayout(newElements);
    },
    [elements, generateId, updateLayout]
  );

  const handleAddSectionBlock = useCallback(
    (block) => {
      if (!block?.elements?.length) return;

      const [rawCanvasWidth] = String(canvasSize || '1080x1920').split('x').map(Number);
      const safeCanvasWidth = Number.isFinite(rawCanvasWidth) && rawCanvasWidth > 0 ? rawCanvasWidth : 1080;

      const maxBottom = elements.reduce((max, element) => {
        const y = Number(element.y || 0);
        const h = Number(element.height) || 80;
        return Math.max(max, y + h);
      }, 0);
      const baseYRaw = Math.min(1600, maxBottom > 0 ? maxBottom + 24 : 24);
      const baseY = Math.round(baseYRaw / 16) * 16;

      const newItems = block.elements.map((template, index) => {
        const templateY = Number(template.y || 0);
        const normalizedY = Math.max(20, Math.min(1800, baseY + templateY - 40));
        const elementWidth = Number(template.width || 300);
        const centeredX = Math.max(0, (safeCanvasWidth - elementWidth) / 2);
        const rawX = Number(template.x || 20);
        const snapToCenter = Math.abs(rawX - centeredX) <= 40;
        const normalizedX = snapToCenter ? centeredX : Math.round(rawX / 16) * 16;

        return {
          ...template,
          id: generateId(),
          locked: false,
          x: Math.max(0, normalizedX),
          y: normalizedY,
          z: elements.length + index,
          width: template.width || 300,
          height: template.height ?? 'auto',
        };
      });

      const newElements = [...elements, ...newItems];
      setElements(newElements);
      setSelectedElementId(newItems[newItems.length - 1]?.id || null);
      updateLayout(newElements);

      setSectionGuide({ show: true, topYCanvas: baseY, centerV: true });
      if (guideTimerRef.current) {
        clearTimeout(guideTimerRef.current);
      }
      guideTimerRef.current = setTimeout(() => {
        setSectionGuide({ show: false, topYCanvas: 0, centerV: false });
      }, 1400);
    },
    [canvasSize, elements, generateId, updateLayout]
  );

  const handleAddLottieSticker = useCallback(
    (sticker) => {
      if (!sticker?.sourceUrl) return;
      const newElement = {
        id: generateId(),
        type: 'lottie',
        locked: false,
        x: 40,
        y: 40,
        width: Number(sticker.width) || 360,
        height: Number(sticker.height) || 360,
        z: elements.length,
        lottieSource: sticker.sourceUrl,
        loop: sticker.loop !== false,
        autoPlay: true,
      };
      const newElements = [...elements, newElement];
      setElements(newElements);
      setSelectedElementId(newElement.id);
      updateLayout(newElements);
    },
    [elements, generateId, updateLayout]
  );

  const refreshAutocomplete = useCallback(
    (textValue, cursorPos) => {
      const text = String(textValue || '');
      const cursor = Number.isInteger(cursorPos) ? cursorPos : text.length;
      const start = text.lastIndexOf('{{', Math.max(0, cursor - 1));
      if (start < 0) {
        setPlaceholderAutocomplete({ active: false, start: -1, cursor: -1, query: '', suggestions: [] });
        return;
      }
      const closedIndex = text.indexOf('}}', start);
      if (closedIndex !== -1 && closedIndex < cursor) {
        setPlaceholderAutocomplete({ active: false, start: -1, cursor: -1, query: '', suggestions: [] });
        return;
      }

      const query = text.slice(start + 2, cursor).trim().toLowerCase();
      const suggestions = placeholderTokens
        .filter((token) => token.toLowerCase().includes(query))
        .slice(0, 8);

      if (!suggestions.length) {
        setPlaceholderAutocomplete({ active: false, start: -1, cursor: -1, query: '', suggestions: [] });
        return;
      }

      setPlaceholderAutocomplete({
        active: true,
        start,
        cursor,
        query,
        suggestions,
        activeIndex: 0,
      });
    },
    [placeholderTokens]
  );

  const getTextAreaCursor = useCallback(() => {
    const el = textAreaRef.current?.resizableTextArea?.textArea;
    if (!el) return null;
    return el.selectionStart;
  }, []);

  const handleTextChange = useCallback(
    (event) => {
      if (!selectedElement || selectedElement.type !== 'text') return;
      const nextText = event?.target?.value || '';
      handleUpdateElement(selectedElement.id, { text: nextText });
      const cursor = getTextAreaCursor();
      refreshAutocomplete(nextText, cursor);
    },
    [getTextAreaCursor, handleUpdateElement, refreshAutocomplete, selectedElement]
  );

  const handleInsertPlaceholder = useCallback(
    (token) => {
      if (!selectedElement || selectedElement.type !== 'text' || selectedElement.locked) return;
      const currentText = String(selectedElement.text || '');
      const separator = currentText && !/\s$/.test(currentText) ? ' ' : '';
      handleUpdateElement(selectedElement.id, { text: `${currentText}${separator}${token}`.trim() });
    },
    [handleUpdateElement, selectedElement]
  );

  const handleAutocompleteSelect = useCallback(
    (token) => {
      if (!selectedElement || selectedElement.type !== 'text') return;
      const source = String(selectedElement.text || '');
      if (!placeholderAutocomplete.active) {
        handleInsertPlaceholder(token);
        return;
      }

      const start = Math.max(0, placeholderAutocomplete.start);
      const cursor = Math.max(start, placeholderAutocomplete.cursor);
      const nextText = `${source.slice(0, start)}${token}${source.slice(cursor)}`;
      handleUpdateElement(selectedElement.id, { text: nextText });
      setPlaceholderAutocomplete({ active: false, start: -1, cursor: -1, query: '', suggestions: [], activeIndex: 0 });

      // Restore caret near inserted token end for fluid typing
      requestAnimationFrame(() => {
        const el = textAreaRef.current?.resizableTextArea?.textArea;
        if (!el) return;
        const nextPos = start + token.length;
        el.focus();
        try {
          el.setSelectionRange(nextPos, nextPos);
        } catch (_error) {
          // no-op fallback for browsers that disallow selection updates
        }
      });
    },
    [handleInsertPlaceholder, handleUpdateElement, placeholderAutocomplete, selectedElement]
  );

  const handleTextKeyDown = useCallback(
    (event) => {
      if (!placeholderAutocomplete.active || !placeholderAutocomplete.suggestions.length) return;

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setPlaceholderAutocomplete((prev) => ({
          ...prev,
          activeIndex: (prev.activeIndex + 1) % prev.suggestions.length,
        }));
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setPlaceholderAutocomplete((prev) => ({
          ...prev,
          activeIndex: (prev.activeIndex - 1 + prev.suggestions.length) % prev.suggestions.length,
        }));
        return;
      }

      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        const token = placeholderAutocomplete.suggestions[placeholderAutocomplete.activeIndex];
        if (token) handleAutocompleteSelect(token);
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        setPlaceholderAutocomplete({ active: false, start: -1, cursor: -1, query: '', suggestions: [], activeIndex: 0 });
      }
    },
    [handleAutocompleteSelect, placeholderAutocomplete]
  );

  const handleNumericPositionUpdate = useCallback(
    (id, key, value) => {
      if (value === null || value === undefined || Number.isNaN(Number(value))) return;
      const normalized = key === 'x' || key === 'y' || key === 'width' || key === 'height'
        ? snapValue(value)
        : value;
      handleUpdateElement(id, { [key]: normalized });
    },
    [handleUpdateElement, snapValue]
  );

  const nudgeSelected = useCallback(
    (dx, dy, stepOverride = null) => {
      if (!selectedElement || selectedElement.locked) return;
      const resolvedStep = stepOverride === null ? Math.max(1, Number(gridSize) || 1) : Math.max(1, Number(stepOverride) || 1);
      const nextX = snapValue(Number(selectedElement.x || 0) + dx * resolvedStep);
      const nextY = snapValue(Number(selectedElement.y || 0) + dy * resolvedStep);
      handleUpdateElement(selectedElement.id, { x: nextX, y: nextY });
    },
    [gridSize, handleUpdateElement, selectedElement, snapValue]
  );

  const getAlignedPosition = useCallback(
    (targetElementId, rawX, rawY, width, height, enableAlignSnap = true) => {
      if (!enableAlignSnap) {
        return {
          x: rawX,
          y: rawY,
          guide: {
            show: false,
            xCanvas: null,
            yCanvas: null,
          },
        };
      }

      const sourceElements = elementsRef.current || [];
      const targetWidth = Number(width) || 0;
      const targetHeight = Number(height) || 0;
      const threshold = 10;

      let snappedX = rawX;
      let snappedY = rawY;
      let bestX = { distance: Number.POSITIVE_INFINITY, line: null, x: rawX };
      let bestY = { distance: Number.POSITIVE_INFINITY, line: null, y: rawY };

      const xTargets = [
        { value: 0 },
        { value: canvasWidth / 2 },
        { value: canvasWidth },
      ];

      const yTargets = [
        { value: 0 },
        { value: canvasHeight / 2 },
        { value: canvasHeight },
      ];

      sourceElements
        .filter((element) => element.id !== targetElementId)
        .forEach((element) => {
          const otherX = Number(element.x || 0);
          const otherY = Number(element.y || 0);
          const otherWidth = Number(element.width) || 0;
          const otherHeight = Number(element.height) || 0;

          xTargets.push(
            { value: otherX },
            { value: otherX + otherWidth / 2 },
            { value: otherX + otherWidth }
          );

          yTargets.push(
            { value: otherY },
            { value: otherY + otherHeight / 2 },
            { value: otherY + otherHeight }
          );
        });

      xTargets.forEach((target) => {
        const options = [
          { distance: Math.abs(rawX - target.value), x: target.value },
          { distance: Math.abs(rawX + targetWidth / 2 - target.value), x: target.value - targetWidth / 2 },
          { distance: Math.abs(rawX + targetWidth - target.value), x: target.value - targetWidth },
        ];

        options.forEach((candidate) => {
          if (candidate.distance <= threshold && candidate.distance < bestX.distance) {
            bestX = { distance: candidate.distance, line: target.value, x: candidate.x };
          }
        });
      });

      yTargets.forEach((target) => {
        const options = [
          { distance: Math.abs(rawY - target.value), y: target.value },
          { distance: Math.abs(rawY + targetHeight / 2 - target.value), y: target.value - targetHeight / 2 },
          { distance: Math.abs(rawY + targetHeight - target.value), y: target.value - targetHeight },
        ];

        options.forEach((candidate) => {
          if (candidate.distance <= threshold && candidate.distance < bestY.distance) {
            bestY = { distance: candidate.distance, line: target.value, y: candidate.y };
          }
        });
      });

      let xGuide = null;
      let yGuide = null;

      if (bestX.distance !== Number.POSITIVE_INFINITY) {
        snappedX = bestX.x;
        xGuide = bestX.line;
      }

      if (bestY.distance !== Number.POSITIVE_INFINITY) {
        snappedY = bestY.y;
        yGuide = bestY.line;
      }

      return {
        x: snappedX,
        y: snappedY,
        guide: {
          show: xGuide !== null || yGuide !== null,
          xCanvas: xGuide,
          yCanvas: yGuide,
        },
      };
    },
    [canvasHeight, canvasWidth]
  );

  const handleDragMove = useCallback(
    (event) => {
      const dragState = dragStateRef.current;
      const viewport = canvasRef.current;
      if (!dragState || !viewport) return;

      const shouldSnap = snapToGrid && !event.shiftKey;
      setIsShiftSnapBypass(!shouldSnap && snapToGrid);

      const deltaX = (event.clientX - dragState.startClientX) / dragState.scaleX;
      const deltaY = (event.clientY - dragState.startClientY) / dragState.scaleY;

      let nextX = dragState.startX + deltaX;
      let nextY = dragState.startY + deltaY;

      if (shouldSnap) {
        nextX = snapValue(nextX);
        nextY = snapValue(nextY);
      }

      const aligned = getAlignedPosition(dragState.elementId, nextX, nextY, dragState.width, dragState.height, shouldSnap);
      nextX = aligned.x;
      nextY = aligned.y;

      const boundedX = Math.max(0, Math.min(canvasWidth - dragState.width, nextX));
      const boundedY = Math.max(0, Math.min(canvasHeight - dragState.height, nextY));

      const nextElements = (elementsRef.current || []).map((element) =>
        element.id === dragState.elementId ? { ...element, x: boundedX, y: boundedY } : element
      );

      elementsRef.current = nextElements;
      setElements(nextElements);
      updateLayout(nextElements);
      setDragGuide(shouldSnap ? aligned.guide : { show: false, xCanvas: null, yCanvas: null });
    },
    [canvasHeight, canvasWidth, getAlignedPosition, snapToGrid, snapValue, updateLayout]
  );

  const handleDragEnd = useCallback(() => {
    dragStateRef.current = null;
    setIsShiftSnapBypass(false);
    setDragGuide({ show: false, xCanvas: null, yCanvas: null });
    window.removeEventListener('mousemove', handleDragMove);
    window.removeEventListener('mouseup', handleDragEnd);
  }, [handleDragMove]);

  const handleElementMouseDown = useCallback(
    (event, element) => {
      if (event.button !== 0 || element.locked) return;
      event.preventDefault();
      event.stopPropagation();

      const viewport = canvasRef.current;
      if (!viewport) return;

      const scaleX = previewWidth / canvasWidth;
      const scaleY = previewHeight / canvasHeight;
      const width = Number(element.width) || 0;
      const height = Number(element.height);

      dragStateRef.current = {
        elementId: element.id,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startX: Number(element.x || 0),
        startY: Number(element.y || 0),
        width,
        height: Number.isFinite(height) ? height : 0,
        scaleX,
        scaleY,
      };

      setSelectedElementId(element.id);
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
    },
    [canvasHeight, canvasWidth, handleDragEnd, handleDragMove, previewHeight, previewWidth]
  );

  // Delete element
  const handleDeleteElement = useCallback(
    (id) => {
      const newElements = elements.filter((el) => el.id !== id);
      setElements(newElements);
      setSelectedElementId(null);
      updateLayout(newElements);
    },
    [elements, updateLayout]
  );

  useEffect(() => {
    const onKeyDown = (event) => {
      const target = event.target;
      const isEditable = target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      );
      if (isEditable) return;

      if (!selectedElement || selectedElement.locked) return;

      const fineStep = 1;
      const coarseStep = Math.max(1, Number(gridSize) || 1);
      const step = event.shiftKey ? fineStep : coarseStep;

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        nudgeSelected(-1, 0, step);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        nudgeSelected(1, 0, step);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        nudgeSelected(0, -1, step);
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        nudgeSelected(0, 1, step);
      } else if ((event.key === 'Delete' || event.key === 'Backspace') && selectedElement?.id) {
        event.preventDefault();
        handleDeleteElement(selectedElement.id);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [gridSize, handleDeleteElement, nudgeSelected, selectedElement]);

  // Duplicate element
  const handleDuplicateElement = useCallback(
    (id) => {
      const original = elements.find((el) => el.id === id);
      if (!original) return;

      const duplicated = {
        ...original,
        id: generateId(),
        x: original.x + 20,
        y: original.y + 20,
        z: elements.length,
      };

      const newElements = [...elements, duplicated];
      setElements(newElements);
      setSelectedElementId(duplicated.id);
      updateLayout(newElements);
    },
    [elements, generateId, updateLayout]
  );

  // Reorder elements
  const handleReorder = useCallback(
    (id, direction) => {
      const index = elements.findIndex((el) => el.id === id);
      if (index === -1) return;

      const newElements = [...elements];
      if (direction === 'up' && index < newElements.length - 1) {
        [newElements[index], newElements[index + 1]] = [newElements[index + 1], newElements[index]];
      } else if (direction === 'down' && index > 0) {
        [newElements[index], newElements[index - 1]] = [newElements[index - 1], newElements[index]];
      }

      newElements.forEach((el, i) => {
        el.z = i;
      });

      setElements(newElements);
      updateLayout(newElements);
    },
    [elements, updateLayout]
  );

  return (
    <div className="invite-design-canvas">
      <Row gutter={[14, 14]} className="invite-canvas-layout">
        {/* Left Panel - Element Manager */}
        <Col xs={{ span: 24, order: 2 }} xl={{ span: 6, order: 1 }} xxl={{ span: 5, order: 1 }}>
          <Card title="Elements & Layers" size="small" className="invite-canvas-panel invite-canvas-panel--left">
            <Space direction="vertical" style={{ width: '100%' }} size={8}>
              <div>
                <div style={{ marginBottom: 8, fontWeight: 600 }}>Add Element</div>
                <Space wrap size="small">
                  <Button size="small" onClick={() => handleAddElement('text')}>
                    + Text
                  </Button>
                  <Button size="small" onClick={() => handleAddElement('image')}>
                    + Image
                  </Button>
                  <Button size="small" onClick={() => handleAddElement('shape')}>
                    + Shape
                  </Button>
                  <Button size="small" onClick={() => handleAddElement('divider')}>
                    + Line
                  </Button>
                  <Button size="small" onClick={() => handleAddElement('lottie')}>
                    + Animated
                  </Button>
                </Space>
              </div>

              <div>
                <div style={{ marginBottom: 8, marginTop: 4, fontWeight: 600 }}>Animated Stickers</div>
                <Space wrap size="small">
                  {LOTTIE_STICKERS.map((sticker) => (
                    <Button key={sticker.key} size="small" type="dashed" onClick={() => handleAddLottieSticker(sticker)}>
                      {sticker.thumb} {sticker.label}
                    </Button>
                  ))}
                </Space>
              </div>

              {quickTextBlocks.length ? (
                <div>
                  <div style={{ marginBottom: 8, marginTop: 4, fontWeight: 600 }}>Quick Text Blocks</div>
                  <Space wrap size="small">
                    {quickTextBlocks.map((block) => (
                      <Button key={block.key} size="small" type="dashed" onClick={() => handleAddQuickTextBlock(block.text)}>
                        + {block.label}
                      </Button>
                    ))}
                  </Space>
                </div>
              ) : null}

              {sectionBlocks.length ? (
                <div>
                  <div style={{ marginBottom: 8, marginTop: 4, fontWeight: 600 }}>Insert Section Layout</div>
                  <Space wrap size="small">
                    {sectionBlocks.map((block) => (
                      <Button key={block.key} size="small" onClick={() => handleAddSectionBlock(block)}>
                        + {block.label}
                      </Button>
                    ))}
                  </Space>
                </div>
              ) : null}

              <Divider style={{ margin: '8px 0' }} />

              <div>
                <div style={{ marginBottom: 8, fontWeight: 600 }}>Layers</div>
                {elements.length === 0 ? (
                  <Empty description="No elements" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                ) : (
                  <div className="canvas-layers">
                    {elements.map((element) => (
                      <div
                        key={element.id}
                        className={`canvas-layer ${selectedElementId === element.id ? 'selected' : ''}`}
                        onClick={() => setSelectedElementId(element.id)}
                      >
                        <div className="layer-info">
                          <span className="layer-type">{element.type}</span>
                          <span className="layer-label">
                            {element.type === 'text' && element.text.substring(0, 20)}
                            {element.type === 'image' && 'Image'}
                            {element.type === 'shape' && element.shapeType}
                            {element.type === 'divider' && 'Divider'}
                            {element.type === 'lottie' && 'Animated'}
                          </span>
                        </div>
                        <div className="layer-actions">
                          <Tooltip title={element.locked ? 'Unlock' : 'Lock'}>
                            <Button
                              type="text"
                              size="small"
                              icon={element.locked ? <LockOutlined /> : <UnlockOutlined />}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUpdateElement(element.id, { locked: !element.locked });
                              }}
                            />
                          </Tooltip>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Space>
          </Card>
        </Col>

        {/* Center Panel - Canvas Preview */}
        <Col xs={{ span: 24, order: 1 }} xl={{ span: 10, order: 2 }} xxl={{ span: 11, order: 2 }}>
          <Card title="Canvas Preview" size="small" className="invite-canvas-panel invite-canvas-panel--center">
            <div className="invite-canvas-center-body">
              <div className="canvas-viewport">
                <div
                  ref={canvasRef}
                  className="invite-canvas"
                  onMouseDown={() => setSelectedElementId(null)}
                  style={{
                    width: previewWidth,
                    height: previewHeight,
                    backgroundColor,
                    position: 'relative',
                    overflow: 'hidden',
                    border: '1px solid #e0e0e0',
                    backgroundImage: showGrid
                      ? `linear-gradient(0deg, transparent 24%, rgba(0,0,0,.05) 25%, rgba(0,0,0,.05) 26%, transparent 27%, transparent 74%, rgba(0,0,0,.05) 75%, rgba(0,0,0,.05) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(0,0,0,.05) 25%, rgba(0,0,0,.05) 26%, transparent 27%, transparent 74%, rgba(0,0,0,.05) 75%, rgba(0,0,0,.05) 76%, transparent 77%, transparent)`
                      : 'none',
                    backgroundSize: showGrid ? '40px 40px' : 'auto',
                  }}
                >
                  {elements.map((element) => {
                    const scaleX = previewWidth / canvasWidth;
                    const scaleY = previewHeight / canvasHeight;

                    const style = {
                      position: 'absolute',
                      left: element.x * scaleX,
                      top: element.y * scaleY,
                      width: element.width * scaleX,
                      height: element.height === 'auto' ? 'auto' : element.height * scaleY,
                      zIndex: element.z,
                      opacity: selectedElementId === element.id ? 0.9 : 1,
                      cursor: element.locked ? 'default' : 'pointer',
                      border: selectedElementId === element.id ? '2px solid #667eea' : 'none',
                      boxSizing: 'border-box',
                    };

                    return (
                      <div
                        key={element.id}
                        style={style}
                        onMouseDown={(event) => handleElementMouseDown(event, element)}
                        onClick={() => !element.locked && setSelectedElementId(element.id)}
                        className="canvas-element"
                      >
                        {element.type === 'text' && (
                          <span
                            style={{
                              fontSize: element.fontSize * scaleX,
                              fontWeight: element.fontWeight,
                              color: element.color,
                              fontFamily: element.fontFamily,
                              textAlign: element.textAlign,
                              display: 'block',
                              wordWrap: 'break-word',
                            }}
                          >
                            {resolveTemplateString(element.text, previewMergeContext || {})}
                          </span>
                        )}
                        {element.type === 'image' && (
                          <img
                            src={element.src || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23eee" width="200" height="200"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999" font-size="14"%3EImage%3C/text%3E%3C/svg%3E'}
                            alt="element"
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: element.objectFit,
                            }}
                          />
                        )}
                        {element.type === 'shape' && element.shapeType === 'rectangle' && (
                          <div
                            style={{
                              width: '100%',
                              height: '100%',
                              backgroundColor: element.fillColor,
                              border: `${element.strokeWidth}px solid ${element.strokeColor}`,
                              borderRadius: element.borderRadius,
                            }}
                          />
                        )}
                        {element.type === 'divider' && element.orientation === 'horizontal' && (
                          <div
                            style={{
                              width: '100%',
                              height: element.thickness,
                              backgroundColor: element.color,
                            }}
                          />
                        )}
                        {element.type === 'lottie' && (
                          (() => {
                            const lottieUrl = resolveLottieUrl(element.lottieSource);
                            const lottieData = lottieDataMap[lottieUrl];
                            if (!lottieData) {
                              return (
                                <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', background: '#f5f3ff', color: '#6d28d9', fontSize: 12 }}>
                                  Animated
                                </div>
                              );
                            }
                            return (
                              <Lottie
                                animationData={lottieData}
                                loop={element.loop !== false}
                                autoplay={element.autoPlay !== false}
                                style={{ width: '100%', height: '100%' }}
                              />
                            );
                          })()
                        )}
                      </div>
                    );
                  })}

                  {sectionGuide.show && sectionGuide.centerV ? (
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        left: '50%',
                        width: 1,
                        transform: 'translateX(-0.5px)',
                        backgroundColor: '#0ea5e9',
                        opacity: 0.45,
                        pointerEvents: 'none',
                      }}
                    />
                  ) : null}
                  {sectionGuide.show ? (
                    <div
                      style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        top: Math.max(0, (sectionGuide.topYCanvas / canvasHeight) * previewHeight),
                        height: 1,
                        backgroundColor: '#0ea5e9',
                        opacity: 0.45,
                        pointerEvents: 'none',
                      }}
                    />
                  ) : null}
                  {dragGuide.show && dragGuide.xCanvas !== null ? (
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        left: (dragGuide.xCanvas / canvasWidth) * previewWidth,
                        width: 1,
                        transform: 'translateX(-0.5px)',
                        backgroundColor: '#22c55e',
                        opacity: 0.55,
                        pointerEvents: 'none',
                      }}
                    />
                  ) : null}
                  {dragGuide.show && dragGuide.yCanvas !== null ? (
                    <div
                      style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        top: (dragGuide.yCanvas / canvasHeight) * previewHeight,
                        height: 1,
                        backgroundColor: '#22c55e',
                        opacity: 0.55,
                        pointerEvents: 'none',
                      }}
                    />
                  ) : null}
                </div>
              </div>

              <div className="canvas-controls">
                <Switch checked={showGrid} onChange={setShowGrid} /> Grid
                <span style={{ margin: '0 10px' }} />
                <Switch checked={snapToGrid} onChange={setSnapToGrid} /> Snap
                <div style={{ marginTop: 8, color: isShiftSnapBypass ? '#b45309' : '#64748b' }}>
                  Hold Shift while dragging to temporarily disable snap. Arrow keys move selected item.
                </div>
              </div>
            </div>
          </Card>
        </Col>

        {/* Right Panel - Element Properties */}
        <Col xs={{ span: 24, order: 3 }} xl={{ span: 8, order: 3 }}>
          <Card title="Element Properties" size="small" className="invite-canvas-panel invite-canvas-panel--right">
            {selectedElement ? (
              <Space direction="vertical" style={{ width: '100%' }} size={12}>
                <div>
                  <div style={{ marginBottom: 4, fontWeight: 600 }}>
                    {selectedElement.type.toUpperCase()} Element
                  </div>
                  <Tag color={selectedElement.locked ? 'red' : 'blue'}>
                    {selectedElement.locked ? 'LOCKED' : 'UNLOCKED'}
                  </Tag>
                </div>

                <Divider style={{ margin: '8px 0' }} />

                {/* Position & Size */}
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>Position & Size</div>
                  <Row gutter={8}>
                    <Col span={6}>
                      <label style={{ fontSize: 12 }}>X</label>
                      <InputNumber
                        size="small"
                        value={selectedElement.x}
                        onChange={(val) => handleNumericPositionUpdate(selectedElement.id, 'x', val)}
                        disabled={selectedElement.locked}
                        style={{ width: '100%' }}
                      />
                    </Col>
                    <Col span={6}>
                      <label style={{ fontSize: 12 }}>Y</label>
                      <InputNumber
                        size="small"
                        value={selectedElement.y}
                        onChange={(val) => handleNumericPositionUpdate(selectedElement.id, 'y', val)}
                        disabled={selectedElement.locked}
                        style={{ width: '100%' }}
                      />
                    </Col>
                    <Col span={6}>
                      <label style={{ fontSize: 12 }}>W</label>
                      <InputNumber
                        size="small"
                        value={selectedElement.width}
                        onChange={(val) => handleNumericPositionUpdate(selectedElement.id, 'width', val)}
                        disabled={selectedElement.locked}
                        style={{ width: '100%' }}
                      />
                    </Col>
                    <Col span={6}>
                      <label style={{ fontSize: 12 }}>H</label>
                      <InputNumber
                        size="small"
                        value={selectedElement.height}
                        onChange={(val) => handleNumericPositionUpdate(selectedElement.id, 'height', val)}
                        disabled={selectedElement.locked}
                        style={{ width: '100%' }}
                      />
                    </Col>
                  </Row>
                  <Space wrap size="small" style={{ marginTop: 8 }}>
                    <Button size="small" onClick={() => nudgeSelected(-1, 0)} disabled={selectedElement.locked}>←</Button>
                    <Button size="small" onClick={() => nudgeSelected(1, 0)} disabled={selectedElement.locked}>→</Button>
                    <Button size="small" onClick={() => nudgeSelected(0, -1)} disabled={selectedElement.locked}>↑</Button>
                    <Button size="small" onClick={() => nudgeSelected(0, 1)} disabled={selectedElement.locked}>↓</Button>
                    <label style={{ fontSize: 12, marginLeft: 8 }}>Step</label>
                    <InputNumber
                      size="small"
                      min={1}
                      max={100}
                      value={gridSize}
                      onChange={(val) => setGridSize(Math.max(1, Number(val) || 1))}
                      style={{ width: 80 }}
                    />
                  </Space>
                </div>

                {/* Text-specific properties */}
                {selectedElement.type === 'text' && (
                  <>
                    <Divider style={{ margin: '8px 0' }} />
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: 8 }}>Text Content</div>
                      <Input.TextArea
                        ref={textAreaRef}
                        value={selectedElement.text}
                        onChange={handleTextChange}
                        onKeyDown={handleTextKeyDown}
                        onSelect={(e) => refreshAutocomplete(e.target.value, e.target.selectionStart)}
                        onKeyUp={(e) => refreshAutocomplete(e.target.value, e.target.selectionStart)}
                        rows={3}
                        size="small"
                        disabled={selectedElement.locked}
                      />
                      {placeholderAutocomplete.active ? (
                        <div style={{ marginTop: 8, border: '1px solid #e2e8f0', borderRadius: 8, padding: 8, backgroundColor: '#f8fafc' }}>
                          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                            Suggestions for {`{{${placeholderAutocomplete.query}}}`}
                          </div>
                          <Space wrap>
                            {placeholderAutocomplete.suggestions.map((token) => (
                              <Tag
                                key={token}
                                color={token === placeholderAutocomplete.suggestions[placeholderAutocomplete.activeIndex] ? 'blue' : 'cyan'}
                                style={{ cursor: 'pointer', marginInlineEnd: 0 }}
                                onClick={() => handleAutocompleteSelect(token)}
                              >
                                {token}
                              </Tag>
                            ))}
                          </Space>
                        </div>
                      ) : null}
                      {placeholderTokens.length ? (
                        <div style={{ marginTop: 10 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Placeholders</div>
                          <Space wrap>
                            {placeholderTokens.map((token) => (
                              <Tag
                                key={token}
                                color="blue"
                                style={{ cursor: selectedElement.locked ? 'not-allowed' : 'pointer', marginInlineEnd: 0 }}
                                onClick={() => handleInsertPlaceholder(token)}
                              >
                                {token}
                              </Tag>
                            ))}
                          </Space>
                        </div>
                      ) : null}
                    </div>

                    <div style={{ fontWeight: 600, marginBottom: 8 }}>Typography</div>
                    <Row gutter={8}>
                      <Col span={12}>
                        <label style={{ fontSize: 12 }}>Font Size</label>
                        <InputNumber
                          size="small"
                          value={selectedElement.fontSize}
                          onChange={(val) => handleUpdateElement(selectedElement.id, { fontSize: val })}
                          disabled={selectedElement.locked}
                          style={{ width: '100%' }}
                        />
                      </Col>
                      <Col span={12}>
                        <label style={{ fontSize: 12 }}>Font Family</label>
                        <Select
                          size="small"
                          value={selectedElement.fontFamily}
                          onChange={(val) => handleUpdateElement(selectedElement.id, { fontFamily: val })}
                          disabled={selectedElement.locked}
                          options={[
                            { value: 'Arial', label: 'Arial' },
                            { value: 'Georgia', label: 'Georgia' },
                            { value: 'Courier New', label: 'Courier New' },
                            { value: 'Times New Roman', label: 'Times New Roman' },
                            { value: 'Verdana', label: 'Verdana' },
                          ]}
                        />
                      </Col>
                    </Row>

                    <Row gutter={8} style={{ marginTop: 8 }}>
                      <Col span={12}>
                        <label style={{ fontSize: 12 }}>Weight</label>
                        <Select
                          size="small"
                          value={selectedElement.fontWeight}
                          onChange={(val) => handleUpdateElement(selectedElement.id, { fontWeight: val })}
                          disabled={selectedElement.locked}
                          options={[
                            { value: 'normal', label: 'Normal' },
                            { value: 'bold', label: 'Bold' },
                          ]}
                        />
                      </Col>
                      <Col span={12}>
                        <label style={{ fontSize: 12 }}>Align</label>
                        <Select
                          size="small"
                          value={selectedElement.textAlign}
                          onChange={(val) => handleUpdateElement(selectedElement.id, { textAlign: val })}
                          disabled={selectedElement.locked}
                          options={[
                            { value: 'left', label: 'Left' },
                            { value: 'center', label: 'Center' },
                            { value: 'right', label: 'Right' },
                          ]}
                        />
                      </Col>
                    </Row>

                    <div style={{ marginTop: 8 }}>
                      <label style={{ fontSize: 12 }}>Color</label>
                      <ColorPicker
                        value={selectedElement.color}
                        onChange={(color) =>
                          handleUpdateElement(selectedElement.id, { color: color.toHexString() })
                        }
                        disabled={selectedElement.locked}
                        style={{ marginTop: 4 }}
                      />
                    </div>
                  </>
                )}

                {/* Shape-specific properties */}
                {selectedElement.type === 'shape' && (
                  <>
                    <Divider style={{ margin: '8px 0' }} />
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: 8 }}>Shape Style</div>
                      <Row gutter={8}>
                        <Col span={12}>
                          <label style={{ fontSize: 12 }}>Shape Type</label>
                          <Select
                            size="small"
                            value={selectedElement.shapeType}
                            onChange={(val) => handleUpdateElement(selectedElement.id, { shapeType: val })}
                            disabled={selectedElement.locked}
                            options={[{ value: 'rectangle', label: 'Rectangle' }]}
                          />
                        </Col>
                        <Col span={12}>
                          <label style={{ fontSize: 12 }}>Border Radius</label>
                          <InputNumber
                            size="small"
                            value={selectedElement.borderRadius}
                            onChange={(val) => handleUpdateElement(selectedElement.id, { borderRadius: val })}
                            disabled={selectedElement.locked}
                            style={{ width: '100%' }}
                          />
                        </Col>
                      </Row>

                      <div style={{ marginTop: 8 }}>
                        <label style={{ fontSize: 12 }}>Fill Color</label>
                        <ColorPicker
                          value={selectedElement.fillColor}
                          onChange={(color) =>
                            handleUpdateElement(selectedElement.id, { fillColor: color.toHexString() })
                          }
                          disabled={selectedElement.locked}
                          style={{ marginTop: 4 }}
                        />
                      </div>

                      <div style={{ marginTop: 8 }}>
                        <label style={{ fontSize: 12 }}>Stroke Color</label>
                        <ColorPicker
                          value={selectedElement.strokeColor}
                          onChange={(color) =>
                            handleUpdateElement(selectedElement.id, { strokeColor: color.toHexString() })
                          }
                          disabled={selectedElement.locked}
                          style={{ marginTop: 4 }}
                        />
                      </div>

                      <div style={{ marginTop: 8 }}>
                        <label style={{ fontSize: 12 }}>Stroke Width</label>
                        <InputNumber
                          size="small"
                          value={selectedElement.strokeWidth}
                          onChange={(val) => handleUpdateElement(selectedElement.id, { strokeWidth: val })}
                          disabled={selectedElement.locked}
                          style={{ width: '100%' }}
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Image-specific properties */}
                {selectedElement.type === 'image' && (
                  <>
                    <Divider style={{ margin: '8px 0' }} />
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: 8 }}>Image</div>
                      <label style={{ fontSize: 12 }}>Image URL</label>
                      <Input
                        size="small"
                        value={selectedElement.src}
                        onChange={(e) => handleUpdateElement(selectedElement.id, { src: e.target.value })}
                        placeholder="https://example.com/image.jpg"
                        disabled={selectedElement.locked}
                        style={{ marginTop: 4 }}
                      />
                      <label style={{ fontSize: 12, display: 'block', marginTop: 8 }}>Object Fit</label>
                      <Select
                        size="small"
                        value={selectedElement.objectFit}
                        onChange={(val) => handleUpdateElement(selectedElement.id, { objectFit: val })}
                        disabled={selectedElement.locked}
                        options={[
                          { value: 'cover', label: 'Cover' },
                          { value: 'contain', label: 'Contain' },
                          { value: 'fill', label: 'Fill' },
                        ]}
                      />
                    </div>
                  </>
                )}

                {/* Divider-specific properties */}
                {selectedElement.type === 'divider' && (
                  <>
                    <Divider style={{ margin: '8px 0' }} />
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: 8 }}>Divider Style</div>
                      <Row gutter={8}>
                        <Col span={12}>
                          <label style={{ fontSize: 12 }}>Orientation</label>
                          <Select
                            size="small"
                            value={selectedElement.orientation}
                            onChange={(val) => handleUpdateElement(selectedElement.id, { orientation: val })}
                            disabled={selectedElement.locked}
                            options={[
                              { value: 'horizontal', label: 'Horizontal' },
                              { value: 'vertical', label: 'Vertical' },
                            ]}
                          />
                        </Col>
                        <Col span={12}>
                          <label style={{ fontSize: 12 }}>Thickness</label>
                          <InputNumber
                            size="small"
                            value={selectedElement.thickness}
                            onChange={(val) => handleUpdateElement(selectedElement.id, { thickness: val })}
                            disabled={selectedElement.locked}
                            style={{ width: '100%' }}
                          />
                        </Col>
                      </Row>

                      <div style={{ marginTop: 8 }}>
                        <label style={{ fontSize: 12 }}>Color</label>
                        <ColorPicker
                          value={selectedElement.color}
                          onChange={(color) =>
                            handleUpdateElement(selectedElement.id, { color: color.toHexString() })
                          }
                          disabled={selectedElement.locked}
                          style={{ marginTop: 4 }}
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Lottie-specific properties */}
                {selectedElement.type === 'lottie' && (
                  <>
                    <Divider style={{ margin: '8px 0' }} />
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: 8 }}>Animation</div>
                      <label style={{ fontSize: 12 }}>Lottie JSON URL</label>
                      <Input
                        size="small"
                        value={resolveLottieUrl(selectedElement.lottieSource)}
                        onChange={(e) => handleUpdateElement(selectedElement.id, { lottieSource: e.target.value })}
                        placeholder="https://assets.lottiefiles.com/..."
                        disabled={selectedElement.locked}
                        style={{ marginTop: 4 }}
                      />
                      <Space size="small" style={{ marginTop: 10 }}>
                        <Button
                          size="small"
                          type={selectedElement.loop !== false ? 'primary' : 'default'}
                          onClick={() => handleUpdateElement(selectedElement.id, { loop: !(selectedElement.loop !== false) })}
                          disabled={selectedElement.locked}
                        >
                          {selectedElement.loop !== false ? 'Loop On' : 'Loop Off'}
                        </Button>
                        <Button
                          size="small"
                          type={selectedElement.autoPlay !== false ? 'primary' : 'default'}
                          onClick={() => handleUpdateElement(selectedElement.id, { autoPlay: !(selectedElement.autoPlay !== false) })}
                          disabled={selectedElement.locked}
                        >
                          {selectedElement.autoPlay !== false ? 'Auto Play' : 'Manual'}
                        </Button>
                      </Space>
                    </div>
                  </>
                )}

                <Divider style={{ margin: '8px 0' }} />

                {/* Element Actions */}
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Actions</div>
                <Space wrap>
                  <Button
                    size="small"
                    icon={<CopyOutlined />}
                    onClick={() => handleDuplicateElement(selectedElement.id)}
                    disabled={selectedElement.locked}
                  >
                    Duplicate
                  </Button>
                  <Button
                    size="small"
                    icon={<ArrowUpOutlined />}
                    onClick={() => handleReorder(selectedElement.id, 'up')}
                    disabled={selectedElement.locked}
                  >
                    Bring Up
                  </Button>
                  <Button
                    size="small"
                    icon={<ArrowDownOutlined />}
                    onClick={() => handleReorder(selectedElement.id, 'down')}
                    disabled={selectedElement.locked}
                  >
                    Send Down
                  </Button>
                  <Popconfirm
                    title="Delete Element?"
                    description="This action cannot be undone."
                    onConfirm={() => handleDeleteElement(selectedElement.id)}
                    okText="Delete"
                    okType="danger"
                  >
                    <Button size="small" danger icon={<DeleteOutlined />} disabled={selectedElement.locked}>
                      Delete
                    </Button>
                  </Popconfirm>
                </Space>
              </Space>
            ) : (
              <Empty description="Select an element to edit" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </Card>

          {/* Canvas Settings */}
          <Card title="Canvas Settings" size="small" style={{ marginTop: 16 }}>
            <Space direction="vertical" style={{ width: '100%' }} size={8}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Canvas Size</label>
                <Select
                  value={canvasSize}
                  onChange={(val) => {
                    setCanvasSize(val);
                    updateLayout(elements);
                  }}
                  options={[
                    { value: '1080x1920', label: 'Portrait (1080x1920)' },
                    { value: '1920x1080', label: 'Landscape (1920x1080)' },
                    { value: '1080x1080', label: 'Square (1080x1080)' },
                  ]}
                  style={{ width: '100%', marginTop: 4 }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Background Color</label>
                <ColorPicker
                  value={backgroundColor}
                  onChange={(color) => {
                    setBackgroundColor(color.toHexString());
                    updateLayout(elements);
                  }}
                  style={{ marginTop: 4 }}
                />
              </div>
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default InviteDesignCanvas;
