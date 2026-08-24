import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load persisted auth on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('tonight_token');
    const savedUser = localStorage.getItem('tonight_user');
    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem('tonight_token');
        localStorage.removeItem('tonight_user');
      }
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    setUser(data.user);
    setToken(data.token);
    localStorage.setItem('tonight_token', data.token);
    localStorage.setItem('tonight_user', JSON.stringify(data.user));
    return data;
  }, []);

  const register = useCallback(async (name, email, password, role = 'customer') => {
    const { data } = await api.post('/auth/register', { name, email, password, role });
    setUser(data.user);
    setToken(data.token);
    localStorage.setItem('tonight_token', data.token);
    localStorage.setItem('tonight_user', JSON.stringify(data.user));
    return data;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('tonight_token');
    localStorage.removeItem('tonight_user');
  }, []);

  const isAuthenticated = !!token;
  const isAdmin = user?.role === 'admin';
  const isOrganiser = user?.role === 'organiser';
  const isCustomer = user?.role === 'customer';

  return (
    <AuthContext.Provider value={{
      user, token, loading,
      login, register, logout,
      isAuthenticated, isAdmin, isOrganiser, isCustomer,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
