import { Link } from 'react-router-dom';
import { fmtShort } from '../api';
import { PriorityBadge, SlaChip, StatusBadge } from './Badges';
import StatusRail from './StatusRail';

/** Compact row used in citizen and worker lists. */
export default function ComplaintCard({ c, actions, showCitizen = false }) {
  return (
    <article className={`ccard ${c.isEscalated && !['Resolved', 'Closed'].includes(c.status) ? 'ccard-esc' : ''}`}>
      <div className="ccard-main">
        <p className="ccard-top">
          <span className="gid">{c.grievanceId}</span>
          <StatusBadge status={c.status} />
          <PriorityBadge priority={c.priority} />
          <SlaChip deadline={c.slaDeadline} status={c.status} escalated={c.isEscalated} />
        </p>
        <h3><Link to={`/complaints/${c._id}`}>{c.title}</Link></h3>
        <p className="muted small">
          {c.category} · {c.location?.ward || c.location?.address || 'Location pinned'} · filed {fmtShort(c.createdAt)}
          {showCitizen && c.citizen?.name ? ` · by ${c.citizen.name}` : ''}
          {c.supportCount > 0 ? ` · ${c.supportCount + 1} citizens affected` : ''}
        </p>
        <StatusRail status={c.status} compact />
      </div>
      {actions && <div className="ccard-actions">{actions}</div>}
    </article>
  );
}
