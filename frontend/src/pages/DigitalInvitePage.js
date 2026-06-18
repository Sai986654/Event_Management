import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import Lottie from 'lottie-react';
import {
  CalendarOutlined,
  EnvironmentOutlined,
  CheckCircleOutlined,
  CompassOutlined,
  YoutubeOutlined,
  InfoCircleOutlined,
  SmileOutlined,
  CloseCircleOutlined,
  FrownOutlined,
} from '@ant-design/icons';
import { publicInviteService } from '../services/publicInviteService';
import './DigitalInvitePage.css';

/* ── Lottie Utilities ───────────────────────────────────────────────── */

const resolveLottieUrl = (source) => {
  if (!source) return '';
  if (typeof source === 'string') return source;
  if (typeof source === 'object' && typeof source.uri === 'string') return source.uri;
  return '';
};

const getLottieMirrorUrls = (url) => {
  const normalized = String(url || '').trim();
  if (!normalized) return [];

  const packageMatch = normalized.match(/\/packages\/([^/?#]+\.json)/i);
  if (!packageMatch?.[1]) {
    return [normalized];
  }

  const packageFile = packageMatch[1];
  const variants = Array.from({ length: 10 }, (_, index) => `https://assets${index + 1}.lottiefiles.com/packages/${packageFile}`);
  return [normalized, ...variants.filter((candidate) => candidate !== normalized)];
};

/* ── Google Calendar Generator ──────────────────────────────────────── */

const makeCalendarUrl = (event) => {
  if (!event || !event.date) return '';
  try {
    const start = new Date(event.date);
    const end = event.endDate ? new Date(event.endDate) : new Date(start.getTime() + 3 * 60 * 60 * 1000); // Default 3 hours

    const formatDate = (date) => {
      return date.toISOString().replace(/-|:|\.\d\d\d/g, "");
    };

    const details = event.description || `You are invited to ${event.title}!`;
    const location = [event.venue, event.address, event.city, event.state].filter(Boolean).join(', ');

    return `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${formatDate(start)}/${formatDate(end)}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(location)}`;
  } catch (error) {
    console.error('Error generating calendar url', error);
    return '';
  }
};

/* ── Main Component ─────────────────────────────────────────────────── */

const DigitalInvitePage = () => {
  const { inviteToken } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [inviteData, setInviteData] = useState(null);
  const [lottieDataMap, setLottieDataMap] = useState({});

  // RSVP Form States
  const [rsvpStatus, setRsvpStatus] = useState('pending');
  const [plusOnes, setPlusOnes] = useState(0);
  const [dietaryPreferences, setDietaryPreferences] = useState('');
  const [isSubmittingRsvp, setIsSubmittingRsvp] = useState(false);
  const [rsvpSuccess, setRsvpSuccess] = useState(false);

  // Scaled container width
  const cardContainerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(360);

  // Fetch Invite Data
  useEffect(() => {
    const fetchInvite = async () => {
      try {
        setLoading(true);
        const res = await publicInviteService.getInvite(inviteToken);
        setInviteData(res.data);
        if (res.data?.guest?.rsvpStatus) {
          setRsvpStatus(res.data.guest.rsvpStatus);
        }
        if (res.data?.guest?.plusOnes) {
          setPlusOnes(res.data.guest.plusOnes);
        }
        if (res.data?.guest?.dietaryPreferences) {
          setDietaryPreferences(res.data.guest.dietaryPreferences);
        }
        setError(null);
      } catch (err) {
        console.error('Error fetching public invite:', err);
        setError(err.response?.data?.message || 'Invitation not found. Please verify the URL.');
      } finally {
        setLoading(false);
      }
    };

    if (inviteToken) {
      fetchInvite();
    }
  }, [inviteToken]);

  // Handle Container Width Calculation for scaling canvas elements
  useEffect(() => {
    if (loading || !inviteData) return;

    const updateWidth = () => {
      if (cardContainerRef.current) {
        setContainerWidth(cardContainerRef.current.offsetWidth);
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    
    // Perform checking after a small delay to allow layouts to settle
    const timer = setTimeout(updateWidth, 300);

    return () => {
      window.removeEventListener('resize', updateWidth);
      clearTimeout(timer);
    };
  }, [loading, inviteData]);

  // Load Lottie animation files dynamically
  useEffect(() => {
    if (!inviteData?.resolvedLayout?.elements) return;

    const elements = inviteData.resolvedLayout.elements;
    const urls = Array.from(
      new Set(
        elements
          .filter((el) => el.type === 'lottie')
          .map((el) => resolveLottieUrl(el.lottieSource))
          .filter(Boolean)
      )
    );

    const missing = urls.filter((url) => !lottieDataMap[url]);
    if (!missing.length) return;

    let cancelled = false;

    Promise.all(
      missing.map(async (requestedUrl) => {
        const candidates = getLottieMirrorUrls(requestedUrl);
        for (const candidateUrl of candidates) {
          try {
            const response = await fetch(candidateUrl);
            if (!response.ok) continue;
            const json = await response.json();
            const hasFrames = Array.isArray(json?.layers) || Array.isArray(json?.assets);
            if (!hasFrames) continue;
            return [requestedUrl, candidateUrl, json];
          } catch (_error) {
            // Silently swallow errors to try mirror links
          }
        }
        return null;
      })
    ).then((results) => {
      if (cancelled) return;
      const entries = results.filter(Boolean);
      if (!entries.length) return;
      setLottieDataMap((prev) => {
        const next = { ...prev };
        entries.forEach(([requestedUrl, resolvedUrl, data]) => {
          if (!next[requestedUrl]) next[requestedUrl] = data;
          if (!next[resolvedUrl]) next[resolvedUrl] = data;
        });
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [inviteData, lottieDataMap]);

  // RSVP Form Submit Handler
  const handleRsvpSubmit = async (e) => {
    e.preventDefault();
    if (rsvpStatus === 'pending') return;

    try {
      setIsSubmittingRsvp(true);
      await publicInviteService.submitRsvp(inviteToken, {
        status: rsvpStatus,
        plusOnes: rsvpStatus === 'accepted' ? Number(plusOnes) : 0,
        dietaryPreferences: rsvpStatus === 'accepted' ? dietaryPreferences.trim() : '',
      });
      setRsvpSuccess(true);
      setTimeout(() => setRsvpSuccess(false), 5000);
    } catch (err) {
      console.error('Error submitting RSVP:', err);
      alert(err.response?.data?.message || 'Could not update RSVP. Please try again.');
    } finally {
      setIsSubmittingRsvp(false);
    }
  };

  // Action Click Handler from canvas elements
  const handleCanvasActionClick = (actionKind, customUrl) => {
    switch (actionKind) {
      case 'rsvp':
        document.getElementById('rsvp-section')?.scrollIntoView({ behavior: 'smooth' });
        break;
      case 'directions':
        if (inviteData?.mapUrl) {
          window.open(inviteData.mapUrl, '_blank');
        }
        break;
      case 'liveStream':
        if (customUrl) {
          window.open(customUrl, '_blank');
        } else if (inviteData?.event?.description?.includes('http')) {
          // Fallback guess from description or details
          const urlMatch = inviteData.event.description.match(/https?:\/\/[^\s]+/i);
          if (urlMatch?.[0]) window.open(urlMatch[0], '_blank');
        }
        break;
      case 'details':
        document.getElementById('microsite-section')?.scrollIntoView({ behavior: 'smooth' });
        break;
      case 'custom':
        if (customUrl) window.open(customUrl, '_blank');
        break;
      default:
        break;
    }
  };

  // ── Render States ──────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="loading-viewport">
        <div className="loading-spinner"></div>
        <p style={{ color: 'var(--text-muted)' }}>Loading invitation...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-viewport">
        <div className="error-card">
          <span className="error-icon">🥀</span>
          <h2 className="error-title">Invitation Error</h2>
          <p className="error-text">{error}</p>
          <a href="/" className="submit-btn" style={{ display: 'inline-block', textDecoration: 'none', textAlign: 'center' }}>
            Back to Home
          </a>
        </div>
      </div>
    );
  }

  const { guest, event, design, resolvedLayout } = inviteData;
  const [canvasWidth, canvasHeight] = (resolvedLayout?.canvasSize || '1080x1920').split('x').map(Number);
  const scale = containerWidth / canvasWidth;

  const bgStyle = resolvedLayout?.backgroundColor 
    ? { backgroundColor: resolvedLayout.backgroundColor } 
    : {};

  // Build calendar link
  const calendarUrl = makeCalendarUrl(event);

  // Generate dynamic floats
  const sparkles = Array.from({ length: 15 }, (_, i) => i);

  return (
    <div className="digital-invite-page">
      {/* Background Floats */}
      <div className="floating-decorations">
        {sparkles.map((i) => (
          <span
            key={i}
            className="floating-sparkle"
            style={{
              left: `${(i * 7) % 95}%`,
              animationDelay: `${i * 0.4}s`,
              animationDuration: `${6 + (i % 4)}s`,
              fontSize: `${12 + (i % 3) * 6}px`,
            }}
          >
            ✦
          </span>
        ))}
      </div>

      <div className="invite-container">
        {/* Left/Top: The Card Container */}
        <div className="invite-card-column">
          <div className="phone-mockup" ref={cardContainerRef}>
            <div className="canvas-viewport-container" style={bgStyle}>
              {resolvedLayout && resolvedLayout.elements ? (
                <div className="canvas-scaler" style={{ transform: `scale(${scale})` }}>
                  {resolvedLayout.elements.map((el) => {
                    const elStyle = {
                      position: 'absolute',
                      left: el.x,
                      top: el.y,
                      width: el.width,
                      height: el.height === 'auto' ? 'auto' : el.height,
                      zIndex: el.z || 1,
                    };

                    return (
                      <div key={el.id} style={elStyle} className="invite-canvas-scaler-element">
                        {el.type === 'text' && (
                          <span
                            style={{
                              fontSize: el.fontSize,
                              fontWeight: el.fontWeight,
                              color: el.color,
                              fontFamily: el.fontFamily,
                              textAlign: el.textAlign,
                              display: 'block',
                              wordWrap: 'break-word',
                              whiteSpace: 'pre-wrap',
                            }}
                          >
                            {el.text}
                          </span>
                        )}

                        {el.type === 'image' && (
                          <img
                            src={el.src || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23eee" width="200" height="200"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999" font-size="14"%3EImage%3C/text%3E%3C/svg%3E'}
                            alt="invitation-art"
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: el.objectFit || 'cover',
                            }}
                          />
                        )}

                        {el.type === 'shape' && el.shapeType === 'rectangle' && (
                          <div
                            style={{
                              width: '100%',
                              height: '100%',
                              backgroundColor: el.fillColor,
                              border: `${el.strokeWidth}px solid ${el.strokeColor}`,
                              borderRadius: el.borderRadius,
                            }}
                          />
                        )}

                        {el.type === 'divider' && el.orientation === 'horizontal' && (
                          <div
                            style={{
                              width: '100%',
                              height: el.thickness,
                              backgroundColor: el.color,
                            }}
                          />
                        )}

                        {el.type === 'lottie' && (
                          (() => {
                            const lottieUrl = resolveLottieUrl(el.lottieSource);
                            const animationData = lottieDataMap[lottieUrl];
                            if (!animationData) return null;
                            return (
                              <Lottie
                                animationData={animationData}
                                loop={el.loop !== false}
                                autoplay={el.autoPlay !== false}
                                style={{ width: '100%', height: '100%' }}
                              />
                            );
                          })()
                        )}

                        {el.type === 'action' && (
                          <button
                            onClick={() => handleCanvasActionClick(el.actionKind, el.url)}
                            className="invite-canvas-scaler-element interactive-action-element"
                            style={{
                              width: '100%',
                              height: '100%',
                              border: `${el.strokeWidth || 2}px solid ${el.strokeColor || '#c9b07d'}`,
                              borderRadius: el.borderRadius,
                              backgroundColor: el.fillColor || '#ffffff',
                              color: el.textColor || '#374151',
                              fontSize: el.fontSize,
                              fontWeight: el.fontWeight || 'bold',
                              fontFamily: el.fontFamily || 'Arial',
                              textAlign: el.textAlign || 'center',
                              boxShadow: '0 8px 16px rgba(120, 72, 20, 0.14)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: '0 8px',
                            }}
                          >
                            {el.label || 'Action'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Dynamic Fallback Card (Organizers haven't designed a layout yet) */
                <div className="fallback-invite-card">
                  <p className="accent-ornament">Welcome</p>
                  <div>
                    <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '2px', color: 'var(--primary-color)' }}>
                      Cordially Invited to
                    </span>
                    <h1 className="wedding-couple">{event?.title || 'Our Special Day'}</h1>
                    <div style={{ width: '50px', height: '1px', background: 'var(--primary-color)', margin: '12px auto' }}></div>
                  </div>
                  
                  <div>
                    <p style={{ fontSize: '14px', margin: '6px 0', fontWeight: '500' }}>{event?.dateText}</p>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0' }}>{event?.venue}</p>
                  </div>

                  <div className="invite-meta">
                    Dear {guest?.name}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right/Bottom: The Interactive RSVP and Microsite Details */}
        <div className="invite-details-column">
          
          {/* Guest Greeting Message */}
          <div className="glass-panel">
            <h2 className="greeting-title">Namaste</h2>
            <p className="personal-message">
              {guest?.personalizedInviteMessage || `We cordially invite you, ${guest?.name || 'our guest'}, to join us on our special occasion and bless us with your presence.`}
            </p>
            {guest?.relationship && (
              <p className="text-center mt-4" style={{ fontSize: '12px', color: 'var(--primary-color)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Relationship: {guest.relationship}
              </p>
            )}
          </div>

          {/* Interactive RSVP section */}
          <div className="glass-panel" id="rsvp-section">
            {rsvpSuccess ? (
              <div className="status-toast">
                <span className="success-icon">🎉</span>
                <h3 className="success-message">RSVP Submitted!</h3>
                <p className="success-subtext">Thank you for updating your status. We look forward to celebrating with you.</p>
                <button className="submit-btn" onClick={() => setRsvpSuccess(false)}>Update RSVP Again</button>
              </div>
            ) : (
              <form onSubmit={handleRsvpSubmit}>
                <h3 className="rsvp-section-title">Will You Attend?</h3>
                
                <div className="rsvp-status-selector">
                  <div 
                    className={`rsvp-status-card ${rsvpStatus === 'accepted' ? 'active' : ''}`}
                    onClick={() => setRsvpStatus('accepted')}
                  >
                    <span className="status-emoji">🌸</span>
                    <span className="status-label">Accept</span>
                  </div>

                  <div 
                    className={`rsvp-status-card ${rsvpStatus === 'maybe' ? 'active' : ''}`}
                    onClick={() => setRsvpStatus('maybe')}
                  >
                    <span className="status-emoji">🤔</span>
                    <span className="status-label">Maybe</span>
                  </div>

                  <div 
                    className={`rsvp-status-card ${rsvpStatus === 'declined' ? 'active' : ''}`}
                    onClick={() => setRsvpStatus('declined')}
                  >
                    <span className="status-emoji">🥀</span>
                    <span className="status-label">Decline</span>
                  </div>
                </div>

                {rsvpStatus === 'accepted' && (
                  <div style={{ animation: 'fadeIn 0.4s ease both' }}>
                    <div className="form-group">
                      <label className="form-label">Number of Additional Guests</label>
                      <select 
                        className="form-input"
                        value={plusOnes}
                        onChange={(e) => setPlusOnes(Number(e.target.value))}
                      >
                        {Array.from({ length: 6 }, (_, i) => (
                          <option key={i} value={i}>{i === 0 ? 'Just Me (0)' : `+${i} Guests`}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Dietary Preferences / Notes</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="e.g. Vegetarian, Gluten-Free, Allergies"
                        value={dietaryPreferences}
                        onChange={(e) => setDietaryPreferences(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                <button 
                  type="submit" 
                  className="submit-btn mt-4"
                  disabled={isSubmittingRsvp || rsvpStatus === 'pending'}
                >
                  {isSubmittingRsvp ? 'Submitting...' : 'Confirm Status'}
                </button>
              </form>
            )}
          </div>

          {/* Event Microsite Details */}
          <div className="glass-panel" id="microsite-section">
            <h3 className="microsite-section-title">Event Schedule</h3>
            
            <div className="event-details-grid">
              
              {/* Date / Time */}
              <div className="detail-item">
                <div className="detail-icon">
                  <CalendarOutlined />
                </div>
                <div className="detail-content">
                  <h4>When</h4>
                  <p>{event?.dateText || 'Date to be announced'}</p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{event?.timeText || 'Time to be announced'}</p>
                </div>
              </div>

              {/* Venue */}
              <div className="detail-item">
                <div className="detail-icon">
                  <EnvironmentOutlined />
                </div>
                <div className="detail-content">
                  <h4>Where</h4>
                  <p>{event?.venue || 'Venue to be announced'}</p>
                  <p className="address-line">
                    {[event?.address, event?.city, event?.state].filter(Boolean).join(', ')}
                  </p>
                </div>
              </div>

              {/* Event Details Description */}
              {event?.description && (
                <div className="detail-item">
                  <div className="detail-icon">
                    <InfoCircleOutlined />
                  </div>
                  <div className="detail-content">
                    <h4>About the Celebration</h4>
                    <p style={{ fontSize: '13px', lineHeight: '1.5', color: 'var(--text-muted)' }}>
                      {event.description}
                    </p>
                  </div>
                </div>
              )}

            </div>

            {/* Quick Interactive Actions */}
            <div className="link-action-buttons">
              {inviteData.mapUrl && (
                <a 
                  href={inviteData.mapUrl} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="action-link-btn"
                >
                  <CompassOutlined /> Get Venue Directions
                </a>
              )}

              {calendarUrl && (
                <a 
                  href={calendarUrl} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="action-link-btn"
                >
                  <CalendarOutlined /> Add to Google Calendar
                </a>
              )}

              {/* If there is a live stream link in resolved layout actions */}
              {resolvedLayout?.mergeData?.custom?.liveStreamUrl && (
                <a 
                  href={resolvedLayout.mergeData.custom.liveStreamUrl} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="action-link-btn"
                  style={{ borderColor: '#ff4d4f', color: '#ff4d4f' }}
                >
                  <YoutubeOutlined /> Join Event Live Stream
                </a>
              )}
            </div>

          </div>

        </div>
      </div>
    </div>
  );
};

export default DigitalInvitePage;
