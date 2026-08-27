import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { db } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';

export const projectsRouter = Router();
projectsRouter.use(requireAuth);

// Sichtbarkeit/Schreibrechte je Rolle (siehe auth.js):
// - admin: sieht/verwaltet alle Projekte.
// - projektleiter: sieht/verwaltet NUR selbst erstellte Projekte (createdBy).
// - probenehmer: sieht Projekte, für die er/sie in probenehmerZugriffJson
//   eingetragen ist — kann sie NICHT anlegen/bearbeiten/löschen, nur Proben
//   darin erfassen (siehe routes/entries.js).
// - extern: sieht in dieser Liste grundsätzlich nichts (kein Projekt-Scope,
//   nur einzeln freigegebene Proben — siehe entries.js); Projektname wird
//   dort direkt an der Probe mitgeliefert (baustelle), daher kein eigener
//   Zugriff auf /api/projects nötig.

function rowToProject(row) {
  return {
    id: row.id, name: row.name, kuerzel: row.kuerzel,
    auftraggeber: row.auftraggeber, ort: row.ort, bemerkungen: row.bemerkungen,
    nextChargeNumber: row.nextChargeNumber, createdAt: row.createdAt, createdBy: row.createdBy,
    entsorgungswege: JSON.parse(row.entsorgungswegeJson || '[]'),
    entnahmeorte: JSON.parse(row.entnahmeorteJson || '[]'),
    probenehmerZugriff: JSON.parse(row.probenehmerZugriffJson || '[]'),
  };
}

function sanitizeList(list) {
  if (!Array.isArray(list)) return [];
  return list.map(s => String(s ?? '').trim()).filter(Boolean);
}
function sanitizeUserIds(list) {
  if (!Array.isArray(list)) return [];
  const known = new Set(db.prepare('SELECT id FROM users').all().map(u => u.id));
  return [...new Set(list.map(String))].filter(id => known.has(id));
}

// true, wenn `user` das Projekt sehen darf.
export function canViewProject(project, user) {
  if (!project) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'projektleiter') return project.createdBy === user.id;
  if (user.role === 'probenehmer') return JSON.parse(project.probenehmerZugriffJson || '[]').includes(user.id);
  return false; // extern
}
// true, wenn `user` das Projekt anlegen/bearbeiten/löschen bzw. die
// Zugriffsliste verwalten darf. `project` muss ein existierender Datensatz
// sein — für eigenständige Proben ohne Projekt (Probenahmeprotokoll/
// Scratchbook, siehe entries.js) gilt eine eigene, separate Prüfung
// (canManageEntry dort), NICHT diese Funktion mit project=null.
export function canManageProject(project, user) {
  if (!project) return false;
  if (user.role === 'admin') return true;
  return user.role === 'projektleiter' && project.createdBy === user.id;
}
// true, wenn `user` in diesem Projekt Proben anlegen/bearbeiten darf.
export function canWriteInProject(project, user) {
  if (!project) return false;
  if (canManageProject(project, user)) return true;
  if (user.role === 'probenehmer') return JSON.parse(project.probenehmerZugriffJson || '[]').includes(user.id);
  return false; // extern: nur lesen
}

function visibleProjectRows(user) {
  const all = db.prepare('SELECT * FROM projects ORDER BY name COLLATE NOCASE').all();
  if (user.role === 'admin') return all;
  if (user.role === 'projektleiter') return all.filter(p => p.createdBy === user.id);
  if (user.role === 'probenehmer') return all.filter(p => JSON.parse(p.probenehmerZugriffJson || '[]').includes(user.id));
  return []; // extern
}

projectsRouter.get('/', (req, res) => {
  res.json({ projects: visibleProjectRows(req.user).map(rowToProject) });
});

projectsRouter.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!row || !canViewProject(row, req.user)) return res.status(404).json({ error: 'Projekt nicht gefunden.' });
  res.json({ project: rowToProject(row) });
});

function sanitizeKuerzel(k) {
  return String(k || '').toUpperCase().replace(/[^A-Z0-9\-]/g, '').slice(0, 12);
}

// Nur admin/projektleiter dürfen neue Projekte ("Baustellen") eröffnen.
projectsRouter.post('/', requireRole('admin', 'projektleiter'), (req, res) => {
  const { name, ort, auftraggeber, bemerkungen } = req.body || {};
  const kuerzel = sanitizeKuerzel(req.body?.kuerzel);
  if (!name || !kuerzel) return res.status(400).json({ error: 'Projektname und Kürzel sind erforderlich.' });
  const entsorgungswegeJson = JSON.stringify(sanitizeList(req.body?.entsorgungswege));
  const entnahmeorteJson = JSON.stringify(sanitizeList(req.body?.entnahmeorte));
  const probenehmerZugriffJson = JSON.stringify(sanitizeUserIds(req.body?.probenehmerZugriff));
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO projects (id, name, kuerzel, auftraggeber, ort, bemerkungen, entsorgungswegeJson, entnahmeorteJson, probenehmerZugriffJson, nextChargeNumber, createdAt, createdBy)
    VALUES (?,?,?,?,?,?,?,?,?,1,?,?)`)
    .run(id, name, kuerzel, auftraggeber || '', ort || '', bemerkungen || '', entsorgungswegeJson, entnahmeorteJson, probenehmerZugriffJson, now, req.user.id);
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  res.status(201).json({ project: rowToProject(row) });
});

// Bearbeiten (inkl. Zugriffsliste für Probenehmer/innen) — nur admin oder
// die Projektleitung, der das Projekt gehört.
projectsRouter.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Projekt nicht gefunden.' });
  if (!canManageProject(existing, req.user)) return res.status(403).json({ error: 'Dafür fehlt die Berechtigung.' });
  const { name, ort, auftraggeber, bemerkungen } = req.body || {};
  const kuerzel = sanitizeKuerzel(req.body?.kuerzel);
  if (!name || !kuerzel) return res.status(400).json({ error: 'Projektname und Kürzel sind erforderlich.' });
  const entsorgungswegeJson = JSON.stringify(sanitizeList(req.body?.entsorgungswege));
  const entnahmeorteJson = JSON.stringify(sanitizeList(req.body?.entnahmeorte));
  const probenehmerZugriffJson = JSON.stringify(sanitizeUserIds(req.body?.probenehmerZugriff));
  db.prepare(`UPDATE projects SET name=?, kuerzel=?, auftraggeber=?, ort=?, bemerkungen=?,
      entsorgungswegeJson=?, entnahmeorteJson=?, probenehmerZugriffJson=? WHERE id=?`)
    .run(name, kuerzel, auftraggeber || '', ort || '', bemerkungen || '', entsorgungswegeJson, entnahmeorteJson, probenehmerZugriffJson, req.params.id);
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  res.json({ project: rowToProject(row) });
});

projectsRouter.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Projekt nicht gefunden.' });
  if (!canManageProject(existing, req.user)) return res.status(403).json({ error: 'Dafür fehlt die Berechtigung.' });
  const used = db.prepare('SELECT COUNT(*) AS n FROM entries WHERE projektId = ?').get(req.params.id).n;
  if (used > 0) {
    return res.status(409).json({ error: `Projekt hat noch ${used} Probe(n) und kann nicht gelöscht werden.` });
  }
  db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
  res.status(204).end();
});
