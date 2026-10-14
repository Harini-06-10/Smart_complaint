import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import api, { errorText } from '../../api';
import { useToast } from '../../components/Toast';
import { PriorityBadge, SlaChip, StatusBadge } from '../../components/Badges';

const numberIcon = (n, urgent) => L.divIcon({
  className: '',
  html: `<div class="route-num ${urgent ? 'route-num-urgent' : ''}">${n}</div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});
const startIcon = L.divIcon({ className: '', html: '<div class="route-start">▶</div>', iconSize: [30, 30], iconAnchor: [15, 15] });

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 1) map.fitBounds(points, { padding: [40, 40] });
    else if (points.length === 1) map.setView(points[0], 14);
  }, [JSON.stringify(points)]); // eslint-disable-line
  return null;
}

/**
 * v3: Worker's route for the day.
 * Orders all open tasks by a priority-aware "nearest next stop" rule,
 * draws the route and gives one-tap Google Maps navigation for each stop.
 */
export default function RoutePlanner() {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [locating, setLocating] = useState(false);

  const load = (pos) => api.get('/complaints/staff/route', { params: pos || {} })
    .then((r) => setData(r.data)).catch((e) => toast(errorText(e), 'bad'));
  useEffect(() => { load(); }, []); // eslint-disable-line

  const useLive = () => {
    if (!navigator.geolocation) return toast('Location is not available in this browser.', 'bad');
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => { load({ lat: p.coords.latitude, lng: p.coords.longitude }); setLocating(false); },
      () => { toast('Could not get your location – showing the route from your base office.', 'bad'); setLocating(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  if (!data) return <p className="muted">Planning your route…</p>;
  const { start, stops, totalKm } = data;
  const line = [start, ...stops.map((s) => s.complaint.location)].filter(Boolean).map((p) => [p.lat, p.lng]);
  const fullRoute = `https://www.google.com/maps/dir/${line.map(([a, b]) => `${a},${b}`).join('/')}`;

  return (
    <div>
      <header className="page-head row-between">
        <div>
          <h1>Today&apos;s route</h1>
          <p className="muted">
            {stops.length} stop{stops.length === 1 ? '' : 's'} · about <strong>{totalKm} km</strong> starting from {start?.label || 'your base'}.
            Urgent and overdue jobs are pulled earlier in the order.
          </p>
        </div>
        <div className="row-gap">
          <button className="btn btn-line" onClick={useLive} disabled={locating}>{locating ? 'Locating…' : '📍 Start from my location'}</button>
          {stops.length > 0 && <a className="btn btn-accent" href={fullRoute} target="_blank" rel="noreferrer">Open in Google Maps</a>}
        </div>
      </header>

      {stops.length === 0 ? (
        <div className="empty"><p>No open tasks assigned to you. Nice work!</p></div>
      ) : (
        <div className="grid-2 grid-wide-left">
          <section className="panel">
            <MapContainer center={line[0]} zoom={12} className="map" style={{ height: 480 }} scrollWheelZoom>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
              <FitBounds points={line} />
              {start && <Marker position={[start.lat, start.lng]} icon={startIcon}><Popup>Start: {start.label}</Popup></Marker>}
              <Polyline positions={line} pathOptions={{ color: '#14213d', weight: 4, dashArray: '8 8' }} />
              {stops.map((s, i) => (
                <Marker key={s.complaint._id} position={[s.complaint.location.lat, s.complaint.location.lng]} icon={numberIcon(i + 1, s.complaint.isEscalated || s.complaint.priority === 'Critical')}>
                  <Popup><strong>{i + 1}. {s.complaint.grievanceId}</strong><br />{s.complaint.title}</Popup>
                </Marker>
              ))}
            </MapContainer>
          </section>

          <section className="panel">
            <h2>Visiting order</h2>
            <ol className="route-list">
              {stops.map((s, i) => {
                const c = s.complaint;
                return (
                  <li key={c._id}>
                    <span className={`route-num ${c.isEscalated || c.priority === 'Critical' ? 'route-num-urgent' : ''}`}>{i + 1}</span>
                    <div>
                      <p className="ccard-top">
                        <Link className="gid" to={`/complaints/${c._id}`}>{c.grievanceId}</Link>
                        <StatusBadge status={c.status} />
                        <PriorityBadge priority={c.priority} />
                      </p>
                      <p className="route-title">{c.title}</p>
                      <p className="muted small">
                        {c.location.ward || c.location.address || 'Pinned location'} · {s.legKm} km from previous stop <SlaChip deadline={c.slaDeadline} status={c.status} escalated={c.isEscalated} />
                      </p>
                      <a className="small" href={`https://www.google.com/maps/dir/?api=1&destination=${c.location.lat},${c.location.lng}`} target="_blank" rel="noreferrer">Navigate →</a>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        </div>
      )}
    </div>
  );
}
