import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Card, Table, Button, Modal, Form, Input, Select, Upload, message, Spin, Row, Col, Statistic, Badge, Typography } from 'antd';
import { PlusOutlined, UploadOutlined } from '@ant-design/icons';
import { guestService } from '../services/guestService';
import { useEventSocket } from '../hooks/useEventSocket';
import { getErrorMessage } from '../utils/helpers';
import './GuestManagement.css';

const GuestManagement = () => {
  const { eventId } = useParams();
  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [inviteTemplates, setInviteTemplates] = useState([]);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState('royal-maroon');
  const [selectedTone, setSelectedTone] = useState('friendly');
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [selectedGuestIds, setSelectedGuestIds] = useState([]);
  const [generatingGuestId, setGeneratingGuestId] = useState(null);
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm();

  const renderTemplateOption = (template) => {
    const preview = template?.preview || {};
    return (
      <div className="invite-template-option">
        <span
          className="invite-template-thumb"
          style={{
            background: preview.gradient || 'linear-gradient(135deg, #7c2d12 0%, #9a3412 100%)',
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

  const selectedGuests = guests.filter((guest) => selectedGuestIds.includes(guest.id));
  const previewGuest = selectedGuests[0] || null;
  const extraSelectedCount = Math.max(0, selectedGuests.length - 1);
  const previewGuestName = previewGuest?.name || 'Priya';
  const previewRelationship = previewGuest?.relationship || 'guest';

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

  const previewBody = sampleCopy[selectedLanguage]?.[selectedTone] || sampleCopy.en.friendly;
  const previewSalutation =
    selectedLanguage === 'te'
      ? `Priyamaina ${previewGuestName} garu`
      : `Dear ${previewGuestName}`;

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
      await guestService.generatePersonalizedInvite(guest.id, {
        language: selectedLanguage,
        tone: selectedTone,
        templateKey: selectedTemplateKey,
      });
      message.success(`Invite generated for ${guest.name}`);
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
      const payload = {
        defaultLanguage: selectedLanguage,
        defaultTone: selectedTone,
        defaultTemplateKey: selectedTemplateKey,
      };

      if (selectedGuestIds.length) {
        payload.guestIds = selectedGuestIds;
      }

      const result = await guestService.generateBulkPersonalizedInvites(eventId, payload);
      message.success(`Generated ${result.generated}/${result.total} personalized invites`);
      fetchGuests();
    } catch (error) {
      message.error(getErrorMessage(error));
    } finally {
      setBulkGenerating(false);
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
            <Upload beforeUpload={handleBulkImport} maxCount={1} accept=".csv">
              <Button icon={<UploadOutlined />}>
                Bulk Import (CSV)
              </Button>
            </Upload>
          </div>

          <Card className="invite-generator-card" loading={loadingTemplates}>
            <Typography.Title level={5} style={{ marginBottom: 12 }}>
              Personalized Invite Generator
            </Typography.Title>
            <div className="invite-generator-controls">
              <Select
                value={selectedTemplateKey}
                onChange={setSelectedTemplateKey}
                placeholder="Select template"
                style={{ minWidth: 220 }}
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
                options={[
                  { value: 'friendly', label: 'Friendly' },
                  { value: 'formal', label: 'Formal' },
                  { value: 'emotional', label: 'Emotional' },
                ]}
              />
              <Button type="primary" loading={bulkGenerating} onClick={handleGenerateBulkInvites}>
                {selectedGuestIds.length
                  ? `Generate for Selected (${selectedGuestIds.length})`
                  : 'Generate for All Guests'}
              </Button>
            </div>

            <div className="invite-live-preview-wrap">
              <div
                className="invite-live-preview"
                style={{
                  background:
                    selectedTemplate?.preview?.gradient ||
                    'linear-gradient(135deg, #7c2d12 0%, #9a3412 100%)',
                  borderColor: selectedTemplate?.preview?.frame || '#7c2d12',
                }}
              >
                <div className="invite-live-preview-inner">
                  <div className="invite-live-preview-top">Vedika 360</div>
                  <div className="invite-live-preview-title">
                    {selectedTemplate?.name || 'Template Preview'}
                  </div>
                  <div className="invite-live-preview-meta">
                    {selectedLanguage === 'te' ? 'Telugu' : 'English'} • {selectedTone} • {previewRelationship}
                  </div>
                  <div className="invite-live-preview-salutation">{previewSalutation}</div>
                  <div className="invite-live-preview-body">{previewBody}</div>
                  <div className="invite-live-preview-footer">
                    Preview guest: {previewGuestName}
                    {extraSelectedCount > 0 ? ` +${extraSelectedCount} more selected` : ''}
                  </div>
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
      </Spin>
    </div>
  );
};

export default GuestManagement;
