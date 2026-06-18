import React, { useState, useMemo } from 'react';
import { Card, Row, Col, Button, Tag, Space, Typography, Input, Select } from 'antd';
import { BgColorsOutlined, SearchOutlined } from '@ant-design/icons';
import './InviteTemplateGallery.css';

const { Title, Paragraph } = Typography;

const InviteTemplateGallery = ({
  templates = [],
  onSelect = () => {},
  onStartBlank = () => {},
  defaultEventType = 'all',
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(defaultEventType || 'all');


  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      const matchesSearch = 
        String(t.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(t.description || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCategory = 
        selectedCategory === 'all' || 
        String(t.ornamentStyle || '').toLowerCase() === selectedCategory ||
        String(t.templateEngine || '').toLowerCase() === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [templates, searchTerm, selectedCategory]);

  return (
    <div className="template-gallery-container">
      <div className="gallery-header">
        <div>
          <Title level={3} className="gallery-title">Choose Invitation Template</Title>
          <Paragraph className="gallery-subtitle">
            Select a designer template to start customizing, or design from scratch.
          </Paragraph>
        </div>
        <Button 
          type="dashed" 
          size="large"
          onClick={onStartBlank} 
          className="start-blank-btn"
        >
          ✦ Start Blank Canvas
        </Button>
      </div>

      {/* Filter Toolbar */}
      <div className="gallery-toolbar">
        <Input
          prefix={<SearchOutlined style={{ color: 'rgba(255,255,255,0.45)' }} />}
          placeholder="Search templates..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="gallery-search"
        />

        <Select
          value={selectedCategory}
          onChange={setSelectedCategory}
          className="gallery-filter"
          options={[
            { value: 'all', label: 'All Styles' },
            { value: 'traditional', label: 'Traditional' },
            { value: 'modern', label: 'Modern' },
            { value: 'classic', label: 'Classic' },
            { value: 'floral', label: 'Floral' },
          ]}
        />
      </div>

      {/* Grid of Templates */}
      {filteredTemplates.length > 0 ? (
        <Row gutter={[20, 20]} className="gallery-grid">
          {filteredTemplates.map((template) => {
            const preview = template.preview || {};
            const colors = [
              preview.background || '#ffffff',
              preview.accent || '#d4af37',
              preview.frame || '#4b2e16',
            ].filter(Boolean);

            return (
              <Col xs={24} sm={12} md={8} lg={6} key={template.key}>
                <Card 
                  hoverable
                  className="template-card"
                  cover={
                    <div className="template-preview-wrapper">
                      {template.previewImageUrl ? (
                        <img 
                          alt={template.name} 
                          src={template.previewImageUrl} 
                          className="template-preview-img"
                        />
                      ) : (
                        <div 
                          className="template-preview-fallback"
                          style={{
                            background: `linear-gradient(135deg, ${preview.background || '#151113'} 0%, ${preview.accent || '#2d2529'} 100%)`
                          }}
                        >
                          <span className="fallback-text">{template.name}</span>
                        </div>
                      )}
                      
                      {/* Hover Overlay */}
                      <div className="template-overlay">
                        <Button 
                          type="primary" 
                          size="middle"
                          onClick={() => onSelect(template)}
                          className="use-template-btn"
                        >
                          Use Template
                        </Button>
                      </div>
                    </div>
                  }
                >
                  <div className="template-card-meta">
                    <div className="template-meta-header">
                      <h4 className="template-name">{template.name}</h4>
                      {template.ornamentStyle && (
                        <Tag className="template-tag">
                          {template.ornamentStyle}
                        </Tag>
                      )}
                    </div>
                    
                    <Paragraph className="template-desc" ellipsis={{ rows: 2 }}>
                      {template.description || 'No description provided.'}
                    </Paragraph>

                    {/* Color Palette Dots */}
                    <div className="template-palette">
                      <span className="palette-label">Colors:</span>
                      <Space size={4}>
                        {colors.map((color, idx) => (
                          <span 
                            key={idx}
                            className="color-dot"
                            style={{ backgroundColor: color }}
                            title={color}
                          />
                        ))}
                      </Space>
                    </div>
                  </div>
                </Card>
              </Col>
            );
          })}
        </Row>
      ) : (
        <div className="gallery-empty">
          <BgColorsOutlined className="empty-icon" />
          <h3>No Templates Found</h3>
          <p>Try adjusting your search filters or start with a blank canvas.</p>
        </div>
      )}
    </div>
  );
};

export default InviteTemplateGallery;
