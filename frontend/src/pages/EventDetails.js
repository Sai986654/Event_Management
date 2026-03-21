import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, Tabs, Button, Spin, message, Modal, Table, Badge, Tag, Space } from 'antd';
import { EditOutlined, DeleteOutlined, ControlOutlined, ShopOutlined } from '@ant-design/icons';
import { eventService } from '../services/eventService';
import { guestService } from '../services/guestService';
import { bookingService } from '../services/bookingService';
import { useEventSocket } from '../hooks/useEventSocket';
import { formatDate, formatCurrency, getErrorMessage } from '../utils/helpers';
import './EventDetails.css';

const EventDetails = () => {
  const { eventId } = useParams();
  const [event, setEvent] = useState(null);
  const [guests, setGuests] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

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

  const fetchEventDetails = async () => {
    try {
      setLoading(true);
      const eventData = await eventService.getEventById(eventId);
      setEvent(eventData.event);

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
                          <td>{event.location}</td>
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
