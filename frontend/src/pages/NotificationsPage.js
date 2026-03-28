import React, { useCallback, useEffect, useState } from 'react';
import { Card, List, Button, Typography, Tag, Empty, Spin, Space } from 'antd';
import { useNavigate } from 'react-router-dom';
import { appNotificationService } from '../services/appNotificationService';
import { getErrorMessage } from '../utils/helpers';

const { Text, Paragraph } = Typography;

const NotificationsPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await appNotificationService.list({ limit: 100 });
      setItems(data.notifications || []);
      setUnreadCount(data.unreadCount ?? 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRead = async (id) => {
    try {
      await appNotificationService.markRead(id);
      await load();
    } catch (e) {
      console.error(getErrorMessage(e));
    }
  };

  const onReadAll = async () => {
    try {
      await appNotificationService.markAllRead();
      await load();
    } catch (e) {
      console.error(getErrorMessage(e));
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: '24px auto', padding: '0 16px' }}>
      <Card
        title="Notifications"
        extra={
          <Space>
            {unreadCount > 0 ? (
              <Button size="small" onClick={onReadAll}>
                Mark all read
              </Button>
            ) : null}
            <Tag>{unreadCount} unread</Tag>
          </Space>
        }
      >
        <Spin spinning={loading}>
          {!items.length ? (
            <Empty description="No notifications yet" />
          ) : (
            <List
              itemLayout="vertical"
              dataSource={items}
              renderItem={(n) => (
                <List.Item
                  style={{
                    opacity: n.read ? 0.75 : 1,
                    background: n.read ? undefined : '#f6f8fc',
                    padding: 12,
                    borderRadius: 8,
                  }}
                  actions={
                    !n.read
                      ? [
                          <Button type="link" key="read" onClick={() => onRead(n.id)}>
                            Mark read
                          </Button>,
                        ]
                      : []
                  }
                >
                  <List.Item.Meta
                    title={
                      <Space wrap>
                        <Text strong={!n.read}>{n.title}</Text>
                        <Tag>{n.type}</Tag>
                        {!n.read ? <Tag color="processing">New</Tag> : null}
                      </Space>
                    }
                    description={
                      <>
                        <Paragraph style={{ marginBottom: 8, whiteSpace: 'pre-wrap' }}>{n.body}</Paragraph>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {new Date(n.createdAt).toLocaleString()}
                        </Text>
                        {n.metadata?.eventId ? (
                          <div style={{ marginTop: 8 }}>
                            <Button
                              type="link"
                              size="small"
                              style={{ padding: 0 }}
                              onClick={() => navigate(`/events/${n.metadata.eventId}`)}
                            >
                              Open event
                            </Button>
                          </div>
                        ) : null}
                      </>
                    }
                  />
                </List.Item>
              )}
            />
          )}
        </Spin>
      </Card>
    </div>
  );
};

export default NotificationsPage;
