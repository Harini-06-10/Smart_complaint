import { useLang } from '../context/LangContext';

const STEPS = ['Submitted', 'Assigned', 'In Progress', 'Resolved', 'Closed'];

/**
 * The signature element of the app: a transit-line style progress rail
 * showing where a complaint is on its journey.
 */
export default function StatusRail({ status, timeline = [], compact = false }) {
  const { t } = useLang();
  const special = status === 'Rejected' || status === 'Reopened';
  const current = status === 'Reopened' ? 1 : STEPS.indexOf(status);
  const reachedAt = (s) => timeline.find((x) => x.status === s)?.at;

  return (
    <div className={`rail ${compact ? 'rail-compact' : ''} ${status === 'Rejected' ? 'rail-rejected' : ''}`}>
      <ol>
        {STEPS.map((s, i) => {
          const state = status === 'Rejected' ? (i === 0 ? 'done' : 'off') : status === 'Closed' || i < current ? 'done' : i === current ? 'now' : 'off';
          return (
            <li key={s} className={`stop stop-${state}`} aria-current={state === 'now' ? 'step' : undefined}>
              <span className="dot" aria-hidden="true" />
              {!compact && (
                <span className="stop-text">
                  <strong>{t(s)}</strong>
                  {reachedAt(s) && state !== 'off' && (
                    <small>{new Date(reachedAt(s)).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</small>
                  )}
                </span>
              )}
            </li>
          );
        })}
      </ol>
      {special && !compact && <p className={`rail-note ${status === 'Rejected' ? 'bad' : 'warn'}`}>{status === 'Rejected' ? 'This complaint was rejected by the authority.' : 'Reopened by the citizen — waiting for the worker to act again.'}</p>}
    </div>
  );
}
