import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const INK = '#14213D';
const MARIGOLD = '#E89B0C';
const GREEN = '#1E7F5C';
const GRID = '#E3E7EE';
const STATUS_COLORS = { Submitted: '#8A94A6', Assigned: '#2F6FDB', 'In Progress': '#E89B0C', Resolved: '#1E7F5C', Closed: '#14213D', Reopened: '#B4469B', Rejected: '#C8372D' };
const axis = { fontSize: 12, fill: '#5B6478' };

export function TrendChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 10, right: 16, left: -16, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="month" tick={axis} axisLine={false} tickLine={false} />
        <YAxis allowDecimals={false} tick={axis} axisLine={false} tickLine={false} />
        <Tooltip />
        <Legend iconType="plainline" wrapperStyle={{ fontSize: 13 }} />
        <Line type="monotone" dataKey="filed" name="Filed" stroke={MARIGOLD} strokeWidth={2.5} dot={{ r: 3 }} />
        <Line type="monotone" dataKey="resolved" name="Resolved" stroke={GREEN} strokeWidth={2.5} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function CategoryChart({ data }) {
  const sorted = [...data].sort((a, b) => b.value - a.value);
  return (
    <ResponsiveContainer width="100%" height={Math.max(200, sorted.length * 32)}>
      <BarChart data={sorted} layout="vertical" margin={{ top: 0, right: 24, left: 8, bottom: 0 }}>
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis type="category" dataKey="name" width={170} tick={axis} axisLine={false} tickLine={false} />
        <Tooltip cursor={{ fill: '#F0F2F6' }} />
        <Bar dataKey="value" name="Complaints" fill={INK} radius={[0, 4, 4, 0]} barSize={16} label={{ position: 'right', fontSize: 12, fill: '#5B6478' }} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function StatusChart({ data }) {
  const rows = data.filter((d) => d.value > 0);
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={rows} margin={{ top: 16, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="name" tick={axis} axisLine={false} tickLine={false} interval={0} />
        <YAxis allowDecimals={false} tick={axis} axisLine={false} tickLine={false} />
        <Tooltip cursor={{ fill: '#F0F2F6' }} />
        <Bar dataKey="value" name="Complaints" radius={[4, 4, 0, 0]} barSize={34} label={{ position: 'top', fontSize: 12, fill: '#5B6478' }}>
          {rows.map((r) => <Cell key={r.name} fill={STATUS_COLORS[r.name]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Department accountability table with score bars. */
export function Leaderboard({ rows, showScoreHelp = true }) {
  return (
    <div className="table-wrap">
      <table className="table leader">
        <thead>
          <tr>
            <th>Department</th>
            <th className="num">Filed</th>
            <th className="num">Pending</th>
            <th className="num">Avg. time</th>
            <th className="num">On time</th>
            <th className="num">Rating</th>
            <th>Accountability score</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((d) => (
            <tr key={d.department}>
              <td><strong>{d.department}</strong>{d.escalated > 0 && <span className="esc-dot" title={`${d.escalated} escalated`}>{d.escalated} escalated</span>}</td>
              <td className="num">{d.total}</td>
              <td className="num">{d.pending}</td>
              <td className="num">{d.avgResolutionHours ? `${d.avgResolutionHours}h` : '—'}</td>
              <td className="num">{d.resolved ? `${d.slaCompliance}%` : '—'}</td>
              <td className="num">{d.avgRating ? `${d.avgRating}★` : '—'}</td>
              <td>
                <div className="score"><span className="track"><span style={{ width: `${d.score}%` }} className={d.score >= 75 ? 'good' : d.score >= 50 ? 'mid' : 'low'} /></span><b>{d.total ? d.score : '—'}</b></div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {showScoreHelp && <p className="muted small">Score = 40% resolution rate + 40% resolved within deadline + 20% citizen rating.</p>}
    </div>
  );
}
