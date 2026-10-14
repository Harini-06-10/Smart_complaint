import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api, { errorText, fmtDate } from '../api';
import { useLang } from '../context/LangContext';
import StatusRail from '../components/StatusRail';
import { PriorityBadge, SlaChip, StatusBadge } from '../components/Badges';
import Timeline from '../components/Timeline';
import BeforeAfter from '../components/BeforeAfter';

/** Public tracking page – anyone with the complaint number can see its progress. */
export default function Track() {
  const { gid } = useParams();
  const { t } = useLang();
  const navigate = useNavigate();
  const [input, setInput] = useState(gid || '');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!gid) return;
    setLoading(true); setError(''); setData(null);
    api.get(`/complaints/track/${gid}`)
      .then((r) => setData(r.data))
      .catch((e) => setError(errorText(e)))
      .finally(() => setLoading(false));
  }, [gid]);

  return (
    <div className="narrow">
      <h1>Track a complaint</h1>
      <form className="track-form" onSubmit={(e) => { e.preventDefault(); if (input.trim()) navigate(`/track/${input.trim().toUpperCase()}`); }}>
        <label htmlFor="track" className="sr-only">Complaint number</label>
        <input id="track" value={input} onChange={(e) => setInput(e.target.value)} placeholder={t('trackPlaceholder')} />
        <button className="btn btn-ink">{t('trackBtn')}</button>
      </form>

      {loading && <p className="muted">Looking up {gid}…</p>}
      {error && <p className="alert alert-bad">{error}. Check the number on your confirmation and try again.</p>}

      {data && (
        <article className="panel">
          <header className="detail-head">
            <div>
              <p className="gid">{data.grievanceId}</p>
              <h2>{data.title}</h2>
              <p className="muted">{data.category} · {data.department}{data.location?.ward ? ` · ${data.location.ward}` : ''}</p>
            </div>
            <div className="chips">
              <StatusBadge status={data.status} />
              <PriorityBadge priority={data.priority} />
              <SlaChip deadline={data.slaDeadline} status={data.status} escalated={data.isEscalated} />
            </div>
          </header>
          <StatusRail status={data.status} timeline={data.timeline} />
          <dl className="facts">
            <div><dt>Filed</dt><dd>{fmtDate(data.createdAt)}</dd></div>
            <div><dt>Worker</dt><dd>{data.officer || 'Not assigned yet'}</dd></div>
            <div><dt>Resolve by</dt><dd>{fmtDate(data.slaDeadline)}</dd></div>
            <div><dt>Citizens affected</dt><dd>{data.supportCount + 1}</dd></div>
          </dl>
          {data.beforePhoto && data.afterPhoto && (
            <>
              <h3>Before &amp; after</h3>
              <BeforeAfter before={data.beforePhoto} after={data.afterPhoto} verified={data.resolutionVerified} />
            </>
          )}
          <h3>History</h3>
          <Timeline items={data.timeline} />
        </article>
      )}
    </div>
  );
}
