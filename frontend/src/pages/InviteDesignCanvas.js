import React, { useState, useCallback } from 'react';
import {
  Card,
  Row,
  Col,
  Button,
  Space,
  Input,
  Select,
  InputNumber,
  ColorPicker,
  Divider,
  Empty,
  Tag,
  Tooltip,
  Popconfirm,
  Form,
  Tabs,
  Slider,
  Switch,
} from 'antd';
import {
  DeleteOutlined,
  CopyOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  PlusOutlined,
  LockOutlined,
  UnlockOutlined,
} from '@ant-design/icons';
import './InviteDesignCanvas.css';

const InviteDesignCanvas = ({ layout = {}, templateMeta = null, onLayoutChange = () => {} }) => {
  const [elements, setElements] = useState(layout.elements || []);
  const [selectedElementId, setSelectedElementId] = useState(null);
  const [canvasSize, setCanvasSize] = useState(layout.canvasSize || '1080x1920');
  const [backgroundColor, setBackgroundColor] = useState(layout.backgroundColor || '#ffffff');
  const [showGrid, setShowGrid] = useState(false);

  const selectedElement = elements.find((el) => el.id === selectedElementId);

  // Generate unique ID
  const generateId = useCallback(() => `element-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`, []);

  // Add new element
  const handleAddElement = useCallback(
    (type) => {
      const newElement = {
        id: generateId(),
        type,
        locked: false,
        x: 20,
        y: 20,
        width: type === 'image' ? 200 : 300,
        height: type === 'image' ? 200 : 'auto',
        z: elements.length,
        ...(type === 'text' && {
          text: 'Click to edit',
          fontSize: 24,
          fontWeight: 'normal',
          color: '#000000',
          textAlign: 'left',
          fontFamily: 'Arial',
        }),
        ...(type === 'image' && {
          src: '',
          objectFit: 'cover',
        }),
        ...(type === 'shape' && {
          shapeType: 'rectangle',
          fillColor: '#667eea',
          strokeColor: '#000000',
          strokeWidth: 2,
          borderRadius: 0,
        }),
        ...(type === 'divider' && {
          color: '#cccccc',
          thickness: 2,
          orientation: 'horizontal',
        }),
      };

      const newElements = [...elements, newElement];
      setElements(newElements);
      setSelectedElementId(newElement.id);
      updateLayout(newElements);
    },
    [elements, generateId]
  );

  // Update element
  const handleUpdateElement = useCallback(
    (id, updates) => {
      const newElements = elements.map((el) =>
        el.id === id ? { ...el, ...updates } : el
      );
      setElements(newElements);
      updateLayout(newElements);
    },
    [elements]
  );

  // Delete element
  const handleDeleteElement = useCallback(
    (id) => {
      const newElements = elements.filter((el) => el.id !== id);
      setElements(newElements);
      setSelectedElementId(null);
      updateLayout(newElements);
    },
    [elements]
  );

  // Duplicate element
  const handleDuplicateElement = useCallback(
    (id) => {
      const original = elements.find((el) => el.id === id);
      if (!original) return;

      const duplicated = {
        ...original,
        id: generateId(),
        x: original.x + 20,
        y: original.y + 20,
        z: elements.length,
      };

      const newElements = [...elements, duplicated];
      setElements(newElements);
      setSelectedElementId(duplicated.id);
      updateLayout(newElements);
    },
    [elements, generateId]
  );

  // Reorder elements
  const handleReorder = useCallback(
    (id, direction) => {
      const index = elements.findIndex((el) => el.id === id);
      if (index === -1) return;

      const newElements = [...elements];
      if (direction === 'up' && index < newElements.length - 1) {
        [newElements[index], newElements[index + 1]] = [newElements[index + 1], newElements[index]];
      } else if (direction === 'down' && index > 0) {
        [newElements[index], newElements[index - 1]] = [newElements[index - 1], newElements[index]];
      }

      newElements.forEach((el, i) => {
        el.z = i;
      });

      setElements(newElements);
      updateLayout(newElements);
    },
    [elements]
  );

  // Update layout
  const updateLayout = (newElements) => {
    onLayoutChange({
      elements: newElements,
      canvasSize,
      backgroundColor,
      templateKey: layout.templateKey || null,
    });
  };

  // Parse canvas size
  const [canvasWidth, canvasHeight] = canvasSize.split('x').map(Number);
  const aspectRatio = canvasWidth / canvasHeight;
  const maxPreviewWidth = 300;
  const previewWidth = maxPreviewWidth;
  const previewHeight = maxPreviewWidth / aspectRatio;

  return (
    <div className="invite-design-canvas">
      <Row gutter={16}>
        {/* Left Panel - Element Manager */}
        <Col xs={24} lg={6}>
          <Card title="Elements & Layers" size="small">
            <Space direction="vertical" style={{ width: '100%' }} size={8}>
              <div>
                <div style={{ marginBottom: 8, fontWeight: 600 }}>Add Element</div>
                <Space wrap size="small">
                  <Button size="small" onClick={() => handleAddElement('text')}>
                    + Text
                  </Button>
                  <Button size="small" onClick={() => handleAddElement('image')}>
                    + Image
                  </Button>
                  <Button size="small" onClick={() => handleAddElement('shape')}>
                    + Shape
                  </Button>
                  <Button size="small" onClick={() => handleAddElement('divider')}>
                    + Line
                  </Button>
                </Space>
              </div>

              <Divider style={{ margin: '8px 0' }} />

              <div>
                <div style={{ marginBottom: 8, fontWeight: 600 }}>Layers</div>
                {elements.length === 0 ? (
                  <Empty description="No elements" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                ) : (
                  <div className="canvas-layers">
                    {elements.map((element) => (
                      <div
                        key={element.id}
                        className={`canvas-layer ${selectedElementId === element.id ? 'selected' : ''}`}
                        onClick={() => setSelectedElementId(element.id)}
                      >
                        <div className="layer-info">
                          <span className="layer-type">{element.type}</span>
                          <span className="layer-label">
                            {element.type === 'text' && element.text.substring(0, 20)}
                            {element.type === 'image' && 'Image'}
                            {element.type === 'shape' && element.shapeType}
                            {element.type === 'divider' && 'Divider'}
                          </span>
                        </div>
                        <div className="layer-actions">
                          <Tooltip title={element.locked ? 'Unlock' : 'Lock'}>
                            <Button
                              type="text"
                              size="small"
                              icon={element.locked ? <LockOutlined /> : <UnlockOutlined />}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUpdateElement(element.id, { locked: !element.locked });
                              }}
                            />
                          </Tooltip>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Space>
          </Card>
        </Col>

        {/* Center Panel - Canvas Preview */}
        <Col xs={24} lg={7}>
          <Card title="Canvas Preview" size="small">
            <div style={{ textAlign: 'center' }}>
              <div className="canvas-viewport">
                <div
                  className="invite-canvas"
                  style={{
                    width: previewWidth,
                    height: previewHeight,
                    backgroundColor,
                    position: 'relative',
                    overflow: 'hidden',
                    border: '1px solid #e0e0e0',
                    backgroundImage: showGrid
                      ? `linear-gradient(0deg, transparent 24%, rgba(0,0,0,.05) 25%, rgba(0,0,0,.05) 26%, transparent 27%, transparent 74%, rgba(0,0,0,.05) 75%, rgba(0,0,0,.05) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(0,0,0,.05) 25%, rgba(0,0,0,.05) 26%, transparent 27%, transparent 74%, rgba(0,0,0,.05) 75%, rgba(0,0,0,.05) 76%, transparent 77%, transparent)`
                      : 'none',
                    backgroundSize: showGrid ? '40px 40px' : 'auto',
                  }}
                >
                  {elements.map((element) => {
                    const scaleX = previewWidth / canvasWidth;
                    const scaleY = previewHeight / canvasHeight;

                    const style = {
                      position: 'absolute',
                      left: element.x * scaleX,
                      top: element.y * scaleY,
                      width: element.width * scaleX,
                      height: element.height === 'auto' ? 'auto' : element.height * scaleY,
                      zIndex: element.z,
                      opacity: selectedElementId === element.id ? 0.9 : 1,
                      cursor: element.locked ? 'default' : 'pointer',
                      border: selectedElementId === element.id ? '2px solid #667eea' : 'none',
                      boxSizing: 'border-box',
                    };

                    return (
                      <div
                        key={element.id}
                        style={style}
                        onClick={() => !element.locked && setSelectedElementId(element.id)}
                        className="canvas-element"
                      >
                        {element.type === 'text' && (
                          <span
                            style={{
                              fontSize: element.fontSize * scaleX,
                              fontWeight: element.fontWeight,
                              color: element.color,
                              fontFamily: element.fontFamily,
                              textAlign: element.textAlign,
                              display: 'block',
                              wordWrap: 'break-word',
                            }}
                          >
                            {element.text}
                          </span>
                        )}
                        {element.type === 'image' && (
                          <img
                            src={element.src || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23eee" width="200" height="200"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999" font-size="14"%3EImage%3C/text%3E%3C/svg%3E'}
                            alt="element"
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: element.objectFit,
                            }}
                          />
                        )}
                        {element.type === 'shape' && element.shapeType === 'rectangle' && (
                          <div
                            style={{
                              width: '100%',
                              height: '100%',
                              backgroundColor: element.fillColor,
                              border: `${element.strokeWidth}px solid ${element.strokeColor}`,
                              borderRadius: element.borderRadius,
                            }}
                          />
                        )}
                        {element.type === 'divider' && element.orientation === 'horizontal' && (
                          <div
                            style={{
                              width: '100%',
                              height: element.thickness,
                              backgroundColor: element.color,
                            }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ marginTop: 12, textAlign: 'center', fontSize: 12 }}>
                <Switch checked={showGrid} onChange={setShowGrid} /> Grid
              </div>
            </div>
          </Card>
        </Col>

        {/* Right Panel - Element Properties */}
        <Col xs={24} lg={11}>
          <Card title="Element Properties" size="small">
            {selectedElement ? (
              <Space direction="vertical" style={{ width: '100%' }} size={12}>
                <div>
                  <div style={{ marginBottom: 4, fontWeight: 600 }}>
                    {selectedElement.type.toUpperCase()} Element
                  </div>
                  <Tag color={selectedElement.locked ? 'red' : 'blue'}>
                    {selectedElement.locked ? 'LOCKED' : 'UNLOCKED'}
                  </Tag>
                </div>

                <Divider style={{ margin: '8px 0' }} />

                {/* Position & Size */}
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>Position & Size</div>
                  <Row gutter={8}>
                    <Col span={6}>
                      <label style={{ fontSize: 12 }}>X</label>
                      <InputNumber
                        size="small"
                        value={selectedElement.x}
                        onChange={(val) => handleUpdateElement(selectedElement.id, { x: val })}
                        disabled={selectedElement.locked}
                        style={{ width: '100%' }}
                      />
                    </Col>
                    <Col span={6}>
                      <label style={{ fontSize: 12 }}>Y</label>
                      <InputNumber
                        size="small"
                        value={selectedElement.y}
                        onChange={(val) => handleUpdateElement(selectedElement.id, { y: val })}
                        disabled={selectedElement.locked}
                        style={{ width: '100%' }}
                      />
                    </Col>
                    <Col span={6}>
                      <label style={{ fontSize: 12 }}>W</label>
                      <InputNumber
                        size="small"
                        value={selectedElement.width}
                        onChange={(val) => handleUpdateElement(selectedElement.id, { width: val })}
                        disabled={selectedElement.locked}
                        style={{ width: '100%' }}
                      />
                    </Col>
                    <Col span={6}>
                      <label style={{ fontSize: 12 }}>H</label>
                      <InputNumber
                        size="small"
                        value={selectedElement.height}
                        onChange={(val) => handleUpdateElement(selectedElement.id, { height: val })}
                        disabled={selectedElement.locked}
                        style={{ width: '100%' }}
                      />
                    </Col>
                  </Row>
                </div>

                {/* Text-specific properties */}
                {selectedElement.type === 'text' && (
                  <>
                    <Divider style={{ margin: '8px 0' }} />
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: 8 }}>Text Content</div>
                      <Input.TextArea
                        value={selectedElement.text}
                        onChange={(e) => handleUpdateElement(selectedElement.id, { text: e.target.value })}
                        rows={3}
                        size="small"
                        disabled={selectedElement.locked}
                      />
                    </div>

                    <div style={{ fontWeight: 600, marginBottom: 8 }}>Typography</div>
                    <Row gutter={8}>
                      <Col span={12}>
                        <label style={{ fontSize: 12 }}>Font Size</label>
                        <InputNumber
                          size="small"
                          value={selectedElement.fontSize}
                          onChange={(val) => handleUpdateElement(selectedElement.id, { fontSize: val })}
                          disabled={selectedElement.locked}
                          style={{ width: '100%' }}
                        />
                      </Col>
                      <Col span={12}>
                        <label style={{ fontSize: 12 }}>Font Family</label>
                        <Select
                          size="small"
                          value={selectedElement.fontFamily}
                          onChange={(val) => handleUpdateElement(selectedElement.id, { fontFamily: val })}
                          disabled={selectedElement.locked}
                          options={[
                            { value: 'Arial', label: 'Arial' },
                            { value: 'Georgia', label: 'Georgia' },
                            { value: 'Courier New', label: 'Courier New' },
                            { value: 'Times New Roman', label: 'Times New Roman' },
                            { value: 'Verdana', label: 'Verdana' },
                          ]}
                        />
                      </Col>
                    </Row>

                    <Row gutter={8} style={{ marginTop: 8 }}>
                      <Col span={12}>
                        <label style={{ fontSize: 12 }}>Weight</label>
                        <Select
                          size="small"
                          value={selectedElement.fontWeight}
                          onChange={(val) => handleUpdateElement(selectedElement.id, { fontWeight: val })}
                          disabled={selectedElement.locked}
                          options={[
                            { value: 'normal', label: 'Normal' },
                            { value: 'bold', label: 'Bold' },
                          ]}
                        />
                      </Col>
                      <Col span={12}>
                        <label style={{ fontSize: 12 }}>Align</label>
                        <Select
                          size="small"
                          value={selectedElement.textAlign}
                          onChange={(val) => handleUpdateElement(selectedElement.id, { textAlign: val })}
                          disabled={selectedElement.locked}
                          options={[
                            { value: 'left', label: 'Left' },
                            { value: 'center', label: 'Center' },
                            { value: 'right', label: 'Right' },
                          ]}
                        />
                      </Col>
                    </Row>

                    <div style={{ marginTop: 8 }}>
                      <label style={{ fontSize: 12 }}>Color</label>
                      <ColorPicker
                        value={selectedElement.color}
                        onChange={(color) =>
                          handleUpdateElement(selectedElement.id, { color: color.toHexString() })
                        }
                        disabled={selectedElement.locked}
                        style={{ marginTop: 4 }}
                      />
                    </div>
                  </>
                )}

                {/* Shape-specific properties */}
                {selectedElement.type === 'shape' && (
                  <>
                    <Divider style={{ margin: '8px 0' }} />
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: 8 }}>Shape Style</div>
                      <Row gutter={8}>
                        <Col span={12}>
                          <label style={{ fontSize: 12 }}>Shape Type</label>
                          <Select
                            size="small"
                            value={selectedElement.shapeType}
                            onChange={(val) => handleUpdateElement(selectedElement.id, { shapeType: val })}
                            disabled={selectedElement.locked}
                            options={[{ value: 'rectangle', label: 'Rectangle' }]}
                          />
                        </Col>
                        <Col span={12}>
                          <label style={{ fontSize: 12 }}>Border Radius</label>
                          <InputNumber
                            size="small"
                            value={selectedElement.borderRadius}
                            onChange={(val) => handleUpdateElement(selectedElement.id, { borderRadius: val })}
                            disabled={selectedElement.locked}
                            style={{ width: '100%' }}
                          />
                        </Col>
                      </Row>

                      <div style={{ marginTop: 8 }}>
                        <label style={{ fontSize: 12 }}>Fill Color</label>
                        <ColorPicker
                          value={selectedElement.fillColor}
                          onChange={(color) =>
                            handleUpdateElement(selectedElement.id, { fillColor: color.toHexString() })
                          }
                          disabled={selectedElement.locked}
                          style={{ marginTop: 4 }}
                        />
                      </div>

                      <div style={{ marginTop: 8 }}>
                        <label style={{ fontSize: 12 }}>Stroke Color</label>
                        <ColorPicker
                          value={selectedElement.strokeColor}
                          onChange={(color) =>
                            handleUpdateElement(selectedElement.id, { strokeColor: color.toHexString() })
                          }
                          disabled={selectedElement.locked}
                          style={{ marginTop: 4 }}
                        />
                      </div>

                      <div style={{ marginTop: 8 }}>
                        <label style={{ fontSize: 12 }}>Stroke Width</label>
                        <InputNumber
                          size="small"
                          value={selectedElement.strokeWidth}
                          onChange={(val) => handleUpdateElement(selectedElement.id, { strokeWidth: val })}
                          disabled={selectedElement.locked}
                          style={{ width: '100%' }}
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Image-specific properties */}
                {selectedElement.type === 'image' && (
                  <>
                    <Divider style={{ margin: '8px 0' }} />
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: 8 }}>Image</div>
                      <label style={{ fontSize: 12 }}>Image URL</label>
                      <Input
                        size="small"
                        value={selectedElement.src}
                        onChange={(e) => handleUpdateElement(selectedElement.id, { src: e.target.value })}
                        placeholder="https://example.com/image.jpg"
                        disabled={selectedElement.locked}
                        style={{ marginTop: 4 }}
                      />
                      <label style={{ fontSize: 12, display: 'block', marginTop: 8 }}>Object Fit</label>
                      <Select
                        size="small"
                        value={selectedElement.objectFit}
                        onChange={(val) => handleUpdateElement(selectedElement.id, { objectFit: val })}
                        disabled={selectedElement.locked}
                        options={[
                          { value: 'cover', label: 'Cover' },
                          { value: 'contain', label: 'Contain' },
                          { value: 'fill', label: 'Fill' },
                        ]}
                      />
                    </div>
                  </>
                )}

                {/* Divider-specific properties */}
                {selectedElement.type === 'divider' && (
                  <>
                    <Divider style={{ margin: '8px 0' }} />
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: 8 }}>Divider Style</div>
                      <Row gutter={8}>
                        <Col span={12}>
                          <label style={{ fontSize: 12 }}>Orientation</label>
                          <Select
                            size="small"
                            value={selectedElement.orientation}
                            onChange={(val) => handleUpdateElement(selectedElement.id, { orientation: val })}
                            disabled={selectedElement.locked}
                            options={[
                              { value: 'horizontal', label: 'Horizontal' },
                              { value: 'vertical', label: 'Vertical' },
                            ]}
                          />
                        </Col>
                        <Col span={12}>
                          <label style={{ fontSize: 12 }}>Thickness</label>
                          <InputNumber
                            size="small"
                            value={selectedElement.thickness}
                            onChange={(val) => handleUpdateElement(selectedElement.id, { thickness: val })}
                            disabled={selectedElement.locked}
                            style={{ width: '100%' }}
                          />
                        </Col>
                      </Row>

                      <div style={{ marginTop: 8 }}>
                        <label style={{ fontSize: 12 }}>Color</label>
                        <ColorPicker
                          value={selectedElement.color}
                          onChange={(color) =>
                            handleUpdateElement(selectedElement.id, { color: color.toHexString() })
                          }
                          disabled={selectedElement.locked}
                          style={{ marginTop: 4 }}
                        />
                      </div>
                    </div>
                  </>
                )}

                <Divider style={{ margin: '8px 0' }} />

                {/* Element Actions */}
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Actions</div>
                <Space wrap>
                  <Button
                    size="small"
                    icon={<CopyOutlined />}
                    onClick={() => handleDuplicateElement(selectedElement.id)}
                    disabled={selectedElement.locked}
                  >
                    Duplicate
                  </Button>
                  <Button
                    size="small"
                    icon={<ArrowUpOutlined />}
                    onClick={() => handleReorder(selectedElement.id, 'up')}
                    disabled={selectedElement.locked}
                  >
                    Bring Up
                  </Button>
                  <Button
                    size="small"
                    icon={<ArrowDownOutlined />}
                    onClick={() => handleReorder(selectedElement.id, 'down')}
                    disabled={selectedElement.locked}
                  >
                    Send Down
                  </Button>
                  <Popconfirm
                    title="Delete Element?"
                    description="This action cannot be undone."
                    onConfirm={() => handleDeleteElement(selectedElement.id)}
                    okText="Delete"
                    okType="danger"
                  >
                    <Button size="small" danger icon={<DeleteOutlined />} disabled={selectedElement.locked}>
                      Delete
                    </Button>
                  </Popconfirm>
                </Space>
              </Space>
            ) : (
              <Empty description="Select an element to edit" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </Card>

          {/* Canvas Settings */}
          <Card title="Canvas Settings" size="small" style={{ marginTop: 16 }}>
            <Space direction="vertical" style={{ width: '100%' }} size={8}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Canvas Size</label>
                <Select
                  value={canvasSize}
                  onChange={(val) => {
                    setCanvasSize(val);
                    updateLayout(elements);
                  }}
                  options={[
                    { value: '1080x1920', label: 'Portrait (1080x1920)' },
                    { value: '1920x1080', label: 'Landscape (1920x1080)' },
                    { value: '1080x1080', label: 'Square (1080x1080)' },
                  ]}
                  style={{ width: '100%', marginTop: 4 }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Background Color</label>
                <ColorPicker
                  value={backgroundColor}
                  onChange={(color) => {
                    setBackgroundColor(color.toHexString());
                    updateLayout(elements);
                  }}
                  style={{ marginTop: 4 }}
                />
              </div>
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default InviteDesignCanvas;
