const mongoose = require('mongoose');
const { CATEGORIES, DEPARTMENTS, PRIORITIES, STATUSES } = require('../config/constants');

const timelineSchema = new mongoose.Schema(
  {
    status: String,
    note: String,
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    byName: String,
    byRole: String,
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const commentSchema = new mongoose.Schema({
  by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  byName: String,
  byRole: String,
  text: { type: String, required: true, maxlength: 1000 },
  at: { type: Date, default: Date.now },
});

const complaintSchema = new mongoose.Schema(
  {
    // Human-readable tracking number, e.g. GRV-2026-000123 (like CPGRAMS registration no.)
    grievanceId: { type: String, unique: true, index: true },

    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
    category: { type: String, enum: Object.keys(CATEGORIES), required: true },
    department: { type: String, enum: DEPARTMENTS, required: true },
    priority: { type: String, enum: PRIORITIES, default: 'Medium' },
    status: { type: String, enum: STATUSES, default: 'Submitted' },

    location: {
      address: { type: String, trim: true },
      ward: { type: String, trim: true },
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },

    media: [{ type: String }], // uploaded evidence (photo / video URLs)
    // v3: 64-bit perceptual fingerprints (dHash, 16 hex chars) of the citizen's photos
    mediaHashes: [{ type: String, match: /^[0-9a-f]{16}$/ }],
    // v3: set when the same photo was already used in another complaint (possible fake / copy)
    photoMatch: {
      complaint: { type: mongoose.Schema.Types.ObjectId, ref: 'Complaint' },
      grievanceId: String,
      bitsDifferent: Number,
    },
    // v3: GPS + time read from the photo's EXIF data in the browser
    photoMeta: {
      lat: Number,
      lng: Number,
      takenAt: Date,
      usedForLocation: { type: Boolean, default: false },
    },
    resolutionProof: [{ type: String }], // uploaded by staff on resolution

    citizen: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    isAnonymous: { type: Boolean, default: false },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    acceptedAt: Date,

    // v3: why this worker was chosen (nearest-worker smart assignment)
    assignmentInfo: {
      method: { type: String, enum: ['auto', 'admin', 'self'] },
      distanceKm: Number,
      activeTasks: Number,
      at: Date,
    },

    // v3: worker's GPS check-in at the complaint location
    siteVisit: {
      lat: Number,
      lng: Number,
      distanceM: Number,
      verified: Boolean,
      at: Date,
    },
    resolutionVerified: { type: Boolean, default: null }, // true = fixed while GPS-verified on site

    // AI prediction stored for transparency / audit
    aiPrediction: {
      category: String,
      priority: String,
      confidence: Number,
      overridden: Boolean,
    },

    // SLA & escalation
    slaDeadline: Date,
    isEscalated: { type: Boolean, default: false },
    escalatedAt: Date,
    escalationLevel: { type: Number, default: 0 },

    // Duplicate clustering & community support
    duplicateOf: { type: mongoose.Schema.Types.ObjectId, ref: 'Complaint', default: null },
    supporters: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    timeline: [timelineSchema],
    comments: [commentSchema],

    feedback: {
      rating: { type: Number, min: 1, max: 5 },
      comment: String,
      at: Date,
    },
    reopenCount: { type: Number, default: 0 },
    resolvedAt: Date,
    closedAt: Date,
  },
  { timestamps: true }
);

complaintSchema.virtual('supportCount').get(function supportCount() {
  return (this.supporters || []).length;
});

complaintSchema.set('toJSON', { virtuals: true });
complaintSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Complaint', complaintSchema);
