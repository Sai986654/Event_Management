import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Card, Table, Button, Modal, Form, Input, Select, Upload, message, Spin, Row, Col, Statistic, Badge } from 'antd';
import { PlusOutlined, UploadOutlined } from '@ant-design/icons';
import { guestService } from '../services/guestService';
import { useEventSocket } from '../hooks/useEventSocket';
import { getErrorMessage } from '../utils/helpers';
import './GuestManagement.css';

const GuestManagement = () => {
  const { eventId } = useParams();
  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm();

  // Real-time socket handlers
  const handleGuestRsvp = useCallback((data) => {
    setGuests((prev) =>
      prev.map((g) => (g.id === data.guestId ? { ...g, rsvpStatus: data.rsvpStatus } : g))
    );
    message.info('A guest RSVP was updated in real-time');
  }, []);

  const handleGuestCheckin = useCallback((data) => {
    setGuests((prev) =>
      prev.map((g) =>
        g.id === data.guestId ? { ...g, checkedIn: true, checkedInAt: data.checkedInAt } : g
      )
    );
    message.success(`${data.name} just checked in!`);
  }, []);

  const { connected } = useEventSocket(eventId, {
    onGuestRsvp: handleGuestRsvp,
    onGuestCheckin: handleGuestCheckin,
  });

  useEffect(() => {
    fetchGuests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const fetchGuests = async () => {
    try {
      setLoading(true);
      const data = await guestService.getEventGuests(eventId);
      setGuests(data.guests || []);
    } catch (error) {
      message.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleAddGuest = async (values) => {
    try {
      await guestService.addGuests(eventId, values);
      message.success('Guest added successfully');
      form.resetFields();
      setIsModalVisible(false);
      fetchGuests();
    } catch (error) {
      message.error(getErrorMessage(error));
    }
  };

  const handleCheckIn = async (guestId) => {
    try {
      await guestService.checkInGuest(guestId);
      message.success('Guest checked in successfully');
      fetchGuests();
    } catch (error) {
      message.error(getErrorMessage(error));
    }
  };

  const handleDeleteGuest = (guestId) => {
    Modal.confirm({
      title: 'Delete Guest',
      content: 'Are you sure you want to remove this guest?',
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          await guestService.deleteGuest(guestId);
          message.success('Guest removed successfully');
          fetchGuests();
        } catch (error) {
          message.error(getErrorMessage(error));
        }
      },
    });
  };

  const handleBulkImport = (file) => {
    if (!file) return;
    Modal.confirm({
      title: 'Bulk Import Guests',
      content: 'This will import all guests from the CSV file. Continue?',
      okText: 'Import',
      onOk: async () => {
        try {
          await guestService.bulkImportGuests(eventId, file);
          message.success('Guests imported successfully');
          fetchGuests();
        } catch (error) {
          message.error(getErrorMessage(error));
        }
      },
    });
    return false;
  };

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Email', dataIndex: 'email', key: 'email' },
    { title: 'Phone', dataIndex: 'phone', key: 'phone' },
    {
      title: 'RSVP Status',
      dataIndex: 'rsvpStatus',
      key: 'rsvpStatus',
      render: (status) => {
        const colors = { confirmed: 'green', pending: 'blue', declined: 'red' };
        return <span style={{ color: colors[status] || 'black' }}>{status || 'pending'}</span>;
      },
    },
    {
      title: 'Checked In',
      dataIndex: 'checkedIn',
      key: 'checkedIn',
      render: (checked) => (checked ? '✓' : '✗'),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <div className="action-buttons">
          {!record.checkedIn && (
            <Button size="small" onClick={() => handleCheckIn(record.id)}>
              Check In
            </Button>
          )}
          <Button size="small" danger onClick={() => handleDeleteGuest(record.id)}>
            Remove
          </Button>
        </div>
      ),
    },
  ];

  const rsvpStats = {
    total: guests.length,
    confirmed: guests.filter((g) => g.rsvpStatus === 'confirmed').length,
    pending: guests.filter((g) => g.rsvpStatus === 'pending').length,
    declined: guests.filter((g) => g.rsvpStatus === 'declined').length,
  };

  return (
    <div className="guest-management-container">
      <Spin spinning={loading}>
        <Card className="stats-card">
          <Row gutter={16}>
            <Col xs={12} sm={6}>
              <Statistic title="Total Guests" value={rsvpStats.total} />
            </Col>
            <Col xs={12} sm={6}>
              <Statistic title="Confirmed" value={rsvpStats.confirmed} valueStyle={{ color: '#52c41a' }} />
            </Col>
            <Col xs={12} sm={6}>
              <Statistic title="Pending" value={rsvpStats.pending} valueStyle={{ color: '#faad14' }} />
            </Col>
            <Col xs={12} sm={6}>
              <Statistic title="Declined" value={rsvpStats.declined} valueStyle={{ color: '#f5222d' }} />
            </Col>
          </Row>
        </Card>

        <Card title={
          <span>
            Guest List
            <Badge status={connected ? 'success' : 'default'} text={connected ? 'Live' : ''} style={{ marginLeft: 12, fontSize: 12 }} />
          </span>
        } className="guests-card" style={{ marginTop: '24px' }}>
          <div className="guests-actions">
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalVisible(true)}>
              Add Guest
            </Button>
            <Upload beforeUpload={handleBulkImport} maxCount={1} accept=".csv">
              <Button icon={<UploadOutlined />}>
                Bulk Import (CSV)
              </Button>
            </Upload>
          </div>

          <Table dataSource={guests} columns={columns} pagination={{ pageSize: 20 }} rowKey="id" />
        </Card>

        <Modal
          title="Add Guest"
          visible={isModalVisible}
          onCancel={() => {
            setIsModalVisible(false);
            form.resetFields();
          }}
          footer={null}
        >
          <Form form={form} layout="vertical" onFinish={handleAddGuest}>
            <Form.Item name="name" label="Name" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
              <Input />
            </Form.Item>
            <Form.Item name="phone" label="Phone">
              <Input />
            </Form.Item>
            <Form.Item name="dietaryPreferences" label="Dietary Preferences">
              <Select placeholder="Select dietary preferences" mode="multiple">
                <Select.Option value="vegetarian">Vegetarian</Select.Option>
                <Select.Option value="vegan">Vegan</Select.Option>
                <Select.Option value="glutenfree">Gluten Free</Select.Option>
              </Select>
            </Form.Item>
            <Button type="primary" htmlType="submit" block>
              Add Guest
            </Button>
          </Form>
        </Modal>
      </Spin>
    </div>
  );
};

export default GuestManagement;
