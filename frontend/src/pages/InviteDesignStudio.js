import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
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
  Tabs,
} from 'antd';
import {
  ArrowLeftOutlined,
  CopyOutlined,
  ExportOutlined,
  SaveOutlined,
  SendOutlined,
  PlusOutlined,
  ReloadOutlined,
  CodeOutlined,
  BgColorsOutlined,
} from '@ant-design/icons';
import { eventService } from '../services/eventService';
import { guestService } from '../services/guestService';
import { inviteDesignService } from '../services/inviteDesignService';
import { getErrorMessage, getPaymentRequirement } from '../utils/helpers';
import { paymentService } from '../services/paymentService';
import InviteDesignCanvas from './InviteDesignCanvas';
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

const { Text, Title } = Typography;
const { TextArea } = Input;

const InviteDesignStudio = () => {
  const { eventId } = useParams();

  const [event, setEvent] = useState(null);
  const [guests, setGuests] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [designs, setDesigns] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [selectedDesignId, setSelectedDesignId] = useState(null);
  const [selectedDesign, setSelectedDesign] = useState(null);
  const [exportsList, setExportsList] = useState([]);

  const [newDesignName, setNewDesignName] = useState('');
  const [designName, setDesignName] = useState('');
  const [designStatus, setDesignStatus] = useState('draft');
  const [designLanguage, setDesignLanguage] = useState('en');
  const [layoutText, setLayoutText] = useState('{}');
  const [canvasLayout, setCanvasLayout] = useState({});
  const [editorMode, setEditorMode] = useState('canvas'); // 'canvas' or 'json'

  const [sendVia, setSendVia] = useState('email');
  const [previewGuestId, setPreviewGuestId] = useState(null);
  const [customKey, setCustomKey] = useState('');
  const [customValue, setCustomValue] = useState('');

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [sending, setSending] = useState(false);

  const selectedTemplateMeta = useMemo(
    () => templates.find((template) => template.key === selectedTemplate) || null,
    [templates, selectedTemplate]
  );
  const inviteEventType = canvasLayout.eventType || event?.type || selectedDesign?.category || 'other';
  const placeholderGroups = useMemo(() => getInvitePlaceholderGroups(inviteEventType), [inviteEventType]);
  const hostFieldConfig = useMemo(() => getHostFieldConfig(inviteEventType), [inviteEventType]);
  const quickTextBlocks = useMemo(() => getQuickTextBlocks(inviteEventType), [inviteEventType]);
  const sectionBlocks = useMemo(() => getSectionBlocks(inviteEventType), [inviteEventType]);
  const previewGuest = useMemo(
    () => guests.find((guest) => guest.id === previewGuestId) || guests[0] || null,
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

  const patchMergeData = useMemo(
    () => (scope, key, value) => {
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
    },
    [inviteEventType]
  );

  const setEventProfile = (nextType) => {
    setCanvasLayout((prev) => ({
      ...prev,
      eventType: nextType,
      mergeData: buildDefaultMergeData(nextType, prev.mergeData),
    }));
  };

  const addOrUpdateCustomField = () => {
    const key = customKey.trim().replace(/\s+/g, '_');
    if (!key) {
      message.warning('Enter a custom key');
      return;
    }
    patchMergeData('custom', key, customValue);
    setCustomKey('');
    setCustomValue('');
  };

  const removeCustomField = (key) => {
    setCanvasLayout((prev) => {
      const current = buildDefaultMergeData(inviteEventType, prev.mergeData);
      const nextCustom = { ...(current.custom || {}) };
      delete nextCustom[key];
      return {
        ...prev,
        mergeData: {
          ...current,
          custom: nextCustom,
        },
      };
    });
  };

  const handleCopyPlaceholder = async (token) => {
    try {
      await navigator.clipboard.writeText(token);
      message.success(`${token} copied`);
    } catch (_error) {
      message.info(token);
    }
  };

  const handleApplyStarterLayout = () => {
    if (!selectedDesignId) {
      message.warning('Select a design first.');
      return;
    }

    const nextLayout = buildStarterLayout({
      eventType: inviteEventType,
      event,
      templateKey: selectedTemplate || canvasLayout.templateKey || null,
      mergeData,
      canvasSize: canvasLayout.canvasSize || '1080x1920',
      backgroundColor: canvasLayout.backgroundColor || '#fffaf6',
    });

    setCanvasLayout(nextLayout);
    setLayoutText(JSON.stringify(nextLayout, null, 2));
    setEditorMode('canvas');
    message.success(`Starter ${inviteEventType} layout applied`);
  };

  const loadStudioData = async () => {
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
      setDesigns(designsRes.designs || []);

      const firstTemplate = (templatesRes.templates || [])[0];
      if (firstTemplate) setSelectedTemplate(firstTemplate.key);

      const firstDesign = (designsRes.designs || [])[0];
      if (firstDesign) {
        await loadDesignDetails(firstDesign.id);
      }
    } catch (error) {
      message.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const loadDesignDetails = async (designId) => {
    if (!designId) {
      setSelectedDesignId(null);
      setSelectedDesign(null);
      setExportsList([]);
      setCanvasLayout({});
      return;
    }

    try {
      const [designRes, exportRes] = await Promise.all([
        inviteDesignService.getDesign(designId),
        inviteDesignService.listExports(designId),
      ]);

      const design = designRes.design;
      const nextLayout = {
        ...(design.jsonLayout || {}),
        eventType: event?.type || design.category || 'other',
        mergeData: buildDefaultMergeData(event?.type || design.category || 'other', design.jsonLayout?.mergeData),
      };
      setSelectedDesignId(design.id);
      setSelectedDesign(design);
      setDesignName(design.name || '');
      setDesignStatus(design.status || 'draft');
      setDesignLanguage(design.language || 'en');
      setLayoutText(JSON.stringify(nextLayout, null, 2));
      setCanvasLayout(nextLayout);
      setExportsList(exportRes.exports || []);
    } catch (error) {
      message.error(getErrorMessage(error));
    }
  };

  useEffect(() => {
    loadStudioData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  useEffect(() => {
    if (!previewGuestId && guests.length) {
      setPreviewGuestId(guests[0].id);
    }
  }, [guests, previewGuestId]);

  const handleCreateDesign = async () => {
    const trimmedName = newDesignName.trim();
    if (!trimmedName) {
      message.warning('Enter a design name.');
      return;
    }

    setCreating(true);
    try {
      const payload = {
        eventId: Number(eventId),
        name: trimmedName,
        language: 'en',
        status: 'draft',
        category: event?.type || 'general',
        jsonLayout: {
          templateKey: selectedTemplate || null,
          title: event?.title || '',
          venue: event?.venue || '',
          date: event?.date || null,
          eventType: event?.type || 'other',
          mergeData: buildDefaultMergeData(event?.type || 'other'),
          notes: 'Edit this layout JSON to match your final invitation design.',
        },
      };

      const res = await inviteDesignService.createDesign(payload);
      message.success('Design created');
      setNewDesignName('');

      const listRes = await inviteDesignService.listDesigns(eventId);
      setDesigns(listRes.designs || []);
      await loadDesignDetails(res.design.id);
    } catch (error) {
      message.error(getErrorMessage(error));
    } finally {
      setCreating(false);
    }
  };

  const handleSaveDesign = async () => {
    if (!selectedDesignId) {
      message.warning('Select a design first.');
      return;
    }

    let finalLayout;
    
    if (editorMode === 'canvas') {
      // Use canvas layout
      finalLayout = {
        ...canvasLayout,
        eventType: inviteEventType,
        mergeData,
      };
      setLayoutText(JSON.stringify(finalLayout, null, 2));
    } else {
      // Use JSON editor
      try {
        finalLayout = JSON.parse(layoutText || '{}');
      } catch (_error) {
        message.error('Layout JSON is invalid.');
        return;
      }
      finalLayout = {
        ...finalLayout,
        eventType: inviteEventType,
        mergeData: buildDefaultMergeData(inviteEventType, finalLayout.mergeData),
      };
      setCanvasLayout(finalLayout);
    }

    setSaving(true);
    try {
      await inviteDesignService.updateDesign(selectedDesignId, {
        name: designName.trim() || selectedDesign?.name,
        status: designStatus,
        language: designLanguage,
        jsonLayout: finalLayout,
      });
      message.success('Design saved');

      const listRes = await inviteDesignService.listDesigns(eventId);
      setDesigns(listRes.designs || []);
      await loadDesignDetails(selectedDesignId);
    } catch (error) {
      message.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicate = async () => {
    if (!selectedDesignId) {
      message.warning('Select a design first.');
      return;
    }

    setDuplicating(true);
    try {
      const res = await inviteDesignService.duplicateDesign(selectedDesignId, {
        name: `${designName || selectedDesign?.name || 'Invite'} Copy`,
      });
      message.success('Design duplicated');

      const listRes = await inviteDesignService.listDesigns(eventId);
      setDesigns(listRes.designs || []);
      await loadDesignDetails(res.design.id);
    } catch (error) {
      message.error(getErrorMessage(error));
    } finally {
      setDuplicating(false);
    }
  };

  const handleExportPdf = async (hasRetriedAfterPayment = false) => {
    if (!selectedDesignId) {
      message.warning('Select a design first.');
      return;
    }

    setExportingPdf(true);
    try {
      await inviteDesignService.exportDesign(selectedDesignId, { format: 'pdf' });
      message.success('PDF export generated');
      const exportRes = await inviteDesignService.listExports(selectedDesignId);
      setExportsList(exportRes.exports || []);
    } catch (error) {
      const paymentRequirement = getPaymentRequirement(error);
      if (paymentRequirement && !hasRetriedAfterPayment) {
        try {
          await paymentService.checkoutForEntity({
            entityType: paymentRequirement.entityType,
            entityId: paymentRequirement.entityId,
            amount: paymentRequirement.config?.amount,
            description: `Invite design #${paymentRequirement.entityId} export`,
          });
          await handleExportPdf(true);
          return;
        } catch (paymentError) {
          message.error(getErrorMessage(paymentError));
          return;
        }
      }
      message.error(getErrorMessage(error));
    } finally {
      setExportingPdf(false);
    }
  };

  const handleGenerateAndSend = async () => {
    if (!selectedDesignId) {
      message.warning('Select a design first.');
      return;
    }

    setSending(true);
    try {
      const res = await inviteDesignService.generateAndSend(selectedDesignId, {
        sendVia,
        defaultLanguage: designLanguage,
        defaultTemplateKey: selectedTemplate || undefined,
      });
      message.success(`Generated ${res.generated || 0} invites and sent ${res.sent || 0}`);
      await loadDesignDetails(selectedDesignId);
    } catch (error) {
      message.error(getErrorMessage(error));
    } finally {
      setSending(false);
    }
  };

  const designColumns = [
    {
      title: 'Design',
      dataIndex: 'name',
      key: 'name',
      render: (value, row) => (
        <Button type="link" onClick={() => loadDesignDetails(row.id)} style={{ padding: 0 }}>
          {value}
        </Button>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => <Tag color={status === 'published' ? 'green' : status === 'archived' ? 'default' : 'blue'}>{status}</Tag>,
    },
    {
      title: 'Version',
      dataIndex: 'version',
      key: 'version',
    },
    {
      title: 'Assets',
      key: 'assets',
      render: (_, row) => row._count?.assets ?? 0,
    },
    {
      title: 'Exports',
      key: 'exports',
      render: (_, row) => row._count?.exports ?? 0,
    },
  ];

  if (loading) {
    return (
      <div className="invite-studio-loading">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="invite-studio-page">
      <Card className="invite-studio-header">
        <Space direction="vertical" size={4}>
          <Space>
            <Link to={`/events/${eventId}`}>
              <Button icon={<ArrowLeftOutlined />}>Back to Event</Button>
            </Link>
            <Button icon={<ReloadOutlined />} onClick={loadStudioData}>Refresh</Button>
          </Space>
          <Title level={3} style={{ margin: 0 }}>Invite Design Studio</Title>
          <Text type="secondary">
            Event: {event?.title || `Event #${eventId}`} | Guests: {guests.length}
          </Text>
        </Space>
      </Card>

      <Row gutter={[18, 18]}>
        <Col xs={24} lg={8} xl={7}>
          <Card title="Template + New Design" className="invite-studio-card invite-studio-card--setup">
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Text strong>Template</Text>
                <Select
                  value={selectedTemplate || undefined}
                  onChange={setSelectedTemplate}
                  style={{ width: '100%', marginTop: 8 }}
                  options={templates.map((template) => ({
                    value: template.key,
                    label: `${template.name} (${template.key})`,
                  }))}
                />
                {selectedTemplateMeta ? (
                  <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                    {selectedTemplateMeta.description || 'No description'}
                  </Text>
                ) : null}
              </div>

              <Input
                value={newDesignName}
                onChange={(eventInput) => setNewDesignName(eventInput.target.value)}
                placeholder="Example: Wedding Main Invite v1"
              />
              <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateDesign} loading={creating}>
                Create Design
              </Button>
            </Space>
          </Card>

          <Card title={`Designs (${designs.length})`} style={{ marginTop: 16 }} className="invite-studio-card invite-studio-card--designs">
            {designs.length ? (
              <Table
                rowKey="id"
                dataSource={designs}
                columns={designColumns}
                pagination={false}
                size="small"
              />
            ) : (
              <Empty description="No invite designs yet" />
            )}
          </Card>
        </Col>

        <Col xs={24} lg={16} xl={17}>
          <Card
            title={selectedDesign ? `Edit: ${selectedDesign.name}` : 'Design Editor'}
            extra={selectedDesign ? <Tag>Design ID: {selectedDesign.id}</Tag> : null}
            className="invite-studio-card invite-studio-card--editor"
          >
            {selectedDesign ? (
              <Space direction="vertical" style={{ width: '100%' }} size={12}>
                <Row gutter={12}>
                  <Col xs={24} sm={12} lg={10}>
                    <Text strong>Name</Text>
                    <Input value={designName} onChange={(e) => setDesignName(e.target.value)} style={{ marginTop: 6 }} />
                  </Col>
                  <Col xs={24} sm={6} lg={7}>
                    <Text strong>Status</Text>
                    <Select
                      value={designStatus}
                      onChange={setDesignStatus}
                      style={{ width: '100%', marginTop: 6 }}
                      options={[
                        { value: 'draft', label: 'draft' },
                        { value: 'published', label: 'published' },
                        { value: 'archived', label: 'archived' },
                      ]}
                    />
                  </Col>
                  <Col xs={24} sm={6} lg={7}>
                    <Text strong>Language</Text>
                    <Select
                      value={designLanguage}
                      onChange={setDesignLanguage}
                      style={{ width: '100%', marginTop: 6 }}
                      options={[
                        { value: 'en', label: 'English' },
                        { value: 'te', label: 'Telugu' },
                      ]}
                    />
                  </Col>
                </Row>

                <Row gutter={12}>
                  <Col xs={24} md={12} lg={8}>
                    <Text strong>Event Profile</Text>
                    <Select
                      value={inviteEventType}
                      onChange={setEventProfile}
                      style={{ width: '100%', marginTop: 6 }}
                      options={EVENT_TYPE_OPTIONS}
                    />
                  </Col>
                  <Col xs={24} md={12} lg={8}>
                    <Text strong>Preview Guest</Text>
                    <Select
                      value={previewGuest?.id}
                      onChange={setPreviewGuestId}
                      style={{ width: '100%', marginTop: 6 }}
                      options={guests.map((guest) => ({ value: guest.id, label: `${guest.name}${guest.relationship ? ` (${guest.relationship})` : ''}` }))}
                      placeholder="Select preview guest"
                    />
                  </Col>
                  <Col xs={24} md={24} lg={8}>
                    <Text strong>Quick Compose</Text>
                    <Button
                      type="default"
                      onClick={handleApplyStarterLayout}
                      style={{ width: '100%', marginTop: 6 }}
                    >
                      Apply Full Starter Layout
                    </Button>
                  </Col>
                </Row>

                <Tabs
                  value={editorMode}
                  onChange={setEditorMode}
                  items={[
                    {
                      key: 'canvas',
                      label: (
                        <span>
                          <BgColorsOutlined /> Canvas Editor
                        </span>
                      ),
                      children: (
                        <div style={{ paddingTop: 16 }}>
                          <InviteDesignCanvas
                            layout={canvasLayout}
                            templateMeta={selectedTemplateMeta}
                            onLayoutChange={setCanvasLayout}
                            placeholderTokens={flatPlaceholderTokens}
                            previewMergeContext={previewMergeContext}
                            quickTextBlocks={quickTextBlocks}
                            sectionBlocks={sectionBlocks}
                          />
                        </div>
                      ),
                    },
                    {
                      key: 'json',
                      label: (
                        <span>
                          <CodeOutlined /> JSON Editor
                        </span>
                      ),
                      children: (
                        <div style={{ paddingTop: 16 }}>
                          <Text type="secondary">
                            Edit the raw JSON layout. Changes here will be synced to the canvas editor.
                          </Text>
                          <TextArea
                            value={layoutText}
                            onChange={(e) => setLayoutText(e.target.value)}
                            rows={20}
                            className="invite-studio-json"
                            style={{ marginTop: 8 }}
                          />
                        </div>
                      ),
                    },
                  ]}
                />

                <Row gutter={[12, 12]}>
                  <Col xs={24} xl={12}>
                    <Card size="small" title={`Host Data · ${inviteEventType}`}>
                      <Space direction="vertical" style={{ width: '100%' }} size={8}>
                        {hostFieldConfig.map((field) => (
                          <div key={field.key}>
                            <Text strong>{field.label}</Text>
                            <Input
                              value={mergeData.hosts[field.key] || ''}
                              onChange={(eventInput) => patchMergeData('hosts', field.key, eventInput.target.value)}
                              placeholder={field.placeholder}
                              style={{ marginTop: 6 }}
                            />
                          </div>
                        ))}
                      </Space>
                    </Card>
                  </Col>
                  <Col xs={24} xl={12}>
                    <Card size="small" title="Placeholder Catalog">
                      <Text type="secondary">
                        Click a token to copy it, then paste it into any text element. The canvas preview resolves these using sample guest data.
                      </Text>
                      <div className="invite-studio-placeholder-groups">
                        {placeholderGroups.map((group) => (
                          <div key={group.label} className="invite-studio-placeholder-group">
                            <Text strong>{group.label}</Text>
                            <Space wrap style={{ marginTop: 8 }}>
                              {group.items.map((item) => (
                                <Tag
                                  key={item.token}
                                  color="purple"
                                  className="invite-studio-placeholder-tag"
                                  onClick={() => handleCopyPlaceholder(item.token)}
                                >
                                  {item.label}: {item.token}
                                </Tag>
                              ))}
                            </Space>
                          </div>
                        ))}
                        <div className="invite-studio-placeholder-group">
                          <Text strong>Custom Fields</Text>
                          <Row gutter={8} style={{ marginTop: 6 }}>
                            <Col span={10}>
                              <Input
                                placeholder="key (e.g. dressCode)"
                                value={customKey}
                                onChange={(eventInput) => setCustomKey(eventInput.target.value)}
                              />
                            </Col>
                            <Col span={10}>
                              <Input
                                placeholder="value"
                                value={customValue}
                                onChange={(eventInput) => setCustomValue(eventInput.target.value)}
                              />
                            </Col>
                            <Col span={4}>
                              <Button type="primary" onClick={addOrUpdateCustomField} style={{ width: '100%' }}>
                                Add
                              </Button>
                            </Col>
                          </Row>
                          {Object.keys(mergeData.custom || {}).length ? (
                            <Space wrap style={{ marginTop: 8 }}>
                              {Object.entries(mergeData.custom || {}).map(([key, value]) => (
                                <Tag
                                  key={key}
                                  color="geekblue"
                                  className="invite-studio-placeholder-tag"
                                  onClick={() => handleCopyPlaceholder(`{{custom.${key}}}`)}
                                >
                                  {`{{custom.${key}}}`} = {String(value || '')}
                                  <Button
                                    type="link"
                                    size="small"
                                    onClick={(eventInput) => {
                                      eventInput.stopPropagation();
                                      removeCustomField(key);
                                    }}
                                  >
                                    x
                                  </Button>
                                </Tag>
                              ))}
                            </Space>
                          ) : (
                            <Text type="secondary" style={{ marginTop: 8, display: 'block' }}>
                              No custom fields yet.
                            </Text>
                          )}
                        </div>
                      </div>
                    </Card>
                  </Col>
                </Row>

                <Space wrap size={[10, 10]}>
                  <Button icon={<SaveOutlined />} type="primary" onClick={handleSaveDesign} loading={saving}>
                    Save Design
                  </Button>
                  <Button icon={<CopyOutlined />} onClick={handleDuplicate} loading={duplicating}>
                    Duplicate
                  </Button>
                  <Button icon={<ExportOutlined />} onClick={handleExportPdf} loading={exportingPdf}>
                    Export PDF
                  </Button>
                </Space>

                <Divider />

                <Space align="center" wrap size={[10, 10]}>
                  <Text strong>Send via</Text>
                  <Select
                    value={sendVia}
                    onChange={setSendVia}
                    style={{ width: 160 }}
                    options={[
                      { value: 'email', label: 'Email' },
                      { value: 'whatsapp', label: 'WhatsApp' },
                      { value: 'both', label: 'Both' },
                    ]}
                  />
                  <Button icon={<SendOutlined />} type="primary" onClick={handleGenerateAndSend} loading={sending}>
                    Generate + Send Invites
                  </Button>
                </Space>

                <Divider />

                <div>
                  <Text strong>Exports</Text>
                  {exportsList.length ? (
                    <ul className="invite-studio-export-list">
                      {exportsList.map((item) => (
                        <li key={item.id}>
                          <Tag>{item.format.toUpperCase()}</Tag>
                          <a href={item.fileUrl} target="_blank" rel="noreferrer">{item.fileUrl}</a>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <Empty description="No exports yet" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                  )}
                </div>
              </Space>
            ) : (
              <Empty description="Select or create a design to start editing" />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default InviteDesignStudio;
