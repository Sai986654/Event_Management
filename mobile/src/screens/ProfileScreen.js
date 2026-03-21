import React, { useContext } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Card, Button, Avatar, Chip, Divider } from 'react-native-paper';
import { AuthContext } from '../context/AuthContext';
import { getRoleColor } from '../utils/helpers';

const ProfileScreen = () => {
  const { user, logout } = useContext(AuthContext);

  const handleLogout = async () => {
    await logout();
  };

  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        <Card.Content style={styles.profileContent}>
          <Avatar.Text
            size={72}
            label={user?.name?.charAt(0)?.toUpperCase() || 'U'}
            style={{ backgroundColor: getRoleColor(user?.role) }}
          />
          <Text variant="headlineSmall" style={styles.name}>{user?.name}</Text>
          <Text variant="bodyMedium" style={styles.email}>{user?.email}</Text>
          <Chip
            compact
            textStyle={{ color: '#fff' }}
            style={{ backgroundColor: getRoleColor(user?.role), marginTop: 8 }}
          >
            {user?.role}
          </Chip>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>Account</Text>
          <Divider style={{ marginVertical: 8 }} />
          {user?.phone && (
            <Text variant="bodyMedium" style={styles.infoRow}>📱 {user.phone}</Text>
          )}
          <Text variant="bodyMedium" style={styles.infoRow}>
            🎭 Role: {user?.role?.charAt(0).toUpperCase() + user?.role?.slice(1)}
          </Text>
        </Card.Content>
      </Card>

      <Button
        mode="contained"
        onPress={handleLogout}
        style={styles.logoutBtn}
        buttonColor="#ff4d4f"
        icon="logout"
      >
        Log Out
      </Button>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 16 },
  card: { borderRadius: 12, elevation: 2, marginBottom: 16 },
  profileContent: { alignItems: 'center', paddingVertical: 24 },
  name: { fontWeight: 'bold', marginTop: 12 },
  email: { color: '#666', marginTop: 4 },
  sectionTitle: { fontWeight: 'bold' },
  infoRow: { marginTop: 8, color: '#333' },
  logoutBtn: { borderRadius: 8, marginTop: 8 },
});

export default ProfileScreen;
