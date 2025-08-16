import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import useAuthStore from './store/authStore';
import useAppStore from './store/appStore';

import Layout from './components/Layout/Layout';
import AuthLayout from './components/Layout/AuthLayout';

import Login from './pages/Auth/Login';
import Register from './pages/Auth/Register';
import ForgotPassword from './pages/Auth/ForgotPassword';

import Dashboard from './pages/Dashboard/Dashboard';
import SuperAdminDashboard from './pages/Dashboard/SuperAdminDashboard';

import AgentList from './pages/Agents/AgentList';
import AgentCreate from './pages/Agents/AgentCreate';
import AgentEdit from './pages/Agents/AgentEdit';
import AgentRetrain from './pages/Agents/AgentRetrain'; 

import Billing from './pages/Billing/Billing';

import CallLogs from './pages/CallLogs/CallLogs';
import Training from './pages/Training/Training';
import Analytics from './pages/Analytics/Analytics';
import Notifications from './pages/Notifications/Notifications';
import Settings from './pages/Settings/Settings';
import Profile from './pages/Profile/Profile';

import UserList from './pages/User/UserList';
import BatchCallForm from './pages/BatchCalling/BatchCallForm'; 
import BatchCallingList from './pages/BatchCalling/BatchCallingList';

import VerifyOtp from './pages/Auth/VerifyOtp';
import ResetPassword from './pages/Auth/ResetPassword';

const ProtectedRoute = ({ children, requireSuperAdmin = false }) => {
  const { isAuthenticated, user } = useAuthStore();

  const normalizedRole = user?.role?.toLowerCase().replace(/\s/g, '');

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requireSuperAdmin && normalizedRole !== 'superadmin') {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

const PublicRoute = ({ children }) => {
  const { isAuthenticated } = useAuthStore();

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

function App() {
  const { isAuthenticated, user } = useAuthStore();
  const { fetchAgents, fetchSubscriptions, fetchAnalytics } = useAppStore();

  const normalizedRole = user?.role?.toLowerCase().replace(/\s/g, '');

  useEffect(() => {
    if (isAuthenticated && user) {
      fetchAgents();
      fetchSubscriptions();
      fetchAnalytics();
    }
  }, [isAuthenticated, user, fetchAgents, fetchSubscriptions, fetchAnalytics]);

  return (
    <div className="App">
      <Routes>
        <Route
          path="/login"
          element={
            <PublicRoute>
              <AuthLayout
                rightTitle="Welcome Back"
                rightSubtitle="Log in to manage your AI agents and boost productivity."
              >
                <Login />
              </AuthLayout>
            </PublicRoute>
          }
        />

        <Route
          path="/register"
          element={
            <PublicRoute>
              <AuthLayout>
                <Register />
              </AuthLayout>
            </PublicRoute>
          }
        />

        <Route
          path="/forgot-password"
          element={
            <PublicRoute>
              <AuthLayout>
                <ForgotPassword />
              </AuthLayout>
            </PublicRoute>
          }
        />

        <Route
          path="/verify-otp"
          element={
            <PublicRoute>
              <AuthLayout>
                <VerifyOtp />
              </AuthLayout>
            </PublicRoute>
          }
        />

        <Route
          path="/reset-password"
          element={
            <PublicRoute>
              <AuthLayout
              >
                <ResetPassword />
              </AuthLayout>
            </PublicRoute>
          }
        />

        <Route path="/dashboard" element={
          <ProtectedRoute>
            <Layout>
              {normalizedRole === 'superadmin' ? <SuperAdminDashboard /> : <Dashboard />}
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="/agents" element={
          <ProtectedRoute>
            <Layout>
              <AgentList />
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="/agents/create" element={
          <ProtectedRoute>
            <Layout>
              <AgentCreate />
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="/agents/:id/edit" element={
          <ProtectedRoute>
            <Layout>
              <AgentEdit />
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="/agents/:id/retrain" element={
          <ProtectedRoute>
            <Layout>
              <AgentRetrain />
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="/billing" element={
          <ProtectedRoute>
            <Layout>
              <Billing />
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="/call-logs" element={
          <ProtectedRoute>
            <Layout>
              <CallLogs />
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="/batchcalling/batchcallingform" element={
          <ProtectedRoute>
            <Layout>
              <BatchCallForm />
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="/batchcallinglist" element={
          <ProtectedRoute>
            <Layout>
              <BatchCallingList />
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="/training" element={
          <ProtectedRoute>
            <Layout>
              <Training />
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="/analytics" element={
          <ProtectedRoute>
            <Layout>
              <Analytics />
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="/notifications" element={
          <ProtectedRoute>
            <Layout>
              <Notifications />
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="/settings" element={
          <ProtectedRoute>
            <Layout>
              <Settings />
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="/profile" element={
          <ProtectedRoute>
            <Layout>
              <Profile />
            </Layout>
          </ProtectedRoute>
        } />

        {normalizedRole === 'superadmin' && (
          <Route path="/user" element={
            <ProtectedRoute>
              <Layout>
                <UserList />
              </Layout>
            </ProtectedRoute>
          } />
        )}

        <Route path="/" element={
          isAuthenticated ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />
        } />

        <Route path="*" element={
          <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />
        } />
      </Routes>
    </div>
  );
}

export default App;