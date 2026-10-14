import axios from 'axios';

// All requests go to /api – Vite proxies them to the Express server in development.
const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && localStorage.getItem('token')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
    return Promise.reject(err);
  }
);

/** Turns an axios error into a readable sentence for the UI. */
export const errorText = (err) =>
  err?.response?.data?.message || (err?.request ? 'Cannot reach the server. Is the backend running on port 5000?' : err?.message) || 'Something went wrong';

export const fmtDate = (d) =>
  d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';

export const fmtShort = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—');

/** "in 5h", "3h overdue" for SLA countdowns */
export function slaText(deadline, status) {
  if (!deadline || ['Resolved', 'Closed', 'Rejected'].includes(status)) return null;
  const diffH = (new Date(deadline) - Date.now()) / 3600000;
  const abs = Math.abs(diffH);
  const span = abs >= 48 ? `${Math.round(abs / 24)}d` : `${Math.max(1, Math.round(abs))}h`;
  return diffH >= 0 ? { label: `${span} left`, overdue: false, urgent: diffH < 12 } : { label: `${span} overdue`, overdue: true, urgent: true };
}

export default api;
