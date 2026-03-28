import React, { useContext } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { IconButton } from 'react-native-paper';
import { AuthContext } from '../context/AuthContext';

// Screens
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import DashboardScreen from '../screens/DashboardScreen';
import VendorListScreen from '../screens/VendorListScreen';
import VendorDetailScreen from '../screens/VendorDetailScreen';
import BookingsScreen from '../screens/BookingsScreen';
import EventCreateScreen from '../screens/EventCreateScreen';
import EventDetailScreen from '../screens/EventDetailScreen';
import ProfileScreen from '../screens/ProfileScreen';
import VendorWorkspaceScreen from '../screens/VendorWorkspaceScreen';
import PlannerScreen from '../screens/PlannerScreen';
import ActivityTrackerScreen from '../screens/ActivityTrackerScreen';
import AdminControlScreen from '../screens/AdminControlScreen';
import InviteIntelligenceScreen from '../screens/InviteIntelligenceScreen';
import PublicEventScreen from '../screens/PublicEventScreen';
import NotificationsScreen from '../screens/NotificationsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Vendor stack (list → detail)
const VendorStack = () => (
  <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: '#667eea' }, headerTintColor: '#fff' }}>
    <Stack.Screen name="VendorList" component={VendorListScreen} options={{ title: 'Vendors' }} />
    <Stack.Screen name="VendorDetail" component={VendorDetailScreen} options={{ title: 'Vendor' }} />
  </Stack.Navigator>
);

// Dashboard stack (dashboard → event create/detail)
const DashboardStack = () => (
  <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: '#667eea' }, headerTintColor: '#fff' }}>
    <Stack.Screen name="DashboardHome" component={DashboardScreen} options={{ title: 'EventOS' }} />
    <Stack.Screen name="EventCreate" component={EventCreateScreen} options={{ title: 'New Event' }} />
    <Stack.Screen name="EventDetail" component={EventDetailScreen} options={{ title: 'Event Details' }} />
    <Stack.Screen name="VendorWorkspace" component={VendorWorkspaceScreen} options={{ title: 'Vendor Workspace' }} />
    <Stack.Screen name="Planner" component={PlannerScreen} options={{ title: 'Event Planner' }} />
    <Stack.Screen name="ActivityTracker" component={ActivityTrackerScreen} options={{ title: 'Activity Tracker' }} />
    <Stack.Screen name="AdminControl" component={AdminControlScreen} options={{ title: 'Admin Control' }} />
    <Stack.Screen name="InviteIntelligence" component={InviteIntelligenceScreen} options={{ title: 'Invite Intelligence' }} />
    <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notifications' }} />
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
        tabBarActiveTintColor: '#667eea',
        tabBarInactiveTintColor: '#8c8c8c',
        tabBarStyle: { paddingBottom: 4, height: 60 },
        tabBarLabelStyle: { fontSize: 12 },
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
          headerStyle: { backgroundColor: '#667eea' },
          headerTintColor: '#fff',
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
          headerStyle: { backgroundColor: '#667eea' },
          headerTintColor: '#fff',
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
        headerStyle: { backgroundColor: '#667eea' },
        headerTintColor: '#fff',
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
