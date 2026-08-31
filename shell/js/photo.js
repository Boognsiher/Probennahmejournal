// Foto-Komprimierung vor Upload (Performance) — Baustellenfotos aus dem
// Kamera-Input können mehrere MB gross sein, was auf mobiler/langsamer
// Verbindung Uploads spürbar verlangsamt. Wir brauchen die Fotos nur zur
// Dokumentation (Anzeige im Journal, im PDF-Bericht), nicht in Originalgrösse
// — daher vor dem Hochladen auf eine sinnvolle Kantenlänge verkleinern und
// als JPEG mit moderater Qualität re-encodieren. Schlägt die Kompression aus
// irgendeinem Grund fehl (z.B. Browser ohne createImageBitmap), wird
// unverändert das Original verwendet — nie ein Foto verlieren.
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;

export async function compressImage(file, { maxDimension = MAX_DIMENSION, quality = JPEG_QUALITY } = {}) {
  if (!(file instanceof Blob) || !file.type?.startsWith('image/') || file.type === 'image/svg+xml') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob || blob.size >= file.size) return file; // Original war schon kleiner/effizienter
    const name = (file.name || 'foto').replace(/\.\w+$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg', lastModified: file.lastModified || Date.now() });
  } catch (err) {
    console.warn('Fotokompression fehlgeschlagen, verwende Original:', err);
    return file;
  }
}
