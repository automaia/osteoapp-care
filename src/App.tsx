import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { trackPageView } from './lib/matomoTagManager';
import { trackPageView as trackGAPageView } from './lib/googleAnalytics';

// Layouts
import AuthLayout from './layouts/AuthLayout';
import WaitlistLayout from './layouts/WaitlistLayout';
import DashboardLayout from './layouts/DashboardLayout';

// Auth pages
import UserLogin from './pages/auth/UserLogin';
import AdminLogin from './pages/admin/AdminLogin';
import Register from './pages/auth/Register';
import BetaWaitlist from './pages/auth/BetaWaitlist';
import ForgotPassword from './pages/auth/ForgotPassword';
import Onboarding from './pages/auth/Onboarding';

// Protected pages
import Dashboard from './pages/Dashboard';
import Patients from './pages/patients/Patients';
import PatientDetail from './pages/patients/PatientDetail';
import Consultations from './pages/consultations/Consultations';
import Invoices from './pages/invoices/Invoices';
import InvoiceDetail from './pages/invoices/InvoiceDetail';
import Statistics from './pages/Statistics';
import Settings from './pages/Settings';
import Resources from './pages/Resources';
import Referral from './pages/Referral';

// Admin pages
import AdminDashboard from './pages/admin/AdminDashboard';

// Other pages
import Unauthorized from './pages/Unauthorized';

// Components
import LoadingScreen from './components/ui/LoadingScreen';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { useAuth } from './context/AuthContext';

// Route change tracker component
const RouteChangeTracker = () => {
  const location = useLocation();
  
  useEffect(() => {
    // Get page title from document or generate one based on path
    const pathSegments = location.pathname.split('/').filter(Boolean);
    let pageTitle = document.title;
    
    // If no specific title set, generate one from the path
    if (pageTitle === 'OstheoApp - Gestion de cabinet') {
      if (pathSegments.length === 0) {
        pageTitle = 'Accueil | OstheoApp';
      } else {
        // Capitalize first letter of last path segment
        const pageName = pathSegments[pathSegments.length - 1];
        pageTitle = pageName.charAt(0).toUpperCase() + pageName.slice(1) + ' | OstheoApp';
      }
    }
    
    // Track the page view in Matomo
    trackPageView(location.pathname, pageTitle);
    
    // Track the page view in Google Analytics
    trackGAPageView(location.pathname, pageTitle);
  }, [location]);
  
  return null;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <RouteChangeTracker />
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/unauthorized" element={<Unauthorized />} />
      
      {/* Admin routes */}
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route 
        path="/admin" 
        element={
          <ProtectedRoute adminOnly>
            <AdminDashboard />
          </ProtectedRoute>
        } 
      />

      {/* Auth routes */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<UserLogin />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/onboarding" element={<Onboarding />} />
      </Route>
      
      {/* Waitlist routes with centered layout */}
      <Route element={<WaitlistLayout />}>
        <Route path="/beta-waitlist" element={<BetaWaitlist />} />
      </Route>

      {/* Protected user routes */}
      <Route
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/patients" element={<Patients />} />
        <Route path="/patients/:id" element={<PatientDetail />} />
        <Route path="/consultations" element={<Consultations />} />
        <Route path="/invoices" element={<Invoices />} />
        {/* Only allow actual invoice IDs, not 'new' */}
        <Route path="/invoices/:id" element={<InvoiceDetail />} />
        <Route path="/statistics" element={<Statistics />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/resources" element={<Resources />} />
        <Route path="/referral" element={<Referral />} />
      </Route>

      {/* Default route */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;