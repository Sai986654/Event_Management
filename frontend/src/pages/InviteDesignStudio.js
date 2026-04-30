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
} from 'antd';
import {
  ArrowLeftOutlined,
  CopyOutlined,
  ExportOutlined,
  SaveOutlined,
  SendOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { eventService } from '../services/eventService';
import { guestService } from '../services/guestService';
import { inviteDesignService } from '../services/inviteDesignService';
import { getErrorMessage, getPaymentRequirement } from '../utils/helpers';
import { paymentService } from '../services/paymentService';
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

  const [sendVia, setSendVia] = useState('email');

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
      return;
    }

    try {
      const [designRes, exportRes] = await Promise.all([
        inviteDesignService.getDesign(designId),
        inviteDesignService.listExports(designId),
      ]);

      const design = designRes.design;
      setSelectedDesignId(design.id);
      setSelectedDesign(design);
      setDesignName(design.name || '');
      setDesignStatus(design.status || 'draft');
      setDesignLanguage(design.language || 'en');
      setLayoutText(JSON.stringify(design.jsonLayout || {}, null, 2));
      setExportsList(exportRes.exports || []);
    } catch (error) {
      message.error(getErrorMessage(error));
    }
  };

  useEffect(() => {
    loadStudioData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

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

    let parsedLayout;
    try {
      parsedLayout = JSON.parse(layoutText || '{}');
    } catch (_error) {
      message.error('Layout JSON is invalid.');
      return;
    }

    setSaving(true);
    try {
      await inviteDesignService.updateDesign(selectedDesignId, {
        name: designName.trim() || selectedDesign?.name,
        status: designStatus,
        language: designLanguage,
        jsonLayout: parsedLayout,
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

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={9}>
          <Card title="Template + New Design">
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

          <Card title={`Designs (${designs.length})`} style={{ marginTop: 16 }}>
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

        <Col xs={24} lg={15}>
          <Card
            title={selectedDesign ? `Edit: ${selectedDesign.name}` : 'Design Editor'}
            extra={selectedDesign ? <Tag>Design ID: {selectedDesign.id}</Tag> : null}
          >
            {selectedDesign ? (
              <Space direction="vertical" style={{ width: '100%' }} size={12}>
                <Row gutter={12}>
                  <Col span={10}>
                    <Text strong>Name</Text>
                    <Input value={designName} onChange={(e) => setDesignName(e.target.value)} style={{ marginTop: 6 }} />
                  </Col>
                  <Col span={7}>
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
                  <Col span={7}>
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

                <div>
                  <Text strong>Layout JSON</Text>
                  <Text type="secondary" style={{ marginLeft: 8 }}>
                    This powers your design blocks and can be expanded by your upcoming canvas editor.
                  </Text>
                  <TextArea
                    value={layoutText}
                    onChange={(e) => setLayoutText(e.target.value)}
                    rows={16}
                    className="invite-studio-json"
                    style={{ marginTop: 8 }}
                  />
                </div>

                <Space wrap>
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

                <Space align="center" wrap>
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
