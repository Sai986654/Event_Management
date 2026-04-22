import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Button, Input, Spin, Typography, Space } from 'antd';
import { HeartOutlined, LockOutlined, LoadingOutlined } from '@ant-design/icons';
import { surpriseService } from '../services/surpriseService';

const { Title, Text, Paragraph } = Typography;

/* ── Helpers ─────────────────────────────────────────────────────── */

const interpolate = (text, vars) => {
  if (!text) return '';
  return text
    .replace(/\{\{recipientName\}\}/g, vars.recipientName || '')
    .replace(/\{\{senderName\}\}/g, vars.senderName || '')
    .replace(/\{\{finalMessage\}\}/g, vars.finalMessage || '')
    .replace(/\{\{scheduledAt\}\}/g, vars.scheduledAt ? new Date(vars.scheduledAt).toLocaleString() : '');
};

const bgStyles = {
  hearts: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  sparkles: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
  fireworks: 'linear-gradient(135deg, #0c0c0c 0%, #1a1a2e 50%, #16213e 100%)',
  stars: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
  night_sky: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
  party: 'linear-gradient(135deg, #f7971e 0%, #ffd200 100%)',
  gradient_love: 'linear-gradient(135deg, #ee9ca7 0%, #ffdde1 100%)',
  gradient_warm: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  gold: 'linear-gradient(135deg, #f7971e 0%, #ffd200 100%)',
  sunshine: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
  rain: 'linear-gradient(135deg, #616161 0%, #9bc5c3 100%)',
};

const generateSessionId = () =>
  'sess_' + Math.random().toString(36).substring(2, 15);

/* ── Confetti Effect (CSS-only) ──────────────────────────────────── */

const ConfettiOverlay = () => {
  const pieces = Array.from({ length: 50 }, (_, i) => i);
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 999, overflow: 'hidden' }}>
      {pieces.map(i => (
        <div
          key={i}
          style={{
            position: 'absolute',
            top: -20,
            left: `${Math.random() * 100}%`,
            width: 10,
            height: 10,
            background: ['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5',
              '#2196f3', '#00bcd4', '#4caf50', '#ffeb3b', '#ff9800', '#ff5722'][i % 11],
            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
            animation: `confetti-fall ${2 + Math.random() * 3}s linear ${Math.random() * 2}s infinite`,
            transform: `rotate(${Math.random() * 360}deg)`,
          }}
        />
      ))}
      <style>{`
        @keyframes confetti-fall {
          0% { top: -20px; opacity: 1; transform: rotate(0deg) translateX(0); }
          100% { top: 110vh; opacity: 0; transform: rotate(720deg) translateX(${Math.random() > 0.5 ? '' : '-'}80px); }
        }
      `}</style>
    </div>
  );
};

/* ── Floating Hearts Background ──────────────────────────────────── */

const FloatingHearts = () => (
  <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
    {Array.from({ length: 20 }, (_, i) => (
      <div
        key={i}
        style={{
          position: 'absolute',
          bottom: -40,
          left: `${Math.random() * 100}%`,
          fontSize: `${16 + Math.random() * 24}px`,
          animation: `float-up ${4 + Math.random() * 6}s ease-in ${Math.random() * 5}s infinite`,
          opacity: 0.5,
        }}
      >
        💕
      </div>
    ))}
    <style>{`
      @keyframes float-up {
        0% { transform: translateY(0) rotate(0deg); opacity: 0; }
        10% { opacity: 0.7; }
        100% { transform: translateY(-110vh) rotate(360deg); opacity: 0; }
      }
    `}</style>
  </div>
);

/* ── Step Renderers ──────────────────────────────────────────────── */

const IntroStep = ({ step, vars, onNext }) => {
  useEffect(() => {
    if (step.delay) {
      const timer = setTimeout(onNext, step.delay);
      return () => clearTimeout(timer);
    }
  }, [step.delay, onNext]);

  return (
    <div style={{
      textAlign: 'center',
      animation: 'fadeInUp 1s ease-out',
      padding: '20px',
    }}>
      <Title level={1} style={{ color: '#fff', fontSize: '2.5rem', textShadow: '0 2px 20px rgba(0,0,0,0.3)' }}>
        {interpolate(step.heading, vars)}
      </Title>
      {step.subtext && (
        <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: '1.2rem' }}>
          {interpolate(step.subtext, vars)}
        </Text>
      )}
      {!step.delay && (
        <div style={{ marginTop: 40 }}>
          <Button
            type="primary"
            size="large"
            onClick={onNext}
            style={{ borderRadius: 30, padding: '0 40px', height: 48, fontSize: 16 }}
          >
            Continue ✨
          </Button>
        </div>
      )}
    </div>
  );
};

const TrapButtonStep = ({ step, vars, onNext }) => {
  const [noClickCount, setNoClickCount] = useState(0);
  const [noPos, setNoPos] = useState({ x: 0, y: 0 });
  const [noVisible, setNoVisible] = useState(true);
  const [noSize, setNoSize] = useState(1);
  const containerRef = useRef(null);

  const noTexts = step.noAlternateTexts || [];
  const currentNoText = noClickCount > 0 && noClickCount <= noTexts.length
    ? noTexts[noClickCount - 1]
    : step.noText;

  const handleNoInteraction = () => {
    setNoClickCount(c => c + 1);
    const behavior = step.noBehavior || 'dodge';

    if (behavior === 'dodge') {
      setNoPos({
        x: (Math.random() - 0.5) * 300,
        y: (Math.random() - 0.5) * 200,
      });
    } else if (behavior === 'shrink') {
      setNoSize(s => Math.max(0.2, s - 0.2));
    } else if (behavior === 'disappear') {
      setNoVisible(false);
    }
  };

  return (
    <div ref={containerRef} style={{
      textAlign: 'center',
      animation: 'fadeInUp 0.8s ease-out',
      padding: '20px',
      minHeight: 300,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <Title level={2} style={{ color: '#fff', textShadow: '0 2px 15px rgba(0,0,0,0.3)' }}>
        {interpolate(step.heading, vars)}
      </Title>

      <Space size={24} style={{ marginTop: 40 }} wrap>
        <Button
          type="primary"
          size="large"
          onClick={onNext}
          style={{
            borderRadius: 30,
            padding: '0 50px',
            height: 56,
            fontSize: 18,
            fontWeight: 600,
            background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
            border: 'none',
            color: '#1a1a2e',
            boxShadow: '0 4px 20px rgba(67, 233, 123, 0.4)',
            transform: `scale(${1 + noClickCount * 0.08})`,
            transition: 'transform 0.3s ease',
          }}
        >
          {step.yesText}
        </Button>

        {noVisible && (
          <Button
            size="large"
            onMouseEnter={step.noBehavior === 'dodge' ? handleNoInteraction : undefined}
            onClick={handleNoInteraction}
            style={{
              borderRadius: 30,
              padding: '0 40px',
              height: 48,
              fontSize: 16,
              transform: `translate(${noPos.x}px, ${noPos.y}px) scale(${noSize})`,
              transition: 'transform 0.3s ease',
              opacity: noSize < 0.5 ? 0.5 : 1,
            }}
          >
            {currentNoText}
          </Button>
        )}
      </Space>

      {noClickCount > 0 && noClickCount <= noTexts.length && (
        <Text
          style={{
            color: 'rgba(255,255,255,0.8)',
            marginTop: 20,
            fontSize: 14,
            animation: 'fadeInUp 0.5s ease',
          }}
        >
          {noClickCount === 1 ? "Hmm, you clicked No? 🤨" :
           noClickCount === 2 ? "Really?? 😅" :
           noClickCount >= 3 ? "Okay the No button is giving up… 😂" : ""}
        </Text>
      )}
    </div>
  );
};

const MessageStep = ({ step, vars, onNext }) => {
  useEffect(() => {
    if (step.delay) {
      const timer = setTimeout(onNext, step.delay);
      return () => clearTimeout(timer);
    }
  }, [step.delay, onNext]);

  return (
    <div style={{ textAlign: 'center', animation: 'fadeInUp 1s ease-out', padding: '20px' }}>
      <Title level={2} style={{ color: '#fff', textShadow: '0 2px 15px rgba(0,0,0,0.3)' }}>
        {interpolate(step.heading, vars)}
      </Title>
      <Paragraph style={{ color: 'rgba(255,255,255,0.85)', fontSize: '1.1rem', maxWidth: 500, margin: '0 auto' }}>
        {interpolate(step.text, vars)}
      </Paragraph>
      {!step.delay && (
        <Button
          type="primary"
          size="large"
          onClick={onNext}
          style={{ marginTop: 30, borderRadius: 30, padding: '0 40px', height: 48 }}
        >
          Next →
        </Button>
      )}
    </div>
  );
};

const FakeScenarioStep = ({ step, vars, onNext }) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (step.progressBar) {
      const interval = setInterval(() => {
        setProgress(p => {
          if (p >= 100) { clearInterval(interval); return 100; }
          return p + 2;
        });
      }, step.delay ? step.delay / 50 : 80);
      return () => clearInterval(interval);
    }

    if (step.delay) {
      const timer = setTimeout(onNext, step.delay);
      return () => clearTimeout(timer);
    }
  }, [step.delay, step.progressBar, onNext]);

  useEffect(() => {
    if (progress >= 100) {
      const timer = setTimeout(onNext, 500);
      return () => clearTimeout(timer);
    }
  }, [progress, onNext]);

  return (
    <div style={{
      textAlign: 'center',
      animation: 'fadeInUp 0.8s ease-out',
      padding: '40px 20px',
      fontFamily: step.scenario === 'error' ? 'monospace' : 'inherit',
    }}>
      <Title level={2} style={{
        color: step.scenario === 'error' ? '#ff4d4f' : '#fff',
        textShadow: '0 2px 15px rgba(0,0,0,0.3)',
      }}>
        {interpolate(step.heading, vars)}
      </Title>
      <Paragraph style={{ color: 'rgba(255,255,255,0.8)', fontSize: '1rem' }}>
        {interpolate(step.text, vars)}
      </Paragraph>
      {step.fakeDetails && (
        <pre style={{
          color: 'rgba(255,255,255,0.5)',
          fontSize: 12,
          maxWidth: 400,
          margin: '16px auto',
          textAlign: 'left',
        }}>
          {step.fakeDetails}
        </pre>
      )}
      {step.progressBar && (
        <div style={{
          width: '80%',
          maxWidth: 400,
          margin: '20px auto',
          background: 'rgba(255,255,255,0.2)',
          borderRadius: 10,
          overflow: 'hidden',
          height: 8,
        }}>
          <div style={{
            width: `${progress}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #43e97b, #38f9d7)',
            transition: 'width 0.2s',
            borderRadius: 10,
          }} />
        </div>
      )}
    </div>
  );
};

const PhotoRevealStep = ({ step, vars, photos, onNext }) => (
  <div style={{ textAlign: 'center', animation: 'fadeInUp 1s ease-out', padding: '20px' }}>
    <Title level={2} style={{ color: '#fff', textShadow: '0 2px 15px rgba(0,0,0,0.3)' }}>
      {interpolate(step.heading, vars)}
    </Title>
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: 12,
      marginTop: 24,
      maxWidth: 600,
      margin: '24px auto 0',
    }}>
      {(photos || []).map((url, i) => (
        <div
          key={i}
          style={{
            width: 150,
            height: 150,
            borderRadius: 12,
            overflow: 'hidden',
            boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
            animation: `fadeInUp 0.5s ease ${i * 0.2}s both`,
          }}
        >
          <img
            src={url}
            alt={`Memory ${i + 1}`}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
      ))}
    </div>
    <Button
      type="primary"
      size="large"
      onClick={onNext}
      style={{ marginTop: 30, borderRadius: 30, padding: '0 40px', height: 48 }}
    >
      Continue 💕
    </Button>
  </div>
);

const TimelineStep = ({ step, vars, photos, onNext }) => (
  <div style={{ textAlign: 'center', animation: 'fadeInUp 1s ease-out', padding: '20px', maxWidth: 600, margin: '0 auto' }}>
    <Title level={2} style={{ color: '#fff', textShadow: '0 2px 15px rgba(0,0,0,0.3)' }}>
      {interpolate(step.heading, vars)}
    </Title>
    <div style={{ position: 'relative', paddingLeft: 30, textAlign: 'left', marginTop: 24 }}>
      <div style={{
        position: 'absolute',
        left: 10,
        top: 0,
        bottom: 0,
        width: 2,
        background: 'rgba(255,255,255,0.4)',
      }} />
      {(photos || []).map((url, i) => (
        <div
          key={i}
          style={{
            position: 'relative',
            marginBottom: 24,
            animation: `fadeInUp 0.5s ease ${i * 0.3}s both`,
          }}
        >
          <div style={{
            position: 'absolute',
            left: -25,
            top: 8,
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: '#fff',
            border: '2px solid rgba(255,255,255,0.6)',
          }} />
          <img
            src={url}
            alt={`Memory ${i + 1}`}
            style={{
              width: '100%',
              maxWidth: 300,
              borderRadius: 12,
              boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
            }}
          />
        </div>
      ))}
    </div>
    <Button
      type="primary"
      size="large"
      onClick={onNext}
      style={{ marginTop: 24, borderRadius: 30, padding: '0 40px', height: 48 }}
    >
      Continue 💕
    </Button>
  </div>
);

const VoiceMessageStep = ({ step, vars, voiceUrl, onNext }) => (
  <div style={{ textAlign: 'center', animation: 'fadeInUp 1s ease-out', padding: '20px' }}>
    <Title level={2} style={{ color: '#fff', textShadow: '0 2px 15px rgba(0,0,0,0.3)' }}>
      {interpolate(step.heading, vars)}
    </Title>
    <Paragraph style={{ color: 'rgba(255,255,255,0.8)' }}>
      {interpolate(step.text, vars)}
    </Paragraph>
    {voiceUrl && (
      <audio controls src={voiceUrl} style={{ marginTop: 20, maxWidth: '100%' }} />
    )}
    <div style={{ marginTop: 30 }}>
      <Button type="primary" size="large" onClick={onNext}
        style={{ borderRadius: 30, padding: '0 40px', height: 48 }}>
        Continue 💕
      </Button>
    </div>
  </div>
);

const QuizStep = ({ step, vars, onNext }) => {
  const [selected, setSelected] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const handleSelect = (index) => {
    setSelected(index);
    if (index === step.correctIndex) {
      setFeedback(step.rightMessage || 'Correct!');
      setTimeout(onNext, 2000);
    } else {
      setFeedback(step.wrongMessage || 'Try again!');
    }
  };

  return (
    <div style={{ textAlign: 'center', animation: 'fadeInUp 0.8s ease-out', padding: '20px' }}>
      <Title level={3} style={{ color: 'rgba(255,255,255,0.6)' }}>
        {interpolate(step.heading, vars)}
      </Title>
      <Title level={2} style={{ color: '#fff', textShadow: '0 2px 15px rgba(0,0,0,0.3)' }}>
        {interpolate(step.question, vars)}
      </Title>
      <Space direction="vertical" size={12} style={{ marginTop: 24, width: '100%', maxWidth: 400 }}>
        {(step.options || []).map((opt, i) => (
          <Button
            key={i}
            block
            size="large"
            onClick={() => handleSelect(i)}
            disabled={selected === step.correctIndex}
            style={{
              borderRadius: 12,
              height: 50,
              fontSize: 16,
              background: selected === i
                ? (i === step.correctIndex ? '#52c41a' : '#ff4d4f')
                : 'rgba(255,255,255,0.15)',
              color: '#fff',
              border: 'none',
              transition: 'all 0.3s',
            }}
          >
            {opt}
          </Button>
        ))}
      </Space>
      {feedback && (
        <Paragraph style={{
          color: '#fff',
          marginTop: 16,
          fontSize: 16,
          animation: 'fadeInUp 0.5s ease',
        }}>
          {feedback}
        </Paragraph>
      )}
    </div>
  );
};

const CountdownStep = ({ step, vars, scheduledAt, onNext }) => {
  const [timeLeft, setTimeLeft] = useState(null);

  useEffect(() => {
    const target = scheduledAt ? new Date(scheduledAt) : null;
    if (!target) { onNext(); return; }

    const tick = () => {
      const diff = target - new Date();
      if (diff <= 0) { onNext(); return; }
      setTimeLeft({
        hours: Math.floor(diff / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      });
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [scheduledAt, onNext]);

  if (!timeLeft) return null;

  return (
    <div style={{ textAlign: 'center', animation: 'fadeInUp 1s ease-out', padding: '20px' }}>
      <Title level={2} style={{ color: '#fff', textShadow: '0 2px 15px rgba(0,0,0,0.3)' }}>
        {interpolate(step.heading, vars)}
      </Title>
      <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 16 }}>
        {interpolate(step.subtext, vars)}
      </Text>
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: 24,
        marginTop: 40,
      }}>
        {['hours', 'minutes', 'seconds'].map(unit => (
          <div key={unit} style={{ textAlign: 'center' }}>
            <div style={{
              fontSize: 56,
              fontWeight: 700,
              color: '#fff',
              lineHeight: 1,
              textShadow: '0 4px 20px rgba(0,0,0,0.4)',
            }}>
              {String(timeLeft[unit]).padStart(2, '0')}
            </div>
            <Text style={{ color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', fontSize: 12 }}>
              {unit}
            </Text>
          </div>
        ))}
      </div>
    </div>
  );
};

const FinalRevealStep = ({ step, vars, photos, videoUrl, showConfetti }) => (
  <div style={{
    textAlign: 'center',
    animation: 'fadeInUp 1.2s ease-out',
    padding: '20px',
    maxWidth: 600,
    margin: '0 auto',
  }}>
    {showConfetti && step.confetti && <ConfettiOverlay />}
    <Title level={1} style={{
      color: '#fff',
      fontSize: '2.5rem',
      textShadow: '0 4px 20px rgba(0,0,0,0.4)',
      marginBottom: 16,
    }}>
      {interpolate(step.heading, vars)}
    </Title>
    <Paragraph style={{
      color: 'rgba(255,255,255,0.9)',
      fontSize: '1.2rem',
      lineHeight: 1.8,
      maxWidth: 500,
      margin: '0 auto',
    }}>
      {interpolate(step.text, vars)}
    </Paragraph>
    {step.showPhotos && photos?.length > 0 && (
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 12,
        marginTop: 24,
      }}>
        {photos.map((url, i) => (
          <img
            key={i}
            src={url}
            alt={`Memory ${i + 1}`}
            style={{
              width: 120,
              height: 120,
              borderRadius: 12,
              objectFit: 'cover',
              boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
              animation: `fadeInUp 0.5s ease ${i * 0.15}s both`,
            }}
          />
        ))}
      </div>
    )}
    {step.showVideo && videoUrl && (
      <div style={{ marginTop: 24 }}>
        <video
          controls
          src={videoUrl}
          style={{
            width: '100%',
            maxWidth: 500,
            borderRadius: 16,
            boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
          }}
        />
      </div>
    )}
  </div>
);

/* ── Main Viewer Component ───────────────────────────────────────── */

const SurpriseViewer = () => {
  const { slug } = useParams();
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [scheduled, setScheduled] = useState(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [started, setStarted] = useState(false);
  const sessionId = useRef(generateSessionId());
  const audioRef = useRef(null);

  const loadPage = useCallback(async (password) => {
    try {
      setLoading(true);
      const res = await surpriseService.viewBySlug(slug, password);

      if (res.passwordRequired) {
        setPasswordRequired(true);
        setLoading(false);
        return;
      }
      if (res.scheduled) {
        setScheduled(res);
        setLoading(false);
        return;
      }

      setPage(res.page);
      setPasswordRequired(false);
      setLoading(false);
    } catch (err) {
      setError(err.response?.data?.message || 'This surprise page was not found.');
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  const handlePasswordSubmit = () => {
    loadPage(passwordInput);
  };

  const steps = page?.steps || page?.template?.steps || [];
  const vars = {
    recipientName: page?.recipientName || '',
    senderName: page?.senderName || '',
    finalMessage: page?.finalMessage || '',
    scheduledAt: page?.scheduledAt || '',
  };

  const handleNext = useCallback(() => {
    const nextIndex = currentStepIndex + 1;

    // Track interaction
    surpriseService.trackInteraction(slug, {
      sessionId: sessionId.current,
      stepReached: nextIndex,
      completed: nextIndex >= steps.length,
    }).catch(() => {});

    if (nextIndex >= steps.length) {
      setCurrentStepIndex(steps.length - 1);
      return;
    }

    setCurrentStepIndex(nextIndex);
  }, [currentStepIndex, steps.length, slug]);

  const handleStart = () => {
    setStarted(true);
    // Start background music if available
    if (page?.musicUrl && audioRef.current) {
      audioRef.current.play().catch(() => {});
    }
  };

  const renderStep = (step) => {
    switch (step.type) {
      case 'intro':
        return <IntroStep step={step} vars={vars} onNext={handleNext} />;
      case 'trap_button':
        return <TrapButtonStep step={step} vars={vars} onNext={handleNext} />;
      case 'message':
        return <MessageStep step={step} vars={vars} onNext={handleNext} />;
      case 'fake_scenario':
        return <FakeScenarioStep step={step} vars={vars} onNext={handleNext} />;
      case 'photo_reveal':
        return <PhotoRevealStep step={step} vars={vars} photos={page?.photos} onNext={handleNext} />;
      case 'timeline':
        return <TimelineStep step={step} vars={vars} photos={page?.photos} onNext={handleNext} />;
      case 'voice_message':
        return <VoiceMessageStep step={step} vars={vars} voiceUrl={page?.voiceMessageUrl} onNext={handleNext} />;
      case 'quiz':
        return <QuizStep step={step} vars={vars} onNext={handleNext} />;
      case 'countdown':
        return <CountdownStep step={step} vars={vars} scheduledAt={page?.scheduledAt} onNext={handleNext} />;
      case 'final_reveal':
        return <FinalRevealStep step={step} vars={vars} photos={page?.photos} videoUrl={page?.videoUrl} showConfetti />;
      default:
        return <MessageStep step={{ heading: step.heading || '', text: step.text || '' }} vars={vars} onNext={handleNext} />;
    }
  };

  const currentStep = steps[currentStepIndex];
  const bg = currentStep?.background
    ? bgStyles[currentStep.background] || bgStyles.hearts
    : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';

  // ── Loading / Error / Password / Scheduled states ──────────────
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}>
        <Spin indicator={<LoadingOutlined style={{ fontSize: 48, color: '#fff' }} />} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)',
        flexDirection: 'column',
        padding: 20,
      }}>
        <Title level={2} style={{ color: '#fff' }}>💔</Title>
        <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 18 }}>{error}</Text>
      </div>
    );
  }

  if (passwordRequired) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        flexDirection: 'column',
        padding: 20,
      }}>
        <FloatingHearts />
        <div style={{ zIndex: 1, textAlign: 'center' }}>
          <LockOutlined style={{ fontSize: 48, color: '#fff', marginBottom: 16 }} />
          <Title level={3} style={{ color: '#fff' }}>This surprise is locked 🔒</Title>
          <Text style={{ color: 'rgba(255,255,255,0.8)' }}>Enter the password to continue</Text>
          <div style={{ marginTop: 24 }}>
            <Input.Password
              size="large"
              placeholder="Enter password"
              value={passwordInput}
              onChange={e => setPasswordInput(e.target.value)}
              onPressEnter={handlePasswordSubmit}
              style={{ maxWidth: 300, borderRadius: 12 }}
            />
            <br />
            <Button
              type="primary"
              size="large"
              onClick={handlePasswordSubmit}
              style={{ marginTop: 16, borderRadius: 30, padding: '0 40px' }}
            >
              Unlock ✨
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (scheduled) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)',
        flexDirection: 'column',
        padding: 20,
      }}>
        <FloatingHearts />
        <div style={{ zIndex: 1, textAlign: 'center' }}>
          <Title level={2} style={{ color: '#fff' }}>⏳</Title>
          <Title level={3} style={{ color: '#fff' }}>{scheduled.message}</Title>
          <Text style={{ color: 'rgba(255,255,255,0.6)' }}>
            Scheduled: {new Date(scheduled.scheduledAt).toLocaleString()}
          </Text>
        </div>
      </div>
    );
  }

  // ── Start Screen ──────────────────────────────────────────────
  if (!started) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        flexDirection: 'column',
        padding: 20,
      }}>
        <FloatingHearts />
        <div style={{ zIndex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>
            {page?.category === 'proposal' ? '💍' :
             page?.category === 'birthday' ? '🎂' :
             page?.category === 'anniversary' ? '💕' :
             page?.category === 'apology' ? '💛' : '🎉'}
          </div>
          <Title level={2} style={{ color: '#fff', textShadow: '0 2px 20px rgba(0,0,0,0.3)' }}>
            Hey {page?.recipientName} ✨
          </Title>
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 18 }}>
            Someone has prepared something special for you…
          </Text>
          <div style={{ marginTop: 40 }}>
            <Button
              type="primary"
              size="large"
              icon={<HeartOutlined />}
              onClick={handleStart}
              style={{
                borderRadius: 30,
                padding: '0 50px',
                height: 56,
                fontSize: 18,
                fontWeight: 600,
                background: 'rgba(255,255,255,0.2)',
                border: '2px solid rgba(255,255,255,0.5)',
                backdropFilter: 'blur(10px)',
                animation: 'pulse 2s ease infinite',
              }}
            >
              Open Your Surprise
            </Button>
          </div>
        </div>

        {page?.musicUrl && (
          <audio ref={audioRef} src={page.musicUrl} loop preload="auto" />
        )}

        <style>{`
          @keyframes pulse {
            0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255,255,255,0.4); }
            50% { transform: scale(1.05); box-shadow: 0 0 0 20px rgba(255,255,255,0); }
          }
        `}</style>
      </div>
    );
  }

  // ── Interactive Experience ────────────────────────────────────
  return (
    <div style={{
      minHeight: '100vh',
      background: bg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
      transition: 'background 0.8s ease',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <FloatingHearts />

      {page?.musicUrl && (
        <audio ref={audioRef} src={page.musicUrl} loop autoPlay />
      )}

      <div style={{
        zIndex: 1,
        width: '100%',
        maxWidth: 600,
      }}>
        {currentStep && renderStep(currentStep)}
      </div>

      {/* Step progress dots */}
      <div style={{
        position: 'fixed',
        bottom: 20,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        gap: 8,
        zIndex: 10,
      }}>
        {steps.map((_, i) => (
          <div
            key={i}
            style={{
              width: i === currentStepIndex ? 24 : 8,
              height: 8,
              borderRadius: 4,
              background: i <= currentStepIndex ? '#fff' : 'rgba(255,255,255,0.3)',
              transition: 'all 0.3s ease',
            }}
          />
        ))}
      </div>

      {/* Reaction buttons on final step */}
      {currentStep?.type === 'final_reveal' && (
        <div style={{
          position: 'fixed',
          bottom: 50,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          gap: 16,
          zIndex: 10,
        }}>
          {['😍', '😭', '🥰', '😂'].map(emoji => (
            <button
              key={emoji}
              onClick={() => {
                const reactions = { '😍': 'loved_it', '😭': 'cried', '🥰': 'melted', '😂': 'laughed' };
                surpriseService.trackInteraction(slug, {
                  sessionId: sessionId.current,
                  stepReached: steps.length,
                  completed: true,
                  reaction: reactions[emoji],
                }).catch(() => {});
              }}
              style={{
                fontSize: 32,
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                borderRadius: '50%',
                width: 56,
                height: 56,
                cursor: 'pointer',
                backdropFilter: 'blur(10px)',
                transition: 'transform 0.2s',
              }}
              onMouseEnter={e => e.target.style.transform = 'scale(1.2)'}
              onMouseLeave={e => e.target.style.transform = 'scale(1)'}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default SurpriseViewer;
