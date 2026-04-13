import React, { useCallback, useEffect, useState } from 'react';
import { Button, Card, Col, Form, Input, Modal, Popconfirm, Row, Select, Space, Table, Tabs, Tag, message } from 'antd';
import { DeleteOutlined, PlusOutlined, AppstoreOutlined, ShopOutlined, TeamOutlined, UserAddOutlined } from '@ant-design/icons';
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

  // ── Vendor Management ──────────────────────────────────────────────
  const [allVendors, setAllVendors] = useState([]);
  const [loadingAllVendors, setLoadingAllVendors] = useState(false);
  const [deletingVendorId, setDeletingVendorId] = useState(null);

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
    loadAllVendors();
  }, [loadVerificationQueue, loadCategories, loadAllVendors]);

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
    </div>
  );
};

export default AdminControlCenter;
