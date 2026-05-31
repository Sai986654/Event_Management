import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Select, Spin, Tag, Tooltip, Typography, message } from 'antd';
import {
  ArrowLeftOutlined,
  SaveOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined,
} from '@ant-design/icons';
import { eventService } from '../services/eventService';
import { guestService } from '../services/guestService';
import { inviteDesignService } from '../services/inviteDesignService';
import { getErrorMessage } from '../utils/helpers';
import InviteDesignCanvas from './InviteDesignCanvas';
import {
  EVENT_TYPE_OPTIONS,
  buildDefaultMergeData,
  buildPreviewMergeContext,
  getHostFieldConfig,
  getInvitePlaceholderGroups,
  getQuickTextBlocks,
  getSectionBlocks,
} from '../utils/invitePlaceholders';
import './InviteCanvasEditor.css';

const { Text } = Typography;

const InviteCanvasEditor = () => {
  const { eventId, designId } = useParams();
  const navigate = useNavigate();

  const [event, setEvent] = useState(null);
  const [guests, setGuests] = useState([]);
  const [design, setDesign] = useState(null);
  const [canvasLayout, setCanvasLayout] = useState({});
  const [previewGuestId, setPreviewGuestId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);

  const previewGuest = useMemo(
    () => guests.find((g) => g.id === previewGuestId) || guests[0] || null,
    [guests, previewGuestId]
  );

  const inviteEventType = canvasLayout.eventType || event?.type || 'other';
  const mergeData = useMemo(
    () => buildDefaultMergeData(inviteEventType, canvasLayout.mergeData),
    [inviteEventType, canvasLayout.mergeData]
  );

  const placeholderGroups = useMemo(
    () => getInvitePlaceholderGroups(inviteEventType),
    [inviteEventType]
  );

  const flatPlaceholderTokens = useMemo(
    () => placeholderGroups.flatMap((g) => g.items.map((item) => item.token)),
    [placeholderGroups]
  );

  const previewMergeContext = useMemo(
    () => buildPreviewMergeContext({ event, guest: previewGuest, mergeData }),
    [event, previewGuest, mergeData]
  );

  const quickTextBlocks = useMemo(() => getQuickTextBlocks(inviteEventType), [inviteEventType]);
  const sectionBlocks = useMemo(() => getSectionBlocks(inviteEventType), [inviteEventType]);
  const hostFieldConfig = useMemo(() => getHostFieldConfig(inviteEventType), [inviteEventType]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [eventRes, guestsRes, designRes] = await Promise.all([
          eventService.getEventById(eventId),
          guestService.getEventGuests(eventId),
          inviteDesignService.getDesign(designId),
        ]);

        setEvent(eventRes.event || null);
        setGuests(guestsRes.guests || []);

        const d = designRes.design;
        setDesign(d);

        const designLayout = d.jsonLayout && typeof d.jsonLayout === 'object' ? d.jsonLayout : {};
        const designEventType = designLayout.eventType || eventRes.event?.type || d.category || 'other';
        setCanvasLayout({
          ...designLayout,
          eventType: designEventType,
          mergeData: buildDefaultMergeData(designEventType, designLayout.mergeData),
        });
      } catch (err) {
        message.error(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [eventId, designId]);

  const handleSave = useCallback(async () => {
    if (!designId) return;
    setSaving(true);
    try {
      const finalLayout = {
        ...canvasLayout,
        eventType: inviteEventType,
        mergeData,
      };
      await inviteDesignService.updateDesign(designId, {
        name: design?.name,
        status: design?.status || 'draft',
        language: design?.language || 'en',
        jsonLayout: finalLayout,
      });
      message.success('Design saved');
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }, [canvasLayout, design, designId, inviteEventType, mergeData]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleSave]);

  if (loading) {
    return (
      <div className="ice-loader">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className={`ice-shell${fullscreen ? ' ice-shell--fullscreen' : ''}`}>
      {/* Top bar */}
      <div className="ice-topbar">
        <div className="ice-topbar-left">
          <Tooltip title="Back to Studio">
            <Button
              icon={<ArrowLeftOutlined />}
              type="text"
              className="ice-topbar-btn"
              onClick={() => navigate(`/events/${eventId}/invite-studio`)}
            />
          </Tooltip>
          <div className="ice-topbar-title">
            <span className="ice-topbar-name">{design?.name || 'Invite Editor'}</span>
            <Tag color="blue" style={{ marginLeft: 10, fontSize: 11 }}>
              {inviteEventType}
            </Tag>
          </div>
        </div>

        <div className="ice-topbar-center">
          <Text style={{ fontSize: 12, color: '#94a3b8' }}>
            {event?.title || `Event #${eventId}`}
          </Text>
        </div>

        <div className="ice-topbar-right">
          <Text style={{ fontSize: 12, color: '#94a3b8', marginRight: 12 }}>Preview as:</Text>
          <Select
            size="small"
            value={previewGuest?.id}
            onChange={setPreviewGuestId}
            placeholder="Guest"
            style={{ width: 160, marginRight: 12 }}
            options={guests.map((g) => ({ value: g.id, label: g.name }))}
          />
          <Tooltip title={fullscreen ? 'Exit Fullscreen' : 'Fullscreen'}>
            <Button
              icon={fullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
              type="text"
              className="ice-topbar-btn"
              onClick={() => setFullscreen((v) => !v)}
            />
          </Tooltip>
          <Button
            icon={<SaveOutlined />}
            type="primary"
            loading={saving}
            onClick={handleSave}
            className="ice-save-btn"
          >
            Save
          </Button>
        </div>
      </div>

      {/* Full-page canvas area */}
      <div className="ice-body">
        <InviteDesignCanvas
          layout={canvasLayout}
          onLayoutChange={setCanvasLayout}
          placeholderTokens={flatPlaceholderTokens}
          previewMergeContext={previewMergeContext}
          quickTextBlocks={quickTextBlocks}
          sectionBlocks={sectionBlocks}
          fullPageMode
        />
      </div>
    </div>
  );
};

export default InviteCanvasEditor;
