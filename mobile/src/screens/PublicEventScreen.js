import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Image, Alert } from 'react-native';
import {
  Text,
  Card,
  Button,
  TextInput,
  ActivityIndicator,
  Divider,
} from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import { eventService } from '../services/eventService';
import { mediaService } from '../services/mediaService';
import { formatDate, getErrorMessage } from '../utils/helpers';

const PublicEventScreen = ({ route, navigation }) => {
  const paramSlug = route.params?.slug || '';
  const [slugInput, setSlugInput] = useState(paramSlug);
  const [loading, setLoading] = useState(!!paramSlug);
  const [event, setEvent] = useState(null);
  const [gift, setGift] = useState(null);
  const [gallery, setGallery] = useState([]);
  const [guestName, setGuestName] = useState('');
  const [caption, setCaption] = useState('');
  const [pickedImage, setPickedImage] = useState(null);
  const [uploading, setUploading] = useState(false);

  const slug = (paramSlug || slugInput || '').trim();

  const load = useCallback(async () => {
    if (!slug) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await eventService.getPublicEventBySlug(slug);
      setEvent(data.event);
      setGift(data.gift || { enabled: false });
      navigation.setOptions({ title: data.event?.title || 'Event' });
      if (data.event?.id) {
        const gal = await mediaService.getEventMedia(data.event.id, { approved: true });
        setGallery(gal.media || []);
      } else {
        setGallery([]);
      }
    } catch (err) {
      Alert.alert('Error', getErrorMessage(err));
      setEvent(null);
      setGift(null);
      setGallery([]);
    } finally {
      setLoading(false);
    }
  }, [slug, navigation]);

  useEffect(() => {
    if (paramSlug) setSlugInput(paramSlug);
  }, [paramSlug]);

  useEffect(() => {
    if (paramSlug) load();
  }, [paramSlug, load]);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission', 'Photo library access is needed to upload a blessing.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setPickedImage({
      uri: asset.uri,
      type: asset.mimeType || 'image/jpeg',
      name: asset.fileName || `blessing-${Date.now()}.jpg`,
    });
  };

  const uploadBlessing = async () => {
    if (!slug || !guestName.trim()) {
      Alert.alert('Missing info', 'Enter your name.');
      return;
    }
    if (!pickedImage) {
      Alert.alert('Photo', 'Choose a photo first.');
      return;
    }
    setUploading(true);
    try {
      await mediaService.uploadPublicBlessing({
        eventSlug: slug,
        guestName: guestName.trim(),
        caption: caption.trim(),
        file: pickedImage,
      });
      Alert.alert('Thank you', 'Your blessing photo was uploaded. It may appear in the gallery after review.');
      setPickedImage(null);
      setCaption('');
      if (event?.id) {
        const gal = await mediaService.getEventMedia(event.id, { approved: true });
        setGallery(gal.media || []);
      }
    } catch (err) {
      Alert.alert('Upload failed', getErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  if (!paramSlug && !event && !loading) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.pad}>
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleLarge" style={styles.title}>
              Public event invite
            </Text>
            <Text style={styles.sub}>Enter the event link slug (from your invitation).</Text>
            <TextInput
              mode="outlined"
              label="Event slug"
              value={slugInput}
              onChangeText={setSlugInput}
              autoCapitalize="none"
              placeholder="e.g. spring-garden-wedding-abc123"
              style={styles.input}
            />
            <Button mode="contained" onPress={load} disabled={!slugInput.trim()}>
              Open event
            </Button>
          </Card.Content>
        </Card>
      </ScrollView>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!event) {
    return (
      <View style={styles.centered}>
        <Text>Event not found or not public.</Text>
        <Button onPress={() => navigation.goBack()}>Go back</Button>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.pad}>
      <Card style={styles.hero}>
        <Card.Content>
          <Text variant="headlineSmall" style={styles.heroTitle}>
            {event.title}
          </Text>
          <Text style={styles.meta}>{event.type}</Text>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium">Details</Text>
          <Text style={styles.line}>📅 {formatDate(event.date)}</Text>
          <Text style={styles.line}>📍 {event.venue}</Text>
          {event.guestCount ? <Text style={styles.line}>👥 {event.guestCount} guests</Text> : null}
          {event.description ? <Text style={styles.desc}>{event.description}</Text> : null}
        </Card.Content>
      </Card>

      {gift?.enabled && gift.qrCodeDataUrl ? (
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium">Can&apos;t attend? Send blessings 🎁</Text>
            <Text style={styles.sub}>Scan to gift via UPI (India).</Text>
            <Image
              source={{ uri: gift.qrCodeDataUrl }}
              style={styles.qr}
              resizeMode="contain"
            />
            <Text style={styles.line}>UPI: {gift.upiId}</Text>
            <Text style={styles.line}>Payee: {gift.payeeName}</Text>
          </Card.Content>
        </Card>
      ) : null}

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium">Remote blessing photo</Text>
          <Text style={styles.sub}>
            Upload your photo — we&apos;ll include it in the event memory collage (AI-assisted).
          </Text>
          <TextInput
            mode="outlined"
            label="Your name"
            value={guestName}
            onChangeText={setGuestName}
            style={styles.input}
          />
          <TextInput
            mode="outlined"
            label="Message (optional)"
            value={caption}
            onChangeText={setCaption}
            style={styles.input}
          />
          <Button mode="outlined" onPress={pickImage} style={styles.btn}>
            {pickedImage ? 'Change photo' : 'Choose photo'}
          </Button>
          {pickedImage ? (
            <Image source={{ uri: pickedImage.uri }} style={styles.preview} />
          ) : null}
          <Button
            mode="contained"
            onPress={uploadBlessing}
            loading={uploading}
            disabled={uploading}
            style={styles.btn}
          >
            Upload blessing
          </Button>
        </Card.Content>
      </Card>

      {gallery.length > 0 ? (
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium">Gallery</Text>
            <Divider style={{ marginVertical: 8 }} />
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
  container: { flex: 1, backgroundColor: '#f6f8fc' },
  pad: { padding: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  hero: { marginBottom: 12, backgroundColor: '#667eea', borderRadius: 16 },
  heroTitle: { color: '#fff', fontWeight: '800' },
  meta: { color: 'rgba(255,255,255,0.9)', marginTop: 4 },
  card: { marginBottom: 12, borderRadius: 14, backgroundColor: '#fff' },
  title: { fontWeight: '800', marginBottom: 8 },
  sub: { color: '#667085', marginBottom: 12, fontSize: 13 },
  line: { marginTop: 6, color: '#344054' },
  desc: { marginTop: 10, color: '#475467' },
  input: { marginBottom: 10 },
  btn: { marginTop: 8 },
  qr: { width: 220, height: 220, alignSelf: 'center', marginVertical: 12 },
  preview: { width: '100%', height: 180, borderRadius: 12, marginTop: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  thumb: {
    width: '30%',
    aspectRatio: 1,
    borderRadius: 8,
    backgroundColor: '#eee',
    margin: 4,
  },
});

export default PublicEventScreen;
