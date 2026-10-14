import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { errorText } from '../../api';
import { useLang } from '../../context/LangContext';
import { useToast } from '../../components/Toast';
import { MapPicker } from '../../components/Maps';
import { PriorityBadge, StatusBadge } from '../../components/Badges';
import { photoFingerprint, readPhotoGps } from '../../utils/photo';

const SpeechRecognition = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

export default function NewComplaint() {
  const { t, lang } = useLang();
  const toast = useToast();
  const navigate = useNavigate();

  const [meta, setMeta] = useState(null);
  const [form, setForm] = useState({ title: '', description: '', category: '', address: '', ward: '', isAnonymous: false });
  const [pos, setPos] = useState(null);
  const [files, setFiles] = useState([]);
  const [hashes, setHashes] = useState([]); // v3: photo fingerprints
  const [photoGeo, setPhotoGeo] = useState(null); // v3: GPS read from the photo
  const [photoMatch, setPhotoMatch] = useState(null); // v3: same photo used before
  const [reading, setReading] = useState(false);
  const [ai, setAi] = useState(null);
  const [nearby, setNearby] = useState([]);
  const [listening, setListening] = useState(false);
  const [locating, setLocating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);
  const recRef = useRef(null);
  const categoryTouched = useRef(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  useEffect(() => { api.get('/meta').then((r) => setMeta(r.data)); }, []);

  // ---- AI suggestion as the citizen types (debounced) ----
  useEffect(() => {
    const text = `${form.title}. ${form.description}`.trim();
    if (text.length < 15) { setAi(null); return undefined; }
    const id = setTimeout(() => {
      api.post('/ai/analyze', { text }).then((r) => {
        setAi(r.data);
        if (!categoryTouched.current) setForm((f) => ({ ...f, category: r.data.category }));
      }).catch(() => {});
    }, 500);
    return () => clearTimeout(id);
  }, [form.title, form.description]);

  // ---- Duplicate check (nearby same problem + same photo) ----
  useEffect(() => {
    if ((!pos || !form.category) && !hashes.length) { setNearby([]); setPhotoMatch(null); return; }
    api.post('/complaints/check-duplicates', { lat: pos?.lat, lng: pos?.lng, category: form.category || undefined, mediaHashes: hashes })
      .then((r) => { setNearby(pos && form.category ? r.data.nearby : []); setPhotoMatch(r.data.photoMatch); }).catch(() => {});
  }, [pos, form.category, hashes]);

  // ---- v3: when photos are chosen, read their GPS and fingerprint them ----
  const onPhotos = async (e) => {
    const chosen = Array.from(e.target.files).slice(0, 5);
    setFiles(chosen);
    setReading(true);
    const [prints, gps] = await Promise.all([
      Promise.all(chosen.map(photoFingerprint)),
      (async () => { for (const f of chosen) { const g = await readPhotoGps(f); if (g) return g; } return null; })(),
    ]);
    setHashes(prints.filter(Boolean));
    setPhotoGeo(gps);
    if (gps) {
      pick({ lat: gps.lat, lng: gps.lng });
      toast('📍 Location found in your photo – the pin has been placed for you.');
    }
    setReading(false);
  };

  // ---- Reverse geocode (OpenStreetMap Nominatim) to fill the address ----
  const fillAddress = async ({ lat, lng }) => {
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=17`);
      const j = await r.json();
      const a = j.address || {};
      setForm((f) => ({
        ...f,
        address: j.display_name?.split(',').slice(0, 4).join(',') || f.address,
        ward: a.suburb || a.neighbourhood || a.city_district || a.town || a.village || f.ward,
      }));
    } catch { /* offline – user can type the address */ }
  };

  const pick = (p) => { setPos(p); fillAddress(p); };

  const locate = () => {
    if (!navigator.geolocation) return toast('Location is not available in this browser. Click on the map instead.', 'bad');
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => { pick({ lat: p.coords.latitude, lng: p.coords.longitude }); setLocating(false); },
      () => { toast('Could not get your location. Click on the map to place the pin.', 'bad'); setLocating(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // ---- Voice input (Web Speech API, English or Tamil) ----
  const toggleVoice = () => {
    if (!SpeechRecognition) return toast('Voice input works in Chrome and Edge.', 'bad');
    if (listening) { recRef.current?.stop(); return; }
    const rec = new SpeechRecognition();
    rec.lang = lang === 'ta' ? 'ta-IN' : 'en-IN';
    rec.interimResults = false;
    rec.onresult = (e) => {
      const said = Array.from(e.results).map((r) => r[0].transcript).join(' ');
      setForm((f) => ({ ...f, description: `${f.description} ${said}`.trim() }));
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  };

  const support = async (c) => {
    try {
      await api.post(`/complaints/${c._id}/support`);
      toast(`You're now following ${c.grievanceId}. We'll notify you of every update.`);
      navigate('/citizen');
    } catch (e) { toast(errorText(e), 'bad'); }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!pos) { setError('Place the pin on the map so the worker can find the problem.'); return; }
    setBusy(true); setError('');
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    fd.append('lat', pos.lat);
    fd.append('lng', pos.lng);
    fd.append('mediaHashes', JSON.stringify(hashes));
    if (photoGeo) {
      fd.append('photoLat', photoGeo.lat);
      fd.append('photoLng', photoGeo.lng);
      if (photoGeo.takenAt) fd.append('photoTakenAt', new Date(photoGeo.takenAt).toISOString());
      fd.append('photoLocationUsed', String(Math.abs(photoGeo.lat - pos.lat) < 1e-6 && Math.abs(photoGeo.lng - pos.lng) < 1e-6));
    }
    files.forEach((f) => fd.append('media', f));
    try {
      const r = await api.post('/complaints', fd);
      setDone(r.data);
      window.scrollTo(0, 0);
    } catch (err) { setError(errorText(err)); } finally { setBusy(false); }
  };

  if (done) {
    const c = done.complaint;
    return (
      <div className="narrow">
        <section className="panel success">
          <p className="muted">Complaint registered</p>
          <p className="gid gid-big">{c.grievanceId}</p>
          <p>Keep this number to track progress without logging in.</p>
          <dl className="facts">
            <div><dt>Sent to</dt><dd>{c.department}</dd></div>
            <div><dt>Priority</dt><dd><PriorityBadge priority={c.priority} /></dd></div>
            <div><dt>Status</dt><dd><StatusBadge status={c.status} /></dd></div>
            <div><dt>Resolve by</dt><dd>{new Date(c.slaDeadline).toLocaleString('en-IN')}</dd></div>
          </dl>
          {done.duplicates > 0 && <p className="alert alert-warn">This was linked with {done.duplicates} similar report(s) nearby, so the department sees them together.</p>}
          {c.assignmentInfo?.method === 'auto' && (
            <p className="alert alert-ok">Assigned to the nearest available worker{c.assignmentInfo.distanceKm != null ? ` (${c.assignmentInfo.distanceKm} km away)` : ''}.</p>
          )}
          <div className="row-gap">
            <Link className="btn btn-accent" to={`/receipt/${c._id}`}>Download receipt (QR)</Link>
            <button className="btn btn-line" onClick={() => { navigator.clipboard?.writeText(c.grievanceId); toast('Complaint number copied'); }}>Copy number</button>
            <Link className="btn btn-ink" to={`/complaints/${c._id}`}>View complaint</Link>
            <Link className="btn btn-quiet" to="/citizen">Back to my complaints</Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div>
      <header className="page-head">
        <h1>{t('fileGrievance')}</h1>
        <p className="muted">Tell us what is wrong and where. We will send it to the right department.</p>
      </header>

      <form className="form-grid" onSubmit={submit}>
        <section className="panel">
          <h2>What is the problem?</h2>
          <label>{t('title')}
            <input required maxLength={120} value={form.title} onChange={set('title')} placeholder="e.g. Streetlight not working near bus stop" />
          </label>
          <label>
            <span className="label-row">
              {t('description')}
              <button type="button" className={`mic ${listening ? 'on' : ''}`} onClick={toggleVoice} aria-pressed={listening}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0M12 17v5" /></svg>
                {listening ? 'Listening… tap to stop' : `${t('speak')} (${lang === 'ta' ? 'தமிழ்' : 'English'})`}
              </button>
            </span>
            <textarea required rows={5} maxLength={2000} value={form.description} onChange={set('description')} placeholder="What did you see? Since when? Is anyone at risk?" />
          </label>

          {ai && (
            <div className="ai-card" aria-live="polite">
              <p>
                <strong>Suggested by the classifier:</strong> {ai.category} → {ai.department}
              </p>
              <p className="ai-meta">
                <PriorityBadge priority={ai.priority} />
                <span>{Math.round(ai.confidence * 100)}% confident</span>
                {ai.urgencyKeywords.length > 0 && <span>urgent words: {ai.urgencyKeywords.join(', ')}</span>}
              </p>
            </div>
          )}

          <label>{t('category')}
            <select required value={form.category} onChange={(e) => { categoryTouched.current = true; set('category')(e); }}>
              <option value="">Choose, or let the classifier decide</option>
              {meta && Object.keys(meta.categories).map((c) => <option key={c} value={c}>{c} — {meta.categories[c]}</option>)}
            </select>
          </label>

          <label>{t('photos')}
            <input type="file" accept="image/*,video/*" multiple onChange={onPhotos} />
          </label>
          <p className="hint">Tip: a phone photo with location turned on places the map pin automatically.</p>
          {reading && <p className="muted small">Reading photo…</p>}
          {photoGeo && (
            <p className="alert alert-ok small">
              📍 Photo location detected ({photoGeo.lat.toFixed(5)}, {photoGeo.lng.toFixed(5)})
              {photoGeo.takenAt ? ` · taken ${new Date(photoGeo.takenAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}` : ''}
            </p>
          )}
          {photoMatch && (
            <p className="alert alert-bad small">
              ⚠ This photo looks identical to the one in complaint <strong>{photoMatch.grievanceId}</strong> ({photoMatch.title}).
              Please use a fresh photo of the problem. Reused photos are flagged for review.
            </p>
          )}
          {files.length > 0 && (
            <div className="thumbs">
              {files.map((f) => (
                f.type.startsWith('image/')
                  ? <img key={f.name} src={URL.createObjectURL(f)} alt={f.name} />
                  : <span key={f.name} className="thumb-file">{f.name}</span>
              ))}
            </div>
          )}

          <label className="check">
            <input type="checkbox" checked={form.isAnonymous} onChange={set('isAnonymous')} />
            {t('anonymous')}
          </label>
        </section>

        <section className="panel">
          <h2>Where is it?</h2>
          <div className="label-row">
            <span className="muted small">Click the map or drag the pin to the exact spot.</span>
            <button type="button" className="btn btn-line btn-sm" onClick={locate} disabled={locating}>{locating ? 'Locating…' : t('useMyLocation')}</button>
          </div>
          <MapPicker value={pos} onChange={pick} nearby={nearby} />
          <div className="two">
            <label>Address / landmark<input value={form.address} onChange={set('address')} placeholder="Street, landmark" /></label>
            <label>Area / ward<input value={form.ward} onChange={set('ward')} placeholder="e.g. Velachery" /></label>
          </div>

          {nearby.length > 0 && (
            <div className="dup">
              <p><strong>{nearby.length} similar complaint{nearby.length > 1 ? 's are' : ' is'} already open within 250 m.</strong> Supporting an existing one raises its priority faster than filing a new one.</p>
              <ul>
                {nearby.slice(0, 3).map((c) => (
                  <li key={c._id}>
                    <div>
                      <span className="gid">{c.grievanceId}</span> {c.title}
                      <small className="muted"> · {c.distance} m away · {(c.supporters?.length || 0) + 1} affected</small>
                    </div>
                    <button type="button" className="btn btn-sm btn-ink" onClick={() => support(c)}>Support this one</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <div className="form-foot">
          {error && <p className="alert alert-bad">{error}</p>}
          <button className="btn btn-accent btn-lg" disabled={busy}>{busy ? 'Submitting…' : t('submit')}</button>
        </div>
      </form>
    </div>
  );
}
