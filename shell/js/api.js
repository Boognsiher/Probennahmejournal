// api.js (MOCK-VERSION für die Test-Schale) — bildet exakt dieselbe Schnittstelle
// wie public/js/api.js nach (gleiche Funktionsnamen/-signaturen), sodass app.js,
// vvea.js etc. unverändert übernommen werden können. Statt echter Server-Aufrufe
// wird alles lokal in diesem Browser simuliert (localStorage). Kein Netzwerk,
// kein echtes Login, keine echte Sicherheit — nur zum Durchklicken/Testen der
// Oberfläche, bevor der echte Server (siehe ../server) angebunden wird.
import {
  DEMO_THRESHOLDS, DEFAULT_PARAMETERS,
  DEFAULT_VBBO_THRESHOLDS, DEFAULT_VBBO_PARAMETERS,
} from './vvea.js';

// VeVA-Codes gibt es (anders als VVEA/VBBo-Grenzwerte) nicht in vvea.js, da im
// echten Server-Betrieb (public/) ausschliesslich der Server sie vorbefüllt.
// Für die Test-Schale hier lokal dieselben Startwerte wie
// server/src/vvea-defaults.js bzw. lokal/js/vvea.js hinterlegt.
// Ein Code kann für mehrere Materialien und/oder mehrere VVEA-Klassen
// gleichzeitig gelten (z.B. ein gemeinsamer Code für Typ C/D/E, oder
// derselbe Code für Ober- UND Unterboden) — daher `materialien`/`klassen`
// als Arrays statt Einzelwerten.
const DEFAULT_VEVA_CODES = [
  { code: '17 05 04', bezeichnung: 'Ober-/Unterboden – unverschmutzt', materialien: ['Oberboden', 'Unterboden'], klassen: ['unbelastet'] },
  { code: '17 05 93', bezeichnung: 'Ober-/Unterboden – schwach verschmutzt (Typ A)', materialien: ['Oberboden', 'Unterboden'], klassen: ['typA'] },
  { code: '17 05 96 [ak]', bezeichnung: 'Ober-/Unterboden – Inertstoff (Typ B)', materialien: ['Oberboden', 'Unterboden'], klassen: ['typB'] },
  { code: '17 05 90 [akb]', bezeichnung: 'Ober-/Unterboden – stark verschmutzt (Typ C/D/E)', materialien: ['Oberboden', 'Unterboden'], klassen: ['typC', 'typD', 'typE'] },
  { code: '17 05 06', bezeichnung: 'Aushub – unverschmutzt', materialien: ['Aushub'], klassen: ['unbelastet'] },
  { code: '17 05 94', bezeichnung: 'Aushub – schwach verschmutzt (Typ A)', materialien: ['Aushub'], klassen: ['typA'] },
  { code: '17 05 97 [ak]', bezeichnung: 'Aushub – Inertstoff (Typ B)', materialien: ['Aushub'], klassen: ['typB'] },
  { code: '17 05 91 [akb]', bezeichnung: 'Aushub – stark verschmutzt (Typ C/D/E)', materialien: ['Aushub'], klassen: ['typC', 'typD', 'typE'] },
];

// Analytik-Programme: siehe server/src/vvea-defaults.js für die vollständige
// Erklärung — hier dieselbe Startauswahl für die Test-Schale.
const DEFAULT_ANALYTIK_PROGRAMME = [
  {
    id: 'vvea-basis-feststoff', name: 'VVEA Basis (Feststoff)',
    parameterKeys: ['sb', 'as', 'pb', 'cd', 'cr', 'cr6', 'cu', 'ni', 'hg', 'zn', 'toc400', 'kw', 'pak', 'bap'],
  },
  {
    id: 'vvea-eluat-typc', name: 'VVEA Eluat (Nachweis Typ C nach Behandlung)',
    parameterKeys: ['as_el', 'pb_el', 'cd_el', 'cr6_el', 'cr3_el', 'cu_el', 'ni_el', 'hg_el', 'zn_el', 'co_el', 'sn_el', 'doc', 'nh4_el', 'cnfrei_el', 'fluorid'],
  },
  {
    id: 'vvea-organik-zusatz', name: 'VVEA Organik-Zusatz (BTEX/PCB/Benzol)',
    parameterKeys: ['kw_c5', 'btex', 'benzol', 'pcb'],
  },
  {
    id: 'vbbo-basis', name: 'VBBo Basis (Ober-/Unterboden)',
    parameterKeys: ['pb', 'cd', 'cr', 'cu', 'hg', 'ni', 'zn', 'pak', 'bap', 'pcb'],
  },
];

// v6: Analytik-Programme (Menge, Analytik-Programm-Auswahl je Probe) ergänzt
// — Version angehoben, damit bereits laufende Test-Sessions die neuen Felder
// erhalten.
const DB_KEY = 'pnj_mock_db_v6';
const TOKEN_KEY = 'pnj_token';
const USER_KEY = 'pnj_user';

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
function pad3(n) { return String(n).padStart(3, '0'); }

function seedDb() {
  const now = new Date().toISOString();
  return {
    users: [
      { id: uid(), email: 'admin@demo.ch', password: 'demo1234', name: 'Demo Admin', role: 'admin', createdAt: now },
      { id: uid(), email: 'team@demo.ch', password: 'demo1234', name: 'Demo Team-Mitglied', role: 'user', createdAt: now },
    ],
    projects: [
      {
        id: uid(), name: 'Demo Baustelle Zürich', kuerzel: 'DEMO', auftraggeber: 'Muster AG', ort: 'Zürich', bemerkungen: '',
        entsorgungswege: ['Deponie Muster AG, Zürich', 'Aushubdeponie Musterhausen'],
        entnahmeorte: ['Baugrube Nord, Schicht 1', 'Baugrube Süd, Schicht 2'],
        nextChargeNumber: 1, createdAt: now,
      },
    ],
    entries: [],
    thresholds: JSON.parse(JSON.stringify(DEMO_THRESHOLDS)),
    parameters: JSON.parse(JSON.stringify(DEFAULT_PARAMETERS)),
    vbboThresholds: JSON.parse(JSON.stringify(DEFAULT_VBBO_THRESHOLDS)),
    vbboParameters: JSON.parse(JSON.stringify(DEFAULT_VBBO_PARAMETERS)),
    vevaCodes: JSON.parse(JSON.stringify(DEFAULT_VEVA_CODES)),
    analytikProgramme: JSON.parse(JSON.stringify(DEFAULT_ANALYTIK_PROGRAMME)),
  };
}

function loadDb() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* fällt auf frische Seed-Daten zurück */ }
  const fresh = seedDb();
  localStorage.setItem(DB_KEY, JSON.stringify(fresh));
  return fresh;
}

let db = loadDb();
function persist() { localStorage.setItem(DB_KEY, JSON.stringify(db)); }

// Kleine künstliche Verzögerung, damit sich Ladezustände/Spinner in der UI
// genauso anfühlen wie mit einem echten Server.
const delay = (ms = 150) => new Promise(r => setTimeout(r, ms));

export class ApiError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

export function getToken() { return localStorage.getItem(TOKEN_KEY); }
export function getCurrentUser() {
  try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch { return null; }
}
export function isLoggedIn() { return !!getToken(); }
export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

function requireAuth() {
  const user = getCurrentUser();
  if (!isLoggedIn() || !user) throw new ApiError('Nicht angemeldet.', 401);
  return user;
}
function requireAdmin() {
  const user = requireAuth();
  if (user.role !== 'admin') throw new ApiError('Nur für Administratoren.', 403);
  return user;
}
function stripPhotoData(entry) {
  return { ...entry, photos: (entry.photos || []).map(({ dataUrl, ...meta }) => meta) };
}

// ---------- Auth ----------
export async function login(email, password) {
  await delay();
  const u = db.users.find(x => x.email.toLowerCase() === String(email).toLowerCase().trim());
  if (!u || u.password !== password) throw new ApiError('E-Mail oder Passwort falsch.', 401);
  const user = { id: u.id, email: u.email, name: u.name, role: u.role };
  localStorage.setItem(TOKEN_KEY, `mock.${u.id}`);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  return user;
}

// ---------- Einträge ----------
export async function listEntries() {
  await delay();
  requireAuth();
  return [...db.entries].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).map(stripPhotoData);
}
export async function getEntryApi(id) {
  await delay();
  requireAuth();
  const entry = db.entries.find(e => e.id === id);
  if (!entry) throw new ApiError('Probe nicht gefunden.', 404);
  return stripPhotoData(entry);
}

// Chargenname (Probenbezeichnung) wird ausschliesslich hier vergeben — analog
// zum echten Server — aus Projekt-Kürzel + fortlaufender Nummer.
export async function createEntryApi(entry) {
  await delay();
  const user = requireAuth();
  if (!entry.projektId) throw new ApiError('Bitte zuerst ein Projekt auswählen.', 400);
  const project = db.projects.find(p => p.id === entry.projektId);
  if (!project) throw new ApiError('Projekt nicht gefunden.', 400);
  const seq = project.nextChargeNumber;
  const probeBezeichnung = `${project.kuerzel}-${pad3(seq)}`;
  project.nextChargeNumber = seq + 1;

  const now = new Date().toISOString();
  const created = {
    id: uid(),
    createdAt: entry.createdAt || now,
    updatedAt: now,
    projektId: project.id,
    baustelle: project.name,
    probeBezeichnung,
    entnahmeort: entry.entnahmeort || '',
    gps: entry.gps || null,
    material: entry.material || '',
    probenehmer: entry.probenehmer || '',
    bemerkungen: entry.bemerkungen || '',
    analyse: entry.analyse || [],
    klassifizierung: entry.klassifizierung || null,
    standard: entry.standard === 'vbbo' ? 'vbbo' : 'vvea',
    nutzungsart: entry.standard === 'vbbo' ? (entry.nutzungsart || null) : null,
    entsorgungsweg: entry.entsorgungsweg || '',
    vevaCode: entry.vevaCode || '',
    menge: (entry.menge === '' || entry.menge === undefined || entry.menge === null) ? null : Number(entry.menge),
    mengeEinheit: entry.mengeEinheit === 'm3' ? 'm3' : 't',
    analytikProgramme: Array.isArray(entry.analytikProgramme) ? entry.analytikProgramme : [],
    createdBy: user.id,
    photos: [],
  };
  db.entries.push(created);
  persist();
  return stripPhotoData(created);
}
// Projekt und Chargenname bleiben nach dem Anlegen fix (Nachvollziehbarkeit).
export async function updateEntryApi(id, entry) {
  await delay();
  requireAuth();
  const existing = db.entries.find(e => e.id === id);
  if (!existing) throw new ApiError('Probe nicht gefunden.', 404);
  Object.assign(existing, {
    entnahmeort: entry.entnahmeort ?? '', gps: entry.gps ?? null,
    material: entry.material ?? '', probenehmer: entry.probenehmer ?? '',
    bemerkungen: entry.bemerkungen ?? '', analyse: entry.analyse ?? [],
    klassifizierung: entry.klassifizierung ?? null,
    standard: entry.standard === 'vbbo' ? 'vbbo' : 'vvea',
    nutzungsart: entry.standard === 'vbbo' ? (entry.nutzungsart || null) : null,
    entsorgungsweg: entry.entsorgungsweg ?? '',
    vevaCode: entry.vevaCode ?? '',
    menge: (entry.menge === '' || entry.menge === undefined || entry.menge === null) ? null : Number(entry.menge),
    mengeEinheit: entry.mengeEinheit === 'm3' ? 'm3' : 't',
    analytikProgramme: Array.isArray(entry.analytikProgramme) ? entry.analytikProgramme : [],
    updatedAt: new Date().toISOString(),
  });
  persist();
  return stripPhotoData(existing);
}
export async function deleteEntryApi(id) {
  await delay();
  requireAuth();
  db.entries = db.entries.filter(e => e.id !== id);
  persist();
}

// ---------- Fotos (als data: URLs in localStorage) ----------
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
export async function uploadPhotos(entryId, files) {
  await delay();
  requireAuth();
  const entry = db.entries.find(e => e.id === entryId);
  if (!entry) throw new ApiError('Probe nicht gefunden.', 404);
  const now = new Date().toISOString();
  const added = [];
  for (const file of files) {
    const dataUrl = await fileToDataUrl(file);
    const photo = { id: uid(), filename: file.name, originalName: file.name, mimeType: file.type, takenAt: now, dataUrl };
    entry.photos.push(photo);
    const { dataUrl: _omit, ...meta } = photo;
    added.push(meta);
  }
  entry.updatedAt = now;
  persist();
  return added;
}
export async function deletePhotoApi(entryId, photoId) {
  await delay();
  requireAuth();
  const entry = db.entries.find(e => e.id === entryId);
  if (!entry) throw new ApiError('Probe nicht gefunden.', 404);
  entry.photos = entry.photos.filter(p => p.id !== photoId);
  persist();
}
export async function fetchPhotoBlob(entryId, photoId) {
  requireAuth();
  const entry = db.entries.find(e => e.id === entryId);
  const photo = entry?.photos.find(p => p.id === photoId);
  if (!photo) throw new ApiError('Foto nicht gefunden.', 404);
  const res = await fetch(photo.dataUrl);
  return res.blob();
}

// ---------- Grenzwerte ----------
export async function getThresholdsApi() {
  await delay();
  requireAuth();
  return JSON.parse(JSON.stringify(db.thresholds));
}
export async function saveThresholdsApi(thresholds) {
  await delay();
  requireAdmin();
  db.thresholds = thresholds;
  persist();
}
export async function resetThresholdsApi() {
  await delay();
  requireAdmin();
  db.thresholds = JSON.parse(JSON.stringify(DEMO_THRESHOLDS));
  persist();
  return db.thresholds;
}

// ---------- Parameter (Grenzwerte-Zeilen) ----------
export async function getParametersApi() {
  await delay();
  requireAuth();
  return JSON.parse(JSON.stringify(db.parameters));
}
export async function saveParametersApi(parameters) {
  await delay();
  requireAdmin();
  db.parameters = parameters;
  persist();
}
export async function resetParametersApi() {
  await delay();
  requireAdmin();
  db.parameters = JSON.parse(JSON.stringify(DEFAULT_PARAMETERS));
  persist();
  return db.parameters;
}

// ---------- VBBo-Grenzwerte ----------
export async function getVbboThresholdsApi() {
  await delay();
  requireAuth();
  return JSON.parse(JSON.stringify(db.vbboThresholds));
}
export async function saveVbboThresholdsApi(thresholds) {
  await delay();
  requireAdmin();
  db.vbboThresholds = thresholds;
  persist();
}
export async function resetVbboThresholdsApi() {
  await delay();
  requireAdmin();
  db.vbboThresholds = JSON.parse(JSON.stringify(DEFAULT_VBBO_THRESHOLDS));
  persist();
  return db.vbboThresholds;
}

// ---------- VBBo-Parameter ----------
export async function getVbboParametersApi() {
  await delay();
  requireAuth();
  return JSON.parse(JSON.stringify(db.vbboParameters));
}
export async function saveVbboParametersApi(parameters) {
  await delay();
  requireAdmin();
  db.vbboParameters = parameters;
  persist();
}
export async function resetVbboParametersApi() {
  await delay();
  requireAdmin();
  db.vbboParameters = JSON.parse(JSON.stringify(DEFAULT_VBBO_PARAMETERS));
  persist();
  return db.vbboParameters;
}

// ---------- VeVA-Codes ----------
export async function getVevaCodesApi() {
  await delay();
  requireAuth();
  return JSON.parse(JSON.stringify(db.vevaCodes));
}
export async function saveVevaCodesApi(codes) {
  await delay();
  requireAdmin();
  db.vevaCodes = codes;
  persist();
}
export async function resetVevaCodesApi() {
  await delay();
  requireAdmin();
  db.vevaCodes = JSON.parse(JSON.stringify(DEFAULT_VEVA_CODES));
  persist();
  return db.vevaCodes;
}

// ---------- Analytik-Programme ----------
export async function getAnalytikProgrammeApi() {
  await delay();
  requireAuth();
  return JSON.parse(JSON.stringify(db.analytikProgramme));
}
export async function saveAnalytikProgrammeApi(programme) {
  await delay();
  requireAdmin();
  db.analytikProgramme = programme;
  persist();
}
export async function resetAnalytikProgrammeApi() {
  await delay();
  requireAdmin();
  db.analytikProgramme = JSON.parse(JSON.stringify(DEFAULT_ANALYTIK_PROGRAMME));
  persist();
  return db.analytikProgramme;
}

// ---------- Benutzer (Admin) ----------
export async function listUsersApi() {
  await delay();
  requireAdmin();
  return db.users.map(({ password, ...safe }) => safe);
}
export async function createUserApi(user) {
  await delay();
  requireAdmin();
  if (!user.email || !user.name || !user.password) throw new ApiError('E-Mail, Name und Passwort erforderlich.', 400);
  if (user.password.length < 8) throw new ApiError('Passwort muss mindestens 8 Zeichen haben.', 400);
  const email = String(user.email).toLowerCase().trim();
  if (db.users.some(u => u.email === email)) throw new ApiError('Ein Benutzer mit dieser E-Mail existiert bereits.', 409);
  const created = { id: uid(), email, name: user.name, password: user.password, role: user.role === 'admin' ? 'admin' : 'user', createdAt: new Date().toISOString() };
  db.users.push(created);
  persist();
  const { password, ...safe } = created;
  return safe;
}
export async function deleteUserApi(id) {
  await delay();
  const me = requireAdmin();
  if (id === me.id) throw new ApiError('Eigenes Konto kann nicht gelöscht werden.', 400);
  db.users = db.users.filter(u => u.id !== id);
  persist();
}
export async function getUserRosterApi() {
  await delay();
  requireAuth();
  return db.users.map(u => ({ id: u.id, name: u.name }));
}

// ---------- Projekte ----------
export async function listProjectsApi() {
  await delay();
  requireAuth();
  return [...db.projects].sort((a, b) => a.name.localeCompare(b.name));
}
function sanitizeKuerzel(k) {
  return String(k || '').toUpperCase().replace(/[^A-Z0-9\-]/g, '').slice(0, 12);
}
function sanitizeList(list) {
  if (!Array.isArray(list)) return [];
  return list.map(s => String(s ?? '').trim()).filter(Boolean);
}
export async function createProjectApi(project) {
  await delay();
  const user = requireAuth();
  const kuerzel = sanitizeKuerzel(project.kuerzel);
  if (!project.name || !kuerzel) throw new ApiError('Projektname und Kürzel sind erforderlich.', 400);
  const created = {
    id: uid(), name: project.name, kuerzel,
    auftraggeber: project.auftraggeber || '', ort: project.ort || '', bemerkungen: project.bemerkungen || '',
    entsorgungswege: sanitizeList(project.entsorgungswege),
    entnahmeorte: sanitizeList(project.entnahmeorte),
    nextChargeNumber: 1, createdAt: new Date().toISOString(), createdBy: user.id,
  };
  db.projects.push(created);
  persist();
  return created;
}
export async function updateProjectApi(id, project) {
  await delay();
  requireAuth();
  const existing = db.projects.find(p => p.id === id);
  if (!existing) throw new ApiError('Projekt nicht gefunden.', 404);
  const kuerzel = sanitizeKuerzel(project.kuerzel);
  if (!project.name || !kuerzel) throw new ApiError('Projektname und Kürzel sind erforderlich.', 400);
  Object.assign(existing, {
    name: project.name, kuerzel,
    auftraggeber: project.auftraggeber || '', ort: project.ort || '', bemerkungen: project.bemerkungen || '',
    entsorgungswege: sanitizeList(project.entsorgungswege),
    entnahmeorte: sanitizeList(project.entnahmeorte),
  });
  persist();
  return existing;
}
export async function deleteProjectApi(id) {
  await delay();
  requireAuth();
  const used = db.entries.filter(e => e.projektId === id).length;
  if (used > 0) throw new ApiError(`Projekt hat noch ${used} Probe(n) und kann nicht gelöscht werden.`, 409);
  db.projects = db.projects.filter(p => p.id !== id);
  persist();
}
