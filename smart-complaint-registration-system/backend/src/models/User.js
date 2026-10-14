const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { DEPARTMENTS } = require('../config/constants');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    password: { type: String, required: true, minlength: 6, select: false },
    role: { type: String, enum: ['citizen', 'staff', 'admin'], default: 'citizen' },
    // Only for staff (department officers)
    department: { type: String, enum: [...DEPARTMENTS, null], default: null },
    // v3: worker's base office / depot – used for nearest-worker assignment & route planning
    baseLocation: {
      ward: String,
      lat: Number,
      lng: Number,
    },
    preferredLanguage: { type: String, enum: ['en', 'ta'], default: 'en' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.matchPassword = function matchPassword(plain) {
  return bcrypt.compare(plain, this.password);
};

userSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    _id: this._id,
    name: this.name,
    email: this.email,
    phone: this.phone,
    role: this.role,
    department: this.department,
    // v3: worker's base office / depot – used for nearest-worker assignment & route planning
    baseLocation: {
      ward: String,
      lat: Number,
      lng: Number,
    },
    preferredLanguage: this.preferredLanguage,
  };
};

module.exports = mongoose.model('User', userSchema);
