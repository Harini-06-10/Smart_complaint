/**
 * Built-in database (used only when MongoDB is not installed / not running).
 *
 * A tiny MongoDB-compatible server written in plain JavaScript. It speaks the
 * MongoDB wire protocol on a local port, so Mongoose talks to it exactly like a
 * real MongoDB. Queries and updates are executed by the "mingo" library and the
 * data is saved to backend/.data/scrs_db.json, so it survives restarts.
 *
 * Nothing to download or install – the project runs on any laptop with Node.js.
 * For production you would use real MongoDB / MongoDB Atlas (set MONGO_URI).
 */
const net = require('net');
const fs = require('fs');
const path = require('path');
const BSON = require('bson');
const mingo = require('mingo');
require('mingo/init/system'); // load all query, update and aggregation operators

const DATA_DIR = path.join(__dirname, '..', '..', '.data');
const DATA_FILE = path.join(DATA_DIR, 'scrs_db.json');

// --------------------------------------------------------------------- storage
let dbs = {}; // dbName -> collectionName -> array of documents
const coll = (db, name) => {
  dbs[db] = dbs[db] || {};
  dbs[db][name] = dbs[db][name] || [];
  return dbs[db][name];
};

// Internally ObjectIds are stored as tagged strings so mingo can compare them.
const OID = '\u0001oid:';
function toInt(v) {
  if (v === null || v === undefined) return v;
  if (Array.isArray(v)) return v.map(toInt);
  if (v instanceof Date || v instanceof RegExp) return v;
  if (typeof v === 'object') {
    if (v._bsontype === 'ObjectId' || v._bsontype === 'ObjectID') return OID + v.toHexString();
    if (v._bsontype === 'Int32' || v._bsontype === 'Double') return v.valueOf();
    if (v._bsontype === 'Long') return Number(v.toString());
    if (v._bsontype === 'BSONRegExp') return new RegExp(v.pattern, v.options);
    if (v._bsontype) return v;
    const o = {};
    Object.keys(v).forEach((k) => { o[k] = toInt(v[k]); });
    return o;
  }
  return v;
}
function fromInt(v) {
  if (v === null || v === undefined) return v;
  if (typeof v === 'string' && v.startsWith(OID)) return new BSON.ObjectId(v.slice(OID.length));
  if (Array.isArray(v)) return v.map(fromInt);
  if (v instanceof Date || v instanceof RegExp) return v;
  if (typeof v === 'object' && !v._bsontype) {
    const o = {};
    Object.keys(v).forEach((k) => { o[k] = fromInt(v[k]); });
    return o;
  }
  return v;
}

function load() {
  try {
    if (fs.existsSync(DATA_FILE)) dbs = toInt(BSON.EJSON.parse(fs.readFileSync(DATA_FILE, 'utf8'), { relaxed: false }));
  } catch (e) {
    console.warn('⚠️  Could not read saved data, starting with an empty database:', e.message);
    dbs = {};
  }
}
let saveTimer = null;
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 400);
}
function saveNow() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = `${DATA_FILE}.tmp`;
    fs.writeFileSync(tmp, BSON.EJSON.stringify(fromInt(dbs), { relaxed: false }));
    fs.renameSync(tmp, DATA_FILE);
  } catch (e) {
    console.warn('⚠️  Could not save data:', e.message);
  }
}

// --------------------------------------------------------------------- query helpers
function runFind(arr, filter = {}, { sort, skip, limit, projection } = {}) {
  let cur = new mingo.Query(toInt(filter || {})).find(arr);
  if (sort && Object.keys(sort).length) cur = cur.sort(sort);
  if (skip) cur = cur.skip(skip);
  if (limit) cur = cur.limit(Math.abs(limit));
  const docs = cur.all();
  if (projection && Object.keys(projection).length) return new mingo.Query({}).find(docs, projection).all();
  return docs;
}

function applyUpdate(doc, update, isInsert) {
  const u = toInt(update);
  if (!Object.keys(u).some((k) => k.startsWith('$'))) {
    // full replacement
    const id = doc._id;
    Object.keys(doc).forEach((k) => delete doc[k]);
    Object.assign(doc, u, { _id: id });
    return;
  }
  Object.entries(u).forEach(([op, value]) => {
    if (op === '$setOnInsert') { if (isInsert) mingo.update(doc, { $set: value }); return; }
    mingo.update(doc, { [op]: value });
  });
}

/** For upserts: start the new document from the equality parts of the filter. */
function seedFromFilter(filter) {
  const base = {};
  Object.entries(toInt(filter || {})).forEach(([k, v]) => {
    if (k.startsWith('$')) return;
    const isOperatorObj = v && typeof v === 'object' && !(v instanceof Date) && !Array.isArray(v) && Object.keys(v).some((x) => x.startsWith('$'));
    if (!isOperatorObj) mingo.update(base, { $set: { [k]: v } });
  });
  return base;
}
const newId = () => OID + new BSON.ObjectId().toHexString();
const cursor = (ns, docs) => ({ cursor: { id: BSON.Long.fromNumber(0), ns, firstBatch: docs.map(fromInt) }, ok: 1 });

// --------------------------------------------------------------------- commands
function command(db, c) {
  const name = Object.keys(c)[0];
  const ns = (n) => `${db}.${n}`;
  switch (name.toLowerCase()) {
    case 'hello':
    case 'ismaster':
      return {
        ismaster: true, helloOk: true, isWritablePrimary: true, maxBsonObjectSize: 16777216, maxMessageSizeBytes: 48000000,
        maxWriteBatchSize: 100000, localTime: new Date(), logicalSessionTimeoutMinutes: 30, connectionId: 1,
        minWireVersion: 0, maxWireVersion: 21, readOnly: false, ok: 1,
      };
    case 'ping': case 'endsessions': case 'killcursors': case 'createindexes': case 'create':
    case 'getparameter': case 'dropindexes': case 'abortransaction': case 'committransaction':
      return { ok: 1 };
    case 'buildinfo': return { version: '7.0.0', versionArray: [7, 0, 0, 0], ok: 1 };
    case 'listindexes': return cursor(ns(c[name]), [{ v: 2, key: { _id: 1 }, name: '_id_' }]);
    case 'listcollections': return cursor(`${db}.$cmd.listCollections`, Object.keys(dbs[db] || {}).map((n) => ({ name: n, type: 'collection', options: {}, info: { readOnly: false } })));
    case 'listdatabases': return { databases: Object.keys(dbs).map((n) => ({ name: n, sizeOnDisk: 0, empty: false })), ok: 1 };
    case 'drop': if (dbs[db]) delete dbs[db][c[name]]; scheduleSave(); return { ok: 1 };
    case 'dropdatabase': delete dbs[db]; scheduleSave(); return { ok: 1 };

    case 'find':
      return cursor(ns(c.find), runFind(coll(db, c.find), c.filter, c));
    case 'getmore':
      return { cursor: { id: BSON.Long.fromNumber(0), ns: ns(c.collection), nextBatch: [] }, ok: 1 };
    case 'count':
      return { n: runFind(coll(db, c.count), c.query, { skip: c.skip, limit: c.limit }).length, ok: 1 };
    case 'distinct':
      return { values: [...new Set(runFind(coll(db, c.distinct), c.query).map((d) => d[c.key]))].map(fromInt), ok: 1 };
    case 'aggregate':
      return cursor(ns(c.aggregate), new mingo.Aggregator(toInt(c.pipeline || [])).run(coll(db, c.aggregate)));

    case 'insert': {
      const arr = coll(db, c.insert);
      (c.documents || []).forEach((d) => {
        const doc = toInt(d);
        if (doc._id === undefined) doc._id = newId();
        arr.push(doc);
      });
      scheduleSave();
      return { n: (c.documents || []).length, ok: 1 };
    }
    case 'update': {
      const arr = coll(db, c.update);
      let n = 0; let nModified = 0; const upserted = [];
      (c.updates || []).forEach((u, index) => {
        const hits = runFind(arr, u.q);
        const targets = u.multi ? hits : hits.slice(0, 1);
        if (!targets.length && u.upsert) {
          const doc = seedFromFilter(u.q);
          applyUpdate(doc, u.u, true);
          if (doc._id === undefined) doc._id = newId();
          arr.push(doc); n += 1; upserted.push({ index, _id: fromInt(doc._id) });
          return;
        }
        targets.forEach((d) => { applyUpdate(d, u.u, false); n += 1; nModified += 1; });
      });
      scheduleSave();
      return upserted.length ? { n, nModified, upserted, ok: 1 } : { n, nModified, ok: 1 };
    }
    case 'delete': {
      const arr = coll(db, c.delete);
      let n = 0;
      (c.deletes || []).forEach((d) => {
        const hits = runFind(arr, d.q);
        (d.limit ? hits.slice(0, 1) : hits).forEach((h) => { arr.splice(arr.indexOf(h), 1); n += 1; });
      });
      scheduleSave();
      return { n, ok: 1 };
    }
    case 'findandmodify': {
      const arr = coll(db, c[name]);
      const [hit] = runFind(arr, c.query, { sort: c.sort });
      const project = (doc) => (c.fields && Object.keys(c.fields).length ? new mingo.Query({}).find([doc], c.fields).all()[0] : doc);
      if (c.remove) {
        if (hit) { arr.splice(arr.indexOf(hit), 1); scheduleSave(); }
        return { value: hit ? fromInt(hit) : null, lastErrorObject: { n: hit ? 1 : 0 }, ok: 1 };
      }
      if (hit) {
        const before = toInt(fromInt(hit));
        applyUpdate(hit, c.update, false);
        scheduleSave();
        return { value: fromInt(project(c.new ? hit : before)), lastErrorObject: { n: 1, updatedExisting: true }, ok: 1 };
      }
      if (c.upsert) {
        const doc = seedFromFilter(c.query);
        applyUpdate(doc, c.update, true);
        if (doc._id === undefined) doc._id = newId();
        arr.push(doc);
        scheduleSave();
        return { value: c.new ? fromInt(project(doc)) : null, lastErrorObject: { n: 1, updatedExisting: false, upserted: fromInt(doc._id) }, ok: 1 };
      }
      return { value: null, lastErrorObject: { n: 0, updatedExisting: false }, ok: 1 };
    }
    default:
      return { ok: 0, errmsg: `Command "${name}" is not supported by the built-in database`, code: 59 };
  }
}

// --------------------------------------------------------------------- wire protocol
function reply(socket, requestID, doc, legacy) {
  const body = BSON.serialize(doc);
  let head;
  if (legacy) { // OP_REPLY (answer to the driver's first OP_QUERY handshake)
    head = Buffer.alloc(36);
    head.writeInt32LE(36 + body.length, 0); head.writeInt32LE(0, 4); head.writeInt32LE(requestID, 8); head.writeInt32LE(1, 12);
    head.writeInt32LE(0, 16); head.writeBigInt64LE(0n, 20); head.writeInt32LE(0, 28); head.writeInt32LE(1, 32);
  } else { // OP_MSG
    head = Buffer.alloc(21);
    head.writeInt32LE(21 + body.length, 0); head.writeInt32LE(0, 4); head.writeInt32LE(requestID, 8); head.writeInt32LE(2013, 12);
    head.writeUInt32LE(0, 16); head.writeUInt8(0, 20);
  }
  socket.write(Buffer.concat([head, body]));
}

function handleMessage(socket, msg) {
  const requestID = msg.readInt32LE(4);
  const opCode = msg.readInt32LE(12);
  if (opCode === 2004) { // OP_QUERY
    let o = 20;
    const end = msg.indexOf(0, o);
    const fullName = msg.toString('utf8', o, end);
    o = end + 1 + 8;
    const len = msg.readInt32LE(o);
    const c = BSON.deserialize(msg.subarray(o, o + len));
    return reply(socket, requestID, command(fullName.split('.')[0], c), true);
  }
  if (opCode !== 2013) return undefined; // OP_MSG only

  const flags = msg.readUInt32LE(16);
  const limit = msg.length - (flags & 1 ? 4 : 0);
  let o = 20;
  let c = null;
  const sequences = {};
  while (o < limit) {
    const kind = msg.readUInt8(o); o += 1;
    const len = msg.readInt32LE(o);
    if (kind === 0) { c = BSON.deserialize(msg.subarray(o, o + len)); o += len; } else {
      const secEnd = o + len;
      let p = o + 4;
      const idEnd = msg.indexOf(0, p);
      const ident = msg.toString('utf8', p, idEnd);
      p = idEnd + 1;
      const docs = [];
      while (p < secEnd) { const dl = msg.readInt32LE(p); docs.push(BSON.deserialize(msg.subarray(p, p + dl))); p += dl; }
      sequences[ident] = docs;
      o = secEnd;
    }
  }
  Object.assign(c, sequences);
  const db = c.$db || 'test';
  ['$db', 'lsid', '$clusterTime', 'txnNumber', '$readPreference', 'writeConcern', 'readConcern', 'apiVersion', 'startTransaction', 'autocommit'].forEach((k) => delete c[k]);
  let res;
  try { res = command(db, c); } catch (e) { res = { ok: 0, errmsg: e.message, code: 1 }; }
  return reply(socket, requestID, res, false);
}

/** Starts the built-in database on a free local port and returns its connection URI. */
function startEmbeddedDb(dbName = 'scrs_db') {
  load();
  return new Promise((resolve, reject) => {
    const server = net.createServer((socket) => {
      let buf = Buffer.alloc(0);
      socket.on('data', (chunk) => {
        buf = Buffer.concat([buf, chunk]);
        while (buf.length >= 4 && buf.length >= buf.readInt32LE(0)) {
          const len = buf.readInt32LE(0);
          try { handleMessage(socket, buf.subarray(0, len)); } catch (e) { console.error('Built-in DB error:', e.message); }
          buf = buf.subarray(len);
        }
      });
      socket.on('error', () => {});
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      const flush = () => { clearTimeout(saveTimer); saveNow(); };
      process.on('exit', flush);
      ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGUSR2'].forEach((sig) => process.on(sig, () => { flush(); process.exit(0); }));
      resolve({ uri: `mongodb://127.0.0.1:${port}/${dbName}`, server, flush });
    });
  });
}

module.exports = { startEmbeddedDb, DATA_FILE };
