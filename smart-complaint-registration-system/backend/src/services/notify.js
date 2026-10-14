const Notification = require('../models/Notification');
const User = require('../models/User');

let io = null;

function setIO(socketServer) {
  io = socketServer;
}

/** Saves a notification and pushes it live over Socket.IO to the user. */
async function notifyUser(userId, message, { type = 'info', complaint = null } = {}) {
  if (!userId) return null;
  const doc = await Notification.create({
    user: userId,
    message,
    type,
    complaint: complaint?._id || null,
    grievanceId: complaint?.grievanceId,
  });
  if (io) io.to(`user:${userId}`).emit('notification', doc);
  return doc;
}

async function notifyAdmins(message, opts) {
  const admins = await User.find({ role: 'admin' }).select('_id');
  await Promise.all(admins.map((a) => notifyUser(a._id, message, opts)));
}

/** Tells every open dashboard that a complaint changed so lists refresh live. */
function broadcastUpdate(complaint) {
  if (io && complaint) io.emit('complaint:updated', { _id: complaint._id, grievanceId: complaint.grievanceId, status: complaint.status });
}

module.exports = { setIO, notifyUser, notifyAdmins, broadcastUpdate };
