const mongoose = require('mongoose');
const { startEmbeddedDb, DATA_FILE } = require('./embeddedDb');

let embedded = null;

/**
 * Connects to the database.
 * 1. If MONGO_URI is set (local MongoDB / MongoDB Atlas) and reachable → use it.
 * 2. Otherwise start the BUILT-IN database (pure JavaScript, nothing to install).
 *    Data is saved in backend/.data/scrs_db.json.
 * Set USE_BUILTIN_DB=true in backend/.env to always use the built-in database.
 */
async function connectDB() {
  const uri = process.env.MONGO_URI;
  const forceBuiltin = String(process.env.USE_BUILTIN_DB).toLowerCase() === 'true';

  if (uri && !forceBuiltin) {
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 2500 });
      console.log(`✅ MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
      return;
    } catch (err) {
      console.log(`ℹ️  MongoDB not found at ${uri} – using the built-in database instead (no install needed).`);
      await mongoose.disconnect().catch(() => {});
    }
  }

  embedded = await startEmbeddedDb('scrs_db');
  await mongoose.connect(embedded.uri, { serverSelectionTimeoutMS: 5000 });
  console.log(`✅ Built-in database ready (data saved in ${DATA_FILE})`);
}

async function disconnectDB() {
  await mongoose.disconnect();
  if (embedded) {
    embedded.flush();
    embedded.server.close();
  }
}

module.exports = { connectDB, disconnectDB };
