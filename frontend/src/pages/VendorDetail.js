import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card, Row, Col, Button, Spin, message, Rate, Tag, Divider, List, Modal,
  Form, Select, DatePicker, InputNumber, Input, Badge, Empty, Image, Space, Typography,
} from 'antd';
import {
  ShopOutlined, EnvironmentOutlined, PhoneOutlined, MailOutlined,
  GlobalOutlined, CheckCircleOutlined, ArrowLeftOutlined,
} from '@ant-design/icons';
import { vendorService } from '../services/vendorService';
import { bookingService } from '../services/bookingService';
import { eventService } from '../services/eventService';
import { aiService } from '../services/aiService';
import { paymentService } from '../services/paymentService';
import { AuthContext } from '../context/AuthContext';
import { formatCurrency, getErrorMessage, getPaymentRequirement } from '../utils/helpers';
import './VendorDetail.css';

const { Text } = Typography;

const CORE_RULE_KEYS = new Set(['fixed', 'perGuest', 'perPlate', 'perHour', 'minPlates']);

const toRuleLabel = (key) =>
  String(key || '')
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^./, (s) => s.toUpperCase())
    .trim();

const getAddonKeys = (rules = {}) =>
  Object.entries(rules)
    .filter(([k, v]) => !CORE_RULE_KEYS.has(k) && Number(v) > 0)
    .map(([k]) => k);

const estimatePackagePrice = (pkg, criteria = {}) => {
  if (!pkg) return 0;
  const rules = pkg.estimationRules || {};
  const base = Number(pkg.basePrice ?? pkg.price ?? 0);
  const fixed = Number(rules.fixed || 0);
  const perGuest = Number(rules.perGuest || rules.perPlate || 0);
  const perHour = Number(rules.perHour || 0);
  const minGuests = Number(rules.minPlates || 0);
  const guestsInput = Number(criteria.guests || 0);
  const guests = guestsInput > 0 ? Math.max(guestsInput, minGuests) : 0;
  const hours = Number(criteria.hours || 0);
  const addons = criteria.addons || {};
  const addonTotal = Object.entries(addons).reduce((sum, [key, qtyRaw]) => {
    const rate = Number(rules[key] || 0);
    const qty = Number(qtyRaw || 0);
    if (rate <= 0 || qty <= 0) return sum;
    return sum + rate * qty;
  }, 0);
  return Math.max(0, Math.round((base + fixed + guests * perGuest + hours * perHour + addonTotal) * 100) / 100);
};

const getPricingBreakdown = (pkg, criteria = {}) => {
  if (!pkg) return null;
  const rules = pkg.estimationRules || {};
  const base = Number(pkg.basePrice ?? pkg.price ?? 0);
  const fixed = Number(rules.fixed || 0);

  const perGuestRate = Number(rules.perGuest || rules.perPlate || 0);
  const minGuests = Number(rules.minPlates || 0);
  const guestsInput = Number(criteria.guests || 0);
  const billableGuests = guestsInput > 0 ? Math.max(guestsInput, minGuests) : 0;
  const guestCharge = perGuestRate * billableGuests;

  const perHourRate = Number(rules.perHour || 0);
  const hours = Number(criteria.hours || 0);
  const hourCharge = perHourRate * hours;

  const addons = criteria.addons || {};
  const addonLines = Object.entries(addons)
    .map(([key, qtyRaw]) => {
      const rate = Number(rules[key] || 0);
      const qty = Number(qtyRaw || 0);
      if (rate <= 0 || qty <= 0) return null;
      return {
        key,
        label: toRuleLabel(key),
        qty,
        rate,
        lineTotal: rate * qty,
      };
    })
    .filter(Boolean);

  const addOnTotal = addonLines.reduce((sum, item) => sum + item.lineTotal, 0);
  const total = Math.max(0, Math.round((base + fixed + guestCharge + hourCharge + addOnTotal) * 100) / 100);

  return {
    base,
    fixed,
    perGuestRate,
    guestsInput,
    billableGuests,
    minGuests,
    guestCharge,
    perHourRate,
    hours,
    hourCharge,
    addonLines,
    addOnTotal,
    total,
  };
};

const VendorDetail = () => {
  const { vendorId } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const [vendor, setVendor] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [bookingVisible, setBookingVisible] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [userEvents, setUserEvents] = useState([]);
  const [bookingForm] = Form.useForm();
  const [bookingCriteria, setBookingCriteria] = useState({ guests: 0, hours: 0, addons: {} });
  const [calculatedPrice, setCalculatedPrice] = useState(0);
  const [reviewSummary, setReviewSummary] = useState(null);
  const [loadingReviewSummary, setLoadingReviewSummary] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [vendorRes, reviewsRes] = await Promise.all([
          vendorService.getVendorById(vendorId),
          vendorService.getVendorReviews(vendorId).catch(() => ({ reviews: [] })),
        ]);
        setVendor(vendorRes.vendor);
        setReviews(reviewsRes.reviews || []);
      } catch (error) {
        message.error(getErrorMessage(error));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [vendorId]);

  useEffect(() => {
    if (!selectedPackage) return;
    const next = estimatePackagePrice(selectedPackage, bookingCriteria);
    setCalculatedPrice(next);
    bookingForm.setFieldsValue({ price: next });
  }, [selectedPackage, bookingCriteria, bookingForm]);

  const loadReviewSummary = async () => {
    setLoadingReviewSummary(true);
    try {
      const res = await aiService.getVendorReviewSummary(vendorId);
      setReviewSummary(res);
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setLoadingReviewSummary(false);
    }
  };

  const updateBookingCriteria = (field, value) => {
    setBookingCriteria((prev) => ({ ...prev, [field]: value || 0 }));
  };

  const updateBookingAddonQty = (key, value) => {
    setBookingCriteria((prev) => ({
      ...prev,
      addons: {
        ...(prev.addons || {}),
        [key]: value || 0,
      },
    }));
  };

  const openBookingModal = async (pkg) => {
    if (!user) {
      message.info('Please log in to book a vendor');
      navigate('/login');
      return;
    }
    setSelectedPackage(pkg);
    bookingForm.resetFields();
    const rules = pkg?.estimationRules || {};
    const initCriteria = {
      guests: Number(rules.perGuest || rules.perPlate || 0) > 0 ? 50 : 0,
      hours: Number(rules.perHour || 0) > 0 ? 4 : 0,
      addons: {},
    };
    setBookingCriteria(initCriteria);
    const initialPrice = pkg ? estimatePackagePrice(pkg, initCriteria) : Number(vendor.basePrice) || 0;
    setCalculatedPrice(initialPrice);
    bookingForm.setFieldsValue({ price: initialPrice });
    try {
      const data = await eventService.getEvents({ limit: 100 });
      setUserEvents(data.events || []);
    } catch (error) {
      message.error(getErrorMessage(error));
    }
    setBookingVisible(true);
  };

  const handleBookVendor = async (values) => {
    let bookingPrice = selectedPackage ? calculatedPrice : values.price;
    try {
      setBookingLoading(true);
      const addonSummary = Object.entries(bookingCriteria.addons || {})
        .filter(([, qty]) => Number(qty || 0) > 0)
        .map(([key, qty]) => `${toRuleLabel(key)} x ${qty}`)
        .join(', ');
      await bookingService.createBooking({
        event: values.event,
        vendor: Number(vendorId),
        price: bookingPrice,
        serviceDate: values.serviceDate.toISOString(),
        notes: selectedPackage
          ? `Package: ${selectedPackage.title || selectedPackage.name}${bookingCriteria.guests ? ` | Guests: ${bookingCriteria.guests}` : ''}${bookingCriteria.hours ? ` | Hours: ${bookingCriteria.hours}` : ''}${addonSummary ? ` | Add-ons: ${addonSummary}` : ''}${values.notes ? `\n${values.notes}` : ''}`
          : values.notes,
      });
      message.success('Booking created successfully! The vendor will confirm shortly.');
      setBookingVisible(false);
      bookingForm.resetFields();
    } catch (error) {
      const paymentRequirement = getPaymentRequirement(error);
      if (paymentRequirement) {
        try {
          await paymentService.checkoutForEntity({
            entityType: paymentRequirement.entityType,
            entityId: paymentRequirement.entityId,
            amount: Number(paymentRequirement.config?.amount || bookingPrice || 0),
            description: `Booking #${paymentRequirement.entityId} confirmation`,
          });

          await bookingService.updateBookingStatus(paymentRequirement.entityId, 'confirmed');
          message.success('Booking created and payment completed successfully.');
          setBookingVisible(false);
          bookingForm.resetFields();
          return;
        } catch (paymentError) {
          message.error(getErrorMessage(paymentError));
          return;
        }
      }
      message.error(getErrorMessage(error));
    } finally {
      setBookingLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 'calc(100vh - 128px)' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!vendor) {
    return <Empty description="Vendor not found" />;
  }

  const packages = Array.isArray(vendor.packageCatalog)
    ? vendor.packageCatalog
    : Array.isArray(vendor.packages)
      ? vendor.packages
      : [];
  const pricingBreakdown = selectedPackage ? getPricingBreakdown(selectedPackage, bookingCriteria) : null;
  const portfolioItems = Array.isArray(vendor.portfolio) ? vendor.portfolio : [];

  return (
    <div className="vendor-detail-container">
      {/* Back Navigation */}
      <Button
        type="text"
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate('/vendors')}
        style={{ marginBottom: 16 }}
      >
        Back to Marketplace
      </Button>

      {/* Vendor Header */}
      <Card className="vendor-header-card">
        <Row gutter={[24, 24]} align="middle">
          <Col xs={24} md={16}>
            <div className="vendor-header-info">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <ShopOutlined style={{ fontSize: 32, color: '#667eea' }} />
                <h1 style={{ margin: 0 }}>{vendor.businessName}</h1>
                {vendor.isVerified && (
                  <Tag icon={<CheckCircleOutlined />} color="success">Verified</Tag>
                )}
              </div>
              <Tag color="blue" style={{ marginBottom: 12 }}>{vendor.category}</Tag>
              <p className="vendor-description">{vendor.description}</p>
              <div className="vendor-meta">
                {vendor.city && (
                  <span><EnvironmentOutlined /> {vendor.city}{vendor.state ? `, ${vendor.state}` : ''}</span>
                )}
                {vendor.contactPhone && <span><PhoneOutlined /> {vendor.contactPhone}</span>}
                {vendor.contactEmail && <span><MailOutlined /> {vendor.contactEmail}</span>}
                {vendor.website && (
                  <span>
                    <GlobalOutlined />{' '}
                    <a href={vendor.website} target="_blank" rel="noopener noreferrer">{vendor.website}</a>
                  </span>
                )}
              </div>
            </div>
          </Col>
          <Col xs={24} md={8}>
            <Card className="vendor-rating-card">
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 36, fontWeight: 'bold', color: '#667eea' }}>
                  {Number(vendor.averageRating).toFixed(1)}
                </div>
                <Rate disabled value={Number(vendor.averageRating)} allowHalf />
                <p style={{ color: '#888', margin: '4px 0 16px' }}>{vendor.totalReviews} reviews</p>
                <div style={{ fontSize: 18, fontWeight: 600 }}>
                  Starting at {formatCurrency(vendor.basePrice)}
                </div>
                <p style={{ color: '#888', margin: 0 }}>{vendor.priceType} pricing</p>
              </div>
            </Card>
          </Col>
        </Row>
      </Card>

      {/* Packages Section */}
      <Divider orientation="left"><h2 style={{ margin: 0 }}>Service Packages</h2></Divider>

      {packages.length === 0 ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '24px' }}>
            <p>This vendor offers custom pricing. Contact them for a quote.</p>
            <p style={{ fontSize: 24, fontWeight: 'bold' }}>Base Price: {formatCurrency(vendor.basePrice)}</p>
            <Button type="primary" size="large" onClick={() => openBookingModal(null)}>
              Request Booking
            </Button>
          </div>
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {packages.map((pkg, idx) => (
            <Col xs={24} sm={12} md={8} key={pkg.id || idx}>
              <Card
                className={`package-card ${idx === 1 ? 'package-featured' : ''}`}
                title={
                  <div style={{ textAlign: 'center' }}>
                    {idx === 1 && <Badge.Ribbon text="Most Popular" color="#667eea" />}
                    <h3 style={{ margin: 0 }}>{pkg.title || pkg.name}</h3>
                  </div>
                }
              >
                <div className="package-content">
                  <div className="package-price">
                    <span className="price-amount">{formatCurrency(pkg.basePrice ?? pkg.price ?? 0)}</span>
                    {(pkg.unitLabel || pkg.priceType) && <span className="price-type"> / {pkg.unitLabel || pkg.priceType}</span>}
                  </div>
                  <p className="package-description">{pkg.description}</p>
                  <Divider />
                  <ul className="package-includes">
                    {(pkg.deliverables || pkg.includes || []).map((item, i) => (
                      <li key={i}>
                        <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />
                        {typeof item === 'string' ? item : item.item || item.name || JSON.stringify(item)}
                      </li>
                    ))}
                  </ul>
                  <Button
                    type={idx === 1 ? 'primary' : 'default'}
                    size="large"
                    block
                    onClick={() => openBookingModal(pkg)}
                    style={{ marginTop: 16 }}
                  >
                    Select Package
                  </Button>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* Portfolio Section */}
      <Divider orientation="left"><h2 style={{ margin: 0 }}>Portfolio</h2></Divider>
      <Card>
        {portfolioItems.length === 0 ? (
          <Empty description="No portfolio uploads yet" />
        ) : (
          <div className="vendor-portfolio-grid">
            {portfolioItems.map((item) => (
              <div className="vendor-portfolio-item" key={item.id || item.url}>
                {item.type === 'video' ? (
                  <video className="vendor-portfolio-video" controls src={item.url} />
                ) : (
                  <Image src={item.url} alt={item.caption || 'portfolio'} className="vendor-portfolio-image" />
                )}
                {item.caption ? <p>{item.caption}</p> : null}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* AI Review Summary */}
      {reviews.length >= 2 && (
        <>
          <Divider orientation="left"><h2 style={{ margin: 0 }}>AI Review Summary</h2></Divider>
          <Card>
            {!reviewSummary ? (
              <div style={{ textAlign: 'center', padding: 16 }}>
                <p>Get an instant AI-powered summary of all reviews for this vendor.</p>
                <Button type="primary" onClick={loadReviewSummary} loading={loadingReviewSummary}>
                  Summarize Reviews with AI
                </Button>
              </div>
            ) : (
              <div>
                <Tag color={reviewSummary.source === 'groq' || reviewSummary.source === 'openai' ? 'purple' : 'default'} style={{ marginBottom: 12 }}>
                  {reviewSummary.source === 'groq' ? 'Groq AI' : reviewSummary.source === 'openai' ? 'OpenAI' : 'Rule-based'}
                </Tag>
                <p>{reviewSummary.summary}</p>
                {reviewSummary.strengths?.length ? (
                  <><strong>Strengths:</strong><ul>{reviewSummary.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul></>
                ) : null}
                {reviewSummary.watchOuts?.length ? (
                  <><strong>Watch out for:</strong><ul>{reviewSummary.watchOuts.map((s, i) => <li key={i}>{s}</li>)}</ul></>
                ) : null}
                {reviewSummary.bestFor ? (
                  <p><strong>Best for:</strong> {reviewSummary.bestFor}</p>
                ) : null}
              </div>
            )}
          </Card>
        </>
      )}

      {/* Reviews Section */}
      <Divider orientation="left"><h2 style={{ margin: 0 }}>Reviews</h2></Divider>

      <Card>
        {reviews.length === 0 ? (
          <Empty description="No reviews yet" />
        ) : (
          <List
            dataSource={reviews}
            renderItem={(review) => (
              <List.Item>
                <List.Item.Meta
                  title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>{review.user?.name || 'Anonymous'}</span>
                      <Rate disabled value={review.rating} style={{ fontSize: 14 }} />
                    </div>
                  }
                  description={review.comment || 'No comment'}
                />
              </List.Item>
            )}
          />
        )}
      </Card>

      {/* Booking Modal */}
      <Modal
        title={`Book ${vendor.businessName}${selectedPackage ? ` — ${selectedPackage.title || selectedPackage.name}` : ''}`}
        open={bookingVisible}
        onCancel={() => setBookingVisible(false)}
        footer={null}
        width={500}
      >
        <Form form={bookingForm} layout="vertical" onFinish={handleBookVendor}>
          <Form.Item
            name="event"
            label="Select Your Event"
            rules={[{ required: true, message: 'Please select an event' }]}
          >
            <Select
              placeholder="Choose an event to book this vendor for"
              options={userEvents.map((evt) => ({
                label: `${evt.title} — ${new Date(evt.date).toLocaleDateString('en-IN')}`,
                value: evt.id,
              }))}
            />
          </Form.Item>
          {userEvents.length === 0 && (
            <p style={{ color: '#ff4d4f', marginTop: -16 }}>
              You don't have any events yet.{' '}
              <Button type="link" style={{ padding: 0 }} onClick={() => navigate('/events/create')}>
                Create one first
              </Button>
            </p>
          )}
          <Form.Item
            name="serviceDate"
            label="Service Date"
            rules={[{ required: true, message: 'Please select the service date' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          {selectedPackage ? (
            <Card size="small" style={{ marginBottom: 16, background: '#fafcff', borderColor: '#dbe7ff' }}>
              <Space direction="vertical" size={10} style={{ width: '100%' }}>
                <Text strong>Customize Package Items</Text>
                <Text type="secondary">Change quantities below and final price updates instantly.</Text>

                {Number(selectedPackage?.estimationRules?.perGuest || selectedPackage?.estimationRules?.perPlate || 0) > 0 ? (
                  <Row align="middle" justify="space-between" gutter={10}>
                    <Col flex="auto">
                      <Text>Guests / Plates</Text>
                    </Col>
                    <Col>
                      <InputNumber
                        min={0}
                        value={bookingCriteria.guests}
                        onChange={(v) => updateBookingCriteria('guests', v)}
                      />
                    </Col>
                  </Row>
                ) : null}

                {Number(selectedPackage?.estimationRules?.perHour || 0) > 0 ? (
                  <Row align="middle" justify="space-between" gutter={10}>
                    <Col flex="auto">
                      <Text>Hours</Text>
                    </Col>
                    <Col>
                      <InputNumber
                        min={0}
                        value={bookingCriteria.hours}
                        onChange={(v) => updateBookingCriteria('hours', v)}
                      />
                    </Col>
                  </Row>
                ) : null}

                {getAddonKeys(selectedPackage?.estimationRules || {}).map((key) => {
                  const rate = Number(selectedPackage?.estimationRules?.[key] || 0);
                  const qty = Number(bookingCriteria.addons?.[key] || 0);
                  return (
                    <Row key={key} align="middle" justify="space-between" gutter={10}>
                      <Col flex="auto">
                        <Text>{toRuleLabel(key)}</Text>
                        <div><Text type="secondary">{formatCurrency(rate)} each</Text></div>
                      </Col>
                      <Col>
                        <InputNumber
                          min={0}
                          value={qty}
                          onChange={(v) => updateBookingAddonQty(key, v)}
                        />
                      </Col>
                    </Row>
                  );
                })}

                {pricingBreakdown ? (
                  <Card size="small" style={{ background: '#fff', borderColor: '#e6eefc', marginTop: 8 }}>
                    <Space direction="vertical" size={6} style={{ width: '100%' }}>
                      <Text strong>Selected Add-ons and Cost Breakdown</Text>

                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Text>Base Price</Text>
                        <Text>{formatCurrency(pricingBreakdown.base)}</Text>
                      </div>

                      {pricingBreakdown.fixed > 0 ? (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Text>Fixed Charges</Text>
                          <Text>{formatCurrency(pricingBreakdown.fixed)}</Text>
                        </div>
                      ) : null}

                      {pricingBreakdown.perGuestRate > 0 ? (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Text>
                            Guests/Plates: {pricingBreakdown.billableGuests} x {formatCurrency(pricingBreakdown.perGuestRate)}
                          </Text>
                          <Text>{formatCurrency(pricingBreakdown.guestCharge)}</Text>
                        </div>
                      ) : null}

                      {pricingBreakdown.perGuestRate > 0 && pricingBreakdown.minGuests > 0 && pricingBreakdown.guestsInput > 0 && pricingBreakdown.billableGuests > pricingBreakdown.guestsInput ? (
                        <Text type="secondary">Minimum applied: {pricingBreakdown.minGuests} guests/plates</Text>
                      ) : null}

                      {pricingBreakdown.perHourRate > 0 ? (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Text>
                            Hours: {pricingBreakdown.hours} x {formatCurrency(pricingBreakdown.perHourRate)}
                          </Text>
                          <Text>{formatCurrency(pricingBreakdown.hourCharge)}</Text>
                        </div>
                      ) : null}

                      {pricingBreakdown.addonLines.length > 0 ? (
                        <>
                          <Divider style={{ margin: '4px 0' }} />
                          {pricingBreakdown.addonLines.map((line) => (
                            <div key={line.key} style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Text>{line.label}: {line.qty} x {formatCurrency(line.rate)}</Text>
                              <Text>{formatCurrency(line.lineTotal)}</Text>
                            </div>
                          ))}
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Text strong>Add-ons Subtotal</Text>
                            <Text strong>{formatCurrency(pricingBreakdown.addOnTotal)}</Text>
                          </div>
                        </>
                      ) : (
                        <Text type="secondary">No add-ons selected</Text>
                      )}

                      <Divider style={{ margin: '4px 0' }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Text strong>Final Total</Text>
                        <Text strong>{formatCurrency(pricingBreakdown.total)}</Text>
                      </div>
                    </Space>
                  </Card>
                ) : null}
              </Space>
            </Card>
          ) : null}
          <Form.Item
            name="price"
            label={selectedPackage ? 'Final Price (INR ₹)' : 'Agreed Price (INR ₹)'}
            rules={[{ required: true, message: 'Please enter the price' }]}
          >
            <InputNumber min={0} style={{ width: '100%' }} disabled={Boolean(selectedPackage)} />
          </Form.Item>
          <Form.Item name="notes" label="Special Requirements">
            <Input.TextArea rows={3} placeholder="Any special requirements or notes..." />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={bookingLoading} block size="large">
              Confirm Booking
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default VendorDetail;
