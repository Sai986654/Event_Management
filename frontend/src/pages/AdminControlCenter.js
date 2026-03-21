import React, { useEffect, useState } from 'react';
import { Button, Card, Col, Form, Input, Row, Select, Space, Table, Tag, message } from 'antd';
import { adminService } from '../services/adminService';
import { vendorService } from '../services/vendorService';
import { getErrorMessage } from '../utils/helpers';
import './PhaseFlows.css';

const AdminControlCenter = () => {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [verifyingVendorId, setVerifyingVendorId] = useState(null);
  const [form] = Form.useForm();

  const loadVendors = async () => {
    setLoading(true);
    try {
      const res = await vendorService.searchVendors({ limit: 100 });
      setVendors(res.vendors || []);
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVendors();
  }, []);

  const verify = async (vendorId, status) => {
    setVerifyingVendorId(vendorId);
    try {
      await adminService.verifyVendor(vendorId, status);
      message.success(`Vendor ${status}`);
      await loadVendors();
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setVerifyingVendorId(null);
    }
  };

  const createUser = async (values) => {
    setCreatingUser(true);
    try {
      await adminService.createUser(values);
      form.resetFields();
      message.success('User created');
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setCreatingUser(false);
    }
  };

  return (
    <div className="phase-page">
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card className="phase-hero">
            <h1 className="phase-title">Admin Control Center</h1>
            <p className="phase-subtitle">Verify vendors, manage onboarding, and create internal users.</p>
          </Card>
        </Col>
        <Col span={24}>
          <Card className="phase-card phase-table" title="Vendor Verification Queue">
            <Table
              loading={loading}
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
        </Col>

        <Col span={24}>
          <Card className="phase-card" title="Create Organizer / Vendor / Other User">
            <Form form={form} layout="vertical" onFinish={createUser}>
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
        </Col>
      </Row>
    </div>
  );
};

export default AdminControlCenter;
