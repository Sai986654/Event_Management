import React, { useEffect, useState } from 'react';
import { Button, Card, InputNumber, Select, Space, Table, Tag, message } from 'antd';
import { orderService } from '../services/orderService';
import { activityService } from '../services/activityService';
import { formatCurrency, getErrorMessage } from '../utils/helpers';
import './PhaseFlows.css';

const ActivityTracker = () => {
  const [orders, setOrders] = useState([]);
  const [orderId, setOrderId] = useState();
  const [activities, setActivities] = useState([]);
  const [draft, setDraft] = useState({});
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [savingActivityId, setSavingActivityId] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await orderService.getOrders();
        setOrders(res.orders || []);
      } catch (err) {
        message.error(getErrorMessage(err));
      }
    })();
  }, []);

  const loadActivities = async (selectedOrderId) => {
    setLoadingActivities(true);
    try {
      setOrderId(selectedOrderId);
      const res = await activityService.getByOrder(selectedOrderId);
      setActivities(res.activities || []);
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setLoadingActivities(false);
    }
  };

  const update = async (activityId) => {
    setSavingActivityId(activityId);
    try {
      const payload = draft[activityId] || {};
      await activityService.updateProgress(activityId, payload);
      message.success('Activity updated');
      await loadActivities(orderId);
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setSavingActivityId(null);
    }
  };

  const setDraftField = (activityId, field, value) => {
    setDraft((prev) => ({
      ...prev,
      [activityId]: { ...(prev[activityId] || {}), [field]: value },
    }));
  };

  return (
    <div className="phase-page">
      <Space direction="vertical" className="phase-stack" size={16}>
        <Card className="phase-hero">
          <h1 className="phase-title">Activity Tracker</h1>
          <p className="phase-subtitle">Track progress and spending with transparent status updates.</p>
        </Card>
        <Card className="phase-card" title="Select Order">
          <Select
            style={{ width: 460, maxWidth: '100%' }}
            value={orderId}
            placeholder="Select order"
            onChange={loadActivities}
            options={orders.map((o) => ({ value: o.id, label: `Order #${o.id} - ${o.event?.title || 'Event'} (${o.status})` }))}
          />
        </Card>

        <Card className="phase-card phase-table" title="Activities and Progress">
          <Table
            rowKey="id"
            dataSource={activities}
            loading={loadingActivities}
            pagination={false}
            locale={{ emptyText: <div className="phase-empty">Select an order to view and update activities.</div> }}
            columns={[
              { title: 'Title', dataIndex: 'title' },
              { title: 'Category', dataIndex: 'category' },
              { title: 'Status', dataIndex: 'status', render: (v) => <Tag>{v}</Tag> },
              { title: 'Progress', dataIndex: 'progressPercent', render: (v) => `${v}%` },
              { title: 'Planned', dataIndex: 'spendPlanned', render: (v) => formatCurrency(v) },
              { title: 'Actual', dataIndex: 'spendActual', render: (v) => formatCurrency(v) },
              {
                title: 'Update',
                render: (_, r) => (
                  <Space>
                    <InputNumber
                      min={0}
                      max={100}
                      placeholder="%"
                      onChange={(v) => setDraftField(r.id, 'progressPercent', v)}
                    />
                    <InputNumber
                      min={0}
                      placeholder="Actual"
                      onChange={(v) => setDraftField(r.id, 'spendActual', v)}
                    />
                    <Select
                      style={{ width: 150 }}
                      placeholder="Status"
                      onChange={(v) => setDraftField(r.id, 'status', v)}
                      options={['not_started', 'in_progress', 'completed', 'blocked'].map((s) => ({ value: s, label: s }))}
                    />
                    <Button type="primary" loading={savingActivityId === r.id} onClick={() => update(r.id)}>Save</Button>
                  </Space>
                ),
              },
            ]}
          />
        </Card>
      </Space>
    </div>
  );
};

export default ActivityTracker;
