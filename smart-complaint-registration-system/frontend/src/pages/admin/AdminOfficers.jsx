import { useEffect, useState } from 'react';
import api, { errorText } from '../../api';
import { useToast } from '../../components/Toast';

const BLANK = { name: '', email: '', phone: '', password: '', department: '', baseWard: '' };

// Base offices a worker can start from (used for nearest-worker assignment and route planning)
const BASES = {
  'T. Nagar': [13.0418, 80.2341], 'Anna Nagar': [13.085, 80.2101], Adyar: [13.0012, 80.2565], Velachery: [12.9815, 80.218],
  Tambaram: [12.9249, 80.1], Avadi: [13.1067, 80.097], Poonamallee: [13.0473, 80.0945], Thiruvallur: [13.1231, 79.912],
  Mylapore: [13.0339, 80.2619], Guindy: [13.0067, 80.2206], Porur: [13.0382, 80.1565], Ambattur: [13.1143, 80.1548],
};

export default function AdminOfficers() {
  const toast = useToast();
  const [staff, setStaff] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [form, setForm] = useState(BLANK);
  const [busy, setBusy] = useState(false);

  const load = () => api.get('/users/staff').then((r) => setStaff(r.data));
  useEffect(() => { load(); api.get('/meta').then((r) => setDepartments(r.data.departments)); }, []);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const create = async (e) => {
    e.preventDefault();
    setBusy(true);
    const base = BASES[form.baseWard];
    const body = { ...form, ...(base ? { baseLat: base[0], baseLng: base[1] } : {}) };
    try { await api.post('/users/staff', body); toast(`Worker account created for ${form.name}.`); setForm(BLANK); load(); }
    catch (err) { toast(errorText(err), 'bad'); } finally { setBusy(false); }
  };

  return (
    <div>
      <header className="page-head">
        <h1>Field workers</h1>
        <p className="muted">New complaints go automatically to the nearest worker of the matching department, balanced by workload (score = distance in km + 2 × open tasks).</p>
      </header>
      <div className="grid-2 grid-wide-left">
        <section className="panel">
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Name</th><th>Department</th><th>Base office</th><th>Contact</th><th className="num">Open tasks</th></tr></thead>
              <tbody>
                {staff.map((s) => (
                  <tr key={s._id}>
                    <td><strong>{s.name}</strong></td>
                    <td>{s.department}</td>
                    <td>{s.baseLocation?.ward || '—'}</td>
                    <td className="small">{s.email}<br /><span className="muted">{s.phone}</span></td>
                    <td className="num"><span className={`load ${s.activeTasks > 5 ? 'load-hi' : ''}`}>{s.activeTasks}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <form className="panel" onSubmit={create}>
          <h2>Add a worker</h2>
          <label>Full name<input required value={form.name} onChange={set('name')} /></label>
          <label>Department
            <select required value={form.department} onChange={set('department')}>
              <option value="">Choose department</option>
              {departments.map((d) => <option key={d}>{d}</option>)}
            </select>
          </label>
          <label>Base office (area)
            <select value={form.baseWard} onChange={set('baseWard')}>
              <option value="">Choose area</option>
              {Object.keys(BASES).map((w) => <option key={w}>{w}</option>)}
            </select>
          </label>
          <label>Email<input type="email" required value={form.email} onChange={set('email')} /></label>
          <label>Phone<input value={form.phone} onChange={set('phone')} /></label>
          <label>Temporary password<input required minLength={6} value={form.password} onChange={set('password')} /></label>
          <button className="btn btn-ink btn-block" disabled={busy}>Create worker account</button>
        </form>
      </div>
    </div>
  );
}
