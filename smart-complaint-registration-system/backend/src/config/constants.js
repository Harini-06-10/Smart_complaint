/**
 * Central configuration for categories, departments, priorities and SLA rules.
 * Every complaint category is mapped to exactly one responsible department
 * so complaints can be routed automatically (no manual department selection).
 */

const DEPARTMENTS = [
  'Roads & Highways',
  'Solid Waste Management',
  'Electricity & Street Lights',
  'Water Supply & Sewerage',
  'Traffic & Transport',
  'Parks & Horticulture',
  'Public Works',
];

const CATEGORIES = {
  Pothole: 'Roads & Highways',
  'Road Damage': 'Roads & Highways',
  'Garbage Accumulation': 'Solid Waste Management',
  'Drainage Blockage': 'Water Supply & Sewerage',
  'Water Leakage': 'Water Supply & Sewerage',
  'Streetlight Not Working': 'Electricity & Street Lights',
  'Exposed Electric Wire': 'Electricity & Street Lights',
  'Traffic Signal Damage': 'Traffic & Transport',
  'Fallen Tree': 'Parks & Horticulture',
  'Damaged Public Property': 'Public Works',
  Other: 'Public Works',
};

const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];

// Service Level Agreement: hours allowed to resolve a complaint, by priority.
const SLA_HOURS = {
  Critical: 24,
  High: 48,
  Medium: 72,
  Low: 120,
};

const STATUSES = [
  'Submitted',
  'Assigned',
  'In Progress',
  'Resolved',
  'Closed',
  'Reopened',
  'Rejected',
];

// Statuses that mean "work is still pending"
const OPEN_STATUSES = ['Submitted', 'Assigned', 'In Progress', 'Reopened'];

// Radius (metres) inside which a same-category complaint is treated as a duplicate
const DUPLICATE_RADIUS_M = 250;

// Number of citizen "supports" that automatically raise the priority one level
const SUPPORT_BOOST_THRESHOLD = 3;

// ---------------- v3 additions ----------------
// A worker must be within this distance (metres) of the complaint to be "verified on site"
const SITE_VERIFY_RADIUS_M = 300;

// Two photo fingerprints (64-bit dHash) differing in at most this many bits = same photo
const PHOTO_HASH_THRESHOLD = 6;

// Smart assignment: score = distance (km) + LOAD_WEIGHT_KM x active tasks. Lowest score wins.
const LOAD_WEIGHT_KM = 2;

// Civic points awarded to citizens (gamification)
const POINTS = {
  reported: 10, // complaint accepted (not rejected)
  resolved: 15, // their complaint got fixed
  feedback: 5, // they rated the work
  supported: 3, // they supported someone else's complaint
  photo: 2, // added photo evidence
};

module.exports = {
  SITE_VERIFY_RADIUS_M,
  PHOTO_HASH_THRESHOLD,
  LOAD_WEIGHT_KM,
  POINTS,
  DEPARTMENTS,
  CATEGORIES,
  PRIORITIES,
  SLA_HOURS,
  STATUSES,
  OPEN_STATUSES,
  DUPLICATE_RADIUS_M,
  SUPPORT_BOOST_THRESHOLD,
};
