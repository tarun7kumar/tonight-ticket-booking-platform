import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Layout from './components/layout/Layout';
import ProtectedRoute from './components/shared/ProtectedRoute';
import Landing from './pages/Landing';
import Events from './pages/Events';
import EventDetail from './pages/EventDetail';
import MovieDetail from './pages/MovieDetail';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import OrganiserDashboard from './pages/OrganiserDashboard';
import AdminDashboard from './pages/AdminDashboard';
import WaitlistAccept from './pages/WaitlistAccept';

export default function App() {
  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: 'var(--bg-elevated)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
            fontSize: '0.875rem',
            borderRadius: 'var(--radius-md)',
          },
          success: {
            iconTheme: {
              primary: 'var(--accent)',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: 'var(--danger)',
              secondary: '#fff',
            },
          },
        }}
      />
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Landing />} />
          <Route path="events" element={<Events />} />
          <Route path="events/:id" element={<EventDetail />} />
          <Route path="movies/:movieId" element={<MovieDetail />} />
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
          
          {/* Customer Dashboard */}
          <Route
            path="dashboard"
            element={
              <ProtectedRoute roles={['customer', 'organiser', 'admin']}>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          {/* Organiser Dashboard */}
          <Route
            path="organiser"
            element={
              <ProtectedRoute roles={['organiser', 'admin']}>
                <OrganiserDashboard />
              </ProtectedRoute>
            }
          />

          {/* Admin Dashboard */}
          <Route
            path="admin"
            element={
              <ProtectedRoute roles={['admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          {/* Waitlist Token Accept */}
          <Route path="waitlist/accept/:token" element={<WaitlistAccept />} />

          {/* Catch-all fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </>
  );
}
