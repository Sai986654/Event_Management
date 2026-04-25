import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Button,
  Card,
  Row,
  Col,
  Badge,
  Tag,
  List,
  Select,
  Statistic,
  Timeline,
  Checkbox,
  message,
  Spin,
  Empty,
} from 'antd';
import {
  CameraOutlined,
  WifiOutlined,
  DisconnectOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  UserOutlined,
  ShopOutlined,
} from '@ant-design/icons';
import { useEventSocket } from '../hooks/useEventSocket';
import { eventService } from '../services/eventService';
import { guestService } from '../services/guestService';
import { bookingService } from '../services/bookingService';
import { formatDate, getErrorMessage } from '../utils/helpers';
import './EventControlPanel.css';

const EventControlPanel = () => {
  const { eventId } = useParams();
  const [event, setEvent] = useState(null);
  const [guests, setGuests] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [activityLog, setActivityLog] = useState([]);
  const [loading, setLoading] = useState(true);

  // Helper to push an entry into the live activity log
  const addActivity = useCallback((text, type = 'info') => {
    setActivityLog((prev) => [
      { id: Date.now(), text, type, time: new Date().toLocaleTimeString() },
      ...prev.slice(0, 49), // keep last 50 entries
    ]);
  }, []);

  // ── Socket handlers ──────────────────────────────────────────────────
  const handleVendorStatus = useCallback(
    (data) => {
      setBookings((prev) =>
        prev.map((b) => (b.vendorId === data.vendorId ? { ...b, vendorStatus: data.status } : b))
      );
      addActivity(`Vendor ${data.vendorId} status changed to "${data.status}"`, 'vendor');
      message.info(`Vendor status updated: ${data.status}`);
    },
    [addActivity]
  );

  const handleTaskUpdate = useCallback(
    (data) => {
      setTasks((prev) =>
        prev.map((t) => (t.id === data.taskId ? { ...t, completed: data.completed } : t))
      );
      addActivity(
        `Task "${data.taskId}" ${data.completed ? 'completed' : 'reopened'}`,
        'task'
      );
    },
    [addActivity]
  );

  const handleGuestRsvp = useCallback(
    (data) => {
      setGuests((prev) =>
        prev.map((g) => (g.id === data.guestId ? { ...g, rsvpStatus: data.rsvpStatus } : g))
      );
      addActivity(`Guest RSVP updated: ${data.rsvpStatus}`, 'guest');
    },
    [addActivity]
  );

  const handleGuestCheckin = useCallback(
    (data) => {
      setGuests((prev) =>
        prev.map((g) =>
          g.id === data.guestId ? { ...g, checkedIn: true, checkedInAt: data.checkedInAt } : g
        )
      );
      addActivity(`${data.name} checked in`, 'checkin');
      message.success(`${data.name} just checked in!`);
    },
    [addActivity]
  );

  const handleBookingCreated = useCallback(
    (data) => {
      setBookings((prev) => [data, ...prev]);
      addActivity('New vendor booking created', 'booking');
    },
    [addActivity]
  );

  const handleBookingUpdated = useCallback(
    (data) => {
      setBookings((prev) => prev.map((b) => (b.id === data.id ? data : b)));
      addActivity(`Booking status updated: ${data.status}`, 'booking');
    },
    [addActivity]
  );

  // Connect to socket & subscribe
  const { connected, emitVendorStatus, emitTaskUpdate } = useEventSocket(eventId, {
    onVendorStatus: handleVendorStatus,
    onTaskUpdate: handleTaskUpdate,
    onGuestRsvp: handleGuestRsvp,
    onGuestCheckin: handleGuestCheckin,
    onBookingCreated: handleBookingCreated,
    onBookingUpdated: handleBookingUpdated,
  });

  // ── Initial data fetch ────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [eventRes, guestRes, bookingRes] = await Promise.all([
          eventService.getEventById(eventId),
          guestService.getEventGuests(eventId),
          bookingService.getEventBookings(eventId),
        ]);
        setEvent(eventRes.event);
        setGuests(guestRes.guests || []);
        setBookings(bookingRes.bookings || []);

        // Seed some default tasks if there are none on the response
        setTasks(
          eventRes.event?.tasks || [
            { id: '1', title: 'Venue setup complete', completed: false },
            { id: '2', title: 'Sound check done', completed: false },
            { id: '3', title: 'Catering ready', completed: false },
            { id: '4', title: 'Photography team briefed', completed: false },
            { id: '5', title: 'Guest registration desk open', completed: false },
          ]
        );
      } catch (err) {
        message.error(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [eventId]);

  // ── Derived stats ─────────────────────────────────────────────────────
  const checkedIn = guests.filter((g) => g.checkedIn).length;
  const rsvpConfirmed = guests.filter((g) => g.rsvpStatus === 'confirmed').length;
  const vendorsArrived = bookings.filter((b) => b.vendorStatus === 'arrived').length;
  const tasksCompleted = tasks.filter((t) => t.completed).length;

  // ── Event handlers for UI actions ─────────────────────────────────────
  const handleTaskToggle = (taskId, completed) => {
    emitTaskUpdate(taskId, completed);
    // Optimistic update
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, completed } : t)));
    addActivity(
      `Task "${tasks.find((t) => t.id === taskId)?.title}" ${completed ? 'completed' : 'reopened'}`,
      'task'
    );
  };

  const handleVendorStatusChange = (vendorId, status) => {
    emitVendorStatus(vendorId, status);
    // Optimistic update
    setBookings((prev) =>
      prev.map((b) => (b.vendorId === vendorId ? { ...b, vendorStatus: status } : b))
    );
    addActivity(`Vendor status changed to "${status}"`, 'vendor');
  };

  if (loading) {
    return (
      <div className="control-panel-loading">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="control-panel-container">
      {/* Header */}
      <div className="control-panel-header">
        <div>
          <h1>{event?.title} — Control Panel</h1>
          <p>{event?.location} | {formatDate(event?.date)}</p>
        </div>
        <Badge
          status={connected ? 'success' : 'error'}
          text={
            <span className="connection-status">
              {connected ? (
                <><WifiOutlined /> Live</>
              ) : (
                <><DisconnectOutlined /> Disconnected</>
              )}
            </span>
          }
        />
        <Link to={`/events/${eventId}/photo-booth`}>
          <Button type="primary" icon={<CameraOutlined />} style={{ borderRadius: 8 }}>
            Photo Booth
          </Button>
        </Link>
        <Link to={`/events/${eventId}/guests`}>
          <Button style={{ borderRadius: 8 }}>
            Guests
          </Button>
        </Link>
      </div>

      {/* Live stats row */}
      <Row gutter={[16, 16]} className="stats-row">
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="Checked In"
              value={checkedIn}
              suffix={`/ ${guests.length}`}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="RSVP Confirmed"
              value={rsvpConfirmed}
              suffix={`/ ${guests.length}`}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#667eea' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="Vendors Arrived"
              value={vendorsArrived}
              suffix={`/ ${bookings.length}`}
              prefix={<ShopOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="Tasks Done"
              value={tasksCompleted}
              suffix={`/ ${tasks.length}`}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#13c2c2' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Main panels */}
      <Row gutter={[16, 16]} className="main-panels">
        {/* Left: Vendors + Tasks */}
        <Col xs={24} lg={16}>
          {/* Vendor status panel */}
          <Card title="Vendor Status" className="panel-card">
            {bookings.length === 0 ? (
              <Empty description="No vendors booked yet" />
            ) : (
              <List
                dataSource={bookings}
                renderItem={(booking) => (
                  <List.Item
                    actions={[
                      <Select
                        value={booking.vendorStatus || 'pending'}
                        onChange={(val) => handleVendorStatusChange(booking.vendorId, val)}
                        style={{ width: 140 }}
                        options={[
                          { value: 'pending', label: 'Pending' },
                          { value: 'en_route', label: 'En Route' },
                          { value: 'arrived', label: 'Arrived' },
                          { value: 'setting_up', label: 'Setting Up' },
                          { value: 'ready', label: 'Ready' },
                        ]}
                      />,
                    ]}
                  >
                    <List.Item.Meta
                      avatar={<ShopOutlined style={{ fontSize: 24 }} />}
                      title={booking.vendor?.businessName || `Vendor #${booking.vendorId}`}
                      description={
                        <Tag color={booking.vendorStatus === 'arrived' || booking.vendorStatus === 'ready' ? 'green' : 'orange'}>
                          {booking.vendorStatus || 'pending'}
                        </Tag>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>

          {/* Task checklist */}
          <Card title="Event Tasks" className="panel-card" style={{ marginTop: 16 }}>
            <List
              dataSource={tasks}
              renderItem={(task) => (
                <List.Item>
                  <Checkbox
                    checked={task.completed}
                    onChange={(e) => handleTaskToggle(task.id, e.target.checked)}
                  >
                    <span className={task.completed ? 'task-completed' : ''}>{task.title}</span>
                  </Checkbox>
                </List.Item>
              )}
            />
          </Card>

          {/* Recent check-ins */}
          <Card title="Recent Guest Check-ins" className="panel-card" style={{ marginTop: 16 }}>
            {guests.filter((g) => g.checkedIn).length === 0 ? (
              <Empty description="No check-ins yet" />
            ) : (
              <List
                dataSource={guests.filter((g) => g.checkedIn).slice(0, 10)}
                renderItem={(guest) => (
                  <List.Item>
                    <List.Item.Meta
                      avatar={<UserOutlined />}
                      title={guest.name}
                      description={
                        guest.checkedInAt
                          ? `Checked in at ${new Date(guest.checkedInAt).toLocaleTimeString()}`
                          : 'Checked in'
                      }
                    />
                    <Tag color="green">Checked In</Tag>
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>

        {/* Right: Activity log */}
        <Col xs={24} lg={8}>
          <Card
            title={
              <span>
                Live Activity Feed{' '}
                <Badge
                  status={connected ? 'processing' : 'default'}
                  style={{ marginLeft: 8 }}
                />
              </span>
            }
            className="panel-card activity-card"
          >
            {activityLog.length === 0 ? (
              <Empty description="Waiting for live events..." />
            ) : (
              <Timeline
                items={activityLog.map((entry) => ({
                  key: entry.id,
                  color:
                    entry.type === 'checkin'
                      ? 'green'
                      : entry.type === 'vendor'
                      ? 'orange'
                      : entry.type === 'booking'
                      ? 'blue'
                      : entry.type === 'task'
                      ? 'cyan'
                      : 'gray',
                  children: (
                    <div className="activity-entry">
                      <span className="activity-time">{entry.time}</span>
                      <span className="activity-text">{entry.text}</span>
                    </div>
                  ),
                }))}
              />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default EventControlPanel;
