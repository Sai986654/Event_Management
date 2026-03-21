import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card, Row, Col, Button, Spin, message, Rate, Tag, Divider, List, Modal,
  Form, Select, DatePicker, InputNumber, Input, Badge, Empty,
} from 'antd';
import {
  ShopOutlined, EnvironmentOutlined, PhoneOutlined, MailOutlined,
  GlobalOutlined, CheckCircleOutlined, ArrowLeftOutlined,
} from '@ant-design/icons';
import { vendorService } from '../services/vendorService';
import { bookingService } from '../services/bookingService';
import { eventService } from '../services/eventService';
import { AuthContext } from '../context/AuthContext';
import { formatCurrency, getErrorMessage } from '../utils/helpers';
import './VendorDetail.css';

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

  const openBookingModal = async (pkg) => {
    if (!user) {
      message.info('Please log in to book a vendor');
      navigate('/login');
      return;
    }
    setSelectedPackage(pkg);
    bookingForm.resetFields();
    bookingForm.setFieldsValue({ price: pkg?.price || Number(vendor.basePrice) || 0 });
    try {
      const data = await eventService.getEvents({ limit: 100 });
      setUserEvents(data.events || []);
    } catch (error) {
      message.error(getErrorMessage(error));
    }
    setBookingVisible(true);
  };

  const handleBookVendor = async (values) => {
    try {
      setBookingLoading(true);
      await bookingService.createBooking({
        event: values.event,
        vendor: Number(vendorId),
        price: values.price,
        serviceDate: values.serviceDate.toISOString(),
        notes: selectedPackage
          ? `Package: ${selectedPackage.name}\n${values.notes || ''}`
          : values.notes,
      });
      message.success('Booking created successfully! The vendor will confirm shortly.');
      setBookingVisible(false);
      bookingForm.resetFields();
    } catch (error) {
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

  const packages = Array.isArray(vendor.packages) ? vendor.packages : [];

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
                    <h3 style={{ margin: 0 }}>{pkg.name}</h3>
                  </div>
                }
              >
                <div className="package-content">
                  <div className="package-price">
                    <span className="price-amount">{formatCurrency(pkg.price)}</span>
                    {pkg.priceType && <span className="price-type"> / {pkg.priceType}</span>}
                  </div>
                  <p className="package-description">{pkg.description}</p>
                  <Divider />
                  <ul className="package-includes">
                    {(pkg.includes || []).map((item, i) => (
                      <li key={i}>
                        <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />
                        {item}
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
        title={`Book ${vendor.businessName}${selectedPackage ? ` — ${selectedPackage.name}` : ''}`}
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
          <Form.Item
            name="price"
            label="Agreed Price (INR ₹)"
            rules={[{ required: true, message: 'Please enter the price' }]}
          >
            <InputNumber min={0} style={{ width: '100%' }} />
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
