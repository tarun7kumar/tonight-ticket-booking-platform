import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, User, LogOut, ChevronDown, Ticket } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import './Navbar.css';

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setProfileOpen(false);
  }, [location]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const getDashboardPath = () => {
    if (user?.role === 'admin') return '/admin';
    if (user?.role === 'organiser') return '/organiser';
    return '/dashboard';
  };

  return (
    <nav className={`navbar ${scrolled ? 'navbar--scrolled' : ''}`}>
      <div className="navbar__inner container">
        {/* Logo */}
        <Link to="/" className="navbar__logo">
          <img src="/logo.png" alt="TONIGHT" className="navbar__logo-img" />
          <span className="navbar__logo-text">TONIGHT</span>
        </Link>

        {/* Desktop Nav */}
        <div className="navbar__links">
          {isAuthenticated && user?.role === 'organiser' && (
            <Link to="/organiser" className={`navbar__link ${location.pathname === '/organiser' ? 'navbar__link--active' : ''}`}>
              Dashboard
            </Link>
          )}
          {isAuthenticated && user?.role === 'admin' && (
            <Link to="/admin" className={`navbar__link ${location.pathname === '/admin' ? 'navbar__link--active' : ''}`}>
              Admin
            </Link>
          )}
        </div>

        {/* Right Side */}
        <div className="navbar__actions">
          {isAuthenticated ? (
            <div className="navbar__profile" onClick={() => setProfileOpen(!profileOpen)}>
              <div className="navbar__avatar">
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <span className="navbar__username">{user?.name?.split(' ')[0]}</span>
              <ChevronDown size={14} className={`navbar__chevron ${profileOpen ? 'navbar__chevron--open' : ''}`} />

              <AnimatePresence>
                {profileOpen && (
                  <motion.div
                    className="navbar__dropdown"
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                  >
                    <div className="navbar__dropdown-header">
                      <span className="navbar__dropdown-name">{user?.name}</span>
                      <span className="navbar__dropdown-role">{user?.role}</span>
                    </div>
                    <div className="navbar__dropdown-divider" />
                    <Link to={getDashboardPath()} className="navbar__dropdown-item">
                      <User size={15} />
                      Dashboard
                    </Link>
                    <button className="navbar__dropdown-item navbar__dropdown-item--danger" onClick={handleLogout}>
                      <LogOut size={15} />
                      Sign out
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <div className="navbar__auth-buttons">
              <Link to="/login" className="btn btn-ghost btn-sm">Sign in</Link>
              <Link to="/register" className="btn btn-primary btn-sm">Get Started</Link>
            </div>
          )}

          {/* Mobile Toggle */}
          <button className="navbar__mobile-toggle" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="navbar__mobile"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
          >
            {isAuthenticated ? (
              <>
                <Link to={getDashboardPath()} className="navbar__mobile-link">Dashboard</Link>
                <button className="navbar__mobile-link" onClick={handleLogout}>Sign out</button>
              </>
            ) : (
              <>
                <Link to="/login" className="navbar__mobile-link">Sign in</Link>
                <Link to="/register" className="navbar__mobile-link">Get Started</Link>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
