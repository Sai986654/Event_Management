import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Card, Input, Spin } from 'antd';
import { CameraOutlined } from '@ant-design/icons';
import { instantPhotoService } from '../services/instantPhotoService';

const PhotoScanLanding = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const guestId = params.get('guestId');
  const eventId = params.get('eventId');
  const [loading, setLoading] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [error, setError] = useState(null);

  // If guestId and eventId are in the URL, auto-start session
  useEffect(() => {
    if (guestId && eventId) {
      startSession(Number(guestId), Number(eventId));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guestId, eventId]);

  const startSession = async (gId, eId) => {
    setLoading(true);
    setError(null);
    try {
      const res = await instantPhotoService.startSession(gId, eId);
      const code = res.session?.sessionCode;
      if (code) {
        navigate(`/photos/${code}`, { replace: true });
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to start session');
    } finally {
      setLoading(false);
    }
  };

  // If no guestId/eventId — show a fallback with session code entry
  if (!guestId || !eventId) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: 24 }}>
        <Card style={{ maxWidth: 400, width: '100%', borderRadius: 16, textAlign: 'center' }}>
          <CameraOutlined style={{ fontSize: 48, color: '#764ba2', marginBottom: 16 }} />
          <h2 style={{ marginBottom: 16 }}>Instant Photo Download</h2>
          <p style={{ color: '#666', marginBottom: 16 }}>Enter your session code to view your photos.</p>
          <Input.Search
            placeholder="Session code"
            enterButton="View Photos"
            size="large"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            onSearch={(val) => { if (val.trim()) navigate(`/photos/${val.trim()}`); }}
            style={{ borderRadius: 8 }}
          />
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
        <Card style={{ maxWidth: 400, textAlign: 'center', borderRadius: 16, padding: 24 }}>
          <Spin size="large" />
          <p style={{ marginTop: 16, color: '#666' }}>Starting your photo session...</p>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: 24 }}>
        <Card style={{ maxWidth: 400, textAlign: 'center', borderRadius: 16 }}>
          <CameraOutlined style={{ fontSize: 48, color: '#ff4d4f', marginBottom: 16 }} />
          <h2>Oops!</h2>
          <p style={{ color: '#666' }}>{error}</p>
          <Button type="primary" onClick={() => startSession(Number(guestId), Number(eventId))}>Try Again</Button>
        </Card>
      </div>
    );
  }

  return null;
};

export default PhotoScanLanding;
