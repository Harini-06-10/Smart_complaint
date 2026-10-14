import { useEffect, useState } from 'react';
import api, { errorText } from '../api';

const RULE_TEXT = {
  reported: 'valid complaint filed',
  photo: 'photo evidence added',
  resolved: 'your complaint gets fixed',
  feedback: 'you rate the work',
  supported: "you support a neighbour's complaint",
};

/** v3: public leaderboard of the most active citizens. */
export default function Leaderboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api.get('/stats/leaderboard').then((r) => setData(r.data)).catch((e) => setError(errorText(e))); }, []);

  if (error) return <p className="alert alert-bad">{error}</p>;
  if (!data) return <p className="muted">Loading leaderboard…</p>;
  const [first, second, third, ...rest] = data.rows;

  return (
    <div>
      <header className="page-head">
        <h1>Civic champions</h1>
        <p className="muted">Citizens who help keep the city working. Earn points for every genuine report and unlock badges.</p>
      </header>

      <div className="grid-2 grid-wide-left">
        <section className="panel">
          {data.rows.length === 0 && <p className="muted">No points yet — be the first to report a problem!</p>}
          <ol className="podium">
            {[second, first, third].filter(Boolean).map((r) => (
              <li key={r.rank} className={`podium-${r.rank}`}>
                <span className="podium-medal">{['🥇', '🥈', '🥉'][r.rank - 1]}</span>
                <strong>{r.name}</strong>
                <span>{r.points} pts</span>
                <small>{r.level}</small>
              </li>
            ))}
          </ol>
          {rest.length > 0 && (
            <table className="table">
              <thead><tr><th>#</th><th>Citizen</th><th>Level</th><th>Badges</th><th className="num">Points</th></tr></thead>
              <tbody>
                {rest.map((r) => (
                  <tr key={r.rank}>
                    <td>{r.rank}</td><td><strong>{r.name}</strong></td><td>{r.level}</td>
                    <td>{r.badges.map((b) => <span key={b.id} title={b.name} className="badge-icon">{b.icon}</span>)}</td>
                    <td className="num"><strong>{r.points}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="panel">
          <h2>How to earn points</h2>
          <ul className="rules">
            {Object.entries(data.rules).map(([k, v]) => <li key={k}><b>+{v}</b> {RULE_TEXT[k]}</li>)}
          </ul>
          <p className="muted small">Rejected (fake or invalid) complaints earn nothing, and reused photos are flagged — so points reward genuine reports only.</p>
          <h2>Top badges</h2>
          <ul className="rules">
            {data.rows.slice(0, 5).map((r) => (
              <li key={r.rank}><strong>{r.name}</strong> {r.badges.map((b) => <span key={b.id} title={b.name} className="badge-icon">{b.icon}</span>)}</li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
