import React, { useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { Layout, Button, Card, Row, Col, Statistic, Table, Tag, Tabs, Select, Tooltip, message, Empty, Spin, Space, Badge, Segmented } from 'antd';
import { PlusOutlined, CalendarOutlined, TeamOutlined, SortAscendingOutlined, SortDescendingOutlined, AimOutlined, ShopOutlined, CheckCircleOutlined, RiseOutlined, FallOutlined, MinusOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { eventService } from '../services/eventService';
import { bookingService } from '../services/bookingService';
import { formatDate, formatCurrency, getErrorMessage } from '../utils/helpers';
import './Dashboard.css';

// Haversine distance in km
const haversineKm = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/* ─── Organizer / Admin dashboard ─── */
const OrganizerDashboard = ({ user }) => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalEvents: 0, upcomingEvents: 0, totalGuests: 0, totalBudget: 0 });
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [eventViewMode, setEventViewMode] = useState('table');
  const [userCoords, setUserCoords] = useState(null); // { lat, lng }
  const [geoLoading, setGeoLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await eventService.getEvents({ limit: 'all' });
        const evts = data.events || [];
        setEvents(evts);
        const upcoming = evts.filter((e) => new Date(e.date) > new Date()).length;
        setStats({
          totalEvents: evts.length,
          upcomingEvents: upcoming,
          totalGuests: evts.reduce((s, e) => s + Number(e.guestCount || 0), 0),
          totalBudget: evts.reduce((s, e) => s + (parseFloat(e.budget) || 0), 0),
        });
      } catch (err) {
        message.error(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) { message.error('Geolocation not supported'); return; }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoLoading(false);
      },
      () => {
        message.warning('Could not get location. Switching to date sort.');
        setSortBy('date');
        setGeoLoading(false);
      },
      { timeout: 8000 }
    );
  }, []);

  const handleSortByChange = useCallback((val) => {
    setSortBy(val);
    if (val === 'distance' && !userCoords) requestLocation();
  }, [userCoords, requestLocation]);

  const applySort = useCallback((list) => {
    const dir = sortOrder === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      if (sortBy === 'budget') return dir * ((parseFloat(a.budget) || 0) - (parseFloat(b.budget) || 0));
      if (sortBy === 'createdAt') return dir * (new Date(a.createdAt) - new Date(b.createdAt));
      if (sortBy === 'distance') {
        if (!userCoords) return 0;
        const da = a.lat != null ? haversineKm(userCoords.lat, userCoords.lng, a.lat, a.lng) : Infinity;
        const db = b.lat != null ? haversineKm(userCoords.lat, userCoords.lng, b.lat, b.lng) : Infinity;
        return dir * (da - db);
      }
      return dir * (new Date(a.date) - new Date(b.date));
    });
  }, [sortBy, sortOrder, userCoords]);

  // Segregate events like mobile: completed by status, active/drafts exclude completed.
  const completedEvents = useMemo(
    () => applySort(events.filter((e) => String(e.status || '').toLowerCase() === 'completed')),
    [events, applySort]
  );
  const activeEvents = useMemo(
    () => applySort(events.filter((e) => (e._count?.bookings || 0) > 0 && String(e.status || '').toLowerCase() !== 'completed')),
    [events, applySort]
  );
  const draftEvents = useMemo(
    () => applySort(events.filter((e) => (e._count?.bookings || 0) === 0 && String(e.status || '').toLowerCase() !== 'completed')),
    [events, applySort]
  );

  const columns = useMemo(
    () => [
      { title: 'Event Name', dataIndex: 'title', key: 'title', render: (t, r) => <Link to={`/events/${r.id}`}>{t}</Link> },
      { title: 'Date', dataIndex: 'date', key: 'date', render: (d) => formatDate(d) },
      {
        title: 'Location',
        key: 'location',
        render: (_, r) => r.venue || [r.city, r.state].filter(Boolean).join(', ') || '—',
      },
      { title: 'Budget', dataIndex: 'budget', key: 'budget', render: (b) => formatCurrency(b) },
      { title: 'Guests', dataIndex: 'guestCount', key: 'guestCount' },
      {
        title: 'Vendors',
        key: 'vendors',
        render: (_, r) => {
          const count = r._count?.bookings || 0;
          return count > 0
            ? <Tag color="green">{count} booked</Tag>
            : <Tag color="default">None</Tag>;
        },
      },
      { title: 'Action', key: 'action', render: (_, r) => <Link to={`/events/${r.id}`}><Button type="link">View</Button></Link> },
    ],
    []
  );

  const trendStats = useMemo(() => {
    const DAY = 24 * 60 * 60 * 1000;
    const now = Date.now();
    const currentStart = now - 30 * DAY;
    const previousStart = now - 60 * DAY;

    const inCurrentCreatedWindow = (event) => {
      const ts = new Date(event.createdAt || event.date || 0).getTime();
      return Number.isFinite(ts) && ts >= currentStart && ts < now;
    };
    const inPreviousCreatedWindow = (event) => {
      const ts = new Date(event.createdAt || event.date || 0).getTime();
      return Number.isFinite(ts) && ts >= previousStart && ts < currentStart;
    };
    const inUpcomingCurrentWindow = (event) => {
      const ts = new Date(event.date || 0).getTime();
      return Number.isFinite(ts) && ts >= now && ts < now + 30 * DAY;
    };
    const inUpcomingPreviousWindow = (event) => {
      const ts = new Date(event.date || 0).getTime();
      return Number.isFinite(ts) && ts >= now - 30 * DAY && ts < now;
    };

    const currentCreated = events.filter(inCurrentCreatedWindow);
    const previousCreated = events.filter(inPreviousCreatedWindow);

    const toTrend = (current, previous) => {
      const delta = current - previous;
      const pct = previous > 0 ? Math.round((Math.abs(delta) / previous) * 100) : (current > 0 ? 100 : 0);
      return {
        delta,
        pct,
        direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat',
      };
    };

    return {
      totalEvents: toTrend(currentCreated.length, previousCreated.length),
      upcomingEvents: toTrend(events.filter(inUpcomingCurrentWindow).length, events.filter(inUpcomingPreviousWindow).length),
      totalGuests: toTrend(
        currentCreated.reduce((sum, event) => sum + Number(event.guestCount || 0), 0),
        previousCreated.reduce((sum, event) => sum + Number(event.guestCount || 0), 0)
      ),
      totalBudget: toTrend(
        currentCreated.reduce((sum, event) => sum + (parseFloat(event.budget) || 0), 0),
        previousCreated.reduce((sum, event) => sum + (parseFloat(event.budget) || 0), 0)
      ),
    };
  }, [events]);

  const kpiSparklineSeries = useMemo(() => {
    const DAY = 24 * 60 * 60 * 1000;
    const WEEK = 7 * DAY;
    const bins = 8;
    const now = Date.now();
    const createdStart = now - bins * WEEK;

    const totalEventsSeries = Array.from({ length: bins }, () => 0);
    const guestsSeries = Array.from({ length: bins }, () => 0);
    const budgetSeries = Array.from({ length: bins }, () => 0);
    const upcomingSeries = Array.from({ length: bins }, () => 0);

    events.forEach((event) => {
      const createdTs = new Date(event.createdAt || event.date || 0).getTime();
      if (Number.isFinite(createdTs) && createdTs >= createdStart && createdTs < now) {
        const idx = Math.floor((createdTs - createdStart) / WEEK);
        if (idx >= 0 && idx < bins) {
          totalEventsSeries[idx] += 1;
          guestsSeries[idx] += Number(event.guestCount || 0);
          budgetSeries[idx] += parseFloat(event.budget) || 0;
        }
      }

      const eventDateTs = new Date(event.date || 0).getTime();
      if (Number.isFinite(eventDateTs) && eventDateTs >= now) {
        const idx = Math.floor((eventDateTs - now) / WEEK);
        if (idx >= 0 && idx < bins) {
          upcomingSeries[idx] += 1;
        }
      }
    });

    return {
      totalEvents: totalEventsSeries,
      upcomingEvents: upcomingSeries,
      totalGuests: guestsSeries,
      totalBudget: budgetSeries,
    };
  }, [events]);

  const renderTrendChip = useCallback((trend) => {
    const direction = trend?.direction || 'flat';
    const icon = direction === 'up' ? <RiseOutlined /> : direction === 'down' ? <FallOutlined /> : <MinusOutlined />;
    const text = direction === 'flat'
      ? 'No change vs last 30d'
      : `${direction === 'up' ? '+' : '-'}${Math.abs(trend.delta)} (${trend.pct}%) vs last 30d`;

    return (
      <span className={`kpi-trend-chip kpi-trend-chip--${direction}`}>
        {icon} {text}
      </span>
    );
  }, []);

  const renderSparkline = useCallback((values, tone = 'blue') => {
    const width = 120;
    const height = 34;
    const pad = 3;
    const points = Array.isArray(values) && values.length ? values : [0, 0, 0, 0];
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min;
    const stepX = points.length > 1 ? (width - pad * 2) / (points.length - 1) : 0;

    const colorMap = {
      gold: { stroke: '#d4af37', fill: 'rgba(212,175,55,0.2)' },
      amber: { stroke: '#b28822', fill: 'rgba(178,136,34,0.16)' },
      navy: { stroke: '#334155', fill: 'rgba(51,65,85,0.17)' },
      sage: { stroke: '#6d7f4f', fill: 'rgba(109,127,79,0.16)' },
    };
    const palette = colorMap[tone] || colorMap.gold;

    const xy = points.map((value, index) => {
      const x = pad + index * stepX;
      const normalized = range === 0 ? 0.5 : (value - min) / range;
      const y = pad + (1 - normalized) * (height - pad * 2);
      return [x, y];
    });

    const line = xy.map(([x, y]) => `${x},${y}`).join(' ');
    const area = `${pad},${height - pad} ${line} ${width - pad},${height - pad}`;
    const [endX, endY] = xy[xy.length - 1];

    return (
      <div className="kpi-sparkline-wrap">
        <svg className="kpi-sparkline" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label="KPI trend sparkline">
          <polygon points={area} fill={palette.fill} />
          <polyline points={line} fill="none" stroke={palette.stroke} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={endX} cy={endY} r="2.8" fill={palette.stroke} />
        </svg>
      </div>
    );
  }, []);

  const renderEventPanelContent = useCallback((eventList, emptyDescription) => {
    if (!eventList.length) return <Empty description={emptyDescription} />;

    if (eventViewMode === 'compact') {
      return (
        <div className="events-compact-list">
          {eventList.map((event) => {
            const vendorCount = event._count?.bookings || 0;
            return (
              <div className="events-compact-item" key={event.id}>
                <div className="events-compact-item-main">
                  <div className="events-compact-item-title-row">
                    <Link to={`/events/${event.id}`} className="events-compact-item-title">{event.title}</Link>
                    <Tag color={String(event.status || '').toLowerCase() === 'completed' ? 'blue' : 'green'}>
                      {event.status || 'active'}
                    </Tag>
                  </div>
                  <div className="events-compact-item-meta">
                    <span>{formatDate(event.date)}</span>
                    <span>{event.venue || [event.city, event.state].filter(Boolean).join(', ') || '—'}</span>
                    <span>{formatCurrency(event.budget)}</span>
                    <span>{Number(event.guestCount || 0)} guests</span>
                    <span>{vendorCount} vendors</span>
                  </div>
                </div>
                <Link to={`/events/${event.id}`}>
                  <Button type="link">View</Button>
                </Link>
              </div>
            );
          })}
        </div>
      );
    }

    return <Table dataSource={eventList} columns={columns} pagination={{ pageSize: 10 }} rowKey="id" scroll={{ x: 900 }} />;
  }, [columns, eventViewMode]);

  const tabItems = [
    {
      key: 'active',
      label: (
        <span>
          Live Celebrations <Badge count={activeEvents.length} style={{ backgroundColor: '#22c55e' }} showZero />
        </span>
      ),
      children: renderEventPanelContent(activeEvents, 'No live celebrations yet. Start by adding your first wedding event.'),
    },
    {
      key: 'drafts',
      label: (
        <span>
          Planned <Badge count={draftEvents.length} style={{ backgroundColor: '#d9d9d9', color: '#666' }} showZero />
        </span>
      ),
      children: renderEventPanelContent(draftEvents, 'No planned events in draft.'),
    },
    {
      key: 'completed',
      label: (
        <span>
          Completed <Badge count={completedEvents.length} style={{ backgroundColor: '#1e293b' }} showZero />
        </span>
      ),
      children: renderEventPanelContent(completedEvents, 'No completed events yet.'),
    },
  ];

  const sortBar = (
    <Space wrap>
      <Select
        value={sortBy}
        onChange={handleSortByChange}
        style={{ width: 150 }}
        options={[
          { value: 'date', label: 'Ceremony Date' },
          { value: 'budget', label: 'Budget' },
          { value: 'createdAt', label: 'Created' },
          { value: 'distance', label: 'Nearest' },
        ]}
      />
      <Tooltip title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}>
        <Button
          icon={sortOrder === 'asc' ? <SortAscendingOutlined /> : <SortDescendingOutlined />}
          onClick={() => setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}
        />
      </Tooltip>
      {sortBy === 'distance' && (
        <Tooltip title={userCoords ? `Location acquired` : 'Click to use my location'}>
          <Button
            icon={<AimOutlined />}
            loading={geoLoading}
            type={userCoords ? 'primary' : 'default'}
            onClick={requestLocation}
          />
        </Tooltip>
      )}
    </Space>
  );

  const quickActions = [
    { key: 'vendors', label: 'Find Wedding Vendors', to: '/vendors', kind: 'default' },
    { key: 'bookings', label: 'Track Confirmed Bookings', to: '/bookings', kind: 'default' },
    ...(user?.role === 'admin' ? [{ key: 'admin-control', label: 'Operations Control Center', to: '/admin/control-center', kind: 'primary' }] : []),
    ...((user?.role === 'organizer' || user?.role === 'admin')
      ? [{ key: 'activities', label: 'Family Activity Timeline', to: '/activities', kind: 'default' }]
      : []),
    ...((user?.role === 'organizer' || user?.role === 'admin')
      ? [{ key: 'invite-studio', label: 'Invitation Studio', to: events.length > 0 ? `/events/${events[0].id}/invite-studio` : '#', kind: 'default', disabled: events.length === 0 }]
      : []),
    ...(user?.role === 'organizer' ? [{ key: 'planner', label: 'Wedding Planner', to: '/planner', kind: 'default' }] : []),
  ];

  return (
    <Spin spinning={loading}>
      <div className="dashboard-header dashboard-header--hero">
        <div className="dashboard-header-content">
          <h1>Namaskaram, {user?.name}</h1>
          <p className="dashboard-subtitle">
            Your Telugu wedding command center for family coordination, vendors, budget, and celebration progress.
          </p>
        </div>
        <div className="dashboard-hero-actions">
          <Link to="/events/create">
            <Button type="primary" size="large" icon={<PlusOutlined />}>Create Wedding Event</Button>
          </Link>
        </div>
      </div>

      <Card className="dashboard-action-rail" bordered={false}>
        <div className="dashboard-action-rail-header">Family Quick Actions</div>
        <Space wrap size={[10, 10]}>
          {quickActions.map((item) => (
            <Link key={item.key} to={item.disabled ? '#' : item.to} onClick={(e) => item.disabled && e.preventDefault()}>
              <Button type={item.kind === 'primary' ? 'primary' : 'default'} disabled={item.disabled}>{item.label}</Button>
            </Link>
          ))}
        </Space>
      </Card>

      <Row gutter={[16, 16]} className="stats-grid">
        <Col xs={24} sm={12} lg={6}>
          <Card className="dashboard-stat-card stat-card-with-banner" bodyStyle={{ padding: 0 }}>
            <div className="stat-card-banner banner-events" />
            <div className="stat-card-body">
              <Statistic title="Wedding Events" value={stats.totalEvents} prefix={<CalendarOutlined />} />
              {renderSparkline(kpiSparklineSeries.totalEvents, 'gold')}
              {renderTrendChip(trendStats.totalEvents)}
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="dashboard-stat-card stat-card-with-banner" bodyStyle={{ padding: 0 }}>
            <div className="stat-card-banner banner-functions" />
            <div className="stat-card-body">
              <Statistic title="Upcoming Functions" value={stats.upcomingEvents} valueStyle={{ color: '#581c20' }} />
              {renderSparkline(kpiSparklineSeries.upcomingEvents, 'amber')}
              {renderTrendChip(trendStats.upcomingEvents)}
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="dashboard-stat-card stat-card-with-banner" bodyStyle={{ padding: 0 }}>
            <div className="stat-card-banner banner-guests" />
            <div className="stat-card-body">
              <Statistic title="Guest Families" value={stats.totalGuests} prefix={<TeamOutlined />} />
              {renderSparkline(kpiSparklineSeries.totalGuests, 'navy')}
              {renderTrendChip(trendStats.totalGuests)}
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="dashboard-stat-card stat-card-with-banner" bodyStyle={{ padding: 0 }}>
            <div className="stat-card-banner banner-budget" />
            <div className="stat-card-body">
              <Statistic
                title="Budget Planned"
                value={stats.totalBudget}
                formatter={(v) => formatCurrency(v)}
                valueStyle={{ color: '#2d1618' }}
              />
              {renderSparkline(kpiSparklineSeries.totalBudget, 'sage')}
              {renderTrendChip(trendStats.totalBudget)}
            </div>
          </Card>
        </Col>
      </Row>

      <Card
        className="events-card"
        style={{ marginTop: 20 }}
      >
        <div className="events-toolbar">
          <div className="events-toolbar-controls">{sortBar}</div>
          <Segmented
            value={eventViewMode}
            onChange={setEventViewMode}
            options={[
              { label: 'Detailed', value: 'table' },
              { label: 'Compact', value: 'compact' },
            ]}
          />
        </div>
        <Tabs defaultActiveKey="active" items={tabItems} />
      </Card>
    </Spin>
  );
};

/* ─── Vendor dashboard ─── */
const VendorDashboard = ({ user }) => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, pending: 0, confirmed: 0, revenue: 0 });

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await bookingService.getBookings();
        const bks = data.bookings || [];
        setBookings(bks);
        setStats({
          total: bks.length,
          pending: bks.filter((b) => b.status === 'pending').length,
          confirmed: bks.filter((b) => b.status === 'confirmed').length,
          revenue: bks
            .filter((b) => b.status === 'confirmed' || b.status === 'completed')
            .reduce((s, b) => s + Number(b.price ?? 0), 0),
        });
      } catch (err) {
        message.error(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const statusColor = { pending: 'orange', confirmed: 'green', cancelled: 'red', completed: 'blue' };

  const columns = [
    { title: 'Event', dataIndex: ['event', 'title'], key: 'event' },
    { title: 'Date', dataIndex: 'serviceDate', key: 'date', render: (d) => formatDate(d) },
    { title: 'Price', dataIndex: 'price', key: 'price', render: (p) => formatCurrency(p) },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (s) => <Tag color={statusColor[s]}>{s}</Tag> },
  ];

  return (
    <Spin spinning={loading}>
      <div className="dashboard-header">
        <h1>Vendor Console: {user?.name}</h1>
      </div>

      <Row gutter={[16, 16]} className="stats-grid">
        <Col xs={24} sm={12} md={6}>
          <Card className="dashboard-stat-card stat-card-with-banner" bodyStyle={{ padding: 0 }}>
            <div className="stat-card-banner banner-events" />
            <div className="stat-card-body">
              <Statistic title="Wedding Bookings" value={stats.total} prefix={<ShopOutlined />} />
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="dashboard-stat-card stat-card-with-banner" bodyStyle={{ padding: 0 }}>
            <div className="stat-card-banner banner-functions" />
            <div className="stat-card-body">
              <Statistic title="Pending Replies" value={stats.pending} valueStyle={{ color: '#581c20' }} />
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="dashboard-stat-card stat-card-with-banner" bodyStyle={{ padding: 0 }}>
            <div className="stat-card-banner banner-guests" />
            <div className="stat-card-body">
              <Statistic title="Confirmed" value={stats.confirmed} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#22c55e' }} />
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="dashboard-stat-card stat-card-with-banner" bodyStyle={{ padding: 0 }}>
            <div className="stat-card-banner banner-budget" />
            <div className="stat-card-body">
              <Statistic
                title="Confirmed Revenue"
                value={stats.revenue}
                formatter={(v) => formatCurrency(v)}
                valueStyle={{ color: '#2d1618' }}
              />
            </div>
          </Card>
        </Col>
      </Row>

      <Card title="Recent Booking Requests" style={{ marginTop: 24 }}>
        {bookings.length === 0
          ? <Empty description="No bookings yet. Customers will book you from the marketplace!" />
          : <Table dataSource={bookings} columns={columns} pagination={false} rowKey="id" scroll={{ x: 760 }} />}
      </Card>
      <Card style={{ marginTop: 24 }}>
        <Link to="/vendor/workspace"><Button type="primary">Manage Services, Packages, and Portfolio</Button></Link>
      </Card>
    </Spin>
  );
};

/* ─── Customer dashboard ─── */
const CustomerDashboard = ({ user }) => {
  const [events, setEvents] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [evtData, bkData] = await Promise.all([
          eventService.getEvents({ limit: 5 }),
          bookingService.getBookings(),
        ]);
        setEvents(evtData.events || []);
        setBookings(bkData.bookings || []);
      } catch (err) {
        message.error(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const statusColor = { pending: 'orange', confirmed: 'green', cancelled: 'red', completed: 'blue' };

  const eventCols = [
    { title: 'Event', dataIndex: 'title', key: 'title', render: (t, r) => <Link to={`/events/${r.id}`}>{t}</Link> },
    { title: 'Date', dataIndex: 'date', key: 'date', render: (d) => formatDate(d) },
    {
      title: 'Location',
      key: 'location',
      render: (_, r) => r.venue || [r.city, r.state].filter(Boolean).join(', ') || '—',
    },
  ];

  const bookingCols = [
    { title: 'Vendor', dataIndex: ['vendor', 'businessName'], key: 'vendor' },
    { title: 'Date', dataIndex: 'serviceDate', key: 'date', render: (d) => formatDate(d) },
    { title: 'Price', dataIndex: 'price', key: 'price', render: (p) => formatCurrency(p) },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (s) => <Tag color={statusColor[s]}>{s}</Tag> },
  ];

  const totalSpentInr = bookings
    .filter((b) => b.status !== 'cancelled')
    .reduce((s, b) => s + Number(b.price ?? 0), 0);

  return (
    <Spin spinning={loading}>
      <div className="dashboard-header">
        <h1>Family Dashboard: {user?.name}</h1>
        <Link to="/planner">
          <Button type="primary" size="large" icon={<PlusOutlined />}>Plan Wedding End-to-End</Button>
        </Link>
      </div>

      <Row gutter={[16, 16]} className="stats-grid">
        <Col xs={24} sm={8}>
          <Card className="dashboard-stat-card stat-card-with-banner" bodyStyle={{ padding: 0 }}>
            <div className="stat-card-banner banner-events" />
            <div className="stat-card-body">
              <Statistic title="My Functions" value={events.length} prefix={<CalendarOutlined />} />
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="dashboard-stat-card stat-card-with-banner" bodyStyle={{ padding: 0 }}>
            <div className="stat-card-banner banner-functions" />
            <div className="stat-card-body">
              <Statistic title="Active Bookings" value={bookings.filter(b => b.status === 'confirmed').length} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#22c55e' }} />
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="dashboard-stat-card stat-card-with-banner" bodyStyle={{ padding: 0 }}>
            <div className="stat-card-banner banner-budget" />
            <div className="stat-card-body">
              <Statistic
                title="Total Wedding Spend"
                value={totalSpentInr}
                formatter={(v) => formatCurrency(v)}
                valueStyle={{ color: '#2d1618' }}
              />
            </div>
          </Card>
        </Col>
      </Row>

      <Card title="My Wedding Events" style={{ marginTop: 24 }}>
        {events.length === 0
          ? <Empty description="No events yet. Create one to get started!" />
          : <Table dataSource={events} columns={eventCols} pagination={false} rowKey="id" scroll={{ x: 700 }} />}
      </Card>

      <Card title="My Vendor Bookings" style={{ marginTop: 24 }}>
        {bookings.length === 0
          ? <Empty description={<>No bookings yet. <Link to="/vendors">Browse vendors</Link> to find the perfect match!</>} />
          : <Table dataSource={bookings} columns={bookingCols} pagination={false} rowKey="id" scroll={{ x: 760 }} />}
      </Card>

      <Card style={{ marginTop: 24 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12}><Link to="/vendors"><Button block size="large">Find Wedding Vendors</Button></Link></Col>
          <Col xs={24} sm={12}><Link to="/bookings"><Button block size="large">Open All Bookings</Button></Link></Col>
          <Col xs={24} sm={12}><Link to="/planner"><Button block size="large">Build Final Quotation</Button></Link></Col>
        </Row>
      </Card>
    </Spin>
  );
};

/* ─── Guest dashboard (minimal) ─── */
const GuestDashboard = ({ user }) => (
  <>
    <div className="dashboard-header">
      <h1>Welcome, {user?.name}</h1>
    </div>
    <Card style={{ marginTop: 24 }}>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12}><Link to="/vendors"><Button block size="large">Browse Wedding Vendors</Button></Link></Col>
      </Row>
    </Card>
  </>
);

/* ─── Main Dashboard ─── */
const Dashboard = () => {
  const { user } = useContext(AuthContext);
  const role = user?.role;

  return (
    <Layout.Content className="dashboard-container">
      {role === 'vendor' && <VendorDashboard user={user} />}
      {role === 'guest' && <GuestDashboard user={user} />}
      {(role === 'admin' || role === 'organizer') && <OrganizerDashboard user={user} />}
      {role === 'customer' && <CustomerDashboard user={user} />}
    </Layout.Content>
  );
};

export default Dashboard;
