import React, { useContext, useEffect, useState } from 'react';
import { Layout, Button, Card, Row, Col, Statistic, Table, Tag, message, Empty, Spin, Space } from 'antd';
import { PlusOutlined, CalendarOutlined, TeamOutlined, ShopOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { eventService } from '../services/eventService';
import { bookingService } from '../services/bookingService';
import { formatDate, formatCurrency, getErrorMessage } from '../utils/helpers';
import './Dashboard.css';

/* ─── Organizer / Admin dashboard ─── */
const OrganizerDashboard = ({ user }) => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalEvents: 0, upcomingEvents: 0, totalGuests: 0, totalBudget: 0 });

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await eventService.getEvents({ limit: 10 });
        const evts = data.events || [];
        setEvents(evts);
        const upcoming = evts.filter((e) => new Date(e.date) > new Date()).length;
        setStats({
          totalEvents: evts.length,
          upcomingEvents: upcoming,
          totalGuests: evts.reduce((s, e) => s + Number(e.guestCount || 0), 0),
          // Prisma/JSON often returns Decimal as string — must Number() or reduce string-concatenates
          totalBudget: evts.reduce((s, e) => s + Number(e.budget ?? 0), 0),
        });
      } catch (err) {
        message.error(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const columns = [
    { title: 'Event Name', dataIndex: 'title', key: 'title', render: (t, r) => <Link to={`/events/${r.id}`}>{t}</Link> },
    { title: 'Date', dataIndex: 'date', key: 'date', render: (d) => formatDate(d) },
    { title: 'Location', dataIndex: 'location', key: 'location' },
    { title: 'Budget', dataIndex: 'budget', key: 'budget', render: (b) => formatCurrency(b) },
    { title: 'Guests', dataIndex: 'guestCount', key: 'guestCount' },
    { title: 'Action', key: 'action', render: (_, r) => <Link to={`/events/${r.id}`}><Button type="link">View</Button></Link> },
  ];

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

      <Card title="Recent Events" className="events-card" style={{ marginTop: 24 }}>
        {events.length === 0
          ? <Empty description="No events yet. Create your first event!" />
          : <Table dataSource={events} columns={columns} pagination={false} rowKey="id" />}
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
    { title: 'Location', dataIndex: 'location', key: 'location' },
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

const OrganizerProgressDashboard = ({ user }) => (
  <>
    <div className="dashboard-header">
      <h1>Welcome, {user?.name}! 👋</h1>
      <Space>
        <Link to="/activities">
          <Button type="primary" size="large">Update Activity Progress</Button>
        </Link>
        <Link to="/contact-intelligence">
          <Button size="large">Contact Intelligence</Button>
        </Link>
      </Space>
    </div>
    <Card style={{ marginTop: 24 }}>
      <p>You can update progress for each activity and track actual spend for transparency.</p>
      <Space wrap>
        <Link to="/activities"><Button type="primary">Open Activity Tracker</Button></Link>
        <Link to="/contact-intelligence"><Button>Manage Invite Segments & WhatsApp</Button></Link>
      </Space>
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
      {role === 'organizer' && <OrganizerProgressDashboard user={user} />}
      {role === 'customer' && <CustomerDashboard user={user} />}
    </Layout.Content>
  );
};

export default Dashboard;
