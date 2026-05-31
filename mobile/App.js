import 'react-native-reanimated';
import React, { useContext, useCallback, useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, ActivityIndicator, Image } from 'react-native';
import { PaperProvider, Text } from 'react-native-paper';
import { AuthProvider, AuthContext } from './src/context/AuthContext';
import { PushNotificationProvider } from './src/context/PushNotificationContext';
import { SocketProvider } from './src/context/SocketContext';
import AppNavigator from './src/navigation/AppNavigator';
import { AppTheme, Colors } from './src/theme';

const SplashScreen = () => (
  <View style={splashStyles.container}>
    <View style={splashStyles.logoContainer}>
      <Text variant="displaySmall" style={splashStyles.logo}>Vedika360</Text>
      <Text variant="bodyMedium" style={splashStyles.tagline}>Premium Telugu Wedding Ecosystem</Text>
    </View>
    <ActivityIndicator size="large" color={Colors.primary} style={splashStyles.loader} />
  </View>
);

const splashStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: { alignItems: 'center' },
  logo: { color: Colors.textOnDark, fontWeight: '900', letterSpacing: 1 },
  tagline: { color: 'rgba(249, 244, 232, 0.9)', marginTop: 8 },
  loader: { marginTop: 40 },
});

const AppInner = () => {
  const { loading } = useContext(AuthContext);

  if (loading) return <SplashScreen />;

  return (
    <PaperProvider theme={AppTheme}>
      <AppNavigator />
      <StatusBar style="light" />
    </PaperProvider>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <PushNotificationProvider>
        <SocketProvider>
          <PaperProvider theme={AppTheme}>
            <AppInner />
          </PaperProvider>
        </SocketProvider>
      </PushNotificationProvider>
    </AuthProvider>
  );
}
