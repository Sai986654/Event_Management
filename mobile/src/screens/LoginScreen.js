import React, { useContext, useState } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { TextInput, Button, Text, HelperText } from 'react-native-paper';
import { AuthContext } from '../context/AuthContext';
import { getErrorMessage } from '../utils/helpers';
import { Colors, Spacing, Radius } from '../theme';

const LoginScreen = ({ navigation }) => {
  const { login } = useContext(AuthContext);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [secureEntry, setSecureEntry] = useState(true);
  const [inviteSlug, setInviteSlug] = useState('');

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }
    try {
      setError('');
      setLoading(true);
      await login(email.trim(), password);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.brandHeader}>
          <Text variant="displaySmall" style={styles.brandName}>Vedika 360</Text>
          <Text variant="bodyMedium" style={styles.brandTagline}>Event Management Platform</Text>
        </View>

        <View style={styles.card}>
          <Text variant="headlineMedium" style={styles.title}>Welcome Back</Text>
          <Text variant="bodyMedium" style={styles.subtitle}>Sign in to your account</Text>

          {error ? <HelperText type="error" visible style={styles.errorText}>{error}</HelperText> : null}

          <TextInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            mode="outlined"
            keyboardType="email-address"
            autoCapitalize="none"
            left={<TextInput.Icon icon="email-outline" />}
            style={styles.input}
            outlineStyle={styles.inputOutline}
          />

          <TextInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            mode="outlined"
            secureTextEntry={secureEntry}
            left={<TextInput.Icon icon="lock-outline" />}
            right={
              <TextInput.Icon
                icon={secureEntry ? 'eye-off-outline' : 'eye-outline'}
                onPress={() => setSecureEntry(!secureEntry)}
              />
            }
            style={styles.input}
            outlineStyle={styles.inputOutline}
          />

          <Button
            mode="contained"
            onPress={handleLogin}
            loading={loading}
            disabled={loading}
            style={styles.button}
            contentStyle={styles.buttonContent}
            labelStyle={styles.buttonLabel}
          >
            Sign In
          </Button>

          <Button
            mode="text"
            onPress={() => navigation.navigate('Register')}
            style={styles.linkButton}
            labelStyle={styles.linkLabel}
          >
            Don't have an account? Register
          </Button>

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.divider} />
          </View>

          <Text variant="labelLarge" style={styles.inviteLabel}>Have an invite link?</Text>
          <TextInput
            label="Event slug from link"
            value={inviteSlug}
            onChangeText={setInviteSlug}
            mode="outlined"
            autoCapitalize="none"
            placeholder="paste-slug-here"
            left={<TextInput.Icon icon="link-variant" />}
            style={styles.input}
            outlineStyle={styles.inputOutline}
          />
          <Button
            mode="outlined"
            onPress={() => {
              const s = inviteSlug.trim();
              if (!s) return;
              navigation.navigate('PublicEvent', { slug: s });
            }}
            disabled={!inviteSlug.trim()}
            style={styles.outlineBtn}
            icon="open-in-new"
          >
            Open public event
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: Spacing.xl },
  brandHeader: { alignItems: 'center', marginBottom: Spacing.xxl },
  brandName: { color: Colors.primary, fontWeight: '900', letterSpacing: 0.5 },
  brandTagline: { color: Colors.textSecondary, marginTop: Spacing.xs },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.xxl,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  title: { textAlign: 'center', fontWeight: '800', color: Colors.textPrimary },
  subtitle: { textAlign: 'center', color: Colors.textSecondary, marginBottom: Spacing.xxl, marginTop: Spacing.xs },
  errorText: { fontSize: 13 },
  input: { marginBottom: Spacing.md },
  inputOutline: { borderRadius: Radius.sm },
  button: { marginTop: Spacing.sm, backgroundColor: Colors.primary, borderRadius: Radius.sm },
  buttonContent: { paddingVertical: 8 },
  buttonLabel: { fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
  linkButton: { marginTop: Spacing.md },
  linkLabel: { fontSize: 14 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: Spacing.xl },
  divider: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { marginHorizontal: Spacing.md, color: Colors.textMuted, fontSize: 13 },
  inviteLabel: { marginBottom: Spacing.sm, color: Colors.textSecondary },
  outlineBtn: { borderRadius: Radius.sm, borderColor: Colors.primary },
});

export default LoginScreen;
