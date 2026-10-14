import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import { CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';

const CHENNAI = [13.04, 80.2];
const TILE = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTR = '&copy; OpenStreetMap contributors';

const pinIcon = L.divIcon({
  className: '',
  html: '<div class="map-pin"></div>',
  iconSize: [28, 28],
  iconAnchor: [14, 28],
});

const PRIO_COLOR = { Low: '#6B7A90', Medium: '#2F6FDB', High: '#E08A00', Critical: '#C8372D' };
const STATUS_DONE = ['Resolved', 'Closed'];

function ClickHandler({ onPick }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

function Recenter({ center }) {
  const map = useMap();
  useEffect(() => { if (center) map.setView(center, Math.max(map.getZoom(), 15)); }, [center?.[0], center?.[1]]); // eslint-disable-line
  return null;
}

/** Click-to-pick location map used in the complaint form. */
export function MapPicker({ value, onChange, nearby = [] }) {
  const center = value ? [value.lat, value.lng] : null;
  return (
    <MapContainer center={center || CHENNAI} zoom={center ? 15 : 11} className="map map-picker" scrollWheelZoom>
      <TileLayer url={TILE} attribution={ATTR} />
      <ClickHandler onPick={(lat, lng) => onChange({ lat, lng })} />
      {center && <Recenter center={center} />}
      {nearby.map((n) => (
        <CircleMarker key={n._id} center={[n.location.lat, n.location.lng]} radius={8} pathOptions={{ color: '#C8372D', fillOpacity: 0.5 }}>
          <Popup>{n.grievanceId}<br />{n.title}<br />{n.distance} m away</Popup>
        </CircleMarker>
      ))}
      {center && <Marker position={center} icon={pinIcon} draggable eventHandlers={{ dragend: (e) => { const p = e.target.getLatLng(); onChange({ lat: p.lat, lng: p.lng }); } }} />}
    </MapContainer>
  );
}

/** Read-only map of many complaints, coloured by priority (resolved ones in green). */
export function ComplaintMap({ points = [], hotspots = [], height = 420, linkable = false, single = null }) {
  const center = single ? [single.lat, single.lng] : CHENNAI;
  return (
    <MapContainer center={center} zoom={single ? 15 : 11} className="map" style={{ height }} scrollWheelZoom={false}>
      <TileLayer url={TILE} attribution={ATTR} />
      {single && <Marker position={center} icon={pinIcon} />}
      {hotspots.map((h, i) => (
        <CircleMarker key={`h${i}`} center={[h.lat, h.lng]} radius={14 + h.count * 6} pathOptions={{ color: '#C8372D', weight: 1, fillOpacity: 0.12, dashArray: '4 4' }}>
          <Popup><strong>Hotspot: {h.area}</strong><br />{h.count} open complaints · mostly {h.topCategory}</Popup>
        </CircleMarker>
      ))}
      {points.map((p) => {
        const done = STATUS_DONE.includes(p.status);
        const color = done ? '#1E7F5C' : PRIO_COLOR[p.priority];
        return (
          <CircleMarker key={p._id} center={[p.lat, p.lng]} radius={done ? 5 : 7} pathOptions={{ color, fillColor: color, fillOpacity: done ? 0.45 : 0.85, weight: p.isEscalated ? 3 : 1 }}>
            <Popup>
              <strong>{p.grievanceId}</strong><br />{p.title}<br />{p.category} · {p.status}
              {linkable && (<><br /><Link to={`/complaints/${p._id}`}>Open</Link></>)}
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}

export function MapLegend() {
  return (
    <div className="legend">
      {Object.entries(PRIO_COLOR).map(([k, c]) => <span key={k}><i style={{ background: c }} />{k}</span>)}
      <span><i style={{ background: '#1E7F5C', opacity: 0.6 }} />Resolved</span>
      <span><i className="ring" />Hotspot</span>
    </div>
  );
}
