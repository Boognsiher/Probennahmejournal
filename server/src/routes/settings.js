import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, requireAdmin } from '../auth.js';
import {
  DEMO_THRESHOLDS, DEFAULT_PARAMETERS,
  DEFAULT_VBBO_THRESHOLDS, DEFAULT_VBBO_PARAMETERS, DEFAULT_VEVA_CODES,
  DEFAULT_ANALYTIK_PROGRAMME, DEFAULT_MATERIALIEN,
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

function crud(path, settingKey, defaultValue, bodyKey) {
  settingsRouter.get(`/${path}`, (req, res) => {
    res.json({ [bodyKey]: getSetting(settingKey, defaultValue) });
  });
  settingsRouter.put(`/${path}`, requireAdmin, (req, res) => {
    const value = req.body?.[bodyKey];
    if (value === undefined) return res.status(400).json({ error: 'Ungültige Daten.' });
    setSetting(settingKey, value);
    res.json({ ok: true });
  });
  settingsRouter.post(`/${path}/reset`, requireAdmin, (req, res) => {
    setSetting(settingKey, defaultValue);
    res.json({ [bodyKey]: defaultValue });
  });
}

crud('thresholds', 'vvea_thresholds', DEMO_THRESHOLDS, 'thresholds');
crud('parameters', 'vvea_parameters', DEFAULT_PARAMETERS, 'parameters');
crud('vbbo-thresholds', 'vbbo_thresholds', DEFAULT_VBBO_THRESHOLDS, 'thresholds');
crud('vbbo-parameters', 'vbbo_parameters', DEFAULT_VBBO_PARAMETERS, 'parameters');
crud('veva-codes', 'veva_codes', DEFAULT_VEVA_CODES, 'codes');
crud('analytik-programme', 'analytik_programme', DEFAULT_ANALYTIK_PROGRAMME, 'programme');
crud('materialien', 'materialien', DEFAULT_MATERIALIEN, 'materialien');
