import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated, Dimensions, Image, ScrollView, StyleSheet, View,
  PanResponder, Easing,
} from 'react-native';
import { ActivityIndicator, Button, Text, TextInput, IconButton } from 'react-native-paper';
import { Colors, Spacing, Radius } from '../theme';
import { getErrorMessage } from '../utils/helpers';
import { surpriseService } from '../services/surpriseService';

// expo-av is optional — audio works only if installed
let Audio = null;
try { Audio = require('expo-av').Audio; } catch { /* not installed */ }

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const interpolate = (text, vars) => {
  if (!text) return '';
  return text
    .replace(/\{\{recipientName\}\}/g, vars.recipientName || '')
    .replace(/\{\{senderName\}\}/g, vars.senderName || '')
    .replace(/\{\{finalMessage\}\}/g, vars.finalMessage || '')
    .replace(/\{\{scheduledAt\}\}/g, vars.scheduledAt ? new Date(vars.scheduledAt).toLocaleString() : '');
};

const generateSessionId = () => 'sess_' + Math.random().toString(36).substring(2, 15);

/* ── Confetti particles (Animated) ──────────────────────────────── */

const ConfettiPiece = ({ delay, color }) => {
  const anim = useRef(new Animated.Value(0)).current;
  const left = useRef(Math.random() * SCREEN_W).current;
  const drift = useRef((Math.random() - 0.5) * 100).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(anim, {
        toValue: 1,
        duration: 3000 + Math.random() * 2000,
        delay,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();
  }, [anim, delay]);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left,
        width: 10,
        height: 10,
        backgroundColor: color,
        borderRadius: Math.random() > 0.5 ? 5 : 2,
        transform: [
          { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-20, SCREEN_H + 20] }) },
          { translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [0, drift] }) },
          { rotate: anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '720deg'] }) },
        ],
        opacity: anim.interpolate({ inputRange: [0, 0.1, 0.9, 1], outputRange: [0, 1, 1, 0] }),
      }}
    />
  );
};

const Confetti = () => {
  const colors = ['#f44336', '#e91e63', '#9c27b0', '#3f51b5', '#2196f3', '#4caf50', '#ffeb3b', '#ff9800'];
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: 40 }, (_, i) => (
        <ConfettiPiece key={i} delay={i * 100} color={colors[i % colors.length]} />
      ))}
    </View>
  );
};

/* ── Floating Hearts ────────────────────────────────────────────── */

const FloatingHeart = ({ delay }) => {
  const anim = useRef(new Animated.Value(0)).current;
  const left = useRef(Math.random() * SCREEN_W).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(anim, {
        toValue: 1,
        duration: 5000 + Math.random() * 4000,
        delay,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();
  }, [anim, delay]);

  return (
    <Animated.Text
      style={{
        position: 'absolute',
        left,
        bottom: -40,
        fontSize: 18 + Math.random() * 14,
        transform: [
          { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, -SCREEN_H - 60] }) },
        ],
        opacity: anim.interpolate({ inputRange: [0, 0.1, 0.8, 1], outputRange: [0, 0.6, 0.6, 0] }),
      }}
    >
      💕
    </Animated.Text>
  );
};

const FloatingHearts = () => (
  <View style={StyleSheet.absoluteFill} pointerEvents="none">
    {Array.from({ length: 15 }, (_, i) => <FloatingHeart key={i} delay={i * 600} />)}
  </View>
);

/* ── Background presets ─────────────────────────────────────────── */

const bgColors = {
  hearts: ['#f093fb', '#f5576c'],
  sparkles: ['#a18cd1', '#fbc2eb'],
  fireworks: ['#0c0c0c', '#1a1a2e'],
  stars: ['#0f0c29', '#24243e'],
  night_sky: ['#0f0c29', '#24243e'],
  party: ['#f7971e', '#ffd200'],
  gradient_love: ['#ee9ca7', '#ffdde1'],
  gradient_warm: ['#fa709a', '#fee140'],
  gold: ['#f7971e', '#ffd200'],
  sunshine: ['#ffecd2', '#fcb69f'],
  rain: ['#616161', '#9bc5c3'],
};

const getBg = (name) => (bgColors[name] || bgColors.hearts)[0];

/* ── Step Components ────────────────────────────────────────────── */

const IntroStep = ({ step, vars, onNext }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start();
    if (step.delay) {
      const t = setTimeout(onNext, step.delay);
      return () => clearTimeout(t);
    }
  }, [fadeAnim, step.delay, onNext]);

  return (
    <Animated.View style={[vs.stepCenter, { opacity: fadeAnim, transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }] }]}>
      <Text style={vs.headingXL}>{interpolate(step.heading, vars)}</Text>
      {step.subtext && <Text style={vs.subtext}>{interpolate(step.subtext, vars)}</Text>}
      {!step.delay && (
        <Button mode="contained" onPress={onNext} style={vs.btn} labelStyle={vs.btnLabel}>
          Continue ✨
        </Button>
      )}
    </Animated.View>
  );
};

const TrapButtonStep = ({ step, vars, onNext }) => {
  const [noCount, setNoCount] = useState(0);
  const noPosX = useRef(new Animated.Value(0)).current;
  const noPosY = useRef(new Animated.Value(0)).current;
  const noScale = useRef(new Animated.Value(1)).current;
  const [noVisible, setNoVisible] = useState(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const noTexts = step.noAlternateTexts || [];
  const currentNoText = noCount > 0 && noCount <= noTexts.length ? noTexts[noCount - 1] : step.noText;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, [fadeAnim]);

  const handleNo = () => {
    setNoCount((c) => c + 1);
    const behavior = step.noBehavior || 'dodge';
    if (behavior === 'dodge') {
      Animated.parallel([
        Animated.spring(noPosX, { toValue: (Math.random() - 0.5) * (SCREEN_W * 0.6), useNativeDriver: true }),
        Animated.spring(noPosY, { toValue: (Math.random() - 0.5) * 200, useNativeDriver: true }),
      ]).start();
    } else if (behavior === 'shrink') {
      Animated.spring(noScale, { toValue: Math.max(0.2, 1 - (noCount + 1) * 0.2), useNativeDriver: true }).start();
    } else if (behavior === 'disappear') {
      setNoVisible(false);
    }
  };

  const yesScale = Math.min(1.4, 1 + noCount * 0.08);

  return (
    <Animated.View style={[vs.stepCenter, { opacity: fadeAnim }]}>
      <Text style={vs.headingLG}>{interpolate(step.heading, vars)}</Text>

      <View style={vs.btnRow}>
        <Button
          mode="contained"
          onPress={onNext}
          style={[vs.yesBtn, { transform: [{ scale: yesScale }] }]}
          labelStyle={vs.yesBtnLabel}
        >
          {step.yesText}
        </Button>

        {noVisible && (
          <Animated.View style={{ transform: [{ translateX: noPosX }, { translateY: noPosY }, { scale: noScale }] }}>
            <Button mode="outlined" onPress={handleNo} style={vs.noBtn} labelStyle={vs.noBtnLabel}>
              {currentNoText}
            </Button>
          </Animated.View>
        )}
      </View>

      {noCount > 0 && (
        <Text style={vs.tauntText}>
          {noCount === 1 ? 'Hmm, you tapped No? 🤨' :
           noCount === 2 ? 'Really?? 😅' :
           noCount >= 3 ? 'The No button is giving up… 😂' : ''}
        </Text>
      )}
    </Animated.View>
  );
};

const MessageStep = ({ step, vars, onNext }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start();
    if (step.delay) {
      const t = setTimeout(onNext, step.delay);
      return () => clearTimeout(t);
    }
  }, [fadeAnim, step.delay, onNext]);

  return (
    <Animated.View style={[vs.stepCenter, { opacity: fadeAnim, transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }] }]}>
      <Text style={vs.headingLG}>{interpolate(step.heading, vars)}</Text>
      <Text style={vs.bodyText}>{interpolate(step.text, vars)}</Text>
      {!step.delay && (
        <Button mode="contained" onPress={onNext} style={vs.btn} labelStyle={vs.btnLabel}>Next →</Button>
      )}
    </Animated.View>
  );
};

const FakeScenarioStep = ({ step, vars, onNext }) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (step.progressBar) {
      const interval = setInterval(() => {
        setProgress((p) => {
          if (p >= 100) { clearInterval(interval); return 100; }
          return p + 2;
        });
      }, step.delay ? step.delay / 50 : 80);
      return () => clearInterval(interval);
    }
    if (step.delay) {
      const t = setTimeout(onNext, step.delay);
      return () => clearTimeout(t);
    }
  }, [step.delay, step.progressBar, onNext]);

  useEffect(() => {
    if (progress >= 100) {
      const t = setTimeout(onNext, 500);
      return () => clearTimeout(t);
    }
  }, [progress, onNext]);

  return (
    <View style={vs.stepCenter}>
      <Text style={[vs.headingLG, step.scenario === 'error' && { color: '#ff4d4f' }]}>
        {interpolate(step.heading, vars)}
      </Text>
      <Text style={vs.bodyText}>{interpolate(step.text, vars)}</Text>
      {step.fakeDetails && <Text style={vs.monoText}>{step.fakeDetails}</Text>}
      {step.progressBar && (
        <View style={vs.progressBg}>
          <View style={[vs.progressFill, { width: `${progress}%` }]} />
        </View>
      )}
    </View>
  );
};

const PhotoRevealStep = ({ step, vars, photos, onNext }) => (
  <View style={vs.stepCenter}>
    <Text style={vs.headingLG}>{interpolate(step.heading, vars)}</Text>
    <View style={vs.photoGrid}>
      {(photos || []).map((url, i) => (
        <Image key={i} source={{ uri: url }} style={vs.gridPhoto} />
      ))}
    </View>
    <Button mode="contained" onPress={onNext} style={vs.btn} labelStyle={vs.btnLabel}>Continue 💕</Button>
  </View>
);

const TimelineStep = ({ step, vars, photos, onNext }) => (
  <View style={vs.stepCenter}>
    <Text style={vs.headingLG}>{interpolate(step.heading, vars)}</Text>
    <View style={vs.timeline}>
      <View style={vs.timelineLine} />
      {(photos || []).map((url, i) => (
        <View key={i} style={vs.timelineItem}>
          <View style={vs.timelineDot} />
          <Image source={{ uri: url }} style={vs.timelinePhoto} />
        </View>
      ))}
    </View>
    <Button mode="contained" onPress={onNext} style={vs.btn} labelStyle={vs.btnLabel}>Continue 💕</Button>
  </View>
);

const QuizStep = ({ step, vars, onNext }) => {
  const [selected, setSelected] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const handleSelect = (idx) => {
    setSelected(idx);
    if (idx === step.correctIndex) {
      setFeedback(step.rightMessage || 'Correct!');
      setTimeout(onNext, 2000);
    } else {
      setFeedback(step.wrongMessage || 'Try again!');
    }
  };

  return (
    <View style={vs.stepCenter}>
      <Text style={vs.subtextSm}>{interpolate(step.heading, vars)}</Text>
      <Text style={vs.headingLG}>{interpolate(step.question, vars)}</Text>
      {(step.options || []).map((opt, i) => (
        <Button
          key={i}
          mode={selected === i ? 'contained' : 'outlined'}
          onPress={() => handleSelect(i)}
          disabled={selected === step.correctIndex}
          style={[
            vs.quizBtn,
            selected === i && { backgroundColor: i === step.correctIndex ? '#52c41a' : '#ff4d4f' },
          ]}
          labelStyle={{ color: selected === i ? '#fff' : '#fff' }}
        >
          {opt}
        </Button>
      ))}
      {feedback && <Text style={vs.feedbackText}>{feedback}</Text>}
    </View>
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
    <View style={vs.stepCenter}>
      <Text style={vs.headingLG}>{interpolate(step.heading, vars)}</Text>
      <Text style={vs.subtext}>{interpolate(step.subtext, vars)}</Text>
      <View style={vs.countdownRow}>
        {['hours', 'minutes', 'seconds'].map((u) => (
          <View key={u} style={vs.countdownBox}>
            <Text style={vs.countdownNum}>{String(timeLeft[u]).padStart(2, '0')}</Text>
            <Text style={vs.countdownLabel}>{u}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const FinalRevealStep = ({ step, vars, photos, videoUrl }) => (
  <ScrollView contentContainerStyle={vs.stepCenter}>
    <Confetti />
    <Text style={vs.headingXL}>{interpolate(step.heading, vars)}</Text>
    <Text style={vs.finalMsg}>{interpolate(step.text, vars)}</Text>
    {step.showPhotos && photos?.length > 0 && (
      <View style={vs.photoGrid}>
        {photos.map((url, i) => (
          <Image key={i} source={{ uri: url }} style={vs.gridPhotoSm} />
        ))}
      </View>
    )}
  </ScrollView>
);

/* ── Main Viewer Component ──────────────────────────────────────── */

const SurpriseViewerScreen = ({ route }) => {
  const slug = route.params?.slug;
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [scheduled, setScheduled] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [started, setStarted] = useState(false);
  const sessionId = useRef(generateSessionId());
  const soundRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation for start button
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ]),
    ).start();
  }, [pulseAnim]);

  const loadPage = useCallback(async (password) => {
    try {
      setLoading(true);
      const res = await surpriseService.viewBySlug(slug, password);
      if (res.passwordRequired) { setPasswordRequired(true); setLoading(false); return; }
      if (res.scheduled) { setScheduled(res); setLoading(false); return; }
      setPage(res.page);
      setPasswordRequired(false);
      setLoading(false);
    } catch (err) {
      setError(err.response?.data?.message || 'This surprise page was not found.');
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => { loadPage(); }, [loadPage]);

  // Cleanup audio on unmount
  useEffect(() => () => {
    if (soundRef.current) soundRef.current.unloadAsync().catch(() => {});
  }, []);

  const startMusic = async () => {
    if (!page?.musicUrl || !Audio) return;
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: page.musicUrl },
        { isLooping: true, shouldPlay: true, volume: 0.5 },
      );
      soundRef.current = sound;
    } catch { /* music playback failed silently */ }
  };

  const steps = page?.steps || page?.template?.steps || [];
  const vars = {
    recipientName: page?.recipientName || '',
    senderName: page?.senderName || '',
    finalMessage: page?.finalMessage || '',
    scheduledAt: page?.scheduledAt || '',
  };

  const handleNext = useCallback(() => {
    const next = currentStep + 1;
    surpriseService.trackInteraction(slug, {
      sessionId: sessionId.current,
      stepReached: next,
      completed: next >= steps.length,
    }).catch(() => {});

    if (next >= steps.length) return;
    setCurrentStep(next);
  }, [currentStep, steps.length, slug]);

  const handleStart = () => {
    setStarted(true);
    startMusic();
  };

  const renderStep = (step) => {
    switch (step.type) {
      case 'intro': return <IntroStep step={step} vars={vars} onNext={handleNext} />;
      case 'trap_button': return <TrapButtonStep step={step} vars={vars} onNext={handleNext} />;
      case 'message': return <MessageStep step={step} vars={vars} onNext={handleNext} />;
      case 'fake_scenario': return <FakeScenarioStep step={step} vars={vars} onNext={handleNext} />;
      case 'photo_reveal': return <PhotoRevealStep step={step} vars={vars} photos={page?.photos} onNext={handleNext} />;
      case 'timeline': return <TimelineStep step={step} vars={vars} photos={page?.photos} onNext={handleNext} />;
      case 'quiz': return <QuizStep step={step} vars={vars} onNext={handleNext} />;
      case 'countdown': return <CountdownStep step={step} vars={vars} scheduledAt={page?.scheduledAt} onNext={handleNext} />;
      case 'final_reveal': return <FinalRevealStep step={step} vars={vars} photos={page?.photos} videoUrl={page?.videoUrl} />;
      default: return <MessageStep step={{ heading: step.heading || '', text: step.text || '' }} vars={vars} onNext={handleNext} />;
    }
  };

  const currentStepData = steps[currentStep];
  const bg = getBg(currentStepData?.background);

  // ── States ─────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={[vs.fullScreen, { backgroundColor: Colors.primary }]}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[vs.fullScreen, { backgroundColor: '#1a1a2e' }]}>
        <Text style={{ fontSize: 48 }}>💔</Text>
        <Text style={vs.subtext}>{error}</Text>
      </View>
    );
  }

  if (passwordRequired) {
    return (
      <View style={[vs.fullScreen, { backgroundColor: Colors.primary }]}>
        <FloatingHearts />
        <View style={{ zIndex: 1, alignItems: 'center', padding: Spacing.xl }}>
          <Text style={{ fontSize: 48, marginBottom: Spacing.md }}>🔒</Text>
          <Text style={vs.headingLG}>This surprise is locked</Text>
          <Text style={vs.subtext}>Enter the password to continue</Text>
          <TextInput
            mode="outlined"
            secureTextEntry
            value={passwordInput}
            onChangeText={setPasswordInput}
            onSubmitEditing={() => loadPage(passwordInput)}
            placeholder="Enter password"
            style={{ width: SCREEN_W * 0.7, marginTop: Spacing.lg, backgroundColor: '#fff' }}
          />
          <Button
            mode="contained"
            onPress={() => loadPage(passwordInput)}
            style={[vs.btn, { marginTop: Spacing.lg }]}
            labelStyle={vs.btnLabel}
          >
            Unlock ✨
          </Button>
        </View>
      </View>
    );
  }

  if (scheduled) {
    return (
      <View style={[vs.fullScreen, { backgroundColor: '#1a1a2e' }]}>
        <FloatingHearts />
        <Text style={{ fontSize: 48, zIndex: 1 }}>⏳</Text>
        <Text style={[vs.headingLG, { zIndex: 1 }]}>{scheduled.message}</Text>
        <Text style={[vs.subtext, { zIndex: 1 }]}>
          Scheduled: {new Date(scheduled.scheduledAt).toLocaleString()}
        </Text>
      </View>
    );
  }

  // ── Start Screen ───────────────────────────────────────────────

  if (!started) {
    const emoji = page?.category === 'proposal' ? '💍' :
                  page?.category === 'birthday' ? '🎂' :
                  page?.category === 'anniversary' ? '💕' :
                  page?.category === 'apology' ? '💛' : '🎉';

    return (
      <View style={[vs.fullScreen, { backgroundColor: Colors.primary }]}>
        <FloatingHearts />
        <View style={{ zIndex: 1, alignItems: 'center' }}>
          <Text style={{ fontSize: 64, marginBottom: Spacing.md }}>{emoji}</Text>
          <Text style={vs.headingXL}>Hey {page?.recipientName} ✨</Text>
          <Text style={vs.subtext}>Someone has prepared something special for you…</Text>
          <Animated.View style={{ transform: [{ scale: pulseAnim }], marginTop: 40 }}>
            <Button
              mode="outlined"
              onPress={handleStart}
              style={vs.startBtn}
              labelStyle={vs.startBtnLabel}
              icon="heart"
            >
              Open Your Surprise
            </Button>
          </Animated.View>
        </View>
      </View>
    );
  }

  // ── Interactive Experience ─────────────────────────────────────

  return (
    <View style={[vs.fullScreen, { backgroundColor: bg }]}>
      <FloatingHearts />

      <View style={{ zIndex: 1, flex: 1, justifyContent: 'center', padding: Spacing.xl }}>
        {currentStepData && renderStep(currentStepData)}
      </View>

      {/* Progress dots */}
      <View style={vs.dotRow}>
        {steps.map((_, i) => (
          <View
            key={i}
            style={[
              vs.dot,
              i === currentStep && vs.dotActive,
              i < currentStep && vs.dotDone,
            ]}
          />
        ))}
      </View>

      {/* Reaction buttons on final step */}
      {currentStepData?.type === 'final_reveal' && (
        <View style={vs.reactionRow}>
          {['😍', '😭', '🥰', '😂'].map((emoji) => (
            <IconButton
              key={emoji}
              icon={() => <Text style={{ fontSize: 28 }}>{emoji}</Text>}
              size={28}
              style={vs.reactionBtn}
              onPress={() => {
                const reactions = { '😍': 'loved_it', '😭': 'cried', '🥰': 'melted', '😂': 'laughed' };
                surpriseService.trackInteraction(slug, {
                  sessionId: sessionId.current,
                  stepReached: steps.length,
                  completed: true,
                  reaction: reactions[emoji],
                }).catch(() => {});
              }}
            />
          ))}
        </View>
      )}
    </View>
  );
};

/* ── Styles ──────────────────────────────────────────────────────── */

const vs = StyleSheet.create({
  fullScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  headingXL: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 15,
    marginBottom: Spacing.md,
  },
  headingLG: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
    marginBottom: Spacing.md,
  },
  subtext: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  subtextSm: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  bodyText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 300,
    marginBottom: Spacing.md,
  },
  monoText: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'left',
    maxWidth: 300,
    marginVertical: Spacing.md,
  },
  btn: {
    marginTop: Spacing.xl,
    borderRadius: 30,
    paddingHorizontal: Spacing.xl,
  },
  btnLabel: { fontSize: 16, fontWeight: '600' },
  startBtn: {
    borderRadius: 30,
    borderColor: 'rgba(255,255,255,0.5)',
    borderWidth: 2,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  startBtnLabel: { fontSize: 18, fontWeight: '700', color: '#fff' },

  btnRow: {
    flexDirection: 'row',
    gap: Spacing.lg,
    marginTop: Spacing.xxxl,
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  yesBtn: {
    borderRadius: 30,
    backgroundColor: '#43e97b',
    paddingHorizontal: Spacing.xl,
    elevation: 4,
  },
  yesBtnLabel: { fontSize: 18, fontWeight: '700', color: '#1a1a2e' },
  noBtn: {
    borderRadius: 30,
    borderColor: 'rgba(255,255,255,0.5)',
    paddingHorizontal: Spacing.lg,
  },
  noBtnLabel: { color: '#fff' },
  tauntText: {
    color: 'rgba(255,255,255,0.7)',
    marginTop: Spacing.lg,
    fontSize: 14,
  },

  progressBg: {
    width: '80%',
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 4,
    marginTop: Spacing.lg,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#43e97b',
    borderRadius: 4,
  },

  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginVertical: Spacing.lg,
  },
  gridPhoto: {
    width: 120,
    height: 120,
    borderRadius: Radius.md,
  },
  gridPhotoSm: {
    width: 90,
    height: 90,
    borderRadius: Radius.sm,
  },

  timeline: {
    paddingLeft: 20,
    marginVertical: Spacing.lg,
  },
  timelineLine: {
    position: 'absolute',
    left: 5,
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  timelineItem: {
    marginBottom: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#fff',
    marginRight: Spacing.md,
    marginTop: 4,
    marginLeft: -16,
  },
  timelinePhoto: {
    width: 200,
    height: 150,
    borderRadius: Radius.md,
  },

  quizBtn: {
    width: '100%',
    maxWidth: 300,
    marginBottom: Spacing.sm,
    borderRadius: Radius.md,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  feedbackText: {
    color: '#fff',
    fontSize: 16,
    marginTop: Spacing.md,
    textAlign: 'center',
  },

  countdownRow: {
    flexDirection: 'row',
    gap: Spacing.xl,
    marginTop: Spacing.xxxl,
  },
  countdownBox: { alignItems: 'center' },
  countdownNum: {
    fontSize: 48,
    fontWeight: '700',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 20,
  },
  countdownLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    textTransform: 'uppercase',
    marginTop: 2,
  },

  finalMsg: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    lineHeight: 28,
    maxWidth: 320,
    marginBottom: Spacing.lg,
  },

  dotRow: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    zIndex: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  dotActive: {
    width: 24,
    backgroundColor: '#fff',
  },
  dotDone: {
    backgroundColor: 'rgba(255,255,255,0.7)',
  },

  reactionRow: {
    position: 'absolute',
    bottom: 50,
    flexDirection: 'row',
    justifyContent: 'center',
    alignSelf: 'center',
    gap: Spacing.md,
    zIndex: 10,
  },
  reactionBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    width: 52,
    height: 52,
  },
});

export default SurpriseViewerScreen;
