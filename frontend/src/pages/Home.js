import React from 'react';
import { Button, Row, Col, Card } from 'antd';
import {
  CalendarOutlined,
  TeamOutlined,
  CheckCircleOutlined,
  ShopOutlined,
  CameraOutlined,
  VideoCameraOutlined,
  EnvironmentOutlined,
  BgColorsOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import './Home.css';

const Home = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: <CalendarOutlined style={{ fontSize: '42px', color: '#d4af37' }} />,
      title: 'Wedding Timeline Control',
      description: 'From Nischitartham to Reception, keep every Telugu ceremony perfectly coordinated.',
    },
    {
      icon: <TeamOutlined style={{ fontSize: '42px', color: '#d4af37' }} />,
      title: 'Family Collaboration',
      description: 'Bride, groom, mother, father, and planners stay in sync with simple shared actions.',
    },
    {
      icon: <CheckCircleOutlined style={{ fontSize: '42px', color: '#d4af37' }} />,
      title: 'Guest & Ritual Readiness',
      description: 'Track invites, RSVPs, welcome support, and function-wise responsibilities in one place.',
    },
    {
      icon: <ShopOutlined style={{ fontSize: '42px', color: '#d4af37' }} />,
      title: 'Trusted Vendor Marketplace',
      description: 'Discover premium Telugu wedding professionals with transparent pricing and availability.',
    },
  ];

  const vendorCategories = [
    { title: 'Photographers', icon: <CameraOutlined /> },
    { title: 'Videographers', icon: <VideoCameraOutlined /> },
    { title: 'Decorators', icon: <BgColorsOutlined /> },
    { title: 'Caterers', icon: <ShopOutlined /> },
    { title: 'Makeup Artists', icon: <TeamOutlined /> },
    { title: 'Event Anchors', icon: <CheckCircleOutlined /> },
    { title: 'Bands', icon: <CheckCircleOutlined /> },
    { title: 'Mandap Decorators', icon: <BgColorsOutlined /> },
    { title: 'Wedding Venues', icon: <EnvironmentOutlined /> },
    { title: 'Priests', icon: <TeamOutlined /> },
    { title: 'Travel Services', icon: <EnvironmentOutlined /> },
  ];

  return (
    <div className="home-container">
      <section className="hero">
        <div className="hero-ornament hero-ornament-left" aria-hidden="true" />
        <div className="hero-ornament hero-ornament-right" aria-hidden="true" />
        <div className="hero-content">
          <span className="hero-kicker">Premium Telugu Wedding Ecosystem</span>
          <h1>Vedika360</h1>
          <p>
            Plan every Telugu wedding moment with elegance. Organize families, vendors, rituals, and budgets
            from one warm and modern command center.
          </p>
          <div className="hero-buttons">
            <Button type="primary" size="large" onClick={() => navigate('/register')}>
              Start Wedding Planning
            </Button>
            <Button size="large" onClick={() => navigate('/vendors')}>
              Explore Vendor Marketplace
            </Button>
          </div>
        </div>
      </section>

      <section className="features">
        <div className="section-header">
          <h2>Built For Telugu Wedding Families</h2>
          <p>Traditional warmth with modern planning precision.</p>
        </div>

        <Row gutter={[24, 24]} className="features-grid">
          {features.map((feature, index) => (
            <Col xs={24} sm={12} md={6} key={index}>
              <Card className="feature-card">
                <div className="feature-icon">{feature.icon}</div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </Card>
            </Col>
          ))}
        </Row>
      </section>

      <section className="category-section">
        <div className="section-header">
          <h2>Premium Vendor Categories</h2>
          <p>Everything needed for a complete Telugu wedding celebration.</p>
        </div>

        <div className="category-grid">
          {vendorCategories.map((category) => (
            <div className="category-chip" key={category.title}>
              <span className="category-chip-icon">{category.icon}</span>
              <span>{category.title}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="cta-section">
        <div className="cta-content">
          <h2>Your Wedding, Fully Managed With Care</h2>
          <p>From first checklist to final send-off, Vedika360 keeps everyone aligned.</p>
          <Button type="primary" size="large" onClick={() => navigate('/register')}>
            Create My Wedding Workspace
          </Button>
        </div>
      </section>

      <section className="how-it-works">
        <div className="section-header">
          <h2>How Vedika360 Works</h2>
        </div>

        <Row gutter={[24, 24]} className="steps-grid">
          <Col xs={24} sm={12} md={6}>
            <Card className="step-card">
              <div className="step-number">1</div>
              <h3>Create Wedding Profile</h3>
              <p>Add wedding date, location, rituals, and family preferences.</p>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card className="step-card">
              <div className="step-number">2</div>
              <h3>Select Trusted Vendors</h3>
              <p>Compare photos, ratings, pricing, and shortlist with your family.</p>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card className="step-card">
              <div className="step-number">3</div>
              <h3>Confirm Budget & Bookings</h3>
              <p>Track payments, approvals, and confirmations with full transparency.</p>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card className="step-card">
              <div className="step-number">4</div>
              <h3>Run The Celebration Smoothly</h3>
              <p>Monitor timeline, guest flow, and vendor coordination on wedding day.</p>
            </Card>
          </Col>
        </Row>
      </section>
    </div>
  );
};

export default Home;
