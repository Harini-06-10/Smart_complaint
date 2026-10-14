/**
 * v3: Civic Assistant – a rule-based chatbot (no paid AI API needed).
 * It understands a few intents in English and Tamil keywords:
 * tracking a complaint number, how to report, categories, deadlines,
 * points/badges, reopening, anonymity and live statistics.
 */
const express = require('express');
const Complaint = require('../models/Complaint');
const { CATEGORIES, SLA_HOURS, OPEN_STATUSES, POINTS } = require('../config/constants');

const router = express.Router();
const ID_RE = /\b(?:CMP|GRV)-\d{4}-\d{1,6}\b/i;
// ASCII words must match as whole words ("hi" should not match "which"); Tamil words match anywhere
const has = (text, words) => words.some((w) => (/^[\x00-\x7f]+$/.test(w)
  ? new RegExp(`(^|[^a-z])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${w.length <= 3 ? '($|[^a-z])' : ''}`).test(text)
  : text.includes(w)));

const SUGGESTIONS = ['How do I report a pothole?', 'Track CMP-2026-000001', 'How long will it take?', 'How do points work?'];

async function answer(raw) {
  const text = raw.toLowerCase();

  // 1. Tracking by complaint number
  const idMatch = raw.match(ID_RE);
  if (idMatch) {
    const [prefix, year, num] = idMatch[0].toUpperCase().split('-');
    const gid = `${prefix}-${year}-${num.padStart(6, '0')}`;
    const c = await Complaint.findOne({ grievanceId: gid }).populate('assignedTo', 'name');
    if (!c) return { reply: `I couldn't find ${gid}. Please check the number on your receipt.`, links: [{ label: 'Open tracking page', to: '/track' }] };
    const last = c.timeline[c.timeline.length - 1];
    let reply = `${gid} – "${c.title}" is **${c.status}**.`;
    if (c.assignedTo) reply += ` Assigned to ${c.assignedTo.name} (${c.department}).`;
    else reply += ` It is with ${c.department}.`;
    if (OPEN_STATUSES.includes(c.status) && c.slaDeadline) reply += ` Target date: ${c.slaDeadline.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}.`;
    if (c.resolutionVerified) reply += ' The fix was GPS-verified on site ✔.';
    if (last?.note) reply += ` Latest update: ${last.note}`;
    return { reply, links: [{ label: 'See full timeline', to: `/track/${gid}` }] };
  }
  if (has(text, ['track', 'status', 'where is my', 'நிலை', 'கண்காணி'])) {
    return { reply: 'Send me your complaint number (it looks like CMP-2026-000012) and I will tell you its status.', links: [{ label: 'Tracking page', to: '/track' }] };
  }

  // 2. How to report
  if (has(text, ['report', 'file', 'register', 'complain', 'raise', 'pothole', 'புகார்'])) {
    return {
      reply: 'Reporting takes under a minute:\n1. Log in and tap "Report a problem".\n2. Add a photo – if it has GPS, the map pin is placed for you.\n3. Describe it (or speak it). The category and department are suggested automatically.\n4. Submit – you get a complaint number and a QR receipt.',
      links: [{ label: 'Report a problem', to: '/citizen/new' }],
    };
  }

  // 3. Categories / departments
  if (has(text, ['category', 'categories', 'department', 'what can i', 'வகை', 'துறை'])) {
    const lines = Object.entries(CATEGORIES).map(([c, d]) => `• ${c} → ${d}`).join('\n');
    return { reply: `Each category is routed automatically:\n${lines}` };
  }

  // 4. Deadlines
  if (has(text, ['how long', 'time', 'deadline', 'sla', 'days', 'late', 'delay', 'நேரம்'])) {
    const lines = Object.entries(SLA_HOURS).map(([p, h]) => `• ${p}: ${h} hours`).join('\n');
    return { reply: `Target resolution time depends on priority:\n${lines}\nIf the deadline passes, the complaint is escalated to the authority automatically.` };
  }

  // 5. Points & badges
  if (has(text, ['point', 'badge', 'leaderboard', 'reward', 'rank'])) {
    return {
      reply: `You earn civic points: +${POINTS.reported} per valid complaint, +${POINTS.photo} for photo evidence, +${POINTS.resolved} when it gets fixed, +${POINTS.feedback} for rating the work and +${POINTS.supported} for supporting a neighbour's complaint. Points unlock badges and levels.`,
      links: [{ label: 'View leaderboard', to: '/leaderboard' }],
    };
  }

  // 6. Reopen / not satisfied
  if (has(text, ['reopen', 'not fixed', 'not satisfied', 'still there', 'again'])) {
    return { reply: 'When a complaint is marked Resolved, open it and compare the before/after photos. If it is not fixed, tap "Not fixed — reopen". The worker and authority are notified immediately.' };
  }

  // 7. Anonymous / privacy
  if (has(text, ['anonymous', 'privacy', 'my name', 'hide'])) {
    return { reply: 'Tick "File anonymously" on the form. Workers will see "Anonymous Citizen" instead of your name; only the authority can see who filed it.' };
  }

  // 8. Duplicate / same issue
  if (has(text, ['duplicate', 'same issue', 'already reported', 'someone else'])) {
    return { reply: 'When you drop the pin, I check for the same problem within 250 m. You can "Support" the existing complaint instead – 3 supporters raise its priority automatically.' };
  }

  // 9. Live statistics
  if (has(text, ['how many', 'stats', 'statistics', 'performance', 'resolved'])) {
    const [total, open, done] = await Promise.all([
      Complaint.countDocuments(),
      Complaint.countDocuments({ status: { $in: OPEN_STATUSES } }),
      Complaint.countDocuments({ status: { $in: ['Resolved', 'Closed'] } }),
    ]);
    return { reply: `Right now: ${total} complaints filed, ${done} resolved and ${open} being worked on.`, links: [{ label: 'Public dashboard', to: '/transparency' }] };
  }

  // 10. Greetings / help
  if (has(text, ['hi', 'hello', 'hey', 'help', 'வணக்கம்'])) {
    return { reply: 'Hello! I am the Civic Assistant. I can track a complaint, explain how to report a problem, and answer questions about deadlines and points.', suggestions: SUGGESTIONS };
  }

  return { reply: "Sorry, I didn't get that. Try one of these:", suggestions: SUGGESTIONS };
}

// POST /api/assistant { message }
router.post('/', async (req, res) => {
  const message = String(req.body.message || '').trim().slice(0, 300);
  if (!message) return res.status(400).json({ message: 'Type a question' });
  res.json(await answer(message));
});

module.exports = router;
