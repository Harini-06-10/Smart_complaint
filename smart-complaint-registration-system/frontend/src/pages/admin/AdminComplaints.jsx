import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api, { errorText, fmtShort } from '../../api';
import { useToast } from '../../components/Toast';
import { PriorityBadge, SlaChip, StatusBadge } from '../../components/Badges';

const EMPTY = { q: '', status: '', category: '', department: '', priority: '', escalated: '', flag: '', from: '', to: '' };

export default function AdminComplaints() {
  const toast = useToast();
  const [params] = useSearchParams();
  const [meta, setMeta] = useState(null);
  const [filters, setFilters] = useState({ ...EMPTY, escalated: params.get('escalated') || '', flag: params.get('flag') || '' });
  const [list, setList] = useState(null);
  const [staff, setStaff] = useState([]);

  useEffect(() => {
    api.get('/meta').then((r) => setMeta(r.data));
    api.get('/users/staff').then((r) => setStaff(r.data));
  }, []);

  const query = new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString();
  useEffect(() => {
    const id = setTimeout(() => api.get(`/complaints?${query}`).then((r) => setList(r.data)).catch((e) => toast(errorText(e), 'bad')), 250);
    return () => clearTimeout(id);
  }, [query]); // eslint-disable-line

  const set = (k) => (e) => setFilters({ ...filters, [k]: e.target.value });

  const assign = async (c, staffId) => {
    if (!staffId) return;
    try {
      const r = await api.patch(`/complaints/${c._id}/assign`, { staffId });
      setList((l) => l.map((x) => (x._id === c._id ? r.data : x)));
      toast(`${c.grievanceId} assigned to ${r.data.assignedTo.name}.`);
    } catch (e) { toast(errorText(e), 'bad'); }
  };

  const exportCsv = async () => {
    try {
      const r = await api.get(`/reports/complaints.csv?${query}`, { responseType: 'blob' });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement('a');
      a.href = url; a.download = `complaint-report-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { toast(errorText(e), 'bad'); }
  };

  return (
    <div>
      <header className="page-head row-between">
        <div>
          <h1>All complaints</h1>
          <p className="muted">{list ? `${list.length} matching` : 'Loading…'}. Reassign directly from the table, or use the drag-and-drop board.</p>
        </div>
        <div className="row-gap">
          <button className="btn btn-line" onClick={() => window.print()}>Print report</button>
          <button className="btn btn-ink" onClick={exportCsv}>Download Excel (CSV)</button>
        </div>
      </header>

      <section className="filters panel">
        <label className="grow">Search<input value={filters.q} onChange={set('q')} placeholder="Complaint number, title or area" /></label>
        <label>Status<select value={filters.status} onChange={set('status')}><option value="">Any</option>{meta?.statuses.map((s) => <option key={s}>{s}</option>)}</select></label>
        <label>Department<select value={filters.department} onChange={set('department')}><option value="">Any</option>{meta?.departments.map((s) => <option key={s}>{s}</option>)}</select></label>
        <label>Category<select value={filters.category} onChange={set('category')}><option value="">Any</option>{meta && Object.keys(meta.categories).map((s) => <option key={s}>{s}</option>)}</select></label>
        <label>Priority<select value={filters.priority} onChange={set('priority')}><option value="">Any</option>{meta?.priorities.map((s) => <option key={s}>{s}</option>)}</select></label>
        <label>From<input type="date" value={filters.from} onChange={set('from')} /></label>
        <label>To<input type="date" value={filters.to} onChange={set('to')} /></label>
        <label>Integrity<select value={filters.flag} onChange={set('flag')}><option value="">Any</option><option value="photo">📷 Reused photo</option><option value="unverified">⚠ Fix not GPS-verified</option></select></label>
        <label className="check"><input type="checkbox" checked={filters.escalated === 'true'} onChange={(e) => setFilters({ ...filters, escalated: e.target.checked ? 'true' : '' })} />Escalated only</label>
        <button className="btn btn-quiet btn-sm" onClick={() => setFilters(EMPTY)}>Clear</button>
      </section>

      <div className="table-wrap panel">
        <table className="table">
          <thead>
            <tr><th>Complaint</th><th>Category / area</th><th>Status</th><th>Priority</th><th>Deadline</th><th>Worker</th><th className="num">Affected</th><th>Filed</th></tr>
          </thead>
          <tbody>
            {list?.map((c) => (
              <tr key={c._id} className={c.isEscalated && !['Resolved', 'Closed', 'Rejected'].includes(c.status) ? 'row-esc' : ''}>
                <td><Link to={`/complaints/${c._id}`} className="gid">{c.grievanceId}</Link>{c.photoMatch?.grievanceId && <span className="flag tiny" title={`Same photo as ${c.photoMatch.grievanceId}`}> 📷</span>}{c.resolutionVerified === true && <span className="tiny verify-ok-text" title="Fix GPS-verified on site"> ✔</span>}<br /><span className="small">{c.title}</span></td>
                <td className="small">{c.category}<br /><span className="muted">{c.location?.ward}</span></td>
                <td><StatusBadge status={c.status} /></td>
                <td><PriorityBadge priority={c.priority} /></td>
                <td><SlaChip deadline={c.slaDeadline} status={c.status} escalated={c.isEscalated} /></td>
                <td>
                  <select className="inline-select" value={c.assignedTo?._id || ''} onChange={(e) => assign(c, e.target.value)} disabled={['Closed', 'Rejected'].includes(c.status)} aria-label={`Worker for ${c.grievanceId}`}>
                    <option value="">Unassigned</option>
                    {staff.filter((s) => s.department === c.department || s._id === c.assignedTo?._id).map((s) => <option key={s._id} value={s._id}>{s.name} ({s.activeTasks})</option>)}
                  </select>
                </td>
                <td className="num">{(c.supportCount || 0) + 1}</td>
                <td className="small">{fmtShort(c.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {list?.length === 0 && <p className="empty">No complaints match these filters.</p>}
      </div>
    </div>
  );
}
