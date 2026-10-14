/**
 * Demo data seeder.
 *   npm run seed           → wipes the database and loads fresh demo data
 * The server also calls seedDatabase() automatically on first start (empty DB).
 */
require('dotenv').config();
const User = require('./models/User');
const Complaint = require('./models/Complaint');
const Notification = require('./models/Notification');
const Counter = require('./models/Counter');
const { CATEGORIES, SLA_HOURS } = require('./config/constants');
const { analyze } = require('./services/aiClassifier');
const { haversineMeters } = require('./utils/geo');
const { nextGrievanceId } = require('./utils/grievanceId');

// Deterministic pseudo-random generator so every seed looks the same
let s = 42;
const rand = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

const AREAS = [
  { ward: 'T. Nagar', address: 'Usman Road, T. Nagar, Chennai', lat: 13.0418, lng: 80.2341 },
  { ward: 'Anna Nagar', address: '2nd Avenue, Anna Nagar, Chennai', lat: 13.085, lng: 80.2101 },
  { ward: 'Adyar', address: 'LB Road, Adyar, Chennai', lat: 13.0012, lng: 80.2565 },
  { ward: 'Velachery', address: 'Velachery Main Road, Chennai', lat: 12.9815, lng: 80.218 },
  { ward: 'Tambaram', address: 'GST Road, Tambaram, Chennai', lat: 12.9249, lng: 80.1 },
  { ward: 'Avadi', address: 'Avadi Market Road, Avadi', lat: 13.1067, lng: 80.097 },
  { ward: 'Poonamallee', address: 'Trunk Road, Poonamallee', lat: 13.0473, lng: 80.0945 },
  { ward: 'Thiruvallur', address: 'JN Road, Thiruvallur', lat: 13.1231, lng: 79.912 },
  { ward: 'Mylapore', address: 'Luz Church Road, Mylapore, Chennai', lat: 13.0339, lng: 80.2619 },
  { ward: 'Guindy', address: 'Race Course Road, Guindy, Chennai', lat: 13.0067, lng: 80.2206 },
  { ward: 'Porur', address: 'Arcot Road, Porur, Chennai', lat: 13.0382, lng: 80.1565 },
  { ward: 'Ambattur', address: 'CTH Road, Ambattur, Chennai', lat: 13.1143, lng: 80.1548 },
];

const TEMPLATES = [
  ['Huge pothole near bus stop', 'Deep pothole on the main road near the bus stop, two wheelers are falling at night.'],
  ['Road surface damaged after rain', 'The tar road is completely broken and uneven after the rains, very difficult to drive.'],
  ['Garbage not collected for a week', 'Garbage is piled up on the street corner and not collected for days, foul smell and stray dogs.'],
  ['Overflowing waste bin near market', 'Waste bin overflowing near the market, mosquitoes breeding everywhere.'],
  ['Drainage blocked, sewage on road', 'Drainage is blocked and sewage water is overflowing onto the road near houses.'],
  ['Drinking water pipe leaking', 'Drinking water pipeline burst near the junction, water flowing on road continuously for days.'],
  ['Street lights not working', 'Street lights not working on the whole street, dark at night and unsafe for women.'],
  ['Live electric wire hanging low', 'A live electric wire is hanging low near the school, children may get electrocuted. Dangerous!'],
  ['Traffic signal not working', 'Traffic signal at the junction is not working causing heavy jam on the main road.'],
  ['Tree fallen on the road', 'A big tree fell on the road after the storm and is blocking traffic.'],
  ['Bus shelter roof broken', 'The bus shelter roof is broken and the seats are damaged, people stand in the sun.'],
  ['Park bench and wall damaged', 'Park bench broken and compound wall of the park collapsed.'],
  ['Open manhole on street', 'Manhole is open and sewage water flowing, someone may fall in.'],
  ['Streetlight flickering', 'Streetlamp flickering and switched off since last week near the temple.'],
];

const RESOLVE_NOTES = ['Repair completed by maintenance team', 'Area cleaned and waste cleared', 'Replaced faulty component; working now', 'Pipeline joint repaired and tested'];
const FEEDBACK = [[5, 'Very quick action, thank you!'], [4, 'Good work, slightly delayed'], [5, 'Excellent response'], [3, 'Fixed but took long'], [2, 'Work quality not great']];

async function seedDatabase({ wipe = false } = {}) {
  if (wipe) {
    await Promise.all([User.deleteMany({}), Complaint.deleteMany({}), Notification.deleteMany({}), Counter.deleteMany({})]);
  }

  // ---------------- Users ----------------
  const admin = await User.create({ name: 'Municipal Authority', email: 'admin@scrs.in', password: 'admin123', role: 'admin', phone: '9840000001' });
  const area = (ward) => AREAS.find((a) => a.ward === ward);
  // Field workers, each with a base office (used for nearest-worker assignment & route planning)
  const staffSeed = [
    ['Ravi Kumar', 'ravi@scrs.in', 'Roads & Highways', 'T. Nagar'],
    ['Suresh Babu', 'suresh@scrs.in', 'Roads & Highways', 'Tambaram'],
    ['Lakshmi Priya', 'lakshmi@scrs.in', 'Solid Waste Management', 'Anna Nagar'],
    ['Gokul R', 'gokul@scrs.in', 'Solid Waste Management', 'Velachery'],
    ['Arun Prakash', 'arun@scrs.in', 'Electricity & Street Lights', 'Guindy'],
    ['Meena Devi', 'meena@scrs.in', 'Water Supply & Sewerage', 'Mylapore'],
    ['Karthik Raja', 'karthik@scrs.in', 'Traffic & Transport', 'Porur'],
    ['Divya S', 'divya@scrs.in', 'Parks & Horticulture', 'Adyar'],
    ['Vignesh M', 'vignesh@scrs.in', 'Public Works', 'Ambattur'],
  ];
  const staff = [];
  for (const [name, email, department, ward] of staffSeed) {
    const a = area(ward);
    staff.push(await User.create({
      name, email, password: 'worker123', role: 'staff', department, phone: `98400${10000 + staff.length}`,
      baseLocation: { ward, lat: a.lat, lng: a.lng },
    }));
  }
  const nearestWorker = (department, loc) => staff
    .filter((st) => st.department === department)
    .map((st) => ({ st, km: haversineMeters(loc.lat, loc.lng, st.baseLocation.lat, st.baseLocation.lng) / 1000 }))
    .sort((a, b) => a.km - b.km)[0];
  const citizenSeed = [
    ['Bavani K', 'citizen@demo.com'], ['Bhavya B', 'bhavya@demo.com'], ['Harini B', 'harini@demo.com'],
    ['Rahul S', 'rahul@demo.com'], ['Priya R', 'priya@demo.com'],
  ];
  const citizens = [];
  for (const [name, email] of citizenSeed) {
    citizens.push(await User.create({ name, email, password: 'citizen123', role: 'citizen', phone: `9500${100000 + citizens.length}` }));
  }

  // ---------------- Complaints ----------------
  const now = Date.now();
  const H = 3600 * 1000;
  const plans = [];
  // Older history (resolved/closed) spread over last ~5 months
  for (let i = 0; i < 30; i += 1) plans.push({ ageH: 24 * (6 + rand() * 150), outcome: rand() < 0.75 ? 'Closed' : 'Resolved' });
  // Recent, still open – within SLA
  for (let i = 0; i < 10; i += 1) plans.push({ ageH: 2 + rand() * 30, outcome: pick(['Assigned', 'In Progress', 'Submitted', 'Assigned']) });
  // Overdue (will be auto-escalated by the SLA engine)
  for (let i = 0; i < 4; i += 1) plans.push({ ageH: 24 * (4 + rand() * 4), outcome: pick(['Assigned', 'In Progress']) });
  plans.push({ ageH: 24 * 25, outcome: 'Rejected' });
  plans.sort((a, b) => b.ageH - a.ageH);

  let n = 0;
  for (const plan of plans) {
    const [title, description] = pick(TEMPLATES);
    const area = pick(AREAS);
    const ai = analyze(`${title}. ${description}`);
    const department = CATEGORIES[ai.category];
    const createdAt = new Date(now - plan.ageH * H);
    const citizen = citizens[n % citizens.length];
    const jitter = () => (rand() - 0.5) * 0.02;

    const c = new Complaint({
      grievanceId: await nextGrievanceId(createdAt),
      title, description,
      category: ai.category, department, priority: ai.priority,
      location: { address: area.address, ward: area.ward, lat: area.lat + jitter(), lng: area.lng + jitter() },
      citizen: citizen._id,
      isAnonymous: n % 9 === 4,
      aiPrediction: { category: ai.category, priority: ai.priority, confidence: ai.confidence, overridden: false },
      slaDeadline: new Date(createdAt.getTime() + SLA_HOURS[ai.priority] * H),
      createdAt, updatedAt: createdAt,
      timeline: [
        { status: 'Submitted', note: 'Complaint registered by citizen', by: citizen._id, byName: citizen.name, byRole: 'citizen', at: createdAt },
        { status: 'Submitted', note: `Auto-routed to ${department} (AI confidence ${Math.round(ai.confidence * 100)}%), priority ${ai.priority}`, byName: 'Smart Router', byRole: 'system', at: createdAt },
      ],
    });

    const t = (h) => new Date(createdAt.getTime() + h * H);
    const best = nearestWorker(department, c.location);
    const officer = best?.st;
    if (plan.outcome !== 'Submitted' && plan.outcome !== 'Rejected' && officer) {
      const km = Math.round(best.km * 10) / 10;
      c.assignedTo = officer._id; c.status = 'Assigned';
      c.assignmentInfo = { method: 'auto', distanceKm: km, activeTasks: 0, at: t(0.01) };
      c.timeline.push({ status: 'Assigned', note: `Auto-assigned to ${officer.name} – nearest available worker (${km} km from their base)`, byName: 'Smart Router', byRole: 'system', at: t(0.01) });
    }
    if (['In Progress', 'Resolved', 'Closed'].includes(plan.outcome) && officer) {
      c.status = 'In Progress'; c.acceptedAt = t(2);
      c.timeline.push({ status: 'In Progress', note: 'Worker accepted the task and started work', by: officer._id, byName: officer.name, byRole: 'staff', at: t(2) });
    }
    if (['Resolved', 'Closed'].includes(plan.outcome) && officer) {
      const took = SLA_HOURS[ai.priority] * (0.3 + rand() * 1.1); // some breach SLA
      // Most workers checked in on site (GPS verified); a few did not
      const verified = rand() < 0.8;
      const off = verified ? 0.0004 : 0.03;
      const distanceM = Math.round(haversineMeters(c.location.lat, c.location.lng, c.location.lat + off, c.location.lng));
      c.siteVisit = { lat: c.location.lat + off, lng: c.location.lng, distanceM, verified, at: t(took - 0.5) };
      c.resolutionVerified = verified;
      c.timeline.push({ status: 'In Progress', note: verified ? `📍 Worker checked in at the site (GPS verified, ${distanceM} m from the reported spot)` : `📍 Worker check-in NOT verified – ${(distanceM / 1000).toFixed(1)} km away from the reported spot`, by: officer._id, byName: officer.name, byRole: 'staff', at: t(took - 0.5) });
      c.status = 'Resolved'; c.resolvedAt = t(took);
      c.timeline.push({ status: 'Resolved', note: `${pick(RESOLVE_NOTES)}${verified ? ' (✔ GPS-verified on site)' : ' (not verified on site)'}`, by: officer._id, byName: officer.name, byRole: 'staff', at: t(took) });
      if (plan.outcome === 'Closed') {
        const [rating, comment] = pick(FEEDBACK);
        c.status = 'Closed'; c.closedAt = t(took + 5); c.feedback = { rating, comment, at: t(took + 5) };
        c.timeline.push({ status: 'Closed', note: `Citizen rated ${rating}★ – "${comment}"`, by: citizen._id, byName: citizen.name, byRole: 'citizen', at: t(took + 5) });
      }
    }
    if (plan.outcome === 'Rejected') {
      c.status = 'Rejected';
      c.timeline.push({ status: 'Rejected', note: 'Duplicate of an already resolved private-property issue', by: admin._id, byName: admin.name, byRole: 'admin', at: t(5) });
    }
    if (n % 4 === 0) c.supporters = citizens.filter((x) => String(x._id) !== String(citizen._id)).slice(0, 1 + (n % 3)).map((x) => x._id);
    if (c.status === 'In Progress' && n % 2 === 0) {
      c.comments.push({ by: citizen._id, byName: citizen.name, byRole: 'citizen', text: 'Any update on this? The problem is getting worse.', at: t(3) });
      c.comments.push({ by: officer._id, byName: officer.name, byRole: 'staff', text: 'Team has been scheduled, work will be completed shortly.', at: t(4) });
    }
    await c.save({ timestamps: false });
    n += 1;
  }

  // A small duplicate cluster for the demo (3 reports of the same pothole in Velachery)
  const velachery = AREAS[3];
  const roadsOfficer = nearestWorker('Roads & Highways', velachery).st;
  let parent = null;
  for (let i = 0; i < 3; i += 1) {
    const createdAt = new Date(now - (10 - i * 3) * H);
    const ai = analyze('Huge pothole near Velachery bus stand, vehicles getting damaged');
    const c = await Complaint.create({
      grievanceId: await nextGrievanceId(createdAt),
      title: i === 0 ? 'Huge pothole near Velachery bus stand' : 'Pothole near bus stand again',
      description: 'Big pothole near Velachery bus stand, vehicles getting damaged and traffic slows down.',
      category: 'Pothole', department: 'Roads & Highways', priority: ai.priority, status: 'Assigned',
      assignedTo: roadsOfficer._id,
      location: { address: 'Bus Stand, Velachery Main Road, Chennai', ward: 'Velachery', lat: velachery.lat + 0.0005 * i, lng: velachery.lng + 0.0004 * i },
      citizen: citizens[i]._id,
      slaDeadline: new Date(createdAt.getTime() + SLA_HOURS[ai.priority] * H),
      duplicateOf: parent ? parent._id : null,
      aiPrediction: { category: ai.category, priority: ai.priority, confidence: ai.confidence, overridden: false },
      timeline: [
        { status: 'Submitted', note: 'Complaint registered by citizen', by: citizens[i]._id, byName: citizens[i].name, byRole: 'citizen', at: createdAt },
        ...(parent ? [{ status: 'Submitted', note: 'Linked to nearby similar complaint', byName: 'Duplicate Detector', byRole: 'system', at: createdAt }] : []),
        { status: 'Assigned', note: `Auto-assigned to ${roadsOfficer.name} – nearest available worker`, byName: 'Smart Router', byRole: 'system', at: createdAt },
      ],
      createdAt,
    });
    if (!parent) parent = c;
  }

  // Welcome notifications
  await Notification.create([
    { user: citizens[0]._id, message: 'Welcome to the Smart Complaint Registration System! Track all your complaints here.', type: 'info' },
    { user: admin._id, message: 'Demo data loaded. SLA engine will auto-escalate overdue complaints shortly.', type: 'info' },
  ]);

  const total = await Complaint.countDocuments();
  console.log(`🌱 Seeded ${await User.countDocuments()} users and ${total} complaints`);
}

module.exports = { seedDatabase };

// Run directly: `npm run seed`
if (require.main === module) {
  const { connectDB, disconnectDB } = require('./config/db');
  (async () => {
    // The built-in database is a file owned by the running server – reset it from there
    const net = require('net');
    const port = Number(process.env.PORT || 5000);
    const running = await new Promise((resolve) => {
      const sock = net.connect(port, '127.0.0.1');
      sock.once('connect', () => { sock.destroy(); resolve(true); });
      sock.once('error', () => resolve(false));
    });
    if (running) {
      console.log(`⚠️  The server is running on port ${port}. Stop it first (Ctrl+C in that terminal), then run "npm run seed" again.`);
      process.exit(1);
    }
    await connectDB();
    await seedDatabase({ wipe: true });
    await disconnectDB();
    console.log('Done. Start the server with: npm run dev');
    process.exit(0);
  })().catch((e) => { console.error(e); process.exit(1); });
}
