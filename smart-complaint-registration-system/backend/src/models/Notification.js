const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    message: { type: String, required: true },
    type: {
      type: String,
      enum: ['status', 'assignment', 'escalation', 'comment', 'feedback', 'support', 'info'],
      default: 'info',
    },
    complaint: { type: mongoose.Schema.Types.ObjectId, ref: 'Complaint' },
    grievanceId: String,
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notification', notificationSchema);
