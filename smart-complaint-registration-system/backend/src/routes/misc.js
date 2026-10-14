/**
 * Smaller routes grouped together: AI, users/staff, notifications, meta, reports.
 */
const express = require('express');
const User = require('../models/User');
const Complaint = require('../models/Complaint');
const Notification = require('../models/Notification');
const { protect, authorize } = require('../middleware/auth');
const { analyze } = require('../services/aiClassifier');
const { DEPARTMENTS, CATEGORIES, PRIORITIES, STATUSES, SLA_HOURS, OPEN_STATUSES } = require('../config/constants');

// ------------------------------------------------------------------ AI
const ai = express.Router();
// POST /api/ai/analyze { text } → predicted category, department, priority, confidence
ai.post('/analyze', (req, res) => {
  const text = (req.body.text || '').trim();
  if (text.length < 5) return res.status(400).json({ message: 'Describe the issue in a few words' });
  res.json(analyze(text));
});

// ------------------------------------------------------------------ META
const meta = express.Router();
meta.get('/', (req, res) => res.json({ departments: DEPARTMENTS, categories: CATEGORIES, priorities: PRIORITIES, statuses: STATUSES, slaHours: SLA_HOURS }));

// ------------------------------------------------------------------ USERS
const users = express.Router();
users.use(protect, authorize('admin'));

// GET /api/users/staff – workers with current workload
users.get('/staff', async (req, res) => {
  const staff = await User.find({ role: 'staff' }).sort({ department: 1, name: 1 });
  const withLoad = await Promise.all(staff.map(async (s) => ({
    ...s.toSafeJSON(),
    activeTasks: await Complaint.countDocuments({ assignedTo: s._id, status: { $in: OPEN_STATUSES } }),
  })));
  res.json(withLoad);
});

// POST /api/users/staff – admin creates a department worker account
users.post('/staff', async (req, res) => {
  const { name, email, password, phone, department, baseWard, baseLat, baseLng } = req.body;
  if (!name || !email || !password || !DEPARTMENTS.includes(department)) {
    return res.status(400).json({ message: 'Name, email, password and a valid department are required' });
  }
  if (await User.findOne({ email: email.toLowerCase() })) return res.status(409).json({ message: 'Email already in use' });
  const baseLocation = baseLat !== undefined && baseLat !== '' && !Number.isNaN(Number(baseLat))
    ? { ward: baseWard, lat: Number(baseLat), lng: Number(baseLng) }
    : undefined;
  const user = await User.create({ name, email, password, phone, department, baseLocation, role: 'staff' });
  res.status(201).json(user.toSafeJSON());
});

// ------------------------------------------------------------------ NOTIFICATIONS
const notifications = express.Router();
notifications.use(protect);
notifications.get('/', async (req, res) => {
  const [items, unread] = await Promise.all([
    Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(30),
    Notification.countDocuments({ user: req.user._id, read: false }),
  ]);
  res.json({ items, unread });
});
notifications.patch('/read-all', async (req, res) => {
  await Notification.updateMany({ user: req.user._id, read: false }, { $set: { read: true } });
  res.json({ ok: true });
});

// ------------------------------------------------------------------ REPORTS
const reports = express.Router();
// GET /api/reports/complaints.csv – downloadable report (admin)
reports.get('/complaints.csv', protect, authorize('admin'), async (req, res) => {
  const filter = {};
  ['status', 'category', 'department', 'priority'].forEach((k) => { if (req.query[k]) filter[k] = req.query[k]; });
  const list = await Complaint.find(filter).populate('assignedTo', 'name').sort({ createdAt: -1 });

  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const fmt = (d) => (d ? new Date(d).toLocaleString('en-IN') : '');
  const header = ['Complaint ID', 'Title', 'Category', 'Department', 'Priority', 'Status', 'Address', 'Ward', 'Worker', 'Filed On', 'SLA Deadline', 'Resolved On', 'Escalated', 'Supporters', 'Rating', 'GPS-verified fix', 'Photo reused from'];
  const rows = list.map((c) => [
    c.grievanceId, c.title, c.category, c.department, c.priority, c.status, c.location?.address, c.location?.ward,
    c.assignedTo?.name, fmt(c.createdAt), fmt(c.slaDeadline), fmt(c.resolvedAt), c.isEscalated ? 'Yes' : 'No', c.supporters.length, c.feedback?.rating || '',
    c.resolutionVerified == null ? '' : c.resolutionVerified ? 'Yes' : 'No', c.photoMatch?.grievanceId || '',
  ].map(esc).join(','));

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="complaint-report-${Date.now()}.csv"`);
  res.send(`﻿${header.join(',')}\n${rows.join('\n')}`);
});

module.exports = { ai, meta, users, notifications, reports };
