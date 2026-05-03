import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AuthContext } from './AuthContext';
import { appNotificationService } from '../services/appNotificationService';
import { navigationRef } from '../navigation/AppNavigator';

const EXPO_PUSH_TOKEN_KEY = 'expoPushToken';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export const PushNotificationContext = createContext(null);

function getProjectId() {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ||
    Constants.easConfig?.projectId ||
    null
  );
}

function routeFromNotificationData(data) {
  if (!navigationRef.isReady()) return;

  const eventId = Number(data?.eventId);
  if (Number.isFinite(eventId) && eventId > 0) {
    navigationRef.navigate('DashboardTab', {
      screen: 'EventDetail',
      params: { eventId },
    });
    return;
  }

  navigationRef.navigate('DashboardTab', {
    screen: 'Notifications',
  });
}

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Default',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#0a4f7a',
  });
}

async function getExpoPushToken() {
  const projectId = getProjectId();
  if (!projectId || !Device.isDevice) return null;

  const permission = await Notifications.getPermissionsAsync();
  let status = permission.status;
  if (status !== 'granted') {
    const request = await Notifications.requestPermissionsAsync();
    status = request.status;
  }

  if (status !== 'granted') return null;

  await ensureAndroidChannel();
  const response = await Notifications.getExpoPushTokenAsync({ projectId });
  return response.data || null;
}

export const PushNotificationProvider = ({ children }) => {
  const { user, isAuthenticated } = useContext(AuthContext);
  const [expoPushToken, setExpoPushToken] = useState(null);
  const responseListenerRef = useRef(null);
  const receivedListenerRef = useRef(null);

  const syncPushToken = useCallback(async () => {
    if (!isAuthenticated || !user) return;

    const token = await getExpoPushToken();
    if (!token) return;

    await appNotificationService.registerDevice({
      expoPushToken: token,
      platform: Platform.OS,
      deviceName: Device.deviceName || null,
      appVersion: Constants.expoConfig?.version || null,
    });

    await AsyncStorage.setItem(EXPO_PUSH_TOKEN_KEY, token);
    setExpoPushToken(token);
  }, [isAuthenticated, user]);

  useEffect(() => {
    if (!isAuthenticated) {
      setExpoPushToken(null);
      return;
    }

    syncPushToken().catch((error) => {
      console.warn('Push registration failed', error?.message || error);
    });
  }, [isAuthenticated, syncPushToken]);

  useEffect(() => {
    receivedListenerRef.current = Notifications.addNotificationReceivedListener(() => {});

    responseListenerRef.current = Notifications.addNotificationResponseReceivedListener((response) => {
      routeFromNotificationData(response?.notification?.request?.content?.data || {});
    });

    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        routeFromNotificationData(response.notification?.request?.content?.data || {});
      }
    }).catch(() => {});

    return () => {
      receivedListenerRef.current?.remove();
      responseListenerRef.current?.remove();
    };
  }, []);

  const value = useMemo(() => ({ expoPushToken, syncPushToken }), [expoPushToken, syncPushToken]);

  return (
    <PushNotificationContext.Provider value={value}>
      {children}
    </PushNotificationContext.Provider>
  );
};