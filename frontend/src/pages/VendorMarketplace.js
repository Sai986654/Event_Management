import React, { useState, useEffect } from 'react';
import { Input, Select, Card, Row, Col, Spin, message, Rate, Button, Empty, Tag } from 'antd';
import { SearchOutlined, ShopOutlined, CheckCircleOutlined, EnvironmentOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { vendorService } from '../services/vendorService';
import { formatCurrency, getErrorMessage } from '../utils/helpers';
import './VendorMarketplace.css';

const VendorMarketplace = () => {
  const navigate = useNavigate();
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [sortBy, setSortBy] = useState('top-rated');

  useEffect(() => {
    fetchVendors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, cityFilter]);

  const fetchVendors = async () => {
    try {
      setLoading(true);
      const params = {};
      if (selectedCategory) params.category = selectedCategory;
      if (cityFilter.trim()) params.city = cityFilter.trim();
      const data = await vendorService.searchVendors(params);
      setVendors(data.vendors || []);
    } catch (error) {
      message.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (value) => {
    setSearchTerm(value);
  };

  const filteredVendors = vendors
    .filter((vendor) =>
      vendor.businessName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vendor.description?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === 'top-rated') return Number(b.averageRating || 0) - Number(a.averageRating || 0);
      if (sortBy === 'price-low') return Number(a.basePrice || 0) - Number(b.basePrice || 0);
      if (sortBy === 'price-high') return Number(b.basePrice || 0) - Number(a.basePrice || 0);
      return 0;
    });

  const categories = [
    { label: 'All Categories', value: '' },
    { label: 'Catering', value: 'catering' },
    { label: 'Decor', value: 'decor' },
    { label: 'Photography', value: 'photography' },
    { label: 'Videography', value: 'videography' },
    { label: 'Music', value: 'music' },
    { label: 'Venue', value: 'venue' },
    { label: 'Florist', value: 'florist' },
    { label: 'Transportation', value: 'transportation' },
    { label: 'Other', value: 'other' },
  ];

  const getPackageRange = (vendor) => {
    const packages = Array.isArray(vendor.packages) ? vendor.packages : [];
    if (packages.length === 0) return null;
    const prices = packages.map((p) => p.price).sort((a, b) => a - b);
    return { min: prices[0], max: prices[prices.length - 1], count: packages.length };
  };

  return (
    <div className="vendor-marketplace-container">
      <div className="marketplace-header">
        <h1>Vendor Marketplace</h1>
        <p>Browse trusted vendors, compare packages, and book the perfect team for your event</p>
      </div>

      <Card className="filters-card">
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <Input
              placeholder="Search vendors by name or description..."
              prefix={<SearchOutlined />}
              size="large"
              onChange={(e) => handleSearch(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} md={6}>
            <Select
              placeholder="Filter by category"
              size="large"
              style={{ width: '100%' }}
              onChange={setSelectedCategory}
              value={selectedCategory || ''}
              options={categories}
            />
          </Col>
          <Col xs={24} md={5}>
            <Input
              placeholder="City or area"
              size="large"
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} md={5}>
            <Select
              size="large"
              style={{ width: '100%' }}
              value={sortBy}
              onChange={setSortBy}
              options={[
                { label: 'Top rated', value: 'top-rated' },
                { label: 'Price: Low to High', value: 'price-low' },
                { label: 'Price: High to Low', value: 'price-high' },
              ]}
            />
          </Col>
        </Row>
      </Card>

      <Spin spinning={loading}>
        {filteredVendors.length === 0 ? (
          <Empty description="No vendors found. Try adjusting your search or filters." />
        ) : (
          <Row gutter={[16, 16]} className="vendors-grid">
            {filteredVendors.map((vendor) => {
              const pkgRange = getPackageRange(vendor);
              return (
                <Col xs={24} sm={12} md={8} key={vendor.id}>
                  <Card
                    hoverable
                    className="vendor-card"
                    onClick={() => navigate(`/vendors/${vendor.id}`)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                      <ShopOutlined style={{ fontSize: 28, color: '#667eea' }} />
                      <div style={{ flex: 1 }}>
                        <h3 style={{ margin: 0 }}>
                          {vendor.businessName}
                          {vendor.isVerified && (
                            <CheckCircleOutlined style={{ color: '#52c41a', marginLeft: 6, fontSize: 14 }} />
                          )}
                        </h3>
                        <Tag color="blue" style={{ marginTop: 4 }}>{vendor.category}</Tag>
                      </div>
                    </div>

                    <p style={{ color: '#666', minHeight: 44, marginBottom: 12 }}>
                      {vendor.description?.substring(0, 100)}{vendor.description?.length > 100 ? '...' : ''}
                    </p>

                    <div className="vendor-rating" style={{ marginBottom: 8 }}>
                      <Rate disabled value={Number(vendor.averageRating) || 0} style={{ fontSize: 14 }} />
                      <span style={{ marginLeft: 8, color: '#888' }}>({vendor.totalReviews || 0})</span>
                    </div>

                    {vendor.city && (
                      <p style={{ color: '#888', margin: '4px 0' }}>
                        <EnvironmentOutlined /> {vendor.city}{vendor.state ? `, ${vendor.state}` : ''}
                      </p>
                    )}

                    <div className="vendor-pricing" style={{ marginTop: 12, padding: '8px 0', borderTop: '1px solid #f0f0f0' }}>
                      {pkgRange ? (
                        <>
                          <span style={{ fontSize: 18, fontWeight: 600, color: '#667eea' }}>
                            {formatCurrency(pkgRange.min)} – {formatCurrency(pkgRange.max)}
                          </span>
                          <Tag style={{ marginLeft: 8 }}>{pkgRange.count} packages</Tag>
                        </>
                      ) : (
                        <span style={{ fontSize: 18, fontWeight: 600, color: '#667eea' }}>
                          From {formatCurrency(vendor.basePrice)}
                        </span>
                      )}
                    </div>

                    <Button type="primary" block style={{ marginTop: 12 }}>
                      View Packages & Book
                    </Button>
                  </Card>
                </Col>
              );
            })}
          </Row>
        )}
      </Spin>
    </div>
  );
};

export default VendorMarketplace;
