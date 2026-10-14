import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errorText } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { getSocket } from '../../socket';
import { CategoryChart, Leaderboard, StatusChart, TrendChart } from '../../components/Charts';
import { ComplaintMap, MapLegend } from '../../components/Maps';
import ComplaintCard from '../../components/ComplaintCard';

export default function AdminDashboard() {
  const { token } = useAuth();
  const [stats, setStats] = useState(null);
  const [points, setPoints] = useState([]);
  const [escalated, setEscalated] = useState([]);
  const [error, setError] = useState('');

  const load = () => Promise.all([api.get('/stats/admin'), api.get('/stats/map'), api.get('/complaints?escalated=true')])
    .then(([s, m, e]) => {
      setStats(s.data);
      setPoints(m.data);
      setEscalated(e.data.filter((c) => !['Resolved', 'Closed', 'Rejected'].includes(c.status)));
    })
    .catch((e) => setError(errorText(e)));

  useEffect(() => {
    load();
    const s = getSocket(token);
    s.on('complaint:updated', load);
    return () => s.off('complaint:updated', load);
  }, []); // eslint-disable-line

  if (error) return <p className="alert alert-bad">{error}</p>;
  if (!stats) return <p className="muted">Loading dashboard…</p>;
  const o = stats.overall;

  return (
    <div>
      <header className="page-head row-between">
        <div>
          <h1>Authority dashboard</h1>
          <p className="muted">Everything filed across all departments, updating live.</p>
        </div>
        <div className="row-gap">
          <Link className="btn btn-accent" to="/admin/board">Open assignment board</Link>
          <Link className="btn btn-ink" to="/admin/complaints">Manage complaints</Link>
        </div>
      </header>

      <dl className="kpis">
        <div><dt>Total complaints</dt><dd>{o.total}</dd></div>
        <div><dt>Filed today</dt><dd>{stats.today}</dd></div>
        <div className={stats.unassigned ? 'kpi-warn' : ''}><dt>Not assigned</dt><dd>{stats.unassigned}</dd></div>
        <div className={o.escalated ? 'kpi-bad' : ''}><dt>Escalated</dt><dd>{o.escalated}</dd></div>
        <div><dt>Resolved within deadline</dt><dd>{o.slaCompliance}<small>%</small></dd></div>
        <div><dt>Average rating</dt><dd>{o.avgRating || '—'}<small> / 5</small></dd></div>
      </dl>

      {/* v3: integrity checks */}
      <section className="panel integrity">
        <div>
          <h2>Integrity checks</h2>
          <p className="muted small">Automatic checks that keep reports genuine and fixes honest.</p>
        </div>
        <Link to="/admin/complaints?flag=photo" className={`integ ${stats.photoFlags ? 'integ-bad' : ''}`}>
          <strong>{stats.photoFlags}</strong><span>📷 Reused photos flagged</span>
        </Link>
        <div className="integ integ-ok">
          <strong>{stats.verifiedFixes}</strong><span>✔ Fixes GPS-verified on site</span>
        </div>
        <Link to="/admin/complaints?flag=unverified" className={`integ ${stats.unverifiedFixes ? 'integ-warn' : ''}`}>
          <strong>{stats.unverifiedFixes}</strong><span>⚠ Fixes not verified on site</span>
        </Link>
      </section>

      {escalated.length > 0 && (
        <section className="panel panel-alert">
          <h2>Needs attention: {escalated.length} overdue complaint{escalated.length > 1 ? 's' : ''}</h2>
          <p className="muted small">These crossed their resolution deadline and were escalated automatically.</p>
          <div className="stack">
            {escalated.slice(0, 4).map((c) => <ComplaintCard key={c._id} c={c} showCitizen actions={<Link className="btn btn-sm btn-ink" to={`/complaints/${c._id}`}>Act now</Link>} />)}
          </div>
          {escalated.length > 4 && <Link to="/admin/complaints?escalated=true">See all {escalated.length}</Link>}
        </section>
      )}

      <div className="grid-2">
        <section className="panel"><h2>Filed vs resolved</h2><TrendChart data={stats.trend} /></section>
        <section className="panel"><h2>By status</h2><StatusChart data={stats.byStatus} /></section>
      </div>

      <div className="grid-2 grid-wide-left">
        <section className="panel">
          <h2>Hotspot map</h2>
          <ComplaintMap points={points} hotspots={stats.hotspots} linkable />
          <MapLegend />
        </section>
        <section className="panel">
          <h2>Top hotspots</h2>
          <p className="muted small">Areas with the most open complaints close together — useful for planning preventive work.</p>
          <ol className="hotspots">
            {stats.hotspots.map((h, i) => (
              <li key={i}><strong>{h.area}</strong><span>{h.count} open · mostly {h.topCategory}</span></li>
            ))}
          </ol>
          <h2>By category</h2>
          <CategoryChart data={stats.byCategory} />
        </section>
      </div>

      <section className="panel">
        <h2>Departments</h2>
        <Leaderboard rows={[...stats.departments].sort((a, b) => b.score - a.score)} />
      </section>

      <section className="panel">
        <h2>Worker performance</h2>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Worker</th><th>Department</th><th className="num">Assigned</th><th className="num">Open</th><th className="num">Resolved</th><th className="num">On time</th><th className="num">GPS-verified</th><th className="num">Rating</th><th className="num">Score</th></tr></thead>
            <tbody>
              {stats.officers.map((s) => (
                <tr key={s._id}>
                  <td><strong>{s.name}</strong></td><td>{s.department}</td>
                  <td className="num">{s.total}</td><td className="num">{s.pending}</td><td className="num">{s.resolved}</td>
                  <td className="num">{s.resolved ? `${s.slaCompliance}%` : '—'}</td>
                  <td className="num">{s.verifiedFixes + s.unverifiedFixes ? `${Math.round((100 * s.verifiedFixes) / (s.verifiedFixes + s.unverifiedFixes))}%` : '—'}</td>
                  <td className="num">{s.avgRating ? `${s.avgRating}★` : '—'}</td>
                  <td className="num"><strong>{s.total ? s.score : '—'}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
