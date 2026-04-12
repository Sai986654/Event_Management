import React from 'react';
import { Layout } from 'antd';
import './Footer.css';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <Layout.Footer className="footer">
      <div className="footer-content">
        <div className="footer-section">
          <h3>Vedika 360</h3>
          <p>Technology-driven event management platform</p>
        </div>

        <div className="footer-section">
          <h4>Quick Links</h4>
          <ul>
            <li><a href="/about">About Us</a></li>
            <li><a href="/privacy">Privacy Policy</a></li>
            <li><a href="/terms">Terms of Service</a></li>
            <li><a href="/contact">Contact</a></li>
          </ul>
        </div>

        <div className="footer-section">
          <h4>Support</h4>
          <ul>
            <li><a href="/faq">FAQ</a></li>
            <li><a href="/support">Help Center</a></li>
            <li><a href="/blog">Blog</a></li>
          </ul>
        </div>
      </div>

      <div className="footer-bottom">
        <p>&copy; {currentYear} Vedika 360. All rights reserved.</p>
      </div>
    </Layout.Footer>
  );
};

export default Footer;
