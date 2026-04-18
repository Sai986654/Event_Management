import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  Alert,
  Image,
  Share,
  Linking,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import {
  ActivityIndicator,
  Button,
  Card,
  Chip,
  Divider,
  IconButton,
  Snackbar,
  Text,
  TextInput,
} from 'react-native-paper';
import { Colors, Radius, Spacing } from '../theme';
import { getErrorMessage } from '../utils/helpers';
import { guestService } from '../services/guestService';
import { inviteVideoService } from '../services/inviteVideoService';

const parseGuests = (raw) => String(raw || '')
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line) => {
    const [name, phone] = line.split(',').map((x) => x.trim());
    return { name, phone };
  })
  .filter((g) => g.name && g.phone);

const terminalStatuses = new Set(['completed', 'failed']);

const statusColor = (status) => {
  if (status === 'completed') return Colors.success;
  if (status === 'failed') return Colors.danger;
  if (status === 'processing') return Colors.primary;
  if (status === 'pending') return Colors.warning;
  return Colors.textMuted;
};

const EVENT_TYPE_OPTIONS = [
  { value: 'wedding', label: 'Wedding' },
  { value: 'engagement', label: 'Engagement' },
  { value: 'birthday', label: 'Birthday' },
  { value: 'housewarming', label: 'Housewarming' },
  { value: 'babyshower', label: 'Baby Shower' },
  { value: 'corporate', label: 'Corporate' },
  { value: 'reception', label: 'Reception' },
  { value: 'anniversary', label: 'Anniversary' },
  { value: 'default', label: 'General' },
];

const PROMPT_PACKS = {
  wedding: [
    'Ultra-detailed Indian wedding invitation visual, royal floral mandap with marigold and jasmine, cinematic warm lighting, elegant gold and ivory palette, sacred fire setup, no text, portrait 9:16, photorealistic, premium editorial style',
    'Luxurious wedding couple silhouette scene on palace terrace, sunset sky, floating diyas and rose petals, soft bokeh, rich reds and golds, no text, portrait 9:16, ultra realistic, high detail',
    'Grand baraat celebration moodboard frame, decorated horse, shehnai ambience elements, festive lights, confetti, dynamic composition, no text, portrait 9:16, cinematic realism',
    'Dreamy South Asian wedding stage decor with crystal chandeliers, pastel florals, velvet seating, elegant depth of field, no text, portrait 9:16, hyper realistic, premium invite aesthetic',
    'Traditional wedding rituals flat-lay concept with kalash, bangles, garlands, sindoor tray, silk fabric texture, dramatic studio light, no text, portrait 9:16, photorealistic',
  ],
  engagement: [
    'Elegant engagement ceremony backdrop, ring exchange focus, blush pink and champagne gold florals, premium event decor, no text, portrait 9:16, photorealistic cinematic lighting',
    'Close-up luxury engagement rings on embroidered silk with flower petals and fairy lights, macro detail, no text, portrait 9:16, ultra realistic',
    'Modern engagement lounge setup with floral arch, candle clusters, glass accents, soft romantic ambience, no text, portrait 9:16, editorial realism',
    'Royal engagement celebration vibe, confetti shimmer, warm spotlight, deep navy and gold palette, no text, portrait 9:16, high detail',
    'Minimal classy engagement invitation visual, monochrome ivory decor with subtle floral textures, clean premium composition, no text, portrait 9:16',
  ],
  birthday: [
    'Vibrant premium birthday celebration setup, elegant balloons, cake table, fairy lights, festive confetti motion, no text, portrait 9:16, photorealistic',
    'Luxury birthday cake close-up with candles and floral styling, cinematic depth of field, no text, portrait 9:16, ultra detailed',
    'Kids birthday fantasy party scene with pastel decor, playful props, soft magical lighting, no text, portrait 9:16, realistic style',
    'Milestone birthday black-and-gold theme, premium event stage, spotlight and bokeh, no text, portrait 9:16, editorial realism',
    'Outdoor garden birthday evening setup, warm string lights, elegant table styling, no text, portrait 9:16, cinematic realism',
  ],
  housewarming: [
    'Traditional griha pravesh ceremony entrance with rangoli, mango leaf toran, brass lamps, warm sunlight, no text, portrait 9:16, photorealistic',
    'Elegant new home celebration interior decor, floral welcome setup, soft ambient lighting, no text, portrait 9:16, realistic premium style',
    'Housewarming puja essentials composition with kalash, coconut, flowers, diya glow, no text, portrait 9:16, high detail realism',
    'Modern housewarming gathering mood with classy seating and festive accents, no text, portrait 9:16, cinematic look',
    'Aerial-inspired living room celebration setup with subtle luxury decor and warm tones, no text, portrait 9:16, photorealistic',
  ],
  babyshower: [
    'Elegant baby shower setup with pastel balloons, floral arch, teddy accents, soft dreamy lighting, no text, portrait 9:16, photorealistic',
    'Premium baby shower dessert table with delicate cakes and decor props, no text, portrait 9:16, high detail realistic style',
    'Warm family celebration atmosphere with gentle pastel palette and bokeh lights, no text, portrait 9:16, cinematic realism',
    'Minimal chic baby shower invitation visual with ivory and blush elements, no text, portrait 9:16, editorial aesthetic',
    'Festive baby shower stage design with elegant drapes and floral installations, no text, portrait 9:16, photorealistic',
  ],
  corporate: [
    'High-end corporate event stage with LED wall glow, premium blue lighting, audience ambience, no text, portrait 9:16, photorealistic',
    'Professional networking lounge setup with modern decor, subtle brand-neutral aesthetics, no text, portrait 9:16, realistic editorial style',
    'Corporate award night mood, spotlight beams, crystal accents, dark luxury palette, no text, portrait 9:16, cinematic realism',
    'Conference hall premium setup with clean lines and modern architecture, no text, portrait 9:16, ultra detailed',
    'Executive event invitation visual with abstract glass textures and dramatic lighting, no text, portrait 9:16, photorealistic',
  ],
  reception: [
    'Luxury wedding reception stage with floral wall and crystal chandeliers, rich gold lighting, no text, portrait 9:16, photorealistic',
    'Evening reception ambience with elegant couple table setup and candle glow, no text, portrait 9:16, cinematic realism',
    'Grand ballroom reception decor, dramatic spotlight and bokeh guests, no text, portrait 9:16, editorial high detail',
    'Modern reception lounge with premium florals and velvet textures, no text, portrait 9:16, photorealistic style',
    'Reception celebration scene with confetti sparkle and warm luxury tones, no text, portrait 9:16, realistic',
  ],
  anniversary: [
    'Elegant anniversary celebration decor with roses and candlelight, premium romantic ambience, no text, portrait 9:16, photorealistic',
    'Luxury anniversary dinner setup with floral centerpieces and warm bokeh lights, no text, portrait 9:16, cinematic realism',
    'Golden anniversary event stage with classy drapes and decorative lighting, no text, portrait 9:16, high detail',
    'Minimal upscale anniversary invitation visual with ivory-gold textures, no text, portrait 9:16, editorial style',
    'Romantic celebration mood with subtle confetti and elegant decor accents, no text, portrait 9:16, realistic',
  ],
  default: [
    'Premium festive invitation visual, elegant decor, cinematic warm lighting, no text, portrait 9:16, photorealistic',
    'Luxury event setup with florals and lights, rich color grading, no text, portrait 9:16, high detail realism',
    'Modern elegant celebration background, shallow depth of field, no text, portrait 9:16, editorial style',
    'Grand celebratory ambience with premium decor accents and bokeh, no text, portrait 9:16, cinematic realistic look',
    'Refined invitation moodboard with traditional + modern elements, no text, portrait 9:16, photorealistic',
  ],
};

const normalizeEventType = (value) => {
  const v = String(value || '').toLowerCase().replace(/[^a-z]/g, '');
  if (!v) return 'default';
  if (v.includes('wedding') || v.includes('marriage')) return 'wedding';
  if (v.includes('engagement') || v.includes('ring')) return 'engagement';
  if (v.includes('birthday') || v.includes('bday')) return 'birthday';
  if (v.includes('housewarming') || v.includes('grihapravesh') || v.includes('gruhapravesam')) return 'housewarming';
  if (v.includes('babyshower') || v.includes('seemantham') || v.includes('seemantham')) return 'babyshower';
  if (v.includes('corporate') || v.includes('office') || v.includes('conference')) return 'corporate';
  if (v.includes('reception')) return 'reception';
  if (v.includes('anniversary')) return 'anniversary';
  return 'default';
};

const InviteVideoScreen = ({ route }) => {
  const eventId = Number(route.params?.eventId);
  const eventTitle = route.params?.eventTitle || 'Event';
  const initialEventType = normalizeEventType(route.params?.eventType);

  const [guestLines, setGuestLines] = useState('');
  const [voiceTemplate, setVoiceTemplate] = useState('');
  const [voiceLang, setVoiceLang] = useState('en');
  const [images, setImages] = useState([]);
  const [music, setMusic] = useState(null);
  const [promptEventType, setPromptEventType] = useState(initialEventType);

  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [jobDetail, setJobDetail] = useState(null);

  const [loadingSetup, setLoadingSetup] = useState(true);
  const [creating, setCreating] = useState(false);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [loadingJobDetail, setLoadingJobDetail] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const [snack, setSnack] = useState({ visible: false, text: '', type: 'info' });
  const pollRef = useRef(null);

  const showSnack = (text, type = 'info') => setSnack({ visible: true, text, type });

  const parsedGuests = useMemo(() => parseGuests(guestLines), [guestLines]);
  const activePromptPack = useMemo(
    () => PROMPT_PACKS[promptEventType] || PROMPT_PACKS.default,
    [promptEventType]
  );

  const copyText = async (text, successLabel = 'Copied') => {
    try {
      const Clipboard = require('react-native').Clipboard || require('@react-native-clipboard/clipboard').default;
      if (Clipboard?.setString) {
        Clipboard.setString(text);
        showSnack(successLabel);
      } else {
        await Share.share({ message: text });
        showSnack('Opened share sheet.');
      }
    } catch {
      await Share.share({ message: text });
      showSnack('Opened share sheet.');
    }
  };

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const loadJobs = useCallback(async () => {
    setLoadingJobs(true);
    try {
      const res = await inviteVideoService.getJobsByEvent(eventId);
      const list = res.jobs || [];
      setJobs(list);
      if (!selectedJobId && list.length > 0) {
        setSelectedJobId(list[0].id);
      }
    } catch (err) {
      showSnack(getErrorMessage(err), 'error');
    } finally {
      setLoadingJobs(false);
    }
  }, [eventId, selectedJobId]);

  const loadJobDetail = useCallback(async (jobId) => {
    if (!jobId) return;
    setLoadingJobDetail(true);
    try {
      const res = await inviteVideoService.getInviteJob(jobId);
      setJobDetail(res);
    } catch (err) {
      showSnack(getErrorMessage(err), 'error');
    } finally {
      setLoadingJobDetail(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const bootstrap = async () => {
      if (!eventId) {
        showSnack('Invalid event ID.', 'error');
        setLoadingSetup(false);
        return;
      }

      try {
        const [guestsRes, jobsRes] = await Promise.all([
          guestService.getEventGuests(eventId).catch(() => ({ guests: [] })),
          inviteVideoService.getJobsByEvent(eventId).catch(() => ({ jobs: [] })),
        ]);

        if (!mounted) return;

        const guests = guestsRes.guests || [];
        const defaultLines = guests
          .filter((g) => g.name && g.phone)
          .map((g) => `${g.name}, ${g.phone}`)
          .join('\n');
        setGuestLines(defaultLines);

        const list = jobsRes.jobs || [];
        setJobs(list);
        if (list.length > 0) {
          setSelectedJobId(list[0].id);
        }
      } catch (err) {
        if (mounted) showSnack(getErrorMessage(err), 'error');
      } finally {
        if (mounted) setLoadingSetup(false);
      }
    };

    bootstrap();

    return () => {
      mounted = false;
      stopPolling();
    };
  }, [eventId, stopPolling]);

  useEffect(() => {
    if (!selectedJobId) {
      stopPolling();
      setJobDetail(null);
      return;
    }

    loadJobDetail(selectedJobId);
    stopPolling();

    pollRef.current = setInterval(async () => {
      try {
        const res = await inviteVideoService.getInviteJob(selectedJobId);
        setJobDetail(res);
        if (terminalStatuses.has(res.status)) {
          stopPolling();
          loadJobs();
        }
      } catch {
        // Keep UI stable on intermittent poll failures.
      }
    }, 5000);

    return stopPolling;
  }, [selectedJobId, loadJobDetail, loadJobs, stopPolling]);

  const pickImages = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission Needed', 'Please allow gallery access to pick invite images.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: 5,
        quality: 0.9,
      });

      if (result.canceled) return;

      const assets = result.assets || [];
      if (assets.length > 5) {
        showSnack('Please select up to 5 images only.', 'error');
        return;
      }
      setImages(assets);
    } catch (err) {
      showSnack(getErrorMessage(err), 'error');
    }
  };

  const pickMusic = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['audio/*'],
        multiple: false,
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset?.uri) {
        showSnack('Could not read selected music file.', 'error');
        return;
      }
      setMusic(asset);
      showSnack(`Music selected: ${asset.name || 'audio file'}`);
    } catch (err) {
      showSnack(getErrorMessage(err), 'error');
    }
  };

  const createJob = async () => {
    if (!eventId) {
      showSnack('Invalid event ID.', 'error');
      return;
    }

    if (images.length < 3 || images.length > 5) {
      showSnack('Please select 3 to 5 images.', 'error');
      return;
    }

    if (!parsedGuests.length) {
      showSnack('Add at least one guest with name and phone.', 'error');
      return;
    }

    setCreating(true);
    try {
      const res = await inviteVideoService.createInviteJob({
        eventId,
        guests: parsedGuests,
        images,
        music,
        voiceTemplate,
        voiceLang,
      });

      showSnack(res.message || 'Invite video job started.');
      setSelectedJobId(res.jobId);
      await loadJobs();
    } catch (err) {
      showSnack(getErrorMessage(err), 'error');
    } finally {
      setCreating(false);
    }
  };

  const retryFailed = async () => {
    if (!selectedJobId) return;
    setRetrying(true);
    try {
      const res = await inviteVideoService.retryFailedGuests(selectedJobId);
      showSnack(res.message || 'Retry queued.');
      await loadJobDetail(selectedJobId);
      await loadJobs();
    } catch (err) {
      showSnack(getErrorMessage(err), 'error');
    } finally {
      setRetrying(false);
    }
  };

  if (loadingSetup) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.primary} />
        <Text style={styles.centeredText}>Loading invite video workspace...</Text>
      </View>
    );
  }

  const failedGuests = (jobDetail?.guests || []).filter((g) => g.status === 'failed').length;
  const completedVideos = (jobDetail?.guests || []).filter((g) => g.status === 'completed' && g.videoUrl);

  const openVideoUrl = async (url) => {
    if (!url) {
      showSnack('Video URL not available yet.', 'error');
      return;
    }
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        showSnack('Cannot open this video URL on device.', 'error');
        return;
      }
      await Linking.openURL(url);
    } catch (err) {
      showSnack(getErrorMessage(err), 'error');
    }
  };

  const shareVideoUrl = async (guestName, url) => {
    if (!url) {
      showSnack('Video URL not available yet.', 'error');
      return;
    }
    try {
      await Share.share({
        title: `${guestName} invite video`,
        message: `${guestName} invite video\n${url}`,
      });
    } catch {
      // user canceled
    }
  };

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Card style={styles.heroCard}>
          <Card.Content>
            <Text variant="headlineSmall" style={styles.heroTitle}>Invite Videos</Text>
            <Text style={styles.heroSubtitle}>Create personalized invite videos for guests with event visuals.</Text>
            <Text style={styles.heroMeta}>Event #{eventId} • {eventTitle}</Text>
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>1) Upload Template Images</Text>
            <Text style={styles.hint}>Select 3 to 5 images (required)</Text>
            <Button mode="contained-tonal" icon="image-multiple" onPress={pickImages} style={styles.btn}>Pick Images</Button>

            {images.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageStrip}>
                {images.map((img, idx) => (
                  <View key={`${img.uri}-${idx}`} style={styles.thumbWrap}>
                    <Image source={{ uri: img.uri }} style={styles.thumb} />
                  </View>
                ))}
              </ScrollView>
            ) : null}
            <Text style={styles.muted}>Selected: {images.length}/5</Text>

            <Divider style={styles.divider} />
            <Text variant="titleSmall" style={styles.sectionTitle}>Optional Music</Text>
            <Text style={styles.hint}>Pick one background music file (mp3/wav/m4a)</Text>
            <View style={styles.rowButtons}>
              <Button mode="outlined" icon="music" onPress={pickMusic} style={[styles.btn, { flex: 1 }]}>Pick Music</Button>
              {music ? (
                <Button mode="text" icon="close" onPress={() => setMusic(null)}>Clear</Button>
              ) : null}
            </View>
            {music ? <Text style={styles.muted}>Selected music: {music.name || 'audio file'}</Text> : <Text style={styles.muted}>No music selected</Text>}
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.rowBetween}>
              <Text variant="titleMedium" style={styles.sectionTitle}>AI Prompt Pack (Copy & Generate)</Text>
              <Button mode="text" compact onPress={() => copyText(activePromptPack.join('\n\n'), 'All prompts copied')}>Copy all</Button>
            </View>
            <Text style={styles.hint}>Use these prompts to generate image set, then upload those images above.</Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
              {EVENT_TYPE_OPTIONS.map((opt) => (
                <Chip
                  key={opt.value}
                  selected={promptEventType === opt.value}
                  onPress={() => setPromptEventType(opt.value)}
                  style={styles.promptTypeChip}
                >
                  {opt.label}
                </Chip>
              ))}
            </ScrollView>

            {activePromptPack.map((prompt, idx) => (
              <View key={`prompt-${idx}`} style={styles.promptCard}>
                <View style={styles.rowBetween}>
                  <Text style={styles.promptTitle}>Prompt {idx + 1}</Text>
                  <Button mode="text" compact onPress={() => copyText(prompt, `Prompt ${idx + 1} copied`)}>Copy</Button>
                </View>
                <Text style={styles.promptText}>{prompt}</Text>
              </View>
            ))}
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>2) Guest List</Text>
            <Text style={styles.hint}>One guest per line: name, phone</Text>
            <TextInput
              mode="outlined"
              multiline
              numberOfLines={8}
              value={guestLines}
              onChangeText={setGuestLines}
              placeholder="Ravi, +919876543210"
              style={styles.textArea}
            />
            <Text style={styles.muted}>Valid guests: {parsedGuests.length}</Text>
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>3) Voice Settings (Optional)</Text>
            <TextInput
              mode="outlined"
              label="Voice template"
              value={voiceTemplate}
              onChangeText={setVoiceTemplate}
              placeholder="Warm festive tone"
              style={styles.input}
            />
            <TextInput
              mode="outlined"
              label="Voice language"
              value={voiceLang}
              onChangeText={setVoiceLang}
              placeholder="en"
              style={styles.input}
            />

            <Button
              mode="contained"
              icon="video-plus"
              onPress={createJob}
              loading={creating}
              disabled={creating}
              style={styles.primaryBtn}
            >
              Start Invite Video Job
            </Button>
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.rowBetween}>
              <Text variant="titleMedium" style={styles.sectionTitle}>Job History</Text>
              <IconButton icon="refresh" onPress={loadJobs} loading={loadingJobs} />
            </View>

            {jobs.length === 0 ? (
              <Text style={styles.muted}>No invite video jobs yet.</Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                {jobs.map((job) => (
                  <Chip
                    key={job.id}
                    selected={selectedJobId === job.id}
                    onPress={() => setSelectedJobId(job.id)}
                    style={styles.jobChip}
                    textStyle={{ color: selectedJobId === job.id ? '#fff' : Colors.textPrimary }}
                    selectedColor="#fff"
                  >
                    #{job.id} {job.status}
                  </Chip>
                ))}
              </ScrollView>
            )}

            <Divider style={styles.divider} />

            {loadingJobDetail ? (
              <ActivityIndicator color={Colors.primary} />
            ) : !jobDetail ? (
              <Text style={styles.muted}>Select a job to see progress.</Text>
            ) : (
              <View>
                <View style={styles.rowBetween}>
                  <Text style={styles.metricLabel}>Status</Text>
                  <Chip style={{ backgroundColor: `${statusColor(jobDetail.status)}22` }}>{jobDetail.status}</Chip>
                </View>
                <View style={styles.rowBetween}><Text style={styles.metricLabel}>Total guests</Text><Text>{jobDetail.totalGuests}</Text></View>
                <View style={styles.rowBetween}><Text style={styles.metricLabel}>Processed</Text><Text>{jobDetail.processed}</Text></View>
                <View style={styles.rowBetween}><Text style={styles.metricLabel}>Failed</Text><Text>{jobDetail.failed}</Text></View>
                <View style={styles.rowBetween}><Text style={styles.metricLabel}>Completed videos</Text><Text>{completedVideos.length}</Text></View>

                {jobDetail.error ? <Text style={styles.errorText}>{jobDetail.error}</Text> : null}

                <Text variant="titleSmall" style={[styles.sectionTitle, { marginTop: Spacing.md }]}>Guest Progress</Text>
                {(jobDetail.guests || []).slice(0, 30).map((g) => (
                  <View key={g.id} style={styles.guestRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.guestName}>{g.guestName}</Text>
                      <Text style={styles.guestMeta}>{g.phone}</Text>
                    </View>
                    <Chip compact style={{ backgroundColor: `${statusColor(g.status)}22` }}>{g.status}</Chip>
                  </View>
                ))}

                {failedGuests > 0 ? (
                  <Button
                    mode="contained-tonal"
                    icon="restart"
                    onPress={retryFailed}
                    loading={retrying}
                    disabled={retrying}
                    style={styles.btn}
                  >
                    Retry Failed Guests ({failedGuests})
                  </Button>
                ) : null}

                {completedVideos.length > 0 ? (
                  <>
                    <Text variant="titleSmall" style={[styles.sectionTitle, { marginTop: Spacing.md }]}>Completed Video Links</Text>
                    {completedVideos.map((g) => (
                      <View key={`video-${g.id}`} style={styles.videoRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.guestName}>{g.guestName}</Text>
                          <Text numberOfLines={1} style={styles.videoUrl}>{g.videoUrl}</Text>
                        </View>
                        <Button compact mode="outlined" onPress={() => openVideoUrl(g.videoUrl)}>
                          Open
                        </Button>
                        <Button compact mode="text" onPress={() => shareVideoUrl(g.guestName, g.videoUrl)}>
                          Share
                        </Button>
                      </View>
                    ))}
                  </>
                ) : null}
              </View>
            )}
          </Card.Content>
        </Card>

        <View style={{ height: 24 }} />
      </ScrollView>

      <Snackbar
        visible={snack.visible}
        onDismiss={() => setSnack((s) => ({ ...s, visible: false }))}
        duration={3200}
        style={snack.type === 'error' ? styles.snackError : undefined}
      >
        {snack.text}
      </Snackbar>
    </>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, paddingBottom: 42 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xxl },
  centeredText: { marginTop: Spacing.sm, color: Colors.textSecondary },

  heroCard: { marginBottom: Spacing.md, borderRadius: Radius.lg, backgroundColor: Colors.primary },
  heroTitle: { color: '#fff', fontWeight: '800' },
  heroSubtitle: { color: 'rgba(255,255,255,0.88)', marginTop: 4 },
  heroMeta: { color: 'rgba(255,255,255,0.76)', marginTop: 6, fontSize: 12 },

  card: { marginBottom: Spacing.md, borderRadius: Radius.lg, backgroundColor: Colors.surface, elevation: 2 },
  sectionTitle: { fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.sm },
  hint: { color: Colors.textSecondary, fontSize: 12, marginBottom: Spacing.sm },
  muted: { color: Colors.textMuted, fontSize: 12, marginTop: 6 },

  input: { marginBottom: Spacing.sm },
  textArea: { minHeight: 130 },
  btn: { marginTop: Spacing.sm, borderRadius: Radius.sm },
  primaryBtn: { marginTop: Spacing.md, borderRadius: Radius.sm, backgroundColor: Colors.primary },

  imageStrip: { marginTop: Spacing.sm },
  rowButtons: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  thumbWrap: { marginRight: Spacing.sm, borderRadius: Radius.sm, overflow: 'hidden' },
  thumb: { width: 84, height: 84, borderRadius: Radius.sm, backgroundColor: Colors.surfaceVariant },

  chipRow: { marginVertical: Spacing.sm },
  jobChip: { marginRight: Spacing.sm, backgroundColor: Colors.surfaceVariant },
  promptTypeChip: { marginRight: Spacing.sm, backgroundColor: Colors.surfaceVariant },
  promptCard: {
    backgroundColor: Colors.surfaceVariant,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  promptTitle: { fontWeight: '700', color: Colors.textPrimary },
  promptText: { color: Colors.textPrimary, fontSize: 12, lineHeight: 18, marginTop: 4 },

  divider: { marginVertical: Spacing.md },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  metricLabel: { color: Colors.textSecondary },

  guestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
    paddingVertical: 8,
  },
  guestName: { fontWeight: '600', color: Colors.textPrimary },
  guestMeta: { fontSize: 12, color: Colors.textSecondary },

  videoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  videoUrl: { fontSize: 11, color: Colors.primary, marginTop: 2 },

  errorText: { color: Colors.danger, marginTop: Spacing.sm, fontSize: 12 },
  snackError: { backgroundColor: Colors.danger },
});

export default InviteVideoScreen;
