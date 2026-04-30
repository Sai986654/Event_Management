import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Button, Card, Col, Empty, Form, Image, Input, InputNumber, Modal, Row, Select, Space, Tag, Tooltip, Upload, message } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined, ShopOutlined } from '@ant-design/icons';
import { AuthContext } from '../context/AuthContext';
import { vendorService } from '../services/vendorService';
import { packageService } from '../services/packageService';
import { adminService } from '../services/adminService';
import { getErrorMessage, getPaymentRequirement } from '../utils/helpers';
import { paymentService } from '../services/paymentService';
import './PhaseFlows.css';

const FALLBACK_CATEGORIES = ['catering', 'decor', 'photography', 'videography', 'music', 'venue', 'florist', 'transportation', 'other'];
const catLabel = (c) => c ? c.charAt(0).toUpperCase() + c.slice(1) : c;
const DEFAULT_CAT_COLORS = { catering: 'orange', decor: 'purple', photography: 'blue', videography: 'cyan', music: 'magenta', venue: 'green', florist: 'pink', transportation: 'gold', other: 'default' };

// Category-specific pricing fields stored in estimationRules JSON
const CATEGORY_FIELDS = {
  catering: [
    { name: 'perPlate', label: 'Per Plate Cost', prefix: '\u20B9', placeholder: '350' },
    { name: 'extraSweetCost', label: 'Extra Sweet (per item)', prefix: '\u20B9', placeholder: '10' },
    { name: 'extraStarterCost', label: 'Extra Starter (per item)', prefix: '\u20B9', placeholder: '15' },
    { name: 'extraMainCourseCost', label: 'Extra Main Course (per item)', prefix: '\u20B9', placeholder: '20' },
    { name: 'minPlates', label: 'Minimum Plates', placeholder: '100' },
    { name: 'liveCounterCost', label: 'Live Counter Charge', prefix: '\u20B9', placeholder: '5000' },
  ],
  photography: [
    { name: 'perHour', label: 'Per Hour', prefix: '\u20B9', placeholder: '2000' },
    { name: 'extraCameraCost', label: 'Extra Camera/Photographer', prefix: '\u20B9', placeholder: '3000' },
    { name: 'editedPhotos', label: 'Edited Photos Included', placeholder: '500' },
    { name: 'albumCost', label: 'Album Cost', prefix: '\u20B9', placeholder: '5000' },
    { name: 'droneCost', label: 'Drone Coverage', prefix: '\u20B9', placeholder: '8000' },
  ],
  videography: [
    { name: 'perHour', label: 'Per Hour', prefix: '\u20B9', placeholder: '3000' },
    { name: 'extraCameraCost', label: 'Extra Cameraman', prefix: '\u20B9', placeholder: '4000' },
    { name: 'droneCost', label: 'Drone Coverage', prefix: '\u20B9', placeholder: '8000' },
    { name: 'highlightReelCost', label: 'Highlight Reel', prefix: '\u20B9', placeholder: '10000' },
    { name: 'trailerCost', label: 'Wedding Trailer', prefix: '\u20B9', placeholder: '15000' },
  ],
  decor: [
    { name: 'perTable', label: 'Per Table Setup', prefix: '\u20B9', placeholder: '1500' },
    { name: 'stageCost', label: 'Stage Decoration', prefix: '\u20B9', placeholder: '25000' },
    { name: 'entranceCost', label: 'Entrance Decoration', prefix: '\u20B9', placeholder: '10000' },
    { name: 'extraItemCost', label: 'Extra Item / Add-on', prefix: '\u20B9', placeholder: '500' },
    { name: 'lightingCost', label: 'Lighting Package', prefix: '\u20B9', placeholder: '15000' },
  ],
  music: [
    { name: 'perHour', label: 'Per Hour', prefix: '\u20B9', placeholder: '5000' },
    { name: 'soundSystemCost', label: 'Sound System Charge', prefix: '\u20B9', placeholder: '10000' },
    { name: 'extraArtistCost', label: 'Extra Artist / Singer', prefix: '\u20B9', placeholder: '8000' },
    { name: 'djCost', label: 'DJ Setup', prefix: '\u20B9', placeholder: '15000' },
  ],
  venue: [
    { name: 'perDay', label: 'Per Day Rental', prefix: '\u20B9', placeholder: '50000' },
    { name: 'perHour', label: 'Per Hour (if applicable)', prefix: '\u20B9', placeholder: '5000' },
    { name: 'cleaningCharge', label: 'Cleaning Charge', prefix: '\u20B9', placeholder: '3000' },
    { name: 'securityDeposit', label: 'Security Deposit', prefix: '\u20B9', placeholder: '10000' },
    { name: 'acCharge', label: 'AC / Generator Charge', prefix: '\u20B9', placeholder: '8000' },
  ],
  florist: [
    { name: 'perArrangement', label: 'Per Arrangement', prefix: '\u20B9', placeholder: '2000' },
    { name: 'bouquetCost', label: 'Bouquet Cost', prefix: '\u20B9', placeholder: '1500' },
    { name: 'perTableCenterpiece', label: 'Table Centerpiece', prefix: '\u20B9', placeholder: '800' },
    { name: 'carDecorationCost', label: 'Car Decoration', prefix: '\u20B9', placeholder: '3000' },
  ],
  transportation: [
    { name: 'perTrip', label: 'Per Trip', prefix: '\u20B9', placeholder: '2000' },
    { name: 'perKm', label: 'Per Km', prefix: '\u20B9', placeholder: '15' },
    { name: 'waitingChargePerHour', label: 'Waiting Charge / Hr', prefix: '\u20B9', placeholder: '200' },
    { name: 'driverAllowance', label: 'Driver Allowance', prefix: '\u20B9', placeholder: '500' },
  ],
  other: [
    { name: 'perUnit', label: 'Per Unit Cost', prefix: '\u20B9', placeholder: '0' },
    { name: 'perHour', label: 'Per Hour', prefix: '\u20B9', placeholder: '0' },
  ],
};

// Renders category-specific pricing fields
const CategoryPricingFields = ({ category }) => {
  const fields = CATEGORY_FIELDS[category];
  if (!fields || fields.length === 0) return null;
  return (
    <>
      <div style={{ background: '#f0f5ff', padding: '8px 12px', borderRadius: 8, marginBottom: 12, fontSize: 13, color: '#444' }}>
        <strong>{catLabel(category)}</strong> specific pricing (all optional \u2014 fill what applies)
      </div>
      <Row gutter={12}>
        {fields.map((f) => (
          <Col xs={12} md={8} key={f.name}>
            <Form.Item name={['customPricing', f.name]} label={f.label}>
              <InputNumber min={0} style={{ width: '100%' }} placeholder={f.placeholder} prefix={f.prefix} />
            </Form.Item>
          </Col>
        ))}
      </Row>
    </>
  );
};

// Format custom pricing tags for package card display
const renderCustomPricingTags = (rules, category) => {
  const fields = CATEGORY_FIELDS[category] || [];
  const tags = [];
  fields.forEach((f) => {
    const val = rules?.[f.name];
    if (val > 0) {
      tags.push(
        <Tag key={f.name} style={{ marginBottom: 4 }}>
          {f.prefix ? `${f.prefix}${Number(val).toLocaleString('en-IN')}` : val} {f.label.toLowerCase()}
        </Tag>
      );
    }
  });
  return tags.length > 0 ? <div style={{ marginTop: 4 }}>{tags}</div> : null;
};

const VendorWorkspace = () => {
  const { user } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);
  const [vendor, setVendor] = useState(null);
  const [packages, setPackages] = useState([]);
  const [allCategories, setAllCategories] = useState(FALLBACK_CATEGORIES);
  const [catColorMap, setCatColorMap] = useState(DEFAULT_CAT_COLORS);

  // Service modal
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [serviceForm] = Form.useForm();
  const [savingService, setSavingService] = useState(false);
  const [editingService, setEditingService] = useState(null);

  // Package modal
  const [packageModalOpen, setPackageModalOpen] = useState(false);
  const [packageForm] = Form.useForm();
  const [savingPackage, setSavingPackage] = useState(false);
  const [editingPackage, setEditingPackage] = useState(null);
  const [packageTargetCategory, setPackageTargetCategory] = useState(null);

  // Testimonial
  const [testimonialForm] = Form.useForm();
  const [savingTestimonial, setSavingTestimonial] = useState(false);

  // Portfolio
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [mediaCaption, setMediaCaption] = useState('');

  // ---- Data loading ----
  const loadData = async () => {
    setLoading(true);
    try {
      // Load categories
      try {
        const catRes = await adminService.getCategories();
        const cats = catRes.categories || [];
        if (cats.length > 0) {
          setAllCategories(cats.map((c) => c.name));
          const colorMap = {};
          cats.forEach((c) => { colorMap[c.name] = c.color || 'default'; });
          setCatColorMap(colorMap);
        }
      } catch (_) { /* fallback to defaults */ }

      const vendorsRes = await vendorService.searchVendors({ limit: 100 });
      const mine = (vendorsRes.vendors || []).find((v) => v.user?.id === user?.id);
      setVendor(mine || null);
      if (mine) {
        const pkgRes = await packageService.getMyPackages();
        setPackages(pkgRes.packages || []);
      } else {
        setPackages([]);
      }
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadData(); }, []);

  // ---- Services stored in vendor.packages JSON ----
  const services = useMemo(() => {
    const raw = vendor?.packages;
    return Array.isArray(raw) ? raw : [];
  }, [vendor]);

  const usedCategories = useMemo(() => services.map((s) => s.category), [services]);

  const availableCategories = useMemo(
    () => allCategories.filter((c) => !usedCategories.includes(c)),
    [usedCategories, allCategories]
  );

  // Group VendorPackage records by category
  const packagesByCategory = useMemo(() => {
    const map = {};
    packages.forEach((pkg) => {
      const cat = pkg.category || 'other';
      if (!map[cat]) map[cat] = [];
      map[cat].push(pkg);
    });
    return map;
  }, [packages]);

  const statusColor = { approved: 'green', pending: 'orange', rejected: 'red' }[vendor?.verificationStatus] || 'default';

  // ---- Service CRUD ----
  const openAddService = () => {
    setEditingService(null);
    serviceForm.resetFields();
    setServiceModalOpen(true);
  };

  const openEditService = (svc) => {
    setEditingService(svc);
    serviceForm.setFieldsValue({ category: svc.category, serviceDescription: svc.serviceDescription || '' });
    setServiceModalOpen(true);
  };

  const saveService = async (values) => {
    setSavingService(true);
    try {
      let updated;
      if (editingService) {
        updated = services.map((s) =>
          s.category === editingService.category
            ? { ...s, category: values.category, serviceDescription: values.serviceDescription }
            : s
        );
        // If category changed, update all packages under old category
        if (values.category !== editingService.category) {
          const toUpdate = packagesByCategory[editingService.category] || [];
          await Promise.all(
            toUpdate.map((pkg) => packageService.updatePackage(pkg.id, { category: values.category }))
          );
        }
      } else {
        updated = [...services, { category: values.category, serviceDescription: values.serviceDescription, createdAt: new Date().toISOString() }];
      }
      await vendorService.updateVendorProfile(vendor.id, { packages: updated });
      message.success(editingService ? 'Service updated' : 'Service added');
      setServiceModalOpen(false);
      serviceForm.resetFields();
      setEditingService(null);
      await loadData();
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setSavingService(false);
    }
  };

  const deleteService = async (category) => {
    const catPackages = packagesByCategory[category] || [];
    Modal.confirm({
      title: `Delete "${catLabel(category)}" service?`,
      content: catPackages.length > 0
        ? `This will also delete ${catPackages.length} package(s) under this service.`
        : 'This service has no packages.',
      okText: 'Delete',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          // Delete all packages under this service
          await Promise.all(catPackages.map((pkg) => packageService.deletePackage(pkg.id)));
          // Remove service from vendor.packages JSON
          const updated = services.filter((s) => s.category !== category);
          await vendorService.updateVendorProfile(vendor.id, { packages: updated });
          message.success('Service deleted');
          await loadData();
        } catch (err) {
          message.error(getErrorMessage(err));
        }
      },
    });
  };

  // ---- Package CRUD ----
  const openAddPackage = (category) => {
    setEditingPackage(null);
    setPackageTargetCategory(category);
    packageForm.resetFields();
    packageForm.setFieldsValue({ category });
    setPackageModalOpen(true);
  };

  const openEditPackage = (pkg) => {
    setEditingPackage(pkg);
    setPackageTargetCategory(pkg.category);
    const rules = pkg.estimationRules || {};
    const catFields = CATEGORY_FIELDS[pkg.category] || [];
    const customPricing = {};
    catFields.forEach((f) => { if (rules[f.name] != null) customPricing[f.name] = rules[f.name]; });
    packageForm.setFieldsValue({
      title: pkg.title,
      description: pkg.description,
      category: pkg.category,
      tier: pkg.tier || 'standard',
      basePrice: pkg.basePrice,
      deliverables: Array.isArray(pkg.deliverables) ? pkg.deliverables.join(', ') : '',
      customPricing,
    });
    setPackageModalOpen(true);
  };

  const savePackage = async (values) => {
    setSavingPackage(true);
    try {
      // Build estimationRules from category-specific custom pricing
      const customPricing = values.customPricing || {};
      const estimationRules = {};
      Object.entries(customPricing).forEach(([k, v]) => { if (v != null && v > 0) estimationRules[k] = Number(v); });
      const { customPricing: _cp, ...rest } = values;
      const payload = {
        ...rest,
        basePrice: Number(values.basePrice || 0),
        estimationRules,
        deliverables: values.deliverables ? values.deliverables.split(',').map((d) => d.trim()).filter(Boolean) : [],
      };
      if (editingPackage) {
        await packageService.updatePackage(editingPackage.id, payload);
        message.success('Package updated');
      } else {
        await packageService.createPackage(payload);
        message.success('Package added');
      }
      setPackageModalOpen(false);
      packageForm.resetFields();
      setEditingPackage(null);
      await loadData();
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setSavingPackage(false);
    }
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

  // ---- Testimonials ----
  const addTestimonial = async (values) => {
    setSavingTestimonial(true);
    try {
      await packageService.addTestimonial(values);
      testimonialForm.resetFields();
      message.success('Testimonial added');
      await loadData();
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setSavingTestimonial(false);
    }
  };

  // ---- Portfolio media ----
  const handlePortfolioUpload = async ({ file, onSuccess, onError }, hasRetriedAfterPayment = false) => {
    if (!vendor?.id) { message.warning('Create your business profile first.'); return; }
    setUploadingMedia(true);
    try {
      await vendorService.uploadVendorMedia(vendor.id, file, mediaCaption);
      message.success('Portfolio media uploaded.');
      setMediaCaption('');
      await loadData();
      if (typeof onSuccess === 'function') onSuccess('ok');
    } catch (err) {
      const paymentRequirement = getPaymentRequirement(err);
      if (paymentRequirement && !hasRetriedAfterPayment) {
        try {
          await paymentService.checkoutForEntity({
            entityType: paymentRequirement.entityType,
            entityId: paymentRequirement.entityId,
            amount: paymentRequirement.config?.amount,
            description: `Vendor portfolio #${paymentRequirement.entityId} media upload`,
          });
          await handlePortfolioUpload({ file, onSuccess, onError }, true);
          return;
        } catch (paymentError) {
          message.error(getErrorMessage(paymentError));
          if (typeof onError === 'function') onError(paymentError);
          return;
        }
      }
      message.error(getErrorMessage(err));
      if (typeof onError === 'function') onError(err);
    } finally {
      setUploadingMedia(false);
    }
  };

  const portfolioItems = Array.isArray(vendor?.portfolio) ? vendor.portfolio : [];

  // ---- No vendor profile yet ----
  if (!vendor && !loading) {
    return (
      <div className="phase-page">
        <Card className="phase-hero" style={{ textAlign: 'center' }}>
          <h1 className="phase-title">Vendor Workspace</h1>
          <p className="phase-subtitle" style={{ marginBottom: 16 }}>
            You need a business profile first. Click the profile icon (top right) â†’ <strong>My Profile</strong> to create one.
          </p>
          <Button type="primary" onClick={() => (window.location.href = '/profile')}>Go to My Profile</Button>
        </Card>
      </div>
    );
  }

  // ---- Main render ----
  return (
    <div className="phase-page">
      <Row gutter={[20, 20]} className="phase-stack">
        {/* Hero */}
        <Col span={24}>
          <Card loading={loading} className="phase-hero">
            <Row justify="space-between" align="middle" wrap>
              <Space direction="vertical" size={4}>
                <h1 className="phase-title" style={{ margin: 0 }}>Vendor Workspace</h1>
                <p className="phase-subtitle" style={{ margin: 0 }}>
                  Manage your services, packages, portfolio, and testimonials.
                </p>
              </Space>
              <Space wrap>
                <Tag color={statusColor}>{vendor?.verificationStatus || 'pending'}</Tag>
                {vendor?.isVerified ? <Tag color="green">Verified</Tag> : null}
                <Tag>{vendor?.businessName}</Tag>
              </Space>
            </Row>
          </Card>
        </Col>

        {/* Add New Service button */}
        <Col span={24}>
          <Button
            type="primary"
            size="large"
            icon={<PlusOutlined />}
            onClick={openAddService}
            disabled={availableCategories.length === 0}
            block
            style={{ borderRadius: 8, fontWeight: 600, height: 48, fontSize: 16 }}
          >
            + Add a New Service
          </Button>
          {availableCategories.length === 0 && (
            <p style={{ textAlign: 'center', color: '#999', marginTop: 8, fontSize: 13 }}>You've added services in all available categories.</p>
          )}
        </Col>

        {/* Service cards */}
        {services.length === 0 ? (
          <Col span={24}>
            <Card className="phase-card">
              <Empty description="No services yet. Click the button above to add your first service." />
            </Card>
          </Col>
        ) : (
          services.map((svc) => {
            const cat = svc.category;
            const catPkgs = packagesByCategory[cat] || [];
            return (
              <Col span={24} key={cat}>
                <Card
                  className="phase-card"
                  title={
                    <Space>
                      <ShopOutlined />
                      <Tag color={catColorMap[cat] || 'default'} style={{ fontSize: 14, padding: '2px 12px' }}>{catLabel(cat)}</Tag>
                      <span style={{ fontWeight: 400, color: '#666' }}>â€” {catPkgs.length} {catPkgs.length === 1 ? 'package' : 'packages'}</span>
                    </Space>
                  }
                  extra={
                    <Space>
                      <Tooltip title="Edit service details"><Button size="small" icon={<EditOutlined />} onClick={() => openEditService(svc)} /></Tooltip>
                      <Tooltip title="Delete service"><Button size="small" danger icon={<DeleteOutlined />} onClick={() => deleteService(cat)} /></Tooltip>
                    </Space>
                  }
                >
                  {/* Service description */}
                  {svc.serviceDescription && (
                    <div style={{ padding: '12px 16px', background: '#f8f9fb', borderRadius: 8, marginBottom: 16, lineHeight: 1.6, color: '#444' }}>
                      {svc.serviceDescription}
                    </div>
                  )}

                  {/* Packages under this service */}
                  {catPkgs.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '16px 0', color: '#999' }}>
                      No packages yet for this service.
                    </div>
                  ) : (
                    <Row gutter={[16, 16]}>
                      {catPkgs.map((pkg) => (
                        <Col xs={24} md={12} lg={8} key={pkg.id}>
                          <Card
                            size="small"
                            style={{ borderRadius: 8, height: '100%' }}
                            title={<span style={{ fontWeight: 600 }}>{pkg.title}</span>}
                            extra={<Tag>{pkg.tier || 'standard'}</Tag>}
                            actions={[
                              <Tooltip title="Edit" key="edit"><EditOutlined onClick={() => openEditPackage(pkg)} /></Tooltip>,
                              <Tooltip title="Delete" key="del"><DeleteOutlined style={{ color: '#ff4d4f' }} onClick={() => deletePackage(pkg.id)} /></Tooltip>,
                            ]}
                          >
                            <p style={{ fontSize: 13, color: '#555', minHeight: 40, marginBottom: 8 }}>
                              {pkg.description?.length > 120 ? pkg.description.slice(0, 120) + '...' : pkg.description}
                            </p>
                            <div style={{ fontSize: 20, fontWeight: 700, color: '#333', marginBottom: 4 }}>
                              \u20B9{Number(pkg.basePrice || 0).toLocaleString('en-IN')}
                            </div>
                            {renderCustomPricingTags(pkg.estimationRules, pkg.category)}
                            {Array.isArray(pkg.deliverables) && pkg.deliverables.length > 0 && (
                              <div style={{ marginTop: 8 }}>
                                {pkg.deliverables.slice(0, 3).map((d, i) => (
                                  <Tag key={i} style={{ marginBottom: 4, fontSize: 11 }}>{d}</Tag>
                                ))}
                                {pkg.deliverables.length > 3 && <Tag>+{pkg.deliverables.length - 3} more</Tag>}
                              </div>
                            )}
                            <div style={{ marginTop: 8 }}>
                              <Tag color={pkg.isActive ? 'green' : 'default'}>{pkg.isActive ? 'Active' : 'Inactive'}</Tag>
                            </div>
                          </Card>
                        </Col>
                      ))}
                    </Row>
                  )}

                  {/* Add package button for this service */}
                  <div style={{ marginTop: 16, textAlign: 'center' }}>
                    <Button type="dashed" icon={<PlusOutlined />} onClick={() => openAddPackage(cat)} style={{ borderRadius: 8 }}>
                      Add Package to {catLabel(cat)}
                    </Button>
                  </div>
                </Card>
              </Col>
            );
          })
        )}

        {/* Testimonial + Portfolio */}
        <Col xs={24} lg={12}>
          <Card className="phase-card" title="Add Testimonial">
            <Form form={testimonialForm} layout="vertical" onFinish={addTestimonial}>
              <Form.Item name="clientName" label="Client Name" rules={[{ required: true }]}><Input /></Form.Item>
              <Form.Item name="content" label="Testimonial" rules={[{ required: true }]}><Input.TextArea rows={3} /></Form.Item>
              <Row gutter={12}>
                <Col span={12}><Form.Item name="rating" label="Rating"><InputNumber min={1} max={5} style={{ width: '100%' }} /></Form.Item></Col>
                <Col span={12}><Form.Item name="source" label="Source"><Input placeholder="e.g. Google, WhatsApp" /></Form.Item></Col>
              </Row>
              <Button type="primary" htmlType="submit" loading={savingTestimonial}>Add Testimonial</Button>
            </Form>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card className="phase-card" title="Portfolio Media">
            <Row gutter={[16, 16]} align="middle">
              <Col xs={24} md={16}>
                <Input placeholder="Optional caption for this media" value={mediaCaption} onChange={(e) => setMediaCaption(e.target.value)} />
              </Col>
              <Col xs={24} md={8}>
                <Upload accept="image/*,video/*" showUploadList={false} customRequest={handlePortfolioUpload} disabled={uploadingMedia}>
                  <Button type="primary" icon={<PlusOutlined />} loading={uploadingMedia} block>Upload media</Button>
                </Upload>
              </Col>
            </Row>
            <div className="vendor-portfolio-grid">
              {portfolioItems.length === 0 ? (
                <div className="phase-empty" style={{ marginTop: 16 }}>No portfolio media yet.</div>
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
          </Card>
        </Col>
      </Row>

      {/* ===== Add/Edit Service Modal ===== */}
      <Modal
        title={editingService ? `Edit Service: ${catLabel(editingService.category)}` : 'Add a New Service'}
        open={serviceModalOpen}
        onCancel={() => { setServiceModalOpen(false); setEditingService(null); serviceForm.resetFields(); }}
        footer={null}
        destroyOnClose
      >
        <p style={{ color: '#666', marginBottom: 16 }}>
          {editingService
            ? 'Update your service details below.'
            : 'Choose a service category and describe what you offer. You can add packages under it afterwards.'}
        </p>
        <Form form={serviceForm} layout="vertical" onFinish={saveService}>
          <Form.Item name="category" label="Service Category" rules={[{ required: true, message: 'Select a category' }]}>
            <Select
              placeholder="e.g. Photography"
              disabled={!!editingService}
              options={(editingService ? allCategories : availableCategories).map((c) => ({ value: c, label: catLabel(c) }))}
            />
          </Form.Item>
          <Form.Item name="serviceDescription" label="Describe This Service" rules={[{ required: true, message: 'Describe your service' }]}>
            <Input.TextArea rows={5} placeholder="What does your service include? What makes it special? Experience, equipment, team size, coverage areas..." />
          </Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={savingService}>
              {editingService ? 'Update Service' : 'Add Service'}
            </Button>
            <Button onClick={() => { setServiceModalOpen(false); setEditingService(null); }}>Cancel</Button>
          </Space>
        </Form>
      </Modal>

      {/* ===== Add/Edit Package Modal ===== */}
      <Modal
        title={editingPackage ? `Edit Package: ${editingPackage.title}` : `Add Package to ${catLabel(packageTargetCategory)}`}
        open={packageModalOpen}
        onCancel={() => { setPackageModalOpen(false); setEditingPackage(null); packageForm.resetFields(); }}
        footer={null}
        width={640}
        destroyOnClose
      >
        <Form form={packageForm} layout="vertical" onFinish={savePackage}>
          <Form.Item name="category" hidden><Input /></Form.Item>
          <Row gutter={16}>
            <Col span={16}>
              <Form.Item name="title" label="Package Title" rules={[{ required: true }]}>
                <Input placeholder="e.g. Wedding Premium Package" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="tier" label="Tier" initialValue="standard">
                <Select options={[
                  { value: 'basic', label: 'Basic' },
                  { value: 'standard', label: 'Standard' },
                  { value: 'premium', label: 'Premium' },
                  { value: 'luxury', label: 'Luxury' },
                ]} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="Package Description" rules={[{ required: true }]}>
            <Input.TextArea rows={3} placeholder="What's included in this package..." />
          </Form.Item>
          <Form.Item name="basePrice" label="Base Price (\u20B9)" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} placeholder="e.g. 50000" />
          </Form.Item>

          {/* Category-specific pricing */}
          <CategoryPricingFields category={packageTargetCategory} />

          <Form.Item name="deliverables" label="Deliverables (comma-separated)">
            <Input placeholder="e.g. 500 photos, 1 highlight reel, drone coverage" />
          </Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={savingPackage}>
              {editingPackage ? 'Update Package' : 'Add Package'}
            </Button>
            <Button onClick={() => { setPackageModalOpen(false); setEditingPackage(null); }}>Cancel</Button>
          </Space>
        </Form>
      </Modal>
    </div>
  );
};

export default VendorWorkspace;
