import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, Ticket, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import './Auth.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please fill in all fields');
      return;
    }
    setLoading(true);
    try {
      const data = await login(email, password);
      toast.success(`Welcome back, ${data.user.name}!`);
      if (data.user.role === 'admin') navigate('/admin');
      else if (data.user.role === 'organiser') navigate('/organiser');
      else navigate('/events');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed');
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
          <h1 className="headline-sm">Welcome Back</h1>
          <p className="text-sm">Sign in to your Tonight account</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-card__form">
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

          <button type="submit" className="btn btn-primary w-full" disabled={loading}>
            {loading ? 'Signing in...' : <>Sign In <ArrowRight size={16} /></>}
          </button>
        </form>

        <p className="auth-card__footer">
          Don't have an account? <Link to="/register" className="auth-card__link">Create one</Link>
        </p>
      </motion.div>
    </div>
  );
}
