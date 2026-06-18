import React, { useContext, useEffect, useMemo, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Layout } from 'antd';
import { AuthContext, AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import ProtectedRoute from './components/ProtectedRoute';
import Header from './components/Header';
import Footer from './components/Footer';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import MobileAppDock from './components/MobileAppDock';
import RouteTransition from './components/RouteTransition';
import AppSplashScreen from './components/AppSplashScreen';
import usePullToRefreshGuard from './hooks/usePullToRefreshGuard';

// Pages
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import EventCreate from './pages/EventCreate';
import EventDetails from './pages/EventDetails';
import EventControlPanel from './pages/EventControlPanel';
import GuestManagement from './pages/GuestManagement';
import BudgetDashboard from './pages/BudgetDashboard';
import VendorMarketplace from './pages/VendorMarketplace';
import VendorDetail from './pages/VendorDetail';
import MyBookings from './pages/MyBookings';
import PublicEventPage from './pages/PublicEventPage';
import VendorWorkspace from './pages/VendorWorkspace';
import AdminControlCenter from './pages/AdminControlCenter';
import EventPlanner from './pages/EventPlanner';
import ActivityTracker from './pages/ActivityTracker';
import InviteDesignStudio from './pages/InviteDesignStudio';
import InviteCanvasEditor from './pages/InviteCanvasEditor';
import InviteStudioLauncher from './pages/InviteStudioLauncher';
import InviteTemplateLibrary from './pages/InviteTemplateLibrary';
import DigitalInvitePage from './pages/DigitalInvitePage';

import NotificationsPage from './pages/NotificationsPage';
import Profile from './pages/Profile';
import PhotoBooth from './pages/PhotoBooth';
import LivePhotoWall from './pages/GuestPhotoDownload';
import SurprisePages from './pages/SurprisePages';
import SurpriseViewer from './pages/SurpriseViewer';

import './App.css';

const AppLayout = ({ children }) => (
  <Layout className="app-shell-layout" style={{ minHeight: '100vh' }}>
    <Header />
    <Layout.Content className="app-main-content" style={{ flex: 1 }}>
      <PWAInstallPrompt />
      <RouteTransition>{children}</RouteTransition>
    </Layout.Content>
    <Footer />
    <MobileAppDock />
  </Layout>
);

const PULL_GUARD_ROUTES = [
  '/',
  '/dashboard',
  '/vendors',
  '/bookings',
  '/profile',
  '/planner',
  '/surprises',
];

const AppExperienceController = () => {
  const location = useLocation();

  const shouldGuardPullToRefresh = useMemo(
    () => PULL_GUARD_ROUTES.some((path) => location.pathname === path || location.pathname.startsWith(`${path}/`)),
    [location.pathname]
  );

  usePullToRefreshGuard(shouldGuardPullToRefresh);
  return null;
};

const AppInner = () => {
  const { isAuthenticated } = useContext(AuthContext);
  const [isSplashVisible, setIsSplashVisible] = useState(true);

  useEffect(() => {
    const firstLaunchKey = 'vedika360-first-launch-seen';
    const hasSeenLaunch = localStorage.getItem(firstLaunchKey) === '1';
    const splashDuration = hasSeenLaunch ? 700 : 1700;

    if (!hasSeenLaunch) {
      localStorage.setItem(firstLaunchKey, '1');
    }

    const timer = window.setTimeout(() => {
      setIsSplashVisible(false);
    }, splashDuration);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(display-mode: standalone)');

    const updateBodyClasses = () => {
      const isStandalone = mediaQuery.matches || window.navigator.standalone === true;
      document.body.classList.toggle('is-standalone', isStandalone);
    };

    updateBodyClasses();

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', updateBodyClasses);
    } else if (mediaQuery.addListener) {
      mediaQuery.addListener(updateBodyClasses);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', updateBodyClasses);
      } else if (mediaQuery.removeListener) {
        mediaQuery.removeListener(updateBodyClasses);
      }
      document.body.classList.remove('is-standalone');
    };
  }, []);

  return (
    <>
      <AppSplashScreen visible={isSplashVisible} />
      <Router>
        <AppExperienceController />
        <Routes>
        {/* Public Routes */}
        <Route
          path="/"
          element={
            <AppLayout>
              <Home />
            </AppLayout>
          }
        />
        <Route
          path="/login"
          element={
            isAuthenticated ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <AppLayout>
                <Login />
              </AppLayout>
            )
          }
        />
        <Route
          path="/register"
          element={
            isAuthenticated ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <AppLayout>
                <Register />
              </AppLayout>
            )
          }
        />

        {/* Public event page (guests access via slug) */}
        <Route
          path="/public/:eventSlug"
          element={
            <AppLayout>
              <PublicEventPage />
            </AppLayout>
          }
        />

        {/* Public live photo wall (no auth required) */}
        <Route path="/live-photos/:eventId" element={<LivePhotoWall />} />

        {/* Public surprise viewer (no auth — recipient views this) */}
        <Route path="/surprise/:slug" element={<SurpriseViewer />} />

        {/* Public interactive digital invite page for guests */}
        <Route path="/invite/:inviteToken" element={<DigitalInvitePage />} />

        {/* Protected Routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Dashboard />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/notifications"
          element={
            <ProtectedRoute>
              <AppLayout>
                <NotificationsPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/events/create"
          element={
            <ProtectedRoute allowedRoles={['admin', 'organizer', 'customer']}>
              <AppLayout>
                <EventCreate />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/events/:eventId"
          element={
            <ProtectedRoute allowedRoles={['admin', 'organizer', 'customer']}>
              <AppLayout>
                <EventDetails />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/events/:eventId/control-panel"
          element={
            <ProtectedRoute allowedRoles={['admin', 'organizer']}>
              <AppLayout>
                <EventControlPanel />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/events/:eventId/invite-studio"
          element={
            <ProtectedRoute allowedRoles={['admin', 'organizer']}>
              <AppLayout>
                <InviteDesignStudio />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/invite-studio"
          element={
            <ProtectedRoute allowedRoles={['admin', 'organizer']}>
              <AppLayout>
                <InviteTemplateLibrary />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/invite-studio/home"
          element={
            <ProtectedRoute allowedRoles={['admin', 'organizer']}>
              <AppLayout>
                <InviteStudioLauncher />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/invite-studio/:eventId"
          element={
            <ProtectedRoute allowedRoles={['admin', 'organizer']}>
              <AppLayout>
                <InviteDesignStudio />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/events/:eventId/invite-studio/canvas/:designId"
          element={
            <ProtectedRoute allowedRoles={['admin', 'organizer']}>
              <InviteCanvasEditor />
            </ProtectedRoute>
          }
        />
        <Route
          path="/invite-studio/:eventId/canvas/:designId"
          element={
            <ProtectedRoute allowedRoles={['admin', 'organizer']}>
              <InviteCanvasEditor />
            </ProtectedRoute>
          }
        />
        <Route
          path="/events/:eventId/guests"
          element={
            <ProtectedRoute allowedRoles={['admin', 'organizer']}>
              <AppLayout>
                <GuestManagement />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/events/:eventId/budget"
          element={
            <ProtectedRoute allowedRoles={['admin', 'organizer']}>
              <AppLayout>
                <BudgetDashboard />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/vendors"
          element={
            <AppLayout>
              <VendorMarketplace />
            </AppLayout>
          }
        />
        <Route
          path="/vendors/:vendorId"
          element={
            <AppLayout>
              <VendorDetail />
            </AppLayout>
          }
        />
        <Route
          path="/bookings"
          element={
            <ProtectedRoute>
              <AppLayout>
                <MyBookings />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Profile />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/vendor/workspace"
          element={
            <ProtectedRoute allowedRoles={['vendor', 'admin']}>
              <AppLayout>
                <VendorWorkspace />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/control-center"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AppLayout>
                <AdminControlCenter />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/planner"
          element={
            <ProtectedRoute allowedRoles={['customer', 'organizer', 'admin']}>
              <AppLayout>
                <EventPlanner />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/activities"
          element={
            <ProtectedRoute allowedRoles={['organizer', 'admin']}>
              <AppLayout>
                <ActivityTracker />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/events/:eventId/photo-booth"
          element={
            <ProtectedRoute allowedRoles={['organizer', 'admin', 'vendor']}>
              <AppLayout>
                <PhotoBooth />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/surprises"
          element={
            <ProtectedRoute>
              <AppLayout>
                <SurprisePages />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </>
  );
};

const App = () => (
  <AuthProvider>
    <SocketProvider>
      <AppInner />
    </SocketProvider>
  </AuthProvider>
);

export default App;
