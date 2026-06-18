import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  Linking,
  TouchableOpacity,
  useWindowDimensions,
  Platform,
  SafeAreaView
} from 'react-native';
import {
  Text,
  Card,
  Button,
  TextInput,
  ActivityIndicator,
  Divider,
  IconButton
} from 'react-native-paper';
import LottieView from 'lottie-react-native';
import { inviteDesignService } from '../services/inviteDesignService';
import { Colors, Spacing, Radius } from '../theme';

/* ── Calendar Link Generator ────────────────────────────────────────── */

const makeCalendarUrl = (event) => {
  if (!event || !event.date) return '';
  try {
    const start = new Date(event.date);
    const end = event.endDate ? new Date(event.endDate) : new Date(start.getTime() + 3 * 60 * 60 * 1000);

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

/* ── Main Screen Component ───────────────────────────────────────────── */

const DigitalInviteScreen = ({ route, navigation }) => {
  const { token } = route.params || {};
  const { width: screenWidth } = useWindowDimensions();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [inviteData, setInviteData] = useState(null);

  // RSVP States
  const [rsvpStatus, setRsvpStatus] = useState('pending');
  const [plusOnes, setPlusOnes] = useState(0);
  const [dietaryPreferences, setDietaryPreferences] = useState('');
  const [isSubmittingRsvp, setIsSubmittingRsvp] = useState(false);
  const [rsvpSuccess, setRsvpSuccess] = useState(false);

  // Layout refs for scrolling to sections
  const scrollViewRef = useRef(null);
  const rsvpSectionY = useRef(0);
  const detailsSectionY = useRef(0);

  // Fetch Invite
  useEffect(() => {
    const loadInvite = async () => {
      if (!token) {
        setError('No invitation token provided.');
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const data = await inviteDesignService.getPublicInvite(token);
        setInviteData(data);
        if (data.guest?.rsvpStatus) {
          setRsvpStatus(data.guest.rsvpStatus);
        }
        if (data.guest?.plusOnes !== undefined) {
          setPlusOnes(data.guest.plusOnes);
        }
        if (data.guest?.dietaryPreferences) {
          setDietaryPreferences(data.guest.dietaryPreferences);
        }
        setError(null);
      } catch (err) {
        console.error('Error fetching invite:', err);
        setError(err.response?.data?.message || 'Invitation not found. Please check the token.');
      } finally {
        setLoading(false);
      }
    };

    loadInvite();
  }, [token]);

  // Submit RSVP
  const handleRsvpSubmit = async () => {
    if (rsvpStatus === 'pending') {
      Alert.alert('Status Required', 'Please select if you are attending, declining, or unsure.');
      return;
    }

    try {
      setIsSubmittingRsvp(true);
      await inviteDesignService.submitPublicRsvp(token, {
        status: rsvpStatus,
        plusOnes: rsvpStatus === 'accepted' ? Number(plusOnes) : 0,
        dietaryPreferences: rsvpStatus === 'accepted' ? dietaryPreferences.trim() : '',
      });
      setRsvpSuccess(true);
      Alert.alert('Success', 'Your RSVP has been submitted!');
    } catch (err) {
      console.error('Error submitting RSVP:', err);
      Alert.alert('RSVP Failed', err.response?.data?.message || 'Could not submit RSVP. Please try again.');
    } finally {
      setIsSubmittingRsvp(false);
    }
  };

  // Canvas Action Button Clicks
  const handleCanvasActionClick = (actionKind, customUrl) => {
    switch (actionKind) {
      case 'rsvp':
        if (scrollViewRef.current) {
          scrollViewRef.current.scrollTo({ y: rsvpSectionY.current, animated: true });
        }
        break;
      case 'directions':
        if (inviteData?.mapUrl) {
          Linking.openURL(inviteData.mapUrl).catch(() => {
            Alert.alert('Maps Unavailable', 'Could not open navigation directions.');
          });
        }
        break;
      case 'liveStream':
        const url = customUrl || (inviteData?.event?.description?.match(/https?:\/\/[^\s]+/i)?.[0]);
        if (url) {
          Linking.openURL(url).catch(() => {
            Alert.alert('Link Unavailable', 'Could not open live stream link.');
          });
        } else {
          Alert.alert('Not Streaming Yet', 'No livestream link is configured for this event.');
        }
        break;
      case 'details':
        if (scrollViewRef.current) {
          scrollViewRef.current.scrollTo({ y: detailsSectionY.current, animated: true });
        }
        break;
      case 'custom':
        if (customUrl) {
          Linking.openURL(customUrl).catch(() => {
            Alert.alert('Link Unavailable', 'Could not open custom link.');
          });
        }
        break;
      default:
        break;
    }
  };

  // ── Render Helpers ─────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading invitation...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <IconButton icon="alert-circle-outline" iconColor={Colors.danger} size={48} />
        <Text variant="headlineSmall" style={styles.errorTitle}>Invite Error</Text>
        <Text style={styles.errorText}>{error}</Text>
        <Button mode="contained" onPress={() => navigation.goBack()} style={styles.btn}>
          Go Back
        </Button>
      </View>
    );
  }

  const { guest, event, resolvedLayout } = inviteData;
  const canvasSize = (resolvedLayout?.canvasSize || '1080x1920').split('x').map(Number);
  const canvasWidth = canvasSize[0] || 1080;
  const canvasHeight = canvasSize[1] || 1920;

  // Render full device width card
  const containerWidth = screenWidth;
  const scale = containerWidth / canvasWidth;
  const containerHeight = canvasHeight * scale;

  const bgStyle = resolvedLayout?.backgroundColor
    ? { backgroundColor: resolvedLayout.backgroundColor }
    : { backgroundColor: '#fff7f2' };

  const calendarUrl = makeCalendarUrl(event);

  // Sparkles
  const sparkles = [
    { left: '8%', top: 120, size: 14 },
    { left: '88%', top: 260, size: 18 },
    { left: '4%', top: 580, size: 15 },
    { left: '92%', top: 780, size: 20 },
    { left: '12%', top: 1100, size: 16 },
    { left: '85%', top: 1350, size: 22 },
  ];

  return (
    <SafeAreaView style={styles.root}>
      {/* Immersive Header bar */}
      <View style={styles.headerBar}>
        <IconButton
          icon="arrow-left"
          iconColor="#F8FAFC"
          size={24}
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        />
        <Text variant="titleMedium" style={styles.headerTitle} numberOfLines={1}>
          {event?.title || 'Invitation'}
        </Text>
      </View>

      <ScrollView ref={scrollViewRef} contentContainerStyle={styles.scrollContent}>
        {/* Floating Sparkles in Screen Background */}
        {sparkles.map((s, idx) => (
          <Text
            key={idx}
            style={[
              styles.sparkle,
              { left: s.left, top: s.top, fontSize: s.size }
            ]}
          >
            ✦
          </Text>
        ))}

        {/* ── SECTION 1: CANVAS CARD ── */}
        <View style={[styles.canvasWrapper, { width: containerWidth, height: containerHeight }, bgStyle]}>
          {resolvedLayout && resolvedLayout.elements ? (
            resolvedLayout.elements.map((el) => {
              const elLeft = (Number(el.x) || 0) * scale;
              const elTop = (Number(el.y) || 0) * scale;
              const elWidth = (Number(el.width) || 100) * scale;
              const elHeight = el.height === 'auto' ? 'auto' : (Number(el.height) || 60) * scale;
              const elZIndex = Number(el.z) || 1;

              const elementStyle = {
                position: 'absolute',
                left: elLeft,
                top: elTop,
                width: elWidth,
                height: elHeight,
                zIndex: elZIndex,
              };

              return (
                <View key={el.id} style={elementStyle}>
                  {el.type === 'text' && (
                    <Text
                      style={{
                        fontSize: (Number(el.fontSize) || 16) * scale,
                        fontWeight: el.fontWeight === '400' ? '400' : '700',
                        color: el.color || '#2b1d18',
                        fontFamily: el.fontFamily || 'System',
                        textAlign: el.textAlign || 'center',
                      }}
                    >
                      {el.text}
                    </Text>
                  )}

                  {el.type === 'image' && (
                    <Image
                      source={{ uri: el.src || el.imageUrl || 'https://via.placeholder.com/150' }}
                      style={{ width: '100%', height: '100%', borderRadius: (Number(el.borderRadius) || 0) * scale }}
                      resizeMode={el.objectFit === 'contain' ? 'contain' : 'cover'}
                    />
                  )}

                  {el.type === 'shape' && el.shapeType === 'rectangle' && (
                    <View
                      style={{
                        width: '100%',
                        height: '100%',
                        backgroundColor: el.fillColor || '#fff',
                        borderColor: el.strokeColor || 'transparent',
                        borderWidth: (Number(el.strokeWidth) || 0) * scale,
                        borderRadius: (Number(el.borderRadius) || 0) * scale,
                      }}
                    />
                  )}

                  {el.type === 'divider' && (
                    <View
                      style={{
                        width: '100%',
                        height: (Number(el.thickness) || 2) * scale,
                        backgroundColor: el.color || '#ccc',
                      }}
                    />
                  )}

                  {el.type === 'lottie' && el.lottieSource && (
                    <LottieView
                      source={
                        typeof el.lottieSource === 'object' && el.lottieSource?.uri
                          ? { uri: el.lottieSource.uri }
                          : el.lottieSource
                      }
                      autoPlay={el.autoPlay !== false}
                      loop={el.loop !== false}
                      style={{ width: '100%', height: '100%' }}
                      resizeMode="cover"
                    />
                  )}

                  {el.type === 'action' && (
                    <TouchableOpacity
                      onPress={() => handleCanvasActionClick(el.actionKind, el.url)}
                      style={{
                        width: '100%',
                        height: '100%',
                        borderColor: el.strokeColor || '#c9b07d',
                        borderWidth: (Number(el.strokeWidth) || 2) * scale,
                        borderRadius: (Number(el.borderRadius) || 8) * scale,
                        backgroundColor: el.fillColor || '#ffffff',
                        alignItems: 'center',
                        justifyContent: 'center',
                        paddingHorizontal: 8,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: (Number(el.fontSize) || 16) * scale,
                          fontWeight: el.fontWeight || 'bold',
                          color: el.textColor || '#374151',
                          fontFamily: el.fontFamily || 'System',
                          textAlign: el.textAlign || 'center',
                        }}
                      >
                        {el.label || 'Action'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          ) : (
            /* Fallback clean Layout */
            <View style={styles.fallbackCard}>
              <Text style={styles.fallbackGreeting}>Namaste</Text>
              <Text variant="headlineMedium" style={styles.fallbackTitle}>
                {event?.title || 'Wedding Celebration'}
              </Text>
              <View style={styles.fallbackDivider} />
              <Text style={styles.fallbackDate}>📅 {event?.dateText}</Text>
              <Text style={styles.fallbackVenue}>📍 {event?.venue}</Text>
              <View style={styles.fallbackGuestCard}>
                <Text style={styles.fallbackGuest}>Personalized for: {guest?.name}</Text>
              </View>
            </View>
          )}
        </View>

        {/* ── SECTION 2: GUEST WELCOME CARD ── */}
        <Card style={styles.glassPanel}>
          <Card.Content>
            <Text variant="titleLarge" style={styles.greetText}>Namaste</Text>
            <Text style={styles.personalizedMessage}>
              {guest?.personalizedInviteMessage ||
                `We cordially invite you, ${guest?.name || 'our guest'}, to join us on our special occasion and bless us with your presence.`}
            </Text>
            {guest?.relationship ? (
              <View style={styles.relationBadge}>
                <Text style={styles.relationText}>Relationship: {guest.relationship}</Text>
              </View>
            ) : null}
          </Card.Content>
        </Card>

        {/* ── SECTION 3: RSVP FORM ── */}
        <View
          onLayout={(event) => {
            rsvpSectionY.current = event.nativeEvent.layout.y;
          }}
        >
          <Card style={styles.glassPanel}>
            <Card.Content>
              {rsvpSuccess ? (
                <View style={styles.successBlock}>
                  <IconButton icon="check-circle" iconColor={Colors.success} size={48} />
                  <Text variant="titleMedium" style={styles.successTitle}>RSVP Submitted!</Text>
                  <Text style={styles.successSub}>Thank you for confirming. We look forward to seeing you!</Text>
                  <Button mode="outlined" style={styles.outlineBtn} textColor={Colors.primary} onPress={() => setRsvpSuccess(false)}>
                    Update RSVP Again
                  </Button>
                </View>
              ) : (
                <View>
                  <Text variant="titleMedium" style={styles.sectionTitle}>Will You Attend?</Text>

                  <View style={styles.rsvpSelector}>
                    {/* Accept */}
                    <TouchableOpacity
                      onPress={() => setRsvpStatus('accepted')}
                      style={[
                        styles.rsvpCard,
                        rsvpStatus === 'accepted' && styles.rsvpCardActive
                      ]}
                    >
                      <Text style={styles.rsvpEmoji}>🌸</Text>
                      <Text style={[styles.rsvpLabel, rsvpStatus === 'accepted' && styles.rsvpLabelActive]}>
                        Accept
                      </Text>
                    </TouchableOpacity>

                    {/* Maybe */}
                    <TouchableOpacity
                      onPress={() => setRsvpStatus('maybe')}
                      style={[
                        styles.rsvpCard,
                        rsvpStatus === 'maybe' && styles.rsvpCardActive
                      ]}
                    >
                      <Text style={styles.rsvpEmoji}>🤔</Text>
                      <Text style={[styles.rsvpLabel, rsvpStatus === 'maybe' && styles.rsvpLabelActive]}>
                        Maybe
                      </Text>
                    </TouchableOpacity>

                    {/* Decline */}
                    <TouchableOpacity
                      onPress={() => setRsvpStatus('declined')}
                      style={[
                        styles.rsvpCard,
                        rsvpStatus === 'declined' && styles.rsvpCardActive
                      ]}
                    >
                      <Text style={styles.rsvpEmoji}>🥀</Text>
                      <Text style={[styles.rsvpLabel, rsvpStatus === 'declined' && styles.rsvpLabelActive]}>
                        Decline
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {rsvpStatus === 'accepted' && (
                    <View style={styles.acceptedFields}>
                      <Text style={styles.fieldLabel}>Number of Additional Guests</Text>
                      <View style={styles.plusOneSelector}>
                        {[0, 1, 2, 3, 4, 5].map((num) => (
                          <TouchableOpacity
                            key={num}
                            onPress={() => setPlusOnes(num)}
                            style={[
                              styles.plusOneBtn,
                              plusOnes === num && styles.plusOneBtnActive
                            ]}
                          >
                            <Text
                              style={[
                                styles.plusOneText,
                                plusOnes === num && styles.plusOneTextActive
                              ]}
                            >
                              {num === 0 ? 'Me' : `+${num}`}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      <TextInput
                        mode="outlined"
                        label="Dietary Preferences / Notes"
                        placeholder="e.g. Vegetarian, Allergies"
                        value={dietaryPreferences}
                        onChangeText={setDietaryPreferences}
                        textColor="#F8FAFC"
                        activeOutlineColor={Colors.primary}
                        outlineColor="rgba(255, 255, 255, 0.15)"
                        style={styles.textInput}
                        theme={{ colors: { onSurfaceVariant: '#94A3B8' } }}
                      />
                    </View>
                  )}

                  <Button
                    mode="contained"
                    onPress={handleRsvpSubmit}
                    loading={isSubmittingRsvp}
                    disabled={isSubmittingRsvp || rsvpStatus === 'pending'}
                    style={styles.submitBtn}
                    labelStyle={{ fontWeight: '700' }}
                  >
                    Confirm RSVP Status
                  </Button>
                </View>
              )}
            </Card.Content>
          </Card>
        </View>

        {/* ── SECTION 4: EVENT DETAILS SCHEDULE ── */}
        <View
          onLayout={(event) => {
            detailsSectionY.current = event.nativeEvent.layout.y;
          }}
        >
          <Card style={styles.glassPanel}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.sectionTitle}>Event Schedule</Text>

              {/* Date */}
              <View style={styles.infoRow}>
                <IconButton icon="calendar-month-outline" iconColor={Colors.primary} size={22} style={styles.infoIcon} />
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>When</Text>
                  <Text style={styles.infoValue}>{event?.dateText || 'To be announced'}</Text>
                  <Text style={styles.infoSubValue}>{event?.timeText || ''}</Text>
                </View>
              </View>

              <Divider style={styles.infoDivider} />

              {/* Venue */}
              <View style={styles.infoRow}>
                <IconButton icon="map-marker-outline" iconColor={Colors.primary} size={22} style={styles.infoIcon} />
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>Where</Text>
                  <Text style={styles.infoValue}>{event?.venue || 'To be announced'}</Text>
                  <Text style={styles.infoSubValue}>
                    {[event?.address, event?.city, event?.state].filter(Boolean).join(', ')}
                  </Text>
                </View>
              </View>

              {event?.description ? (
                <View>
                  <Divider style={styles.infoDivider} />
                  <View style={styles.infoRow}>
                    <IconButton icon="information-outline" iconColor={Colors.primary} size={22} style={styles.infoIcon} />
                    <View style={styles.infoTextContainer}>
                      <Text style={styles.infoLabel}>About the Celebration</Text>
                      <Text style={styles.infoDescription}>{event.description}</Text>
                    </View>
                  </View>
                </View>
              ) : null}

              {/* Interactive Actions Grid */}
              <View style={styles.actionGrid}>
                {inviteData.mapUrl ? (
                  <Button
                    mode="outlined"
                    icon="compass-outline"
                    textColor={Colors.primary}
                    style={styles.gridActionBtn}
                    onPress={() => Linking.openURL(inviteData.mapUrl)}
                  >
                    Venue Directions
                  </Button>
                ) : null}

                {calendarUrl ? (
                  <Button
                    mode="outlined"
                    icon="calendar-plus"
                    textColor={Colors.primary}
                    style={styles.gridActionBtn}
                    onPress={() => Linking.openURL(calendarUrl)}
                  >
                    Add to Calendar
                  </Button>
                ) : null}

                {resolvedLayout?.mergeData?.custom?.liveStreamUrl ? (
                  <Button
                    mode="outlined"
                    icon="youtube"
                    textColor="#EF4444"
                    style={[styles.gridActionBtn, { borderColor: 'rgba(239, 68, 68, 0.4)' }]}
                    onPress={() => Linking.openURL(resolvedLayout.mergeData.custom.liveStreamUrl)}
                  >
                    Join Live Stream
                  </Button>
                ) : null}
              </View>

            </Card.Content>
          </Card>
        </View>

        <View style={{ height: 48 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0B0F19',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0B0F19',
  },
  loadingText: {
    marginTop: Spacing.md,
    color: '#94A3B8',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
    backgroundColor: '#0B0F19',
  },
  errorTitle: {
    color: '#F8FAFC',
    fontWeight: '800',
    marginTop: Spacing.sm,
  },
  errorText: {
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  btn: {
    backgroundColor: Colors.primary,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(11, 15, 25, 0.85)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: Platform.OS === 'ios' ? 4 : 8,
    paddingHorizontal: 8,
  },
  backBtn: {
    margin: 0,
  },
  headerTitle: {
    color: '#F8FAFC',
    fontWeight: '700',
    flex: 1,
    marginLeft: 8,
  },
  scrollContent: {
    flexGrow: 1,
  },
  sparkle: {
    position: 'absolute',
    color: '#E8C86B',
    opacity: 0.25,
  },
  canvasWrapper: {
    position: 'relative',
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    marginBottom: Spacing.lg,
  },
  fallbackCard: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xxl,
    backgroundColor: '#fff7f2',
  },
  fallbackGreeting: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#7c2d12',
    fontStyle: 'italic',
  },
  fallbackTitle: {
    color: '#7c2d12',
    fontWeight: '800',
    textAlign: 'center',
    marginVertical: Spacing.sm,
  },
  fallbackDivider: {
    width: 60,
    height: 2,
    backgroundColor: '#b45309',
    marginVertical: Spacing.md,
  },
  fallbackDate: {
    fontSize: 16,
    color: '#3f3f46',
    fontWeight: '600',
  },
  fallbackVenue: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  fallbackGuestCard: {
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: '#fef3c7',
    borderRadius: Radius.sm,
  },
  fallbackGuest: {
    color: '#b45309',
    fontWeight: '600',
  },
  glassPanel: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    backgroundColor: 'rgba(30, 41, 59, 0.75)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderRadius: Radius.lg,
    elevation: 2,
  },
  greetText: {
    color: '#E8C86B',
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: Spacing.sm,
    fontStyle: 'italic',
  },
  personalizedMessage: {
    color: '#F8FAFC',
    fontSize: 15,
    lineHeight: 24,
    textAlign: 'center',
  },
  relationBadge: {
    alignSelf: 'center',
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(232, 200, 107, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(232, 200, 107, 0.25)',
  },
  relationText: {
    color: '#E8C86B',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  sectionTitle: {
    color: '#E8C86B',
    fontWeight: '700',
    marginBottom: Spacing.md,
  },
  successBlock: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  successTitle: {
    color: '#F8FAFC',
    fontWeight: '700',
    marginTop: Spacing.sm,
  },
  successSub: {
    color: '#94A3B8',
    textAlign: 'center',
    marginVertical: Spacing.md,
  },
  outlineBtn: {
    borderColor: Colors.primary,
    borderRadius: Radius.sm,
    width: '100%',
  },
  rsvpSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  rsvpCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1.5,
    borderRadius: Radius.md,
  },
  rsvpCardActive: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
  },
  rsvpEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  rsvpLabel: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  rsvpLabelActive: {
    color: Colors.primary,
    fontWeight: '800',
  },
  acceptedFields: {
    marginTop: Spacing.lg,
  },
  fieldLabel: {
    color: '#F8FAFC',
    fontSize: 13,
    marginBottom: Spacing.sm,
    fontWeight: '600',
  },
  plusOneSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
    gap: 6,
  },
  plusOneBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  plusOneBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  plusOneText: {
    color: '#94A3B8',
    fontWeight: '600',
    fontSize: 12,
  },
  plusOneTextActive: {
    color: Colors.textOnPrimary,
    fontWeight: '800',
  },
  textInput: {
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    marginBottom: Spacing.xs,
  },
  submitBtn: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.primary,
    borderRadius: Radius.sm,
    paddingVertical: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 4,
  },
  infoIcon: {
    margin: 0,
    marginRight: 8,
    marginTop: -2,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoLabel: {
    color: '#E8C86B',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '600',
    marginTop: 2,
  },
  infoSubValue: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 2,
  },
  infoDescription: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 4,
  },
  infoDivider: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: Spacing.md,
  },
  actionGrid: {
    marginTop: Spacing.xl,
    gap: Spacing.sm,
  },
  gridActionBtn: {
    borderColor: 'rgba(212, 175, 55, 0.35)',
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
});

export default DigitalInviteScreen;
