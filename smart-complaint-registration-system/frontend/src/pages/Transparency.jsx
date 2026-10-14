import { useEffect, useState } from 'react';
import api, { errorText } from '../api';
import { CategoryChart, Leaderboard, StatusChart, TrendChart } from '../components/Charts';
import { ComplaintMap, MapLegend } from '../components/Maps';

/** Public accountability dashboard – no login required. */
export default function Transparency() {
  const [stats, setStats] = useState(null);
  const [points, setPoints] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.get('/stats/public'), api.get('/stats/map')])
      .then(([s, m]) => { setStats(s.data); setPoints(m.data); })
      .catch((e) => setError(errorText(e)));
  }, []);

  if (error) return <p className="alert alert-bad">{error}</p>;
  if (!stats) return <p className="muted">Loading public data…</p>;
  const o = stats.overall;

  return (
    <div>
      <header className="page-head">
        <h1>How your city is responding</h1>
        <p className="muted">Live numbers from every complaint filed on this portal. Personal details are never shown here.</p>
      </header>

      <dl className="kpis">
        <div><dt>Complaints filed</dt><dd>{o.total}</dd></div>
        <div><dt>Resolved</dt><dd>{o.resolved}<small> ({o.resolutionRate}%)</small></dd></div>
        <div><dt>Still pending</dt><dd>{o.pending}</dd></div>
        <div className={o.escalated ? 'kpi-bad' : ''}><dt>Escalated (overdue)</dt><dd>{o.escalated}</dd></div>
        <div><dt>Average time to fix</dt><dd>{o.avgResolutionHours}<small> hours</small></dd></div>
        <div><dt>Citizen satisfaction</dt><dd>{o.avgRating || '—'}<small> / 5</small></dd></div>
      </dl>

      <section className="panel">
        <h2>Department accountability</h2>
        <Leaderboard rows={stats.departments} />
      </section>

      <div className="grid-2">
        <section className="panel">
          <h2>Filed vs resolved, last 6 months</h2>
          <TrendChart data={stats.trend} />
        </section>
        <section className="panel">
          <h2>Where complaints stand</h2>
          <StatusChart data={stats.byStatus} />
        </section>
      </div>

      <div className="grid-2 grid-wide-left">
        <section className="panel">
          <h2>Complaint map and hotspots</h2>
          <p className="muted small">Dashed circles mark areas with several open complaints close together.</p>
          <ComplaintMap points={points} hotspots={stats.hotspots} />
          <MapLegend />
        </section>
        <section className="panel">
          <h2>Most reported problems</h2>
          <CategoryChart data={stats.byCategory} />
        </section>
      </div>
    </div>
  );
}
