import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth, homeFor } from '../context/AuthContext';
import { useLang } from '../context/LangContext';
import StatusRail from '../components/StatusRail';

const STEPS = [
  ['Snap & report', 'Take a photo of the problem. If your phone saved its location, the map pin drops itself. Add a line of text or just speak it.'],
  ['Routed automatically', 'The category, department and priority are predicted for you. Repeat reports and reused photos are detected.'],
  ['Nearest worker assigned', 'The closest available worker with the lightest workload gets it, plans a route, and checks in at the site by GPS.'],
  ['Compare before & after', 'See the fix side by side with your photo, then rate it — or reopen it if the problem is still there.'],
];

const NEW_IN_V3 = [
  ['📍', 'Photo GPS auto-location', 'Location is read from the photo itself.'],
  ['📷', 'Fake-photo detection', 'Reused photos are fingerprinted and flagged.'],
  ['👷', 'Nearest-worker assignment', 'Distance + workload decide who goes.'],
  ['✔', 'GPS-verified fixes', 'Workers must check in at the site.'],
  ['⇆', 'Before / after slider', 'Proof of work you can see.'],
  ['🧾', 'QR receipt', 'Scan to track, no login needed.'],
  ['🗺', 'Route planner', 'Workers get an optimised daily route.'],
  ['🏅', 'Civic points & badges', 'Genuine reporters are rewarded.'],
];

export default function Home() {
  const { t } = useLang();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [gid, setGid] = useState('');
  const [stats, setStats] = useState(null);

  useEffect(() => { api.get('/stats/public').then((r) => setStats(r.data)).catch(() => {}); }, []);

  const o = stats?.overall;
  return (
    <div className="home">
      <section className="hero">
        <div className="hero-copy">
          <h1>{t('heroTitle')}</h1>
          <p className="lead">{t('heroText')}</p>
          <div className="hero-cta">
            <Link className="btn btn-accent btn-lg" to={user ? (user.role === 'citizen' ? '/citizen/new' : homeFor(user.role)) : '/register'}>
              {user && user.role !== 'citizen' ? 'Open my dashboard' : t('fileGrievance')}
            </Link>
            <Link className="btn btn-line btn-lg" to="/transparency">See how departments perform</Link>
          </div>
        </div>

        <form className="ticket" onSubmit={(e) => { e.preventDefault(); if (gid.trim()) navigate(`/track/${gid.trim().toUpperCase()}`); }}>
          <div className="ticket-head">
            <span>Already filed one?</span>
            <strong>Track without logging in</strong>
          </div>
          <label htmlFor="gid" className="sr-only">Complaint number</label>
          <input id="gid" value={gid} onChange={(e) => setGid(e.target.value)} placeholder={t('trackPlaceholder')} />
          <button className="btn btn-ink" type="submit">{t('trackBtn')}</button>
          <div className="ticket-rail">
            <StatusRail status="In Progress" />
          </div>
          {o && (
            <dl className="ticket-stats">
              <div><dt>Complaints filed</dt><dd>{o.total}</dd></div>
              <div><dt>Resolved</dt><dd>{o.resolutionRate}%</dd></div>
              <div><dt>Fixed within deadline</dt><dd>{o.slaCompliance}%</dd></div>
              <div><dt>Citizen rating</dt><dd>{o.avgRating || '—'}★</dd></div>
            </dl>
          )}
        </form>
      </section>

      <section className="how">
        <h2>From complaint to resolution</h2>
        <ol className="how-steps">
          {STEPS.map(([h, p]) => (
            <li key={h}><h3>{h}</h3><p>{p}</p></li>
          ))}
        </ol>
      </section>

      <section className="newv3">
        <h2>New in version 3</h2>
        <ul className="newv3-list">
          {NEW_IN_V3.map(([icon, h, p]) => (
            <li key={h}><span aria-hidden="true">{icon}</span><div><strong>{h}</strong><p>{p}</p></div></li>
          ))}
        </ul>
      </section>

      <section className="cats">
        <h2>What you can report</h2>
        <p className="muted">Each category goes straight to the department responsible for it.</p>
        <ul className="cat-list">
          {[
            ['Potholes & road damage', 'Roads & Highways'],
            ['Garbage accumulation', 'Solid Waste Management'],
            ['Streetlights & exposed wires', 'Electricity & Street Lights'],
            ['Water leaks & blocked drains', 'Water Supply & Sewerage'],
            ['Broken traffic signals', 'Traffic & Transport'],
            ['Fallen trees', 'Parks & Horticulture'],
            ['Damaged public property', 'Public Works'],
          ].map(([c, d]) => <li key={c}><strong>{c}</strong><span>{d}</span></li>)}
        </ul>
      </section>
    </div>
  );
}
