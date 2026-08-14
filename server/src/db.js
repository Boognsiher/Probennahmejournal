import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { DEMO_THRESHOLDS, DEFAULT_PARAMETERS } from './vvea-defaults.js';

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

// Migration für bestehende Datenbanken (vor Einführung des Projekt-Konzepts):
// entries.projektId nachrüsten, falls die Spalte noch fehlt.
const entryCols = db.prepare("PRAGMA table_info(entries)").all().map(c => c.name);
if (!entryCols.includes('projektId')) {
  db.exec('ALTER TABLE entries ADD COLUMN projektId TEXT REFERENCES projects(id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_entries_projekt ON entries(projektId)');
}

// Grenzwerte mit Platzhalter-Beispielwerten vorbefüllen, falls noch nicht vorhanden.
const thresholdsRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('vvea_thresholds');
if (!thresholdsRow) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)')
    .run('vvea_thresholds', JSON.stringify(DEMO_THRESHOLDS));
}
const parametersRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('vvea_parameters');
if (!parametersRow) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)')
    .run('vvea_parameters', JSON.stringify(DEFAULT_PARAMETERS));
}

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
