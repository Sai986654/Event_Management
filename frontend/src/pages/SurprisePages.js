import React, { useState, useEffect } from 'react';
import {
  Card, Row, Col, Button, Typography, Tag, Modal, Form, Input, Select,
  Steps, Upload, message, Tabs, Space, Tooltip, Badge, Empty, Spin,
  Popconfirm, Statistic, Divider, Switch, DatePicker, Alert,
} from 'antd';
import {
  PlusOutlined, HeartOutlined, GiftOutlined, SmileOutlined,
  DeleteOutlined, EditOutlined, EyeOutlined, CopyOutlined,
  LinkOutlined, BarChartOutlined, RocketOutlined, ThunderboltOutlined,
  ClockCircleOutlined, LockOutlined, ShareAltOutlined,
} from '@ant-design/icons';
import { surpriseService } from '../services/surpriseService';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const categoryConfig = {
  proposal: { color: 'magenta', icon: <HeartOutlined />, label: 'Proposal' },
  birthday: { color: 'blue', icon: <GiftOutlined />, label: 'Birthday' },
  anniversary: { color: 'gold', icon: <HeartOutlined />, label: 'Anniversary' },
  apology: { color: 'purple', icon: <SmileOutlined />, label: 'Apology' },
  congratulations: { color: 'green', icon: <RocketOutlined />, label: 'Congrats' },
  other: { color: 'default', icon: <ThunderboltOutlined />, label: 'Other' },
};

const tierConfig = {
  free: { color: 'default', label: 'Free' },
  basic: { color: 'blue', label: 'Basic - ₹199' },
  premium: { color: 'gold', label: 'Premium - ₹499' },
  ultimate: { color: 'red', label: 'Ultimate - ₹999' },
};

const SurprisePages = () => {
  const [templates, setTemplates] = useState([]);
  const [myPages, setMyPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createModal, setCreateModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [analyticsModal, setAnalyticsModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [selectedPage, setSelectedPage] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const [filterCategory, setFilterCategory] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [templatesRes, pagesRes] = await Promise.all([
        surpriseService.getTemplates(),
        surpriseService.getMySurprisePages(),
      ]);
      setTemplates(templatesRes.templates || []);
      setMyPages(pagesRes.pages || []);
    } catch (err) {
      message.error('Failed to load data');
    }
    setLoading(false);
  };

  const handleSelectTemplate = (template) => {
    setSelectedTemplate(template);
    form.setFieldsValue({
      templateId: template.id,
      category: template.category,
      steps: template.steps,
    });
    setCreateModal(true);
    setCurrentStep(0);
  };

  const handleCreateFromScratch = () => {
    setSelectedTemplate(null);
    form.resetFields();
    setCreateModal(true);
    setCurrentStep(0);
  };

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      const data = {
        ...values,
        templateId: selectedTemplate?.id || null,
        steps: selectedTemplate?.steps || values.steps || [],
        photos: values.photoUrls ? values.photoUrls.split(',').map(u => u.trim()).filter(Boolean) : [],
      };
      delete data.photoUrls;

      await surpriseService.createSurprisePage(data);
      message.success('Surprise page created! 🎉');
      setCreateModal(false);
      form.resetFields();
      loadData();
    } catch (err) {
      if (err.errorFields) return; // validation error
      message.error(err.response?.data?.message || 'Failed to create');
    }
  };

  const handleUpdate = async () => {
    try {
      const values = await editForm.validateFields();
      await surpriseService.updateSurprisePage(selectedPage.id, values);
      message.success('Updated!');
      setEditModal(false);
      loadData();
    } catch (err) {
      if (err.errorFields) return;
      message.error('Failed to update');
    }
  };

  const handleDelete = async (id) => {
    try {
      await surpriseService.deleteSurprisePage(id);
      message.success('Deleted');
      loadData();
    } catch {
      message.error('Failed to delete');
    }
  };

  const handleViewAnalytics = async (page) => {
    try {
      const res = await surpriseService.getAnalytics(page.id);
      setAnalytics(res);
      setSelectedPage(page);
      setAnalyticsModal(true);
    } catch {
      message.error('Failed to load analytics');
    }
  };

  const handleEdit = (page) => {
    setSelectedPage(page);
    editForm.setFieldsValue({
      title: page.title,
      recipientName: page.recipientName,
      senderName: page.senderName,
      category: page.category,
      finalMessage: page.finalMessage,
      status: page.status,
      musicUrl: page.musicUrl,
      videoUrl: page.videoUrl,
    });
    setEditModal(true);
  };

  const copyLink = (page) => {
    const url = page.deployedUrl || `${window.location.origin}/surprise/${page.slug}`;
    navigator.clipboard.writeText(url);
    message.success('Link copied! Share it with your special person 💕');
  };

  const getShareUrl = (page) => page.deployedUrl || `${window.location.origin}/surprise/${page.slug}`;

  const handlePublish = async (page) => {
    try {
      message.loading({ content: 'Deploying your surprise...', key: 'publish', duration: 0 });
      const res = await surpriseService.publishPage(page.id, 'auto');
      message.success({
        content: `Published to ${res.deploy.target}! URL: ${res.deploy.url}`,
        key: 'publish',
        duration: 5,
      });
      loadData();
    } catch (err) {
      message.error({ content: err.response?.data?.message || 'Publish failed', key: 'publish' });
    }
  };

  const handleUnpublish = async (page) => {
    try {
      await surpriseService.unpublishPage(page.id);
      message.success('Page unpublished');
      loadData();
    } catch {
      message.error('Failed to unpublish');
    }
  };

  const filteredTemplates = filterCategory
    ? templates.filter(t => t.category === filterCategory)
    : templates;

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" />
        <br /><br />
        <Text type="secondary">Loading surprise magic… ✨</Text>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Hero Section */}
      <div style={{
        textAlign: 'center',
        padding: '40px 20px',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: 16,
        marginBottom: 32,
        color: '#fff',
      }}>
        <Title level={2} style={{ color: '#fff', margin: 0 }}>
          ✨ Interactive Surprise Pages
        </Title>
        <Paragraph style={{ color: 'rgba(255,255,255,0.9)', fontSize: 16, marginTop: 8 }}>
          Create unforgettable digital experiences — proposals, birthdays, apologies & more.
          <br />Share a link, watch the magic happen.
        </Paragraph>
        <Button
          type="primary"
          size="large"
          icon={<PlusOutlined />}
          onClick={handleCreateFromScratch}
          style={{ marginTop: 16, background: '#fff', color: '#764ba2', border: 'none', fontWeight: 600 }}
        >
          Create From Scratch
        </Button>
      </div>

      <Tabs defaultActiveKey="templates" items={[
        {
          key: 'templates',
          label: <span><RocketOutlined /> Templates</span>,
          children: (
            <>
              {/* Category filter */}
              <Space wrap style={{ marginBottom: 16 }}>
                <Tag.CheckableTag
                  checked={!filterCategory}
                  onChange={() => setFilterCategory(null)}
                >
                  All
                </Tag.CheckableTag>
                {Object.entries(categoryConfig).map(([key, cfg]) => (
                  <Tag.CheckableTag
                    key={key}
                    checked={filterCategory === key}
                    onChange={(checked) => setFilterCategory(checked ? key : null)}
                  >
                    {cfg.icon} {cfg.label}
                  </Tag.CheckableTag>
                ))}
              </Space>

              <Row gutter={[16, 16]}>
                {filteredTemplates.map(template => (
                  <Col xs={24} sm={12} md={8} key={template.id}>
                    <Card
                      hoverable
                      style={{ borderRadius: 12, overflow: 'hidden' }}
                      cover={
                        <div style={{
                          height: 160,
                          background: template.category === 'proposal'
                            ? 'linear-gradient(135deg, #f093fb, #f5576c)'
                            : template.category === 'birthday'
                            ? 'linear-gradient(135deg, #4facfe, #00f2fe)'
                            : template.category === 'anniversary'
                            ? 'linear-gradient(135deg, #fa709a, #fee140)'
                            : template.category === 'apology'
                            ? 'linear-gradient(135deg, #a18cd1, #fbc2eb)'
                            : 'linear-gradient(135deg, #84fab0, #8fd3f4)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 48,
                        }}>
                          {template.category === 'proposal' ? '💍' :
                           template.category === 'birthday' ? '🎂' :
                           template.category === 'anniversary' ? '💕' :
                           template.category === 'apology' ? '🥺' : '🎉'}
                        </div>
                      }
                      actions={[
                        <Button
                          type="link"
                          icon={<EyeOutlined />}
                          onClick={() => handleSelectTemplate(template)}
                        >
                          Use Template
                        </Button>,
                      ]}
                    >
                      <Card.Meta
                        title={template.name}
                        description={
                          <>
                            <Paragraph ellipsis={{ rows: 2 }} style={{ marginBottom: 8 }}>
                              {template.description}
                            </Paragraph>
                            <Space>
                              <Tag color={categoryConfig[template.category]?.color}>
                                {categoryConfig[template.category]?.label}
                              </Tag>
                              <Tag color={tierConfig[template.tier]?.color}>
                                {tierConfig[template.tier]?.label}
                              </Tag>
                              <Text type="secondary">{template.steps?.length || 0} steps</Text>
                            </Space>
                          </>
                        }
                      />
                    </Card>
                  </Col>
                ))}

                {filteredTemplates.length === 0 && (
                  <Col span={24}>
                    <Empty description="No templates in this category yet" />
                  </Col>
                )}
              </Row>
            </>
          ),
        },
        {
          key: 'my-pages',
          label: <span><HeartOutlined /> My Surprise Pages</span>,
          children: (
            <>
              {myPages.length === 0 ? (
                <Empty
                  description="No surprise pages yet. Pick a template and create one!"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                >
                  <Button type="primary" onClick={handleCreateFromScratch}>
                    Create Your First Surprise
                  </Button>
                </Empty>
              ) : (
                <Row gutter={[16, 16]}>
                  {myPages.map(page => (
                    <Col xs={24} sm={12} md={8} key={page.id}>
                      <Badge.Ribbon
                        text={page.status}
                        color={
                          page.status === 'active' ? 'green' :
                          page.status === 'draft' ? 'orange' : 'red'
                        }
                      >
                        <Card
                          style={{ borderRadius: 12 }}
                          actions={[
                            <Tooltip title="Edit">
                              <EditOutlined onClick={() => handleEdit(page)} />
                            </Tooltip>,
                            page.status === 'active'
                              ? <Tooltip title="Unpublish">
                                  <Popconfirm title="Unpublish this page?" onConfirm={() => handleUnpublish(page)}>
                                    <LinkOutlined style={{ color: '#52c41a' }} />
                                  </Popconfirm>
                                </Tooltip>
                              : <Tooltip title="Publish & Deploy">
                                  <RocketOutlined style={{ color: '#1890ff' }} onClick={() => handlePublish(page)} />
                                </Tooltip>,
                            <Tooltip title="Copy Share Link">
                              <CopyOutlined onClick={() => copyLink(page)} />
                            </Tooltip>,
                            <Tooltip title="Preview">
                              <EyeOutlined onClick={() => window.open(getShareUrl(page), '_blank')} />
                            </Tooltip>,
                            <Tooltip title="Analytics">
                              <BarChartOutlined onClick={() => handleViewAnalytics(page)} />
                            </Tooltip>,
                            <Popconfirm title="Delete this surprise?" onConfirm={() => handleDelete(page.id)}>
                              <DeleteOutlined style={{ color: '#ff4d4f' }} />
                            </Popconfirm>,
                          ]}
                        >
                          <Card.Meta
                            title={page.title}
                            description={
                              <>
                                <Space direction="vertical" size={4} style={{ width: '100%' }}>
                                  <Text>To: <strong>{page.recipientName}</strong></Text>
                                  <Text>From: <strong>{page.senderName}</strong></Text>
                                  <Space>
                                    <Tag color={categoryConfig[page.category]?.color}>
                                      {categoryConfig[page.category]?.label}
                                    </Tag>
                                    <Tag color={tierConfig[page.tier]?.color}>
                                      {tierConfig[page.tier]?.label}
                                    </Tag>
                                  </Space>
                                  <Space split={<Divider type="vertical" />}>
                                    <Text type="secondary">
                                      <EyeOutlined /> {page.viewCount} views
                                    </Text>
                                    <Text type="secondary">
                                      <HeartOutlined /> {page.completedCount} completed
                                    </Text>
                                  </Space>
                                  {page.scheduledAt && (
                                    <Text type="secondary">
                                      <ClockCircleOutlined /> Scheduled: {new Date(page.scheduledAt).toLocaleString()}
                                    </Text>
                                  )}
                                  {page.deployedUrl && (
                                    <Text type="secondary" style={{ fontSize: 12 }}>
                                      <LinkOutlined /> {page.deployTarget === 'netlify' ? '🟢 Netlify' : page.deployTarget === 'r2' ? '🔵 R2' : '⚪ Internal'}
                                    </Text>
                                  )}
                                </Space>
                              </>
                            }
                          />
                        </Card>
                      </Badge.Ribbon>
                    </Col>
                  ))}
                </Row>
              )}
            </>
          ),
        },
      ]} />

      {/* Create Modal */}
      <Modal
        title={
          <Space>
            <RocketOutlined />
            {selectedTemplate ? `Create from: ${selectedTemplate.name}` : 'Create Surprise Page'}
          </Space>
        }
        open={createModal}
        onCancel={() => setCreateModal(false)}
        width={700}
        footer={null}
        destroyOnClose
      >
        <Steps
          current={currentStep}
          size="small"
          style={{ marginBottom: 24 }}
          items={[
            { title: 'Details' },
            { title: 'Content' },
            { title: 'Settings' },
          ]}
        />

        <Form form={form} layout="vertical">
          {/* Step 1: Basic Details */}
          <div style={{ display: currentStep === 0 ? 'block' : 'none' }}>
            <Form.Item name="title" label="Title" rules={[{ required: true }]}>
              <Input placeholder="A Special Surprise for You" />
            </Form.Item>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="recipientName" label="Recipient Name" rules={[{ required: true }]}>
                  <Input placeholder="Their name" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="senderName" label="Your Name" rules={[{ required: true }]}>
                  <Input placeholder="Your name" />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="category" label="Category" initialValue="proposal">
              <Select>
                {Object.entries(categoryConfig).map(([key, cfg]) => (
                  <Select.Option key={key} value={key}>
                    {cfg.icon} {cfg.label}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          </div>

          {/* Step 2: Content */}
          <div style={{ display: currentStep === 1 ? 'block' : 'none' }}>
            <Form.Item name="finalMessage" label="Final Message (shown at the end)">
              <TextArea
                rows={4}
                placeholder="Write your heartfelt message here… This appears at the final reveal."
              />
            </Form.Item>
            <Form.Item name="photoUrls" label="Photo URLs (comma-separated)">
              <TextArea
                rows={2}
                placeholder="https://example.com/photo1.jpg, https://example.com/photo2.jpg"
              />
            </Form.Item>
            <Form.Item name="videoUrl" label="Video URL (final reveal video)">
              <Input placeholder="https://example.com/video.mp4" />
            </Form.Item>
            <Form.Item name="musicUrl" label="Background Music URL">
              <Input placeholder="https://example.com/music.mp3" />
            </Form.Item>
            <Form.Item name="voiceMessageUrl" label="Voice Message URL">
              <Input placeholder="https://example.com/voice.mp3" />
            </Form.Item>
          </div>

          {/* Step 3: Settings */}
          <div style={{ display: currentStep === 2 ? 'block' : 'none' }}>
            <Form.Item name="scheduledAt" label="Schedule Reveal (optional)">
              <DatePicker showTime style={{ width: '100%' }} placeholder="Activate at specific time" />
            </Form.Item>
            <Form.Item name="password" label="Access Password (optional)">
              <Input.Password placeholder="Leave empty for no password" />
            </Form.Item>
            <Form.Item name="tier" label="Tier" initialValue="free">
              <Select>
                {Object.entries(tierConfig).map(([key, cfg]) => (
                  <Select.Option key={key} value={key}>
                    {cfg.label}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>

            {selectedTemplate && (
              <Alert
                type="info"
                showIcon
                message={`Using template: ${selectedTemplate.name}`}
                description={`${selectedTemplate.steps?.length || 0} interactive steps included. You can customize them after creation.`}
                style={{ marginBottom: 16 }}
              />
            )}
          </div>

          {/* Navigation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
            {currentStep > 0 ? (
              <Button onClick={() => setCurrentStep(s => s - 1)}>Back</Button>
            ) : <div />}
            {currentStep < 2 ? (
              <Button type="primary" onClick={() => setCurrentStep(s => s + 1)}>Next</Button>
            ) : (
              <Button type="primary" icon={<RocketOutlined />} onClick={handleCreate}>
                Create Surprise Page
              </Button>
            )}
          </div>
        </Form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        title="Edit Surprise Page"
        open={editModal}
        onCancel={() => setEditModal(false)}
        onOk={handleUpdate}
        okText="Save Changes"
      >
        <Form form={editForm} layout="vertical">
          <Form.Item name="title" label="Title">
            <Input />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="recipientName" label="Recipient Name">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="senderName" label="Sender Name">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="category" label="Category">
            <Select>
              {Object.entries(categoryConfig).map(([key, cfg]) => (
                <Select.Option key={key} value={key}>{cfg.label}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="finalMessage" label="Final Message">
            <TextArea rows={3} />
          </Form.Item>
          <Form.Item name="status" label="Status">
            <Select>
              <Select.Option value="draft">Draft</Select.Option>
              <Select.Option value="active">Active (Live)</Select.Option>
              <Select.Option value="disabled">Disabled</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="videoUrl" label="Video URL">
            <Input />
          </Form.Item>
          <Form.Item name="musicUrl" label="Music URL">
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      {/* Analytics Modal */}
      <Modal
        title={<span><BarChartOutlined /> Analytics — {selectedPage?.title}</span>}
        open={analyticsModal}
        onCancel={() => setAnalyticsModal(false)}
        footer={null}
        width={600}
      >
        {analytics && (
          <>
            <Row gutter={16}>
              <Col span={8}>
                <Statistic title="Total Views" value={analytics.viewCount} prefix={<EyeOutlined />} />
              </Col>
              <Col span={8}>
                <Statistic title="Completed" value={analytics.completedCount} prefix={<HeartOutlined />} />
              </Col>
              <Col span={8}>
                <Statistic title="Completion Rate" value={analytics.completionRate} suffix="%" />
              </Col>
            </Row>
            <Divider />
            {analytics.reactionBreakdown?.length > 0 && (
              <>
                <Title level={5}>Reactions</Title>
                <Space wrap>
                  {analytics.reactionBreakdown.map(r => (
                    <Tag key={r.reaction} color="blue">
                      {r.reaction}: {r._count}
                    </Tag>
                  ))}
                </Space>
                <Divider />
              </>
            )}
            <Title level={5}>Recent Interactions</Title>
            {analytics.recentInteractions?.map(i => (
              <Card key={i.id} size="small" style={{ marginBottom: 8 }}>
                <Space>
                  <Text>Step {i.stepReached}</Text>
                  <Tag color={i.completed ? 'green' : 'orange'}>
                    {i.completed ? 'Completed' : 'In Progress'}
                  </Tag>
                  {i.reaction && <Tag color="purple">{i.reaction}</Tag>}
                  <Text type="secondary">{new Date(i.createdAt).toLocaleString()}</Text>
                </Space>
              </Card>
            ))}
          </>
        )}
      </Modal>
    </div>
  );
};

export default SurprisePages;
