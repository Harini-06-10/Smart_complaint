import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api, { errorText, fmtDate } from '../api';
import { useAuth } from '../context/AuthContext';
import { getSocket } from '../socket';
import { useToast } from '../components/Toast';
import StatusRail from '../components/StatusRail';
import Timeline from '../components/Timeline';
import { PriorityBadge, SlaChip, Stars, StatusBadge } from '../components/Badges';
import { ComplaintMap } from '../components/Maps';
import BeforeAfter from '../components/BeforeAfter';

const isVideo = (url) => /\.(mp4|webm|mov|mkv)$/i.test(url);
const firstPhoto = (list = []) => list.find((m) => !isVideo(m));
const km = (m) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`);

/** Browser GPS as a promise. */
const getPosition = () => new Promise((resolve, reject) => {
  if (!navigator.geolocation) { reject(new Error('Location is not available in this browser')); return; }
  navigator.geolocation.getCurrentPosition(
    (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
    () => reject(new Error('Could not get your location. Allow location access and try again.')),
    { enableHighAccuracy: true, timeout: 12000 }
  );
});

// ------------------------------------------------------------ v3: worker GPS check-in
function SiteCheckin({ c, onChange }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const visit = c.siteVisit;
  const checkin = async () => {
    setBusy(true);
    try {
      const pos = await getPosition();
      const updated = (await api.patch(`/complaints/${c._id}/checkin`, pos)).data;
      onChange(updated);
      toast(updated.siteVisit.verified ? `Checked in – you are ${km(updated.siteVisit.distanceM)} from the spot. ✔ Verified` : `You are ${km(updated.siteVisit.distanceM)} away – go closer to the spot to verify.`, updated.siteVisit.verified ? 'ok' : 'bad');
    } catch (e) { toast(e.message?.startsWith('Could not') || e.message?.startsWith('Location') ? e.message : errorText(e), 'bad'); } finally { setBusy(false); }
  };
  return (
    <section className="panel action">
      <h2>Site check-in</h2>
      <p className="muted small">Check in with GPS when you reach the spot. A fix is marked <strong>GPS-verified</strong> only if you were within 300 m.</p>
      {visit?.at && (
        <p className={`verify ${visit.verified ? 'verify-ok' : 'verify-no'}`}>
          {visit.verified ? '✔ Verified on site' : '⚠ Not at the site'} · {km(visit.distanceM)} away · {fmtDate(visit.at)}
        </p>
      )}
      <button className="btn btn-ink" onClick={checkin} disabled={busy}>{busy ? 'Getting GPS…' : visit?.at ? 'Check in again' : '📍 I have reached the site'}</button>
    </section>
  );
}

function Media({ items, label }) {
  if (!items?.length) return null;
  return (
    <div>
      <h3>{label}</h3>
      <div className="gallery">
        {items.map((m) => (isVideo(m)
          ? <video key={m} src={m} controls />
          : <a key={m} href={m} target="_blank" rel="noreferrer"><img src={m} alt={label} /></a>))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------ role panels
function CitizenPanel({ c, user, onChange }) {
  const toast = useToast();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const owner = String(c.citizen?._id || c.citizen) === String(user._id);

  const send = async (body) => {
    setBusy(true);
    try { onChange((await api.post(`/complaints/${c._id}/feedback`, body)).data); toast(body.reopen ? 'Complaint reopened. The worker has been told.' : 'Thank you. Your rating has been recorded.'); }
    catch (e) { toast(errorText(e), 'bad'); } finally { setBusy(false); }
  };

  const receipt = <Link className="btn btn-line btn-sm" to={`/receipt/${c._id}`}>Receipt with QR code</Link>;
  if (!owner) {
    return (
      <section className="panel action">
        <h2>Affected by this too?</h2>
        <p className="muted small">Supporting adds your voice. At 3 supporters the priority goes up automatically.</p>
        <button className="btn btn-ink" onClick={async () => { await api.post(`/complaints/${c._id}/support`); onChange(null); }}>
          {c.supportedByMe ? 'Remove my support' : 'I am affected too'}
        </button>
      </section>
    );
  }
  if (c.status === 'Resolved') {
    return (
      <section className="panel action action-hl">
        <h2>Is the problem fixed?</h2>
        <p className="muted small">Look at the worker's proof photos, then rate the work. If it is not fixed, reopen it.</p>
        <Stars value={rating} onChange={setRating} size={28} />
        <label>Comment (optional)<textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} /></label>
        <div className="row-gap">
          <button className="btn btn-accent" disabled={!rating || busy} onClick={() => send({ rating, comment })}>Rate and close</button>
          <button className="btn btn-line" disabled={busy} onClick={() => send({ reopen: true, comment })}>Not fixed — reopen</button>
        </div>
      </section>
    );
  }
  if (c.feedback?.rating) {
    return (
      <section className="panel action">
        <h2>Your rating</h2>
        <Stars value={c.feedback.rating} />
        {c.feedback.comment && <p>"{c.feedback.comment}"</p>}
        {receipt}
      </section>
    );
  }
  return (
    <section className="panel action">
      <h2>Your complaint</h2>
      <p className="muted small">You will be notified at every step. Share or print the receipt to track it without logging in.</p>
      {receipt}
    </section>
  );
}

function StaffPanel({ c, user, onChange }) {
  const toast = useToast();
  const [note, setNote] = useState('');
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const mine = String(c.assignedTo?._id || '') === String(user._id);

  const accept = async () => {
    setBusy(true);
    try { onChange((await api.patch(`/complaints/${c._id}/accept`)).data); toast('Task accepted. The citizen has been told work has started.'); }
    catch (e) { toast(errorText(e), 'bad'); } finally { setBusy(false); }
  };
  const update = async (resolve) => {
    const fd = new FormData();
    fd.append('note', note);
    fd.append('resolve', resolve);
    files.forEach((f) => fd.append('proof', f));
    setBusy(true);
    try {
      onChange((await api.patch(`/complaints/${c._id}/progress`, fd)).data);
      setNote(''); setFiles([]);
      toast(resolve ? 'Marked as resolved. The citizen will be asked to rate it.' : 'Progress update sent to the citizen.');
    } catch (e) { toast(errorText(e), 'bad'); } finally { setBusy(false); }
  };

  if (['Submitted', 'Assigned', 'Reopened'].includes(c.status) && (mine || !c.assignedTo)) {
    return (
      <section className="panel action action-hl">
        <h2>Take this up</h2>
        <p className="muted small">Accepting moves it to In progress and notifies the citizen.</p>
        <button className="btn btn-accent" onClick={accept} disabled={busy}>Accept task</button>
      </section>
    );
  }
  if (c.status === 'In Progress' && mine) {
    return (
      <section className="panel action action-hl">
        <h2>Update the citizen</h2>
        {!c.siteVisit?.verified && <p className="alert alert-warn small">Check in at the site first so your fix is GPS-verified.</p>}
        <label>What has been done?<textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Team visited, material ordered, work scheduled for tomorrow" /></label>
        <label>Proof photos (required to resolve)<input type="file" accept="image/*,video/*" multiple onChange={(e) => setFiles(Array.from(e.target.files))} /></label>
        <div className="row-gap">
          <button className="btn btn-line" disabled={busy || !note} onClick={() => update(false)}>Post update</button>
          <button className="btn btn-accent" disabled={busy || !files.length} onClick={() => update(true)}>Mark resolved</button>
        </div>
      </section>
    );
  }
  return null;
}

function AdminPanel({ c, onChange }) {
  const toast = useToast();
  const staff = c.workerOptions || [];
  const [staffId, setStaffId] = useState(c.assignedTo?._id || '');
  const [reason, setReason] = useState('');
  const call = async (fn, msg) => {
    try { onChange((await fn()).data); toast(msg); } catch (e) { toast(errorText(e), 'bad'); }
  };
  const closed = ['Closed', 'Rejected'].includes(c.status);

  return (
    <section className="panel action">
      <h2>Authority actions</h2>
      <label>Assign worker <span className="muted small">(nearest + least busy first)</span>
        <select value={staffId} onChange={(e) => setStaffId(e.target.value)} disabled={closed}>
          <option value="">Choose worker</option>
          {staff.map((s) => (
            <option key={s._id} value={s._id}>
              {s.recommended ? '★ ' : ''}{s.name} — {s.department === c.department ? '' : `${s.department} · `}{s.distanceKm != null ? `${s.distanceKm} km` : 'no base'} · {s.activeTasks} active
            </option>
          ))}
        </select>
      </label>
      <button className="btn btn-ink" disabled={!staffId || closed} onClick={() => call(() => api.patch(`/complaints/${c._id}/assign`, { staffId }), 'Worker assigned and notified.')}>Assign</button>

      <label>Priority
        <select value={c.priority} disabled={closed} onChange={(e) => call(() => api.patch(`/complaints/${c._id}/priority`, { priority: e.target.value }), 'Priority updated and deadline recalculated.')}>
          {['Low', 'Medium', 'High', 'Critical'].map((p) => <option key={p}>{p}</option>)}
        </select>
      </label>

      {!closed && (
        <details>
          <summary>Reject as invalid</summary>
          <label>Reason shown to the citizen<input value={reason} onChange={(e) => setReason(e.target.value)} /></label>
          <button className="btn btn-danger btn-sm" disabled={!reason} onClick={() => call(() => api.patch(`/complaints/${c._id}/reject`, { reason }), 'Complaint rejected.')}>Reject complaint</button>
        </details>
      )}
    </section>
  );
}

function Comments({ c, onAdd }) {
  const [text, setText] = useState('');
  const toast = useToast();
  const send = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    try { await api.post(`/complaints/${c._id}/comments`, { text }); setText(''); onAdd(); } catch (err) { toast(errorText(err), 'bad'); }
  };
  return (
    <section className="panel">
      <h2>Messages</h2>
      {c.comments.length === 0 && <p className="muted small">No messages yet. Ask a question or add details for the worker.</p>}
      <ul className="chat">
        {c.comments.map((m) => (
          <li key={m._id} className={`msg msg-${m.byRole}`}>
            <p>{m.text}</p>
            <small>{m.byRole === 'citizen' ? m.byName : `${m.byName} (${m.byRole === 'staff' ? 'Worker' : 'Admin'})`} · {fmtDate(m.at)}</small>
          </li>
        ))}
      </ul>
      {!['Closed', 'Rejected'].includes(c.status) && (
        <form className="chat-form" onSubmit={send}>
          <label htmlFor="msg" className="sr-only">Message</label>
          <input id="msg" value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a message" maxLength={1000} />
          <button className="btn btn-ink">Send</button>
        </form>
      )}
    </section>
  );
}

// ------------------------------------------------------------ page
export default function ComplaintDetail() {
  const { id } = useParams();
  const { user, token } = useAuth();
  const [c, setC] = useState(null);
  const [error, setError] = useState('');

  const load = () => api.get(`/complaints/${id}`).then((r) => setC(r.data)).catch((e) => setError(errorText(e)));
  useEffect(() => {
    load();
    const s = getSocket(token);
    const onUpd = (u) => { if (u._id === id) load(); };
    s.on('complaint:updated', onUpd);
    return () => s.off('complaint:updated', onUpd);
  }, [id]); // eslint-disable-line

  if (error) return <p className="alert alert-bad">{error}</p>;
  if (!c) return <p className="muted">Loading complaint…</p>;

  const onChange = (updated) => (updated ? setC((prev) => ({ ...prev, ...updated })) : load());

  return (
    <div className="detail">
      <header className="detail-head">
        <div>
          <p className="gid">{c.grievanceId}{c.isAnonymous && <span className="anon">Filed anonymously</span>}</p>
          <h1>{c.title}</h1>
          <p className="muted">{c.category} · {c.department}</p>
        </div>
        <div className="chips">
          <StatusBadge status={c.status} />
          <PriorityBadge priority={c.priority} />
          <SlaChip deadline={c.slaDeadline} status={c.status} escalated={c.isEscalated} />
        </div>
      </header>

      <section className="panel">
        <StatusRail status={c.status} timeline={c.timeline} />
      </section>

      <div className="detail-grid">
        <div className="detail-main">
          {c.photoMatch?.grievanceId && user.role !== 'citizen' && (
            <p className="alert alert-bad">⚠ Photo check: this complaint uses the same photo as <strong>{c.photoMatch.grievanceId}</strong>. Verify before acting – it may be a copied or fake report.</p>
          )}
          <section className="panel">
            <h2>Details</h2>
            <p className="desc">{c.description}</p>
            <dl className="facts">
              <div><dt>Filed by</dt><dd>{c.citizen?.name}{user.role !== 'citizen' && c.citizen?.phone ? ` · ${c.citizen.phone}` : ''}</dd></div>
              <div><dt>Filed on</dt><dd>{fmtDate(c.createdAt)}</dd></div>
              <div><dt>Worker</dt><dd>{c.assignedTo ? `${c.assignedTo.name}${c.assignedTo.phone ? ` · ${c.assignedTo.phone}` : ''}` : 'Not assigned yet'}</dd></div>
              <div><dt>How assigned</dt><dd>{{ auto: 'Auto – nearest worker', admin: 'By authority', self: 'Taken up by worker' }[c.assignmentInfo?.method] || '—'}{c.assignmentInfo?.distanceKm != null ? ` · ${c.assignmentInfo.distanceKm} km` : ''}</dd></div>
              <div><dt>Location source</dt><dd>{c.photoMeta?.usedForLocation ? '📍 From photo GPS' : 'Pinned on map'}</dd></div>
              <div><dt>Fix verified on site</dt><dd>{c.resolutionVerified === true ? <span className="verify verify-ok">✔ GPS-verified</span> : c.resolutionVerified === false ? <span className="verify verify-no">⚠ Not verified</span> : c.siteVisit?.at ? (c.siteVisit.verified ? 'Worker on site ✔' : 'Check-in too far') : '—'}</dd></div>
              <div><dt>Resolve by</dt><dd>{fmtDate(c.slaDeadline)}</dd></div>
              <div><dt>Citizens affected</dt><dd>{c.supportCount + 1}</dd></div>
              <div><dt>Classifier</dt><dd>{c.aiPrediction?.category ? `${c.aiPrediction.category}, ${Math.round((c.aiPrediction.confidence || 0) * 100)}% sure${c.aiPrediction.overridden ? ' (changed by citizen)' : ''}` : '—'}</dd></div>
            </dl>
            {firstPhoto(c.media) && firstPhoto(c.resolutionProof) && (
              <>
                <h3>Before &amp; after</h3>
                <BeforeAfter before={firstPhoto(c.media)} after={firstPhoto(c.resolutionProof)} verified={c.resolutionVerified} />
              </>
            )}
            <Media items={c.media} label="Evidence from citizen" />
            <Media items={c.resolutionProof} label="Proof from worker" />
          </section>

          <section className="panel">
            <h2>Location</h2>
            <p className="muted small">{c.location.address}{c.location.ward ? ` · ${c.location.ward}` : ''}</p>
            <ComplaintMap single={c.location} height={260} />
          </section>

          <Comments c={c} onAdd={load} />
        </div>

        <aside className="detail-side">
          {user.role === 'citizen' && <CitizenPanel c={c} user={user} onChange={onChange} />}
          {user.role === 'staff' && <StaffPanel c={c} user={user} onChange={onChange} />}
          {user.role === 'staff' && String(c.assignedTo?._id || '') === String(user._id) && ['Assigned', 'In Progress', 'Reopened'].includes(c.status) && (
            <SiteCheckin c={c} onChange={onChange} />
          )}
          {user.role === 'admin' && <AdminPanel c={c} onChange={onChange} />}

          {c.duplicateOf && (
            <section className="panel">
              <h2>Linked report</h2>
              <p className="small">Grouped with <span className="gid">{c.duplicateOf.grievanceId}</span> — {c.duplicateOf.title}</p>
            </section>
          )}
          {c.related?.length > 0 && (
            <section className="panel">
              <h2>Similar reports nearby</h2>
              <ul className="related">
                {c.related.map((r) => (
                  <li key={r._id}>
                    {user.role === 'citizen' ? <span className="gid">{r.grievanceId}</span> : <Link className="gid" to={`/complaints/${r._id}`}>{r.grievanceId}</Link>}
                    <span>{r.title}</span>
                    <small className="muted">{r.distance} m · {r.status}</small>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="panel">
            <h2>History</h2>
            <Timeline items={c.timeline} />
          </section>
        </aside>
      </div>
    </div>
  );
}
