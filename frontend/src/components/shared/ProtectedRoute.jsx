import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function ProtectedRoute({ children, roles }) {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '60vh' }}>
        <LoadingSpinner />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(user?.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export function LoadingSpinner({ size = 40 }) {
  return (
    <div className="loading-spinner" style={{ width: size, height: size }}>
      <style>{`
        .loading-spinner {
          position: relative;
          display: inline-block;
        }
        .loading-spinner::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 3px solid var(--border);
          border-top-color: var(--accent);
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
