import React from 'react';
import { Button, Row, Col, Card } from 'antd';
import { CalendarOutlined, UserOutlined, CheckCircleOutlined, ShopOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import './Home.css';

const Home = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: <CalendarOutlined style={{ fontSize: '48px', color: '#667eea' }} />,
      title: 'Event Planning',
      description: 'Create and manage events with real-time collaboration tools',
    },
    {
      icon: <UserOutlined style={{ fontSize: '48px', color: '#764ba2' }} />,
      title: 'Vendor Management',
      description: 'Connect with trusted vendors and manage bookings seamlessly',
    },
    {
      icon: <CheckCircleOutlined style={{ fontSize: '48px', color: '#52c41a' }} />,
      title: 'Guest Tracking',
      description: 'Manage RSVPs, check-ins, and guest communication effortlessly',
    },
    {
      icon: <ShopOutlined style={{ fontSize: '48px', color: '#faad14' }} />,
      title: 'Vendor Packages',
      description: 'Compare packages from top vendors and book with transparent pricing',
    },
  ];

  return (
    <div className="home-container">
      <section className="hero">
        <div className="hero-content">
          <h1>Welcome to Vedika 360</h1>
          <p>Rely on us for everything — the complete platform for planning and managing extraordinary events</p>
          <div className="hero-buttons">
            <Button type="primary" size="large" onClick={() => navigate('/register')}>
              Get Started
            </Button>
            <Button size="large" onClick={() => navigate('/vendors')}>
              Browse Vendors
            </Button>
          </div>
        </div>
      </section>

      <section className="features">
        <div className="section-header">
          <h2>Powerful Features</h2>
          <p>Everything you need to create amazing events</p>
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

      <section className="cta-section">
        <div className="cta-content">
          <h2>Ready to Create Your Next Event?</h2>
          <p>Join thousands of event organizers who rely on Vedika 360</p>
          <Button type="primary" size="large" onClick={() => navigate('/register')}>
            Start Planning Now
          </Button>
        </div>
      </section>

      <section className="how-it-works">
        <div className="section-header">
          <h2>How It Works</h2>
        </div>

        <Row gutter={[24, 24]} className="steps-grid">
          <Col xs={24} sm={12} md={6}>
            <Card className="step-card">
              <div className="step-number">1</div>
              <h3>Create Event</h3>
              <p>Set up your event details, date, and budget</p>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card className="step-card">
              <div className="step-number">2</div>
              <h3>Browse Packages</h3>
              <p>Compare vendor packages and pricing tiers</p>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card className="step-card">
              <div className="step-number">3</div>
              <h3>Book & Pay</h3>
              <p>Select a package and book your vendor instantly</p>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card className="step-card">
              <div className="step-number">4</div>
              <h3>Track Everything</h3>
              <p>Monitor bookings, guests, and events in real time</p>
            </Card>
          </Col>
        </Row>
      </section>
    </div>
  );
};

export default Home;
