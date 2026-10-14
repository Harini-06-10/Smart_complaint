import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { fmtDate } from '../api';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';
import { getSocket } from '../socket';
import { useToast } from './Toast';

/** Bell icon with unread count; receives live notifications over Socket.IO. */
export default function NotificationBell() {
  const { token } = useAuth();
  const { t } = useLang();
  const toast = useToast();
  const navigate = useNavigate();
  const [data, setData] = useState({ items: [], unread: 0 });
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const load = () => api.get('/notifications').then((r) => setData(r.data)).catch(() => {});

  useEffect(() => {
    load();
    const socket = getSocket(token);
    const onNew = (n) => {
      setData((d) => ({ items: [n, ...d.items].slice(0, 30), unread: d.unread + 1 }));
      toast(n.message, 'info');
    };
    socket.on('notification', onNew);
    return () => socket.off('notification', onNew);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const toggle = async () => {
    setOpen(!open);
    if (!open && data.unread) {
      await api.patch('/notifications/read-all');
      setData((d) => ({ ...d, unread: 0 }));
    }
  };

  return (
    <div className="bell" ref={ref}>
      <button className="bell-btn" onClick={toggle} aria-label={`${t('notifications')} (${data.unread} unread)`}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {data.unread > 0 && <span className="bell-count">{data.unread > 9 ? '9+' : data.unread}</span>}
      </button>
      {open && (
        <div className="bell-panel">
          <h4>{t('notifications')}</h4>
          {data.items.length === 0 && <p className="muted pad">You're all caught up.</p>}
          <ul>
            {data.items.map((n) => (
              <li key={n._id} className={`notif notif-${n.type}`}>
                <button
                  onClick={() => { setOpen(false); if (n.complaint) navigate(`/complaints/${n.complaint}`); }}
                  disabled={!n.complaint}
                >
                  <span>{n.message}</span>
                  <time>{fmtDate(n.createdAt)}</time>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
