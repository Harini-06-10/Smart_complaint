const express = require('express');
const Complaint = require('../models/Complaint');
const User = require('../models/User');
const upload = require('../middleware/upload');
const { protect, authorize } = require('../middleware/auth');
const { analyze, predictPriority } = require('../services/aiClassifier');
const { computeDeadline } = require('../services/slaEngine');
const { findNearbyDuplicates, pickBestWorker, rankWorkers, findPhotoReuse, planRoute } = require('../services/routing');
const { parseHashes } = require('../utils/photoHash');
const { haversineMeters } = require('../utils/geo');
const { notifyUser, notifyAdmins, broadcastUpdate } = require('../services/notify');
const { nextGrievanceId } = require('../utils/grievanceId');
const { CATEGORIES, PRIORITIES, OPEN_STATUSES, SUPPORT_BOOST_THRESHOLD, SITE_VERIFY_RADIUS_M } = require('../config/constants');

const router = express.Router();

const fileUrls = (files = []) => files.map((f) => `/uploads/${f.filename}`);
const POPULATE = [
  { path: 'citizen', select: 'name email phone' },
  { path: 'assignedTo', select: 'name email phone department' },
];

/** Hides citizen identity when the complaint was filed anonymously. */
function sanitize(complaint, viewer) {
  const obj = complaint.toJSON ? complaint.toJSON() : complaint;
  const isOwner = viewer && obj.citizen && String(obj.citizen._id || obj.citizen) === String(viewer._id);
  if (obj.isAnonymous && !isOwner && viewer?.role !== 'admin') {
    obj.citizen = { name: 'Anonymous Citizen' };
    const hide = (e) => (e.byRole === 'citizen' ? { ...e, by: undefined, byName: 'Citizen' } : e);
    obj.timeline = (obj.timeline || []).map(hide);
    obj.comments = (obj.comments || []).map(hide);
  }
  obj.supportCount = (obj.supporters || []).length;
  obj.supportedByMe = viewer ? (obj.supporters || []).some((s) => String(s) === String(viewer._id)) : false;
  return obj;
}

function canView(c, user) {
  if (user.role === 'admin') return true;
  if (user.role === 'staff') return c.department === user.department || String(c.assignedTo?._id || c.assignedTo) === String(user._id);
  return String(c.citizen?._id || c.citizen) === String(user._id) || (c.supporters || []).some((s) => String(s) === String(user._id));
}

// =====================================================================
// PUBLIC
// =====================================================================

// GET /api/complaints/track/:grievanceId – public tracking, no login needed
router.get('/track/:grievanceId', async (req, res) => {
  const c = await Complaint.findOne({ grievanceId: req.params.grievanceId.toUpperCase().trim() }).populate('assignedTo', 'name department');
  if (!c) return res.status(404).json({ message: 'No complaint found with this number' });
  res.json({
    grievanceId: c.grievanceId,
    title: c.title,
    category: c.category,
    department: c.department,
    priority: c.priority,
    status: c.status,
    location: { address: c.location.address, ward: c.location.ward },
    officer: c.assignedTo ? c.assignedTo.name : null,
    isEscalated: c.isEscalated,
    slaDeadline: c.slaDeadline,
    supportCount: c.supporters.length,
    createdAt: c.createdAt,
    resolvedAt: c.resolvedAt,
    // v3: before / after photos and GPS verification of the fix
    beforePhoto: c.media.find((m) => !/\.(mp4|webm|mov|mkv)$/i.test(m)) || null,
    afterPhoto: c.resolutionProof.find((m) => !/\.(mp4|webm|mov|mkv)$/i.test(m)) || null,
    resolutionVerified: c.resolutionVerified,
    timeline: c.timeline.map((t) => ({ status: t.status, note: t.note, byRole: t.byRole, at: t.at })),
  });
});

// =====================================================================
// CITIZEN
// =====================================================================

// POST /api/complaints/check-duplicates – called before submission
router.post('/check-duplicates', protect, async (req, res) => {
  const { lat, lng, category, mediaHashes } = req.body;
  const nearby = await findNearbyDuplicates({ lat: Number(lat), lng: Number(lng), category });
  const photoMatch = await findPhotoReuse(parseHashes(mediaHashes));
  res.json({ count: nearby.length, nearby, photoMatch });
});

// POST /api/complaints – submit a new complaint (multipart/form-data, field "media")
router.post('/', protect, authorize('citizen'), upload.array('media', 5), async (req, res) => {
  const { title, description, address, ward } = req.body;
  const lat = Number(req.body.lat);
  const lng = Number(req.body.lng);
  if (!title || !description) return res.status(400).json({ message: 'Title and description are required' });
  if (Number.isNaN(lat) || Number.isNaN(lng)) return res.status(400).json({ message: 'Please pick the location on the map' });

  // 1. AI prediction (category + priority)
  const ai = analyze(`${title}. ${description}`);
  const category = CATEGORIES[req.body.category] ? req.body.category : ai.category;
  const department = CATEGORIES[category];
  const priority = category === ai.category ? ai.priority : predictPriority(`${title}. ${description}`, category).priority;

  // 2. Duplicate clustering
  const dups = await findNearbyDuplicates({ lat, lng, category });
  const duplicateOf = dups.length ? dups[0].duplicateOf || dups[0]._id : null;

  // 3. v3: same-photo check (perceptual hash) + photo EXIF info
  const mediaHashes = parseHashes(req.body.mediaHashes);
  const photoMatch = await findPhotoReuse(mediaHashes);
  const num = (v) => (v === undefined || v === '' || Number.isNaN(Number(v)) ? undefined : Number(v));
  const photoMeta = {
    lat: num(req.body.photoLat),
    lng: num(req.body.photoLng),
    takenAt: req.body.photoTakenAt && !Number.isNaN(Date.parse(req.body.photoTakenAt)) ? new Date(req.body.photoTakenAt) : undefined,
    usedForLocation: req.body.photoLocationUsed === 'true',
  };

  const now = new Date();
  const complaint = new Complaint({
    grievanceId: await nextGrievanceId(now),
    title,
    description,
    category,
    department,
    priority,
    location: { address, ward, lat, lng },
    media: fileUrls(req.files),
    mediaHashes,
    photoMeta,
    photoMatch: photoMatch ? { complaint: photoMatch.complaint, grievanceId: photoMatch.grievanceId, bitsDifferent: photoMatch.bitsDifferent } : undefined,
    citizen: req.user._id,
    isAnonymous: req.body.isAnonymous === 'true' || req.body.isAnonymous === true,
    aiPrediction: { category: ai.category, priority: ai.priority, confidence: ai.confidence, overridden: category !== ai.category },
    slaDeadline: computeDeadline(priority, now),
    duplicateOf,
    timeline: [
      { status: 'Submitted', note: 'Complaint registered by citizen', by: req.user._id, byName: req.user.name, byRole: 'citizen' },
      { status: 'Submitted', note: `Auto-routed to ${department} (AI confidence ${Math.round(ai.confidence * 100)}%), priority ${priority}`, byName: 'Smart Router', byRole: 'system' },
    ],
  });
  if (photoMeta.usedForLocation) {
    complaint.timeline.push({ status: 'Submitted', note: 'Location taken automatically from the photo\'s GPS data', byName: 'Photo Reader', byRole: 'system' });
  }
  if (photoMatch) {
    complaint.timeline.push({ status: 'Submitted', note: `⚠ Same photo was already used in ${photoMatch.grievanceId} – flagged for review`, byName: 'Photo Check', byRole: 'system' });
  }
  if (duplicateOf) {
    complaint.timeline.push({ status: 'Submitted', note: `Linked to nearby similar complaint (${dups[0].distance} m away)`, byName: 'Duplicate Detector', byRole: 'system' });
  }

  // 4. v3: smart auto-assignment to the NEAREST worker with the lightest workload
  if (process.env.AUTO_ASSIGN !== 'false') {
    const best = await pickBestWorker(department, { lat, lng });
    if (best) {
      const officer = best.worker;
      complaint.assignedTo = officer._id;
      complaint.status = 'Assigned';
      complaint.assignmentInfo = { method: 'auto', distanceKm: best.distanceKm, activeTasks: best.activeTasks, at: now };
      const why = best.distanceKm != null ? `${best.distanceKm} km from their base, ${best.activeTasks} active task(s)` : `${best.activeTasks} active task(s)`;
      complaint.timeline.push({ status: 'Assigned', note: `Auto-assigned to ${officer.name} – nearest available worker (${why})`, byName: 'Smart Router', byRole: 'system' });
    }
  }

  await complaint.save();

  await notifyUser(req.user._id, `Your complaint ${complaint.grievanceId} has been registered and routed to ${department}.`, { type: 'status', complaint });
  if (complaint.assignedTo) await notifyUser(complaint.assignedTo, `New ${priority} priority complaint ${complaint.grievanceId} assigned to you: ${title}`, { type: 'assignment', complaint });
  if (photoMatch) await notifyAdmins(`📷 ${complaint.grievanceId} reuses a photo from ${photoMatch.grievanceId} – please verify`, { type: 'escalation', complaint });
  if (priority === 'Critical') await notifyAdmins(`🚨 Critical complaint ${complaint.grievanceId}: ${title}`, { type: 'escalation', complaint });
  broadcastUpdate(complaint);

  res.status(201).json({ complaint, ai, duplicates: dups.length, photoMatch });
});

// GET /api/complaints/mine – citizen's own history (+ ones they supported)
router.get('/mine', protect, async (req, res) => {
  const list = await Complaint.find({ $or: [{ citizen: req.user._id }, { supporters: req.user._id }] })
    .populate(POPULATE)
    .sort({ createdAt: -1 });
  res.json(list.map((c) => sanitize(c, req.user)));
});

// POST /api/complaints/:id/support – "I'm also affected" (toggle)
router.post('/:id/support', protect, authorize('citizen'), async (req, res) => {
  const c = await Complaint.findById(req.params.id);
  if (!c) return res.status(404).json({ message: 'Complaint not found' });
  if (String(c.citizen) === String(req.user._id)) return res.status(400).json({ message: 'You cannot support your own complaint' });

  const idx = c.supporters.findIndex((s) => String(s) === String(req.user._id));
  if (idx >= 0) {
    c.supporters.splice(idx, 1);
  } else {
    c.supporters.push(req.user._id);
    if (c.supporters.length === SUPPORT_BOOST_THRESHOLD && OPEN_STATUSES.includes(c.status)) {
      const p = PRIORITIES.indexOf(c.priority);
      if (p < PRIORITIES.length - 1) {
        c.priority = PRIORITIES[p + 1];
        c.timeline.push({ status: c.status, note: `Priority raised to ${c.priority} – ${SUPPORT_BOOST_THRESHOLD} citizens reported the same issue`, byName: 'Community Support', byRole: 'system' });
      }
    }
    await notifyUser(c.citizen, `Another citizen supported your complaint ${c.grievanceId} (${c.supporters.length} supporters).`, { type: 'support', complaint: c });
  }
  await c.save();
  broadcastUpdate(c);
  res.json({ supportCount: c.supporters.length, supportedByMe: idx < 0, priority: c.priority });
});

// POST /api/complaints/:id/feedback – rate after resolution, or reopen
router.post('/:id/feedback', protect, authorize('citizen'), async (req, res) => {
  const { rating, comment, reopen } = req.body;
  const c = await Complaint.findById(req.params.id);
  if (!c) return res.status(404).json({ message: 'Complaint not found' });
  if (String(c.citizen) !== String(req.user._id)) return res.status(403).json({ message: 'Only the complainant can give feedback' });
  if (c.status !== 'Resolved') return res.status(400).json({ message: 'Feedback is allowed only after the complaint is resolved' });

  if (reopen) {
    c.status = 'Reopened';
    c.reopenCount += 1;
    c.slaDeadline = computeDeadline(c.priority);
    c.isEscalated = false;
    c.escalationLevel = 0;
    c.timeline.push({ status: 'Reopened', note: `Citizen not satisfied: ${comment || 'issue persists'}`, by: req.user._id, byName: req.user.name, byRole: 'citizen' });
    if (c.assignedTo) await notifyUser(c.assignedTo, `${c.grievanceId} was reopened by the citizen.`, { type: 'status', complaint: c });
    await notifyAdmins(`${c.grievanceId} reopened by citizen (not satisfied).`, { type: 'status', complaint: c });
  } else {
    const r = Number(rating);
    if (!(r >= 1 && r <= 5)) return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    c.feedback = { rating: r, comment, at: new Date() };
    c.status = 'Closed';
    c.closedAt = new Date();
    c.timeline.push({ status: 'Closed', note: `Citizen rated ${r}★${comment ? ` – "${comment}"` : ''}`, by: req.user._id, byName: req.user.name, byRole: 'citizen' });
    if (c.assignedTo) await notifyUser(c.assignedTo, `${c.grievanceId} closed with ${r}★ rating.`, { type: 'feedback', complaint: c });
  }
  await c.save();
  broadcastUpdate(c);
  res.json(sanitize(await c.populate(POPULATE), req.user));
});

// =====================================================================
// STAFF (Department officers)
// =====================================================================

// GET /api/complaints/staff/queue – my assignments + unassigned in my department
router.get('/staff/queue', protect, authorize('staff'), async (req, res) => {
  const list = await Complaint.find({
    $or: [{ assignedTo: req.user._id }, { department: req.user.department, assignedTo: null, status: { $in: OPEN_STATUSES } }],
  })
    .populate(POPULATE)
    .sort({ isEscalated: -1, slaDeadline: 1 });
  res.json(list.map((c) => sanitize(c, req.user)));
});

// GET /api/complaints/staff/route?lat=&lng= – v3: today's optimised visiting order
router.get('/staff/route', protect, authorize('staff'), async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const base = req.user.baseLocation || {};
  const hasGps = !Number.isNaN(lat) && !Number.isNaN(lng) && req.query.lat !== undefined;
  const start = hasGps ? { lat, lng, label: 'Your current location' } : base.lat != null
    ? { lat: base.lat, lng: base.lng, label: `${base.ward || 'Base'} office` }
    : null;
  const tasks = await Complaint.find({ assignedTo: req.user._id, status: { $in: OPEN_STATUSES } }).populate(POPULATE);
  if (!start && tasks.length) {
    return res.json({ start: { ...tasks[0].location.toObject(), label: 'First task' }, ...planRoute(tasks[0].location, tasks) });
  }
  const plan = planRoute(start || { lat: 13.04, lng: 80.2 }, tasks);
  res.json({ start, stops: plan.stops.map((s) => ({ ...s, complaint: sanitize(s.complaint, req.user) })), totalKm: plan.totalKm });
});

// PATCH /api/complaints/:id/checkin – v3: worker records GPS position at the site
router.patch('/:id/checkin', protect, authorize('staff'), async (req, res) => {
  const lat = Number(req.body.lat);
  const lng = Number(req.body.lng);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return res.status(400).json({ message: 'Turn on location (GPS) to check in at the site' });
  const c = await Complaint.findById(req.params.id);
  if (!c) return res.status(404).json({ message: 'Complaint not found' });
  if (String(c.assignedTo) !== String(req.user._id)) return res.status(403).json({ message: 'This complaint is not assigned to you' });
  if (!['Assigned', 'In Progress', 'Reopened'].includes(c.status)) return res.status(400).json({ message: `Cannot check in on a complaint that is ${c.status}` });

  const distanceM = Math.round(haversineMeters(lat, lng, c.location.lat, c.location.lng));
  const verified = distanceM <= SITE_VERIFY_RADIUS_M;
  c.siteVisit = { lat, lng, distanceM, verified, at: new Date() };
  c.timeline.push({
    status: c.status,
    note: verified
      ? `📍 Worker checked in at the site (GPS verified, ${distanceM} m from the reported spot)`
      : `📍 Worker check-in NOT verified – ${distanceM >= 1000 ? `${(distanceM / 1000).toFixed(1)} km` : `${distanceM} m`} away from the reported spot`,
    by: req.user._id, byName: req.user.name, byRole: 'staff',
  });
  await c.save();
  if (verified) await notifyUser(c.citizen, `A worker has reached the location of ${c.grievanceId}.`, { type: 'status', complaint: c });
  broadcastUpdate(c);
  res.json(sanitize(await c.populate(POPULATE), req.user));
});

// PATCH /api/complaints/:id/accept – staff accepts the task → In Progress
router.patch('/:id/accept', protect, authorize('staff'), async (req, res) => {
  const c = await Complaint.findById(req.params.id);
  if (!c) return res.status(404).json({ message: 'Complaint not found' });
  if (c.department !== req.user.department) return res.status(403).json({ message: 'This complaint belongs to another department' });
  if (c.assignedTo && String(c.assignedTo) !== String(req.user._id)) return res.status(403).json({ message: 'Already assigned to another worker' });
  if (!['Submitted', 'Assigned', 'Reopened'].includes(c.status)) return res.status(400).json({ message: `Cannot accept a complaint that is ${c.status}` });

  if (!c.assignedTo) c.assignmentInfo = { method: 'self', at: new Date() };
  c.assignedTo = req.user._id;
  c.status = 'In Progress';
  c.acceptedAt = new Date();
  c.timeline.push({ status: 'In Progress', note: req.body.note || 'Worker accepted the task and started work', by: req.user._id, byName: req.user.name, byRole: 'staff' });
  await c.save();
  await notifyUser(c.citizen, `Work has started on your complaint ${c.grievanceId}.`, { type: 'status', complaint: c });
  broadcastUpdate(c);
  res.json(sanitize(await c.populate(POPULATE), req.user));
});

// PATCH /api/complaints/:id/progress – staff posts a progress update, or resolves with proof
router.patch('/:id/progress', protect, authorize('staff'), upload.array('proof', 5), async (req, res) => {
  const { note, resolve } = req.body;
  const c = await Complaint.findById(req.params.id);
  if (!c) return res.status(404).json({ message: 'Complaint not found' });
  if (String(c.assignedTo) !== String(req.user._id)) return res.status(403).json({ message: 'This complaint is not assigned to you' });
  if (c.status !== 'In Progress') return res.status(400).json({ message: 'Accept the complaint before updating progress' });

  const isResolve = resolve === 'true' || resolve === true;
  if (isResolve) {
    if (!req.files?.length) return res.status(400).json({ message: 'Upload at least one photo as proof of resolution' });
    c.resolutionProof.push(...fileUrls(req.files));
    c.status = 'Resolved';
    c.resolvedAt = new Date();
    // v3: the fix counts as GPS-verified only if the worker checked in on site during this job
    // (a check-in made before a "Reopened" event belongs to the old attempt and does not count)
    const reopened = [...c.timeline].reverse().find((t) => t.status === 'Reopened');
    const since = reopened?.at || c.createdAt;
    c.resolutionVerified = Boolean(c.siteVisit?.verified && c.siteVisit.at >= since);
    const tag = c.resolutionVerified ? ' (✔ GPS-verified on site)' : ' (not verified on site)';
    c.timeline.push({ status: 'Resolved', note: `${note || 'Issue resolved, proof uploaded'}${tag}`, by: req.user._id, byName: req.user.name, byRole: 'staff' });
    await notifyUser(c.citizen, `✅ Your complaint ${c.grievanceId} has been resolved. Please rate the service.`, { type: 'status', complaint: c });
  } else {
    if (!note) return res.status(400).json({ message: 'Progress note is required' });
    if (req.files?.length) c.resolutionProof.push(...fileUrls(req.files));
    c.timeline.push({ status: 'In Progress', note, by: req.user._id, byName: req.user.name, byRole: 'staff' });
    await notifyUser(c.citizen, `Update on ${c.grievanceId}: ${note}`, { type: 'status', complaint: c });
  }
  await c.save();
  broadcastUpdate(c);
  res.json(sanitize(await c.populate(POPULATE), req.user));
});

// =====================================================================
// ADMIN
// =====================================================================

// GET /api/complaints – list with filters & search
router.get('/', protect, authorize('admin', 'staff'), async (req, res) => {
  const { status, category, department, priority, escalated, q, from, to } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (category) filter.category = category;
  if (priority) filter.priority = priority;
  if (escalated === 'true') filter.isEscalated = true;
  if (req.query.flag === 'photo') filter['photoMatch.grievanceId'] = { $exists: true };
  if (req.query.flag === 'unverified') filter.resolutionVerified = false;
  if (req.user.role === 'staff') filter.department = req.user.department;
  else if (department) filter.department = department;
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(`${to}T23:59:59`);
  }
  let list = await Complaint.find(filter).populate(POPULATE).sort({ createdAt: -1 });
  if (q) {
    const needle = q.toLowerCase();
    list = list.filter((c) => [c.grievanceId, c.title, c.location?.address, c.location?.ward].some((v) => (v || '').toLowerCase().includes(needle)));
  }
  res.json(list.map((c) => sanitize(c, req.user)));
});

// PATCH /api/complaints/:id/assign – admin assigns / reassigns to an officer
router.patch('/:id/assign', protect, authorize('admin'), async (req, res) => {
  const { staffId } = req.body;
  const [c, officer] = await Promise.all([Complaint.findById(req.params.id), User.findById(staffId)]);
  if (!c) return res.status(404).json({ message: 'Complaint not found' });
  if (!officer || officer.role !== 'staff') return res.status(400).json({ message: 'Select a valid worker' });

  const previous = c.assignedTo;
  c.assignedTo = officer._id;
  const ranked = await rankWorkers(null, c.location);
  const info = ranked.find((r) => String(r.worker._id) === String(officer._id));
  c.assignmentInfo = { method: 'admin', distanceKm: info?.distanceKm, activeTasks: info?.activeTasks, at: new Date() };
  if (['Submitted', 'Reopened'].includes(c.status)) c.status = 'Assigned';
  if (officer.department !== c.department) {
    c.timeline.push({ status: c.status, note: `Re-routed from ${c.department} to ${officer.department}`, by: req.user._id, byName: req.user.name, byRole: 'admin' });
    c.department = officer.department;
  }
  c.timeline.push({ status: c.status, note: `Assigned to ${officer.name}${info?.distanceKm != null ? ` (${info.distanceKm} km away)` : ''}`, by: req.user._id, byName: req.user.name, byRole: 'admin' });
  await c.save();

  await notifyUser(officer._id, `Complaint ${c.grievanceId} assigned to you by admin.`, { type: 'assignment', complaint: c });
  if (previous && String(previous) !== String(officer._id)) await notifyUser(previous, `${c.grievanceId} was reassigned to another worker.`, { type: 'assignment', complaint: c });
  await notifyUser(c.citizen, `Your complaint ${c.grievanceId} has been assigned to a worker.`, { type: 'status', complaint: c });
  broadcastUpdate(c);
  res.json(sanitize(await c.populate(POPULATE), req.user));
});

// PATCH /api/complaints/:id/priority – admin changes priority (SLA recalculated)
router.patch('/:id/priority', protect, authorize('admin'), async (req, res) => {
  const { priority } = req.body;
  if (!PRIORITIES.includes(priority)) return res.status(400).json({ message: 'Invalid priority' });
  const c = await Complaint.findById(req.params.id);
  if (!c) return res.status(404).json({ message: 'Complaint not found' });

  c.timeline.push({ status: c.status, note: `Priority changed ${c.priority} → ${priority}; SLA recalculated`, by: req.user._id, byName: req.user.name, byRole: 'admin' });
  c.priority = priority;
  c.slaDeadline = computeDeadline(priority, c.createdAt);
  await c.save();
  broadcastUpdate(c);
  res.json(sanitize(await c.populate(POPULATE), req.user));
});

// PATCH /api/complaints/:id/reject – admin rejects invalid/spam complaint
router.patch('/:id/reject', protect, authorize('admin'), async (req, res) => {
  const { reason } = req.body;
  if (!reason) return res.status(400).json({ message: 'Reason is required' });
  const c = await Complaint.findById(req.params.id);
  if (!c) return res.status(404).json({ message: 'Complaint not found' });
  c.status = 'Rejected';
  c.timeline.push({ status: 'Rejected', note: reason, by: req.user._id, byName: req.user.name, byRole: 'admin' });
  await c.save();
  await notifyUser(c.citizen, `Your complaint ${c.grievanceId} was rejected: ${reason}`, { type: 'status', complaint: c });
  broadcastUpdate(c);
  res.json(sanitize(await c.populate(POPULATE), req.user));
});

// =====================================================================
// SHARED
// =====================================================================

// GET /api/complaints/:id – full details
router.get('/:id', protect, async (req, res) => {
  const c = await Complaint.findById(req.params.id).populate(POPULATE).populate('duplicateOf', 'grievanceId title status');
  if (!c) return res.status(404).json({ message: 'Complaint not found' });
  if (!canView(c, req.user)) return res.status(403).json({ message: 'You cannot view this complaint' });
  // v3: workers ranked by distance + workload, so the admin sees the best choice first
  if (req.user.role === 'admin') {
    const ranked = (await rankWorkers(null, c.location))
      .sort((x, y) => (y.worker.department === c.department) - (x.worker.department === c.department) || x.score - y.score);
    const nearby = await findNearbyDuplicates({ lat: c.location.lat, lng: c.location.lng, category: c.category, excludeId: c._id });
    return res.json({
      ...sanitize(c, req.user),
      related: nearby.slice(0, 5),
      workerOptions: ranked.map((r, i) => ({ recommended: i === 0 && r.worker.department === c.department, _id: r.worker._id, name: r.worker.name, department: r.worker.department, distanceKm: r.distanceKm, activeTasks: r.activeTasks })),
    });
  }
  if (!c) return res.status(404).json({ message: 'Complaint not found' });
  if (!canView(c, req.user)) return res.status(403).json({ message: 'You cannot view this complaint' });

  const nearby = await findNearbyDuplicates({ lat: c.location.lat, lng: c.location.lng, category: c.category, excludeId: c._id });
  res.json({ ...sanitize(c, req.user), related: nearby.slice(0, 5) });
});

// POST /api/complaints/:id/comments – conversation between citizen and officials
router.post('/:id/comments', protect, async (req, res) => {
  const text = (req.body.text || '').trim();
  if (!text) return res.status(400).json({ message: 'Message cannot be empty' });
  const c = await Complaint.findById(req.params.id);
  if (!c) return res.status(404).json({ message: 'Complaint not found' });
  if (!canView(c, req.user)) return res.status(403).json({ message: 'Not allowed' });

  c.comments.push({ by: req.user._id, byName: req.user.name, byRole: req.user.role, text });
  await c.save();

  const msg = `💬 New message on ${c.grievanceId} from ${req.user.role === 'citizen' ? 'citizen' : req.user.name}`;
  if (req.user.role === 'citizen') {
    if (c.assignedTo) await notifyUser(c.assignedTo, msg, { type: 'comment', complaint: c });
  } else {
    await notifyUser(c.citizen, msg, { type: 'comment', complaint: c });
  }
  broadcastUpdate(c);
  res.status(201).json(c.comments[c.comments.length - 1]);
});

module.exports = router;
