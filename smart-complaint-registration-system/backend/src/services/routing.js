/**
 * Smart routing, assignment & route planning.
 * - findNearbyDuplicates : same-category open complaints within DUPLICATE_RADIUS_M
 * - pickBestWorker       : v3 nearest-worker assignment (distance + workload)
 * - findPhotoReuse       : v3 same-photo detection using perceptual hashes
 * - planRoute            : v3 worker's daily route (priority-aware nearest neighbour)
 */
const Complaint = require('../models/Complaint');
const User = require('../models/User');
const { OPEN_STATUSES, DUPLICATE_RADIUS_M, LOAD_WEIGHT_KM, PHOTO_HASH_THRESHOLD } = require('../config/constants');
const { haversineMeters } = require('../utils/geo');
const { hammingDistance, isInformative } = require('../utils/photoHash');

async function findNearbyDuplicates({ lat, lng, category, excludeId = null, radius = DUPLICATE_RADIUS_M }) {
  if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) return [];
  // Rough bounding box first, then exact Haversine distance
  const delta = (radius / 111000) * 1.5;
  const query = {
    status: { $in: OPEN_STATUSES },
    'location.lat': { $gte: lat - delta, $lte: lat + delta },
    'location.lng': { $gte: lng - delta, $lte: lng + delta },
  };
  if (category) query.category = category;

  const candidates = await Complaint.find(query).select(
    'grievanceId title category status priority location supporters createdAt duplicateOf'
  );

  return candidates
    .filter((c) => String(c._id) !== String(excludeId))
    .map((c) => ({
      ...c.toJSON(),
      distance: Math.round(haversineMeters(lat, lng, c.location.lat, c.location.lng)),
    }))
    .filter((c) => c.distance <= radius)
    .sort((a, b) => a.distance - b.distance);
}

const activeTasks = (userId) => Complaint.countDocuments({ assignedTo: userId, status: { $in: OPEN_STATUSES } });

/**
 * Rank every active worker of a department for a complaint location.
 * score = distance from worker's base (km) + LOAD_WEIGHT_KM x open tasks  → lowest wins.
 * So a worker 1 km away with 3 tasks (score 7) loses to one 4 km away with 1 task (score 6).
 */
async function rankWorkers(department, location) {
  const filter = { role: 'staff', isActive: true };
  if (department) filter.department = department;
  const workers = await User.find(filter);
  const ranked = await Promise.all(workers.map(async (w) => {
    const load = await activeTasks(w._id);
    const hasBase = w.baseLocation?.lat != null && location?.lat != null;
    const distanceKm = hasBase ? haversineMeters(location.lat, location.lng, w.baseLocation.lat, w.baseLocation.lng) / 1000 : null;
    return {
      worker: w,
      activeTasks: load,
      distanceKm: distanceKm == null ? null : Math.round(distanceKm * 10) / 10,
      score: (distanceKm ?? 10) + LOAD_WEIGHT_KM * load,
    };
  }));
  return ranked.sort((a, b) => a.score - b.score);
}

async function pickBestWorker(department, location) {
  const ranked = await rankWorkers(department, location);
  return ranked[0] || null;
}

/** Looks for any earlier complaint that used (almost) the same photo. */
async function findPhotoReuse(hashes, excludeId = null) {
  const mine = (hashes || []).filter(isInformative);
  if (!mine.length) return null;
  const others = await Complaint.find({ 'mediaHashes.0': { $exists: true } }).select('grievanceId mediaHashes title status');
  let best = null;
  others.forEach((c) => {
    if (String(c._id) === String(excludeId)) return;
    c.mediaHashes.forEach((h) => mine.forEach((m) => {
      const d = hammingDistance(h, m);
      if (d <= PHOTO_HASH_THRESHOLD && (!best || d < best.bitsDifferent)) {
        best = { complaint: c._id, grievanceId: c.grievanceId, title: c.title, status: c.status, bitsDifferent: d };
      }
    }));
  });
  return best;
}

/**
 * Worker route for the day. Starts at the worker's current GPS position (or base)
 * and repeatedly visits the "cheapest" next stop. Urgent work gets a discount so
 * it is visited earlier even if slightly further away:
 *   effective distance = real distance x weight  (Critical/escalated 0.35, High 0.6, others 1)
 */
function planRoute(start, complaints) {
  const weight = (c) => (c.isEscalated || c.priority === 'Critical' ? 0.35 : c.priority === 'High' ? 0.6 : 1);
  const left = complaints.filter((c) => c.location?.lat != null);
  const stops = [];
  let here = start;
  let totalM = 0;
  while (left.length) {
    let bestI = 0;
    let bestCost = Infinity;
    left.forEach((c, i) => {
      const cost = haversineMeters(here.lat, here.lng, c.location.lat, c.location.lng) * weight(c);
      if (cost < bestCost) { bestCost = cost; bestI = i; }
    });
    const [next] = left.splice(bestI, 1);
    const legM = haversineMeters(here.lat, here.lng, next.location.lat, next.location.lng);
    totalM += legM;
    stops.push({ complaint: next, legKm: Math.round(legM / 100) / 10 });
    here = next.location;
  }
  return { stops, totalKm: Math.round(totalM / 100) / 10 };
}

module.exports = { findNearbyDuplicates, rankWorkers, pickBestWorker, findPhotoReuse, planRoute, activeTasks };
