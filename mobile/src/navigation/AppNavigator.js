import React, { useContext } from 'react';
import { View, Text as RNText, StyleSheet, Image } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { IconButton } from 'react-native-paper';
import { AuthContext } from '../context/AuthContext';
import { Colors, headerScreenOptions } from '../theme';

// Screens
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import DashboardScreen from '../screens/DashboardScreen';
import VendorListScreen from '../screens/VendorListScreen';
import VendorDetailScreen from '../screens/VendorDetailScreen';
import VendorPackagesScreen from '../screens/VendorPackagesScreen';
import BookingsScreen from '../screens/BookingsScreen';
import EventCreateScreen from '../screens/EventCreateScreen';
import EventDetailScreen from '../screens/EventDetailScreen';
import ProfileScreen from '../screens/ProfileScreen';
import VendorWorkspaceScreen from '../screens/VendorWorkspaceScreen';
import PlannerScreen from '../screens/PlannerScreen';
import ActivityTrackerScreen from '../screens/ActivityTrackerScreen';
import AdminControlScreen from '../screens/AdminControlScreen';
import InviteIntelligenceScreen from '../screens/InviteIntelligenceScreen';
import InviteVideoScreen from '../screens/InviteVideoScreen';
import PublicEventScreen from '../screens/PublicEventScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import GuestManagementScreen from '../screens/GuestManagementScreen';
import BudgetDashboardScreen from '../screens/BudgetDashboardScreen';
import ChatListScreen from '../screens/ChatListScreen';
import ChatScreen from '../screens/ChatScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Vendor stack (list → detail)
const VendorStack = () => (
  <Stack.Navigator screenOptions={headerScreenOptions}>
    <Stack.Screen name="VendorList" component={VendorListScreen} options={{ title: 'Vendors' }} />
    <Stack.Screen name="VendorDetail" component={VendorDetailScreen} options={{ title: 'Vendor' }} />
    <Stack.Screen name="VendorPackages" component={VendorPackagesScreen} options={{ title: 'Packages' }} />
  </Stack.Navigator>
);

const BrandTitle = () => (
  <View style={brandStyles.row}>
    <Image source={require('../../assets/icon.jpeg')} style={brandStyles.iconImage} />
    <RNText style={brandStyles.title}>Vedika 360</RNText>
  </View>
);
const brandStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconImage: {
    width: 30, height: 30, borderRadius: 15,
  },
  title: { fontSize: 20, fontWeight: '800', color: '#fff' },
});

// Dashboard stack (dashboard → event create/detail)
const DashboardStack = () => (
  <Stack.Navigator screenOptions={headerScreenOptions}>
    <Stack.Screen
      name="DashboardHome"
      component={DashboardScreen}
      options={{ headerTitle: () => <BrandTitle /> }}
    />
    <Stack.Screen name="EventCreate" component={EventCreateScreen} options={{ title: 'New Event' }} />
    <Stack.Screen name="EventDetail" component={EventDetailScreen} options={{ title: 'Event Details' }} />
    <Stack.Screen name="VendorWorkspace" component={VendorWorkspaceScreen} options={{ title: 'Vendor Workspace' }} />
    <Stack.Screen name="Planner" component={PlannerScreen} options={{ title: 'Event Planner' }} />
    <Stack.Screen name="PlannerVendorDetail" component={VendorDetailScreen} options={{ title: 'Vendor' }} />
    <Stack.Screen name="VendorPackages" component={VendorPackagesScreen} options={{ title: 'Packages' }} />
    <Stack.Screen name="ActivityTracker" component={ActivityTrackerScreen} options={{ title: 'Activity Tracker' }} />
    <Stack.Screen name="AdminControl" component={AdminControlScreen} options={{ title: 'Admin Control' }} />
    <Stack.Screen name="InviteIntelligence" component={InviteIntelligenceScreen} options={{ title: 'Invite Intelligence' }} />
    <Stack.Screen name="InviteVideos" component={InviteVideoScreen} options={{ title: 'Invite Videos' }} />
    <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notifications' }} />
    <Stack.Screen name="GuestManagement" component={GuestManagementScreen} options={{ title: 'Guest Management' }} />
    <Stack.Screen name="BudgetDashboard" component={BudgetDashboardScreen} options={{ title: 'Budget Dashboard' }} />
    <Stack.Screen name="ChatList" component={ChatListScreen} options={{ title: 'Support Chat' }} />
    <Stack.Screen name="ChatConversation" component={ChatScreen} options={({ route }) => ({ title: route.params?.threadSubject || 'Chat' })} />
    <Stack.Screen
      name="PublicEvent"
      component={PublicEventScreen}
      options={({ route }) => ({
        title: route.params?.eventTitle || 'Event invite',
      })}
    />
  </Stack.Navigator>
);

// Tab icon helper
const tabIcon = (name) => ({ color, size }) => <IconButton icon={name} iconColor={color} size={size} />;

// Role-based tab navigator
const MainTabs = () => {
  const { user } = useContext(AuthContext);
  const role = user?.role;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          paddingBottom: 6,
          paddingTop: 4,
          height: 64,
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
          elevation: 8,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
      }}
    >
      <Tab.Screen
        name="DashboardTab"
        component={DashboardStack}
        options={{ title: 'Dashboard', tabBarIcon: tabIcon('view-dashboard') }}
      />

      {/* Vendors tab — all roles except vendor */}
      {role !== 'vendor' && (
        <Tab.Screen
          name="VendorsTab"
          component={VendorStack}
          options={{ title: 'Vendors', tabBarIcon: tabIcon('store') }}
        />
      )}

      {/* Bookings tab — all authenticated users */}
      <Tab.Screen
        name="BookingsTab"
        component={BookingsScreen}
        options={{
          title: 'Bookings',
          tabBarIcon: tabIcon('calendar-check'),
          headerShown: true,
          headerTitle: 'My Bookings',
          ...headerScreenOptions,
        }}
      />

      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{
          title: 'Profile',
          tabBarIcon: tabIcon('account-circle'),
          headerShown: true,
          headerTitle: 'Profile',
          ...headerScreenOptions,
        }}
      />
    </Tab.Navigator>
  );
};

// Auth stack
const AuthStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Login" component={LoginScreen} />
    <Stack.Screen name="Register" component={RegisterScreen} />
    <Stack.Screen
      name="PublicEvent"
      component={PublicEventScreen}
      options={({ route }) => ({
        headerShown: true,
        title: route.params?.eventTitle || 'Event invite',
        ...headerScreenOptions,
      })}
    />
  </Stack.Navigator>
);

// Root navigator
const AppNavigator = () => {
  const { isAuthenticated, loading } = useContext(AuthContext);

  if (loading) return null; // splash / loading could go here

  return (
    <NavigationContainer>
      {isAuthenticated ? <MainTabs /> : <AuthStack />}
    </NavigationContainer>
  );
};

export default AppNavigator;
