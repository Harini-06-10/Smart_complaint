import { createContext, useContext, useEffect, useState } from 'react';
import api from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
  });
  const [token, setToken] = useState(() => localStorage.getItem('token'));

  // Re-validate the stored session on load
  useEffect(() => {
    if (!token) return;
    api.get('/auth/me').then((r) => setUser(r.data.user)).catch(() => logout());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = ({ token: t, user: u }) => {
    localStorage.setItem('token', t);
    localStorage.setItem('user', JSON.stringify(u));
    setToken(t);
    setUser(u);
    return u;
  };

  const login = async (email, password) => save((await api.post('/auth/login', { email, password })).data);
  const register = async (data) => save((await api.post('/auth/register', data)).data);
  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, token, login, register, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

export const homeFor = (role) => ({ admin: '/admin', staff: '/staff', citizen: '/citizen' }[role] || '/');
