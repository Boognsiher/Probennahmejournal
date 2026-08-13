import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { db, uploadsDir } from '../db.js';
import { requireAuth } from '../auth.js';

export const entriesRouter = Router();
entriesRouter.use(requireAuth);

const maxUploadBytes = (Number(process.env.MAX_UPLOAD_MB) || 15) * 1024 * 1024;
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || '').slice(0, 10) || guessExt(file.mimetype);
      cb(null, `${randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: maxUploadBytes },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      return cb(new Error('Nur Bilddateien sind erlaubt.'));
    }
    cb(null, true);
  },
});

function guessExt(mimetype) {
  const map = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/heic': '.heic', 'image/gif': '.gif' };
  return map[mimetype] || '';
}

function rowToEntry(row) {
  const photos = db.prepare('SELECT id, filename, originalName, mimeType, takenAt FROM photos WHERE entryId = ? ORDER BY takenAt')
    .all(row.id);
  return {
    id: row.id,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    baustelle: row.baustelle,
    probeBezeichnung: row.probeBezeichnung,
    entnahmeort: row.entnahmeort,
    gps: (row.gpsLat !== null && row.gpsLng !== null) ? { lat: row.gpsLat, lng: row.gpsLng } : null,
    material: row.material,
    probenehmer: row.probenehmer,
    bemerkungen: row.bemerkungen,
    analyse: JSON.parse(row.analyseJson || '[]'),
    klassifizierung: row.klassifizierungJson ? JSON.parse(row.klassifizierungJson) : null,
    createdBy: row.createdBy,
    photos,
  };
}

entriesRouter.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM entries ORDER BY createdAt DESC').all();
  res.json({ entries: rows.map(rowToEntry) });
});

entriesRouter.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM entries WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Probe nicht gefunden.' });
  res.json({ entry: rowToEntry(row) });
});

function upsertFields(body) {
  return {
    baustelle: body.baustelle ?? '',
    probeBezeichnung: body.probeBezeichnung ?? '',
    entnahmeort: body.entnahmeort ?? '',
    gpsLat: body.gps?.lat ?? null,
    gpsLng: body.gps?.lng ?? null,
    material: body.material ?? '',
    probenehmer: body.probenehmer ?? '',
    bemerkungen: body.bemerkungen ?? '',
    analyseJson: JSON.stringify(body.analyse ?? []),
    klassifizierungJson: body.klassifizierung ? JSON.stringify(body.klassifizierung) : null,
  };
}

entriesRouter.post('/', (req, res) => {
  const id = randomUUID();
  const now = new Date().toISOString();
  const f = upsertFields(req.body || {});
  db.prepare(`INSERT INTO entries
    (id, createdAt, updatedAt, baustelle, probeBezeichnung, entnahmeort, gpsLat, gpsLng, material, probenehmer, bemerkungen, analyseJson, klassifizierungJson, createdBy)
    VALUES (@id, @createdAt, @updatedAt, @baustelle, @probeBezeichnung, @entnahmeort, @gpsLat, @gpsLng, @material, @probenehmer, @bemerkungen, @analyseJson, @klassifizierungJson, @createdBy)`)
    .run({ id, createdAt: req.body?.createdAt || now, updatedAt: now, createdBy: req.user.id, ...f });
  const row = db.prepare('SELECT * FROM entries WHERE id = ?').get(id);
  res.status(201).json({ entry: rowToEntry(row) });
});

entriesRouter.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM entries WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Probe nicht gefunden.' });
  const f = upsertFields(req.body || {});
  db.prepare(`UPDATE entries SET
      baustelle=@baustelle, probeBezeichnung=@probeBezeichnung, entnahmeort=@entnahmeort,
      gpsLat=@gpsLat, gpsLng=@gpsLng, material=@material, probenehmer=@probenehmer,
      bemerkungen=@bemerkungen, analyseJson=@analyseJson, klassifizierungJson=@klassifizierungJson,
      updatedAt=@updatedAt
    WHERE id=@id`)
    .run({ id: req.params.id, updatedAt: new Date().toISOString(), ...f });
  const row = db.prepare('SELECT * FROM entries WHERE id = ?').get(req.params.id);
  res.json({ entry: rowToEntry(row) });
});

entriesRouter.delete('/:id', (req, res) => {
  const photos = db.prepare('SELECT filename FROM photos WHERE entryId = ?').all(req.params.id);
  const info = db.prepare('DELETE FROM entries WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Probe nicht gefunden.' });
  for (const p of photos) {
    fs.unlink(path.join(uploadsDir, p.filename), () => {});
  }
  res.status(204).end();
});

entriesRouter.post('/:id/photos', upload.array('photos', 20), (req, res) => {
  const entry = db.prepare('SELECT id FROM entries WHERE id = ?').get(req.params.id);
  if (!entry) return res.status(404).json({ error: 'Probe nicht gefunden.' });
  const now = new Date().toISOString();
  const inserted = [];
  const insertStmt = db.prepare('INSERT INTO photos (id, entryId, filename, originalName, mimeType, takenAt, uploadedBy) VALUES (?,?,?,?,?,?,?)');
  for (const file of req.files || []) {
    const id = randomUUID();
    insertStmt.run(id, req.params.id, file.filename, file.originalname, file.mimetype, now, req.user.id);
    inserted.push({ id, filename: file.filename, originalName: file.originalname, mimeType: file.mimetype, takenAt: now });
  }
  db.prepare('UPDATE entries SET updatedAt = ? WHERE id = ?').run(now, req.params.id);
  res.status(201).json({ photos: inserted });
});

entriesRouter.get('/:id/photos/:photoId/file', (req, res) => {
  const photo = db.prepare('SELECT * FROM photos WHERE id = ? AND entryId = ?').get(req.params.photoId, req.params.id);
  if (!photo) return res.status(404).end();
  const filePath = path.join(uploadsDir, photo.filename);
  if (!fs.existsSync(filePath)) return res.status(404).end();
  res.setHeader('Content-Type', photo.mimeType || 'application/octet-stream');
  res.setHeader('Cache-Control', 'private, max-age=86400');
  fs.createReadStream(filePath).pipe(res);
});

entriesRouter.delete('/:id/photos/:photoId', (req, res) => {
  const photo = db.prepare('SELECT * FROM photos WHERE id = ? AND entryId = ?').get(req.params.photoId, req.params.id);
  if (!photo) return res.status(404).json({ error: 'Foto nicht gefunden.' });
  db.prepare('DELETE FROM photos WHERE id = ?').run(req.params.photoId);
  fs.unlink(path.join(uploadsDir, photo.filename), () => {});
  res.status(204).end();
});

// Multer-Fehler (z.B. Dateigrösse, Dateityp) als lesbare JSON-Antwort statt Crash.
entriesRouter.use((err, req, res, next) => {
  if (err) return res.status(400).json({ error: err.message || 'Upload fehlgeschlagen.' });
  next();
});
