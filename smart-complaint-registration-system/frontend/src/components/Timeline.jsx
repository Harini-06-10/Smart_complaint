import { fmtDate } from '../api';

const WHO = { citizen: 'Citizen', staff: 'Worker', admin: 'Authority', system: 'Automatic' };

/** Audit trail of every action taken on a complaint. */
export default function Timeline({ items = [] }) {
  return (
    <ol className="timeline">
      {[...items].reverse().map((e, i) => (
        <li key={i} className={`tl tl-${e.byRole || 'system'}`}>
          <div className="tl-meta">
            <time>{fmtDate(e.at)}</time>
            <span>{e.byName || WHO[e.byRole] || 'System'}{e.byRole && e.byName ? ` (${WHO[e.byRole]})` : ''}</span>
          </div>
          <p><strong>{e.status}</strong> — {e.note}</p>
        </li>
      ))}
    </ol>
  );
}
