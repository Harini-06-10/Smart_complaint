import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth, homeFor } from '../context/AuthContext';
import { useLang } from '../context/LangContext';
import NotificationBell from './NotificationBell';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { lang, setLang, t } = useLang();
  const [open, setOpen] = useState(false);
  // v3: light / dark theme, remembered on this device
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); } catch { return 'light'; }
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('theme', theme); } catch { /* private mode */ }
  }, [theme]);
  const navigate = useNavigate();

  const links = [
    { to: '/track', label: t('track') },
    { to: '/transparency', label: t('transparency') },
    { to: '/leaderboard', label: t('leaderboard') },
  ];
  if (user?.role === 'citizen') links.unshift({ to: '/citizen', label: t('myGrievances') }, { to: '/citizen/new', label: t('fileGrievance') });
  if (user?.role === 'staff') links.unshift({ to: '/staff', label: t('myTasks') }, { to: '/staff/route', label: t('route') });
  if (user?.role === 'admin') links.unshift({ to: '/admin', label: t('dashboard') }, { to: '/admin/board', label: t('board') }, { to: '/admin/complaints', label: t('allGrievances') }, { to: '/admin/officers', label: t('workers') });

  return (
    <header className="nav">
      <div className="nav-inner">
        <Link to={user ? homeFor(user.role) : '/'} className="brand" onClick={() => setOpen(false)}>
          <span className="brand-mark" aria-hidden="true"><i /><b /><i /></span>
          <span>
            <strong>{t('appName')}</strong>
            <small>{t('appSub')}</small>
          </span>
        </Link>

        <button className="nav-toggle" aria-label="Menu" aria-expanded={open} onClick={() => setOpen(!open)}>☰</button>

        <nav className={`nav-links ${open ? 'open' : ''}`} onClick={() => setOpen(false)}>
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end>{l.label}</NavLink>
          ))}
        </nav>

        <div className="nav-actions">
          <button className="lang" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} title="Switch light / dark mode" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
            {theme === 'dark' ? '☀' : '☾'}
          </button>
          <button className="lang" onClick={() => setLang(lang === 'en' ? 'ta' : 'en')} title="Switch language">
            {lang === 'en' ? 'தமிழ்' : 'English'}
          </button>
          {user ? (
            <>
              <NotificationBell />
              <span className="who" title={user.email}>
                {user.name.split(' ')[0]}
                <em>{user.role === 'staff' ? `Worker · ${user.department}` : user.role === 'admin' ? 'Authority' : 'Citizen'}</em>
              </span>
              <button className="btn btn-quiet" onClick={() => { logout(); navigate('/'); }}>{t('logout')}</button>
            </>
          ) : (
            <>
              <Link className="btn btn-quiet" to="/login">{t('login')}</Link>
              <Link className="btn btn-accent" to="/register">{t('register')}</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
