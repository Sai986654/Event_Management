import { MD3LightTheme } from 'react-native-paper';
import { StyleSheet } from 'react-native';

// ── Brand Palette ──
export const Colors = {
  primary: '#bfa36c',
  primaryDark: '#a8884c',
  secondary: '#581c20',
  accent: '#d3be8d',
  success: '#22C55E',
  warning: '#f59e0b',
  danger: '#EF4444',
  info: '#8B6A1F',

  background: '#faf7f0',
  surface: '#FFFFFF',
  surfaceVariant: '#f8f4e8',
  card: '#FFFFFF',
  darkSurface: '#6b1921',

  textPrimary: '#2d1618',
  textSecondary: '#6b5c5d',
  textMuted: '#9CA3AF',
  textOnPrimary: '#2d1618',
  textOnDark: '#faf7f0',

  border: '#e7d8bd',
  divider: '#e7d8bd',

  statusPending: '#f59e0b',
  statusConfirmed: '#22C55E',
  statusCancelled: '#EF4444',
  statusCompleted: '#334155',
  statusPlanning: '#bfa36c',
  statusDraft: '#9CA3AF',
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
  lg: 18,
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
    onPrimary: Colors.textOnPrimary,
    error: Colors.danger,
  },
  roundness: 16,
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
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  heroCardAccent: {
    marginBottom: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Colors.secondary,
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
    color: Colors.textOnDark,
    fontSize: 13,
    lineHeight: 20,
  },
  card: {
    marginBottom: Spacing.md,
    borderRadius: Radius.lg,
    elevation: 2,
    borderWidth: 1,
    borderColor: Colors.border,
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
  headerStyle: { backgroundColor: Colors.secondary },
  headerTintColor: Colors.textOnDark,
  headerTitleStyle: { fontWeight: '700' },
};
