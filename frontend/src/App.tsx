import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { ROUTES } from './constants';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import LiveViewPage from './pages/LiveViewPage';
import CameraDetailPage from './pages/CameraDetailPage';
import PlaybackPage from './pages/PlaybackPage';
import SettingsPage from './pages/SettingsPage';
import CamerasPage from './pages/admin/CamerasPage';
import UsersPage from './pages/admin/UsersPage';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div className="loading">Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="loading">Loading...</div>;
  }

  if (user?.role !== 'ADMIN') {
    return <Navigate to={ROUTES.HOME} replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path={ROUTES.LOGIN} element={<LoginPage />} />
      
      <Route path={ROUTES.HOME} element={
        <PrivateRoute>
          <Layout />
        </PrivateRoute>
      }>
        <Route index element={<LiveViewPage />} />
        <Route path="cameras/:id" element={<CameraDetailPage />} />
        <Route path="playback" element={<PlaybackPage />} />
        <Route path="settings" element={<SettingsPage />} />
        
        <Route path="admin/cameras" element={
          <AdminRoute>
            <CamerasPage />
          </AdminRoute>
        } />
        <Route path="admin/users" element={
          <AdminRoute>
            <UsersPage />
          </AdminRoute>
        } />
      </Route>

      <Route path="*" element={<Navigate to={ROUTES.HOME} replace />} />
    </Routes>
  );
}
