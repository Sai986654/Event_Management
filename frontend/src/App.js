import React, { useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from 'antd';
import { AuthContext, AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import ProtectedRoute from './components/ProtectedRoute';
import Header from './components/Header';
import Footer from './components/Footer';

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
import ContactIntelligenceCenter from './pages/ContactIntelligenceCenter';
import NotificationsPage from './pages/NotificationsPage';
import Profile from './pages/Profile';
import PhotoBooth from './pages/PhotoBooth';
import LivePhotoWall from './pages/GuestPhotoDownload';

import './App.css';

const AppLayout = ({ children }) => (
  <Layout style={{ minHeight: '100vh' }}>
    <Header />
    <Layout.Content style={{ flex: 1 }}>
      {children}
    </Layout.Content>
    <Footer />
  </Layout>
);

const AppInner = () => {
  const { isAuthenticated } = useContext(AuthContext);

  return (
    <Router>
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
          path="/contact-intelligence"
          element={
            <ProtectedRoute allowedRoles={['organizer', 'admin']}>
              <AppLayout>
                <ContactIntelligenceCenter />
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

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
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
