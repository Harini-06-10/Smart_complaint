import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { errorText } from '../api';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';

export default function Register() {
  const { register } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await register(form);
      navigate('/citizen/new');
    } catch (err) { setError(errorText(err)); } finally { setBusy(false); }
  };

  return (
    <div className="auth auth-single">
      <form className="panel auth-card" onSubmit={submit}>
        <h1>{t('register')}</h1>
        <p className="muted">A citizen account lets you file complaints and follow them until they are fixed.</p>
        {error && <p className="alert alert-bad">{error}</p>}
        <label>Full name<input required value={form.name} onChange={set('name')} autoComplete="name" /></label>
        <label>Email<input type="email" required value={form.email} onChange={set('email')} autoComplete="email" /></label>
        <label>Mobile number<input type="tel" pattern="[0-9]{10}" title="10 digit mobile number" value={form.phone} onChange={set('phone')} autoComplete="tel" /></label>
        <label>Password<input type="password" minLength={6} required value={form.password} onChange={set('password')} autoComplete="new-password" /></label>
        <button className="btn btn-accent btn-block" disabled={busy}>{busy ? 'Creating account…' : t('register')}</button>
        <p className="muted small">Already registered? <Link to="/login">{t('login')}</Link></p>
      </form>
    </div>
  );
}
