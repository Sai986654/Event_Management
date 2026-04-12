import { MD3LightTheme } from 'react-native-paper';
import { StyleSheet } from 'react-native';

// ── Brand Palette ──
export const Colors = {
  primary: '#667eea',
  primaryDark: '#5a6fd6',
  secondary: '#764ba2',
  accent: '#f093fb',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#3b82f6',

  background: '#f6f8fc',
  surface: '#ffffff',
  surfaceVariant: '#eef2ff',
  card: '#ffffff',

  textPrimary: '#1d2939',
  textSecondary: '#667085',
  textMuted: '#98a2b3',
  textOnPrimary: '#ffffff',

  border: '#e5e7eb',
  divider: '#f0f1f3',

  statusPending: '#f59e0b',
  statusConfirmed: '#10b981',
  statusCancelled: '#ef4444',
  statusCompleted: '#3b82f6',
  statusPlanning: '#667eea',
  statusDraft: '#98a2b3',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
};

// ── Paper Theme ──
export const AppTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: Colors.primary,
    secondary: Colors.secondary,
    surface: Colors.surface,
    background: Colors.background,
    surfaceVariant: Colors.surfaceVariant,
    outline: Colors.border,
    onSurface: Colors.textPrimary,
    onSurfaceVariant: Colors.textSecondary,
    error: Colors.danger,
  },
  roundness: 14,
};

// ── Shared Styles ──
export const SharedStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollPad: {
    padding: Spacing.lg,
    paddingBottom: 40,
  },
  heroCard: {
    marginBottom: Spacing.md,
    borderRadius: Radius.lg,
    elevation: 3,
    backgroundColor: Colors.surface,
  },
  heroCardAccent: {
    marginBottom: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primary,
  },
  heroTitle: {
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  heroTitleLight: {
    fontWeight: '800',
    color: Colors.textOnPrimary,
  },
  heroSubtitle: {
    marginTop: 6,
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  heroSubtitleLight: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.88)',
    fontSize: 13,
    lineHeight: 20,
  },
  card: {
    marginBottom: Spacing.md,
    borderRadius: Radius.lg,
    elevation: 2,
    backgroundColor: Colors.card,
  },
  sectionTitle: {
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  input: {
    marginBottom: Spacing.md,
  },
  button: {
    marginTop: Spacing.sm,
    borderRadius: Radius.sm,
    backgroundColor: Colors.primary,
  },
  buttonContent: {
    paddingVertical: 6,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginVertical: Spacing.sm,
  },
  msgError: {
    color: Colors.danger,
    marginTop: Spacing.sm,
    fontSize: 13,
  },
  msgSuccess: {
    color: Colors.success,
    marginTop: Spacing.sm,
    fontSize: 13,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xxl,
  },
  emptyText: {
    textAlign: 'center',
    color: Colors.textMuted,
    marginTop: 40,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowSpaced: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});

export const headerScreenOptions = {
  headerStyle: { backgroundColor: Colors.primary },
  headerTintColor: Colors.textOnPrimary,
  headerTitleStyle: { fontWeight: '700' },
};
