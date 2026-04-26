import React, { useCallback, useEffect, useState } from 'react';
import { Button, Card, Empty, Spin, Tag } from 'antd';
import {
  BellOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  FileTextOutlined,
  ShieldOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { appNotificationService } from '../services/appNotificationService';
import { formatCurrency, getErrorMessage } from '../utils/helpers';

/* ── Parse body into label/value rows (mirrors mobile) ── */
const parseBody = (body) => {
  if (!body) return [];
  const rows = body
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const idx = line.indexOf(':');
      if (idx === -1) return { label: null, value: line };
      return { label: line.slice(0, idx).trim(), value: line.slice(idx + 1).trim() };
    });
  const customer = rows.find((r) => r.label === 'Customer');
  const organizer = rows.find((r) => r.label === 'Organizer');
  if (customer && organizer && customer.value === organizer.value) {
    return rows.filter((r) => r.label !== 'Organizer');
  }
  return rows;
};

const typeIcon = (type) => {
  const map = {
    order_quoted: <FileTextOutlined style={{ color: '#667eea' }} />,
    order_confirmed: <CheckCircleOutlined style={{ color: '#22c55e' }} />,
    order_cancelled: <CloseCircleOutlined style={{ color: '#ef4444' }} />,
    booking_created: <CalendarOutlined style={{ color: '#667eea' }} />,
    booking_confirmed: <CheckCircleOutlined style={{ color: '#22c55e' }} />,
    booking_cancelled: <CloseCircleOutlined style={{ color: '#ef4444' }} />,
    vendor_verified: <ShieldOutlined style={{ color: '#22c55e' }} />,
    event_created: <CalendarOutlined style={{ color: '#667eea' }} />,
    guest_rsvp: <UserOutlined style={{ color: '#667eea' }} />,
    guest_checkin: <TeamOutlined style={{ color: '#667eea' }} />,
  };
  return map[type] || <BellOutlined style={{ color: '#667eea' }} />;
};

const formatValue = (label, value) => {
  if (!label) return value;
  const lower = label.toLowerCase();
  if (
    (lower.includes('total') || lower.includes('price') || lower.includes('amount') || lower.includes('budget')) &&
    /^\d+/.test(value)
  ) {
    return formatCurrency(Number(value));
  }
  if ((lower === 'customer' || lower === 'organizer') && value.includes('<')) {
    return value.replace(/<[^>]+>/, '').trim();
  }
  return value;
};

/* ── Single Notification Card ── */
const NotificationCard = ({ item, onRead, onOpenEvent }) => {
  const rows = parseBody(item.body);
  const typeLbl = (item.type || '').replace(/_/g, ' ');

  return (
    <div style={{
      backgroundColor: '#fff',
      borderRadius: 12,
      marginBottom: 12,
      padding: '16px 20px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
      borderLeft: item.read ? 'none' : '4px solid #667eea',
      opacity: item.read ? 0.8 : 1,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 8,
          backgroundColor: '#f0f0ff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, flexShrink: 0,
        }}>
          {typeIcon(item.type)}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#1a1a2e', marginBottom: 4 }}>
            {item.title}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Tag style={{ textTransform: 'capitalize', fontSize: 11 }}>{typeLbl}</Tag>
            {!item.read && <Tag color="processing" style={{ fontSize: 11 }}>New</Tag>}
          </div>
        </div>
      </div>

      {/* Divider */}
      <div style={{ borderTop: '1px solid #f0f0f0', marginBottom: 10 }} />

      {/* Structured body rows */}
      {rows.map((row, i) =>
        row.label ? (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', padding: '5px 0',
            borderBottom: '1px solid #fafafa',
          }}>
            <span style={{
              width: 100, fontSize: 11, fontWeight: 700,
              color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.3, flexShrink: 0,
            }}>
              {row.label}
            </span>
            <span style={{ fontSize: 13, color: '#1a1a2e', fontWeight: 500, flex: 1 }}>
              {formatValue(row.label, row.value)}
            </span>
          </div>
        ) : (
          <p key={i} style={{ fontSize: 13, color: '#374151', margin: '4px 0' }}>{row.value}</p>
        )
      )}

      {/* Timestamp */}
      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 10 }}>
        {new Date(item.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        {item.metadata?.eventId && (
          <Button size="small" icon={<CalendarOutlined />} onClick={onOpenEvent}>
            Open Event
          </Button>
        )}
        {!item.read && (
          <Button size="small" type="text" icon={<CheckCircleOutlined />} onClick={() => onRead(item.id)}>
            Mark Read
          </Button>
        )}
      </div>
    </div>
  );
};

/* ── Page ── */
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
      console.error(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRead = async (id) => {
    try { await appNotificationService.markRead(id); await load(); } catch (e) { console.error(getErrorMessage(e)); }
  };

  const onReadAll = async () => {
    try { await appNotificationService.markAllRead(); await load(); } catch (e) { console.error(getErrorMessage(e)); }
  };

  return (
    <div style={{ maxWidth: 760, margin: '24px auto', padding: '0 16px' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: '#fff', borderRadius: 12, padding: '12px 20px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 28, fontWeight: 800, color: '#667eea' }}>{unreadCount}</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#6b7280' }}>unread</span>
        </div>
        {unreadCount > 0 && (
          <Button icon={<CheckCircleOutlined />} onClick={onReadAll}>
            Mark all read
          </Button>
        )}
      </div>

      <Spin spinning={loading}>
        {!items.length && !loading ? (
          <Card style={{ textAlign: 'center', borderRadius: 12 }}>
            <Empty
              image={<BellOutlined style={{ fontSize: 48, color: '#d1d5db' }} />}
              imageStyle={{ height: 64 }}
              description="No notifications yet"
            />
          </Card>
        ) : (
          <div>
            {items.map((item) => (
              <NotificationCard
                key={item.id}
                item={item}
                onRead={onRead}
                onOpenEvent={() => navigate(`/events/${item.metadata?.eventId}`)}
              />
            ))}
          </div>
        )}
      </Spin>
    </div>
  );
};

export default NotificationsPage;
