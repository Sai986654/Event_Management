import React, { useState, useEffect } from 'react';
import { Card, Table, Tag, Button, message, Spin, Empty, Modal, Space } from 'antd';
import { ShopOutlined, EyeOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { bookingService } from '../services/bookingService';
import { formatDate, formatCurrency, getErrorMessage } from '../utils/helpers';
import './MyBookings.css';

const statusColor = {
  pending: 'orange',
  confirmed: 'green',
  cancelled: 'red',
  completed: 'blue',
};

const MyBookings = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const data = await bookingService.getBookings();
      setBookings(data.bookings || []);
    } catch (error) {
      message.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = (bookingId) => {
    Modal.confirm({
      title: 'Cancel Booking',
      content: 'Are you sure you want to cancel this booking? This action cannot be undone.',
      okText: 'Yes, Cancel',
      okType: 'danger',
      onOk: async () => {
        try {
          await bookingService.updateBookingStatus(bookingId, 'cancelled');
          message.success('Booking cancelled');
          setBookings((prev) =>
            prev.map((b) => (b.id === bookingId ? { ...b, status: 'cancelled' } : b))
          );
        } catch (error) {
          message.error(getErrorMessage(error));
        }
      },
    });
  };

  const columns = [
    {
      title: 'Vendor',
      key: 'vendor',
      render: (_, record) => (
        <Space>
          <ShopOutlined />
          <Link to={`/vendors/${record.vendorId || record.vendor?.id}`}>
            {record.vendor?.businessName || `Vendor #${record.vendorId}`}
          </Link>
        </Space>
      ),
    },
    {
      title: 'Category',
      key: 'category',
      render: (_, record) => (
        <Tag>{record.vendor?.category || '—'}</Tag>
      ),
    },
    {
      title: 'Event',
      key: 'event',
      render: (_, record) => (
        <Link to={`/events/${record.eventId || record.event?.id}`}>
          {record.event?.title || `Event #${record.eventId}`}
        </Link>
      ),
    },
    {
      title: 'Service Date',
      dataIndex: 'serviceDate',
      key: 'serviceDate',
      render: (val) => formatDate(val),
      sorter: (a, b) => new Date(a.serviceDate) - new Date(b.serviceDate),
    },
    {
      title: 'Price',
      dataIndex: 'price',
      key: 'price',
      render: (val) => formatCurrency(val),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => <Tag color={statusColor[status]}>{status?.toUpperCase()}</Tag>,
      filters: [
        { text: 'Pending', value: 'pending' },
        { text: 'Confirmed', value: 'confirmed' },
        { text: 'Cancelled', value: 'cancelled' },
        { text: 'Completed', value: 'completed' },
      ],
      onFilter: (value, record) => record.status === value,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Link to={`/events/${record.eventId || record.event?.id}`}>
            <Button size="small" icon={<EyeOutlined />}>View Event</Button>
          </Link>
          {(record.status === 'pending' || record.status === 'confirmed') && (
            <Button size="small" danger onClick={() => handleCancel(record.id)}>
              Cancel
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="my-bookings-container">
      <div className="bookings-header">
        <h1>My Bookings</h1>
        <p>Track and manage all your vendor bookings</p>
        <Link to="/vendors">
          <Button type="primary" icon={<ShopOutlined />}>
            Browse Vendors
          </Button>
        </Link>
      </div>

      <Card>
        <Spin spinning={loading}>
          {bookings.length === 0 ? (
            <Empty description="No bookings yet. Browse vendors to get started!">
              <Link to="/vendors">
                <Button type="primary">Explore Vendors</Button>
              </Link>
            </Empty>
          ) : (
            <Table
              dataSource={bookings}
              columns={columns}
              rowKey="id"
              pagination={{ pageSize: 10 }}
            />
          )}
        </Spin>
      </Card>
    </div>
  );
};

export default MyBookings;
