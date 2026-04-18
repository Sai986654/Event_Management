import React, { useContext, useCallback, useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, ActivityIndicator, Image } from 'react-native';
import { PaperProvider, Text } from 'react-native-paper';
import { AuthProvider, AuthContext } from './src/context/AuthContext';
import { SocketProvider } from './src/context/SocketContext';
import AppNavigator from './src/navigation/AppNavigator';
import { AppTheme, Colors } from './src/theme';

const SplashScreen = () => (
  <View style={splashStyles.container}>
    <View style={splashStyles.logoContainer}>
      <Text variant="displaySmall" style={splashStyles.logo}>Vedika 360</Text>
      <Text variant="bodyMedium" style={splashStyles.tagline}>Event Management Platform</Text>
    </View>
    <ActivityIndicator size="large" color="#fff" style={splashStyles.loader} />
  </View>
);

const splashStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: { alignItems: 'center' },
  logo: { color: '#fff', fontWeight: '900', letterSpacing: 1 },
  tagline: { color: 'rgba(255,255,255,0.8)', marginTop: 8 },
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
      <SocketProvider>
        <PaperProvider theme={AppTheme}>
          <AppInner />
        </PaperProvider>
      </SocketProvider>
    </AuthProvider>
  );
}
