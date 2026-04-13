import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button, Card, Col, Image, Input, QRCode, Row, Space, Upload, message } from 'antd';
import { CameraOutlined, UploadOutlined } from '@ant-design/icons';
import { instantPhotoService } from '../services/instantPhotoService';
import { eventService } from '../services/eventService';
import './PhaseFlows.css';

const PhotoBooth = () => {
  const { eventId } = useParams();
  const [event, setEvent] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [recentPhotos, setRecentPhotos] = useState([]);

  const loadData = useCallback(async () => {
    try {
      const [evtRes, photoRes] = await Promise.all([
        eventService.getEvent(eventId),
        instantPhotoService.getLivePhotos(eventId, 10),
      ]);
      setEvent(evtRes.event || evtRes);
      setRecentPhotos(photoRes.photos || []);
    } catch (err) {
      message.error('Failed to load event');
    }
  }, [eventId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleUpload = async ({ file }) => {
    setUploading(true);
    try {
      const res = await instantPhotoService.uploadPhoto(eventId, file);
      setRecentPhotos((prev) => [res.photo, ...prev].slice(0, 10));
      message.success('Photo uploaded & sent live!');
    } catch (err) {
      message.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const liveUrl = `${window.location.origin}/live-photos/${eventId}`;

  return (
    <div className="phase-page">
      <Row gutter={[16, 16]}>
        {/* Header */}
        <Col span={24}>
          <Card className="phase-hero">
            <h1 className="phase-title"><CameraOutlined /> Photo Booth — {event?.title || 'Event'}</h1>
            <p className="phase-subtitle">Upload photos here. Guests scan the QR code on the board to see the last 5 photos live.</p>
          </Card>
        </Col>

        {/* QR Code for the board */}
        <Col xs={24} md={8}>
          <Card className="phase-card" title="QR Code for Display Board" style={{ textAlign: 'center' }}>
            <QRCode value={liveUrl} size={200} style={{ margin: '0 auto' }} />
            <p style={{ marginTop: 12, color: '#666', fontSize: 13 }}>
              Print this QR and place it on the board at the downstage.
            </p>
            <Input
              readOnly
              value={liveUrl}
              style={{ marginTop: 8, textAlign: 'center', fontSize: 12 }}
              onClick={(e) => { e.target.select(); navigator.clipboard?.writeText(e.target.value); message.success('Link copied'); }}
            />
          </Card>
        </Col>

        {/* Upload area */}
        <Col xs={24} md={16}>
          <Card className="phase-card" title="Upload Photos">
            <Space direction="vertical" style={{ width: '100%' }} size={16}>
              <Upload
                accept="image/*"
                multiple
                showUploadList={false}
                customRequest={handleUpload}
                disabled={uploading}
              >
                <Button
                  type="primary"
                  icon={<UploadOutlined />}
                  loading={uploading}
                  size="large"
                  block
                  style={{ height: 56, fontSize: 16, borderRadius: 12 }}
                >
                  {uploading ? 'Uploading...' : 'Upload Photo(s)'}
                </Button>
              </Upload>

              <Upload
                accept="image/*"
                capture="environment"
                showUploadList={false}
                customRequest={handleUpload}
                disabled={uploading}
              >
                <Button
                  icon={<CameraOutlined />}
                  block
                  style={{ height: 48, borderRadius: 12 }}
                >
                  Take Photo with Camera
                </Button>
              </Upload>
            </Space>

            <h4 style={{ marginTop: 24, marginBottom: 12 }}>Recently Uploaded ({recentPhotos.length})</h4>
            {recentPhotos.length === 0 ? (
              <p style={{ color: '#999' }}>No photos uploaded yet.</p>
            ) : (
              <Row gutter={[8, 8]}>
                {recentPhotos.map((p) => (
                  <Col xs={8} sm={6} key={p.id}>
                    <Image
                      src={p.url}
                      alt="Uploaded"
                      style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 8 }}
                      preview={{ src: p.url }}
                    />
                  </Col>
                ))}
              </Row>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default PhotoBooth;
