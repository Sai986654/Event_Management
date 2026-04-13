import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button, Card, Col, Empty, Row, Spin, Tag } from 'antd';
import { CameraOutlined, CloudDownloadOutlined, WifiOutlined } from '@ant-design/icons';
import { instantPhotoService } from '../services/instantPhotoService';
import { socketService } from '../services/socketService';
import './PhaseFlows.css';

const LivePhotoWall = () => {
  const { eventId } = useParams();
  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [error, setError] = useState(null);

  const loadPhotos = useCallback(async () => {
    try {
      const res = await instantPhotoService.getLivePhotos(eventId, 5);
      setEvent(res.event);
      setPhotos(res.photos || []);
    } catch (err) {
      if (err.response?.status === 404) setError('Event not found.');
      else setError('Could not load photos. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    loadPhotos();
  }, [loadPhotos]);

  // Real-time: new photos appear instantly
  useEffect(() => {
    if (!eventId) return;
    const socket = socketService.connect();
    socket.emit('join-live-photos', eventId);

    const handleNewPhoto = (data) => {
      setPhotos((prev) => {
        const updated = [data.photo, ...prev];
        return updated.slice(0, 5); // keep only last 5
      });
    };
    socket.on('live-photo:new', handleNewPhoto);

    return () => {
      socket.off('live-photo:new', handleNewPhoto);
      socket.emit('leave-live-photos', eventId);
    };
  }, [eventId]);

  const downloadPhoto = (url, index) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = `photo-${index + 1}.jpg`;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: 24 }}>
        <Card style={{ maxWidth: 400, textAlign: 'center', borderRadius: 16 }}>
          <CameraOutlined style={{ fontSize: 48, color: '#999', marginBottom: 16 }} />
          <h2>{error}</h2>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '24px 16px' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        {/* Header */}
        <Card style={{ borderRadius: 16, marginBottom: 20, textAlign: 'center', background: 'rgba(255,255,255,0.95)' }}>
          <CameraOutlined style={{ fontSize: 36, color: '#764ba2', marginBottom: 8 }} />
          <h1 style={{ margin: '0 0 4px', fontSize: 20 }}>
            {event?.title || 'Event'} — Live Photos
          </h1>
          {event?.venue && <p style={{ margin: 0, color: '#888', fontSize: 13 }}>{event.venue}</p>}
          <Tag icon={<WifiOutlined />} color="green" style={{ marginTop: 8 }}>Live — last 5 photos</Tag>
        </Card>

        {/* Photos */}
        {photos.length === 0 ? (
          <Card style={{ borderRadius: 16, textAlign: 'center', padding: '40px 0' }}>
            <Empty
              image={<CameraOutlined style={{ fontSize: 64, color: '#ccc' }} />}
              description={
                <div>
                  <p style={{ fontSize: 16, color: '#666', marginBottom: 4 }}>No photos yet</p>
                  <p style={{ color: '#999' }}>Photos will appear here as the photographer clicks them.</p>
                </div>
              }
            />
          </Card>
        ) : (
          <Row gutter={[10, 10]}>
            {photos.map((photo, idx) => (
              <Col xs={idx === 0 ? 24 : 12} key={photo.id}>
                <Card
                  hoverable
                  style={{ borderRadius: 12, overflow: 'hidden', padding: 0 }}
                  bodyStyle={{ padding: 0 }}
                  cover={
                    <div style={{ position: 'relative' }}>
                      <img
                        alt={photo.caption || `Photo ${idx + 1}`}
                        src={photo.url}
                        style={{ width: '100%', aspectRatio: idx === 0 ? '16/10' : '1', objectFit: 'cover', display: 'block' }}
                      />
                      <Button
                        type="primary"
                        shape="circle"
                        icon={<CloudDownloadOutlined />}
                        onClick={() => downloadPhoto(photo.url, idx)}
                        style={{
                          position: 'absolute', bottom: 8, right: 8,
                          background: 'rgba(0,0,0,0.6)', border: 'none',
                        }}
                      />
                    </div>
                  }
                />
              </Col>
            ))}
          </Row>
        )}
      </div>
    </div>
  );
};

export default LivePhotoWall;
