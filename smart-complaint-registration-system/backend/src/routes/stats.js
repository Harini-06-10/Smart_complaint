const express = require('express');
const Complaint = require('../models/Complaint');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
const { haversineMeters } = require('../utils/geo');
const { DEPARTMENTS, CATEGORIES, STATUSES, PRIORITIES, OPEN_STATUSES, POINTS } = require('../config/constants');

const router = express.Router();
const DONE = ['Resolved', 'Closed'];
const hours = (a, b) => (new Date(b) - new Date(a)) / 3600000;
const round = (n, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

/** Builds performance numbers for any group of complaints. */
function summarize(list) {
  const done = list.filter((c) => DONE.includes(c.status) && c.resolvedAt);
  const rated = list.filter((c) => c.feedback?.rating);
  const onTime = done.filter((c) => !c.slaDeadline || new Date(c.resolvedAt) <= new Date(c.slaDeadline));
  const resolutionRate = list.length ? (done.length / list.length) * 100 : 0;
  const slaCompliance = done.length ? (onTime.length / done.length) * 100 : 0;
  const avgRating = rated.length ? rated.reduce((s, c) => s + c.feedback.rating, 0) / rated.length : 0;
  return {
    total: list.length,
    resolved: done.length,
    pending: list.filter((c) => OPEN_STATUSES.includes(c.status)).length,
    escalated: list.filter((c) => c.isEscalated && OPEN_STATUSES.includes(c.status)).length,
    avgResolutionHours: done.length ? round(done.reduce((s, c) => s + hours(c.createdAt, c.resolvedAt), 0) / done.length) : 0,
    resolutionRate: round(resolutionRate),
    slaCompliance: round(slaCompliance),
    avgRating: round(avgRating),
    // Accountability score (0–100): resolution 40% + SLA 40% + citizen rating 20%
    score: list.length ? Math.round(0.4 * resolutionRate + 0.4 * slaCompliance + 0.2 * (avgRating / 5) * 100) : 0,
  };
}

function countBy(list, key, keys) {
  const out = Object.fromEntries(keys.map((k) => [k, 0]));
  list.forEach((c) => { out[c[key]] = (out[c[key]] || 0) + 1; });
  return Object.entries(out).map(([name, value]) => ({ name, value }));
}

function monthlyTrend(list, months = 6) {
  const now = new Date();
  const buckets = [];
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({ key: `${d.getFullYear()}-${d.getMonth()}`, month: d.toLocaleString('en', { month: 'short' }), filed: 0, resolved: 0 });
  }
  const find = (date) => buckets.find((b) => b.key === `${date.getFullYear()}-${date.getMonth()}`);
  list.forEach((c) => {
    const f = find(new Date(c.createdAt)); if (f) f.filed += 1;
    if (c.resolvedAt) { const r = find(new Date(c.resolvedAt)); if (r) r.resolved += 1; }
  });
  return buckets.map(({ key, ...rest }) => rest);
}

/**
 * Hotspot detection: greedy distance clustering of OPEN complaints.
 * Any open complaint within 1.5 km of a cluster centre joins that cluster.
 */
function hotspots(list, top = 5, radius = 1500) {
  const clusters = [];
  list.filter((c) => OPEN_STATUSES.includes(c.status)).forEach((c) => {
    const { lat, lng } = c.location;
    const near = clusters.find((k) => haversineMeters(k.lat, k.lng, lat, lng) <= radius);
    if (near) {
      near.items.push(c);
      near.lat = near.items.reduce((s, x) => s + x.location.lat, 0) / near.items.length;
      near.lng = near.items.reduce((s, x) => s + x.location.lng, 0) / near.items.length;
    } else {
      clusters.push({ lat, lng, items: [c] });
    }
  });
  const mostCommon = (arr) => Object.entries(arr.reduce((m, v) => ({ ...m, [v]: (m[v] || 0) + 1 }), {})).sort((a, b) => b[1] - a[1])[0][0];
  return clusters
    .map((k) => ({
      lat: k.lat, lng: k.lng, count: k.items.length,
      area: mostCommon(k.items.map((x) => x.location.ward || x.location.address || 'Unnamed area')),
      topCategory: mostCommon(k.items.map((x) => x.category)),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, top);
}

// ---------------------------------------------------------------- v3: civic points
const BADGES = [
  { id: 'first', icon: '🌱', name: 'First Report', test: (p) => p.reported >= 1, hint: 'File your first complaint' },
  { id: 'eyes', icon: '📸', name: 'Eyes on the Street', test: (p) => p.photos >= 3, hint: 'Add photo evidence to 3 complaints' },
  { id: 'pothole', icon: '🕳️', name: 'Pothole Hunter', test: (p) => p.potholes >= 2, hint: 'Report 2 potholes or damaged roads' },
  { id: 'fixer', icon: '🔧', name: 'Got It Fixed', test: (p) => p.resolved >= 3, hint: 'Have 3 of your complaints resolved' },
  { id: 'voice', icon: '🤝', name: 'Community Voice', test: (p) => p.supported >= 3, hint: 'Support 3 complaints by neighbours' },
  { id: 'critic', icon: '⭐', name: 'Fair Critic', test: (p) => p.feedback >= 3, hint: 'Rate 3 resolved complaints' },
  { id: 'hero', icon: '🏅', name: 'Neighbourhood Hero', test: (p) => p.points >= 150, hint: 'Reach 150 civic points' },
];
const LEVELS = [[0, 'Newcomer'], [50, 'Active Citizen'], [150, 'Civic Champion'], [300, 'City Guardian']];

function computePoints(userId, complaints) {
  const id = String(userId);
  const p = { reported: 0, photos: 0, potholes: 0, resolved: 0, feedback: 0, supported: 0 };
  complaints.forEach((c) => {
    if (String(c.citizen) === id && c.status !== 'Rejected') {
      p.reported += 1;
      if (c.media?.length) p.photos += 1;
      if (['Pothole', 'Road Damage'].includes(c.category)) p.potholes += 1;
      if (['Resolved', 'Closed'].includes(c.status)) p.resolved += 1;
      if (c.feedback?.rating) p.feedback += 1;
    }
    if ((c.supporters || []).some((s) => String(s) === id)) p.supported += 1;
  });
  p.points = p.reported * POINTS.reported + p.photos * POINTS.photo + p.resolved * POINTS.resolved
    + p.feedback * POINTS.feedback + p.supported * POINTS.supported;
  const levelIdx = LEVELS.filter(([min]) => p.points >= min).length - 1;
  p.level = LEVELS[levelIdx][1];
  p.nextLevel = LEVELS[levelIdx + 1] ? { name: LEVELS[levelIdx + 1][1], at: LEVELS[levelIdx + 1][0] } : null;
  p.badges = BADGES.map((b) => ({ id: b.id, icon: b.icon, name: b.name, hint: b.hint, earned: b.test(p) }));
  return p;
}

const shortName = (name = '') => {
  const [first, ...rest] = name.trim().split(/\s+/);
  return rest.length ? `${first} ${rest[rest.length - 1][0]}.` : first;
};

async function leaderboardRows() {
  const [citizens, complaints] = await Promise.all([
    User.find({ role: 'citizen' }).select('name').lean(),
    Complaint.find().select('citizen supporters status category media feedback').lean(),
  ]);
  return citizens
    .map((u) => ({ _id: u._id, name: shortName(u.name), ...computePoints(u._id, complaints) }))
    .filter((r) => r.points > 0)
    .sort((a, b) => b.points - a.points)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

// GET /api/stats/leaderboard – public: top citizens by civic points
router.get('/leaderboard', async (req, res) => {
  const rows = await leaderboardRows();
  res.json({
    rules: POINTS,
    rows: rows.slice(0, 20).map(({ _id, ...r }) => ({ ...r, badges: r.badges.filter((b) => b.earned) })),
  });
});

// GET /api/stats/my-points – logged-in citizen's points, level and badges
router.get('/my-points', protect, authorize('citizen'), async (req, res) => {
  const rows = await leaderboardRows();
  const me = rows.find((r) => String(r._id) === String(req.user._id));
  const complaints = me ? null : await Complaint.find().select('citizen supporters status category media feedback').lean();
  res.json({ ...(me || computePoints(req.user._id, complaints)), rank: me?.rank || null, of: rows.length, rules: POINTS });
});

// GET /api/stats/public – transparency dashboard (no login)
router.get('/public', async (req, res) => {
  const list = await Complaint.find().select('status category department priority createdAt resolvedAt slaDeadline isEscalated feedback location').lean();
  const departments = DEPARTMENTS.map((d) => ({ department: d, ...summarize(list.filter((c) => c.department === d)) }))
    .sort((a, b) => b.score - a.score);

  res.json({
    overall: summarize(list),
    byStatus: countBy(list, 'status', STATUSES),
    byCategory: countBy(list, 'category', Object.keys(CATEGORIES)).filter((x) => x.value > 0),
    byPriority: countBy(list, 'priority', PRIORITIES),
    departments,
    trend: monthlyTrend(list),
    hotspots: hotspots(list),
  });
});

// GET /api/stats/map – complaint pins for the public map (no personal data)
router.get('/map', async (req, res) => {
  const filter = {};
  if (req.query.category) filter.category = req.query.category;
  if (req.query.status === 'open') filter.status = { $in: OPEN_STATUSES };
  const list = await Complaint.find(filter).select('grievanceId title category status priority location isEscalated createdAt').lean();
  res.json(list.map((c) => ({
    _id: c._id, grievanceId: c.grievanceId, title: c.title, category: c.category, status: c.status,
    priority: c.priority, isEscalated: c.isEscalated, lat: c.location.lat, lng: c.location.lng, address: c.location.address, createdAt: c.createdAt,
  })));
});

// GET /api/stats/admin – officer performance + everything above
router.get('/admin', protect, authorize('admin'), async (req, res) => {
  const [list, officers] = await Promise.all([
    Complaint.find().select('status category department priority createdAt resolvedAt slaDeadline isEscalated feedback location assignedTo resolutionVerified photoMatch').lean(),
    User.find({ role: 'staff' }).select('name department email').lean(),
  ]);
  const officerStats = officers.map((o) => {
    const mine = list.filter((c) => String(c.assignedTo) === String(o._id));
    return {
      _id: o._id, name: o.name, department: o.department, ...summarize(mine),
      verifiedFixes: mine.filter((c) => c.resolutionVerified === true).length,
      unverifiedFixes: mine.filter((c) => c.resolutionVerified === false).length,
    };
  }).sort((a, b) => b.score - a.score);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  res.json({
    overall: summarize(list),
    today: list.filter((c) => new Date(c.createdAt) >= today).length,
    unassigned: list.filter((c) => !c.assignedTo && OPEN_STATUSES.includes(c.status)).length,
    // v3 integrity checks
    photoFlags: list.filter((c) => c.photoMatch?.grievanceId).length,
    unverifiedFixes: list.filter((c) => c.resolutionVerified === false).length,
    verifiedFixes: list.filter((c) => c.resolutionVerified === true).length,
    byStatus: countBy(list, 'status', STATUSES),
    byCategory: countBy(list, 'category', Object.keys(CATEGORIES)).filter((x) => x.value > 0),
    byPriority: countBy(list, 'priority', PRIORITIES),
    departments: DEPARTMENTS.map((d) => ({ department: d, ...summarize(list.filter((c) => c.department === d)) })),
    officers: officerStats,
    trend: monthlyTrend(list),
    hotspots: hotspots(list),
  });
});

module.exports = router;
