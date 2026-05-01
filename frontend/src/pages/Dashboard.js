import React, { useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { Layout, Button, Card, Row, Col, Statistic, Table, Tag, Tabs, Select, Tooltip, message, Empty, Spin, Space, Badge } from 'antd';
import { PlusOutlined, CalendarOutlined, TeamOutlined, SortAscendingOutlined, SortDescendingOutlined, AimOutlined, ShopOutlined, CheckCircleOutlined } from '@ant-design/icons';
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

  // Segregate: active = at least 1 vendor booking, drafts = 0 bookings
  const activeEvents = useMemo(() => applySort(events.filter((e) => (e._count?.bookings || 0) > 0)), [events, applySort]);
  const draftEvents = useMemo(() => applySort(events.filter((e) => (e._count?.bookings || 0) === 0)), [events, applySort]);

  const columns = [
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
  ];

  const tabItems = [
    {
      key: 'active',
      label: (
        <span>
          Active Events <Badge count={activeEvents.length} style={{ backgroundColor: '#52c41a' }} showZero />
        </span>
      ),
      children: activeEvents.length === 0
        ? <Empty description="No active events yet. Book a vendor to see events here!" />
        : <Table dataSource={activeEvents} columns={columns} pagination={{ pageSize: 10 }} rowKey="id" />,
    },
    {
      key: 'drafts',
      label: (
        <span>
          Drafts <Badge count={draftEvents.length} style={{ backgroundColor: '#d9d9d9', color: '#666' }} showZero />
        </span>
      ),
      children: draftEvents.length === 0
        ? <Empty description="No draft events." />
        : <Table dataSource={draftEvents} columns={columns} pagination={{ pageSize: 10 }} rowKey="id" />,
    },
  ];

  const sortBar = (
    <Space>
      <Select
        value={sortBy}
        onChange={handleSortByChange}
        style={{ width: 150 }}
        options={[
          { value: 'date', label: 'Event Date' },
          { value: 'budget', label: 'Budget' },
          { value: 'createdAt', label: 'Listed Date' },
          { value: 'distance', label: 'Distance' },
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

  return (
    <Spin spinning={loading}>
      <div className="dashboard-header">
        <h1>Welcome, {user?.name}! 👋</h1>
        <Link to="/events/create">
          <Button type="primary" size="large" icon={<PlusOutlined />}>Create New Event</Button>
        </Link>
      </div>

      <Row gutter={[16, 16]} className="stats-grid">
        <Col xs={24} sm={12} md={6}><Card><Statistic title="Total Events" value={stats.totalEvents} prefix={<CalendarOutlined />} /></Card></Col>
        <Col xs={24} sm={12} md={6}><Card><Statistic title="Upcoming Events" value={stats.upcomingEvents} valueStyle={{ color: '#667eea' }} /></Card></Col>
        <Col xs={24} sm={12} md={6}><Card><Statistic title="Total Guests" value={stats.totalGuests} prefix={<TeamOutlined />} /></Card></Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Total Budget"
              value={stats.totalBudget}
              formatter={(v) => formatCurrency(v)}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      <Card
        style={{ marginTop: 24 }}
        extra={sortBar}
      >
        <Tabs defaultActiveKey="active" items={tabItems} />
      </Card>

      <Card className="quick-actions" style={{ marginTop: 24 }}>
        <h2>Quick Actions</h2>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={8}><Link to="/vendors"><Button block size="large">Browse Vendors</Button></Link></Col>
          <Col xs={24} sm={12} md={8}><Link to="/bookings"><Button block size="large">My Bookings</Button></Link></Col>
          {user?.role === 'admin' && (
            <Col xs={24} sm={12} md={8}><Link to="/admin/control-center"><Button block size="large">Admin Control Center</Button></Link></Col>
          )}
          {(user?.role === 'organizer' || user?.role === 'admin') && (
            <Col xs={24} sm={12} md={8}><Link to="/activities"><Button block size="large">Update Activities</Button></Link></Col>
          )}
        </Row>
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
        <h1>Welcome, {user?.name}! 👋</h1>
      </div>

      <Row gutter={[16, 16]} className="stats-grid">
        <Col xs={24} sm={12} md={6}><Card><Statistic title="Total Bookings" value={stats.total} prefix={<ShopOutlined />} /></Card></Col>
        <Col xs={24} sm={12} md={6}><Card><Statistic title="Pending" value={stats.pending} valueStyle={{ color: '#fa8c16' }} /></Card></Col>
        <Col xs={24} sm={12} md={6}><Card><Statistic title="Confirmed" value={stats.confirmed} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Revenue"
              value={stats.revenue}
              formatter={(v) => formatCurrency(v)}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      <Card title="Recent Bookings" style={{ marginTop: 24 }}>
        {bookings.length === 0
          ? <Empty description="No bookings yet. Customers will book you from the marketplace!" />
          : <Table dataSource={bookings} columns={columns} pagination={false} rowKey="id" />}
      </Card>
      <Card style={{ marginTop: 24 }}>
        <Link to="/vendor/workspace"><Button type="primary">Manage Services, Packages & Testimonials</Button></Link>
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
        <h1>Welcome, {user?.name}! 👋</h1>
        <Link to="/planner">
          <Button type="primary" size="large" icon={<PlusOutlined />}>Plan Event End-to-End</Button>
        </Link>
      </div>

      <Row gutter={[16, 16]} className="stats-grid">
        <Col xs={24} sm={8}><Card><Statistic title="My Events" value={events.length} prefix={<CalendarOutlined />} /></Card></Col>
        <Col xs={24} sm={8}><Card><Statistic title="Active Bookings" value={bookings.filter(b => b.status === 'confirmed').length} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Total Spent"
              value={totalSpentInr}
              formatter={(v) => formatCurrency(v)}
              valueStyle={{ color: '#667eea' }}
            />
          </Card>
        </Col>
      </Row>

      <Card title="My Events" style={{ marginTop: 24 }}>
        {events.length === 0
          ? <Empty description="No events yet. Create one to get started!" />
          : <Table dataSource={events} columns={eventCols} pagination={false} rowKey="id" />}
      </Card>

      <Card title="My Bookings" style={{ marginTop: 24 }}>
        {bookings.length === 0
          ? <Empty description={<>No bookings yet. <Link to="/vendors">Browse vendors</Link> to find the perfect match!</>} />
          : <Table dataSource={bookings} columns={bookingCols} pagination={false} rowKey="id" />}
      </Card>

      <Card style={{ marginTop: 24 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12}><Link to="/vendors"><Button block size="large">Browse Vendors</Button></Link></Col>
          <Col xs={24} sm={12}><Link to="/bookings"><Button block size="large">All Bookings</Button></Link></Col>
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
      <h1>Welcome, {user?.name}! 👋</h1>
    </div>
    <Card style={{ marginTop: 24 }}>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12}><Link to="/vendors"><Button block size="large">Browse Vendors</Button></Link></Col>
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
      {role === 'admin' && <OrganizerDashboard user={user} />}
      {role === 'organizer' && (
        <>
          <OrganizerDashboard user={user} />
          <Card title="Organizer tools" style={{ marginTop: 24 }}>
            <p style={{ marginBottom: 12, color: '#667085' }}>
              Track vendor activities, contact segments, and WhatsApp reminders from here.
            </p>
            <Space wrap>
              <Link to="/activities"><Button type="primary">Activity Tracker</Button></Link>
              <Link to="/contact-intelligence"><Button>Contact Intelligence &amp; WhatsApp</Button></Link>
              <Link to="/planner"><Button>Event Planner &amp; quotes</Button></Link>
            </Space>
          </Card>
        </>
      )}
      {role === 'customer' && <CustomerDashboard user={user} />}
    </Layout.Content>
  );
};

export default Dashboard;
