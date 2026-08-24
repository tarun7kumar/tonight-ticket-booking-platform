import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, User, Ticket, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import './Auth.css';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('customer');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !email || !password) {
      toast.error('Please fill in all fields');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      const data = await register(name, email, password, role);
      toast.success(`Welcome to Tonight, ${data.user.name}!`);
      if (role === 'organiser') navigate('/organiser');
      else navigate('/events');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <motion.div
        className="auth-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="auth-card__header">
          <div className="auth-card__logo">
            <Ticket size={24} />
          </div>
          <h1 className="headline-sm">Create Account</h1>
          <p className="text-sm">Join Tonight and start booking</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-card__form">
          <div className="input-group">
            <label>Full Name</label>
            <div className="auth-input-wrapper">
              <User size={16} className="auth-input-icon" />
              <input
                type="text"
                className="input auth-input"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>

          <div className="input-group">
            <label>Email</label>
            <div className="auth-input-wrapper">
              <Mail size={16} className="auth-input-icon" />
              <input
                type="email"
                className="input auth-input"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="input-group">
            <label>Password</label>
            <div className="auth-input-wrapper">
              <Lock size={16} className="auth-input-icon" />
              <input
                type="password"
                className="input auth-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="input-group">
            <label>I am a...</label>
            <div className="auth-role-selector">
              <button
                type="button"
                className={`auth-role-btn ${role === 'customer' ? 'auth-role-btn--active' : ''}`}
                onClick={() => setRole('customer')}
              >
                🎟️ Customer
              </button>
              <button
                type="button"
                className={`auth-role-btn ${role === 'organiser' ? 'auth-role-btn--active' : ''}`}
                onClick={() => setRole('organiser')}
              >
                🎭 Organiser
              </button>
            </div>
          </div>

          <button type="submit" className="btn btn-primary w-full" disabled={loading}>
            {loading ? 'Creating account...' : <>Get Started <ArrowRight size={16} /></>}
          </button>
        </form>

        <p className="auth-card__footer">
          Already have an account? <Link to="/login" className="auth-card__link">Sign in</Link>
        </p>
      </motion.div>
    </div>
  );
}
