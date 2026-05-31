import React, { useState, useEffect } from 'react';
import { Input, Select, Card, Row, Col, Spin, message, Rate, Button, Empty, Tag, Modal, Pagination } from 'antd';
import { SearchOutlined, ShopOutlined, CheckCircleOutlined, EnvironmentOutlined, CalendarOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { vendorService } from '../services/vendorService';
import { eventService } from '../services/eventService';
import { aiService } from '../services/aiService';
import LocationAutocomplete from '../components/LocationAutocomplete';
import { formatCurrency, getErrorMessage } from '../utils/helpers';
import './VendorMarketplace.css';

const VendorMarketplace = () => {
  const navigate = useNavigate();
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vendorPagination, setVendorPagination] = useState({ current: 1, pageSize: 12, total: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [sortBy, setSortBy] = useState('top-rated');
  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState();
  const [fitMap, setFitMap] = useState({});
  const [compareTarget, setCompareTarget] = useState(null);

  useEffect(() => {
    eventService.getEvents({ limit: 100 })
      .then((data) => setEvents(data.events || []))
      .catch(() => setEvents([]));
  }, []);

  useEffect(() => {
    if (!eventId) {
      setFitMap({});
      return;
    }
    aiService.getVendorFitScores(eventId, selectedCategory || undefined)
      .then((res) => {
        const map = (res.fit || []).reduce((acc, row) => {
          acc[row.vendorId] = row;
          return acc;
        }, {});
        setFitMap(map);
      })
      .catch(() => setFitMap({}));
  }, [eventId, selectedCategory]);

  useEffect(() => {
    setVendorPagination({ current: 1, pageSize: vendorPagination.pageSize, total: 0 });
    fetchVendors(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, locationFilter, stateFilter]);

  const fetchVendors = async (page = 1) => {
    try {
      setLoading(true);
      const params = { page, limit: vendorPagination.pageSize };
      if (selectedCategory) params.category = selectedCategory;
      if (locationFilter.trim()) params.city = locationFilter.trim();
      if (stateFilter) params.state = stateFilter;
      const data = await vendorService.searchVendors(params);
      setVendors(data.vendors || []);
      setVendorPagination({ current: page, pageSize: vendorPagination.pageSize, total: data.total || 0 });
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
      if (sortBy === 'fit-score') {
        return Number(fitMap[b.id]?.fitScore || 0) - Number(fitMap[a.id]?.fitScore || 0);
      }
      if (sortBy === 'top-rated') return Number(b.averageRating || 0) - Number(a.averageRating || 0);
      if (sortBy === 'price-low') return Number(a.basePrice || 0) - Number(b.basePrice || 0);
      if (sortBy === 'price-high') return Number(b.basePrice || 0) - Number(a.basePrice || 0);
      return 0;
    });

  const categories = [
    { label: 'All Categories', value: '' },
    { label: 'Photographers', value: 'photography' },
    { label: 'Videographers', value: 'videography' },
    { label: 'Decorators', value: 'decor' },
    { label: 'Caterers', value: 'catering' },
    { label: 'Makeup Artists', value: 'other' },
    { label: 'Event Anchors', value: 'music' },
    { label: 'Bands', value: 'music' },
    { label: 'Mandap Decorators', value: 'decor' },
    { label: 'Wedding Venues', value: 'venue' },
    { label: 'Priests', value: 'other' },
    { label: 'Travel Services', value: 'transportation' },
  ];

  const stateOptions = [
    { label: 'All States', value: '' },
    { label: 'Telangana', value: 'Telangana' },
    { label: 'Andhra Pradesh', value: 'Andhra Pradesh' },
    { label: 'Karnataka', value: 'Karnataka' },
    { label: 'Tamil Nadu', value: 'Tamil Nadu' },
    { label: 'Maharashtra', value: 'Maharashtra' },
    { label: 'Delhi', value: 'Delhi' },
    { label: 'Gujarat', value: 'Gujarat' },
    { label: 'Rajasthan', value: 'Rajasthan' },
    { label: 'Uttar Pradesh', value: 'Uttar Pradesh' },
    { label: 'West Bengal', value: 'West Bengal' },
  ];

  const getPackageRange = (vendor) => {
    const packages = Array.isArray(vendor.packages) ? vendor.packages : [];
    if (packages.length === 0) return null;
    const prices = packages.map((p) => Number(p.basePrice ?? p.price ?? 0)).sort((a, b) => a - b);
    return { min: prices[0], max: prices[prices.length - 1], count: packages.length };
  };

  const getVendorPhoto = (vendor) => {
    const firstGalleryUrl = Array.isArray(vendor.gallery)
      ? (vendor.gallery[0]?.url || vendor.gallery[0]?.imageUrl)
      : undefined;

    return vendor.coverImageUrl
      || vendor.coverImage
      || vendor.profileImage
      || vendor.imageUrl
      || firstGalleryUrl
      || undefined;
  };

  const getAvailabilityLabel = (vendor) => {
    if (vendor.availabilityStatus) return vendor.availabilityStatus;
    if (typeof vendor.isAvailable === 'boolean') return vendor.isAvailable ? 'Open Dates' : 'Limited Availability';
    if (vendor.availability) return String(vendor.availability);
    return 'Open Dates';
  };

  const recommendations = (() => {
    if (!eventId || !filteredVendors.length) return null;

    const byFit = [...filteredVendors].sort((a, b) => Number(fitMap[b.id]?.fitScore || 0) - Number(fitMap[a.id]?.fitScore || 0));
    const bestFit = byFit[0] || null;
    const bestValue = [...filteredVendors].sort((a, b) => Number(a.basePrice || 0) - Number(b.basePrice || 0))[0] || null;
    const premium = [...filteredVendors]
      .sort((a, b) => {
        const left = Number(a.averageRating || 0) * 100 + (a.isVerified ? 10 : 0) + Number(a.basePrice || 0) / 1000;
        const right = Number(b.averageRating || 0) * 100 + (b.isVerified ? 10 : 0) + Number(b.basePrice || 0) / 1000;
        return right - left;
      })[0] || null;

    return { bestFit, bestValue, premium };
  })();

  return (
    <div className="vendor-marketplace-container">
      <div className="marketplace-header">
        <h1>Wedding Vendor Marketplace</h1>
        <p>Curated Telugu wedding professionals for families, couples, and planners.</p>
      </div>

      <Card className="filters-card">
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}>
            <Select
              placeholder="Event DNA (optional)"
              size="large"
              style={{ width: '100%' }}
              value={eventId}
              onChange={setEventId}
              allowClear
              options={events.map((event) => ({ value: event.id, label: event.title }))}
            />
          </Col>
          <Col xs={24} sm={12} lg={8}>
            <Input
              placeholder="Search vendors by name, service, or specialization"
              prefix={<SearchOutlined />}
              size="large"
              onChange={(e) => handleSearch(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} sm={12} lg={4}>
            <Select
              placeholder="Category"
              size="large"
              style={{ width: '100%' }}
              onChange={setSelectedCategory}
              value={selectedCategory || ''}
              options={categories}
            />
          </Col>
          <Col xs={24} sm={12} lg={4}>
            <LocationAutocomplete
              value={locationFilter}
              onChange={(v) => setLocationFilter(v || '')}
              onLocationPick={(place) => {
                setLocationFilter(place?.city || place?.formattedAddress || '');
                if (place?.state) setStateFilter(place.state);
              }}
              placeholder="Location (city/area/state)"
            />
          </Col>
          <Col xs={24} sm={12} lg={4}>
            <Select
              size="large"
              style={{ width: '100%' }}
              value={stateFilter}
              onChange={setStateFilter}
              options={stateOptions}
            />
          </Col>
          <Col xs={24} sm={12} lg={4}>
            <Select
              size="large"
              style={{ width: '100%' }}
              value={sortBy}
              onChange={setSortBy}
              options={[
                { label: 'Best fit score', value: 'fit-score' },
                { label: 'Top rated', value: 'top-rated' },
                { label: 'Price: Low to High', value: 'price-low' },
                { label: 'Price: High to Low', value: 'price-high' },
              ]}
            />
          </Col>
        </Row>
      </Card>

      {recommendations ? (
        <Row gutter={[12, 12]} className="marketplace-ai-picks">
          <Col xs={24} md={8}>
            <Card className="marketplace-ai-pick-card">
              <div className="marketplace-ai-label">Best Fit</div>
              <h3>{recommendations.bestFit?.businessName || '—'}</h3>
              <p>Fit score: {fitMap[recommendations.bestFit?.id]?.fitScore || 0}/100</p>
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card className="marketplace-ai-pick-card">
              <div className="marketplace-ai-label">Best Value</div>
              <h3>{recommendations.bestValue?.businessName || '—'}</h3>
              <p>From {formatCurrency(recommendations.bestValue?.basePrice || 0)}</p>
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card className="marketplace-ai-pick-card">
              <div className="marketplace-ai-label">Premium Pick</div>
              <h3>{recommendations.premium?.businessName || '—'}</h3>
              <p>Rating {Number(recommendations.premium?.averageRating || 0).toFixed(1)}</p>
            </Card>
          </Col>
        </Row>
      ) : null}

      <Spin spinning={loading}>
        {filteredVendors.length === 0 ? (
          <Empty description="No vendors found. Try adjusting your search or filters." />
        ) : (
          <>
            <Row gutter={[16, 16]} className="vendors-grid">
              {filteredVendors.map((vendor) => {
                const pkgRange = getPackageRange(vendor);
                  const vendorPhoto = getVendorPhoto(vendor);
                  const availability = getAvailabilityLabel(vendor);
                return (
                  <Col xs={24} sm={12} md={8} key={vendor.id}>
                  <Card
                    hoverable
                    className="vendor-card"
                    onClick={() => navigate(`/vendors/${vendor.id}`)}
                  >
                    <div className="vendor-media-wrap">
                      {vendorPhoto ? (
                        <img className="vendor-media" src={vendorPhoto} alt={vendor.businessName} />
                      ) : (
                        <div className="vendor-media vendor-media-fallback">
                          <ShopOutlined />
                        </div>
                      )}
                      <div className="vendor-media-overlay">
                        <Tag className="vendor-overlay-tag" icon={<CalendarOutlined />}>
                          {availability}
                        </Tag>
                      </div>
                    </div>

                    <div className="vendor-card-header-row">
                      <div style={{ flex: 1 }}>
                        <h3 className="vendor-title" style={{ margin: 0 }}>
                          {vendor.businessName}
                          {vendor.isVerified && (
                            <CheckCircleOutlined style={{ color: '#22c55e', marginLeft: 6, fontSize: 14 }} />
                          )}
                        </h3>
                        <Tag color="gold" style={{ marginTop: 4 }}>{vendor.specialization || vendor.category || 'Wedding Service'}</Tag>
                        {fitMap[vendor.id] ? (
                          <Tag color={fitMap[vendor.id].fitScore >= 80 ? 'green' : fitMap[vendor.id].fitScore >= 60 ? 'gold' : 'default'} style={{ marginTop: 4 }}>
                            Fit {fitMap[vendor.id].fitScore}/100
                          </Tag>
                        ) : null}
                      </div>
                    </div>

                    <p className="vendor-description" style={{ minHeight: 44, marginBottom: 12 }}>
                      {vendor.description?.substring(0, 100)}{vendor.description?.length > 100 ? '...' : ''}
                    </p>

                    <div className="vendor-rating" style={{ marginBottom: 8 }}>
                      <Rate disabled value={Number(vendor.averageRating) || 0} style={{ fontSize: 14 }} />
                      <span style={{ marginLeft: 8, color: '#78808d' }}>({vendor.totalReviews || 0})</span>
                    </div>

                    {vendor.city && (
                      <p className="vendor-location" style={{ margin: '4px 0' }}>
                        <EnvironmentOutlined /> {vendor.city}{vendor.state ? `, ${vendor.state}` : ''}
                      </p>
                    )}

                    {vendor.experienceYears ? (
                      <p className="vendor-location" style={{ margin: '4px 0' }}>
                        {vendor.experienceYears}+ years wedding experience
                      </p>
                    ) : null}

                    <div className="vendor-pricing" style={{ marginTop: 12, padding: '8px 0', borderTop: '1px solid #f0f0f0' }}>
                      {pkgRange ? (
                        <>
                          <span style={{ fontSize: 18, fontWeight: 600, color: '#5e4716' }}>
                            {formatCurrency(pkgRange.min)} – {formatCurrency(pkgRange.max)}
                          </span>
                          <Tag style={{ marginLeft: 8 }}>{pkgRange.count} packages</Tag>
                        </>
                      ) : (
                        <span style={{ fontSize: 18, fontWeight: 600, color: '#5e4716' }}>
                          From {formatCurrency(vendor.basePrice)}
                        </span>
                      )}
                    </div>

                    {fitMap[vendor.id]?.reasons?.[0] ? (
                      <p style={{ marginTop: 8, color: '#3f5f7d', minHeight: 22 }}>
                        {fitMap[vendor.id].reasons[0]}
                      </p>
                    ) : null}

                    <Button type="primary" block style={{ marginTop: 12 }} onClick={(e) => { e.stopPropagation(); navigate(`/vendors/${vendor.id}`); }}>
                      View Packages & Book
                    </Button>
                    {recommendations?.bestFit && recommendations.bestFit.id !== vendor.id ? (
                      <Button type="default" block style={{ marginTop: 8 }} onClick={(e) => { e.stopPropagation(); setCompareTarget(vendor); }}>
                        Why not this vendor?
                      </Button>
                    ) : null}
                  </Card>
                </Col>
              );
            })}
            </Row>
            <div style={{ marginTop: 24, textAlign: 'center' }}>
              <Pagination
                current={vendorPagination.current}
                pageSize={vendorPagination.pageSize}
                total={vendorPagination.total}
                onChange={(page) => fetchVendors(page)}
                style={{ marginTop: 24 }}
              />
            </div>
          </>
        )}
      </Spin>

      <Modal
        open={Boolean(compareTarget)}
        onCancel={() => setCompareTarget(null)}
        footer={null}
        title="Fit Comparison"
      >
        {compareTarget && recommendations?.bestFit ? (
          <div>
            <p><strong>Selected:</strong> {compareTarget.businessName} (Fit {fitMap[compareTarget.id]?.fitScore || 0}/100)</p>
            <p><strong>Best Fit:</strong> {recommendations.bestFit.businessName} (Fit {fitMap[recommendations.bestFit.id]?.fitScore || 0}/100)</p>
            <p><strong>Why best fit:</strong> {fitMap[recommendations.bestFit.id]?.reasons?.[0] || 'Better alignment for this event'}</p>
            <p><strong>Current vendor note:</strong> {fitMap[compareTarget.id]?.reasons?.[0] || 'Can still be a good option depending on your preferences.'}</p>
          </div>
        ) : null}
      </Modal>
    </div>
  );
};

export default VendorMarketplace;
