import { useLang } from '../context/LangContext';
import { slaText } from '../api';

export function StatusBadge({ status }) {
  const { t } = useLang();
  const key = status.toLowerCase().replace(/\s+/g, '-');
  return <span className={`badge status-${key}`}>{t(status)}</span>;
}

export function PriorityBadge({ priority }) {
  return <span className={`prio prio-${priority.toLowerCase()}`}><i aria-hidden="true" />{priority}</span>;
}

export function SlaChip({ deadline, status, escalated }) {
  const sla = slaText(deadline, status);
  if (!sla) return null;
  return (
    <span className={`sla ${sla.overdue ? 'sla-over' : sla.urgent ? 'sla-soon' : ''}`} title={`SLA deadline: ${new Date(deadline).toLocaleString('en-IN')}`}>
      {escalated ? 'Escalated · ' : ''}{sla.label}
    </span>
  );
}

export function Stars({ value = 0, onChange, size = 22 }) {
  return (
    <span className="stars" role={onChange ? 'radiogroup' : undefined} aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role={onChange ? 'radio' : undefined}
          aria-checked={onChange ? value === n : undefined}
          aria-label={`${n} star`}
          disabled={!onChange}
          onClick={() => onChange?.(n)}
          style={{ fontSize: size }}
          className={n <= value ? 'on' : ''}
        >★</button>
      ))}
    </span>
  );
}
