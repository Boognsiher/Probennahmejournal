import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { db } from '../db.js';
import { requireAuth, requireAdmin, requireRole } from '../auth.js';
import {
  DEMO_THRESHOLDS, DEFAULT_PARAMETERS,
  DEFAULT_VBBO_THRESHOLDS, DEFAULT_VBBO_PARAMETERS, DEFAULT_VEVA_CODES,
  DEFAULT_ANALYTIK_PROGRAMME, DEFAULT_MATERIALIEN, DEFAULT_LABORE,
} from '../vvea-defaults.js';

export const settingsRouter = Router();
settingsRouter.use(requireAuth);

function getSetting(key, fallback) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? JSON.parse(row.value) : fallback;
}
function setSetting(key, value) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, JSON.stringify(value));
}

// `writeRoles`: welche Rollen PUT (speichern) und POST .../reset dürfen —
// Standard nur 'admin'. Analytik-Programme sind bewusst auch für
// 'projektleiter' freigegeben (projektbezogene Auswahl, keine
// sicherheitskritische Konfiguration wie Grenzwerte/Codes).
function crud(path, settingKey, defaultValue, bodyKey, writeRoles = ['admin']) {
  settingsRouter.get(`/${path}`, (req, res) => {
    res.json({ [bodyKey]: getSetting(settingKey, defaultValue) });
  });
  settingsRouter.put(`/${path}`, requireRole(...writeRoles), (req, res) => {
    const value = req.body?.[bodyKey];
    if (value === undefined) return res.status(400).json({ error: 'Ungültige Daten.' });
    setSetting(settingKey, value);
    res.json({ ok: true });
  });
  settingsRouter.post(`/${path}/reset`, requireRole(...writeRoles), (req, res) => {
    setSetting(settingKey, defaultValue);
    res.json({ [bodyKey]: defaultValue });
  });
}

crud('thresholds', 'vvea_thresholds', DEMO_THRESHOLDS, 'thresholds');
crud('parameters', 'vvea_parameters', DEFAULT_PARAMETERS, 'parameters');
crud('vbbo-thresholds', 'vbbo_thresholds', DEFAULT_VBBO_THRESHOLDS, 'thresholds');
crud('vbbo-parameters', 'vbbo_parameters', DEFAULT_VBBO_PARAMETERS, 'parameters');
crud('veva-codes', 'veva_codes', DEFAULT_VEVA_CODES, 'codes');
crud('analytik-programme', 'analytik_programme', DEFAULT_ANALYTIK_PROGRAMME, 'programme', ['admin', 'projektleiter']);
crud('materialien', 'materialien', DEFAULT_MATERIALIEN, 'materialien');
crud('labore', 'labore', DEFAULT_LABORE, 'labore');

// ---------- Änderungsanträge für VVEA-Grenzwerte ----------
// Projektleiter dürfen keine Grenzwerte direkt speichern (siehe crud()
// oben, weiterhin nur 'admin'), können aber eine Anpassung VORSCHLAGEN —
// Admin sieht die Anträge hier und übernimmt oder lehnt ab. Bewusst nur für
// die Grenzwert-ZAHLEN (nicht die Parameterliste selbst, d.h. kein
// Hinzufügen/Entfernen von Parametern über diesen Weg).
function rowToRequest(row) {
  return {
    id: row.id,
    thresholds: JSON.parse(row.payloadJson),
    note: row.note || '',
    requestedAt: row.requestedAt,
    requestedBy: row.requestedBy,
    requestedByName: row.requestedByName || null,
  };
}

settingsRouter.get('/thresholds/requests', requireRole('admin', 'projektleiter'), (req, res) => {
  let rows = db.prepare(`
    SELECT cr.*, u.name AS requestedByName FROM change_requests cr
    LEFT JOIN users u ON u.id = cr.requestedBy
    WHERE cr.type = 'vvea_thresholds' ORDER BY cr.requestedAt DESC
  `).all();
  if (req.user.role !== 'admin') rows = rows.filter(r => r.requestedBy === req.user.id);
  res.json({ requests: rows.map(rowToRequest) });
});

settingsRouter.post('/thresholds/requests', requireRole('admin', 'projektleiter'), (req, res) => {
  const thresholds = req.body?.thresholds;
  if (!thresholds || typeof thresholds !== 'object') return res.status(400).json({ error: 'Ungültige Daten.' });
  const id = randomUUID();
  db.prepare('INSERT INTO change_requests (id, type, payloadJson, note, requestedAt, requestedBy) VALUES (?,?,?,?,?,?)')
    .run(id, 'vvea_thresholds', JSON.stringify(thresholds), String(req.body?.note || '').slice(0, 500), new Date().toISOString(), req.user.id);
  res.status(201).json({ id });
});

settingsRouter.post('/thresholds/requests/:id/cancel', requireRole('admin', 'projektleiter'), (req, res) => {
  const row = db.prepare("SELECT * FROM change_requests WHERE id = ? AND type = 'vvea_thresholds'").get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Antrag nicht gefunden.' });
  if (req.user.role !== 'admin' && row.requestedBy !== req.user.id) return res.status(403).json({ error: 'Dafür fehlt die Berechtigung.' });
  db.prepare('DELETE FROM change_requests WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

settingsRouter.post('/thresholds/requests/:id/apply', requireAdmin, (req, res) => {
  const row = db.prepare("SELECT * FROM change_requests WHERE id = ? AND type = 'vvea_thresholds'").get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Antrag nicht gefunden.' });
  setSetting('vvea_thresholds', JSON.parse(row.payloadJson));
  db.prepare('DELETE FROM change_requests WHERE id = ?').run(req.params.id);
  res.json({ thresholds: getSetting('vvea_thresholds', DEMO_THRESHOLDS) });
});

settingsRouter.post('/thresholds/requests/:id/reject', requireAdmin, (req, res) => {
  const info = db.prepare("DELETE FROM change_requests WHERE id = ? AND type = 'vvea_thresholds'").run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Antrag nicht gefunden.' });
  res.status(204).end();
});
