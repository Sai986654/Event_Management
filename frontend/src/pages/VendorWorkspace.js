import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Button, Card, Col, Form, Image, Input, InputNumber, Row, Select, Space, Table, Tag, Upload, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { AuthContext } from '../context/AuthContext';
import { vendorService } from '../services/vendorService';
import { packageService } from '../services/packageService';
import { getErrorMessage } from '../utils/helpers';
import './PhaseFlows.css';

const categories = ['catering', 'decor', 'photography', 'videography', 'music', 'venue', 'florist', 'transportation', 'other'];

const VendorWorkspace = () => {
  const { user } = useContext(AuthContext);
  const [profileForm] = Form.useForm();
  const [packageForm] = Form.useForm();
  const [testimonialForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [submittingProfile, setSubmittingProfile] = useState(false);
  const [submittingPackage, setSubmittingPackage] = useState(false);
  const [submittingTestimonial, setSubmittingTestimonial] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [mediaCaption, setMediaCaption] = useState('');
  const [vendor, setVendor] = useState(null);
  const [packages, setPackages] = useState([]);

  const statusColor = useMemo(
    () => ({ approved: 'green', pending: 'orange', rejected: 'red' }[vendor?.verificationStatus] || 'default'),
    [vendor?.verificationStatus]
  );

  const loadData = async () => {
    setLoading(true);
    try {
      const vendorsRes = await vendorService.searchVendors({ limit: 100 });
      const mine = (vendorsRes.vendors || []).find((v) => v.user?.id === user?.id);
      setVendor(mine || null);
      if (mine) {
        const packageRes = await packageService.getMyPackages();
        setPackages(packageRes.packages || []);
      } else {
        setPackages([]);
      }
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const upsertProfile = async (values) => {
    setSubmittingProfile(true);
    try {
      if (vendor) {
        await vendorService.updateVendorProfile(vendor.id, values);
        message.success('Vendor profile updated');
      } else {
        await vendorService.createVendorProfile(values);
        message.success('Vendor profile created');
      }
      await loadData();
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setSubmittingProfile(false);
    }
  };

  const createPackage = async (values) => {
    setSubmittingPackage(true);
    try {
      await packageService.createPackage({
        ...values,
        estimationRules: {
          fixed: Number(values.fixed || 0),
          perGuest: Number(values.perGuest || 0),
          perHour: Number(values.perHour || 0),
        },
        deliverables: values.deliverables ? values.deliverables.split(',').map((d) => d.trim()).filter(Boolean) : [],
      });
      packageForm.resetFields();
      message.success('Package added');
      await loadData();
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setSubmittingPackage(false);
    }
  };

  const addTestimonial = async (values) => {
    setSubmittingTestimonial(true);
    try {
      await packageService.addTestimonial(values);
      testimonialForm.resetFields();
      message.success('Testimonial added');
      await loadData();
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setSubmittingTestimonial(false);
    }
  };

  const handlePortfolioUpload = async ({ file, onSuccess, onError }) => {
    if (!vendor?.id) {
      message.warning('Create your profile first before uploading portfolio media.');
      return;
    }
    setUploadingMedia(true);
    try {
      await vendorService.uploadVendorMedia(vendor.id, file, mediaCaption);
      message.success('Portfolio media uploaded.');
      setMediaCaption('');
      await loadData();
      if (typeof onSuccess === 'function') onSuccess('ok');
    } catch (err) {
      message.error(getErrorMessage(err));
      if (typeof onError === 'function') onError(err);
    } finally {
      setUploadingMedia(false);
    }
  };

  const portfolioItems = Array.isArray(vendor?.portfolio) ? vendor.portfolio : [];

  return (
    <div className="phase-page">
      <Row gutter={[16, 16]} className="phase-stack">
        <Col span={24}>
          <Card loading={loading} className="phase-hero">
            <Space direction="vertical" size={8}>
              <h1 className="phase-title">Vendor Workspace</h1>
              <p className="phase-subtitle">Build your service profile, package tiers, and testimonials.</p>
              <div><strong>Name:</strong> {user?.name}</div>
              <div>
                <strong>Verification:</strong>{' '}
                <Tag color={statusColor}>{vendor?.verificationStatus || 'not submitted'}</Tag>
                {vendor?.isVerified ? <Tag color="green">Verified</Tag> : null}
              </div>
              {vendor?.verificationNotes ? <div><strong>Admin notes:</strong> {vendor.verificationNotes}</div> : null}
            </Space>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card className="phase-card" title={vendor ? 'Update Vendor Profile' : 'Create Vendor Profile'}>
            <Form form={profileForm} layout="vertical" onFinish={upsertProfile} initialValues={vendor || { category: 'other' }}>
              <Form.Item name="businessName" label="Business Name" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item name="category" label="Category" rules={[{ required: true }]}>
                <Select options={categories.map((c) => ({ value: c, label: c }))} />
              </Form.Item>
              <Form.Item name="description" label="Detailed Description">
                <Input.TextArea rows={4} />
              </Form.Item>
              <Form.Item name="city" label="City"><Input /></Form.Item>
              <Form.Item name="state" label="State"><Input /></Form.Item>
              <Form.Item name="contactPhone" label="Phone"><Input /></Form.Item>
              <Form.Item name="contactEmail" label="Email"><Input /></Form.Item>
              <Button type="primary" htmlType="submit" loading={submittingProfile}>
                {vendor ? 'Save Profile' : 'Create Profile'}
              </Button>
            </Form>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card className="phase-card" title="Add Service Package">
            <Form form={packageForm} layout="vertical" onFinish={createPackage}>
              <Form.Item name="title" label="Package Title" rules={[{ required: true }]}><Input /></Form.Item>
              <Form.Item name="description" label="Description" rules={[{ required: true }]}><Input.TextArea rows={3} /></Form.Item>
              <Form.Item name="category" label="Category" rules={[{ required: true }]}><Select options={categories.map((c) => ({ value: c, label: c }))} /></Form.Item>
              <Form.Item name="tier" label="Tier" initialValue="standard"><Input /></Form.Item>
              <Row gutter={8}>
                <Col span={8}><Form.Item name="basePrice" label="Base Price"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
                <Col span={8}><Form.Item name="perGuest" label="Per Guest"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
                <Col span={8}><Form.Item name="perHour" label="Per Hour"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
              </Row>
              <Form.Item name="fixed" label="Fixed Add-on"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
              <Form.Item name="deliverables" label="Deliverables (comma-separated)"><Input /></Form.Item>
              <Button type="primary" htmlType="submit" loading={submittingPackage}>Add Package</Button>
            </Form>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card className="phase-card" title="Add Testimonial">
            <Form form={testimonialForm} layout="vertical" onFinish={addTestimonial}>
              <Form.Item name="clientName" label="Client Name" rules={[{ required: true }]}><Input /></Form.Item>
              <Form.Item name="content" label="Testimonial" rules={[{ required: true }]}><Input.TextArea rows={3} /></Form.Item>
              <Form.Item name="rating" label="Rating"><InputNumber min={1} max={5} style={{ width: '100%' }} /></Form.Item>
              <Form.Item name="source" label="Source"><Input /></Form.Item>
              <Button type="primary" htmlType="submit" loading={submittingTestimonial}>Add Testimonial</Button>
            </Form>
          </Card>
        </Col>

        <Col span={24}>
          <Card className="phase-card phase-table" title="My Packages">
            <Table
              rowKey="id"
              dataSource={packages}
              pagination={false}
              locale={{ emptyText: <div className="phase-empty">No packages yet. Add your first premium offering.</div> }}
              columns={[
                { title: 'Title', dataIndex: 'title' },
                { title: 'Category', dataIndex: 'category' },
                { title: 'Tier', dataIndex: 'tier' },
                { title: 'Base Price', dataIndex: 'basePrice' },
                { title: 'Status', dataIndex: 'isActive', render: (v) => <Tag color={v ? 'green' : 'default'}>{v ? 'active' : 'inactive'}</Tag> },
              ]}
            />
          </Card>
        </Col>

        <Col span={24}>
          <Card className="phase-card" title="Portfolio Media">
            {!vendor ? (
              <div className="phase-empty">Create your vendor profile first to upload portfolio media.</div>
            ) : (
            <>
            <Row gutter={[16, 16]} align="middle">
              <Col xs={24} md={16}>
                <Input
                  placeholder="Optional caption for this media"
                  value={mediaCaption}
                  onChange={(e) => setMediaCaption(e.target.value)}
                />
              </Col>
              <Col xs={24} md={8}>
                <Upload
                  accept="image/*,video/*"
                  showUploadList={false}
                  customRequest={handlePortfolioUpload}
                  disabled={uploadingMedia}
                >
                  <Button type="primary" icon={<PlusOutlined />} loading={uploadingMedia} block>
                    Upload media
                  </Button>
                </Upload>
              </Col>
            </Row>

            <div className="vendor-portfolio-grid">
              {portfolioItems.length === 0 ? (
                <div className="phase-empty">No portfolio media uploaded yet.</div>
              ) : (
                portfolioItems.map((item) => (
                  <Card key={item.id || item.url} size="small" className="vendor-portfolio-item">
                    {item.type === 'video' ? (
                      <video src={item.url} controls className="vendor-portfolio-video" />
                    ) : (
                      <Image src={item.url} alt={item.caption || 'vendor media'} className="vendor-portfolio-image" />
                    )}
                    {item.caption ? <div className="vendor-portfolio-caption">{item.caption}</div> : null}
                  </Card>
                ))
              )}
            </div>
            </>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default VendorWorkspace;
