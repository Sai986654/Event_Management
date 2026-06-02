import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Card, Table, Button, Modal, Form, Input, Select, Upload, message, Spin, Row, Col, Statistic, Badge, Typography } from 'antd';
import { PlusOutlined, UploadOutlined } from '@ant-design/icons';
import { guestService } from '../services/guestService';
import { inviteDesignService } from '../services/inviteDesignService';
import { useEventSocket } from '../hooks/useEventSocket';
import { getErrorMessage } from '../utils/helpers';
import './GuestManagement.css';

const GuestManagement = () => {
  const { eventId } = useParams();
  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [inviteTemplates, setInviteTemplates] = useState([]);
  const [loadingDesigns, setLoadingDesigns] = useState(false);
  const [inviteDesigns, setInviteDesigns] = useState([]);
  const [selectedDesignId, setSelectedDesignId] = useState(undefined);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState('royal-maroon');
  const [selectedTone, setSelectedTone] = useState('friendly');
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [selectedGuestIds, setSelectedGuestIds] = useState([]);
  const [generatingGuestId, setGeneratingGuestId] = useState(null);
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [quickAdding, setQuickAdding] = useState(false);
  const [sendingInvites, setSendingInvites] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isQuickAddModalVisible, setIsQuickAddModalVisible] = useState(false);
  const [isSendModalVisible, setIsSendModalVisible] = useState(false);
  const [quickAddText, setQuickAddText] = useState('');
  const [selectedSendChannel, setSelectedSendChannel] = useState('email');
  const [form] = Form.useForm();

  const renderTemplateOption = (template) => {
    const preview = template?.preview || {};
    const hasImagePreview = Boolean(template?.previewImageUrl);
    return (
      <div className="invite-template-option">
        <span
          className="invite-template-thumb"
          style={{
            background: hasImagePreview
              ? `url(${template.previewImageUrl}) center / cover no-repeat`
              : preview.gradient || 'linear-gradient(135deg, #7c2d12 0%, #9a3412 100%)',
            borderColor: preview.frame || '#7c2d12',
          }}
        />
        <span className="invite-template-meta">
          <span className="invite-template-name">{template.name}</span>
          <span className="invite-template-desc">{template.description}</span>
        </span>
      </div>
    );
  };

  const selectedTemplate =
    inviteTemplates.find((template) => template.key === selectedTemplateKey) ||
    inviteTemplates[0] ||
    null;
  const selectedDesign = inviteDesigns.find((design) => design.id === selectedDesignId) || null;

  const selectedGuests = guests.filter((guest) => selectedGuestIds.includes(guest.id));
  const previewGuest = selectedGuests[0] || guests[0] || null;
  const extraSelectedCount = Math.max(0, selectedGuests.length - 1);
  const previewGuestName = previewGuest?.name || 'Guest';
  const previewRelationship = previewGuest?.relationship || 'guest';

  const coerceObject = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : {});
  const resolveTemplateTokens = (value, context) => {
    if (typeof value === 'string') {
      return value.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, token) => {
        const resolved = String(token)
          .split('.')
          .reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), context);
        return resolved === undefined || resolved === null ? '' : String(resolved);
      });
    }
    if (Array.isArray(value)) return value.map((entry) => resolveTemplateTokens(entry, context));
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolveTemplateTokens(v, context)]));
    }
    return value;
  };

  const eventDate = previewGuest?.event?.date ? new Date(previewGuest.event.date) : null;
  const previewContext = {
    guest: {
      name: previewGuestName,
      guestCategory: previewGuest?.guestCategory || 'VIP',
      relationship: previewRelationship,
      invitationMessage: previewGuest?.customInviteMessage || '',
    },
    event: {
      title: previewGuest?.event?.title || selectedTemplate?.name || 'Wedding Celebration',
      brideName: previewGuest?.event?.brideName || 'Bride',
      groomName: previewGuest?.event?.groomName || 'Groom',
      dateText: eventDate ? eventDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '',
      timeText: eventDate ? eventDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '',
      venue: previewGuest?.event?.venue || 'Venue',
      city: previewGuest?.event?.city || '',
      groomFamily: previewGuest?.event?.groomFamily || 'To be announced',
      brideFamily: previewGuest?.event?.brideFamily || 'To be announced',
    },
  };

  const selectedTemplateConfig = coerceObject(selectedTemplate?.templateConfig);
  const selectedTemplateSections = Array.isArray(selectedTemplateConfig?.layout?.sections)
    ? selectedTemplateConfig.layout.sections
    : [];
  const getSectionProps = (componentType) => {
    const section = selectedTemplateSections.find(
      (item) => String(item?.componentType || '').toLowerCase() === String(componentType || '').toLowerCase()
    );
    return resolveTemplateTokens(coerceObject(section?.props), previewContext);
  };

  const sampleCopy = {
    en: {
      formal: 'It would be our honor to have your gracious presence at our wedding celebration.',
      friendly: 'We are super excited to celebrate with you. Please join us and make it unforgettable.',
      emotional: 'From our hearts, we would love to have you with us on our special day.',
    },
    te: {
      formal: 'Mana vivaha vedukaku mee sannidhi maaku gauravam.',
      friendly: 'Mana celebration ni kalisi santhoshanga jarupukundam, tappakunda randi.',
      emotional: 'Mana special rojuna mee aashirvadam maaku chala mukhyam.',
    },
  };

  const headerProps = getSectionProps('GuestHeader');
  const messageProps = getSectionProps('PersonalMessage');
  const previewTitleFromTemplate = headerProps.title || selectedTemplate?.name || 'Template Preview';
  const previewSubtitleFromTemplate = headerProps.subtitle || '';
  const previewBodyFallback = sampleCopy[selectedLanguage]?.[selectedTone] || sampleCopy.en.friendly;
  const previewBody = messageProps.message || previewBodyFallback;
  const previewSalutation = messageProps.salutation || (selectedLanguage === 'te'
    ? `Priyamaina ${previewGuestName} garu`
    : `Dear ${previewGuestName}`);
  const templateEngineLabel = selectedTemplate?.templateEngine || 'classic';
  const templateDebug = selectedTemplate?.debug || {};
  const previewModeLabel = selectedDesign ? 'Invite Studio Design' : `Template Engine: ${templateEngineLabel}`;
  const simpleTemplateModel =
    selectedTemplateSections.length === 0 &&
    (selectedTemplateConfig?.backgroundImage || selectedTemplateConfig?.contentArea || selectedTemplateConfig?.theme);

  const sectionCards = selectedTemplateSections
    .map((section) => {
      const componentType = String(section?.componentType || '').toLowerCase();
      const props = resolveTemplateTokens(coerceObject(section?.props), previewContext);

      if (componentType === 'guestheader') {
        const title = props.title || previewTitleFromTemplate;
        const subtitle = props.subtitle || `${previewContext.event.brideName} & ${previewContext.event.groomName}`;
        const meta = props.badgeText || previewContext.guest.guestCategory;
        return {
          key: section?.id || componentType,
          type: 'header',
          title,
          subtitle,
          meta,
        };
      }

      if (componentType === 'personalmessage') {
        return {
          key: section?.id || componentType,
          type: 'message',
          title: props.salutation || previewSalutation,
          body: props.message || previewBody,
          footer: props.signature || previewContext.event.title,
        };
      }

      if (componentType === 'familyconnection') {
        return {
          key: section?.id || componentType,
          type: 'details',
          title: 'Family Details',
          rows: [
            `Groom's Family: ${previewContext.event.groomFamily}`,
            `Bride's Family: ${previewContext.event.brideFamily}`,
          ],
        };
      }

      if (componentType === 'rsvpsection') {
        return {
          key: section?.id || componentType,
          type: 'actions',
          title: props.title || 'RSVP',
          rows: [props.primaryLabel || 'RSVP Now', props.secondaryLabel || 'Join Live Stream'],
        };
      }

      if (componentType === 'qrpass') {
        return {
          key: section?.id || componentType,
          type: 'details',
          title: props.ctaLabel || 'QR & Directions',
          rows: [props.helpText || 'Scan QR for map and RSVP confirmation'],
        };
      }

      if (componentType === 'couplehero') {
        return {
          key: section?.id || componentType,
          type: 'details',
          title: props.title || 'Wedding Celebration',
          rows: [
            `${previewContext.event.brideName} & ${previewContext.event.groomName}`,
            `${previewContext.event.dateText} • ${previewContext.event.timeText}`,
          ],
        };
      }

      if (componentType === 'smartrecommendations') {
        return {
          key: section?.id || componentType,
          type: 'details',
          title: props.title || 'Event Timeline',
          rows: [
            props.segment1Label || 'Welcome Ritual',
            props.segment2Label || 'Muhurtam',
            props.segment3Label || 'Reception',
          ],
        };
      }

      return null;
    })
    .filter(Boolean);

  const simpleModelCards = [
    {
      key: 'simple-header',
      type: 'header',
      title: previewContext.event.title || previewTitleFromTemplate,
      subtitle: `${previewContext.event.brideName} & ${previewContext.event.groomName}`,
      meta: previewContext.guest.guestCategory,
    },
    {
      key: 'simple-message',
      type: 'message',
      title: previewSalutation,
      body: previewBody,
      footer: `${previewContext.event.dateText} • ${previewContext.event.venue}`,
    },
    {
      key: 'simple-rsvp',
      type: 'actions',
      title: 'RSVP',
      rows: ['RSVP Now', 'Join Live Stream'],
    },
    {
      key: 'simple-family',
      type: 'details',
      title: 'Family Details',
      rows: [
        `Groom's Family: ${previewContext.event.groomFamily}`,
        `Bride's Family: ${previewContext.event.brideFamily}`,
      ],
    },
  ];

  const previewCards = selectedDesign
    ? []
    : (sectionCards.length > 0 ? sectionCards : (simpleTemplateModel ? simpleModelCards : []));

  const templateHealth = selectedDesign
    ? null
    : {
        templateKey: selectedTemplate?.key || 'n/a',
        templateEngine: templateEngineLabel,
        hasTemplateEngineConfig: Boolean(templateDebug.hasTemplateEngineConfig),
        hasBackgroundAsset: Boolean(templateDebug.hasBackgroundAsset),
      };

  // Real-time socket handlers
  const handleGuestRsvp = useCallback((data) => {
    setGuests((prev) =>
      prev.map((g) => (g.id === data.guestId ? { ...g, rsvpStatus: data.rsvpStatus } : g))
    );
    message.info('A guest RSVP was updated in real-time');
  }, []);

  const handleGuestCheckin = useCallback((data) => {
    setGuests((prev) =>
      prev.map((g) =>
        g.id === data.guestId ? { ...g, checkedIn: true, checkedInAt: data.checkedInAt } : g
      )
    );
    message.success(`${data.name} just checked in!`);
  }, []);

  const { connected } = useEventSocket(eventId, {
    onGuestRsvp: handleGuestRsvp,
    onGuestCheckin: handleGuestCheckin,
  });

  useEffect(() => {
    fetchGuests();
    fetchInviteTemplates();
    fetchInviteDesigns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const fetchGuests = async () => {
    try {
      setLoading(true);
      const data = await guestService.getEventGuests(eventId);
      setGuests(data.guests || []);
    } catch (error) {
      message.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const fetchInviteTemplates = async () => {
    try {
      setLoadingTemplates(true);
      const data = await guestService.getInviteTemplates();
      const templates = Array.isArray(data?.templates) ? data.templates : [];
      setInviteTemplates(templates);
      if (templates.length && !templates.some((t) => t.key === selectedTemplateKey)) {
        setSelectedTemplateKey(templates[0].key);
      }
    } catch (error) {
      message.error(getErrorMessage(error));
    } finally {
      setLoadingTemplates(false);
    }
  };

  const fetchInviteDesigns = async () => {
    try {
      setLoadingDesigns(true);
      const data = await inviteDesignService.listDesigns(eventId);
      const designs = Array.isArray(data?.designs) ? data.designs : [];
      setInviteDesigns(designs);
      setSelectedDesignId((prevSelectedId) => {
        if (prevSelectedId && designs.some((design) => design.id === prevSelectedId)) {
          return prevSelectedId;
        }
        const latestPublished = designs.find((design) => String(design.status || '').toLowerCase() === 'published');
        return latestPublished?.id;
      });
    } catch (error) {
      message.error(getErrorMessage(error));
    } finally {
      setLoadingDesigns(false);
    }
  };

  const handleAddGuest = async (values) => {
    try {
      await guestService.addGuests(eventId, values);
      message.success('Guest added successfully');
      form.resetFields();
      setIsModalVisible(false);
      fetchGuests();
    } catch (error) {
      message.error(getErrorMessage(error));
    }
  };

  const handleCheckIn = async (guestId) => {
    try {
      await guestService.checkInGuest(guestId);
      message.success('Guest checked in successfully');
      fetchGuests();
    } catch (error) {
      message.error(getErrorMessage(error));
    }
  };

  const handleQuickAddGuests = async () => {
    const trimmedText = quickAddText.trim();
    if (!trimmedText) {
      message.warning('Paste guest details before importing');
      return;
    }

    try {
      setQuickAdding(true);
      const result = await guestService.quickAddGuests(eventId, trimmedText);
      message.success(`Added ${result.count || 0} guest(s)`);
      setQuickAddText('');
      setIsQuickAddModalVisible(false);
      fetchGuests();
    } catch (error) {
      message.error(getErrorMessage(error));
    } finally {
      setQuickAdding(false);
    }
  };

  const handleDeleteGuest = (guestId) => {
    Modal.confirm({
      title: 'Delete Guest',
      content: 'Are you sure you want to remove this guest?',
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          await guestService.deleteGuest(guestId);
          message.success('Guest removed successfully');
          fetchGuests();
        } catch (error) {
          message.error(getErrorMessage(error));
        }
      },
    });
  };

  const handleBulkImport = (file) => {
    if (!file) return;
    Modal.confirm({
      title: 'Bulk Import Guests',
      content: 'This will import all guests from the CSV file. Continue?',
      okText: 'Import',
      onOk: async () => {
        try {
          await guestService.bulkImportGuests(eventId, file);
          message.success('Guests imported successfully');
          fetchGuests();
        } catch (error) {
          message.error(getErrorMessage(error));
        }
      },
    });
    return false;
  };

  const handleGenerateInvite = async (guest) => {
    try {
      setGeneratingGuestId(guest.id);
      if (selectedDesignId) {
        await inviteDesignService.generateAndSend(selectedDesignId, {
          sendVia: 'none',
          guestIds: [guest.id],
          defaultLanguage: selectedLanguage,
        });
        message.success(`Design PDF generated for ${guest.name}`);
        fetchGuests();
        return;
      }

      const result = await guestService.generatePersonalizedInvite(guest.id, {
        language: selectedLanguage,
        tone: selectedTone,
        templateKey: selectedTemplateKey,
      });
      const rendererUsed = result?.invite?.rendererUsed || 'unknown';
      const appliedTemplateKey = result?.invite?.templateKey || selectedTemplateKey;
      const hasBackgroundAsset = Boolean(result?.invite?.templateDiagnostics?.hasBackgroundAsset);
      message.success(
        `Invite generated for ${guest.name} | renderer: ${rendererUsed} | template: ${appliedTemplateKey} | background: ${hasBackgroundAsset ? 'linked' : 'not linked'}`
      );
      fetchGuests();
    } catch (error) {
      message.error(getErrorMessage(error));
    } finally {
      setGeneratingGuestId(null);
    }
  };

  const handleGenerateBulkInvites = async () => {
    try {
      setBulkGenerating(true);
      if (selectedDesignId) {
        const payload = {
          sendVia: 'none',
          defaultLanguage: selectedLanguage,
        };

        if (selectedGuestIds.length) {
          payload.guestIds = selectedGuestIds;
        }

        const result = await inviteDesignService.generateAndSend(selectedDesignId, payload);
        message.success(`Generated ${result.generated}/${result.total} design PDF invite(s)`);
        fetchGuests();
        return;
      }

      const payload = {
        defaultLanguage: selectedLanguage,
        defaultTone: selectedTone,
        defaultTemplateKey: selectedTemplateKey,
      };

      if (selectedGuestIds.length) {
        payload.guestIds = selectedGuestIds;
      }

      const result = await guestService.generateBulkPersonalizedInvites(eventId, payload);
      const invites = Array.isArray(result?.invites) ? result.invites : [];
      const rendererCounts = invites.reduce((acc, invite) => {
        const key = invite?.rendererUsed || 'unknown';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
      const rendererSummary = Object.entries(rendererCounts)
        .map(([renderer, count]) => `${renderer}:${count}`)
        .join(', ');
      const htmlFallbackCount = invites.filter(
        (invite) => invite?.templateDiagnostics?.htmlRendererAttempted && invite?.templateDiagnostics?.htmlRendererFailed
      ).length;

      message.success(
        `Generated ${result.generated}/${result.total} personalized invites`
        + (rendererSummary ? ` | renderers ${rendererSummary}` : '')
        + (htmlFallbackCount ? ` | html fallback ${htmlFallbackCount}` : '')
      );
      fetchGuests();
    } catch (error) {
      message.error(getErrorMessage(error));
    } finally {
      setBulkGenerating(false);
    }
  };

  const handleGenerateAndSendInvites = async () => {
    try {
      setSendingInvites(true);
      if (selectedDesignId) {
        const payload = {
          sendVia: selectedSendChannel,
          defaultLanguage: selectedLanguage,
        };

        if (selectedGuestIds.length) {
          payload.guestIds = selectedGuestIds;
        }

        const result = await inviteDesignService.generateAndSend(selectedDesignId, payload);
        const failureCount = Array.isArray(result.failures) ? result.failures.length : 0;
        message.success(`Processed ${result.generated || 0} design invite(s)${failureCount ? `, ${failureCount} failed` : ''}`);
        setIsSendModalVisible(false);
        fetchGuests();
        return;
      }

      const payload = {
        sendVia: selectedSendChannel,
        defaultLanguage: selectedLanguage,
        defaultTone: selectedTone,
        defaultTemplateKey: selectedTemplateKey,
      };

      if (selectedGuestIds.length) {
        payload.guestIds = selectedGuestIds;
      }

      const result = await guestService.generateAndSendInvites(eventId, payload);
      const successCount = Array.isArray(result.successes) ? result.successes.length : 0;
      const failureCount = Array.isArray(result.failures) ? result.failures.length : 0;
      message.success(`Processed ${successCount} guest(s)${failureCount ? `, ${failureCount} failed` : ''}`);
      setIsSendModalVisible(false);
      fetchGuests();
    } catch (error) {
      message.error(getErrorMessage(error));
    } finally {
      setSendingInvites(false);
    }
  };

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Email', dataIndex: 'email', key: 'email' },
    { title: 'Phone', dataIndex: 'phone', key: 'phone' },
    {
      title: 'Template',
      dataIndex: 'inviteTemplateKey',
      key: 'inviteTemplateKey',
      render: (templateKey) => {
        if (!templateKey) return 'Not selected';
        return inviteTemplates.find((template) => template.key === templateKey)?.name || templateKey;
      },
    },
    {
      title: 'RSVP Status',
      dataIndex: 'rsvpStatus',
      key: 'rsvpStatus',
      render: (status) => {
        const colors = { accepted: 'green', pending: 'blue', declined: 'red', maybe: 'orange' };
        return <span style={{ color: colors[status] || 'black' }}>{status || 'pending'}</span>;
      },
    },
    {
      title: 'Invite PDF',
      dataIndex: 'personalizedInvitePdfUrl',
      key: 'personalizedInvitePdfUrl',
      render: (url) =>
        url ? (
          <a href={url} target="_blank" rel="noreferrer">
            Open PDF
          </a>
        ) : (
          'Not generated'
        ),
    },
    {
      title: 'Checked In',
      dataIndex: 'checkedIn',
      key: 'checkedIn',
      render: (checked) => (checked ? '✓' : '✗'),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <div className="action-buttons">
          <Button size="small" loading={generatingGuestId === record.id} onClick={() => handleGenerateInvite(record)}>
            Generate Invite
          </Button>
          {!record.checkedIn && (
            <Button size="small" onClick={() => handleCheckIn(record.id)}>
              Check In
            </Button>
          )}
          <Button size="small" danger onClick={() => handleDeleteGuest(record.id)}>
            Remove
          </Button>
        </div>
      ),
    },
  ];

  const rsvpStats = {
    total: guests.length,
    confirmed: guests.filter((g) => g.rsvpStatus === 'accepted').length,
    pending: guests.filter((g) => g.rsvpStatus === 'pending').length,
    declined: guests.filter((g) => g.rsvpStatus === 'declined').length,
  };

  const rowSelection = {
    selectedRowKeys: selectedGuestIds,
    onChange: (selectedRowKeys) => setSelectedGuestIds(selectedRowKeys),
  };

  return (
    <div className="guest-management-container">
      <Spin spinning={loading}>
        <Card className="stats-card">
          <Row gutter={16}>
            <Col xs={12} sm={6}>
              <Statistic title="Total Guests" value={rsvpStats.total} />
            </Col>
            <Col xs={12} sm={6}>
              <Statistic title="Confirmed" value={rsvpStats.confirmed} valueStyle={{ color: '#52c41a' }} />
            </Col>
            <Col xs={12} sm={6}>
              <Statistic title="Pending" value={rsvpStats.pending} valueStyle={{ color: '#faad14' }} />
            </Col>
            <Col xs={12} sm={6}>
              <Statistic title="Declined" value={rsvpStats.declined} valueStyle={{ color: '#f5222d' }} />
            </Col>
          </Row>
        </Card>

        <Card title={
          <span>
            Guest List
            <Badge status={connected ? 'success' : 'default'} text={connected ? 'Live' : ''} style={{ marginLeft: 12, fontSize: 12 }} />
          </span>
        } className="guests-card" style={{ marginTop: '24px' }}>
          <div className="guests-actions">
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalVisible(true)}>
              Add Guest
            </Button>
            <Button onClick={() => setIsQuickAddModalVisible(true)}>
              Quick Add
            </Button>
            <Upload beforeUpload={handleBulkImport} maxCount={1} accept=".csv">
              <Button icon={<UploadOutlined />}>
                Bulk Import (CSV)
              </Button>
            </Upload>
          </div>

          <Card className="invite-generator-card" loading={loadingTemplates || loadingDesigns}>
            <Typography.Title level={5} style={{ marginBottom: 12 }}>
              Personalized Invite Generator
            </Typography.Title>
            <div className="invite-generator-controls">
              <Select
                value={selectedDesignId}
                onChange={setSelectedDesignId}
                allowClear
                placeholder="Use Invite Studio design"
                style={{ minWidth: 240 }}
                options={inviteDesigns.map((design) => ({
                  value: design.id,
                  label: `${design.name} (${design.status})${String(design.status || '').toLowerCase() === 'published' ? ' • live' : ''}`,
                }))}
              />
              <Select
                value={selectedTemplateKey}
                onChange={setSelectedTemplateKey}
                placeholder="Select template"
                style={{ minWidth: 220 }}
                disabled={Boolean(selectedDesignId)}
                options={inviteTemplates.map((template) => ({
                  value: template.key,
                  title: template.name,
                  label: renderTemplateOption(template),
                }))}
                optionLabelProp="title"
              />
              <Select
                value={selectedLanguage}
                onChange={setSelectedLanguage}
                style={{ minWidth: 140 }}
                options={[
                  { value: 'en', label: 'English' },
                  { value: 'te', label: 'Telugu' },
                ]}
              />
              <Select
                value={selectedTone}
                onChange={setSelectedTone}
                style={{ minWidth: 160 }}
                disabled={Boolean(selectedDesignId)}
                options={[
                  { value: 'friendly', label: 'Friendly' },
                  { value: 'formal', label: 'Formal' },
                  { value: 'emotional', label: 'Emotional' },
                ]}
              />
              <Button type="primary" loading={bulkGenerating} onClick={handleGenerateBulkInvites}>
                {selectedGuestIds.length
                  ? `${selectedDesignId ? 'Generate PDFs' : 'Generate'} for Selected (${selectedGuestIds.length})`
                  : selectedDesignId ? 'Generate PDFs for All Guests' : 'Generate for All Guests'}
              </Button>
              <Button onClick={() => setIsSendModalVisible(true)} disabled={!guests.length} loading={sendingInvites}>
                {selectedGuestIds.length
                  ? `Generate & Send (${selectedGuestIds.length})`
                  : 'Generate & Send'}
              </Button>
            </div>

            {selectedDesign ? (
              <div className="invite-design-mode-note">
                Using saved design <strong>{selectedDesign.name}</strong>. Guest PDFs will be rendered from the Invite Studio canvas with placeholders and host data.
              </div>
            ) : null}

            <div className="invite-live-preview-wrap">
              <div
                className="invite-live-preview"
                style={{
                  background: selectedDesign
                    ? 'linear-gradient(135deg, #e0f2fe 0%, #fdf2f8 100%)'
                    :
                    selectedTemplate?.preview?.gradient ||
                    'linear-gradient(135deg, #7c2d12 0%, #9a3412 100%)',
                  backgroundImage: !selectedDesign && selectedTemplate?.previewImageUrl ? `url(${selectedTemplate.previewImageUrl})` : undefined,
                  backgroundSize: !selectedDesign && selectedTemplate?.previewImageUrl ? 'cover' : undefined,
                  backgroundPosition: !selectedDesign && selectedTemplate?.previewImageUrl ? 'center' : undefined,
                  backgroundRepeat: !selectedDesign && selectedTemplate?.previewImageUrl ? 'no-repeat' : undefined,
                  borderColor: selectedDesign ? '#0f766e' : selectedTemplate?.preview?.frame || '#7c2d12',
                }}
              >
                <div className="invite-live-preview-inner">
                  <div className="invite-live-preview-top">Vedika 360</div>
                  <div className="invite-live-preview-title">
                    {selectedDesign?.name || previewTitleFromTemplate}
                  </div>
                  <div className="invite-live-preview-meta">
                    {selectedDesign
                      ? `Invite Studio Design • ${previewRelationship}`
                      : `${previewSubtitleFromTemplate || `${selectedLanguage === 'te' ? 'Telugu' : 'English'} • ${selectedTone}`} • ${previewRelationship}`}
                  </div>
                  {selectedDesign ? (
                    <div className="invite-live-preview-body">
                      This mode renders the saved Invite Studio layout for each guest and fills placeholder tokens like guest name, event date, bride or groom names, and blessing lines.
                    </div>
                  ) : previewCards.length > 0 ? (
                    <div className="invite-live-preview-cards">
                      {previewCards.map((card) => (
                        <div key={card.key} className={`invite-live-preview-card invite-live-preview-card-${card.type}`}>
                          <div className="invite-live-preview-card-title">{card.title}</div>
                          {card.subtitle ? <div className="invite-live-preview-card-subtitle">{card.subtitle}</div> : null}
                          {card.meta ? <div className="invite-live-preview-card-meta">{card.meta}</div> : null}
                          {card.body ? <div className="invite-live-preview-card-body">{card.body}</div> : null}
                          {Array.isArray(card.rows)
                            ? card.rows.map((row, idx) => (
                                <div key={`${card.key}-${idx}`} className="invite-live-preview-card-row">{row}</div>
                              ))
                            : null}
                          {card.footer ? <div className="invite-live-preview-card-footer">{card.footer}</div> : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <>
                      <div className="invite-live-preview-salutation">{previewSalutation}</div>
                      <div className="invite-live-preview-body">{previewBody}</div>
                    </>
                  )}
                  <div className="invite-live-preview-footer">
                    Preview guest: {previewGuestName}
                    {extraSelectedCount > 0 ? ` +${extraSelectedCount} more selected` : ''}
                  </div>
                  <div className="invite-live-preview-footer" style={{ marginTop: 6 }}>
                    {previewModeLabel}
                    {selectedTemplate?.key ? ` | key: ${selectedTemplate.key}` : ''}
                  </div>
                  {templateHealth ? (
                    <div
                      className={
                        templateHealth.hasTemplateEngineConfig && templateHealth.hasBackgroundAsset
                          ? 'invite-live-preview-health-ok'
                          : 'invite-live-preview-health-warn'
                      }
                    >
                      {templateHealth.hasTemplateEngineConfig ? 'config ok' : 'config missing'}
                      {' | '}
                      {templateHealth.hasBackgroundAsset ? 'background linked' : 'background not linked'}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </Card>

          <Table
            dataSource={guests}
            columns={columns}
            pagination={{ pageSize: 20 }}
            rowSelection={rowSelection}
            rowKey="id"
          />
        </Card>

        <Modal
          title="Add Guest"
          visible={isModalVisible}
          onCancel={() => {
            setIsModalVisible(false);
            form.resetFields();
          }}
          footer={null}
        >
          <Form form={form} layout="vertical" onFinish={handleAddGuest}>
            <Form.Item name="name" label="Name" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
              <Input />
            </Form.Item>
            <Form.Item name="phone" label="Phone">
              <Input />
            </Form.Item>
            <Form.Item name="inviteTemplateKey" label="Invite Template">
              <Select
                placeholder="Choose default template for this guest"
                options={inviteTemplates.map((template) => ({
                  value: template.key,
                  title: template.name,
                  label: renderTemplateOption(template),
                }))}
                optionLabelProp="title"
              />
            </Form.Item>
            <Form.Item name="dietaryPreferences" label="Dietary Preferences">
              <Select placeholder="Select dietary preferences" mode="multiple">
                <Select.Option value="vegetarian">Vegetarian</Select.Option>
                <Select.Option value="vegan">Vegan</Select.Option>
                <Select.Option value="glutenfree">Gluten Free</Select.Option>
              </Select>
            </Form.Item>
            <Button type="primary" htmlType="submit" block>
              Add Guest
            </Button>
          </Form>
        </Modal>

        <Modal
          title="Quick Add Guests"
          visible={isQuickAddModalVisible}
          onCancel={() => {
            setIsQuickAddModalVisible(false);
            setQuickAddText('');
          }}
          onOk={handleQuickAddGuests}
          okText={quickAdding ? 'Adding...' : 'Add Guests'}
          okButtonProps={{ loading: quickAdding }}
        >
          <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
            Paste names, emails, and phone numbers. Use one guest per line or a comma-separated list.
          </Typography.Paragraph>
          <Input.TextArea
            rows={8}
            value={quickAddText}
            onChange={(event) => setQuickAddText(event.target.value)}
            placeholder="John Doe john@example.com +91-9999999999"
          />
          <div className="guest-modal-summary">
            {quickAddText
              .split('\n')
              .map((line) => line.trim())
              .filter(Boolean).length} line(s) detected
          </div>
        </Modal>

        <Modal
          title="Generate & Send Invites"
          visible={isSendModalVisible}
          onCancel={() => setIsSendModalVisible(false)}
          onOk={handleGenerateAndSendInvites}
          okText={sendingInvites ? 'Sending...' : 'Generate & Send'}
          okButtonProps={{ loading: sendingInvites, disabled: !guests.length }}
        >
          <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
            Generate personalized invite links and deliver them by email, WhatsApp, or both.
          </Typography.Paragraph>

          <div className="guest-modal-section">
            <Typography.Text strong>Channel</Typography.Text>
            <Select
              value={selectedSendChannel}
              onChange={setSelectedSendChannel}
              style={{ width: '100%', marginTop: 8 }}
              options={[
                { value: 'email', label: 'Email' },
                { value: 'whatsapp', label: 'WhatsApp' },
                { value: 'both', label: 'Email + WhatsApp' },
              ]}
            />
          </div>

          <div className="guest-send-summary-card">
            <div><strong>Template:</strong> {selectedDesign?.name || selectedTemplate?.name || 'Not selected'}</div>
            <div><strong>Language:</strong> {selectedLanguage === 'te' ? 'Telugu' : 'English'}</div>
            <div><strong>Mode:</strong> {selectedDesign ? 'Invite Studio design PDF' : `Classic ${selectedTone} template`}</div>
            <div><strong>Recipients:</strong> {selectedGuestIds.length || guests.length}</div>
          </div>
        </Modal>
      </Spin>
    </div>
  );
};

export default GuestManagement;
