// db.js — kleine IndexedDB-Hülle für Probennahme-Einträge (inkl. Foto-Blobs)
// und Projekte (Stammdaten für die automatische, fortlaufende Chargennamen-
// Vergabe je Projekt).
const DB_NAME = 'probennahmejournal';
const DB_VERSION = 2;
const STORE = 'entries';
const PROJECTS_STORE = 'projects';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt');
        store.createIndex('baustelle', 'baustelle');
      }
      if (!db.objectStoreNames.contains(PROJECTS_STORE)) {
        const pstore = db.createObjectStore(PROJECTS_STORE, { keyPath: 'id' });
        pstore.createIndex('name', 'name');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ---------- Einträge (Proben) ----------

export function newEntry(partial = {}) {
  const now = new Date().toISOString();
  return {
    id: uuid(),
    createdAt: now,
    updatedAt: now,
    projektId: null,
    baustelle: '',
    probeBezeichnung: '',
    entnahmeort: '',
    gps: null,
    material: '',
    probenehmer: '',
    bemerkungen: '',
    standard: 'vvea', // 'vvea' | 'vbbo'
    entsorgungsweg: '',
    vevaCode: '',
    labor: '', // Name des Labors, an das der Analysenauftrag ging (siehe Einstellungen > Labore)
    menge: null,
    mengeEinheit: 't', // 't' | 'm3'
    analytikProgramme: [], // Array gewählter Analytik-Programm-IDs
    photos: [], // {id, blob, filename, takenAt}
    analyse: [], // {parameterKey, wert, art, quelle}
    klassifizierung: null,
    ...partial,
  };
}

export async function saveEntry(entry) {
  entry.updatedAt = new Date().toISOString();
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(entry);
    tx.oncomplete = () => resolve(entry);
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteEntry(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getEntry(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllEntries() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => {
      const list = req.result || [];
      list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      resolve(list);
    };
    req.onerror = () => reject(req.error);
  });
}

// ---------- Projekte ----------

export function newProject(partial = {}) {
  return {
    id: uuid(),
    name: '', kuerzel: '', auftraggeber: '', ort: '', bemerkungen: '',
    entsorgungswege: [], // vordefinierte Entsorgungswege (Dropdown bei der Probe)
    entnahmeorte: [],    // vordefinierte Beprobungsorte (Dropdown bei der Probe)
    nextChargeNumber: 1,
    createdAt: new Date().toISOString(),
    ...partial,
  };
}

export async function saveProject(project) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROJECTS_STORE, 'readwrite');
    tx.objectStore(PROJECTS_STORE).put(project);
    tx.oncomplete = () => resolve(project);
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteProject(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROJECTS_STORE, 'readwrite');
    tx.objectStore(PROJECTS_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getProject(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROJECTS_STORE, 'readonly');
    const req = tx.objectStore(PROJECTS_STORE).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllProjects() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROJECTS_STORE, 'readonly');
    const req = tx.objectStore(PROJECTS_STORE).getAll();
    req.onsuccess = () => {
      const list = req.result || [];
      list.sort((a, b) => a.name.localeCompare(b.name));
      resolve(list);
    };
    req.onerror = () => reject(req.error);
  });
}

// ---------- Fortlaufende Nummer für Einzelproben ohne Projekt (PP-0001, …) ----------
// Global statt pro Projekt, da kein Kürzel vorhanden ist — analog zur
// serverseitigen Zählung in server/src/routes/entries.js, hier einfach als
// Zahl in localStorage (Einzelbenutzer/Offline, keine Nebenläufigkeit).
const STANDALONE_SEQ_KEY = 'pnj_standalone_seq';

export function nextStandaloneNumber() {
  const next = (parseInt(localStorage.getItem(STANDALONE_SEQ_KEY), 10) || 0) + 1;
  localStorage.setItem(STANDALONE_SEQ_KEY, String(next));
  return next;
}

// ---------- Zuletzt verwendete Probenehmer/innen (für die Dropdown-Vorauswahl) ----------
const RECENT_NAMES_KEY = 'pnj_recent_probenehmer';

export function getRecentProbenehmer() {
  try { return JSON.parse(localStorage.getItem(RECENT_NAMES_KEY) || '[]'); } catch { return []; }
}
export function rememberProbenehmer(name) {
  if (!name) return;
  const list = getRecentProbenehmer().filter(n => n !== name);
  list.unshift(name);
  localStorage.setItem(RECENT_NAMES_KEY, JSON.stringify(list.slice(0, 10)));
}
