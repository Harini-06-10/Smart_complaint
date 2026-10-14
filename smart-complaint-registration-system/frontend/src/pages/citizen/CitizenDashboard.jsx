import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errorText } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useLang } from '../../context/LangContext';
import { getSocket } from '../../socket';
import ComplaintCard from '../../components/ComplaintCard';
import PointsCard from '../../components/PointsCard';

const OPEN = ['Submitted', 'Assigned', 'In Progress', 'Reopened'];

export default function CitizenDashboard() {
  const { user, token } = useAuth();
  const { t } = useLang();
  const [list, setList] = useState(null);
  const [tab, setTab] = useState('all');
  const [error, setError] = useState('');

  const load = () => api.get('/complaints/mine').then((r) => setList(r.data)).catch((e) => setError(errorText(e)));

  useEffect(() => {
    load();
    const s = getSocket(token);
    s.on('complaint:updated', load);
    return () => s.off('complaint:updated', load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mine = (c) => String(c.citizen?._id || c.citizen) === String(user._id);
  const tabs = useMemo(() => {
    const l = list || [];
    return {
      all: l.filter(mine),
      open: l.filter((c) => mine(c) && OPEN.includes(c.status)),
      rate: l.filter((c) => mine(c) && c.status === 'Resolved'),
      done: l.filter((c) => mine(c) && ['Closed', 'Rejected'].includes(c.status)),
      supported: l.filter((c) => !mine(c)),
    };
  }, [list]); // eslint-disable-line

  const labels = { all: 'All', open: 'In progress', rate: 'Waiting for your rating', done: 'Closed', supported: 'Supported by me' };

  return (
    <div>
      <header className="page-head row-between">
        <div>
          <h1>{t('myComplaints')}</h1>
          <p className="muted">Hello {user.name.split(' ')[0]}. Updates appear here the moment a worker acts.</p>
        </div>
        <Link className="btn btn-accent" to="/citizen/new">{t('fileComplaint')}</Link>
      </header>

      {error && <p className="alert alert-bad">{error}</p>}
      <PointsCard />
      {tabs.rate.length > 0 && (
        <p className="alert alert-ok">{tabs.rate.length} complaint{tabs.rate.length > 1 ? 's have' : ' has'} been resolved. Compare the before/after photos and rate the work.</p>
      )}

      <div className="tabs" role="tablist">
        {Object.keys(labels).map((k) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
            {labels[k]} <span>{tabs[k].length}</span>
          </button>
        ))}
      </div>

      {!list && <p className="muted">Loading…</p>}
      {list && tabs[tab].length === 0 && (
        <div className="empty">
          <p>Nothing here yet.</p>
          {tab === 'all' && <Link className="btn btn-ink" to="/citizen/new">File your first complaint</Link>}
        </div>
      )}
      <div className="stack">
        {list && tabs[tab].map((c) => <ComplaintCard key={c._id} c={c} />)}
      </div>
    </div>
  );
}
