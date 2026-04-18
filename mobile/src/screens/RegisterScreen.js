import React, { useContext, useState } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { TextInput, Button, Text, HelperText, SegmentedButtons } from 'react-native-paper';
import { AuthContext } from '../context/AuthContext';
import { getErrorMessage } from '../utils/helpers';
import { Colors, Spacing, Radius } from '../theme';

const RegisterScreen = ({ navigation }) => {
  const { register } = useContext(AuthContext);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('customer');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [secureEntry, setSecureEntry] = useState(true);

  const handleRegister = async () => {
    if (!name || !email || !password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    try {
      setError('');
      setLoading(true);
      await register({ name: name.trim(), email: email.trim(), password, role });
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
          <Image source={require('../../assets/icon.jpeg')} style={styles.logoImage} />
          <Text variant="displaySmall" style={styles.brandName}>Vedika 360</Text>
          <Text variant="bodySmall" style={styles.brandTagline}>RELY ON US FOR EVERYTHING</Text>
        </View>

        <View style={styles.card}>
          <Text variant="headlineMedium" style={styles.title}>Get Started</Text>
          <Text variant="bodyMedium" style={styles.subtitle}>Join Vedika 360 — rely on us for everything</Text>

          {error ? <HelperText type="error" visible>{error}</HelperText> : null}

          <TextInput
            label="Full Name"
            value={name}
            onChangeText={setName}
            mode="outlined"
            left={<TextInput.Icon icon="account-outline" />}
            style={styles.input}
            outlineStyle={styles.inputOutline}
          />

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

          <Text variant="labelLarge" style={styles.roleLabel}>I am a...</Text>
          <SegmentedButtons
            value={role}
            onValueChange={setRole}
            buttons={[
              { value: 'customer', label: 'Customer' },
              { value: 'organizer', label: 'Organizer' },
              { value: 'vendor', label: 'Vendor' },
            ]}
            style={styles.segmented}
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

          <TextInput
            label="Confirm Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            mode="outlined"
            secureTextEntry={secureEntry}
            left={<TextInput.Icon icon="lock-check-outline" />}
            style={styles.input}
            outlineStyle={styles.inputOutline}
          />

          <Button
            mode="contained"
            onPress={handleRegister}
            loading={loading}
            disabled={loading}
            style={styles.button}
            contentStyle={styles.buttonContent}
            labelStyle={styles.buttonLabel}
          >
            Create Account
          </Button>

          <Button
            mode="text"
            onPress={() => navigation.navigate('Login')}
            style={styles.linkButton}
            labelStyle={styles.linkLabel}
          >
            Already have an account? Sign In
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
  logoImage: {
    width: 80, height: 80, borderRadius: 40, marginBottom: Spacing.md,
  },
  brandName: { color: Colors.primary, fontWeight: '900', letterSpacing: 1 },
  brandTagline: { color: Colors.textMuted, marginTop: Spacing.sm, letterSpacing: 3, fontWeight: '600' },
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
  input: { marginBottom: Spacing.md },
  inputOutline: { borderRadius: Radius.sm },
  roleLabel: { marginBottom: Spacing.sm, color: Colors.textPrimary, fontWeight: '600' },
  segmented: { marginBottom: Spacing.lg },
  button: { marginTop: Spacing.sm, backgroundColor: Colors.primary, borderRadius: Radius.sm },
  buttonContent: { paddingVertical: 8 },
  buttonLabel: { fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
  linkButton: { marginTop: Spacing.md },
  linkLabel: { fontSize: 14 },
});

export default RegisterScreen;
