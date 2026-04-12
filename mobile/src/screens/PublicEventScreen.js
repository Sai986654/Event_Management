import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Image, Alert } from 'react-native';
import { Text, Card, Button, TextInput, ActivityIndicator, Divider } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import { eventService } from '../services/eventService';
import { mediaService } from '../services/mediaService';
import { formatDate, getErrorMessage } from '../utils/helpers';
import { Colors, Spacing, Radius } from '../theme';

const PublicEventScreen = ({ route, navigation }) => {
  const paramSlug = route.params?.slug || '';
  const [slugInput, setSlugInput] = useState(paramSlug);
  const [loading, setLoading] = useState(!!paramSlug);
  const [event, setEvent] = useState(null);
  const [gift, setGift] = useState(null);
  const [inviteCopy, setInviteCopy] = useState(null);
  const [gallery, setGallery] = useState([]);
  const [guestName, setGuestName] = useState('');
  const [caption, setCaption] = useState('');
  const [pickedImage, setPickedImage] = useState(null);
  const [uploading, setUploading] = useState(false);

  const slug = (paramSlug || slugInput || '').trim();

  const load = useCallback(async () => {
    if (!slug) { setLoading(false); return; }
    setLoading(true);
    try {
      const data = await eventService.getPublicEventBySlug(slug);
      setEvent(data.event);
      setGift(data.gift || { enabled: false });
      setInviteCopy(data.inviteCopy || null);
      navigation.setOptions({ title: data.event?.title || 'Event' });
      if (data.event?.id) {
        const gal = await mediaService.getEventMedia(data.event.id, { approved: true });
        setGallery(gal.media || []);
      } else setGallery([]);
    } catch (err) {
      Alert.alert('Error', getErrorMessage(err));
      setEvent(null); setGift(null); setInviteCopy(null); setGallery([]);
    } finally { setLoading(false); }
  }, [slug, navigation]);

  useEffect(() => { if (paramSlug) setSlugInput(paramSlug); }, [paramSlug]);
  useEffect(() => { if (paramSlug) load(); }, [paramSlug, load]);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission', 'Photo library access is needed.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.85 });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setPickedImage({ uri: asset.uri, type: asset.mimeType || 'image/jpeg', name: asset.fileName || `blessing-${Date.now()}.jpg` });
  };

  const uploadBlessing = async () => {
    if (!slug || !guestName.trim()) { Alert.alert('Missing info', 'Enter your name.'); return; }
    if (!pickedImage) { Alert.alert('Photo', 'Choose a photo first.'); return; }
    setUploading(true);
    try {
      await mediaService.uploadPublicBlessing({ eventSlug: slug, guestName: guestName.trim(), caption: caption.trim(), file: pickedImage });
      Alert.alert('Thank you', 'Your blessing photo was uploaded.');
      setPickedImage(null); setCaption('');
      if (event?.id) { const gal = await mediaService.getEventMedia(event.id, { approved: true }); setGallery(gal.media || []); }
    } catch (err) { Alert.alert('Upload failed', getErrorMessage(err)); }
    finally { setUploading(false); }
  };

  // Slug entry view
  if (!paramSlug && !event && !loading) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.pad}>
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleLarge" style={styles.cardTitle}>Public Event Invite</Text>
            <Text style={styles.sub}>Enter the event link slug from your invitation.</Text>
            <TextInput mode="outlined" label="Event slug" value={slugInput} onChangeText={setSlugInput} autoCapitalize="none" placeholder="e.g. spring-garden-wedding-abc123" style={styles.input} outlineStyle={styles.outline} />
            <Button mode="contained" onPress={load} disabled={!slugInput.trim()} style={styles.btn} labelStyle={{ fontWeight: '600' }}>Open Event</Button>
          </Card.Content>
        </Card>
      </ScrollView>
    );
  }

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  if (!event) return <View style={styles.centered}><Text>Event not found or not public.</Text><Button onPress={() => navigation.goBack()}>Go back</Button></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.pad}>
      {/* Hero */}
      <Card style={styles.hero}>
        <Card.Content>
          <Text variant="headlineSmall" style={styles.heroTitle}>{event.title}</Text>
          <Text style={styles.heroMeta}>{event.type}</Text>
        </Card.Content>
      </Card>

      {/* Invite Copy */}
      {inviteCopy ? (
        <Card style={[styles.card, styles.inviteBanner]}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.bannerTitle}>{inviteCopy.tagline}</Text>
            <Text style={styles.bannerBody}>{inviteCopy.details}</Text>
          </Card.Content>
        </Card>
      ) : null}

      {/* Details */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>Details</Text>
          <Text style={styles.line}>📅 {formatDate(event.date)}</Text>
          <Text style={styles.line}>📍 {event.venue}</Text>
          {event.guestCount ? <Text style={styles.line}>👥 {event.guestCount} guests</Text> : null}
          {event.description ? <Text style={styles.desc}>{event.description}</Text> : null}
        </Card.Content>
      </Card>

      {/* Gift QR */}
      {gift?.enabled && gift.qrCodeDataUrl ? (
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>Send Blessings 🎁</Text>
            <Text style={styles.sub}>Scan to gift via UPI (India).</Text>
            <Image source={{ uri: gift.qrCodeDataUrl }} style={styles.qr} resizeMode="contain" />
            <Text style={styles.line}>UPI: {gift.upiId}</Text>
            <Text style={styles.line}>Payee: {gift.payeeName}</Text>
          </Card.Content>
        </Card>
      ) : null}

      {/* Blessing Upload */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>Remote Blessing Photo</Text>
          <Text style={styles.sub}>Upload your photo — it'll be included in the event memory collage.</Text>
          <TextInput mode="outlined" label="Your name" value={guestName} onChangeText={setGuestName} style={styles.input} outlineStyle={styles.outline} />
          <TextInput mode="outlined" label="Message (optional)" value={caption} onChangeText={setCaption} style={styles.input} outlineStyle={styles.outline} />
          <Button mode="outlined" onPress={pickImage} style={styles.photoBtn} icon="camera">{pickedImage ? 'Change photo' : 'Choose photo'}</Button>
          {pickedImage ? <Image source={{ uri: pickedImage.uri }} style={styles.preview} /> : null}
          <Button mode="contained" onPress={uploadBlessing} loading={uploading} disabled={uploading} style={styles.btn} labelStyle={{ fontWeight: '600' }}>Upload Blessing</Button>
        </Card.Content>
      </Card>

      {/* Gallery */}
      {gallery.length > 0 ? (
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>Gallery</Text>
            <Divider style={{ marginVertical: Spacing.sm }} />
            <View style={styles.grid}>
              {gallery.slice(0, 12).map((m) => (
                <Image key={m.id} source={{ uri: m.url }} style={styles.thumb} />
              ))}
            </View>
          </Card.Content>
        </Card>
      ) : null}

      <View style={{ height: 24 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  pad: { padding: Spacing.lg },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xxl },
  hero: { marginBottom: Spacing.md, backgroundColor: Colors.primary, borderRadius: Radius.lg },
  heroTitle: { color: '#fff', fontWeight: '800' },
  heroMeta: { color: 'rgba(255,255,255,0.88)', marginTop: 4, textTransform: 'capitalize' },
  card: { marginBottom: Spacing.md, borderRadius: Radius.lg, backgroundColor: Colors.surface, elevation: 2 },
  cardTitle: { fontWeight: '800', marginBottom: Spacing.sm, color: Colors.textPrimary },
  inviteBanner: { backgroundColor: '#f4f6ff', borderWidth: 1, borderColor: '#c7d2fe' },
  bannerTitle: { marginBottom: Spacing.sm, color: Colors.textPrimary, fontWeight: '700' },
  bannerBody: { fontSize: 14, lineHeight: 22, color: Colors.textSecondary },
  sectionTitle: { fontWeight: '700', marginBottom: Spacing.sm, color: Colors.textPrimary },
  sub: { color: Colors.textSecondary, marginBottom: Spacing.md, fontSize: 13 },
  line: { marginTop: 6, color: Colors.textPrimary },
  desc: { marginTop: Spacing.md, color: Colors.textSecondary, lineHeight: 22 },
  input: { marginBottom: Spacing.sm },
  outline: { borderRadius: Radius.sm },
  btn: { marginTop: Spacing.sm, backgroundColor: Colors.primary, borderRadius: Radius.sm },
  photoBtn: { marginTop: Spacing.sm, borderRadius: Radius.sm, borderColor: Colors.primary },
  qr: { width: 220, height: 220, alignSelf: 'center', marginVertical: Spacing.md },
  preview: { width: '100%', height: 180, borderRadius: Radius.md, marginTop: Spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  thumb: { width: '30%', aspectRatio: 1, borderRadius: Radius.sm, backgroundColor: '#eee', margin: 4 },
});

export default PublicEventScreen;
