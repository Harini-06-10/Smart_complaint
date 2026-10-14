/**
 * v3 photo intelligence – runs fully in the browser.
 *  1. readPhotoGps(file)   → GPS + time from the photo's EXIF data (phones store this)
 *  2. photoFingerprint(file) → 64-bit "difference hash" used to spot a reused photo
 */
import exifr from 'exifr';

/** Returns { lat, lng, takenAt } or null if the photo has no location. */
export async function readPhotoGps(file) {
  if (!file?.type?.startsWith('image/')) return null;
  try {
    // read GPS + EXIF blocks only (skips thumbnails, XMP etc. for speed)
    const data = await exifr.parse(file, { gps: true, exif: true, tiff: true, xmp: false, icc: false, iptc: false, jfif: false, ihdr: false });
    if (!data || typeof data.latitude !== 'number' || typeof data.longitude !== 'number') return null;
    const takenAt = data.DateTimeOriginal || data.CreateDate || null;
    return { lat: data.latitude, lng: data.longitude, takenAt: takenAt instanceof Date ? takenAt : null };
  } catch {
    return null; // not a JPEG/HEIC with EXIF – that's fine
  }
}

/**
 * dHash: shrink to 9x8 greyscale, compare each pixel with its right neighbour.
 * 64 comparisons → 64 bits → 16 hex characters. Visually identical photos give
 * (almost) identical hashes even after resizing or re-compressing.
 */
export async function photoFingerprint(file) {
  if (!file?.type?.startsWith('image/')) return null;
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = 9;
    canvas.height = 8;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bitmap, 0, 0, 9, 8);
    const px = ctx.getImageData(0, 0, 9, 8).data;
    const grey = (x, y) => {
      const i = (y * 9 + x) * 4;
      return 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    };
    let hex = '';
    for (let y = 0; y < 8; y += 1) {
      let byte = 0;
      for (let x = 0; x < 8; x += 1) byte = (byte << 1) | (grey(x, y) > grey(x + 1, y) ? 1 : 0);
      hex += byte.toString(16).padStart(2, '0');
    }
    return hex;
  } catch {
    return null;
  }
}
