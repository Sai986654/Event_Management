import React, { useContext } from 'react';
import { StatusBar } from 'expo-status-bar';
import { PaperProvider, MD3LightTheme } from 'react-native-paper';
import { AuthProvider, AuthContext } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';

const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#667eea',
    secondary: '#764ba2',
    surface: '#ffffff',
    background: '#f6f8fc',
    surfaceVariant: '#eef2ff',
    outline: '#d8ddf0',
    onSurface: '#1f2430',
  },
  roundness: 14,
};

const AppInner = () => {
  return (
    <PaperProvider theme={theme}>
      <AppNavigator />
      <StatusBar style="light" />
    </PaperProvider>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}
