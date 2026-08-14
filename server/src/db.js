import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import {
  DEMO_THRESHOLDS, DEFAULT_PARAMETERS,
  DEFAULT_VBBO_THRESHOLDS, DEFAULT_VBBO_PARAMETERS, DEFAULT_VEVA_CODES,
} from './vvea-defaults.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, 'probennahmejournal.sqlite');

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  passwordHash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user', -- 'admin' | 'user'
  createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kuerzel TEXT NOT NULL,
  auftraggeber TEXT DEFAULT '',
  ort TEXT DEFAULT '',
  bemerkungen TEXT DEFAULT '',
  nextChargeNumber INTEGER NOT NULL DEFAULT 1,
  entsorgungswegeJson TEXT DEFAULT '[]', -- vordefinierte Entsorgungswege (Dropdown bei der Probe)
  entnahmeorteJson TEXT DEFAULT '[]',    -- vordefinierte Beprobungsorte (Dropdown bei der Probe)
  createdAt TEXT NOT NULL,
  createdBy TEXT REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS entries (
  id TEXT PRIMARY KEY,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  projektId TEXT REFERENCES projects(id),
  baustelle TEXT DEFAULT '',
  probeBezeichnung TEXT DEFAULT '',
  entnahmeort TEXT DEFAULT '',
  gpsLat REAL,
  gpsLng REAL,
  material TEXT DEFAULT '',
  probenehmer TEXT DEFAULT '',
  bemerkungen TEXT DEFAULT '',
  analyseJson TEXT DEFAULT '[]',
  klassifizierungJson TEXT,
  standard TEXT DEFAULT 'vvea', -- 'vvea' | 'vbbo'
  nutzungsart TEXT,             -- nur bei standard='vbbo': 'spielplatz' | 'garten' | 'landwirtschaft'
  entsorgungsweg TEXT DEFAULT '',
  vevaCode TEXT DEFAULT '',
  menge REAL,
  mengeEinheit TEXT DEFAULT 't', -- 't' | 'm3'
  createdBy TEXT REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_entries_projekt ON entries(projektId);

CREATE TABLE IF NOT EXISTS photos (
  id TEXT PRIMARY KEY,
  entryId TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  originalName TEXT,
  mimeType TEXT,
  takenAt TEXT,
  uploadedBy TEXT REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_photos_entry ON photos(entryId);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`);

// Migrationen für bestehende Datenbanken: fehlende Spalten nachrüsten.
const entryCols = db.prepare("PRAGMA table_info(entries)").all().map(c => c.name);
const addColumnIfMissing = (table, cols, col, ddl) => {
  if (!cols.includes(col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
};
addColumnIfMissing('entries', entryCols, 'projektId', "projektId TEXT REFERENCES projects(id)");
addColumnIfMissing('entries', entryCols, 'standard', "standard TEXT DEFAULT 'vvea'");
addColumnIfMissing('entries', entryCols, 'nutzungsart', "nutzungsart TEXT");
addColumnIfMissing('entries', entryCols, 'entsorgungsweg', "entsorgungsweg TEXT DEFAULT ''");
addColumnIfMissing('entries', entryCols, 'vevaCode', "vevaCode TEXT DEFAULT ''");
addColumnIfMissing('entries', entryCols, 'menge', "menge REAL");
addColumnIfMissing('entries', entryCols, 'mengeEinheit', "mengeEinheit TEXT DEFAULT 't'");
db.exec('CREATE INDEX IF NOT EXISTS idx_entries_projekt ON entries(projektId)');

const projectCols = db.prepare("PRAGMA table_info(projects)").all().map(c => c.name);
addColumnIfMissing('projects', projectCols, 'entsorgungswegeJson', "entsorgungswegeJson TEXT DEFAULT '[]'");
addColumnIfMissing('projects', projectCols, 'entnahmeorteJson', "entnahmeorteJson TEXT DEFAULT '[]'");

// Einstellungen mit Startwerten vorbefüllen, falls noch nicht vorhanden ODER
// falls ein vorhandener Eintrag erkennbar leer/veraltet ist (z.B. aus einer
// Zwischenversion vor Einführung von VBBo/VeVA, oder im alten
// material/klasse-Einzelwert-Format statt materialien/klassen-Arrays) —
// sonst würde ein einmal (ggf. leer) angelegter Eintrag nie mehr aktualisiert.
function seedSetting(key, value, isStale) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  if (!row) {
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(key, JSON.stringify(value));
    return;
  }
  if (isStale) {
    let existing;
    try { existing = JSON.parse(row.value); } catch { existing = undefined; }
    if (isStale(existing)) {
      db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(JSON.stringify(value), key);
    }
  }
}
const isEmptyObject = v => !v || typeof v !== 'object' || Object.keys(v).length === 0;
const isEmptyArray = v => !Array.isArray(v) || v.length === 0;
const isOldVevaCodeShape = v => isEmptyArray(v) || v.some(c => !Array.isArray(c.materialien) || !Array.isArray(c.klassen));

seedSetting('vvea_thresholds', DEMO_THRESHOLDS);
seedSetting('vvea_parameters', DEFAULT_PARAMETERS);
seedSetting('vbbo_thresholds', DEFAULT_VBBO_THRESHOLDS, isEmptyObject);
seedSetting('vbbo_parameters', DEFAULT_VBBO_PARAMETERS, isEmptyArray);
seedSetting('veva_codes', DEFAULT_VEVA_CODES, isOldVevaCodeShape);

// Ersten Admin-Benutzer aus den Umgebungsvariablen anlegen, falls noch keine
// Benutzer existieren.
const userCount = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
if (userCount === 0) {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || 'Administrator';
  if (email && password) {
    const passwordHash = bcrypt.hashSync(password, 12);
    db.prepare('INSERT INTO users (id, email, passwordHash, name, role, createdAt) VALUES (?,?,?,?,?,?)')
      .run(randomUUID(), email.toLowerCase().trim(), passwordHash, name, 'admin', new Date().toISOString());
    console.log(`[setup] Admin-Konto angelegt: ${email}`);
  } else {
    console.warn('[setup] Keine Benutzer vorhanden und ADMIN_EMAIL/ADMIN_PASSWORD nicht gesetzt. '
      + 'Bitte .env gemäss .env.example anlegen und Server neu starten.');
  }
}

export const uploadsDir = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });
