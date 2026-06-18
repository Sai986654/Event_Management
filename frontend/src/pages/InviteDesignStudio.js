import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import {
  Button,
  Card,
  Col,
  Divider,
  Empty,
  Input,
  Row,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
  message,
  Progress,
  Checkbox,
  Tooltip,
  Grid,
} from 'antd';
import {
  ArrowLeftOutlined,
  CopyOutlined,
  SaveOutlined,
  ReloadOutlined,
  EyeOutlined,
  SendOutlined,
} from '@ant-design/icons';
import { eventService } from '../services/eventService';
import { guestService } from '../services/guestService';
import { inviteDesignService } from '../services/inviteDesignService';
import { getErrorMessage } from '../utils/helpers';
import InviteTemplateGallery from '../components/InviteTemplateGallery';
import InviteDesignCanvas from './InviteDesignCanvas';
import Lottie from 'lottie-react';
import {
  EVENT_TYPE_OPTIONS,
  buildStarterLayout,
  buildDefaultMergeData,
  buildPreviewMergeContext,
  getHostFieldConfig,
  getInvitePlaceholderGroups,
  getQuickTextBlocks,
  getSectionBlocks,
} from '../utils/invitePlaceholders';
import './InviteDesignStudio.css';

const { Text, Paragraph } = Typography;

/* ── Lottie Utilities ───────────────────────────────────────────────── */

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

/* ── Main Component ─────────────────────────────────────────────────── */

const InviteDesignStudio = () => {
  const { eventId } = useParams();
  const location = useLocation();

  // Workflow steps: 'template' | 'editor' | 'preview'
  const [step, setStep] = useState('template');

  const screens = Grid.useBreakpoint();
  const isMobile = !screens.lg;
  const [editorMobileTab, setEditorMobileTab] = useState('details'); // 'details' | 'canvas'
  const [previewMobileTab, setPreviewMobileTab] = useState('preview'); // 'preview' | 'send'

  // Loaded Data
  const [event, setEvent] = useState(null);
  const [guests, setGuests] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [lottieDataMap, setLottieDataMap] = useState({});

  // Active Design State
  const [selectedDesignId, setSelectedDesignId] = useState(null);
  const [selectedDesign, setSelectedDesign] = useState(null);
  const [designName, setDesignName] = useState('');
  const [designStatus, setDesignStatus] = useState('draft');
  const [designLanguage, setDesignLanguage] = useState('en');
  const [canvasLayout, setCanvasLayout] = useState({});
  const [selectedTemplate, setSelectedTemplate] = useState('');

  // UI States
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Preview & Send States
  const [previewGuestId, setPreviewGuestId] = useState(null);
  const [selectedGuests, setSelectedGuests] = useState([]);
  const [sendViaChannel, setSendViaChannel] = useState('both');
  const [isSending, setIsSending] = useState(false);
  const [sentCount, setSentCount] = useState(0);
  const [sendFailures, setSendFailures] = useState([]);
  const [guestSearchQuery, setGuestSearchQuery] = useState('');

  // Scaled preview container
  const previewContainerRef = useRef(null);
  const [previewContainerWidth, setPreviewContainerWidth] = useState(320);

  // Derived Properties
  const selectedTemplateMeta = useMemo(
    () => templates.find((t) => t.key === selectedTemplate) || null,
    [templates, selectedTemplate]
  );
  const inviteEventType = canvasLayout.eventType || event?.type || selectedDesign?.category || 'other';
  const placeholderGroups = useMemo(() => getInvitePlaceholderGroups(inviteEventType), [inviteEventType]);
  const hostFieldConfig = useMemo(() => getHostFieldConfig(inviteEventType), [inviteEventType]);
  const quickTextBlocks = useMemo(() => getQuickTextBlocks(inviteEventType), [inviteEventType]);
  const sectionBlocks = useMemo(() => getSectionBlocks(inviteEventType), [inviteEventType]);
  const previewGuest = useMemo(
    () => guests.find((g) => g.id === previewGuestId) || guests[0] || null,
    [guests, previewGuestId]
  );
  const mergeData = useMemo(
    () => buildDefaultMergeData(inviteEventType, canvasLayout.mergeData),
    [inviteEventType, canvasLayout.mergeData]
  );
  const flatPlaceholderTokens = useMemo(
    () => {
      const base = placeholderGroups.flatMap((group) => group.items.map((item) => item.token));
      const dynamicCustom = Object.keys(mergeData.custom || {}).map((key) => `{{custom.${key}}}`);
      return [...base, ...dynamicCustom];
    },
    [placeholderGroups, mergeData.custom]
  );
  const previewMergeContext = useMemo(
    () => buildPreviewMergeContext({ event, guest: previewGuest, mergeData }),
    [event, previewGuest, mergeData]
  );

  // Load Lottie animation files dynamically in Step 3 Preview
  useEffect(() => {
    if (step !== 'preview' || !canvasLayout?.elements) return;

    const elements = canvasLayout.elements;
    const urls = Array.from(
      new Set(
        elements
          .filter((el) => el.type === 'lottie')
          .map((el) => resolveLottieUrl(el.lottieSource))
          .filter(Boolean)
      )
    );

    const missing = urls.filter((url) => !lottieDataMap[url]);
    if (!missing.length) return;

    Promise.all(
      missing.map(async (requestedUrl) => {
        const candidates = getLottieMirrorUrls(requestedUrl);
        for (const candidateUrl of candidates) {
          try {
            const response = await fetch(candidateUrl);
            if (!response.ok) continue;
            const json = await response.json();
            return [requestedUrl, candidateUrl, json];
          } catch (_err) {}
        }
        return null;
      })
    ).then((results) => {
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
  }, [step, canvasLayout, lottieDataMap]);

  // Handle preview mockup resize calculation
  useEffect(() => {
    if (step !== 'preview') return;
    const updateWidth = () => {
      if (previewContainerRef.current) {
        setPreviewContainerWidth(previewContainerRef.current.offsetWidth);
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, [step]);

  // Load initial studio context
  // Load selected design details
  const loadDesignDetails = useCallback(async (designId, templateCatalog = []) => {
    if (!designId) return;

    try {
      const designRes = await inviteDesignService.getDesign(designId);
      const design = designRes.design;
      const designLayout = design.jsonLayout && typeof design.jsonLayout === 'object' ? design.jsonLayout : {};
      const designEventType = designLayout.eventType || event?.type || design.category || 'other';

      const hasRenderableElements = Array.isArray(designLayout.elements) && designLayout.elements.length > 0;
      const availableTemplates = templateCatalog.length ? templateCatalog : templates;
      const fallbackTemplateKey = designLayout.templateKey || null;
      const matchedTemplate = availableTemplates.find((t) => t.key === fallbackTemplateKey) || null;

      const templateDrivenLayout = (!hasRenderableElements && matchedTemplate)
        ? buildCanvasLayoutFromTemplate({
            templateMeta: matchedTemplate,
            baseLayout: designLayout,
            eventType: designEventType,
          })
        : null;

      const nextLayout = hasRenderableElements
        ? {
            ...designLayout,
            eventType: designEventType,
            mergeData: buildDefaultMergeData(designEventType, designLayout.mergeData),
          }
        : templateDrivenLayout
        ? templateDrivenLayout
        : buildStarterLayout({
            eventType: designEventType,
            event,
            templateKey: fallbackTemplateKey,
            mergeData: designLayout.mergeData,
            canvasSize: designLayout.canvasSize || design.canvasSize || '1080x1920',
            backgroundColor: designLayout.backgroundColor || '#fffaf6',
          });

      setSelectedDesignId(design.id);
      setSelectedDesign(design);
      setDesignName(design.name || '');
      setDesignStatus(design.status || 'draft');
      setDesignLanguage(design.language || 'en');
      setCanvasLayout(nextLayout);
      if (nextLayout.templateKey) {
        setSelectedTemplate(nextLayout.templateKey);
      }
    } catch (error) {
      message.error(getErrorMessage(error));
    }
  }, [event, templates]);

  // Load initial studio context
  const loadStudioData = useCallback(async () => {
    try {
      setLoading(true);
      const [eventRes, guestsRes, templatesRes, designsRes] = await Promise.all([
        eventService.getEventById(eventId),
        guestService.getEventGuests(eventId),
        inviteDesignService.getTemplates(),
        inviteDesignService.listDesigns(eventId),
      ]);

      setEvent(eventRes.event || null);
      setGuests(guestsRes.guests || []);
      setTemplates(templatesRes.templates || []);

      const designsList = designsRes.designs || [];
      const query = new URLSearchParams(location.search);
      const preferredDesignId = Number(query.get('designId'));
      
      const preferredDesign = Number.isInteger(preferredDesignId) && preferredDesignId > 0
        ? designsList.find((d) => d.id === preferredDesignId)
        : null;

      const activeDesign = preferredDesign || designsList[0];

      if (activeDesign) {
        await loadDesignDetails(activeDesign.id, templatesRes.templates || []);
        setStep('editor');
      } else {
        setStep('template');
      }
    } catch (error) {
      message.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [eventId, location.search, loadDesignDetails]);

  useEffect(() => {
    loadStudioData();
  }, [loadStudioData]);

  // Build template parser
  const buildCanvasLayoutFromTemplate = ({ templateMeta, baseLayout = {}, eventType }) => {
    const templateConfig = templateMeta?.templateConfig;
    if (!templateConfig || typeof templateConfig !== 'object') return null;

    const canvasSize = String(baseLayout.canvasSize || '1080x1920');
    const sizeMatch = canvasSize.match(/^(\d+)x(\d+)$/);
    const canvasWidth = Number(sizeMatch?.[1]) || 1080;
    const canvasHeight = Number(sizeMatch?.[2]) || 1920;
    const normalizedEventType = eventType || baseLayout.eventType || 'other';
    const normalizedMerge = buildDefaultMergeData(normalizedEventType, baseLayout.mergeData);

    const pickAssetUrl = (entry) => {
      if (!entry || typeof entry !== 'object') return '';
      return String(entry.url || entry.assetUrl || entry.src || entry.assetPath || entry.publicId || '').trim();
    };

    const normalizeAssets = (value) => {
      if (Array.isArray(value)) return value;
      if (value && typeof value === 'object') return Object.values(value);
      return [];
    };

    const slotMap = {};
    [...normalizeAssets(templateConfig.backgroundAssets), ...normalizeAssets(templateConfig.decorativeAssets)].forEach((asset) => {
      const slot = String(asset?.assetSlot || asset?.slot || asset?.id || asset?.key || '').trim();
      const url = pickAssetUrl(asset);
      if (slot && url) slotMap[slot] = url;
    });

    const backgroundAssetRef = String(templateConfig?.canvas?.backgroundAssetRef || '').trim();
    const backgroundImageUrl =
      slotMap[backgroundAssetRef] ||
      slotMap.backgroundTextureImage ||
      slotMap.backgroundImage ||
      String(templateConfig?.canvas?.backgroundImage || '').trim() ||
      '';

    const sections = Array.isArray(templateConfig?.layout?.sections)
      ? templateConfig.layout.sections
      : Array.isArray(templateConfig?.components)
        ? templateConfig.components
        : [];

    if (!sections.length) return null;

    const cardX = Math.round(canvasWidth * 0.07);
    const cardW = Math.round(canvasWidth * 0.86);
    const pad = Math.round(canvasWidth * 0.03);
    const gap = Math.round(canvasHeight * 0.012);
    let cursorY = Math.round(canvasHeight * 0.08);
    let z = 0;
    const elements = [];

    const nextId = () => `template-${Date.now()}-${z}-${Math.random().toString(36).slice(2, 7)}`;
    const addElement = (element) => {
      elements.push({ ...element, id: nextId(), locked: false, z: z++ });
    };

    const addCard = (height = 120) => {
      const y = cursorY;
      addElement({
        type: 'shape',
        x: cardX,
        y,
        width: cardW,
        height,
        shapeType: 'rectangle',
        fillColor: '#fffdf7',
        strokeColor: '#c9b07d',
        strokeWidth: 2,
        borderRadius: 22,
      });
      cursorY += height + gap;
      return y;
    };

    if (backgroundImageUrl) {
      addElement({
        type: 'image',
        x: 0,
        y: 0,
        width: canvasWidth,
        height: canvasHeight,
        src: backgroundImageUrl,
        objectFit: 'cover',
      });
    }

    sections
      .filter((sec) => sec && sec.visible !== false)
      .sort((a, b) => Number(a?.order || 0) - Number(b?.order || 0))
      .forEach((section) => {
        const type = String(section?.componentType || '').toLowerCase();
        const props = section?.props && typeof section.props === 'object' ? section.props : {};

        if (type === 'guestheader' || type === 'couplehero') {
          const y = addCard(180);
          addElement({
            type: 'text',
            x: cardX + pad,
            y: y + 24,
            width: cardW - pad * 2,
            height: 48,
            text: String(props.title || '{{event.title}}'),
            fontSize: 48,
            fontWeight: 'bold',
            color: '#b45309',
            textAlign: 'center',
            fontFamily: 'Georgia',
          });
          addElement({
            type: 'text',
            x: cardX + pad,
            y: y + 80,
            width: cardW - pad * 2,
            height: 42,
            text: String(props.subtitle || '{{hosts.brideName}} ❤ {{hosts.groomName}}'),
            fontSize: 34,
            fontWeight: 'bold',
            color: '#1f2937',
            textAlign: 'center',
            fontFamily: 'Georgia',
          });
          return;
        }

        if (type === 'personalmessage') {
          const y = addCard(200);
          addElement({
            type: 'text',
            x: cardX + pad,
            y: y + 20,
            width: cardW - pad * 2,
            height: 36,
            text: String(props.salutation || 'Dear {{guest.name}},'),
            fontSize: 30,
            fontWeight: 'bold',
            color: '#1f2937',
            textAlign: 'left',
            fontFamily: 'Arial',
          });
          addElement({
            type: 'text',
            x: cardX + pad,
            y: y + 60,
            width: cardW - pad * 2,
            height: 86,
            text: String(props.message || '{{hosts.blessingLine}}'),
            fontSize: 24,
            fontWeight: 'normal',
            color: '#334155',
            textAlign: 'left',
            fontFamily: 'Arial',
          });
          addElement({
            type: 'text',
            x: cardX + pad,
            y: y + 156,
            width: cardW - pad * 2,
            height: 28,
            text: String(props.signature || '{{event.dateText}} | {{event.timeText}}'),
            fontSize: 20,
            fontWeight: 'bold',
            color: '#475569',
            textAlign: 'left',
            fontFamily: 'Arial',
          });
          return;
        }

        if (type === 'rsvpsection') {
          const y = addCard(90);
          const btnGap = 20;
          const btnW = Math.round((cardW - pad * 2 - btnGap) / 2);
          [
            {
              x: cardX + pad,
              label: String(props.primaryLabel || props.primaryAction || props.actions?.[0]?.label || 'RSVP Now'),
              actionKind: String(props.primaryActionKind || props.actions?.[0]?.kind || 'rsvp'),
              url: String(props.primaryUrl || props.rsvpUrl || props.actions?.[0]?.url || '{{custom.rsvpLink}}'),
            },
            {
              x: cardX + pad + btnW + btnGap,
              label: String(props.secondaryLabel || props.secondaryAction || props.actions?.[1]?.label || 'Join Live Stream'),
              actionKind: String(props.secondaryActionKind || props.actions?.[1]?.kind || 'liveStream'),
              url: String(props.secondaryUrl || props.liveStreamUrl || props.actions?.[1]?.url || '{{custom.liveStreamUrl}}'),
            },
          ].forEach((button) => {
            addElement({
              type: 'action',
              x: button.x,
              y: y + 16,
              width: btnW,
              height: 56,
              label: button.label,
              actionKind: button.actionKind,
              url: button.url,
              fillColor: '#ffffff',
              textColor: '#374151',
              strokeColor: '#c9b07d',
              strokeWidth: 2,
              borderRadius: 28,
              fontSize: 24,
              fontWeight: 'bold',
              fontFamily: 'Arial',
            });
          });
          return;
        }

        if (type === 'smartrecommendations') {
          const y = addCard(120);
          const colW = Math.round(cardW / 3);
          const labels = [
            String(props.segment1Label || 'Program 1'),
            String(props.segment2Label || 'Program 2'),
            String(props.segment3Label || 'Program 3'),
          ];
          labels.forEach((label, index) => {
            const x = cardX + index * colW;
            addElement({
              type: 'text',
              x,
              y: y + 34,
              width: colW,
              height: 24,
              text: label,
              fontSize: 18,
              fontWeight: 'normal',
              color: '#334155',
              textAlign: 'center',
              fontFamily: 'Arial',
            });
          });
          return;
        }

        if (type === 'familyconnection') {
          const y = addCard(96);
          addElement({
            type: 'text',
            x: cardX + pad,
            y: y + 20,
            width: cardW - pad * 2,
            height: 26,
            text: String(props.groomFamilyLabel || "Groom's Family: {{hosts.groomParents}}"),
            fontSize: 22,
            fontWeight: 'bold',
            color: '#1f2937',
            textAlign: 'left',
            fontFamily: 'Arial',
          });
          addElement({
            type: 'text',
            x: cardX + pad,
            y: y + 52,
            width: cardW - pad * 2,
            height: 26,
            text: String(props.brideFamilyLabel || "Bride's Family: {{hosts.brideParents}}"),
            fontSize: 22,
            fontWeight: 'bold',
            color: '#1f2937',
            textAlign: 'left',
            fontFamily: 'Arial',
          });
          return;
        }

        if (type === 'qrpass') {
          const y = addCard(108);
          addElement({
            type: 'action',
            x: cardX + pad,
            y: y + 18,
            width: Math.round((cardW - pad * 2) * 0.58),
            height: 52,
            label: String(props.ctaLabel || 'Get Directions / RSVP'),
            actionKind: String(props.actionKind || 'directions'),
            url: String(props.url || props.mapLink || props.rsvpLink || '{{custom.mapLink}}'),
            fillColor: '#ffffff',
            textColor: '#1f2937',
            strokeColor: '#c9b07d',
            strokeWidth: 2,
            borderRadius: 26,
            fontSize: 24,
            fontWeight: 'bold',
            fontFamily: 'Arial',
          });
          addElement({
            type: 'text',
            x: cardX + pad,
            y: y + 54,
            width: cardW - pad * 2,
            height: 24,
            text: String(props.helpText || '{{event.venue}}'),
            fontSize: 16,
            fontWeight: 'normal',
            color: '#b91c1c',
            textAlign: 'left',
            fontFamily: 'Arial',
          });
        }
      });

    return {
      templateKey: templateMeta?.key || baseLayout.templateKey || null,
      canvasSize,
      backgroundColor: String(baseLayout.backgroundColor || '#fffaf6'),
      title: baseLayout.title || event?.title || '',
      venue: baseLayout.venue || event?.venue || '',
      date: baseLayout.date || event?.date || null,
      eventType: normalizedEventType,
      mergeData: normalizedMerge,
      elements,
    };
  };

  // Start with blank template
  const handleStartBlank = async () => {
    try {
      setCreating(true);
      const draftEventType = event?.type || 'other';
      const blankLayout = buildStarterLayout({
        eventType: draftEventType,
        event,
        templateKey: null,
        mergeData: buildDefaultMergeData(draftEventType),
      });

      const createRes = await inviteDesignService.createDesign({
        eventId: Number(eventId),
        name: 'Blank Design Template',
        language: 'en',
        status: 'draft',
        category: event?.type || 'general',
        jsonLayout: blankLayout,
      });

      const newDesign = createRes?.design;
      if (newDesign?.id) {
        const refreshed = await inviteDesignService.listDesigns(eventId);
        setDesigns(refreshed.designs || []);
        await loadDesignDetails(newDesign.id, templates);
        setStep('editor');
        message.success('Blank design created successfully');
      }
    } catch (error) {
      message.error(getErrorMessage(error));
    } finally {
      setCreating(false);
    }
  };

  // Selection handler from Visual Template gallery
  const handleSelectTemplate = async (template) => {
    try {
      setCreating(true);
      const draftEventType = event?.type || 'other';
      const seedLayout = buildCanvasLayoutFromTemplate({
        templateMeta: template,
        baseLayout: {
          templateKey: template.key,
          eventType: draftEventType,
          mergeData: buildDefaultMergeData(draftEventType),
        },
        eventType: draftEventType,
      }) || buildStarterLayout({
        eventType: draftEventType,
        event,
        templateKey: template.key,
        mergeData: buildDefaultMergeData(draftEventType),
      });

      const createRes = await inviteDesignService.createDesign({
        eventId: Number(eventId),
        name: `${template.name} Design`,
        language: 'en',
        status: 'draft',
        category: event?.type || 'general',
        jsonLayout: {
          ...seedLayout,
          masterTemplateKey: template.key,
        },
      });

      const newDesign = createRes?.design;
      if (newDesign?.id) {
        const refreshed = await inviteDesignService.listDesigns(eventId);
        setDesigns(refreshed.designs || []);
        await loadDesignDetails(newDesign.id, templates);
        setStep('editor');
        message.success(`Design created using ${template.name} template!`);
      }
    } catch (error) {
      message.error(getErrorMessage(error));
    } finally {
      setCreating(false);
    }
  };

  // Save changes
  const handleSaveDesign = async (silent = false) => {
    if (!selectedDesignId) {
      message.warning('No design selected.');
      return false;
    }

    setSaving(true);
    try {
      const finalLayout = {
        ...canvasLayout,
        eventType: inviteEventType,
        mergeData,
      };

      await inviteDesignService.updateDesign(selectedDesignId, {
        name: designName.trim() || selectedDesign?.name,
        language: designLanguage,
        status: designStatus,
        jsonLayout: finalLayout,
      });

      setCanvasLayout(finalLayout);
      if (!silent) message.success('Invitation layout saved successfully');
      return true;
    } catch (error) {
      message.error(getErrorMessage(error));
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Duplicate active design
  const handleDuplicateDesign = async () => {
    if (!selectedDesignId) return;
    try {
      const nameCopy = `${designName} Copy`;
      const res = await inviteDesignService.duplicateDesign(selectedDesignId, { name: nameCopy });
      message.success('Design duplicated successfully');
      const refreshed = await inviteDesignService.listDesigns(eventId);
      setDesigns(refreshed.designs || []);
      if (res.design?.id) {
        await loadDesignDetails(res.design.id, templates);
      }
    } catch (error) {
      message.error(getErrorMessage(error));
    }
  };

  // Reset starter layouts
  const handleResetStarter = () => {
    const nextLayout = buildStarterLayout({
      eventType: inviteEventType,
      event,
      templateKey: selectedTemplate || canvasLayout.templateKey || null,
      mergeData,
      canvasSize: canvasLayout.canvasSize || '1080x1920',
      backgroundColor: canvasLayout.backgroundColor || '#fffaf6',
    });
    setCanvasLayout(nextLayout);
    message.success(`Canvas reset to default ${inviteEventType} starter layout.`);
  };

  // Update specific host merge details
  const patchMergeData = (scope, key, value) => {
    setCanvasLayout((prev) => {
      const current = buildDefaultMergeData(inviteEventType, prev.mergeData);
      return {
        ...prev,
        mergeData: {
          ...current,
          [scope]: {
            ...(current[scope] || {}),
            [key]: value,
          },
        },
      };
    });
  };

  // Send Invites Pipeline (Phase 3 integration)
  const handleSendInvites = async () => {
    if (!selectedGuests.length) {
      message.warning('Please select at least one guest.');
      return;
    }

    setIsSending(true);
    setSentCount(0);
    setSendFailures([]);

    try {
      const res = await inviteDesignService.generateAndSend(selectedDesignId, {
        sendVia: sendViaChannel,
        guestIds: selectedGuests,
      });

      message.success(`Notification batch sent: ${res.generated} successful, ${res.failed} failed.`);
      setSentCount(res.generated || 0);
      setSendFailures(res.failures || []);
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setIsSending(false);
    }
  };

  // Resolve placeholders for mock canvas viewer elements
  const resolveMockPlaceholderText = (text, context) => {
    if (typeof text !== 'string') return text;
    return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, token) => {
      const getValueByStringPath = (obj, strPath) =>
        strPath.split('.').reduce((acc, segment) => (acc && acc[segment] !== undefined ? acc[segment] : undefined), obj);
      
      const resolved = getValueByStringPath(context, token);
      return resolved === undefined || resolved === null ? '' : String(resolved);
    });
  };

  // Helper toggle all checkbox selection
  const handleToggleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedGuests(filteredGuests.map((g) => g.id));
    } else {
      setSelectedGuests([]);
    }
  };

  const handleToggleGuest = (guestId) => {
    setSelectedGuests((prev) =>
      prev.includes(guestId) ? prev.filter((id) => id !== guestId) : [...prev, guestId]
    );
  };

  // Search filter
  const filteredGuests = useMemo(() => {
    return guests.filter((g) =>
      String(g.name || '').toLowerCase().includes(guestSearchQuery.toLowerCase())
    );
  }, [guests, guestSearchQuery]);

  // Loading Screen
  if (loading) {
    return (
      <div className="invite-studio-loading-wrap">
        <Spin size="large" />
        <p>Loading Workspace...</p>
      </div>
    );
  }

  return (
    <div className="invite-studio-workspace">
      
      {/* ── STEP 1: CHOOSE TEMPLATE ────────────────────────────────────── */}
      {step === 'template' && (
        <Card className="studio-card-panel">
          <div style={{ marginBottom: 16 }}>
            <Link to="/invite-studio">
              <Button icon={<ArrowLeftOutlined />}>Exit to Studio Home</Button>
            </Link>
          </div>
          <InviteTemplateGallery
            templates={templates}
            onSelect={handleSelectTemplate}
            onStartBlank={handleStartBlank}
            defaultEventType={event?.type}
          />
        </Card>
      )}

      {/* ── STEP 2: CUSTOMIZE DESIGN ───────────────────────────────────── */}
      {step === 'editor' && (
        <div className="editor-view-container">
          {/* Header Action Bar */}
          <div className="studio-editor-navbar">
            <div className="navbar-left">
              <Button 
                icon={<ArrowLeftOutlined />} 
                onClick={() => setStep('template')}
                className="nav-back-btn"
              >
                Choose Template
              </Button>
              <div className="navbar-meta">
                <Input
                  className="design-name-input"
                  value={designName}
                  onChange={(e) => setDesignName(e.target.value)}
                  placeholder="Invite Design Name"
                />
                <Text className="navbar-subtitle">
                  Event: {event?.title || `Event #${eventId}`}
                </Text>
              </div>
            </div>

            <div className="navbar-right">
              <Space>
                <Select
                  value={designStatus}
                  onChange={setDesignStatus}
                  className="navbar-status-select"
                  options={[
                    { value: 'draft', label: 'Draft' },
                    { value: 'published', label: 'Published' },
                    { value: 'archived', label: 'Archived' },
                  ]}
                />
                <Select
                  value={designLanguage}
                  onChange={setDesignLanguage}
                  className="navbar-lang-select"
                  options={[
                    { value: 'en', label: 'English (EN)' },
                    { value: 'te', label: 'Telugu (TE)' },
                  ]}
                />
                <Tooltip title="Reset template coordinates">
                  <Button icon={<ReloadOutlined />} onClick={handleResetStarter}>Reset</Button>
                </Tooltip>
                <Button icon={<CopyOutlined />} onClick={handleDuplicateDesign}>Duplicate</Button>
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  onClick={() => handleSaveDesign(false)}
                  loading={saving}
                  className="navbar-save-btn"
                >
                  Save
                </Button>
                <Button
                  type="default"
                  icon={<EyeOutlined />}
                  onClick={async () => {
                    const saved = await handleSaveDesign(true);
                    if (saved) setStep('preview');
                  }}
                  className="navbar-next-btn"
                >
                  Preview & Send
                </Button>
              </Space>
            </div>
          </div>

          {/* Mobile responsive Tabs for Customize Design */}
          {isMobile && (
            <div className="mobile-tab-navbar">
              <button 
                className={`mobile-tab-btn ${editorMobileTab === 'details' ? 'active' : ''}`}
                onClick={() => setEditorMobileTab('details')}
              >
                📝 Details & Settings
              </button>
              <button 
                className={`mobile-tab-btn ${editorMobileTab === 'canvas' ? 'active' : ''}`}
                onClick={() => setEditorMobileTab('canvas')}
              >
                🎨 Canvas Editor
              </button>
            </div>
          )}

          {/* 2-Column Editor Workspace */}
          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            {/* Left: Host Placeholders Sidebar */}
            {(!isMobile || editorMobileTab === 'details') && (
              <Col xs={24} lg={6} xl={5}>
                <Card title={`Host Fields (${inviteEventType})`} size="small" className="host-data-sidebar">
                  <Paragraph className="sidebar-description">
                    Update details below to merge text automatically on the canvas preview placeholders.
                  </Paragraph>
                  <Space direction="vertical" style={{ width: '100%' }} size={16}>
                    {hostFieldConfig.map((field) => (
                      <div key={field.key} className="studio-form-group">
                        <label className="studio-form-label">{field.label}</label>
                        <Input
                          className="studio-form-input"
                          value={mergeData.hosts?.[field.key] || ''}
                          onChange={(e) => patchMergeData('hosts', field.key, e.target.value)}
                          placeholder={field.placeholder}
                        />
                      </div>
                    ))}
                    
                    <Divider style={{ margin: '8px 0' }} />
                    
                    <div className="studio-form-group">
                      <label className="studio-form-label">Live Stream Link</label>
                      <Input
                        className="studio-form-input"
                        value={mergeData.custom?.liveStreamUrl || ''}
                        onChange={(e) => patchMergeData('custom', 'liveStreamUrl', e.target.value)}
                        placeholder="https://youtube.com/live/..."
                      />
                    </div>

                    <div className="studio-form-group">
                      <label className="studio-form-label">Event Profile Type</label>
                      <Select
                        style={{ width: '100%' }}
                        value={inviteEventType}
                        onChange={(val) => {
                          setCanvasLayout((prev) => ({
                            ...prev,
                            eventType: val,
                            mergeData: buildDefaultMergeData(val, prev.mergeData),
                          }));
                        }}
                        options={EVENT_TYPE_OPTIONS}
                      />
                    </div>
                  </Space>
                </Card>
              </Col>
            )}

            {/* Right: The Complete Canvas Canvas Panel */}
            {(!isMobile || editorMobileTab === 'canvas') && (
              <Col xs={24} lg={18} xl={19}>
                <InviteDesignCanvas
                  layout={canvasLayout}
                  templateMeta={selectedTemplateMeta}
                  onLayoutChange={setCanvasLayout}
                  placeholderTokens={flatPlaceholderTokens}
                  previewMergeContext={previewMergeContext}
                  quickTextBlocks={quickTextBlocks}
                  sectionBlocks={sectionBlocks}
                  fullPageMode={true}
                />
              </Col>
            )}
          </Row>
        </div>
      )}

      {/* ── STEP 3: PREVIEW & SEND ─────────────────────────────────────── */}
      {step === 'preview' && (
        <div className="preview-view-container">
          <div style={{ marginBottom: 16 }}>
            <Button icon={<ArrowLeftOutlined />} onClick={() => setStep('editor')}>
              Back to Design Editor
            </Button>
          </div>

          {/* Mobile responsive Tabs for Preview & Send */}
          {isMobile && (
            <div className="mobile-tab-navbar" style={{ marginBottom: 16 }}>
              <button 
                className={`mobile-tab-btn ${previewMobileTab === 'preview' ? 'active' : ''}`}
                onClick={() => setPreviewMobileTab('preview')}
              >
                👁️ Preview Invite
              </button>
              <button 
                className={`mobile-tab-btn ${previewMobileTab === 'send' ? 'active' : ''}`}
                onClick={() => setPreviewMobileTab('send')}
              >
                ✉️ Send Dispatch
              </button>
            </div>
          )}

          <Row gutter={[24, 24]}>
            {/* Column 1: Live Guest Mock Phone Frame */}
            {(!isMobile || previewMobileTab === 'preview') && (
              <Col xs={24} lg={10} xl={9}>
              <Card title="Live Guest View Mockup" size="small" className="mock-phone-panel">
                <div style={{ marginBottom: 16 }}>
                  <Text strong style={{ display: 'block', marginBottom: 6 }}>Choose Guest Context to Preview:</Text>
                  <Select
                    style={{ width: '100%' }}
                    value={previewGuest?.id}
                    onChange={setPreviewGuestId}
                    placeholder="Select guest"
                    options={guests.map((g) => ({
                      value: g.id,
                      label: `${g.name} (${g.relationship || 'Guest'})`,
                    }))}
                  />
                </div>

                <div className="phone-mockup-wrapper" ref={previewContainerRef}>
                  <div 
                    className="mock-canvas-container"
                    style={{
                      aspectRatio: '1080/1920',
                      width: '100%',
                      backgroundColor: canvasLayout.backgroundColor || '#fffaf6',
                      position: 'relative',
                      overflow: 'hidden',
                      borderRadius: 16,
                      border: '1px solid rgba(255,255,255,0.1)',
                    }}
                  >
                    {canvasLayout?.elements?.map((el) => {
                      const scaleVal = previewContainerWidth / 1080;
                      const style = {
                        position: 'absolute',
                        left: el.x * scaleVal,
                        top: el.y * scaleVal,
                        width: el.width * scaleVal,
                        height: el.height === 'auto' ? 'auto' : el.height * scaleVal,
                        zIndex: el.z || 1,
                      };

                      return (
                        <div key={el.id} style={style}>
                          {el.type === 'text' && (
                            <span
                              style={{
                                fontSize: el.fontSize * scaleVal,
                                fontWeight: el.fontWeight,
                                color: el.color,
                                fontFamily: el.fontFamily,
                                textAlign: el.textAlign,
                                display: 'block',
                                wordWrap: 'break-word',
                                whiteSpace: 'pre-wrap',
                              }}
                            >
                              {resolveMockPlaceholderText(el.text, previewMergeContext)}
                            </span>
                          )}

                          {el.type === 'image' && (
                            <img
                              src={el.src}
                              alt="preview"
                              style={{ width: '100%', height: '100%', objectFit: el.objectFit || 'cover' }}
                            />
                          )}

                          {el.type === 'shape' && el.shapeType === 'rectangle' && (
                            <div
                              style={{
                                width: '100%',
                                height: '100%',
                                backgroundColor: el.fillColor,
                                border: `${el.strokeWidth * scaleVal}px solid ${el.strokeColor}`,
                                borderRadius: el.borderRadius * scaleVal,
                              }}
                            />
                          )}

                          {el.type === 'divider' && el.orientation === 'horizontal' && (
                            <div
                              style={{
                                width: '100%',
                                height: el.thickness * scaleVal,
                                backgroundColor: el.color,
                              }}
                            />
                          )}

                          {el.type === 'lottie' && (
                            (() => {
                              const lottieUrl = resolveLottieUrl(el.lottieSource);
                              const animationData = lottieDataMap[lottieUrl];
                              if (!animationData) return null;
                              return (
                                <Lottie
                                  animationData={animationData}
                                  loop={el.loop !== false}
                                  autoplay={el.autoPlay !== false}
                                  style={{ width: '100%', height: '100%' }}
                                />
                              );
                            })()
                          )}

                          {el.type === 'action' && (
                            <div
                              style={{
                                width: '100%',
                                height: '100%',
                                border: `${el.strokeWidth || 2}px solid ${el.strokeColor || '#c9b07d'}`,
                                borderRadius: (el.borderRadius || 28) * scaleVal,
                                backgroundColor: el.fillColor || '#ffffff',
                                color: el.textColor || '#374151',
                                fontSize: el.fontSize * scaleVal,
                                fontWeight: el.fontWeight || 'bold',
                                fontFamily: el.fontFamily || 'Arial',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '0 4px',
                                textAlign: 'center',
                              }}
                            >
                              {resolveMockPlaceholderText(el.label || 'Action', previewMergeContext)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {previewGuest?.inviteToken && (
                  <div style={{ marginTop: 16 }}>
                    <Button
                      type="dashed"
                      block
                      icon={<CopyOutlined />}
                      onClick={() => {
                        const url = `${window.location.origin}/invite/${previewGuest.inviteToken}`;
                        navigator.clipboard.writeText(url);
                        message.success('Invite link copied to clipboard!');
                      }}
                    >
                      Copy Digital Invite Link
                    </Button>
                  </div>
                )}
              </Card>
            </Col>
            )}

            {/* Column 2: Guest Checklist & Send Dispatcher */}
            {(!isMobile || previewMobileTab === 'send') && (
              <Col xs={24} lg={14} xl={15}>
              <Card title="Send Digital Invites to Guests" size="small" className="send-pipeline-panel">
                <Row gutter={[16, 16]} align="middle" style={{ marginBottom: 16 }}>
                  <Col span={12}>
                    <Input
                      placeholder="Search guests by name..."
                      value={guestSearchQuery}
                      onChange={(e) => setGuestSearchQuery(e.target.value)}
                    />
                  </Col>
                  <Col span={12} style={{ textAlign: 'right' }}>
                    <Checkbox
                      checked={selectedGuests.length === filteredGuests.length && filteredGuests.length > 0}
                      indeterminate={selectedGuests.length > 0 && selectedGuests.length < filteredGuests.length}
                      onChange={handleToggleSelectAll}
                    >
                      Select All ({filteredGuests.length})
                    </Checkbox>
                  </Col>
                </Row>

                {/* Guest List Checklist */}
                <div className="guest-checklist-scroll">
                  {filteredGuests.length > 0 ? (
                    <Table
                      rowKey="id"
                      size="small"
                      pagination={false}
                      dataSource={filteredGuests}
                      columns={[
                        {
                          title: 'Select',
                          key: 'select',
                          width: 60,
                          render: (_, row) => (
                            <Checkbox
                              checked={selectedGuests.includes(row.id)}
                              onChange={() => handleToggleGuest(row.id)}
                            />
                          ),
                        },
                        {
                          title: 'Guest Name',
                          dataIndex: 'name',
                          key: 'name',
                        },
                        {
                          title: 'Relationship',
                          dataIndex: 'relationship',
                          key: 'relationship',
                          render: (v) => <Tag color="gold">{v || 'Guest'}</Tag>,
                        },
                        {
                          title: 'Delivery Contact',
                          key: 'contact',
                          render: (_, row) => (
                            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
                              {[row.email, row.phone].filter(Boolean).join(' | ') || 'No contact info'}
                            </span>
                          ),
                        },
                      ]}
                    />
                  ) : (
                    <Empty description="No guests match search" />
                  )}
                </div>

                <Divider />

                {/* Dispatch Controls */}
                <div className="dispatch-controls-container">
                  <div className="control-group">
                    <Text strong style={{ display: 'block', marginBottom: 8 }}>Delivery Channel:</Text>
                    <Select
                      style={{ width: 220 }}
                      value={sendViaChannel}
                      onChange={setSendViaChannel}
                      options={[
                        { value: 'both', label: 'WhatsApp + Email (Recommended)' },
                        { value: 'whatsapp', label: 'WhatsApp Only' },
                        { value: 'email', label: 'Email Only' },
                      ]}
                    />
                  </div>

                  <Button
                    type="primary"
                    size="large"
                    icon={<SendOutlined />}
                    onClick={handleSendInvites}
                    loading={isSending}
                    disabled={selectedGuests.length === 0}
                    style={{
                      background: 'linear-gradient(135deg, #d4af37 0%, #b8901c 100%)',
                      borderColor: 'transparent',
                      color: '#000',
                      fontWeight: 700,
                    }}
                  >
                    Send Interactive Invites ({selectedGuests.length})
                  </Button>
                </div>

                {/* Bulk Progress Reporting */}
                {isSending && (
                  <div style={{ marginTop: 24, padding: 16, background: 'rgba(255,255,255,0.03)', borderRadius: 12 }}>
                    <Text style={{ display: 'block', marginBottom: 8 }}>Processing batch delivery...</Text>
                    <Progress percent={Math.round((sentCount / selectedGuests.length) * 100)} status="active" strokeColor="#d4af37" />
                  </div>
                )}

                {sendFailures.length > 0 && (
                  <div style={{ marginTop: 24 }}>
                    <Text type="danger" strong>Delivery Failures ({sendFailures.length}):</Text>
                    <div className="failure-list-scroll">
                      {sendFailures.map((fail, idx) => (
                        <div key={idx} style={{ fontSize: 12, color: '#ff4d4f', padding: '4px 0' }}>
                          • {fail.name}: {fail.error || 'Unknown network error'}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            </Col>
            )}
          </Row>
        </div>
      )}
    </div>
  );
};

export default InviteDesignStudio;
