import React, { useContext } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Card, Button, Avatar, Chip, Divider } from 'react-native-paper';
import { AuthContext } from '../context/AuthContext';
import { getRoleColor } from '../utils/helpers';
import { Colors, Spacing, Radius } from '../theme';

const ProfileScreen = () => {
  const { user, logout } = useContext(AuthContext);

  return (
    <View style={styles.container}>
      <Card style={styles.profileCard}>
        <Card.Content style={styles.profileContent}>
          <Avatar.Text
            size={80}
            label={user?.name?.charAt(0)?.toUpperCase() || 'U'}
            style={{ backgroundColor: getRoleColor(user?.role) }}
            labelStyle={{ fontWeight: '800', fontSize: 32 }}
          />
          <Text variant="headlineSmall" style={styles.name}>{user?.name}</Text>
          <Text variant="bodyMedium" style={styles.email}>{user?.email}</Text>
          <Chip
            compact
            textStyle={{ color: '#fff', fontWeight: '600' }}
            style={{ backgroundColor: getRoleColor(user?.role), marginTop: Spacing.sm }}
          >
            {user?.role?.charAt(0).toUpperCase() + user?.role?.slice(1)}
          </Chip>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>Account Details</Text>
          <Divider style={{ marginVertical: Spacing.sm }} />
          {user?.phone && <Text variant="bodyMedium" style={styles.infoRow}>📱 {user.phone}</Text>}
          <Text variant="bodyMedium" style={styles.infoRow}>🎭 Role: {user?.role?.charAt(0).toUpperCase() + user?.role?.slice(1)}</Text>
          <Text variant="bodyMedium" style={styles.infoRow}>📧 {user?.email}</Text>
        </Card.Content>
      </Card>

      <Button
        mode="contained"
        onPress={() => logout()}
        style={styles.logoutBtn}
        buttonColor={Colors.danger}
        icon="logout"
        contentStyle={{ paddingVertical: 6 }}
        labelStyle={{ fontWeight: '700', fontSize: 15 }}
      >
        Log Out
      </Button>

      <Text variant="bodySmall" style={styles.version}>Vedika 360 v1.0.0</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.lg },
  profileCard: { borderRadius: Radius.lg, elevation: 3, marginBottom: Spacing.lg, backgroundColor: Colors.surface },
  profileContent: { alignItems: 'center', paddingVertical: Spacing.xxl },
  name: { fontWeight: '800', marginTop: Spacing.md, color: Colors.textPrimary },
  email: { color: Colors.textSecondary, marginTop: Spacing.xs },
  card: { borderRadius: Radius.lg, elevation: 2, marginBottom: Spacing.lg, backgroundColor: Colors.surface },
  sectionTitle: { fontWeight: '700', color: Colors.textPrimary },
  infoRow: { marginTop: Spacing.sm, color: Colors.textPrimary },
  logoutBtn: { borderRadius: Radius.sm, marginTop: Spacing.sm },
  version: { textAlign: 'center', color: Colors.textMuted, marginTop: Spacing.xl },
});

export default ProfileScreen;
