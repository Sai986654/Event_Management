import React, { useContext, useState } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { TextInput, Button, Text, HelperText } from 'react-native-paper';
import { AuthContext } from '../context/AuthContext';
import { getErrorMessage } from '../utils/helpers';

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
        <View style={styles.card}>
          <Text variant="headlineMedium" style={styles.title}>Welcome Back</Text>
          <Text variant="bodyMedium" style={styles.subtitle}>Sign in to your EventOS account</Text>

          {error ? <HelperText type="error" visible>{error}</HelperText> : null}

          <TextInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            mode="outlined"
            keyboardType="email-address"
            autoCapitalize="none"
            left={<TextInput.Icon icon="email" />}
            style={styles.input}
          />

          <TextInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            mode="outlined"
            secureTextEntry={secureEntry}
            left={<TextInput.Icon icon="lock" />}
            right={<TextInput.Icon icon={secureEntry ? 'eye-off' : 'eye'} onPress={() => setSecureEntry(!secureEntry)} />}
            style={styles.input}
          />

          <Button
            mode="contained"
            onPress={handleLogin}
            loading={loading}
            disabled={loading}
            style={styles.button}
            contentStyle={styles.buttonContent}
          >
            Sign In
          </Button>

          <Button
            mode="text"
            onPress={() => navigation.navigate('Register')}
            style={styles.linkButton}
          >
            Don't have an account? Register
          </Button>

          <Text variant="labelLarge" style={styles.inviteLabel}>Have an invite link?</Text>
          <TextInput
            label="Event slug from link"
            value={inviteSlug}
            onChangeText={setInviteSlug}
            mode="outlined"
            autoCapitalize="none"
            placeholder="paste-slug-here"
            style={styles.input}
          />
          <Button
            mode="outlined"
            onPress={() => {
              const s = inviteSlug.trim();
              if (!s) return;
              navigation.navigate('PublicEvent', { slug: s });
            }}
            disabled={!inviteSlug.trim()}
          >
            Open public event (no sign-in)
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 24, elevation: 4 },
  title: { textAlign: 'center', fontWeight: 'bold', color: '#667eea' },
  subtitle: { textAlign: 'center', color: '#666', marginBottom: 24, marginTop: 4 },
  input: { marginBottom: 16 },
  button: { marginTop: 8, backgroundColor: '#667eea', borderRadius: 8 },
  buttonContent: { paddingVertical: 6 },
  linkButton: { marginTop: 12 },
  inviteLabel: { marginTop: 20, marginBottom: 8, color: '#667085' },
});

export default LoginScreen;
