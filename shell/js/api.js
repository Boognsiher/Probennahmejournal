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
  { code: '17 05 04', bezeichnung: 'Ober-/Unterboden – unbelastet', materialien: ['Oberboden', 'Unterboden'], klassen: ['unbelastet'] },
  { code: '17 05 93', bezeichnung: 'Ober-/Unterboden – schwach belastet (Typ A)', materialien: ['Oberboden', 'Unterboden'], klassen: ['typA'] },
  { code: '17 05 96 [ak]', bezeichnung: 'Ober-/Unterboden – wenig belastet, Inertstoff (Typ B)', materialien: ['Oberboden', 'Unterboden'], klassen: ['typB'] },
  { code: '17 05 90 [akb]', bezeichnung: 'Ober-/Unterboden – stark belastet (Typ C/D/E)', materialien: ['Oberboden', 'Unterboden'], klassen: ['typC', 'typD', 'typE'] },
  { code: '17 05 03 [S]', bezeichnung: 'Abgetragener Ober-/Unterboden, durch gefährliche Stoffe verunreinigt (Sonderabfall)', materialien: ['Oberboden', 'Unterboden'], klassen: ['sonderfall'] },
  { code: '17 05 06', bezeichnung: 'Aushub – unverschmutzt', materialien: ['Aushub'], klassen: ['unbelastet'] },
  { code: '17 05 94', bezeichnung: 'Aushub – schwach verschmutzt (Typ A)', materialien: ['Aushub'], klassen: ['typA'] },
  { code: '17 05 97 [ak]', bezeichnung: 'Aushub – wenig verschmutzt, Inertstoff (Typ B)', materialien: ['Aushub'], klassen: ['typB'] },
  { code: '17 05 91 [akb]', bezeichnung: 'Aushub – stark verschmutzt (Typ C/D/E)', materialien: ['Aushub'], klassen: ['typC', 'typD', 'typE'] },
  { code: '17 05 05 [S]', bezeichnung: 'Aushub- und Ausbruchmaterial, durch gefährliche Stoffe verunreinigt (Sonderabfall)', materialien: ['Aushub'], klassen: ['sonderfall'] },
];

// Materialien: siehe server/src/vvea-defaults.js für die vollständige
// Erklärung — hier dieselbe Startauswahl für die Test-Schale.
const DEFAULT_MATERIALIEN = [
  { id: 'oberboden', name: 'Humus/Oberboden', standard: 'vbbo', vevaBucket: 'Oberboden' },
  { id: 'unterboden', name: 'Unterboden', standard: 'vbbo', vevaBucket: 'Unterboden' },
  { id: 'aushub_unverschmutzt', name: 'Unverschmutzter Aushub', standard: 'vvea', vevaBucket: 'Aushub' },
  { id: 'aushub_allgemein', name: 'Aushub (allgemein)', standard: 'vvea', vevaBucket: 'Aushub' },
  { id: 'kies_sand', name: 'Kies/Sand', standard: 'vvea', vevaBucket: '' },
  { id: 'mischabbruch', name: 'Mischabbruch', standard: 'vvea', vevaBucket: '' },
  { id: 'betonabbruch', name: 'Betonabbruch', standard: 'vvea', vevaBucket: '' },
  { id: 'asphalt', name: 'Asphalt', standard: 'vvea', vevaBucket: '' },
  { id: 'ziegel_mauerwerk', name: 'Ziegel/Mauerwerk', standard: 'vvea', vevaBucket: '' },
  { id: 'bauschutt_gemischt', name: 'Bauschutt gemischt', standard: 'vvea', vevaBucket: '' },
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

// Labore: siehe server/src/vvea-defaults.js für die vollständige Erklärung —
// hier dieselbe Startauswahl für die Test-Schale. email/adresse/telefon
// bewusst leer (echte Kontaktdaten müssen ergänzt werden).
const DEFAULT_LABORE = [
  { id: 'bachema', name: 'Bachema AG', ort: 'Schlieren', email: '', adresse: '', telefon: '' },
  { id: 'nuitec', name: 'Nuitec', ort: 'Winterthur', email: '', adresse: '', telefon: '' },
  { id: 'eurofins', name: 'Eurofins', ort: 'Deutschland', email: '', adresse: '', telefon: '' },
];

// v11: Rollenmodell admin/projektleiter/probenehmer/extern ergänzt (siehe
// canView-/canManage-/canWriteInProject unten, Löschantrag-Workflow,
// externe Einzelfreigabe je Probe, VVEA-Grenzwert-Änderungsanträge). Version
// angehoben, damit bereits laufende Test-Sessions die neuen Demo-Konten und
// Datenfelder erhalten (alte Rolle "user" existiert nicht mehr).
const DB_KEY = 'pnj_mock_db_v11';
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
  const adminId = uid();
  const projektleiterId = uid();
  return {
    users: [
      { id: adminId, email: 'admin@demo.ch', password: 'demo1234', name: 'Demo Admin', role: 'admin', createdAt: now },
      { id: projektleiterId, email: 'leitung@demo.ch', password: 'demo1234', name: 'Demo Projektleitung', role: 'projektleiter', createdAt: now },
      { id: uid(), email: 'team@demo.ch', password: 'demo1234', name: 'Demo Probenehmer/in', role: 'probenehmer', createdAt: now },
      { id: uid(), email: 'extern@demo.ch', password: 'demo1234', name: 'Demo Extern', role: 'extern', createdAt: now },
    ],
    projects: [
      {
        id: uid(), name: 'Demo Baustelle Zürich', kuerzel: 'DEMO', auftraggeber: 'Muster AG', ort: 'Zürich', bemerkungen: '',
        entsorgungswege: ['Deponie Muster AG, Zürich', 'Aushubdeponie Musterhausen'],
        entnahmeorte: ['Baugrube Nord, Schicht 1', 'Baugrube Süd, Schicht 2'],
        probenehmerZugriff: [],
        nextChargeNumber: 1, createdAt: now, createdBy: projektleiterId,
      },
    ],
    entries: [],
    standaloneCounter: 0, // fortlaufende Nummer für Einzelproben ohne Projekt (PP-####)
    thresholdRequests: [],
    thresholds: JSON.parse(JSON.stringify(DEMO_THRESHOLDS)),
    parameters: JSON.parse(JSON.stringify(DEFAULT_PARAMETERS)),
    vbboThresholds: JSON.parse(JSON.stringify(DEFAULT_VBBO_THRESHOLDS)),
    vbboParameters: JSON.parse(JSON.stringify(DEFAULT_VBBO_PARAMETERS)),
    vevaCodes: JSON.parse(JSON.stringify(DEFAULT_VEVA_CODES)),
    analytikProgramme: JSON.parse(JSON.stringify(DEFAULT_ANALYTIK_PROGRAMME)),
    materialien: JSON.parse(JSON.stringify(DEFAULT_MATERIALIEN)),
    labore: JSON.parse(JSON.stringify(DEFAULT_LABORE)),
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
function requireRole(...roles) {
  const user = requireAuth();
  if (!roles.includes(user.role)) throw new ApiError('Dafür fehlt die Berechtigung.', 403);
  return user;
}
function stripPhotoData(entry) {
  return { ...entry, photos: (entry.photos || []).map(({ dataUrl, ...meta }) => meta) };
}

// ---------- Rollen/Sichtbarkeit (bildet server/src/routes/projects.js +
// entries.js nach — siehe dort für die ausführliche Erklärung) ----------
function canViewProject(project, user) {
  if (!project || !user) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'projektleiter') return project.createdBy === user.id;
  if (user.role === 'probenehmer') return (project.probenehmerZugriff || []).includes(user.id);
  return false; // extern: kein Projekt-Scope, nur einzelne Proben
}
function canManageProject(project, user) {
  if (!project || !user) return false;
  if (user.role === 'admin') return true;
  return user.role === 'projektleiter' && project.createdBy === user.id;
}
function canWriteInProject(project, user) {
  if (!project || !user) return false;
  if (canManageProject(project, user)) return true;
  return user.role === 'probenehmer' && (project.probenehmerZugriff || []).includes(user.id);
}
function visibleProjects(user) {
  return db.projects.filter(p => canViewProject(p, user));
}
// Eigenständige Probe ohne Projekt ("Probenahmeprotokoll"/Scratchbook, siehe
// server/src/routes/entries.js für die ausführliche Erklärung) — jede Rolle
// ausser 'extern' kann sich selbst welche anlegen; sichtbar nur für
// Ersteller/in + Admin, keine externe Freigabe möglich.
function isStandalone(entry) { return !entry.projektId; }
function canViewEntry(entry, user) {
  if (user.role === 'extern') return (entry.externZugriff || []).includes(user.id);
  if (isStandalone(entry)) return user.role === 'admin' || entry.createdBy === user.id;
  const project = db.projects.find(p => p.id === entry.projektId);
  return canViewProject(project, user);
}
function canWriteEntry(entry, user) {
  if (isStandalone(entry)) return user.role !== 'extern' && (user.role === 'admin' || entry.createdBy === user.id);
  const project = db.projects.find(p => p.id === entry.projektId);
  return canWriteInProject(project, user);
}
function canManageEntry(entry, user) {
  if (isStandalone(entry)) return user.role === 'admin' || entry.createdBy === user.id;
  const project = db.projects.find(p => p.id === entry.projektId);
  return canManageProject(project, user);
}
function sanitizeUserIds(list) {
  if (!Array.isArray(list)) return [];
  const known = new Set(db.users.map(u => u.id));
  return [...new Set(list.map(String))].filter(id => known.has(id));
}
// Fortlaufende Nummer für Einzelproben-Chargennamen (PP-0001, PP-0002, …).
function nextStandaloneNumber() {
  db.standaloneCounter = (db.standaloneCounter || 0) + 1;
  return db.standaloneCounter;
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
  const user = requireAuth();
  return [...db.entries].filter(e => canViewEntry(e, user))
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).map(stripPhotoData);
}
export async function getEntryApi(id) {
  await delay();
  const user = requireAuth();
  const entry = db.entries.find(e => e.id === id);
  if (!entry || !canViewEntry(entry, user)) throw new ApiError('Probe nicht gefunden.', 404);
  return stripPhotoData(entry);
}

function commonEntryFields(entry) {
  return {
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
    labor: entry.labor || '',
  };
}

// Chargenname (Probenbezeichnung) wird ausschliesslich hier vergeben — analog
// zum echten Server — bei Projekt-Proben aus Projekt-Kürzel + fortlaufender
// Nummer, bei Einzelproben (kein Projekt) aus der globalen PP-Nummerierung.
export async function createEntryApi(entry) {
  await delay();
  const user = requireAuth();

  // Eigenständige Probe ohne Projekt ("Probenahmeprotokoll"/Scratchbook).
  if (!entry.projektId) {
    if (user.role === 'extern') throw new ApiError('Dafür fehlt die Berechtigung.', 403);
    const now = new Date().toISOString();
    const created = {
      id: uid(),
      createdAt: entry.createdAt || now,
      updatedAt: now,
      projektId: null,
      baustelle: 'Einzelprobe (ohne Projekt)',
      probeBezeichnung: `PP-${String(nextStandaloneNumber()).padStart(4, '0')}`,
      ...commonEntryFields(entry),
      // Einzelproben unterstützen keine externe Freigabe (kein Projekt-Kontext).
      externZugriff: [],
      deletionRequestedAt: null,
      deletionRequestedBy: null,
      createdBy: user.id,
      photos: [],
    };
    db.entries.push(created);
    persist();
    return stripPhotoData(created);
  }

  const project = db.projects.find(p => p.id === entry.projektId);
  if (!project) throw new ApiError('Projekt nicht gefunden.', 400);
  if (!canWriteInProject(project, user)) throw new ApiError('Dafür fehlt die Berechtigung.', 403);
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
    ...commonEntryFields(entry),
    // externZugriff beim Anlegen nur übernehmen, wenn die anlegende Person auch
    // verwalten darf — Probenehmer/innen können beim Erfassen keine externe
    // Sichtbarkeit vergeben (siehe server/src/routes/entries.js upsertFields).
    externZugriff: canManageProject(project, user) ? sanitizeUserIds(entry.externZugriff) : [],
    deletionRequestedAt: null,
    deletionRequestedBy: null,
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
  const user = requireAuth();
  const existing = db.entries.find(e => e.id === id);
  if (!existing) throw new ApiError('Probe nicht gefunden.', 404);
  if (!canWriteEntry(existing, user)) throw new ApiError('Dafür fehlt die Berechtigung.', 403);
  const manage = canManageEntry(existing, user);
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
    labor: entry.labor ?? '',
    // externZugriff darf nur ändern, wer die Probe auch verwaltet — sonst bleibt der
    // bisherige Wert; bei Einzelproben immer leer (keine externe Freigabe möglich).
    externZugriff: isStandalone(existing) ? [] : (manage ? sanitizeUserIds(entry.externZugriff ?? existing.externZugriff) : existing.externZugriff),
    updatedAt: new Date().toISOString(),
  });
  persist();
  return stripPhotoData(existing);
}
// Admin, zuständige Projektleitung, und bei Einzelproben die erstellende
// Person selbst löschen sofort (gibt `null` zurück — bei Einzelproben gibt
// es keine Projektleitung, die einen Antrag entscheiden könnte). Sonst können
// Probenehmer/innen mit Schreibzugriff nur eine Löschung BEANTRAGEN (gibt
// {entry, message} zurück) — braucht Freigabe, siehe approveDeleteApi.
export async function deleteEntryApi(id) {
  await delay();
  const user = requireAuth();
  const existing = db.entries.find(e => e.id === id);
  if (!existing) throw new ApiError('Probe nicht gefunden.', 404);
  if (canManageEntry(existing, user)) {
    db.entries = db.entries.filter(e => e.id !== id);
    persist();
    return null;
  }
  if (!isStandalone(existing) && user.role === 'probenehmer' && canWriteInProject(db.projects.find(p => p.id === existing.projektId), user)) {
    existing.deletionRequestedAt = new Date().toISOString();
    existing.deletionRequestedBy = user.id;
    persist();
    return { entry: stripPhotoData(existing), message: 'Löschung beantragt — braucht Freigabe der Projektleitung.' };
  }
  throw new ApiError('Dafür fehlt die Berechtigung.', 403);
}
export async function cancelDeleteRequestApi(id) {
  await delay();
  const user = requireAuth();
  const existing = db.entries.find(e => e.id === id);
  if (!existing) throw new ApiError('Probe nicht gefunden.', 404);
  const isRequester = existing.deletionRequestedBy === user.id;
  if (!isRequester && !canManageEntry(existing, user)) throw new ApiError('Dafür fehlt die Berechtigung.', 403);
  existing.deletionRequestedAt = null;
  existing.deletionRequestedBy = null;
  persist();
  return stripPhotoData(existing);
}
export async function approveDeleteApi(id) {
  await delay();
  const user = requireAuth();
  const existing = db.entries.find(e => e.id === id);
  if (!existing) throw new ApiError('Probe nicht gefunden.', 404);
  if (!canManageEntry(existing, user)) throw new ApiError('Dafür fehlt die Berechtigung.', 403);
  if (!existing.deletionRequestedAt) throw new ApiError('Kein offener Löschantrag für diese Probe.', 400);
  db.entries = db.entries.filter(e => e.id !== id);
  persist();
}
export async function rejectDeleteApi(id) {
  await delay();
  const user = requireAuth();
  const existing = db.entries.find(e => e.id === id);
  if (!existing) throw new ApiError('Probe nicht gefunden.', 404);
  if (!canManageEntry(existing, user)) throw new ApiError('Dafür fehlt die Berechtigung.', 403);
  existing.deletionRequestedAt = null;
  existing.deletionRequestedBy = null;
  persist();
  return stripPhotoData(existing);
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

// ---------- Änderungsanträge VVEA-Grenzwerte (Projektleitung -> Admin) ----------
// Projektleiter dürfen Grenzwerte nicht direkt speichern (siehe
// saveThresholdsApi oben, weiterhin nur admin), können aber eine Anpassung
// VORSCHLAGEN — Admin sieht die Anträge und übernimmt oder lehnt ab.
export async function listThresholdRequestsApi() {
  await delay();
  const user = requireRole('admin', 'projektleiter');
  const rows = user.role === 'admin' ? db.thresholdRequests : db.thresholdRequests.filter(r => r.requestedBy === user.id);
  return rows.map(r => ({ ...r, requestedByName: db.users.find(u => u.id === r.requestedBy)?.name || null }))
    .sort((a, b) => (b.requestedAt || '').localeCompare(a.requestedAt || ''));
}
export async function requestThresholdChangeApi(thresholds, note = '') {
  await delay();
  const user = requireRole('admin', 'projektleiter');
  const id = uid();
  db.thresholdRequests.push({ id, thresholds: JSON.parse(JSON.stringify(thresholds)), note: String(note || '').slice(0, 500), requestedAt: new Date().toISOString(), requestedBy: user.id });
  persist();
  return id;
}
export async function cancelThresholdRequestApi(id) {
  await delay();
  const user = requireRole('admin', 'projektleiter');
  const row = db.thresholdRequests.find(r => r.id === id);
  if (!row) throw new ApiError('Antrag nicht gefunden.', 404);
  if (user.role !== 'admin' && row.requestedBy !== user.id) throw new ApiError('Dafür fehlt die Berechtigung.', 403);
  db.thresholdRequests = db.thresholdRequests.filter(r => r.id !== id);
  persist();
}
export async function applyThresholdRequestApi(id) {
  await delay();
  requireAdmin();
  const row = db.thresholdRequests.find(r => r.id === id);
  if (!row) throw new ApiError('Antrag nicht gefunden.', 404);
  db.thresholds = row.thresholds;
  db.thresholdRequests = db.thresholdRequests.filter(r => r.id !== id);
  persist();
  return db.thresholds;
}
export async function rejectThresholdRequestApi(id) {
  await delay();
  requireAdmin();
  const before = db.thresholdRequests.length;
  db.thresholdRequests = db.thresholdRequests.filter(r => r.id !== id);
  if (db.thresholdRequests.length === before) throw new ApiError('Antrag nicht gefunden.', 404);
  persist();
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
// Anders als die übrigen Grenzwerte/Codes dürfen Analytik-Programme auch von
// der Projektleitung direkt bearbeitet werden (projektbezogene Auswahl,
// keine sicherheitskritische Konfiguration) — siehe server/src/routes/settings.js.
export async function saveAnalytikProgrammeApi(programme) {
  await delay();
  requireRole('admin', 'projektleiter');
  db.analytikProgramme = programme;
  persist();
}
export async function resetAnalytikProgrammeApi() {
  await delay();
  requireRole('admin', 'projektleiter');
  db.analytikProgramme = JSON.parse(JSON.stringify(DEFAULT_ANALYTIK_PROGRAMME));
  persist();
  return db.analytikProgramme;
}

// ---------- Materialien ----------
export async function getMaterialienApi() {
  await delay();
  requireAuth();
  return JSON.parse(JSON.stringify(db.materialien));
}
export async function saveMaterialienApi(materialien) {
  await delay();
  requireAdmin();
  db.materialien = materialien;
  persist();
}
export async function resetMaterialienApi() {
  await delay();
  requireAdmin();
  db.materialien = JSON.parse(JSON.stringify(DEFAULT_MATERIALIEN));
  persist();
  return db.materialien;
}

// ---------- Labore ----------
export async function getLaboreApi() {
  await delay();
  requireAuth();
  return JSON.parse(JSON.stringify(db.labore));
}
export async function saveLaboreApi(labore) {
  await delay();
  requireAdmin();
  db.labore = labore;
  persist();
}
export async function resetLaboreApi() {
  await delay();
  requireAdmin();
  db.labore = JSON.parse(JSON.stringify(DEFAULT_LABORE));
  persist();
  return db.labore;
}

// ---------- Benutzer (Admin) ----------
export async function listUsersApi() {
  await delay();
  requireAdmin();
  return db.users.map(({ password, ...safe }) => safe);
}
const ROLES = ['admin', 'projektleiter', 'probenehmer', 'extern'];
export async function createUserApi(user) {
  await delay();
  requireAdmin();
  if (!user.email || !user.name || !user.password) throw new ApiError('E-Mail, Name und Passwort erforderlich.', 400);
  if (user.password.length < 8) throw new ApiError('Passwort muss mindestens 8 Zeichen haben.', 400);
  const email = String(user.email).toLowerCase().trim();
  if (db.users.some(u => u.email === email)) throw new ApiError('Ein Benutzer mit dieser E-Mail existiert bereits.', 409);
  const created = { id: uid(), email, name: user.name, password: user.password, role: ROLES.includes(user.role) ? user.role : 'probenehmer', createdAt: new Date().toISOString() };
  db.users.push(created);
  persist();
  const { password, ...safe } = created;
  return safe;
}
// Rolle eines bestehenden Kontos ändern — eigene Rolle kann nicht selbst
// geändert werden (verhindert, dass sich der letzte Admin aussperrt).
export async function updateUserRoleApi(id, role) {
  await delay();
  const me = requireAdmin();
  if (id === me.id) throw new ApiError('Eigene Rolle kann nicht selbst geändert werden.', 400);
  if (!ROLES.includes(role)) throw new ApiError('Ungültige Rolle.', 400);
  const user = db.users.find(u => u.id === id);
  if (!user) throw new ApiError('Benutzer nicht gefunden.', 404);
  user.role = role;
  persist();
  const { password, ...safe } = user;
  return safe;
}
// Kein Self-Service-Passwort-Reset per E-Mail (die App verschickt keine
// E-Mails) — der Admin setzt hier direkt ein neues Passwort, auch fürs
// eigene Konto.
export async function updateUserPasswordApi(id, password) {
  await delay();
  requireAdmin();
  if (!password || password.length < 8) throw new ApiError('Passwort muss mindestens 8 Zeichen haben.', 400);
  const user = db.users.find(u => u.id === id);
  if (!user) throw new ApiError('Benutzer nicht gefunden.', 404);
  user.password = password;
  persist();
}
export async function deleteUserApi(id) {
  await delay();
  const me = requireAdmin();
  if (id === me.id) throw new ApiError('Eigenes Konto kann nicht gelöscht werden.', 400);
  db.users = db.users.filter(u => u.id !== id);
  persist();
}
// Namensliste für Dropdowns — jede angemeldete Person darf sie sehen,
// `role` wird mitgeliefert (z.B. damit eine Projektleitung nach Rolle filtern kann).
export async function getUserRosterApi() {
  await delay();
  requireAuth();
  return db.users.map(u => ({ id: u.id, name: u.name, role: u.role }));
}

// ---------- Projekte ----------
export async function listProjectsApi() {
  await delay();
  const user = requireAuth();
  return visibleProjects(user).sort((a, b) => a.name.localeCompare(b.name));
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
  const user = requireRole('admin', 'projektleiter');
  const kuerzel = sanitizeKuerzel(project.kuerzel);
  if (!project.name || !kuerzel) throw new ApiError('Projektname und Kürzel sind erforderlich.', 400);
  const created = {
    id: uid(), name: project.name, kuerzel,
    auftraggeber: project.auftraggeber || '', ort: project.ort || '', bemerkungen: project.bemerkungen || '',
    entsorgungswege: sanitizeList(project.entsorgungswege),
    entnahmeorte: sanitizeList(project.entnahmeorte),
    probenehmerZugriff: sanitizeUserIds(project.probenehmerZugriff),
    nextChargeNumber: 1, createdAt: new Date().toISOString(), createdBy: user.id,
  };
  db.projects.push(created);
  persist();
  return created;
}
export async function updateProjectApi(id, project) {
  await delay();
  const user = requireAuth();
  const existing = db.projects.find(p => p.id === id);
  if (!existing) throw new ApiError('Projekt nicht gefunden.', 404);
  if (!canManageProject(existing, user)) throw new ApiError('Dafür fehlt die Berechtigung.', 403);
  const kuerzel = sanitizeKuerzel(project.kuerzel);
  if (!project.name || !kuerzel) throw new ApiError('Projektname und Kürzel sind erforderlich.', 400);
  Object.assign(existing, {
    name: project.name, kuerzel,
    auftraggeber: project.auftraggeber || '', ort: project.ort || '', bemerkungen: project.bemerkungen || '',
    entsorgungswege: sanitizeList(project.entsorgungswege),
    entnahmeorte: sanitizeList(project.entnahmeorte),
    probenehmerZugriff: sanitizeUserIds(project.probenehmerZugriff),
  });
  persist();
  return existing;
}
export async function deleteProjectApi(id) {
  await delay();
  const user = requireAuth();
  const existing = db.projects.find(p => p.id === id);
  if (!existing) throw new ApiError('Projekt nicht gefunden.', 404);
  if (!canManageProject(existing, user)) throw new ApiError('Dafür fehlt die Berechtigung.', 403);
  const used = db.entries.filter(e => e.projektId === id).length;
  if (used > 0) throw new ApiError(`Projekt hat noch ${used} Probe(n) und kann nicht gelöscht werden.`, 409);
  db.projects = db.projects.filter(p => p.id !== id);
  persist();
}
