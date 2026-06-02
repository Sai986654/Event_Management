import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Card, Empty, Select, Space, Spin, Table, Tag, Typography, message } from 'antd';
import { BgColorsOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { inviteDesignService } from '../services/inviteDesignService';
import { eventService } from '../services/eventService';
import { getErrorMessage } from '../utils/helpers';

const { Title, Text } = Typography;

const InviteTemplateLibrary = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [designs, setDesigns] = useState([]);
  const [events, setEvents] = useState([]);
  const [eventForCreate, setEventForCreate] = useState(undefined);

  const loadLibrary = async () => {
    try {
      setLoading(true);
      const data = await inviteDesignService.listDesignLibrary();
      const rows = Array.isArray(data?.designs) ? data.designs : [];
      setDesigns(rows);
    } catch (error) {
      message.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const loadEvents = async () => {
    try {
      setLoadingEvents(true);
      const data = await eventService.getEvents();
      const rows = Array.isArray(data?.events) ? data.events : [];
      setEvents(rows);
      if (!eventForCreate && rows.length) {
        setEventForCreate(rows[0].id);
      }
    } catch (error) {
      message.error(getErrorMessage(error));
    } finally {
      setLoadingEvents(false);
    }
  };

  useEffect(() => {
    loadLibrary();
    loadEvents();
  }, []);

  const columns = useMemo(
    () => [
      {
        title: 'Template',
        dataIndex: 'name',
        key: 'name',
        render: (name, row) => (
          <Space direction="vertical" size={0}>
            <Text strong>{name}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>ID: {row.id} | v{row.version}</Text>
          </Space>
        ),
      },
      {
        title: 'Status',
        dataIndex: 'status',
        key: 'status',
        render: (status) => (
          <Tag color={status === 'published' ? 'green' : status === 'archived' ? 'default' : 'blue'}>
            {status}
          </Tag>
        ),
      },
      {
        title: 'Event Context',
        key: 'event',
        render: (_, row) => row.event?.title || `Event #${row.eventId}`,
      },
      {
        title: 'Updated',
        dataIndex: 'updatedAt',
        key: 'updatedAt',
        render: (value) => (value ? new Date(value).toLocaleString() : '-'),
      },
      {
        title: 'Action',
        key: 'action',
        render: (_, row) => (
          <Button
            icon={<EditOutlined />}
            onClick={() => navigate(`/invite-studio/${row.eventId}?designId=${row.id}`)}
          >
            Edit Template
          </Button>
        ),
      },
    ],
    [navigate]
  );

  return (
    <div style={{ padding: 18 }}>
      <Card>
        <Space direction="vertical" size={14} style={{ width: '100%' }}>
          <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
            <Space>
              <BgColorsOutlined style={{ fontSize: 22, color: '#1d4ed8' }} />
              <Title level={3} style={{ margin: 0 }}>Invite Template Library</Title>
            </Space>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={loadLibrary} loading={loading}>Refresh Templates</Button>
              <Button icon={<ReloadOutlined />} onClick={loadEvents} loading={loadingEvents}>Refresh Events</Button>
            </Space>
          </Space>

          <Text type="secondary">
            Studio is a standalone template workspace. Create and edit invite templates here without opening Event pages.
          </Text>

          <Card size="small" title="Create New Template">
            <Space wrap>
              <Select
                style={{ minWidth: 280 }}
                value={eventForCreate}
                onChange={setEventForCreate}
                placeholder="Choose event context"
                options={events.map((event) => ({ value: event.id, label: event.title || `Event #${event.id}` }))}
                loading={loadingEvents}
              />
              <Button
                type="primary"
                icon={<PlusOutlined />}
                disabled={!eventForCreate}
                onClick={() => navigate(`/invite-studio/${eventForCreate}`)}
              >
                Open Studio To Create
              </Button>
              <Link to="/dashboard">
                <Button type="default">Back to Dashboard</Button>
              </Link>
            </Space>
          </Card>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 30 }}>
              <Spin size="large" />
            </div>
          ) : designs.length ? (
            <Table rowKey="id" dataSource={designs} columns={columns} pagination={{ pageSize: 10 }} />
          ) : (
            <Empty description="No templates found. Create one from Studio." />
          )}
        </Space>
      </Card>
    </div>
  );
};

export default InviteTemplateLibrary;
