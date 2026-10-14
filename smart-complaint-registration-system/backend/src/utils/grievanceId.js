const Counter = require('../models/Counter');

/** Generates sequential IDs like CMP-2026-000042 (one sequence per year). */
async function nextGrievanceId(date = new Date()) {
  const year = date.getFullYear();
  const counter = await Counter.findOneAndUpdate(
    { _id: `grievance-${year}` },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `CMP-${year}-${String(counter.seq).padStart(6, '0')}`;
}

module.exports = { nextGrievanceId };
