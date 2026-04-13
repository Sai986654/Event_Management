import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card, Col, Divider, Form, Image, Input, InputNumber, Row, Select, Space, Table, Tag, Tooltip, Upload, message } from 'antd';
import { DeleteOutlined, EditOutlined, FacebookOutlined, InstagramOutlined, PlusOutlined, TwitterOutlined, YoutubeOutlined } from '@ant-design/icons';
import { AuthContext } from '../context/AuthContext';
import { vendorService } from '../services/vendorService';
import { packageService } from '../services/packageService';
import { getErrorMessage } from '../utils/helpers';
import './PhaseFlows.css';

const categories = ['catering', 'decor', 'photography', 'videography', 'music', 'venue', 'florist', 'transportation', 'other'];

const PROFILE_FIELDS = ['businessName', 'category', 'description', 'city', 'state', 'contactPhone', 'contactEmail', 'facebook', 'instagram', 'twitter', 'youtube'];

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
  const [profileDirty, setProfileDirty] = useState(false);
  const savedProfileRef = useRef({});
  const [editingPackage, setEditingPackage] = useState(null);

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

  // Populate profile form when vendor data loads
  useEffect(() => {
    const defaults = { category: 'other' };
    if (vendor) {
      const saved = {};
      const coreFields = ['businessName', 'category', 'description', 'city', 'state', 'contactPhone', 'contactEmail'];
      coreFields.forEach((f) => { saved[f] = vendor[f] ?? ''; });
      const links = vendor.socialLinks || {};
      saved.facebook = links.facebook || '';
      saved.instagram = links.instagram || '';
      saved.twitter = links.twitter || '';
      saved.youtube = links.youtube || '';
      profileForm.setFieldsValue(saved);
      savedProfileRef.current = saved;
    } else {
      profileForm.setFieldsValue(defaults);
      savedProfileRef.current = defaults;
    }
    setProfileDirty(false);
  }, [vendor, profileForm]);

  const onProfileValuesChange = () => {
    const current = profileForm.getFieldsValue(PROFILE_FIELDS);
    const saved = savedProfileRef.current;
    const changed = PROFILE_FIELDS.some((f) => (current[f] ?? '') !== (saved[f] ?? ''));
    setProfileDirty(changed);
  };

  const upsertProfile = async (values) => {
    setSubmittingProfile(true);
    try {
      const { facebook, instagram, twitter, youtube, ...rest } = values;
      const payload = {
        ...rest,
        socialLinks: {
          ...(facebook ? { facebook } : {}),
          ...(instagram ? { instagram } : {}),
          ...(twitter ? { twitter } : {}),
          ...(youtube ? { youtube } : {}),
        },
      };
      if (vendor) {
        await vendorService.updateVendorProfile(vendor.id, payload);
        message.success('Vendor profile updated');
      } else {
        await vendorService.createVendorProfile(payload);
        message.success('Vendor profile created');
      }
      setProfileDirty(false);
      await loadData();
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setSubmittingProfile(false);
    }
  };

  const savePackage = async (values) => {
    setSubmittingPackage(true);
    try {
      const payload = {
        ...values,
        estimationRules: {
          fixed: Number(values.fixed || 0),
          perGuest: Number(values.perGuest || 0),
          perHour: Number(values.perHour || 0),
        },
        deliverables: values.deliverables ? values.deliverables.split(',').map((d) => d.trim()).filter(Boolean) : [],
      };
      if (editingPackage) {
        await packageService.updatePackage(editingPackage.id, payload);
        message.success('Package updated');
      } else {
        await packageService.createPackage(payload);
        message.success('Package added');
      }
      packageForm.resetFields();
      setEditingPackage(null);
      await loadData();
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setSubmittingPackage(false);
    }
  };

  const startEditPackage = (pkg) => {
    setEditingPackage(pkg);
    packageForm.setFieldsValue({
      title: pkg.title,
      description: pkg.description,
      category: pkg.category,
      tier: pkg.tier || 'standard',
      basePrice: pkg.basePrice,
      perGuest: pkg.estimationRules?.perGuest || 0,
      perHour: pkg.estimationRules?.perHour || 0,
      fixed: pkg.estimationRules?.fixed || 0,
      deliverables: Array.isArray(pkg.deliverables) ? pkg.deliverables.join(', ') : '',
    });
  };

  const cancelEditPackage = () => {
    setEditingPackage(null);
    packageForm.resetFields();
  };

  const deletePackage = async (id) => {
    try {
      await packageService.deletePackage(id);
      message.success('Package deleted');
      await loadData();
    } catch (err) {
      message.error(getErrorMessage(err));
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
        {/* Hero */}
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

        {/* LEFT: Profile & Social */}
        <Col xs={24} lg={10}>
          <Card className="phase-card" title={vendor ? 'Update Vendor Profile' : 'Create Vendor Profile'}>
            <Form form={profileForm} layout="vertical" onFinish={upsertProfile} onValuesChange={onProfileValuesChange}>
              <Form.Item name="businessName" label="Business Name" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item name="category" label="Category" rules={[{ required: true }]}>
                <Select options={categories.map((c) => ({ value: c, label: c }))} />
              </Form.Item>
              <Form.Item name="description" label="Detailed Description">
                <Input.TextArea rows={4} />
              </Form.Item>
              <Row gutter={12}>
                <Col span={12}><Form.Item name="city" label="City"><Input /></Form.Item></Col>
                <Col span={12}><Form.Item name="state" label="State"><Input /></Form.Item></Col>
              </Row>
              <Row gutter={12}>
                <Col span={12}><Form.Item name="contactPhone" label="Phone"><Input /></Form.Item></Col>
                <Col span={12}><Form.Item name="contactEmail" label="Email"><Input /></Form.Item></Col>
              </Row>

              <Divider orientation="left" style={{ margin: '8px 0 16px' }}>Social Media Links</Divider>
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item name="facebook" label={<span><FacebookOutlined style={{ color: '#1877F2', marginRight: 6 }} />Facebook</span>}>
                    <Input placeholder="https://facebook.com/..." />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="instagram" label={<span><InstagramOutlined style={{ color: '#E4405F', marginRight: 6 }} />Instagram</span>}>
                    <Input placeholder="https://instagram.com/..." />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item name="twitter" label={<span><TwitterOutlined style={{ color: '#1DA1F2', marginRight: 6 }} />Twitter / X</span>}>
                    <Input placeholder="https://x.com/..." />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="youtube" label={<span><YoutubeOutlined style={{ color: '#FF0000', marginRight: 6 }} />YouTube</span>}>
                    <Input placeholder="https://youtube.com/..." />
                  </Form.Item>
                </Col>
              </Row>

              <Button type="primary" htmlType="submit" loading={submittingProfile} disabled={vendor && !profileDirty}>
                {vendor ? 'Save Profile' : 'Create Profile'}
              </Button>
            </Form>
          </Card>
        </Col>

        {/* RIGHT: Service Packages */}
        <Col xs={24} lg={14}>
          <Card
            className="phase-card"
            title={editingPackage ? `Edit Package: ${editingPackage.title}` : 'Add Service Package'}
            extra={editingPackage ? <Button size="small" onClick={cancelEditPackage}>Cancel Edit</Button> : null}
          >
            <Form form={packageForm} layout="vertical" onFinish={savePackage}>
              <Row gutter={12}>
                <Col xs={24} md={12}>
                  <Form.Item name="title" label="Package Title" rules={[{ required: true }]}><Input /></Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="category" label="Category" rules={[{ required: true }]}><Select options={categories.map((c) => ({ value: c, label: c }))} /></Form.Item>
                </Col>
              </Row>
              <Form.Item name="description" label="Description" rules={[{ required: true }]}><Input.TextArea rows={3} /></Form.Item>
              <Row gutter={8}>
                <Col span={6}><Form.Item name="tier" label="Tier" initialValue="standard"><Input /></Form.Item></Col>
                <Col span={6}><Form.Item name="basePrice" label="Base Price"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
                <Col span={6}><Form.Item name="perGuest" label="Per Guest"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
                <Col span={6}><Form.Item name="perHour" label="Per Hour"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
              </Row>
              <Row gutter={12}>
                <Col span={12}><Form.Item name="fixed" label="Fixed Add-on"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
                <Col span={12}><Form.Item name="deliverables" label="Deliverables (comma-separated)"><Input /></Form.Item></Col>
              </Row>
              <Space>
                <Button type="primary" htmlType="submit" loading={submittingPackage} icon={<PlusOutlined />}>
                  {editingPackage ? 'Update Package' : 'Add Package'}
                </Button>
                {editingPackage ? <Button onClick={cancelEditPackage}>Cancel</Button> : null}
              </Space>
            </Form>
          </Card>

          {/* My Packages Table */}
          <Card className="phase-card phase-table" title="My Packages" style={{ marginTop: 16 }}>
            <Table
              rowKey="id"
              dataSource={packages}
              pagination={false}
              locale={{ emptyText: <div className="phase-empty">No packages yet. Add your first service offering above.</div> }}
              columns={[
                { title: 'Title', dataIndex: 'title' },
                { title: 'Category', dataIndex: 'category' },
                { title: 'Tier', dataIndex: 'tier' },
                { title: 'Base Price', dataIndex: 'basePrice', render: (v) => v != null ? `₹${v}` : '—' },
                { title: 'Status', dataIndex: 'isActive', render: (v) => <Tag color={v ? 'green' : 'default'}>{v ? 'active' : 'inactive'}</Tag> },
                {
                  title: 'Actions',
                  key: 'actions',
                  render: (_, record) => (
                    <Space size="small">
                      <Tooltip title="Edit"><Button size="small" icon={<EditOutlined />} onClick={() => startEditPackage(record)} /></Tooltip>
                      <Tooltip title="Delete"><Button size="small" danger icon={<DeleteOutlined />} onClick={() => deletePackage(record.id)} /></Tooltip>
                    </Space>
                  ),
                },
              ]}
            />
          </Card>
        </Col>

        {/* Testimonial */}
        <Col xs={24} lg={12}>
          <Card className="phase-card" title="Add Testimonial">
            <Form form={testimonialForm} layout="vertical" onFinish={addTestimonial}>
              <Form.Item name="clientName" label="Client Name" rules={[{ required: true }]}><Input /></Form.Item>
              <Form.Item name="content" label="Testimonial" rules={[{ required: true }]}><Input.TextArea rows={3} /></Form.Item>
              <Row gutter={12}>
                <Col span={12}><Form.Item name="rating" label="Rating"><InputNumber min={1} max={5} style={{ width: '100%' }} /></Form.Item></Col>
                <Col span={12}><Form.Item name="source" label="Source"><Input /></Form.Item></Col>
              </Row>
              <Button type="primary" htmlType="submit" loading={submittingTestimonial}>Add Testimonial</Button>
            </Form>
          </Card>
        </Col>

        {/* Portfolio Media */}
        <Col xs={24} lg={12}>
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
