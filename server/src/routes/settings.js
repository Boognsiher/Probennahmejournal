import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, requireAdmin } from '../auth.js';
import { DEMO_THRESHOLDS } from '../vvea-defaults.js';

export const settingsRouter = Router();
settingsRouter.use(requireAuth);

settingsRouter.get('/thresholds', (req, res) => {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('vvea_thresholds');
  res.json({ thresholds: row ? JSON.parse(row.value) : DEMO_THRESHOLDS });
});

settingsRouter.put('/thresholds', requireAdmin, (req, res) => {
  const { thresholds } = req.body || {};
  if (!thresholds || typeof thresholds !== 'object') return res.status(400).json({ error: 'Ungültige Grenzwerte.' });
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run('vvea_thresholds', JSON.stringify(thresholds));
  res.json({ ok: true });
});

settingsRouter.post('/thresholds/reset', requireAdmin, (req, res) => {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run('vvea_thresholds', JSON.stringify(DEMO_THRESHOLDS));
  res.json({ thresholds: DEMO_THRESHOLDS });
});
