import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import {
  DEMO_THRESHOLDS, DEFAULT_PARAMETERS,
  DEFAULT_VBBO_THRESHOLDS, DEFAULT_VBBO_PARAMETERS, DEFAULT_VEVA_CODES,
  DEFAULT_ANALYTIK_PROGRAMME, DEFAULT_MATERIALIEN, DEFAULT_LABORE,
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
  role TEXT NOT NULL DEFAULT 'probenehmer', -- 'admin' | 'projektleiter' | 'probenehmer' | 'extern'
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
  probenehmerZugriffJson TEXT DEFAULT '[]', -- User-IDs (Rolle 'probenehmer') mit Zugriff auf dieses Projekt
  createdAt TEXT NOT NULL,
  createdBy TEXT REFERENCES users(id) -- Projektleiter/Admin, dem/der das Projekt "gehört" (Sichtbarkeits-Scope)
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
  analytikProgrammeJson TEXT DEFAULT '[]', -- Array gewählter Analytik-Programm-IDs
  labor TEXT DEFAULT '', -- Name des Labors, an das der Analysenauftrag ging (siehe Einstellungen > Labore)
  externZugriffJson TEXT DEFAULT '[]', -- User-IDs (Rolle 'extern') mit Lesezugriff auf GENAU diese Probe
  deletionRequestedAt TEXT, -- gesetzt, wenn ein/e Probenehmer/in die Löschung beantragt hat (braucht Freigabe)
  deletionRequestedBy TEXT REFERENCES users(id),
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

-- Änderungsanträge, die eine Rolle ohne direktes Schreibrecht auf eine
-- Einstellung einreichen kann (aktuell: Projektleitung schlägt neue
-- VVEA-Grenzwerte vor, Admin übernimmt/lehnt ab — siehe routes/settings.js).
CREATE TABLE IF NOT EXISTS change_requests (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL, -- z.B. 'vvea_thresholds'
  payloadJson TEXT NOT NULL,
  note TEXT DEFAULT '',
  requestedAt TEXT NOT NULL,
  requestedBy TEXT REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Fortlaufende Nummerierung für eigenständige Proben ohne Projekt
-- ("Probenahmeprotokoll"/Scratchbook, siehe routes/entries.js) — analog zu
-- projects.nextChargeNumber, aber global statt pro Projekt (kein Kürzel
-- vorhanden, das die Charge sonst eindeutig macht).
CREATE TABLE IF NOT EXISTS counters (
  key TEXT PRIMARY KEY,
  value INTEGER NOT NULL DEFAULT 0
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
addColumnIfMissing('entries', entryCols, 'analytikProgrammeJson', "analytikProgrammeJson TEXT DEFAULT '[]'");
addColumnIfMissing('entries', entryCols, 'labor', "labor TEXT DEFAULT ''");
addColumnIfMissing('entries', entryCols, 'externZugriffJson', "externZugriffJson TEXT DEFAULT '[]'");
addColumnIfMissing('entries', entryCols, 'deletionRequestedAt', "deletionRequestedAt TEXT");
addColumnIfMissing('entries', entryCols, 'deletionRequestedBy', "deletionRequestedBy TEXT REFERENCES users(id)");
db.exec('CREATE INDEX IF NOT EXISTS idx_entries_projekt ON entries(projektId)');

const projectCols = db.prepare("PRAGMA table_info(projects)").all().map(c => c.name);
addColumnIfMissing('projects', projectCols, 'entsorgungswegeJson', "entsorgungswegeJson TEXT DEFAULT '[]'");
addColumnIfMissing('projects', projectCols, 'entnahmeorteJson', "entnahmeorteJson TEXT DEFAULT '[]'");
addColumnIfMissing('projects', projectCols, 'probenehmerZugriffJson', "probenehmerZugriffJson TEXT DEFAULT '[]'");

// Rollenmodell erweitert (admin/projektleiter/probenehmer/extern statt nur
// admin/user) — bestehende 'user'-Konten auf 'probenehmer' migrieren, die
// nächstliegende Rolle zum bisherigen Verhalten (Proben erfassen/bearbeiten,
// keine Einstellungen). Betroffene Personen ggf. anschliessend unter
// Einstellungen > Benutzer auf 'projektleiter' hochstufen, wo nötig — und
// müssen für ihre Projekte per Zugriffsliste freigeschaltet werden.
db.prepare("UPDATE users SET role = 'probenehmer' WHERE role = 'user'").run();

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
// Boden-Grenzwerte auf Kat. I/II (Richtwert/Prüfwert, Nutzungsart-
// unabhängig) umgestellt — alte Einträge hatten stattdessen `richtwert`/
// `pwDirekt`/... je Nutzungsart, daher an diesem Merkmal erkennbar. Anders
// als die Grenzwerte selbst sind `materialien`/`veva_codes` (Gleisaushub-
// Ergänzung) bewusst NICHT zwangsmigriert: ein bereits laufender Server
// könnte dort eigene Ergänzungen/Anpassungen haben, die ein Reseed
// überschreiben würde — Gleisaushub kann dort bei Bedarf manuell unter
// Einstellungen nachgetragen werden.
const isOldVbboThresholdShape = v => isEmptyObject(v)
  || Object.values(v).some(t => t && typeof t === 'object' && 'richtwert' in t);

seedSetting('vvea_thresholds', DEMO_THRESHOLDS);
seedSetting('vvea_parameters', DEFAULT_PARAMETERS);
seedSetting('vbbo_thresholds', DEFAULT_VBBO_THRESHOLDS, isOldVbboThresholdShape);
seedSetting('vbbo_parameters', DEFAULT_VBBO_PARAMETERS, isEmptyArray);
seedSetting('veva_codes', DEFAULT_VEVA_CODES, isOldVevaCodeShape);
seedSetting('analytik_programme', DEFAULT_ANALYTIK_PROGRAMME, isEmptyArray);
seedSetting('materialien', DEFAULT_MATERIALIEN, isEmptyArray);
seedSetting('labore', DEFAULT_LABORE, isEmptyArray);

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
