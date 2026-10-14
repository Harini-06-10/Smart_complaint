/**
 * Photo fingerprint helpers (v3).
 * The browser computes a 64-bit "difference hash" (dHash) for every photo:
 * the image is shrunk to 9x8 grey pixels and each bit says whether a pixel is
 * brighter than its right neighbour. The same photo – even resized, re-compressed
 * or slightly brightened – gives almost the same 64 bits, so we can detect a
 * photo that was already used in another complaint.
 */
const HEX = /^[0-9a-f]{16}$/;

/** Accepts a JSON string or array from the client and keeps only valid hashes. */
function parseHashes(raw) {
  let arr = raw;
  if (typeof raw === 'string') {
    try { arr = JSON.parse(raw); } catch { arr = []; }
  }
  if (!Array.isArray(arr)) return [];
  return [...new Set(arr.map((h) => String(h).toLowerCase()).filter((h) => HEX.test(h)))].slice(0, 5);
}

/** Number of bits that differ between two 16-char hex hashes (0 = identical). */
function hammingDistance(a, b) {
  let bits = 0;
  for (let i = 0; i < 16; i += 4) {
    let x = parseInt(a.slice(i, i + 4), 16) ^ parseInt(b.slice(i, i + 4), 16);
    while (x) { bits += x & 1; x >>= 1; }
  }
  return bits;
}

/** Ignore almost-blank images (all bits equal) – they match everything. */
const isInformative = (h) => h !== '0000000000000000' && h !== 'ffffffffffffffff';

module.exports = { parseHashes, hammingDistance, isInformative };
