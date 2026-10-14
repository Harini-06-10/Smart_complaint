/**
 * SLA Engine – runs in the background and auto-escalates any complaint that
 * has crossed its resolution deadline without being resolved.
 *   Level 1 → overdue: flagged, admin + citizen notified
 *   Level 2 → overdue by 24h more: priority raised, admin alerted again
 */
const Complaint = require('../models/Complaint');
const { SLA_HOURS, OPEN_STATUSES, PRIORITIES } = require('../config/constants');
const { notifyUser, notifyAdmins, broadcastUpdate } = require('./notify');

function computeDeadline(priority, from = new Date()) {
  const hours = SLA_HOURS[priority] || SLA_HOURS.Medium;
  return new Date(from.getTime() + hours * 3600 * 1000);
}

async function runSlaCheck() {
  const now = new Date();
  const overdue = await Complaint.find({
    status: { $in: OPEN_STATUSES },
    slaDeadline: { $lt: now },
  });

  let escalated = 0;
  for (const c of overdue) {
    const hoursLate = (now - c.slaDeadline) / 3600000;
    const targetLevel = hoursLate >= 24 ? 2 : 1;
    if (c.escalationLevel >= targetLevel) continue;

    c.isEscalated = true;
    c.escalatedAt = c.escalatedAt || now;
    c.escalationLevel = targetLevel;

    let note = `Auto-escalated (Level ${targetLevel}): SLA deadline crossed by ${Math.floor(hoursLate)}h`;
    if (targetLevel === 2) {
      const idx = PRIORITIES.indexOf(c.priority);
      if (idx < PRIORITIES.length - 1) {
        c.priority = PRIORITIES[idx + 1];
        note += `; priority raised to ${c.priority}`;
      }
    }
    c.timeline.push({ status: c.status, note, byName: 'SLA Engine', byRole: 'system' });
    await c.save();
    escalated += 1;

    await notifyAdmins(`⚠️ ${c.grievanceId} escalated to Level ${targetLevel} – SLA breached (${c.department})`, {
      type: 'escalation',
      complaint: c,
    });
    if (c.assignedTo) {
      await notifyUser(c.assignedTo, `⚠️ ${c.grievanceId} is overdue and has been escalated. Please act immediately.`, {
        type: 'escalation',
        complaint: c,
      });
    }
    await notifyUser(c.citizen, `Your complaint ${c.grievanceId} has been escalated to higher authorities for faster action.`, {
      type: 'escalation',
      complaint: c,
    });
    broadcastUpdate(c);
  }
  if (escalated) console.log(`⏱  SLA engine escalated ${escalated} complaint(s)`);
}

function startSlaEngine() {
  const seconds = Number(process.env.SLA_CHECK_INTERVAL || 60);
  setTimeout(() => runSlaCheck().catch(console.error), 3000);
  setInterval(() => runSlaCheck().catch(console.error), seconds * 1000);
  console.log(`⏱  SLA engine running every ${seconds}s`);
}

module.exports = { computeDeadline, runSlaCheck, startSlaEngine };
