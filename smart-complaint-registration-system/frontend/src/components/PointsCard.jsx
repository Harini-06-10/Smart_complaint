import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

/** v3: citizen's civic points, level, rank and badges. */
export default function PointsCard() {
  const [p, setP] = useState(null);
  useEffect(() => { api.get('/stats/my-points').then((r) => setP(r.data)).catch(() => {}); }, []);
  if (!p) return null;
  const pct = p.nextLevel ? Math.min(100, Math.round((p.points / p.nextLevel.at) * 100)) : 100;
  return (
    <section className="panel points">
      <div className="points-main">
        <p className="muted small">Your civic points</p>
        <p className="points-num">{p.points}<small> pts</small></p>
        <p><strong>{p.level}</strong>{p.rank ? <span className="muted"> · rank #{p.rank} of {p.of}</span> : ''}</p>
        <div className="meter" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progress to next level"><span style={{ width: `${pct}%` }} /></div>
        <p className="muted tiny">{p.nextLevel ? `${p.nextLevel.at - p.points} pts to ${p.nextLevel.name}` : 'Top level reached!'}</p>
        <Link className="small" to="/leaderboard">See leaderboard →</Link>
      </div>
      <ul className="badges">
        {p.badges.map((b) => (
          <li key={b.id} className={b.earned ? 'on' : ''} title={b.earned ? b.name : `Locked – ${b.hint}`}>
            <span aria-hidden="true">{b.icon}</span>
            <strong>{b.name}</strong>
            <small>{b.earned ? 'Earned' : b.hint}</small>
          </li>
        ))}
      </ul>
    </section>
  );
}
