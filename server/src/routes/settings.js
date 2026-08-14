import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, requireAdmin } from '../auth.js';
import { DEMO_THRESHOLDS, DEFAULT_PARAMETERS } from '../vvea-defaults.js';

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

settingsRouter.get('/thresholds', (req, res) => {
  res.json({ thresholds: getSetting('vvea_thresholds', DEMO_THRESHOLDS) });
});
settingsRouter.put('/thresholds', requireAdmin, (req, res) => {
  const { thresholds } = req.body || {};
  if (!thresholds || typeof thresholds !== 'object') return res.status(400).json({ error: 'Ungültige Grenzwerte.' });
  setSetting('vvea_thresholds', thresholds);
  res.json({ ok: true });
});
settingsRouter.post('/thresholds/reset', requireAdmin, (req, res) => {
  setSetting('vvea_thresholds', DEMO_THRESHOLDS);
  res.json({ thresholds: DEMO_THRESHOLDS });
});

settingsRouter.get('/parameters', (req, res) => {
  res.json({ parameters: getSetting('vvea_parameters', DEFAULT_PARAMETERS) });
});
settingsRouter.put('/parameters', requireAdmin, (req, res) => {
  const { parameters } = req.body || {};
  if (!Array.isArray(parameters)) return res.status(400).json({ error: 'Ungültige Parameterliste.' });
  setSetting('vvea_parameters', parameters);
  res.json({ ok: true });
});
settingsRouter.post('/parameters/reset', requireAdmin, (req, res) => {
  setSetting('vvea_parameters', DEFAULT_PARAMETERS);
  res.json({ parameters: DEFAULT_PARAMETERS });
});
