import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, Form, Input, Button, message, Spin, Row, Col, Image, Empty, Upload, Tag } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { guestService } from '../services/guestService';
import { mediaService } from '../services/mediaService';
import { eventService } from '../services/eventService';
import { formatDate, getErrorMessage } from '../utils/helpers';
import './PublicEventPage.css';

const PublicEventPage = () => {
  const { eventSlug } = useParams();
  const [event, setEvent] = useState(null);
  const [gallery, setGallery] = useState([]);
  const [gift, setGift] = useState({ enabled: false });
  const [inviteCopy, setInviteCopy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploadingBlessing, setUploadingBlessing] = useState(false);
  const [form] = Form.useForm();
  const [blessingForm] = Form.useForm();

  useEffect(() => {
    fetchEventData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventSlug]);

  const fetchEventData = async () => {
    try {
      setLoading(true);
      const eventData = await eventService.getPublicEventBySlug(eventSlug);
      setEvent(eventData.event);
      setGift(eventData.gift || { enabled: false });
      setInviteCopy(eventData.inviteCopy || null);

      const galleryData = await mediaService.getEventMedia(eventData.event.id, { approved: true });
      setGallery(galleryData.media || []);
    } catch (error) {
      message.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleRsvp = async (values) => {
    try {
      await guestService.updateGuestRsvp(values.guestId, values.status);
      message.success('RSVP submitted successfully!');
      form.resetFields();
    } catch (error) {
      message.error(getErrorMessage(error));
    }
  };

  const uploadBlessing = async (values) => {
    const file = values?.file?.[0]?.originFileObj;
    if (!file) {
      message.warning('Please select a photo first.');
      return;
    }
    setUploadingBlessing(true);
    try {
      await mediaService.uploadPublicBlessing({
        eventSlug,
        guestName: values.guestName,
        caption: values.caption,
        file,
      });
      message.success('Thank you! Your blessing photo is uploaded and queued for AI collage.');
      blessingForm.resetFields();
      fetchEventData();
    } catch (error) {
      message.error(getErrorMessage(error));
    } finally {
      setUploadingBlessing(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!event) {
    return <Empty description="Event not found" />;
  }

  const effectiveInviteCopy = inviteCopy
    ? {
        ...inviteCopy,
        tagline: gift?.enabled
          ? inviteCopy.tagline
          : "If you can't join us in person, you're still part of our day.",
        details: gift?.enabled
          ? inviteCopy.details
          : 'Send your blessings and upload photos for the album and AI collage. The organizer will receive everything and include your presence in the celebration.',
      }
    : null;

  return (
    <div className="public-event-page">
      {/* Hero Section */}
      <div className="event-hero">
        <div className="hero-content">
          <h1>{event.title}</h1>
          <p className="event-subtitle">{event.type}</p>
        </div>
      </div>

      <div className="event-container">
        {effectiveInviteCopy ? (
          <Card style={{ marginBottom: 24, borderColor: '#667eea', background: '#f8f9ff' }}>
            <h2 style={{ marginTop: 0 }}>{effectiveInviteCopy.tagline}</h2>
            <p style={{ marginBottom: 0, fontSize: 16, lineHeight: 1.6 }}>{effectiveInviteCopy.details}</p>
          </Card>
        ) : null}
        {/* Event Details */}
        <Row gutter={[24, 24]}>
          <Col xs={24} md={16}>
            <Card className="event-details-card">
              <h2>Event Details</h2>
              <div className="detail-item">
                <h3>📅 Date & Time</h3>
                <p>{formatDate(event.date)}</p>
              </div>
              <div className="detail-item">
                <h3>📍 Location</h3>
                <p>{event.venue}</p>
              </div>
              <div className="detail-item">
                <h3>👥 Expected Guests</h3>
                <p>{event.guestCount} people</p>
              </div>
              <div className="detail-item">
                <h3>Description</h3>
                <p>{event.description}</p>
              </div>
            </Card>

            {gift?.enabled && (
              <Card title="Unable to Attend? Send Your Blessings 🎁" style={{ marginTop: '24px' }}>
                <p>If you cannot attend, you can gift an item/cash using this QR.</p>
                <Row gutter={[16, 16]} align="middle">
                  <Col xs={24} md={10}>
                    <Image src={gift.qrCodeDataUrl} alt="Gift QR" width={220} />
                  </Col>
                  <Col xs={24} md={14}>
                    <p><strong>UPI:</strong> {gift.upiId}</p>
                    <p><strong>Payee:</strong> {gift.payeeName}</p>
                    <p><strong>Note:</strong> {gift.note}</p>
                  </Col>
                </Row>
              </Card>
            )}

            {!gift?.enabled ? (
              <Card title="Blessings from Afar" style={{ marginTop: '24px' }}>
                <p>The organizer has not enabled UPI gift QR for this event yet.</p>
                <p>You can still share your blessings below and upload a photo for the AI collage.</p>
              </Card>
            ) : null}

            <Card title="Remote Blessing Photo (AI Collage)" style={{ marginTop: '24px' }}>
              <p>If you cannot attend, upload your photo and we will blend it into event memory collage.</p>
              <Form form={blessingForm} layout="vertical" onFinish={uploadBlessing}>
                <Form.Item name="guestName" label="Your Name" rules={[{ required: true, message: 'Please enter your name' }]}>
                  <Input placeholder="Full name" />
                </Form.Item>
                <Form.Item name="caption" label="Message (optional)">
                  <Input placeholder="Blessings for the couple..." />
                </Form.Item>
                <Form.Item
                  name="file"
                  label="Photo"
                  valuePropName="fileList"
                  getValueFromEvent={(e) => (Array.isArray(e) ? e : e?.fileList)}
                  rules={[{ required: true, message: 'Please upload a photo' }]}
                >
                  <Upload beforeUpload={() => false} maxCount={1} accept="image/*">
                    <Button icon={<UploadOutlined />}>Select Photo</Button>
                  </Upload>
                </Form.Item>
                <Button type="primary" htmlType="submit" loading={uploadingBlessing}>
                  Upload for AI Collage
                </Button>
              </Form>
              <Tag style={{ marginTop: 12 }} color="geekblue">AI status: queued after upload</Tag>
            </Card>

            {/* Gallery */}
            {gallery.length > 0 && (
              <Card title="Event Gallery" style={{ marginTop: '24px' }}>
                <Row gutter={[16, 16]}>
                  {gallery.map((media) => (
                    <Col xs={12} sm={8} key={media.id}>
                      <Image
                        src={media.url}
                        alt={media.description}
                        style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: '4px' }}
                      />
                    </Col>
                  ))}
                </Row>
              </Card>
            )}
          </Col>

          {/* RSVP Card */}
          <Col xs={24} md={8}>
            <Card className="rsvp-card" sticky>
              <h2>RSVP</h2>
              <Form form={form} layout="vertical" onFinish={handleRsvp}>
                <Form.Item
                  name="name"
                  label="Your Name"
                  rules={[{ required: true, message: 'Please enter your name' }]}
                >
                  <Input placeholder="Full name" />
                </Form.Item>

                <Form.Item
                  name="email"
                  label="Email"
                  rules={[{ required: true, type: 'email' }]}
                >
                  <Input placeholder="your@email.com" />
                </Form.Item>

                <Form.Item
                  name="status"
                  label="Will you attend?"
                  rules={[{ required: true }]}
                >
                  <Input.Group compact>
                    <Button
                      block
                      onClick={() => form.setFieldValue('status', 'confirmed')}
                      type={form.getFieldValue('status') === 'confirmed' ? 'primary' : 'default'}
                      style={{ marginBottom: '8px' }}
                    >
                      ✓ I'll be there
                    </Button>
                    <Button
                      block
                      onClick={() => form.setFieldValue('status', 'pending')}
                      type={form.getFieldValue('status') === 'pending' ? 'primary' : 'default'}
                      style={{ marginBottom: '8px' }}
                    >
                      ? Maybe
                    </Button>
                    <Button
                      block
                      danger
                      onClick={() => form.setFieldValue('status', 'declined')}
                      type={form.getFieldValue('status') === 'declined' ? 'primary' : 'default'}
                    >
                      ✗ Can't attend
                    </Button>
                  </Input.Group>
                </Form.Item>

                <Form.Item name="dietaryPreferences" label="Dietary Preferences">
                  <Input placeholder="E.g., Vegetarian, Gluten-free" />
                </Form.Item>

                <Button type="primary" htmlType="submit" block size="large">
                  Submit RSVP
                </Button>
              </Form>
            </Card>
          </Col>
        </Row>
      </div>
    </div>
  );
};

export default PublicEventPage;
