import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { db, uploadsDir } from '../db.js';
import { requireAuth } from '../auth.js';
import { canViewProject, canWriteInProject, canManageProject } from './projects.js';

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
    projektId: row.projektId,
    baustelle: row.baustelle,
    probeBezeichnung: row.probeBezeichnung,
    entnahmeort: row.entnahmeort,
    gps: (row.gpsLat !== null && row.gpsLng !== null) ? { lat: row.gpsLat, lng: row.gpsLng } : null,
    material: row.material,
    probenehmer: row.probenehmer,
    bemerkungen: row.bemerkungen,
    analyse: JSON.parse(row.analyseJson || '[]'),
    klassifizierung: row.klassifizierungJson ? JSON.parse(row.klassifizierungJson) : null,
    standard: row.standard || 'vvea',
    nutzungsart: row.nutzungsart || null,
    entsorgungsweg: row.entsorgungsweg || '',
    vevaCode: row.vevaCode || '',
    menge: row.menge ?? null,
    mengeEinheit: row.mengeEinheit || 't',
    analytikProgramme: JSON.parse(row.analytikProgrammeJson || '[]'),
    labor: row.labor || '',
    externZugriff: JSON.parse(row.externZugriffJson || '[]'),
    deletionRequestedAt: row.deletionRequestedAt || null,
    deletionRequestedBy: row.deletionRequestedBy || null,
    createdBy: row.createdBy,
    photos,
  };
}

function sanitizeUserIds(list) {
  if (!Array.isArray(list)) return [];
  const known = new Set(db.prepare('SELECT id FROM users').all().map(u => u.id));
  return [...new Set(list.map(String))].filter(id => known.has(id));
}
function getProject(id) {
  return id ? db.prepare('SELECT * FROM projects WHERE id = ?').get(id) : null;
}

// Sichtbarkeit je Rolle (siehe auth.js/projects.js):
// - admin: alle Proben.
// - projektleiter: Proben in selbst erstellten Projekten.
// - probenehmer: Proben in Projekten, für die Zugriff gewährt wurde.
// - extern: NUR Proben, die einzeln über externZugriffJson freigegeben sind
//   (unabhängig vom Projekt-Zugriff — es gibt für "extern" keinen
//   Projekt-Scope).
function canViewEntry(row, user) {
  if (user.role === 'extern') return JSON.parse(row.externZugriffJson || '[]').includes(user.id);
  return canViewProject(getProject(row.projektId), user);
}
function visibleEntryRows(user) {
  const all = db.prepare('SELECT * FROM entries ORDER BY createdAt DESC').all();
  if (user.role === 'admin') return all;
  if (user.role === 'extern') return all.filter(r => JSON.parse(r.externZugriffJson || '[]').includes(user.id));
  const projects = db.prepare('SELECT * FROM projects').all();
  const projectById = new Map(projects.map(p => [p.id, p]));
  return all.filter(r => canViewProject(projectById.get(r.projektId), user));
}

entriesRouter.get('/', (req, res) => {
  res.json({ entries: visibleEntryRows(req.user).map(rowToEntry) });
});

entriesRouter.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM entries WHERE id = ?').get(req.params.id);
  if (!row || !canViewEntry(row, req.user)) return res.status(404).json({ error: 'Probe nicht gefunden.' });
  res.json({ entry: rowToEntry(row) });
});

function upsertFields(body, existingExternZugriff) {
  return {
    entnahmeort: body.entnahmeort ?? '',
    gpsLat: body.gps?.lat ?? null,
    gpsLng: body.gps?.lng ?? null,
    material: body.material ?? '',
    probenehmer: body.probenehmer ?? '',
    bemerkungen: body.bemerkungen ?? '',
    analyseJson: JSON.stringify(body.analyse ?? []),
    klassifizierungJson: body.klassifizierung ? JSON.stringify(body.klassifizierung) : null,
    standard: body.standard === 'vbbo' ? 'vbbo' : 'vvea',
    nutzungsart: body.standard === 'vbbo' ? (body.nutzungsart || null) : null,
    entsorgungsweg: body.entsorgungsweg ?? '',
    vevaCode: body.vevaCode ?? '',
    menge: (body.menge === '' || body.menge === undefined || body.menge === null || Number.isNaN(Number(body.menge))) ? null : Number(body.menge),
    mengeEinheit: body.mengeEinheit === 'm3' ? 'm3' : 't',
    analytikProgrammeJson: JSON.stringify(Array.isArray(body.analytikProgramme) ? body.analytikProgramme : []),
    labor: body.labor ?? '',
    // externZugriff darf nur setzen, wer die Probe auch verwaltet (siehe PUT-Handler unten:
    // dort wird bei fehlender canManageProject-Berechtigung der bisherige Wert beibehalten).
    externZugriffJson: JSON.stringify(sanitizeUserIds(body.externZugriff ?? existingExternZugriff ?? [])),
  };
}

// Chargenname (Probenbezeichnung) wird ausschliesslich serverseitig aus dem
// Projekt-Kürzel + fortlaufender Nummer vergeben — Client kann sie nicht setzen.
entriesRouter.post('/', (req, res) => {
  const projektId = req.body?.projektId;
  if (!projektId) return res.status(400).json({ error: 'Bitte zuerst ein Projekt auswählen.' });
  const project = getProject(projektId);
  if (!project) return res.status(400).json({ error: 'Projekt nicht gefunden.' });
  if (!canWriteInProject(project, req.user)) return res.status(403).json({ error: 'Dafür fehlt die Berechtigung.' });

  const seq = project.nextChargeNumber;
  const probeBezeichnung = `${project.kuerzel}-${String(seq).padStart(3, '0')}`;
  db.prepare('UPDATE projects SET nextChargeNumber = ? WHERE id = ?').run(seq + 1, project.id);

  const id = randomUUID();
  const now = new Date().toISOString();
  // externZugriff beim Anlegen nur übernehmen, wenn die anlegende Person auch
  // verwalten darf (admin/eigene Projektleitung) — Probenehmer/innen können
  // beim Erfassen keine externe Sichtbarkeit vergeben.
  const f = upsertFields(req.body || {}, canManageProject(project, req.user) ? undefined : []);
  db.prepare(`INSERT INTO entries
    (id, createdAt, updatedAt, projektId, baustelle, probeBezeichnung, entnahmeort, gpsLat, gpsLng, material, probenehmer, bemerkungen, analyseJson, klassifizierungJson, standard, nutzungsart, entsorgungsweg, vevaCode, menge, mengeEinheit, analytikProgrammeJson, labor, externZugriffJson, createdBy)
    VALUES (@id, @createdAt, @updatedAt, @projektId, @baustelle, @probeBezeichnung, @entnahmeort, @gpsLat, @gpsLng, @material, @probenehmer, @bemerkungen, @analyseJson, @klassifizierungJson, @standard, @nutzungsart, @entsorgungsweg, @vevaCode, @menge, @mengeEinheit, @analytikProgrammeJson, @labor, @externZugriffJson, @createdBy)`)
    .run({
      id, createdAt: req.body?.createdAt || now, updatedAt: now, createdBy: req.user.id,
      projektId: project.id, baustelle: project.name, probeBezeichnung, ...f,
    });
  const row = db.prepare('SELECT * FROM entries WHERE id = ?').get(id);
  res.status(201).json({ entry: rowToEntry(row) });
});

// Projekt und Chargenname sind nach dem Anlegen fix (Nachvollziehbarkeit der
// fortlaufenden Nummerierung) — ein PUT kann nur die übrigen Felder ändern.
entriesRouter.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM entries WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Probe nicht gefunden.' });
  const project = getProject(existing.projektId);
  if (!canWriteInProject(project, req.user)) return res.status(403).json({ error: 'Dafür fehlt die Berechtigung.' });

  const manage = canManageProject(project, req.user);
  const f = upsertFields(req.body || {}, manage ? undefined : JSON.parse(existing.externZugriffJson || '[]'));
  db.prepare(`UPDATE entries SET
      entnahmeort=@entnahmeort,
      gpsLat=@gpsLat, gpsLng=@gpsLng, material=@material, probenehmer=@probenehmer,
      bemerkungen=@bemerkungen, analyseJson=@analyseJson, klassifizierungJson=@klassifizierungJson,
      standard=@standard, nutzungsart=@nutzungsart, entsorgungsweg=@entsorgungsweg, vevaCode=@vevaCode,
      menge=@menge, mengeEinheit=@mengeEinheit, analytikProgrammeJson=@analytikProgrammeJson,
      labor=@labor, externZugriffJson=@externZugriffJson,
      updatedAt=@updatedAt
    WHERE id=@id`)
    .run({ id: req.params.id, updatedAt: new Date().toISOString(), ...f });
  const row = db.prepare('SELECT * FROM entries WHERE id = ?').get(req.params.id);
  res.json({ entry: rowToEntry(row) });
});

// Löschen: admin und die zuständige Projektleitung löschen sofort endgültig.
// Probenehmer/innen mit Schreibzugriff auf das Projekt können nur eine
// Löschung BEANTRAGEN (braucht Freigabe, siehe /approve-delete unten) — die
// Probe bleibt bis zur Entscheidung bestehen. Externe haben ohnehin nur
// Lesezugriff (canWriteInProject liefert für sie immer false).
entriesRouter.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM entries WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Probe nicht gefunden.' });
  const project = getProject(existing.projektId);

  if (canManageProject(project, req.user)) {
    const photos = db.prepare('SELECT filename FROM photos WHERE entryId = ?').all(req.params.id);
    db.prepare('DELETE FROM entries WHERE id = ?').run(req.params.id);
    for (const p of photos) fs.unlink(path.join(uploadsDir, p.filename), () => {});
    return res.status(204).end();
  }
  if (req.user.role === 'probenehmer' && canWriteInProject(project, req.user)) {
    db.prepare('UPDATE entries SET deletionRequestedAt=?, deletionRequestedBy=? WHERE id=?')
      .run(new Date().toISOString(), req.user.id, req.params.id);
    const row = db.prepare('SELECT * FROM entries WHERE id = ?').get(req.params.id);
    return res.status(202).json({ entry: rowToEntry(row), message: 'Löschung beantragt — braucht Freigabe der Projektleitung.' });
  }
  return res.status(403).json({ error: 'Dafür fehlt die Berechtigung.' });
});

// Löschantrag zurückziehen — die antragstellende Person selbst, oder wer die
// Probe ohnehin verwalten darf.
entriesRouter.post('/:id/cancel-delete-request', (req, res) => {
  const existing = db.prepare('SELECT * FROM entries WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Probe nicht gefunden.' });
  const project = getProject(existing.projektId);
  const isRequester = existing.deletionRequestedBy === req.user.id;
  if (!isRequester && !canManageProject(project, req.user)) return res.status(403).json({ error: 'Dafür fehlt die Berechtigung.' });
  db.prepare('UPDATE entries SET deletionRequestedAt=NULL, deletionRequestedBy=NULL WHERE id=?').run(req.params.id);
  const row = db.prepare('SELECT * FROM entries WHERE id = ?').get(req.params.id);
  res.json({ entry: rowToEntry(row) });
});

// Löschantrag freigeben (endgültig löschen) — nur admin/zuständige Projektleitung.
entriesRouter.post('/:id/approve-delete', (req, res) => {
  const existing = db.prepare('SELECT * FROM entries WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Probe nicht gefunden.' });
  const project = getProject(existing.projektId);
  if (!canManageProject(project, req.user)) return res.status(403).json({ error: 'Dafür fehlt die Berechtigung.' });
  if (!existing.deletionRequestedAt) return res.status(400).json({ error: 'Kein offener Löschantrag für diese Probe.' });
  const photos = db.prepare('SELECT filename FROM photos WHERE entryId = ?').all(req.params.id);
  db.prepare('DELETE FROM entries WHERE id = ?').run(req.params.id);
  for (const p of photos) fs.unlink(path.join(uploadsDir, p.filename), () => {});
  res.status(204).end();
});

// Löschantrag ablehnen (Probe bleibt, Markierung entfernt) — nur
// admin/zuständige Projektleitung.
entriesRouter.post('/:id/reject-delete', (req, res) => {
  const existing = db.prepare('SELECT * FROM entries WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Probe nicht gefunden.' });
  const project = getProject(existing.projektId);
  if (!canManageProject(project, req.user)) return res.status(403).json({ error: 'Dafür fehlt die Berechtigung.' });
  db.prepare('UPDATE entries SET deletionRequestedAt=NULL, deletionRequestedBy=NULL WHERE id=?').run(req.params.id);
  const row = db.prepare('SELECT * FROM entries WHERE id = ?').get(req.params.id);
  res.json({ entry: rowToEntry(row) });
});

entriesRouter.post('/:id/photos', upload.array('photos', 20), (req, res) => {
  const entry = db.prepare('SELECT * FROM entries WHERE id = ?').get(req.params.id);
  if (!entry) return res.status(404).json({ error: 'Probe nicht gefunden.' });
  if (!canWriteInProject(getProject(entry.projektId), req.user)) return res.status(403).json({ error: 'Dafür fehlt die Berechtigung.' });
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
  const entry = db.prepare('SELECT * FROM entries WHERE id = ?').get(req.params.id);
  if (!entry || !canViewEntry(entry, req.user)) return res.status(404).end();
  const photo = db.prepare('SELECT * FROM photos WHERE id = ? AND entryId = ?').get(req.params.photoId, req.params.id);
  if (!photo) return res.status(404).end();
  const filePath = path.join(uploadsDir, photo.filename);
  if (!fs.existsSync(filePath)) return res.status(404).end();
  res.setHeader('Content-Type', photo.mimeType || 'application/octet-stream');
  res.setHeader('Cache-Control', 'private, max-age=86400');
  fs.createReadStream(filePath).pipe(res);
});

entriesRouter.delete('/:id/photos/:photoId', (req, res) => {
  const entry = db.prepare('SELECT * FROM entries WHERE id = ?').get(req.params.id);
  if (!entry) return res.status(404).json({ error: 'Probe nicht gefunden.' });
  if (!canWriteInProject(getProject(entry.projektId), req.user)) return res.status(403).json({ error: 'Dafür fehlt die Berechtigung.' });
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
