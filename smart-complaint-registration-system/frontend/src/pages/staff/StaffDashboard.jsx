import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errorText } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { getSocket } from '../../socket';
import { useToast } from '../../components/Toast';
import ComplaintCard from '../../components/ComplaintCard';

export default function StaffDashboard() {
  const { user, token } = useAuth();
  const toast = useToast();
  const [list, setList] = useState(null);
  const [tab, setTab] = useState('todo');

  const load = () => api.get('/complaints/staff/queue').then((r) => setList(r.data)).catch((e) => toast(errorText(e), 'bad'));
  useEffect(() => {
    load();
    const s = getSocket(token);
    s.on('complaint:updated', load);
    return () => s.off('complaint:updated', load);
  }, []); // eslint-disable-line

  const accept = async (c) => {
    try { await api.patch(`/complaints/${c._id}/accept`); toast(`${c.grievanceId} accepted.`); load(); } catch (e) { toast(errorText(e), 'bad'); }
  };

  const groups = useMemo(() => {
    const l = list || [];
    const mine = (c) => String(c.assignedTo?._id || '') === String(user._id);
    return {
      todo: l.filter((c) => mine(c) && ['Assigned', 'Reopened', 'Submitted'].includes(c.status)),
      doing: l.filter((c) => mine(c) && c.status === 'In Progress'),
      pool: l.filter((c) => !c.assignedTo),
      done: l.filter((c) => mine(c) && ['Resolved', 'Closed'].includes(c.status)),
    };
  }, [list, user._id]);

  const all = list || [];
  const overdue = all.filter((c) => c.isEscalated && !['Resolved', 'Closed', 'Rejected'].includes(c.status)).length;
  const rated = groups.done.filter((c) => c.feedback?.rating);
  const avg = rated.length ? (rated.reduce((s, c) => s + c.feedback.rating, 0) / rated.length).toFixed(1) : '—';
  const labels = { todo: 'To accept', doing: 'In progress', pool: 'Unassigned in department', done: 'Resolved by me' };

  return (
    <div>
      <header className="page-head row-between">
        <div>
          <h1>My tasks</h1>
          <p className="muted">{user.name} · {user.department}{user.baseLocation?.ward ? ` · base: ${user.baseLocation.ward}` : ''}. Overdue complaints are listed first.</p>
        </div>
        <Link className="btn btn-accent" to="/staff/route">🗺 Plan today&apos;s route</Link>
      </header>

      <dl className="kpis kpis-4">
        <div><dt>Waiting for you</dt><dd>{groups.todo.length}</dd></div>
        <div><dt>In progress</dt><dd>{groups.doing.length}</dd></div>
        <div className={overdue ? 'kpi-bad' : ''}><dt>Escalated</dt><dd>{overdue}</dd></div>
        <div><dt>Your rating</dt><dd>{avg}<small>★ from {rated.length}</small></dd></div>
      </dl>

      <div className="tabs" role="tablist">
        {Object.keys(labels).map((k) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
            {labels[k]} <span>{groups[k].length}</span>
          </button>
        ))}
      </div>

      {!list && <p className="muted">Loading…</p>}
      {list && groups[tab].length === 0 && <div className="empty"><p>Nothing in this list right now.</p></div>}
      <div className="stack">
        {groups[tab].map((c) => (
          <ComplaintCard
            key={c._id}
            c={c}
            showCitizen
            actions={
              ['todo', 'pool'].includes(tab)
                ? <button className="btn btn-accent btn-sm" onClick={() => accept(c)}>Accept task</button>
                : <Link className="btn btn-line btn-sm" to={`/complaints/${c._id}`}>{tab === 'doing' ? 'Update / resolve' : 'View'}</Link>
            }
          />
        ))}
      </div>
    </div>
  );
}
