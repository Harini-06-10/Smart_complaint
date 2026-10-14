import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errorText, fmtShort } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { getSocket } from '../../socket';
import { useToast } from '../../components/Toast';
import { PriorityBadge, SlaChip } from '../../components/Badges';

const COLUMNS = [
  { key: 'new', title: 'New / reopened', statuses: ['Submitted', 'Reopened'] },
  { key: 'assigned', title: 'Assigned', statuses: ['Assigned'] },
  { key: 'progress', title: 'In progress', statuses: ['In Progress'] },
  { key: 'resolved', title: 'Resolved (awaiting rating)', statuses: ['Resolved'] },
];

const distKm = (a, b) => {
  if (!a || !b || a.lat == null || b.lat == null) return null;
  const R = 6371;
  const r = (d) => (d * Math.PI) / 180;
  const x = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(x)) * 10) / 10;
};

/**
 * v3: Kanban workflow board for the authority.
 * Drag a complaint card onto a worker to assign it (or tap a card, then tap a worker).
 * Workers are sorted for the selected card: same department first, then distance + workload.
 */
export default function AssignBoard() {
  const { token } = useAuth();
  const toast = useToast();
  const [list, setList] = useState(null);
  const [workers, setWorkers] = useState([]);
  const [selected, setSelected] = useState(null); // complaint being dragged / tapped
  const [over, setOver] = useState(null);

  const load = () => Promise.all([api.get('/complaints'), api.get('/users/staff')])
    .then(([c, w]) => { setList(c.data); setWorkers(w.data); })
    .catch((e) => toast(errorText(e), 'bad'));
  useEffect(() => {
    load();
    const s = getSocket(token);
    s.on('complaint:updated', load);
    return () => s.off('complaint:updated', load);
  }, []); // eslint-disable-line

  const columns = useMemo(() => COLUMNS.map((col) => ({
    ...col,
    items: (list || []).filter((c) => col.statuses.includes(c.status))
      .sort((a, b) => (b.isEscalated - a.isEscalated) || ['Critical', 'High', 'Medium', 'Low'].indexOf(a.priority) - ['Critical', 'High', 'Medium', 'Low'].indexOf(b.priority)),
  })), [list]);

  const rankedWorkers = useMemo(() => {
    const rows = workers.map((w) => ({ ...w, km: selected ? distKm(selected.location, w.baseLocation) : null }));
    if (!selected) return rows;
    return rows.sort((a, b) => (b.department === selected.department) - (a.department === selected.department)
      || ((a.km ?? 99) + 2 * a.activeTasks) - ((b.km ?? 99) + 2 * b.activeTasks));
  }, [workers, selected]);

  const assign = async (complaint, worker) => {
    setSelected(null); setOver(null);
    if (!complaint || !worker) return;
    if (String(complaint.assignedTo?._id) === String(worker._id)) return;
    if (['Resolved'].includes(complaint.status)) { toast('Resolved complaints cannot be reassigned.', 'bad'); return; }
    try {
      await api.patch(`/complaints/${complaint._id}/assign`, { staffId: worker._id });
      toast(`${complaint.grievanceId} → ${worker.name}${worker.department !== complaint.department ? ` (re-routed to ${worker.department})` : ''}`);
      load();
    } catch (e) { toast(errorText(e), 'bad'); }
  };

  if (!list) return <p className="muted">Loading board…</p>;

  return (
    <div>
      <header className="page-head row-between">
        <div>
          <h1>Assignment board</h1>
          <p className="muted">Drag a complaint onto a worker to assign it — or tap a card, then tap a worker. Workers are ranked for the selected complaint.</p>
        </div>
        <Link className="btn btn-line" to="/admin/complaints">Table view</Link>
      </header>

      <div className="board">
        <div className="board-cols">
          {columns.map((col) => (
            <section key={col.key} className="board-col">
              <h2>{col.title} <span>{col.items.length}</span></h2>
              <div className="board-cards">
                {col.items.length === 0 && <p className="muted small">Empty</p>}
                {col.items.map((c) => (
                  <article
                    key={c._id}
                    className={`bcard ${selected?._id === c._id ? 'bcard-on' : ''} ${c.isEscalated ? 'bcard-esc' : ''}`}
                    draggable={col.key !== 'resolved'}
                    onDragStart={(e) => { e.dataTransfer.setData('text/plain', c._id); setSelected(c); }}
                    onDragEnd={() => setOver(null)}
                    onClick={() => setSelected(selected?._id === c._id ? null : c)}
                  >
                    <p className="ccard-top"><Link className="gid" to={`/complaints/${c._id}`} onClick={(e) => e.stopPropagation()}>{c.grievanceId}</Link><PriorityBadge priority={c.priority} /></p>
                    <p className="bcard-title">{c.title}</p>
                    <p className="muted tiny">{c.category} · {c.location?.ward || 'pinned'} · {fmtShort(c.createdAt)}</p>
                    <p className="bcard-foot">
                      <span className="bcard-who">{c.assignedTo ? `👷 ${c.assignedTo.name}` : 'Unassigned'}</span>
                      <SlaChip deadline={c.slaDeadline} status={c.status} escalated={c.isEscalated} />
                    </p>
                    {c.photoMatch?.grievanceId && <p className="tiny flag">📷 Photo reused from {c.photoMatch.grievanceId}</p>}
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>

        <aside className="board-workers">
          <h2>Workers</h2>
          <p className="muted tiny">{selected ? `For ${selected.grievanceId} (${selected.department})` : 'Select or drag a complaint to rank workers.'}</p>
          <ul>
            {rankedWorkers.map((w, i) => {
              const match = selected && w.department === selected.department;
              return (
                <li
                  key={w._id}
                  className={`wchip ${over === w._id ? 'wchip-over' : ''} ${selected ? (match ? 'wchip-match' : 'wchip-dim') : ''}`}
                  onDragOver={(e) => { e.preventDefault(); setOver(w._id); }}
                  onDragLeave={() => setOver(null)}
                  onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); assign(list.find((c) => c._id === id), w); }}
                  onClick={() => selected && assign(selected, w)}
                  role={selected ? 'button' : undefined}
                  tabIndex={selected ? 0 : undefined}
                  onKeyDown={(e) => { if (selected && (e.key === 'Enter' || e.key === ' ')) assign(selected, w); }}
                >
                  <strong>{selected && match && i === 0 ? '★ ' : ''}{w.name}</strong>
                  <span>{w.department}</span>
                  <span className="wchip-meta">
                    <span className={`load ${w.activeTasks > 5 ? 'load-hi' : ''}`}>{w.activeTasks}</span> active
                    {w.km != null && <> · {w.km} km</>}
                    {w.baseLocation?.ward && <> · base {w.baseLocation.ward}</>}
                  </span>
                </li>
              );
            })}
          </ul>
        </aside>
      </div>
    </div>
  );
}
