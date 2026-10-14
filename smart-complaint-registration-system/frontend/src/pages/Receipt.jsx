import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import api, { errorText, fmtDate } from '../api';

/**
 * v3: Acknowledgement receipt with a QR code.
 * Scanning the QR opens the public tracking page for this complaint – no login needed.
 * "Print / Save as PDF" uses the browser's print dialog (choose "Save as PDF").
 */
export default function Receipt() {
  const { id } = useParams();
  const [c, setC] = useState(null);
  const [qr, setQr] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/complaints/${id}`)
      .then(async (r) => {
        setC(r.data);
        const url = `${window.location.origin}/track/${r.data.grievanceId}`;
        setQr(await QRCode.toDataURL(url, { width: 220, margin: 1, color: { dark: '#14213d', light: '#ffffff' } }));
      })
      .catch((e) => setError(errorText(e)));
  }, [id]);

  if (error) return <p className="alert alert-bad">{error}</p>;
  if (!c) return <p className="muted">Preparing receipt…</p>;
  const trackUrl = `${window.location.origin}/track/${c.grievanceId}`;

  return (
    <div className="narrow">
      <div className="row-gap no-print receipt-actions">
        <button className="btn btn-accent" onClick={() => window.print()}>Print / Save as PDF</button>
        <Link className="btn btn-line" to={`/complaints/${c._id}`}>Back to complaint</Link>
      </div>

      <article className="receipt">
        <header className="receipt-head">
          <div>
            <p className="receipt-kicker">Acknowledgement receipt</p>
            <h1>Smart Complaint Registration System</h1>
          </div>
          <span className="brand-mark" aria-hidden="true"><i /><b /><i /></span>
        </header>

        <div className="receipt-body">
          <div>
            <p className="muted small">Complaint number</p>
            <p className="gid gid-big">{c.grievanceId}</p>
            <dl className="receipt-facts">
              <div><dt>Problem</dt><dd>{c.title}</dd></div>
              <div><dt>Category</dt><dd>{c.category}</dd></div>
              <div><dt>Sent to</dt><dd>{c.department}</dd></div>
              <div><dt>Priority</dt><dd>{c.priority}</dd></div>
              <div><dt>Location</dt><dd>{c.location.address || `${c.location.lat.toFixed(5)}, ${c.location.lng.toFixed(5)}`}{c.location.ward ? ` (${c.location.ward})` : ''}</dd></div>
              <div><dt>Filed on</dt><dd>{fmtDate(c.createdAt)}</dd></div>
              <div><dt>Target date</dt><dd>{fmtDate(c.slaDeadline)}</dd></div>
              <div><dt>Filed by</dt><dd>{c.isAnonymous ? 'Anonymous' : c.citizen?.name}</dd></div>
            </dl>
          </div>
          <div className="receipt-qr">
            {qr && <img src={qr} alt={`QR code to track ${c.grievanceId}`} />}
            <p className="small">Scan to track live status</p>
            <p className="tiny muted">{trackUrl}</p>
          </div>
        </div>

        <footer className="receipt-foot">
          Keep this receipt. You can track progress any time with the complaint number or the QR code.
          You will also get a notification at every step: Submitted → Assigned → In progress → Resolved.
        </footer>
      </article>
    </div>
  );
}
