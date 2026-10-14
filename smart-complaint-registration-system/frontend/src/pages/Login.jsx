import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { errorText } from '../api';
import { useAuth, homeFor } from '../context/AuthContext';
import { useLang } from '../context/LangContext';

const DEMO = [
  { role: 'Citizen', email: 'citizen@demo.com', password: 'citizen123' },
  { role: 'Authority (Admin)', email: 'admin@scrs.in', password: 'admin123' },
  { role: 'Worker · Roads (T. Nagar)', email: 'ravi@scrs.in', password: 'worker123' },
  { role: 'Worker · Roads (Tambaram)', email: 'suresh@scrs.in', password: 'worker123' },
  { role: 'Worker · Street lights', email: 'arun@scrs.in', password: 'worker123' },
  { role: 'Worker · Water', email: 'meena@scrs.in', password: 'worker123' },
];

export default function Login() {
  const { login } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e, creds = form) => {
    e?.preventDefault();
    setBusy(true); setError('');
    try {
      const user = await login(creds.email, creds.password);
      navigate(homeFor(user.role));
    } catch (err) {
      setError(errorText(err));
    } finally { setBusy(false); }
  };

  return (
    <div className="auth">
      <form className="panel auth-card" onSubmit={submit}>
        <h1>{t('login')}</h1>
        <p className="muted">Citizens, field workers and the authority all sign in here.</p>
        {error && <p className="alert alert-bad">{error}</p>}
        <label>Email
          <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" />
        </label>
        <label>Password
          <input type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="current-password" />
        </label>
        <button className="btn btn-ink btn-block" disabled={busy}>{busy ? 'Signing in…' : t('login')}</button>
        <p className="muted small">New here? <Link to="/register">{t('register')}</Link></p>
      </form>

      <aside className="panel demo">
        <h2>Demo accounts</h2>
        <p className="muted small">Pick one to sign in instantly.</p>
        <ul>
          {DEMO.map((d) => (
            <li key={d.email}>
              <button type="button" onClick={(e) => submit(e, d)} disabled={busy}>
                <strong>{d.role}</strong>
                <span>{d.email} / {d.password}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
