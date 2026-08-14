import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';

export const projectsRouter = Router();
projectsRouter.use(requireAuth);

// Projekte sind organisatorische Stammdaten, keine sicherheitskritische
// Konfiguration — jede angemeldete Person darf sie anlegen/bearbeiten
// (anders als Benutzerverwaltung/Grenzwerte, die Admin-Rechte brauchen).

function rowToProject(row) {
  return {
    id: row.id, name: row.name, kuerzel: row.kuerzel,
    auftraggeber: row.auftraggeber, ort: row.ort, bemerkungen: row.bemerkungen,
    nextChargeNumber: row.nextChargeNumber, createdAt: row.createdAt,
    entsorgungswege: JSON.parse(row.entsorgungswegeJson || '[]'),
    entnahmeorte: JSON.parse(row.entnahmeorteJson || '[]'),
  };
}

function sanitizeList(list) {
  if (!Array.isArray(list)) return [];
  return list.map(s => String(s ?? '').trim()).filter(Boolean);
}

projectsRouter.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM projects ORDER BY name COLLATE NOCASE').all();
  res.json({ projects: rows.map(rowToProject) });
});

projectsRouter.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Projekt nicht gefunden.' });
  res.json({ project: rowToProject(row) });
});

function sanitizeKuerzel(k) {
  return String(k || '').toUpperCase().replace(/[^A-Z0-9\-]/g, '').slice(0, 12);
}

projectsRouter.post('/', (req, res) => {
  const { name, ort, auftraggeber, bemerkungen } = req.body || {};
  const kuerzel = sanitizeKuerzel(req.body?.kuerzel);
  if (!name || !kuerzel) return res.status(400).json({ error: 'Projektname und Kürzel sind erforderlich.' });
  const entsorgungswegeJson = JSON.stringify(sanitizeList(req.body?.entsorgungswege));
  const entnahmeorteJson = JSON.stringify(sanitizeList(req.body?.entnahmeorte));
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO projects (id, name, kuerzel, auftraggeber, ort, bemerkungen, entsorgungswegeJson, entnahmeorteJson, nextChargeNumber, createdAt, createdBy)
    VALUES (?,?,?,?,?,?,?,?,1,?,?)`)
    .run(id, name, kuerzel, auftraggeber || '', ort || '', bemerkungen || '', entsorgungswegeJson, entnahmeorteJson, now, req.user.id);
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  res.status(201).json({ project: rowToProject(row) });
});

projectsRouter.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Projekt nicht gefunden.' });
  const { name, ort, auftraggeber, bemerkungen } = req.body || {};
  const kuerzel = sanitizeKuerzel(req.body?.kuerzel);
  if (!name || !kuerzel) return res.status(400).json({ error: 'Projektname und Kürzel sind erforderlich.' });
  const entsorgungswegeJson = JSON.stringify(sanitizeList(req.body?.entsorgungswege));
  const entnahmeorteJson = JSON.stringify(sanitizeList(req.body?.entnahmeorte));
  db.prepare('UPDATE projects SET name=?, kuerzel=?, auftraggeber=?, ort=?, bemerkungen=?, entsorgungswegeJson=?, entnahmeorteJson=? WHERE id=?')
    .run(name, kuerzel, auftraggeber || '', ort || '', bemerkungen || '', entsorgungswegeJson, entnahmeorteJson, req.params.id);
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  res.json({ project: rowToProject(row) });
});

projectsRouter.delete('/:id', (req, res) => {
  const used = db.prepare('SELECT COUNT(*) AS n FROM entries WHERE projektId = ?').get(req.params.id).n;
  if (used > 0) {
    return res.status(409).json({ error: `Projekt hat noch ${used} Probe(n) und kann nicht gelöscht werden.` });
  }
  const info = db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Projekt nicht gefunden.' });
  res.status(204).end();
});
