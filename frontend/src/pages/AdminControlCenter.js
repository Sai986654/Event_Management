import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Form, Input, InputNumber, Modal, Popconfirm, Row, Select, Space, Table, Tabs, Tag, message } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined, AppstoreOutlined, CloudUploadOutlined, EnvironmentOutlined, ShopOutlined, TeamOutlined, UserAddOutlined } from '@ant-design/icons';
import { adminService } from '../services/adminService';
import { vendorService } from '../services/vendorService';
import { getErrorMessage } from '../utils/helpers';
import './PhaseFlows.css';

const AdminControlCenter = () => {
  // ── Vendor Verification ────────────────────────────────────────────
  const [vendors, setVendors] = useState([]);
  const [loadingVendors, setLoadingVendors] = useState(false);
  const [verifyingVendorId, setVerifyingVendorId] = useState(null);

  const loadVerificationQueue = useCallback(async () => {
    setLoadingVendors(true);
    try {
      const res = await vendorService.searchVendors({ limit: 100 });
      setVendors(res.vendors || []);
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setLoadingVendors(false);
    }
  }, []);

  const verify = async (vendorId, status) => {
    setVerifyingVendorId(vendorId);
    try {
      await adminService.verifyVendor(vendorId, status);
      message.success(`Vendor ${status}`);
      await loadVerificationQueue();
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setVerifyingVendorId(null);
    }
  };

  // ── Category Management ────────────────────────────────────────────
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [savingCategory, setSavingCategory] = useState(false);
  const [catForm] = Form.useForm();

  const loadCategories = useCallback(async () => {
    setLoadingCategories(true);
    try {
      const res = await adminService.getCategories();
      setCategories(res.categories || []);
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setLoadingCategories(false);
    }
  }, []);

  const addCategory = async (values) => {
    setSavingCategory(true);
    try {
      await adminService.createCategory(values);
      message.success('Category added');
      catForm.resetFields();
      setCatModalOpen(false);
      await loadCategories();
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setSavingCategory(false);
    }
  };

  const removeCategory = async (id) => {
    try {
      await adminService.deleteCategory(id);
      message.success('Category deleted');
      await loadCategories();
    } catch (err) {
      message.error(getErrorMessage(err));
    }
  };

  // ── Invite Template Management ────────────────────────────────────
  const [inviteTemplates, setInviteTemplates] = useState([]);
  const [loadingInviteTemplates, setLoadingInviteTemplates] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateForm] = Form.useForm();

  const loadInviteTemplates = useCallback(async () => {
    setLoadingInviteTemplates(true);
    try {
      const res = await adminService.getInviteTemplates();
      setInviteTemplates(res.templates || []);
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setLoadingInviteTemplates(false);
    }
  }, []);

  const openTemplateModal = (template = null) => {
    setEditingTemplate(template);
    setTemplateModalOpen(true);
    templateForm.setFieldsValue({
      name: template?.name || '',
      key: template?.key || '',
      description: template?.description || '',
      sortOrder: template?.sortOrder ?? undefined,
      isActive: template?.isActive ?? true,
      paletteJson: JSON.stringify(template?.palette || {}, null, 2),
    });
  };

  const saveTemplate = async (values) => {
    let palette = {};
    try {
      palette = values.paletteJson ? JSON.parse(values.paletteJson) : {};
    } catch (_error) {
      message.error('Palette JSON is invalid');
      return;
    }

    const payload = {
      name: values.name,
      key: values.key,
      description: values.description || '',
      sortOrder: values.sortOrder,
      isActive: values.isActive,
      palette,
    };

    setSavingTemplate(true);
    try {
      if (editingTemplate) {
        await adminService.updateInviteTemplate(editingTemplate.id, payload);
        message.success('Invite template updated');
      } else {
        await adminService.createInviteTemplate(payload);
        message.success('Invite template created');
      }
      setTemplateModalOpen(false);
      setEditingTemplate(null);
      templateForm.resetFields();
      await loadInviteTemplates();
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setSavingTemplate(false);
    }
  };

  const removeTemplate = async (id) => {
    try {
      await adminService.deleteInviteTemplate(id);
      message.success('Invite template deleted');
      await loadInviteTemplates();
    } catch (err) {
      message.error(getErrorMessage(err));
    }
  };

  // ── Vendor Management ──────────────────────────────────────────────
  const [allVendors, setAllVendors] = useState([]);
  const [loadingAllVendors, setLoadingAllVendors] = useState(false);
  const [deletingVendorId, setDeletingVendorId] = useState(null);
  const [syncingForms, setSyncingForms] = useState(false);
  const [syncingPlaces, setSyncingPlaces] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState(null);
  const [formsSyncForm] = Form.useForm();
  const [placesSyncForm] = Form.useForm();

  const loadAllVendors = useCallback(async () => {
    setLoadingAllVendors(true);
    try {
      const res = await adminService.getAllVendors({ limit: 100 });
      setAllVendors(res.vendors || []);
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setLoadingAllVendors(false);
    }
  }, []);

  const removeVendor = async (id) => {
    setDeletingVendorId(id);
    try {
      await adminService.deleteVendor(id);
      message.success('Vendor removed from marketplace');
      await loadAllVendors();
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setDeletingVendorId(null);
    }
  };

  const syncFromForms = async (values) => {
    setSyncingForms(true);
    try {
      const payload = {
        ...values,
        includeCredentialsInResponse: true,
      };
      const res = await adminService.syncGoogleFormVendors(payload);
      setLastSyncResult({ source: 'Google Forms', ...res.results });
      message.success('Google Form vendor sync completed');
      await Promise.all([loadAllVendors(), loadVerificationQueue()]);
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setSyncingForms(false);
    }
  };

  const syncFromPlaces = async (values) => {
    setSyncingPlaces(true);
    try {
      const payload = {
        ...values,
        includeCredentialsInResponse: true,
      };
      // Strip undefined/null lat and lng to avoid backend float validation errors
      if (payload.lat == null) delete payload.lat;
      if (payload.lng == null) delete payload.lng;
      const res = await adminService.syncGooglePlacesVendors(payload);
      setLastSyncResult({ source: 'Google Places', ...res.results });
      message.success('Google Places vendor sync completed');
      await Promise.all([loadAllVendors(), loadVerificationQueue()]);
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setSyncingPlaces(false);
    }
  };

  // ── Create User ────────────────────────────────────────────────────
  const [creatingUser, setCreatingUser] = useState(false);
  const [userForm] = Form.useForm();

  const createUser = async (values) => {
    setCreatingUser(true);
    try {
      await adminService.createUser(values);
      userForm.resetFields();
      message.success('User created');
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setCreatingUser(false);
    }
  };

  // ── Load data on mount ─────────────────────────────────────────────
  useEffect(() => {
    loadVerificationQueue();
    loadCategories();
    loadInviteTemplates();
    loadAllVendors();
  }, [loadVerificationQueue, loadCategories, loadInviteTemplates, loadAllVendors]);

  // ── Tab items ──────────────────────────────────────────────────────
  const tabItems = [
    {
      key: 'categories',
      label: <span><AppstoreOutlined /> Categories</span>,
      children: (
        <Card className="phase-card" title="Service Categories" extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setCatModalOpen(true)}>Add Category</Button>}>
          <Table
            loading={loadingCategories}
            rowKey="id"
            dataSource={categories}
            pagination={false}
            locale={{ emptyText: <div className="phase-empty">No categories yet.</div> }}
            columns={[
              { title: '#', dataIndex: 'sortOrder', width: 60 },
              { title: 'Name', dataIndex: 'name', render: (v) => <code>{v}</code> },
              { title: 'Label', dataIndex: 'label', render: (v, r) => <Tag color={r.color}>{v}</Tag> },
              { title: 'Color', dataIndex: 'color' },
              { title: 'Active', dataIndex: 'isActive', render: (v) => <Tag color={v ? 'green' : 'red'}>{v ? 'Yes' : 'No'}</Tag> },
              {
                title: 'Actions',
                width: 100,
                render: (_, r) => (
                  <Popconfirm title="Delete this category?" description="Only categories with no vendors/packages can be deleted." onConfirm={() => removeCategory(r.id)} okText="Delete" okButtonProps={{ danger: true }}>
                    <Button size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                ),
              },
            ]}
          />
        </Card>
      ),
    },
    {
      key: 'vendors',
      label: <span><ShopOutlined /> Vendor Management</span>,
      children: (
        <Card className="phase-card" title="All Marketplace Vendors">
          <Table
            loading={loadingAllVendors}
            rowKey="id"
            dataSource={allVendors}
            pagination={{ pageSize: 20 }}
            locale={{ emptyText: <div className="phase-empty">No vendors registered yet.</div> }}
            columns={[
              { title: 'Business', dataIndex: 'businessName', ellipsis: true },
              { title: 'Category', dataIndex: 'category', render: (v) => <Tag>{v}</Tag> },
              { title: 'Owner', render: (_, r) => r.user?.name || '-' },
              { title: 'Email', render: (_, r) => r.user?.email || '-', ellipsis: true },
              { title: 'Rating', dataIndex: 'averageRating', render: (v) => Number(v || 0).toFixed(1), width: 80 },
              { title: 'Reviews', dataIndex: 'totalReviews', width: 80 },
              {
                title: 'Status',
                render: (_, r) => (
                  <Space size={4}>
                    <Tag color={r.isVerified ? 'green' : 'orange'}>{r.verificationStatus || 'pending'}</Tag>
                  </Space>
                ),
              },
              {
                title: 'Actions',
                width: 100,
                render: (_, r) => (
                  <Popconfirm title="Remove this vendor?" description="This will delete the vendor profile, all packages, and testimonials. This cannot be undone." onConfirm={() => removeVendor(r.id)} okText="Delete" okButtonProps={{ danger: true }}>
                    <Button size="small" danger icon={<DeleteOutlined />} loading={deletingVendorId === r.id} />
                  </Popconfirm>
                ),
              },
            ]}
          />
        </Card>
      ),
    },
    {
      key: 'invite-templates',
      label: <span><AppstoreOutlined /> Invite Templates</span>,
      children: (
        <Card
          className="phase-card"
          title="Invite Card Designs"
          extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => openTemplateModal()}>Add Template</Button>}
        >
          <Table
            loading={loadingInviteTemplates}
            rowKey="id"
            dataSource={inviteTemplates}
            pagination={false}
            locale={{ emptyText: <div className="phase-empty">No invite templates yet.</div> }}
            columns={[
              { title: '#', dataIndex: 'sortOrder', width: 60 },
              { title: 'Key', dataIndex: 'key', render: (v) => <code>{v}</code> },
              { title: 'Name', dataIndex: 'name' },
              { title: 'Description', dataIndex: 'description', ellipsis: true },
              {
                title: 'Preview',
                render: (_, r) => (
                  <span
                    style={{
                      display: 'inline-block',
                      width: 54,
                      height: 20,
                      borderRadius: 12,
                      border: `1px solid ${r.palette?.frame || '#d9d9d9'}`,
                      background: `linear-gradient(135deg, ${r.palette?.frame || '#999'} 0%, ${r.palette?.accent || '#ccc'} 100%)`,
                    }}
                  />
                ),
              },
              { title: 'Active', dataIndex: 'isActive', render: (v) => <Tag color={v ? 'green' : 'red'}>{v ? 'Yes' : 'No'}</Tag> },
              {
                title: 'Actions',
                width: 150,
                render: (_, r) => (
                  <Space>
                    <Button size="small" icon={<EditOutlined />} onClick={() => openTemplateModal(r)}>
                      Edit
                    </Button>
                    <Popconfirm title="Delete this invite template?" onConfirm={() => removeTemplate(r.id)} okText="Delete" okButtonProps={{ danger: true }}>
                      <Button size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </Space>
                ),
              },
            ]}
          />
        </Card>
      ),
    },
    {
      key: 'verification',
      label: <span><TeamOutlined /> Verification Queue</span>,
      children: (
        <Card className="phase-card phase-table" title="Vendor Verification Queue">
          <Table
            loading={loadingVendors}
            rowKey="id"
            dataSource={vendors}
            pagination={false}
            locale={{ emptyText: <div className="phase-empty">No vendors pending verification right now.</div> }}
            columns={[
              { title: 'Business', dataIndex: 'businessName' },
              { title: 'Category', dataIndex: 'category' },
              { title: 'Owner', render: (_, r) => r.user?.name || '-' },
              {
                title: 'Status',
                render: (_, r) => (
                  <Space>
                    <Tag color={r.isVerified ? 'green' : 'orange'}>{r.verificationStatus || 'pending'}</Tag>
                    {r.isVerified ? <Tag color="green">verified</Tag> : null}
                  </Space>
                ),
              },
              {
                title: 'Actions',
                render: (_, r) => (
                  <Space>
                    <Button size="small" type="primary" loading={verifyingVendorId === r.id} onClick={() => verify(r.id, 'approved')}>Approve</Button>
                    <Button size="small" danger loading={verifyingVendorId === r.id} onClick={() => verify(r.id, 'rejected')}>Reject</Button>
                  </Space>
                ),
              },
            ]}
          />
        </Card>
      ),
    },
    {
      key: 'onboarding',
      label: <span><CloudUploadOutlined /> Vendor Onboarding</span>,
      children: (
        <Row gutter={[16, 16]}>
          <Col xs={24} xl={12}>
            <Card className="phase-card" title="Import From Google Forms">
              <Form form={formsSyncForm} layout="vertical" onFinish={syncFromForms} initialValues={{ limit: 100 }}>
                <Form.Item name="limit" label="Rows To Process">
                  <InputNumber min={1} max={5000} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item name="spreadsheetId" label="Spreadsheet ID">
                  <Input placeholder="Optional if GOOGLE_FORM_SHEET_ID is already set" />
                </Form.Item>
                <Form.Item name="range" label="Sheet Range">
                  <Input placeholder="Form Responses 1!A1:ZZ1000" />
                </Form.Item>
                <Form.Item name="defaultPassword" label="Default Vendor Password">
                  <Input.Password placeholder="Vendor@123" />
                </Form.Item>
                <Button type="primary" htmlType="submit" loading={syncingForms} icon={<CloudUploadOutlined />}>
                  Start Form Onboarding
                </Button>
              </Form>
            </Card>
          </Col>
          <Col xs={24} xl={12}>
            <Card className="phase-card" title="Import From Google Places">
              <Form form={placesSyncForm} layout="vertical" onFinish={syncFromPlaces} initialValues={{ limit: 50, radiusMeters: 15000 }}>
                <Form.Item name="query" label="Search Query" rules={[{ required: true, message: 'Enter a Places search query' }]}>
                  <Input placeholder="wedding caterers in Hyderabad" prefix={<EnvironmentOutlined />} />
                </Form.Item>
                <Row gutter={12}>
                  <Col xs={24} md={12}>
                    <Form.Item name="city" label="City">
                      <Input placeholder="Hyderabad" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item name="state" label="State">
                      <Input placeholder="Telangana" />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={12}>
                  <Col xs={24} md={12}>
                    <Form.Item name="lat" label="Latitude (optional)">
                      <InputNumber placeholder="17.3850" style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item name="lng" label="Longitude (optional)">
                      <InputNumber placeholder="78.4867" style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={12}>
                  <Col xs={24} md={12}>
                    <Form.Item name="limit" label="Max Listings">
                      <InputNumber min={1} max={200} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item name="radiusMeters" label="Radius (meters)">
                      <InputNumber min={1000} max={50000} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={12}>
                  <Col xs={24} md={12}>
                    <Form.Item name="type" label="Google Place Type">
                      <Input placeholder="caterer, florist, lodging..." />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item name="forceCategory" label="Force Marketplace Category">
                      <Select allowClear options={[
                        'catering', 'decor', 'photography', 'videography', 'music', 'venue', 'florist', 'transportation', 'other',
                      ].map((value) => ({ value, label: value }))} />
                    </Form.Item>
                  </Col>
                </Row>
                <Form.Item name="defaultPassword" label="Default Vendor Password">
                  <Input.Password placeholder="Vendor@123" />
                </Form.Item>
                <Button type="primary" htmlType="submit" loading={syncingPlaces} icon={<CloudUploadOutlined />}>
                  Start Places Onboarding
                </Button>
              </Form>
            </Card>
          </Col>
          <Col span={24}>
            <Card className="phase-card" title="Latest Onboarding Run">
              {lastSyncResult ? (
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  <Alert
                    type="info"
                    showIcon
                    message={`${lastSyncResult.source} completed`}
                    description={`Processed: ${lastSyncResult.processed || 0}, Created: ${lastSyncResult.created || 0}, Skipped: ${lastSyncResult.skipped || 0}, Failed: ${lastSyncResult.failed || 0}`}
                  />
                  {Array.isArray(lastSyncResult.credentials) && lastSyncResult.credentials.length > 0 ? (
                    <Input.TextArea
                      readOnly
                      rows={Math.min(10, lastSyncResult.credentials.length + 1)}
                      value={lastSyncResult.credentials.map((item) => `${item.email} | ${item.password}`).join('\n')}
                    />
                  ) : null}
                </Space>
              ) : (
                <div className="phase-empty">Trigger bulk onboarding from this tab. Results and created credentials will appear here.</div>
              )}
            </Card>
          </Col>
        </Row>
      ),
    },
    {
      key: 'users',
      label: <span><UserAddOutlined /> Create User</span>,
      children: (
        <Card className="phase-card" title="Create Organizer / Vendor / Other User">
          <Form form={userForm} layout="vertical" onFinish={createUser}>
            <Row gutter={12}>
              <Col xs={24} md={8}><Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="email" label="Email" rules={[{ required: true }]}><Input /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="password" label="Password"><Input.Password /></Form.Item></Col>
            </Row>
            <Row gutter={12}>
              <Col xs={24} md={8}>
                <Form.Item name="role" label="Role" rules={[{ required: true }]}>
                  <Select options={['admin', 'organizer', 'customer', 'vendor', 'guest'].map((r) => ({ value: r, label: r }))} />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}><Form.Item name="phone" label="Phone"><Input /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="businessName" label="Business Name (for vendor)"><Input /></Form.Item></Col>
            </Row>
            <Button type="primary" htmlType="submit" loading={creatingUser}>Create User</Button>
          </Form>
        </Card>
      ),
    },
  ];

  return (
    <div className="phase-page">
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card className="phase-hero">
            <h1 className="phase-title">Admin Control Center</h1>
            <p className="phase-subtitle">Manage categories, vendors, verification, and users.</p>
          </Card>
        </Col>
        <Col span={24}>
          <Tabs defaultActiveKey="categories" items={tabItems} size="large" />
        </Col>
      </Row>

      {/* Add Category Modal */}
      <Modal title="Add New Category" open={catModalOpen} onCancel={() => { setCatModalOpen(false); catForm.resetFields(); }} footer={null} destroyOnClose>
        <Form form={catForm} layout="vertical" onFinish={addCategory}>
          <Form.Item name="name" label="Category Name (slug)" rules={[{ required: true, message: 'Enter a category name' }]}
            help="Lowercase identifier used internally, e.g. makeup_artist">
            <Input placeholder="e.g. makeup_artist" />
          </Form.Item>
          <Form.Item name="label" label="Display Label" rules={[{ required: true, message: 'Enter a display label' }]}>
            <Input placeholder="e.g. Makeup Artist" />
          </Form.Item>
          <Form.Item name="color" label="Tag Color" initialValue="default">
            <Select options={[
              { value: 'default', label: 'Default (grey)' },
              { value: 'red', label: 'Red' },
              { value: 'orange', label: 'Orange' },
              { value: 'gold', label: 'Gold' },
              { value: 'green', label: 'Green' },
              { value: 'cyan', label: 'Cyan' },
              { value: 'blue', label: 'Blue' },
              { value: 'purple', label: 'Purple' },
              { value: 'magenta', label: 'Magenta' },
              { value: 'pink', label: 'Pink' },
            ]} />
          </Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={savingCategory}>Add Category</Button>
            <Button onClick={() => { setCatModalOpen(false); catForm.resetFields(); }}>Cancel</Button>
          </Space>
        </Form>
      </Modal>

      <Modal
        title={editingTemplate ? 'Edit Invite Template' : 'Add Invite Template'}
        open={templateModalOpen}
        onCancel={() => {
          setTemplateModalOpen(false);
          setEditingTemplate(null);
          templateForm.resetFields();
        }}
        footer={null}
        destroyOnClose
        width={720}
      >
        <Form form={templateForm} layout="vertical" onFinish={saveTemplate} initialValues={{ isActive: true }}>
          <Row gutter={12}>
            <Col xs={24} md={12}>
              <Form.Item name="name" label="Display Name" rules={[{ required: true, message: 'Name is required' }]}>
                <Input placeholder="Royal Maroon" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="key" label="Template Key" rules={[{ required: true, message: 'Key is required' }]}>
                <Input placeholder="royal-maroon" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col xs={24} md={12}>
              <Form.Item name="sortOrder" label="Sort Order">
                <Input type="number" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="isActive" label="Status">
                <Select options={[{ value: true, label: 'Active' }, { value: false, label: 'Inactive' }]} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="Description">
            <Input />
          </Form.Item>
          <Form.Item
            name="paletteJson"
            label="Palette JSON"
            rules={[
              {
                validator: async (_, value) => {
                  if (!value) return;
                  JSON.parse(value);
                },
              },
            ]}
            extra={'Example: {"background":"#fff7f2","frame":"#7c2d12","accent":"#9a3412","title":"#4a1d0a","body":"#1f2937","subtle":"#6b7280","link":"#9a3412"}'}
          >
            <Input.TextArea rows={8} />
          </Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={savingTemplate}>
              {editingTemplate ? 'Update Template' : 'Create Template'}
            </Button>
            <Button
              onClick={() => {
                setTemplateModalOpen(false);
                setEditingTemplate(null);
                templateForm.resetFields();
              }}
            >
              Cancel
            </Button>
          </Space>
        </Form>
      </Modal>
    </div>
  );
};

export default AdminControlCenter;
