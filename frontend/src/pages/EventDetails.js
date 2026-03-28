import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Card,
  Tabs,
  Button,
  Spin,
  message,
  Modal,
  Table,
  Badge,
  Tag,
  Space,
  Input,
  Typography,
  Switch,
  InputNumber,
  Divider,
} from 'antd';
import { EditOutlined, DeleteOutlined, ControlOutlined, ShopOutlined } from '@ant-design/icons';
import { eventService } from '../services/eventService';
import { guestService } from '../services/guestService';
import { bookingService } from '../services/bookingService';
import { useEventSocket } from '../hooks/useEventSocket';
import { formatDate, formatCurrency, getErrorMessage } from '../utils/helpers';
import { notificationService } from '../services/notificationService';
import './EventDetails.css';

const { TextArea } = Input;
const { Paragraph, Text } = Typography;

const EventDetails = () => {
  const { eventId } = useParams();
  const [event, setEvent] = useState(null);
  const [inviteCopy, setInviteCopy] = useState(null);
  const [guests, setGuests] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [waMessage, setWaMessage] = useState('');
  const [waSending, setWaSending] = useState(false);
  const [dripEnabled, setDripEnabled] = useState(false);
  const [dripInterval, setDripInterval] = useState(2);
  const [dripVideoUrl, setDripVideoUrl] = useState('');
  const [dripSaving, setDripSaving] = useState(false);
  const [dripTesting, setDripTesting] = useState(false);

  // Real-time handlers
  const handleGuestRsvp = useCallback((data) => {
    setGuests((prev) =>
      prev.map((g) => (g.id === data.guestId ? { ...g, rsvpStatus: data.rsvpStatus } : g))
    );
  }, []);

  const handleGuestCheckin = useCallback((data) => {
    setGuests((prev) =>
      prev.map((g) =>
        g.id === data.guestId ? { ...g, checkedIn: true, checkedInAt: data.checkedInAt } : g
      )
    );
    message.success(`${data.name} just checked in!`);
  }, []);

  const handleBookingCreated = useCallback((data) => {
    setBookings((prev) => [data, ...prev]);
    message.info('New vendor booking received');
  }, []);

  const handleBookingUpdated = useCallback((data) => {
    setBookings((prev) => prev.map((b) => (b.id === data.id ? data : b)));
  }, []);

  const { connected } = useEventSocket(eventId, {
    onGuestRsvp: handleGuestRsvp,
    onGuestCheckin: handleGuestCheckin,
    onBookingCreated: handleBookingCreated,
    onBookingUpdated: handleBookingUpdated,
  });

  useEffect(() => {
    fetchEventDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  useEffect(() => {
    if (!event) return;
    setDripEnabled(Boolean(event.inviteDripEnabled));
    setDripInterval(Math.min(14, Math.max(1, Number(event.inviteDripIntervalDays) || 2)));
    setDripVideoUrl(event.inviteDripVideoUrl || '');
  }, [event]);

  const fetchEventDetails = async () => {
    try {
      setLoading(true);
      const eventData = await eventService.getEventById(eventId);
      setEvent(eventData.event);
      setInviteCopy(eventData.inviteCopy || null);

      const guestsData = await guestService.getEventGuests(eventId);
      setGuests(guestsData.guests || []);

      const bookingsData = await bookingService.getEventBookings(eventId);
      setBookings(bookingsData.bookings || []);
    } catch (error) {
      message.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEvent = () => {
    Modal.confirm({
      title: 'Delete Event',
      content: 'Are you sure you want to delete this event?',
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          await eventService.deleteEvent(eventId);
          message.success('Event deleted successfully');
          // Navigate back to dashboard
          window.location.href = '/dashboard';
        } catch (error) {
          message.error(getErrorMessage(error));
        }
      },
    });
  };

  const guestColumns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Phone', dataIndex: 'phone', key: 'phone', render: (p) => p || '—' },
    { title: 'Email', dataIndex: 'email', key: 'email' },
    { title: 'RSVP Status', dataIndex: 'rsvpStatus', key: 'rsvpStatus' },
    { title: 'Check-in', dataIndex: 'checkedIn', key: 'checkedIn', render: (val) => val ? 'Yes' : 'No' },
  ];

  const handleUpdateBookingStatus = async (bookingId, status) => {
    try {
      await bookingService.updateBookingStatus(bookingId, status);
      message.success(`Booking ${status}`);
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, status } : b))
      );
    } catch (error) {
      message.error(getErrorMessage(error));
    }
  };

  const handleCancelBooking = (bookingId) => {
    Modal.confirm({
      title: 'Cancel Booking',
      content: 'Are you sure you want to cancel this vendor booking?',
      okText: 'Cancel Booking',
      okType: 'danger',
      onOk: () => handleUpdateBookingStatus(bookingId, 'cancelled'),
    });
  };

  const saveDripSettings = async () => {
    setDripSaving(true);
    try {
      const res = await eventService.updateEvent(eventId, {
        inviteDripEnabled: dripEnabled,
        inviteDripIntervalDays: dripInterval,
        inviteDripVideoUrl: dripVideoUrl.trim() || null,
      });
      setEvent(res.event);
      message.success('Invite drip settings saved.');
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setDripSaving(false);
    }
  };

  const testInviteDrip = async () => {
    setDripTesting(true);
    try {
      const res = await eventService.triggerInviteDrip(eventId, { force: true });
      message.success(
        `Drip sent: ${res.sent ?? 0} guest(s). ${res.skipped ? '(No phones on guest list?)' : ''}`
      );
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setDripTesting(false);
    }
  };

  const sendGuestWhatsAppBroadcast = async () => {
    const text = waMessage.trim();
    if (!text) {
      message.warning('Write an update message for your guests.');
      return;
    }
    setWaSending(true);
    try {
      const res = await notificationService.sendGuestWhatsAppBroadcast(eventId, { message: text });
      message.success(
        `WhatsApp queued/sent for ${res.sentCount ?? 0} of ${res.guestsWithPhone ?? 0} guests with phone on file.`
      );
      setWaMessage('');
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setWaSending(false);
    }
  };

  const bookingStatusColor = {
    pending: 'orange',
    confirmed: 'green',
    cancelled: 'red',
    completed: 'blue',
  };

  const bookingColumns = [
    {
      title: 'Vendor',
      key: 'vendor',
      render: (_, record) => (
        <Space>
          <ShopOutlined />
          {record.vendor?.businessName || `Vendor #${record.vendorId}`}
        </Space>
      ),
    },
    { title: 'Category', key: 'category', render: (_, record) => record.vendor?.category || '—' },
    { title: 'Price', dataIndex: 'price', key: 'price', render: (val) => formatCurrency(val) },
    {
      title: 'Service Date',
      dataIndex: 'serviceDate',
      key: 'serviceDate',
      render: (val) => formatDate(val),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => <Tag color={bookingStatusColor[status]}>{status}</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          {record.status === 'pending' && (
            <Button size="small" type="primary" onClick={() => handleUpdateBookingStatus(record.id, 'confirmed')}>
              Confirm
            </Button>
          )}
          {(record.status === 'pending' || record.status === 'confirmed') && (
            <Button size="small" danger onClick={() => handleCancelBooking(record.id)}>
              Cancel
            </Button>
          )}
          {record.status === 'confirmed' && (
            <Button size="small" onClick={() => handleUpdateBookingStatus(record.id, 'completed')}>
              Complete
            </Button>
          )}
        </Space>
      ),
    },
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 'calc(100vh - 64px)' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="event-details-container">
      {event && (
        <>
          <Card className="event-header">
            <div className="event-header-content">
              <h1>{event.title}</h1>
              <p className="event-type">{event.type}</p>
              <div className="event-meta">
                <span>📅 {formatDate(event.date)}</span>
                <span>📍 {event.location}</span>
                <span>👥 {event.guestCount} guests</span>
                <span>💰 {formatCurrency(event.budget)}</span>
              </div>
            </div>
            <div className="event-actions">
              <Badge status={connected ? 'success' : 'default'} text={connected ? 'Live' : 'Offline'} />
              <Link to={`/events/${eventId}/control-panel`}>
                <Button icon={<ControlOutlined />} type="primary">Control Panel</Button>
              </Link>
              <Button icon={<EditOutlined />}>Edit</Button>
              <Button danger icon={<DeleteOutlined />} onClick={handleDeleteEvent}>
                Delete
              </Button>
            </div>
          </Card>

          <Tabs
            items={[
              {
                key: 'guest_comms',
                label: 'Invite & guest updates',
                children: (
                  <Card>
                    {inviteCopy ? (
                      <>
                        <Paragraph strong>{inviteCopy.tagline}</Paragraph>
                        <Paragraph type="secondary">{inviteCopy.details}</Paragraph>
                      </>
                    ) : null}
                    <Paragraph>
                      <Text strong>Public page (QR destination): </Text>
                      {event.isPublic && event.slug ? (
                        <a href={`${window.location.origin}/public/${event.slug}`} target="_blank" rel="noreferrer">
                          {`${window.location.origin}/public/${event.slug}`}
                        </a>
                      ) : (
                        <Text type="warning">
                          Turn on <Text code>isPublic</Text> for this event so the link works for guests. You can
                          update the event via API or your admin tools.
                        </Text>
                      )}
                    </Paragraph>
                    <Paragraph type="secondary">
                      Guests can use that page to send UPI gifts, upload remote-blessing photos for your AI collage,
                      and you receive in-app alerts when photos arrive. Physical invites can print a QR pointing to the
                      same URL.
                    </Paragraph>

                    <Divider />
                    <h4>Scheduled AI invite drips (WhatsApp)</h4>
                    <Paragraph type="secondary">
                      The server runs a <Text strong>daily job</Text> (default 09:00, cron in <Text code>INVITE_DRIP_CRON</Text>).
                      For each enabled public event before the date, we send guests a <Text strong>fresh LLM-written</Text>{' '}
                      reminder every <Text strong>N days</Text> (e.g. 2). This is innovative copy + your public link — not
                      auto-rendered AI video yet. Add an optional <Text strong>teaser video URL</Text> (YouTube, etc.); the
                      message will mention it. Real generated video would need a provider (e.g. Runway) wired separately.
                    </Paragraph>
                    <Space direction="vertical" size={12} style={{ width: '100%', maxWidth: 520 }}>
                      <Space align="center">
                        <Text>Enable drip sends</Text>
                        <Switch checked={dripEnabled} onChange={setDripEnabled} />
                      </Space>
                      <Space align="center">
                        <Text>Every</Text>
                        <InputNumber min={1} max={14} value={dripInterval} onChange={(v) => setDripInterval(v || 2)} />
                        <Text>days</Text>
                      </Space>
                      <Input
                        placeholder="Optional teaser video URL (YouTube, Cloudinary, …)"
                        value={dripVideoUrl}
                        onChange={(e) => setDripVideoUrl(e.target.value)}
                      />
                      <Space wrap>
                        <Button type="primary" onClick={saveDripSettings} loading={dripSaving}>
                          Save drip settings
                        </Button>
                        <Button onClick={testInviteDrip} loading={dripTesting}>
                          Send test drip now (force)
                        </Button>
                      </Space>
                      {event.inviteDripLastSentAt ? (
                        <Text type="secondary">
                          Last automated drip: {formatDate(event.inviteDripLastSentAt)}
                        </Text>
                      ) : null}
                    </Space>

                    <Divider />
                    <h4>WhatsApp progress update</h4>
                    <Paragraph type="secondary">
                      Sends your text to every guest who has a phone number in the guest list (same backend as Contact
                      Intelligence reminders; mock mode logs until WhatsApp is wired).
                    </Paragraph>
                    <TextArea
                      rows={4}
                      value={waMessage}
                      onChange={(e) => setWaMessage(e.target.value)}
                      placeholder="Example: Hi! 5 days to go — we can't wait. RSVP link in your invite. Love, [names]"
                    />
                    <Button type="primary" style={{ marginTop: 12 }} loading={waSending} onClick={sendGuestWhatsAppBroadcast}>
                      Send WhatsApp to guests with phone
                    </Button>
                  </Card>
                ),
              },
              {
                key: 'overview',
                label: 'Overview',
                children: (
                  <Card>
                    <h3>Description</h3>
                    <p>{event.description}</p>
                    <h3>Details</h3>
                    <table className="details-table">
                      <tbody>
                        <tr>
                          <td>Type:</td>
                          <td>{event.type}</td>
                        </tr>
                        <tr>
                          <td>Date:</td>
                          <td>{formatDate(event.date)}</td>
                        </tr>
                        <tr>
                          <td>Location:</td>
                          <td>{[event.venue, event.city, event.state].filter(Boolean).join(', ') || '—'}</td>
                        </tr>
                        <tr>
                          <td>Budget:</td>
                          <td>{formatCurrency(event.budget)}</td>
                        </tr>
                        <tr>
                          <td>Guest Count:</td>
                          <td>{event.guestCount}</td>
                        </tr>
                      </tbody>
                    </table>
                  </Card>
                ),
              },
              {
                key: 'guests',
                label: `Guests (${guests.length})`,
                children: (
                  <Card>
                    <Table dataSource={guests} columns={guestColumns} pagination={false} />
                  </Card>
                ),
              },
              {
                key: 'vendors',
                label: `Vendors (${bookings.length})`,
                children: (
                  <Card
                    extra={
                      <Link to="/vendors">
                        <Button type="primary" icon={<ShopOutlined />}>
                          Browse Vendors
                        </Button>
                      </Link>
                    }
                  >
                    <Table
                      dataSource={bookings}
                      columns={bookingColumns}
                      rowKey="id"
                      pagination={false}
                    />
                  </Card>
                ),
              },
            ]}
            style={{ marginTop: '24px' }}
          />
        </>
      )}
    </div>
  );
};

export default EventDetails;
