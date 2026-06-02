import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Empty, List, Space, Spin, Tag, Typography, message } from 'antd';
import { ArrowRightOutlined, BgColorsOutlined, ReloadOutlined } from '@ant-design/icons';
import { eventService } from '../services/eventService';
import { getErrorMessage } from '../utils/helpers';

const { Title, Text } = Typography;

const InviteStudioLauncher = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);

  const loadEvents = async () => {
    try {
      setLoading(true);
      const data = await eventService.getEvents();
      const rows = Array.isArray(data?.events) ? data.events : [];
      setEvents(rows);
    } catch (error) {
      message.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: '24px 12px' }}>
      <Card>
        <Space direction="vertical" style={{ width: '100%' }} size={14}>
          <Space style={{ justifyContent: 'space-between', width: '100%' }} wrap>
            <Space>
              <BgColorsOutlined style={{ fontSize: 22, color: '#1d4ed8' }} />
              <Title level={3} style={{ margin: 0 }}>
                Invite Template Studio
              </Title>
            </Space>
            <Button icon={<ReloadOutlined />} onClick={loadEvents}>
              Refresh
            </Button>
          </Space>

          <Text type="secondary">
            Select an event context to design or edit invite templates. Studio is now a standalone workspace.
          </Text>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 30 }}>
              <Spin size="large" />
            </div>
          ) : events.length ? (
            <List
              itemLayout="horizontal"
              dataSource={events}
              renderItem={(event) => (
                <List.Item
                  actions={[
                    <Button
                      key="open"
                      type="primary"
                      icon={<ArrowRightOutlined />}
                      onClick={() => navigate(`/invite-studio/${event.id}`)}
                    >
                      Open Studio
                    </Button>,
                  ]}
                >
                  <List.Item.Meta
                    title={
                      <Space wrap>
                        <span>{event.title || `Event #${event.id}`}</span>
                        {event.type ? <Tag color="blue">{event.type}</Tag> : null}
                      </Space>
                    }
                    description={
                      <Space direction="vertical" size={0}>
                        <Text type="secondary">ID: {event.id}</Text>
                        <Text type="secondary">{event.venue || event.location || 'Venue not set'}</Text>
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          ) : (
            <Empty description="No events found" />
          )}
        </Space>
      </Card>
    </div>
  );
};

export default InviteStudioLauncher;
