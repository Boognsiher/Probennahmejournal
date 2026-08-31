import {
  listEntries, getEntryApi, createEntryApi, updateEntryApi, deleteEntryApi,
  uploadPhotos, deletePhotoApi, fetchPhotoBlob,
  getThresholdsApi, saveThresholdsApi, resetThresholdsApi,
  getParametersApi, saveParametersApi, resetParametersApi,
  getVbboThresholdsApi, saveVbboThresholdsApi, resetVbboThresholdsApi,
  getVbboParametersApi, saveVbboParametersApi, resetVbboParametersApi,
  getVevaCodesApi, saveVevaCodesApi, resetVevaCodesApi,
  getAnalytikProgrammeApi, saveAnalytikProgrammeApi, resetAnalytikProgrammeApi,
  getMaterialienApi, saveMaterialienApi, resetMaterialienApi,
  getLaboreApi, saveLaboreApi, resetLaboreApi,
  getUnsereFirmaApi, saveUnsereFirmaApi, resetUnsereFirmaApi,
  listUsersApi, createUserApi, deleteUserApi, updateUserRoleApi, updateUserPasswordApi, getUserRosterApi,
  listProjectsApi, createProjectApi, updateProjectApi, deleteProjectApi,
  cancelDeleteRequestApi, approveDeleteApi, rejectDeleteApi,
  listThresholdRequestsApi, requestThresholdChangeApi, cancelThresholdRequestApi,
  applyThresholdRequestApi, rejectThresholdRequestApi,
  login, logout, isLoggedIn, getCurrentUser, ApiError,
} from './api.js';
import {
  CLASSES, PARAMETERS, DEFAULT_PARAMETERS, classify, setParameters, slugifyParamKey,
  parseThresholdsCSV, buildThresholdsCSVTemplate,
  hasAcknowledgedDisclaimer, acknowledgeDisclaimer,
  VBBO_CLASSES, NUTZUNGSARTEN, VBBO_PARAMETERS, DEFAULT_VBBO_PARAMETERS,
  setVbboParameters, classifyVBBO, suggestVevaCode, materialToStandard,
  buildVbboThresholdsForNutzung,
} from './vvea.js';
import { parseCSV } from './parse-csv.js';
import { parsePDF } from './parse-pdf.js';
import { generateReportHTML, downloadHTML } from './report.js';
import { buildMailto, buildMailSummary, buildLabOrderMailto, buildLabOrderMailSummary, buildLabelQrText } from './email.js';
import { generateReportPDF, generateLabOrderPDF, downloadBlob, sharePDFOrDownload } from './report-pdf.js';
import { printLabel, loadLabelSize, saveLabelSize } from './label.js';
import { buildNiutecProposal, fillNiutecPdf, NIUTEC_CHECKBOX_LABELS } from './niutec-form.js';

const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const appEl = $('#app');
const ANDERE = '__andere__';

// Aktives Projekt: rein geräte-/browserlokale UI-Vorauswahl (nicht mit dem
// Server/anderen Benutzer:innen geteilt) — bestimmt, worauf neue Proben und
// der Journal-Filter standardmässig zeigen, bis explizit gewechselt wird.
const STORAGE_KEY_ACTIVE_PROJECT = 'pnj_active_project_id';
const STORAGE_KEY_ACTIVE_PROJECT_NAME = 'pnj_active_project_name';
function getActiveProjectId() { return localStorage.getItem(STORAGE_KEY_ACTIVE_PROJECT) || null; }
function getActiveProjectName() { return localStorage.getItem(STORAGE_KEY_ACTIVE_PROJECT_NAME) || ''; }
function setActiveProject(id, name) {
  if (id) {
    localStorage.setItem(STORAGE_KEY_ACTIVE_PROJECT, id);
    localStorage.setItem(STORAGE_KEY_ACTIVE_PROJECT_NAME, name || '');
  } else {
    localStorage.removeItem(STORAGE_KEY_ACTIVE_PROJECT);
    localStorage.removeItem(STORAGE_KEY_ACTIVE_PROJECT_NAME);
  }
}

function pad3(n) { return String(n).padStart(3, '0'); }

function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 250); }, 3400);
}

function fmtDate(iso) {
  try { return new Date(iso).toLocaleString('de-CH'); } catch { return iso; }
}

function fmtMenge(entry) {
  if (entry.menge === null || entry.menge === undefined || entry.menge === '') return '';
  return `${entry.menge} ${entry.mengeEinheit === 'm3' ? 'm³' : 't'}`;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function errMsg(err) {
  return err instanceof ApiError ? err.message : (err?.message || 'Unbekannter Fehler.');
}

// ---------- Rollen ----------
// admin: alles. projektleiter: eigene Projekte anlegen/verwalten, darin
// Zugriff für Probenehmer/innen und externe Sichtbarkeit je Probe steuern.
// probenehmer: in freigegebenen Projekten Proben anlegen/bearbeiten, Löschen
// nur als Antrag (braucht Freigabe). extern: nur lesen, nur einzeln
// freigegebene Proben.
function isAdmin(me) { return me?.role === 'admin'; }
function isProjektleiter(me) { return me?.role === 'projektleiter'; }
function isProbenehmer(me) { return me?.role === 'probenehmer'; }
function isExtern(me) { return me?.role === 'extern'; }
function canManageProjects(me) { return isAdmin(me) || isProjektleiter(me); }
// true, wenn `me` dieses konkrete Projekt anlegen/bearbeiten/löschen bzw.
// dessen Zugriffslisten verwalten darf (muss mit projects.js canManageProject
// serverseitig übereinstimmen — hier nur für die UI, der Server prüft ohnehin).
function canManageThisProject(me, project) {
  return isAdmin(me) || (isProjektleiter(me) && project?.createdBy === me.id);
}

// ---------- Disclaimer ----------
function initDisclaimer() {
  const el = $('#disclaimer');
  if (!hasAcknowledgedDisclaimer()) el.classList.remove('hidden'); else el.classList.add('hidden');
  $('#ack-disclaimer').addEventListener('click', () => {
    acknowledgeDisclaimer();
    el.classList.add('hidden');
  });
}

// ---------- Topbar / Auth-Status ----------
const ROLE_LABELS = { admin: 'Admin', projektleiter: 'Projektleitung', probenehmer: 'Probenehmer/in', extern: 'Extern' };

function paintTopbar() {
  document.body.classList.toggle('logged-out', !isLoggedIn());
  document.body.classList.remove('role-admin', 'role-projektleiter', 'role-probenehmer', 'role-extern');
  const me = getCurrentUser();
  if (me?.role) document.body.classList.add(`role-${me.role}`);
  let projectBox = $('#project-box');
  if (!projectBox) {
    projectBox = document.createElement('div');
    projectBox.id = 'project-box';
    projectBox.className = 'hint';
    $('.topbar').insertBefore(projectBox, $('.tabs'));
  }
  const activeName = getActiveProjectName();
  projectBox.innerHTML = isLoggedIn() && activeName
    ? `📍 ${escapeHtml(activeName)} · <a href="#/start">Projekt wechseln</a>`
    : '';
  let userBox = $('#user-box');
  if (!userBox) {
    userBox = document.createElement('div');
    userBox.id = 'user-box';
    userBox.className = 'user-box';
    $('.topbar').appendChild(userBox);
  }
  const user = getCurrentUser();
  if (user) {
    const roleLabel = ROLE_LABELS[user.role] || user.role;
    userBox.innerHTML = `<span class="hint">${escapeHtml(user.name)} (${escapeHtml(roleLabel)})</span>
      <button class="btn secondary" id="btn-logout" type="button">Abmelden</button>`;
    $('#btn-logout').addEventListener('click', () => {
      logout();
      paintTopbar();
      location.hash = '#/login';
      route();
    });
  } else {
    userBox.innerHTML = '';
  }
}

// ---------- Router ----------
function setActiveTab(route) {
  $$('.tabs a').forEach(a => a.classList.toggle('active', a.dataset.route === route));
}

async function route() {
  paintTopbar();
  const hash = location.hash || '#/start';

  if (!isLoggedIn()) {
    renderLogin();
    return;
  }
  if (hash === '#/login') { location.hash = '#/start'; return; }

  const parts = hash.replace('#/', '').split('/');
  try {
    if (parts[0] === 'eintrag') {
      setActiveTab('eintrag');
      await renderEntryForm(parts[1] || 'neu');
    } else if (parts[0] === 'projekte') {
      setActiveTab('projekte');
      await renderProjects();
    } else if (parts[0] === 'einstellungen') {
      setActiveTab('einstellungen');
      await renderSettings();
    } else if (parts[0] === 'journal') {
      setActiveTab('journal');
      await renderJournal();
    } else if (parts[0] === 'protokoll') {
      setActiveTab('protokoll');
      await renderProtokoll();
    } else {
      setActiveTab('start');
      await renderStart();
    }
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      renderLogin();
    } else {
      appEl.innerHTML = `<div class="card"><p>Fehler: ${escapeHtml(errMsg(err))}</p></div>`;
    }
  }
}
window.addEventListener('hashchange', route);

// ---------- Login ----------
function renderLogin() {
  document.body.classList.add('logged-out');
  appEl.innerHTML = `
    <div class="card" style="max-width:360px;margin:3rem auto;">
      <h2>Anmelden</h2>
      <div class="field"><label>E-Mail oder Kürzel</label><input id="li-email" type="text" autocomplete="username"></div>
      <div class="field"><label>Passwort</label><input id="li-pass" type="password" autocomplete="current-password"></div>
      <p class="hint" id="li-error" style="color:#b71c1c;"></p>
      <button class="btn" id="li-submit" type="button" style="width:100%;">Anmelden</button>
      <p class="hint" style="margin-top:1rem;">Noch kein Konto? Ein/e Administrator/in kann unter
      „Einstellungen → Benutzer“ eines für dich anlegen.</p>
    </div>`;
  const submit = async () => {
    const email = $('#li-email').value.trim();
    const pass = $('#li-pass').value;
    $('#li-error').textContent = '';
    if (!email || !pass) { $('#li-error').textContent = 'Bitte Login und Passwort eingeben.'; return; }
    try {
      await login(email, pass);
      paintTopbar();
      location.hash = '#/start';
      route();
    } catch (err) {
      $('#li-error').textContent = errMsg(err);
    }
  };
  $('#li-submit').addEventListener('click', submit);
  $('#li-pass').addEventListener('keydown', ev => { if (ev.key === 'Enter') submit(); });
}

// ---------- Start (Projektauswahl) ----------
async function renderStart() {
  appEl.innerHTML = '<p class="hint">Lade Projekte …</p>';
  const me = getCurrentUser();
  const projects = await listProjectsApi();
  const scratchCard = !isExtern(me) ? `
    <div class="card">
      <h2>Oder: nur eine einzelne Probe</h2>
      <p class="hint">Ohne Projekt/Baustelle — fürs Probenahmeprotokoll (vereinzelte Proben, „Scratchbook“).
      Sichtbar nur für dich und den Admin.</p>
      <a class="btn secondary" href="#/protokoll">📝 Probenahmeprotokoll</a>
    </div>` : '';
  if (projects.length === 0) {
    appEl.innerHTML = `<div class="empty-state">
      <p>${canManageProjects(me) ? 'Noch keine Projekte angelegt.' : 'Noch kein Projekt-Zugriff — bitte bei der Projektleitung melden.'}</p>
      ${canManageProjects(me) ? '<a class="btn" href="#/projekte">+ Projekt anlegen</a>' : ''}
    </div>
    ${scratchCard}`;
    return;
  }
  const activeId = getActiveProjectId();
  appEl.innerHTML = `
    <div class="card">
      <h2>Womit arbeitest du gerade?</h2>
      <p class="hint">Projekt/Baustelle auswählen — Journal und neue Proben beziehen sich danach darauf.
      Jederzeit über „Projekt wechseln“ in der Kopfzeile änderbar.</p>
      <div class="entry-list" id="start-project-list"></div>
    </div>
    ${canManageProjects(me) ? '<div class="btn-row"><a class="btn secondary" href="#/projekte">+ Neues Projekt anlegen / verwalten</a></div>' : ''}
    ${scratchCard}
  `;
  const list = $('#start-project-list');
  for (const p of projects) {
    const card = document.createElement('article');
    card.className = 'entry-card';
    card.innerHTML = `<div class="entry-info">
        <h3 class="entry-title">${escapeHtml(p.name)} <span class="hint">(${escapeHtml(p.kuerzel)})</span></h3>
        <p class="entry-sub">${escapeHtml(p.auftraggeber || '–')} · ${escapeHtml(p.ort || '–')}</p>
      </div>
      ${p.id === activeId ? '<span class="badge" style="background:#2e7d32;">Zuletzt aktiv</span>' : ''}`;
    card.addEventListener('click', () => {
      setActiveProject(p.id, p.name);
      journalFilter.projekt = p.name;
      location.hash = '#/journal';
      route();
    });
    list.appendChild(card);
  }
}

// ---------- Journal (Liste mit Filtern) ----------
const photoUrlCache = new Map(); // photoId -> objectURL
let journalEntries = [];
let journalFilter = { projekt: '', material: '', standard: '', klasse: '', sort: 'neu' };

// Klassen-Array passend zum Standard einer Probe (Default 'vvea' für alte Proben).
function classesForEntry(entry) {
  return entry?.standard === 'vbbo' ? VBBO_CLASSES : CLASSES;
}

// Grenzwert-Set passend zum Standard einer Probe — bei VBBo erst per
// Nutzungsart auf das VVEA-ähnliche {classId: Zahl}-Format projizieren (siehe
// buildVbboThresholdsForNutzung()), damit es zu classesForEntry() passt. Für
// den PDF-Bericht (Grenzwert-Spalte je Analysewert).
function thresholdsForEntry(entry) {
  return entry?.standard === 'vbbo'
    ? buildVbboThresholdsForNutzung(vbboThresholds, entry.nutzungsart || NUTZUNGSARTEN[0].id)
    : thresholds;
}

async function getPhotoUrl(entryId, photo) {
  if (photoUrlCache.has(photo.id)) return photoUrlCache.get(photo.id);
  const blob = await fetchPhotoBlob(entryId, photo.id);
  const url = URL.createObjectURL(blob);
  photoUrlCache.set(photo.id, url);
  return url;
}

async function renderJournal() {
  appEl.innerHTML = '<p class="hint">Lade Journal …</p>';
  journalEntries = await listEntries();
  if (journalEntries.length === 0) {
    appEl.innerHTML = `<div class="empty-state">
      <p>Noch keine Proben erfasst.</p>
      <a class="btn" href="#/eintrag/neu">+ Neue Probe erfassen</a>
    </div>`;
    return;
  }
  const baustellen = [...new Set(journalEntries.map(e => e.baustelle).filter(Boolean))].sort();
  const materialien = [...new Set(journalEntries.map(e => e.material).filter(Boolean))].sort();

  appEl.innerHTML = `
    <div class="btn-row"><a class="btn" href="#/eintrag/neu">+ Neue Probe</a></div>
    <div class="card filter-bar">
      <div class="field"><label>Projekt</label><select id="filter-projekt">
        <option value="">Alle</option>
        ${baustellen.map(b => `<option value="${escapeHtml(b)}" ${journalFilter.projekt === b ? 'selected' : ''}>${escapeHtml(b)}</option>`).join('')}
      </select></div>
      <div class="field"><label>Material</label><select id="filter-material">
        <option value="">Alle</option>
        ${materialien.map(m => `<option value="${escapeHtml(m)}" ${journalFilter.material === m ? 'selected' : ''}>${escapeHtml(m)}</option>`).join('')}
      </select></div>
      <div class="field"><label>Standard</label><select id="filter-standard">
        <option value="">Alle</option>
        <option value="vvea" ${journalFilter.standard === 'vvea' ? 'selected' : ''}>VVEA (Deponieklassen)</option>
        <option value="vbbo" ${journalFilter.standard === 'vbbo' ? 'selected' : ''}>VBBo (Bodenqualität)</option>
      </select></div>
      <div class="field"><label>Klasse</label><select id="filter-klasse">
        <option value="">Alle</option>
        <optgroup label="VVEA">
          ${CLASSES.map(c => `<option value="vvea:${c.id}" ${journalFilter.klasse === `vvea:${c.id}` ? 'selected' : ''}>${escapeHtml(c.short)}</option>`).join('')}
        </optgroup>
        <optgroup label="VBBo">
          ${VBBO_CLASSES.map(c => `<option value="vbbo:${c.id}" ${journalFilter.klasse === `vbbo:${c.id}` ? 'selected' : ''}>${escapeHtml(c.short)}</option>`).join('')}
        </optgroup>
      </select></div>
      <div class="field"><label>Sortierung</label><select id="filter-sort">
        <option value="neu" ${journalFilter.sort === 'neu' ? 'selected' : ''}>Neueste zuerst</option>
        <option value="alt" ${journalFilter.sort === 'alt' ? 'selected' : ''}>Älteste zuerst</option>
        <option value="klasse" ${journalFilter.sort === 'klasse' ? 'selected' : ''}>Klasse (kritischste zuerst)</option>
      </select></div>
    </div>
    <p class="hint" id="filter-count"></p>
    <div class="entry-list" id="entry-list"></div>`;

  $('#filter-projekt').addEventListener('change', ev => { journalFilter.projekt = ev.target.value; paintJournalList(); });
  $('#filter-material').addEventListener('change', ev => { journalFilter.material = ev.target.value; paintJournalList(); });
  $('#filter-standard').addEventListener('change', ev => { journalFilter.standard = ev.target.value; paintJournalList(); });
  $('#filter-klasse').addEventListener('change', ev => { journalFilter.klasse = ev.target.value; paintJournalList(); });
  $('#filter-sort').addEventListener('change', ev => { journalFilter.sort = ev.target.value; paintJournalList(); });
  paintJournalList();
}

function paintJournalList() {
  let list = journalEntries.filter(e => {
    const std = e.standard === 'vbbo' ? 'vbbo' : 'vvea';
    return (!journalFilter.projekt || e.baustelle === journalFilter.projekt) &&
      (!journalFilter.material || e.material === journalFilter.material) &&
      (!journalFilter.standard || std === journalFilter.standard) &&
      (!journalFilter.klasse || `${std}:${e.klassifizierung?.classId}` === journalFilter.klasse);
  });
  if (journalFilter.sort === 'alt') list = [...list].sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
  else if (journalFilter.sort === 'klasse') list = [...list].sort((a, b) => (b.klassifizierung?.classIndex ?? -1) - (a.klassifizierung?.classIndex ?? -1));
  else list = [...list].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  $('#filter-count').textContent = `${list.length} von ${journalEntries.length} Proben`;
  const container = $('#entry-list');
  container.innerHTML = '';
  if (list.length === 0) {
    container.innerHTML = '<p class="hint">Keine Proben mit diesen Filtern.</p>';
    return;
  }
  for (const entry of list) {
    const card = document.createElement('article');
    card.className = 'entry-card';
    const thumbEl = document.createElement('div');
    thumbEl.className = 'entry-thumb';
    thumbEl.textContent = '📷';
    const cls = entry.klassifizierung ? classesForEntry(entry)[entry.klassifizierung.classIndex] : null;
    card.innerHTML = `<div class="entry-info">
        <h3 class="entry-title"></h3>
        <p class="entry-sub"></p>
        ${cls ? `<span class="badge"></span>` : '<span class="hint">keine Analyse</span>'}
      </div>`;
    card.querySelector('.entry-title').textContent = entry.probeBezeichnung || '(ohne Bezeichnung)';
    const stdLabel = entry.standard === 'vbbo' ? 'VBBo' : 'VVEA';
    const mengeLabel = fmtMenge(entry);
    card.querySelector('.entry-sub').textContent = `${entry.baustelle || '–'} · ${entry.material || ''}${mengeLabel ? ' · ' + mengeLabel : ''} · ${stdLabel} · ${fmtDate(entry.createdAt)}`;
    if (cls) { const b = card.querySelector('.badge'); b.textContent = cls.short; b.style.background = cls.color; }
    card.prepend(thumbEl);
    card.addEventListener('click', () => { location.hash = `#/eintrag/${entry.id}`; });
    container.appendChild(card);
    if (entry.photos && entry.photos[0]) {
      getPhotoUrl(entry.id, entry.photos[0]).then(url => { thumbEl.style.backgroundImage = `url(${url})`; thumbEl.textContent = ''; }).catch(() => {});
    }
  }
}

// ---------- Probenahmeprotokoll (Scratchbook: Einzelproben ohne Projekt) ----------
// Eigener, schlanker Bereich für vereinzelte Proben ohne Projektzuteilung —
// sichtbar nur für die erstellende Person + Admin (siehe entries.js
// canViewEntry). Diese Proben laufen serverseitig über dieselbe
// /api/entries-Liste wie Projekt-Proben (projektId=null) und erscheinen
// daher — für die berechtigten Personen — auch ganz normal im Journal
// (dort über den Projekt-Filter „Einzelprobe (ohne Projekt)“ ausfilterbar),
// diese Ansicht hier ist nur eine fokussierte Kurzliste.
async function renderProtokoll() {
  appEl.innerHTML = '<p class="hint">Lade Probenahmeprotokoll …</p>';
  const me = getCurrentUser();
  // Admin sieht (wie sonst überall) auch fremde Einzelproben — anders als bei
  // allen anderen Rollen (nur die eigenen), daher hier zusätzlich die
  // Namensliste laden, um in der Kurzliste kenntlich zu machen, von wem eine
  // Probe stammt (sonst nicht unterscheidbar, da alle im selben Protokoll landen).
  const [all, roster] = await Promise.all([
    listEntries(),
    isAdmin(me) ? getUserRosterApi().catch(() => []) : Promise.resolve([]),
  ]);
  const entries = all.filter(e => !e.projektId).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  appEl.innerHTML = `
    <div class="card">
      <h2>📝 Probenahmeprotokoll</h2>
      <p class="hint">Vereinzelte Proben ohne Projekt/Baustelle — z.B. für Spontanproben unterwegs. Nur du (und
      der Admin) siehst diese Liste; sie erscheinen auch im normalen Journal.</p>
      <div class="btn-row">
        <a class="btn" href="#/eintrag/neu-einzeln">+ Neue Einzelprobe</a>
        <a class="btn secondary" href="#/start">🏠 Übersicht</a>
      </div>
    </div>
    ${entries.length === 0 ? '<p class="hint">Noch keine Einzelproben erfasst.</p>' : '<div class="entry-list" id="protokoll-list"></div>'}
  `;
  if (entries.length === 0) return;
  const container = $('#protokoll-list');
  for (const entry of entries) {
    const card = document.createElement('article');
    card.className = 'entry-card';
    const thumbEl = document.createElement('div');
    thumbEl.className = 'entry-thumb';
    thumbEl.textContent = '📷';
    const cls = entry.klassifizierung ? classesForEntry(entry)[entry.klassifizierung.classIndex] : null;
    card.innerHTML = `<div class="entry-info">
        <h3 class="entry-title"></h3>
        <p class="entry-sub"></p>
        ${cls ? `<span class="badge"></span>` : '<span class="hint">keine Analyse</span>'}
      </div>`;
    card.querySelector('.entry-title').textContent = entry.probeBezeichnung || '(ohne Bezeichnung)';
    const mengeLabel = fmtMenge(entry);
    const creatorLabel = isAdmin(me) ? (roster.find(u => u.id === entry.createdBy)?.name || '') : '';
    card.querySelector('.entry-sub').textContent = `${entry.material || '–'}${mengeLabel ? ' · ' + mengeLabel : ''} · ${fmtDate(entry.createdAt)}${creatorLabel ? ' · von ' + creatorLabel : ''}`;
    if (cls) { const b = card.querySelector('.badge'); b.textContent = cls.short; b.style.background = cls.color; }
    card.prepend(thumbEl);
    card.addEventListener('click', () => { location.hash = `#/eintrag/${entry.id}`; });
    container.appendChild(card);
    if (entry.photos && entry.photos[0]) {
      getPhotoUrl(entry.id, entry.photos[0]).then(url => { thumbEl.style.backgroundImage = `url(${url})`; thumbEl.textContent = ''; }).catch(() => {});
    }
  }
}

// ---------- Projekte ----------
let editingProjectId = null;

async function renderProjects() {
  appEl.innerHTML = '<p class="hint">Lade Projekte …</p>';
  const me = getCurrentUser();
  const [projects, roster] = await Promise.all([
    listProjectsApi(),
    canManageProjects(me) ? getUserRosterApi().catch(() => []) : Promise.resolve([]),
  ]);
  editingProjectId = null;
  paintProjects(projects, roster);
}

function paintProjects(projects, roster) {
  const me = getCurrentUser();
  const editing = projects.find(p => p.id === editingProjectId) || null;
  const probenehmerOptions = roster.filter(u => u.role === 'probenehmer');
  appEl.innerHTML = `
    <div class="card">
      <h2>Projekte</h2>
      <p class="hint">${canManageProjects(me)
        ? 'Vor der ersten Probennahme ein Projekt anlegen — Chargennamen werden danach automatisch und '
          + 'fortlaufend pro Projekt vergeben (Kürzel-Nummer, z.B. <code>A123-001</code>).'
        : 'Projekte, für die dir Zugriff gewährt wurde.'}</p>
      ${projects.length === 0 ? '<p class="hint">Noch keine Projekte.</p>' : `
      <div class="entry-list">
        ${projects.map(p => `
          <div class="entry-card" style="cursor:default;">
            <div class="entry-info">
              <h3 class="entry-title">${escapeHtml(p.name)} <span class="hint">(${escapeHtml(p.kuerzel)})</span></h3>
              <p class="entry-sub">${escapeHtml(p.auftraggeber || '–')} · ${escapeHtml(p.ort || '–')} · nächste Charge: ${escapeHtml(p.kuerzel)}-${pad3(p.nextChargeNumber)}</p>
              <p class="hint">Beprobungsorte: ${(p.entnahmeorte || []).length ? escapeHtml(p.entnahmeorte.join(', ')) : '–'}</p>
              <p class="hint">Entsorgungswege: ${(p.entsorgungswege || []).length ? escapeHtml(p.entsorgungswege.join(', ')) : '–'}</p>
            </div>
            ${canManageThisProject(me, p) ? `
            <div class="btn-row" style="margin:0;">
              <button class="btn secondary" type="button" data-edit-project="${p.id}">Bearbeiten</button>
              <button class="btn danger" type="button" data-del-project="${p.id}">Löschen</button>
            </div>` : ''}
          </div>`).join('')}
      </div>`}
    </div>

    ${canManageProjects(me) ? `
    <div class="card">
      <h2>${editing ? 'Projekt bearbeiten' : 'Neues Projekt anlegen'}</h2>
      <div class="grid-2">
        <div class="field"><label>Projektname *</label><input id="p-name" value="${escapeHtml(editing?.name || '')}"></div>
        <div class="field"><label>Kürzel * <span class="hint">(für Chargennamen, z.B. „A123“)</span></label><input id="p-kuerzel" maxlength="12" value="${escapeHtml(editing?.kuerzel || '')}"></div>
        <div class="field"><label>Auftraggeber</label><input id="p-auftraggeber" value="${escapeHtml(editing?.auftraggeber || '')}"></div>
        <div class="field"><label>Ort</label><input id="p-ort" value="${escapeHtml(editing?.ort || '')}"></div>
      </div>
      <div class="field"><label>Bemerkungen</label><textarea id="p-bemerkungen" rows="2">${escapeHtml(editing?.bemerkungen || '')}</textarea></div>
      <div class="grid-2">
        <div class="field">
          <label>Beprobungsorte <span class="hint">(ein Eintrag pro Zeile — als Dropdown bei der Probe verfügbar, alternativ zu GPS)</span></label>
          <textarea id="p-entnahmeorte" rows="3" placeholder="z.B. Baugrube Nord, Schicht 1">${escapeHtml((editing?.entnahmeorte || []).join('\n'))}</textarea>
        </div>
        <div class="field">
          <label>Entsorgungswege <span class="hint">(ein Eintrag pro Zeile — als Dropdown bei der Probe verfügbar)</span></label>
          <textarea id="p-entsorgungswege" rows="3" placeholder="z.B. Deponie Muster AG, Zürich">${escapeHtml((editing?.entsorgungswege || []).join('\n'))}</textarea>
        </div>
      </div>
      <div class="field">
        <label>Zugriff für Probenehmer/innen <span class="hint">(sehen das Projekt und können darin Proben erfassen)</span></label>
        ${probenehmerOptions.length === 0 ? '<p class="hint">Keine Benutzer mit Rolle „Probenehmer/in“ vorhanden — unter Einstellungen &gt; Benutzer anlegen.</p>' : `
        <div style="display:flex;flex-direction:column;gap:.3rem;">
          ${probenehmerOptions.map(u => `<label style="display:flex;align-items:center;gap:.5rem;">
            <input type="checkbox" data-probenehmer-zugriff value="${u.id}" ${(editing?.probenehmerZugriff || []).includes(u.id) ? 'checked' : ''}>
            ${escapeHtml(u.name)}
          </label>`).join('')}
        </div>`}
      </div>
      <div class="btn-row">
        <button class="btn" id="btn-save-project" type="button">${editing ? '💾 Speichern' : '+ Projekt anlegen'}</button>
        ${editing ? '<button class="btn secondary" id="btn-cancel-edit-project" type="button">Abbrechen</button>' : ''}
      </div>
    </div>` : ''}`;

  if (!canManageProjects(me)) return;

  const nameInput = $('#p-name'), kuerzelInput = $('#p-kuerzel');
  let kuerzelTouched = !!editing?.kuerzel;
  kuerzelInput.addEventListener('input', () => { kuerzelTouched = true; });
  nameInput.addEventListener('input', () => {
    if (kuerzelTouched) return;
    kuerzelInput.value = nameInput.value.toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 8);
  });

  $$('[data-edit-project]').forEach(btn => btn.addEventListener('click', () => {
    editingProjectId = btn.dataset.editProject;
    paintProjects(projects, roster);
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  }));
  $$('[data-del-project]').forEach(btn => btn.addEventListener('click', async () => {
    if (!confirm('Dieses Projekt wirklich löschen? Geht nur, wenn keine Proben mehr darauf verweisen.')) return;
    try {
      await deleteProjectApi(btn.dataset.delProject);
      if (getActiveProjectId() === btn.dataset.delProject) { setActiveProject(null); paintTopbar(); }
      toast('Projekt gelöscht');
      await renderProjects();
    } catch (err) { toast('Fehler: ' + errMsg(err)); }
  }));
  const cancelBtn = $('#btn-cancel-edit-project');
  if (cancelBtn) cancelBtn.addEventListener('click', () => { editingProjectId = null; paintProjects(projects, roster); });

  const parseLines = text => text.split('\n').map(s => s.trim()).filter(Boolean);

  $('#btn-save-project').addEventListener('click', async () => {
    const payload = {
      name: $('#p-name').value.trim(),
      kuerzel: $('#p-kuerzel').value.trim(),
      auftraggeber: $('#p-auftraggeber').value.trim(),
      ort: $('#p-ort').value.trim(),
      bemerkungen: $('#p-bemerkungen').value.trim(),
      entnahmeorte: parseLines($('#p-entnahmeorte').value),
      entsorgungswege: parseLines($('#p-entsorgungswege').value),
      probenehmerZugriff: $$('[data-probenehmer-zugriff]:checked').map(cb => cb.value),
    };
    if (!payload.name || !payload.kuerzel) { toast('Bitte Projektname und Kürzel angeben.'); return; }
    try {
      if (editing) {
        await updateProjectApi(editing.id, payload);
        toast('Projekt gespeichert');
      } else {
        await createProjectApi(payload);
        toast('Projekt angelegt');
      }
      await renderProjects();
    } catch (err) { toast('Fehler: ' + errMsg(err)); }
  });
}

// ---------- Eintrag-Formular ----------
let currentEntry = null;
let isNew = true;
let pendingPhotos = []; // File[] noch nicht hochgeladen
let currentClassification = null;
let thresholds = {};
let vbboThresholds = {};
let vevaCodes = [];
let analytikProgramme = [];
let materialien = [];
let labore = [];
let unsereFirma = {}; // für Labor-Auftragsformulare (Niutec), siehe niutec-form.js
let thresholdRequests = []; // offene Änderungsanträge für VVEA-Grenzwerte (nur admin/projektleiter)
// Welcher Reiter auf der Einstellungsseite gerade aktiv ist (siehe
// paintSettings()) — die Seite ist sonst eine sehr lange Liste an Karten,
// Reiter blenden per CSS nur ein/aus (alle Karten bleiben im DOM), damit
// sämtliche bestehende Event-Verkabelung unverändert funktioniert.
let settingsTab = 'grenzwerte';
let formProjects = [];
let formRoster = [];

function newDraftEntry() {
  return {
    id: null,
    createdAt: new Date().toISOString(),
    projektId: null, baustelle: '', probeBezeichnung: '', entnahmeort: '', gps: null,
    material: '', probenehmer: '', bemerkungen: '', menge: null, mengeEinheit: 't',
    standard: 'vvea', nutzungsart: NUTZUNGSARTEN[0].id, entsorgungsweg: '', vevaCode: '', labor: '',
    analytikProgramme: [], photos: [], analyse: [], klassifizierung: null,
    externZugriff: [], deletionRequestedAt: null, deletionRequestedBy: null,
  };
}

async function loadVveaConfig() {
  try {
    const [t, p, vt, vp, vc, ap, mat, lab, uf] = await Promise.all([
      getThresholdsApi(), getParametersApi(),
      getVbboThresholdsApi(), getVbboParametersApi(), getVevaCodesApi(),
      getAnalytikProgrammeApi(), getMaterialienApi(), getLaboreApi(), getUnsereFirmaApi(),
    ]);
    thresholds = t;
    setParameters(p);
    vbboThresholds = vt;
    setVbboParameters(vp);
    vevaCodes = vc;
    analytikProgramme = ap;
    materialien = mat;
    labore = lab;
    unsereFirma = uf || {};
  } catch (e) { /* Fallback-Werte aus vvea.js bleiben aktiv */ }
}

async function renderEntryForm(idOrNeu) {
  await loadVveaConfig();
  pendingPhotos = [];
  if (idOrNeu === 'neu-einzeln') {
    // Eigenständige Probe ohne Projekt (Probenahmeprotokoll/Scratchbook) —
    // siehe renderProtokoll(). Extern darf ohnehin nichts anlegen.
    if (isExtern(getCurrentUser())) { location.hash = '#/protokoll'; return; }
    currentEntry = newDraftEntry();
    isNew = true;
    formProjects = [];
  } else if (idOrNeu === 'neu') {
    currentEntry = newDraftEntry();
    isNew = true;
    formProjects = await listProjectsApi();
    if (formProjects.length === 0) {
      const canCreate = canManageProjects(getCurrentUser());
      appEl.innerHTML = `<div class="empty-state">
        <p>${canCreate ? 'Bevor eine Probe einem Projekt zugeteilt werden kann, muss zuerst ein Projekt angelegt werden.' : 'Noch kein Projekt-Zugriff — bitte bei der Projektleitung melden.'}</p>
        ${canCreate ? '<a class="btn" href="#/projekte">+ Projekt anlegen</a>' : ''}
        ${!isExtern(getCurrentUser()) ? '<a class="btn secondary" href="#/eintrag/neu-einzeln">📝 Nur Probenahmeprotokoll (ohne Projekt)</a>' : ''}
      </div>`;
      return;
    }
    const activeId = getActiveProjectId();
    currentEntry.projektId = (activeId && formProjects.some(p => p.id === activeId)) ? activeId : formProjects[0].id;
  } else {
    currentEntry = await getEntryApi(idOrNeu);
    isNew = false;
    // Standard wird unten in paintEntryForm() aus dem Material abgeleitet
    // (materialToStandard) — überschreibt bewusst einen ggf. abweichend
    // gespeicherten Altwert, damit Material und Standard nie auseinanderlaufen.
    formProjects = await listProjectsApi().catch(() => []);
  }
  formRoster = await getUserRosterApi().catch(() => []);
  recomputeClassification();
  if (!isNew && isExtern(getCurrentUser())) { paintEntryReadOnly(); return; }
  paintEntryForm();
}

// Rein lesende Ansicht für die Rolle "extern" — bewusst ein eigenes,
// schlankes Template statt des interaktiven Formulars mit lauter
// disabled-Feldern: klarer für die Nutzenden, weniger Angriffsfläche für
// versehentliche Schreibversuche (der Server lehnt sie ohnehin ab).
function paintEntryReadOnly() {
  const e = currentEntry;
  appEl.innerHTML = `
    <div class="card">
      <h2>Probe ${escapeHtml(e.probeBezeichnung)} <span class="hint">(nur Lesezugriff)</span></h2>
      <div class="grid-2">
        <div class="field"><label>Projekt</label><p>${escapeHtml(e.baustelle || '–')}</p></div>
        <div class="field"><label>Material</label><p>${escapeHtml(e.material || '–')}</p></div>
        <div class="field"><label>Beprobungsort</label><p>${escapeHtml(e.entnahmeort || '–')}</p></div>
        <div class="field"><label>Datum</label><p>${fmtDate(e.createdAt)}</p></div>
        <div class="field"><label>Menge</label><p>${fmtMenge(e) || '–'}</p></div>
        <div class="field"><label>Probenehmer/in</label><p>${escapeHtml(e.probenehmer || '–')}</p></div>
        <div class="field"><label>Standard</label><p>${e.standard === 'vbbo' ? 'VBBo (Bodenqualität)' : 'VVEA (Deponieklassen)'}</p></div>
        <div class="field"><label>VeVA-Code</label><p>${escapeHtml(e.vevaCode || '–')}</p></div>
        <div class="field"><label>Entsorgungsweg</label><p>${escapeHtml(e.entsorgungsweg || '–')}</p></div>
        <div class="field"><label>Labor</label><p>${escapeHtml(e.labor || '–')}</p></div>
      </div>
      ${e.bemerkungen ? `<div class="field"><label>Bemerkungen</label><p>${escapeHtml(e.bemerkungen)}</p></div>` : ''}
    </div>

    <div class="card">
      <h2>Fotos</h2>
      <div class="photo-grid" id="photo-grid-ro">${(e.photos || []).length ? '' : '<p class="hint">Keine Fotos.</p>'}</div>
    </div>

    <div class="card">
      <h2>Analysewerte</h2>
      <div style="overflow-x:auto"><table class="analyse-table">
        <tr><th>Parameter</th><th>Wert</th><th>Einheit</th><th>Art</th><th>Einstufung</th></tr>
        ${(e.analyse || []).map(r => `
          <tr>
            <td>${escapeHtml(activeParamList().find(p => p.key === r.parameterKey)?.label || r.parameterKey)}</td>
            <td>${r.wert ?? '–'}</td>
            <td class="hint">${escapeHtml(r.einheit || '')}</td>
            <td>${r.art === 'eluat' ? 'Eluat' : 'Gesamt'}</td>
            <td>${rowClassBadge(r)}</td>
          </tr>`).join('') || '<tr><td class="hint" colspan="5">Keine Analysewerte erfasst.</td></tr>'}
      </table></div>
      <div id="classification-banner"></div>
    </div>
  `;
  const grid = $('#photo-grid-ro');
  (e.photos || []).forEach(p => {
    const div = document.createElement('div');
    div.className = 'photo-thumb';
    const img = document.createElement('img');
    div.appendChild(img);
    grid.appendChild(div);
    getPhotoUrl(e.id, p).then(url => { img.src = url; }).catch(() => {});
  });
  paintClassificationBanner();
}

function recomputeClassification() {
  const werte = (currentEntry.analyse || [])
    .filter(a => a.parameterKey && a.wert !== null && a.wert !== undefined && !Number.isNaN(a.wert))
    .map(a => ({ parameterKey: a.parameterKey, wert: a.wert, art: a.art || 'gesamt' }));
  if (currentEntry.standard === 'vbbo') {
    currentClassification = werte.length ? classifyVBBO(werte, vbboThresholds, currentEntry.nutzungsart || NUTZUNGSARTEN[0].id) : null;
  } else {
    currentClassification = werte.length ? classify(werte, thresholds) : null;
  }
  currentEntry.klassifizierung = currentClassification;
}

function projektHint() {
  const p = formProjects.find(pr => pr.id === currentEntry.projektId);
  if (!p) return '';
  return `Nächste Chargennummer (voraussichtlich): <strong>${escapeHtml(p.kuerzel)}-${pad3(p.nextChargeNumber)}</strong>`;
}

function paintEntryForm() {
  const e = currentEntry;
  const me = getCurrentUser();
  // Eigenständige Probe ohne Projekt (Probenahmeprotokoll/Scratchbook, siehe
  // renderProtokoll()) — projektId ist dann sowohl bei neuen als auch bei
  // bestehenden Proben null. "Verwalten" ist dort nicht projektbasiert
  // (Admin oder die erstellende Person selbst, siehe entries.js canManageEntry).
  const standalone = !e.projektId;
  const project = formProjects.find(p => p.id === e.projektId) || null;
  const projectEntnahmeorte = project?.entnahmeorte || [];
  const projectEntsorgungswege = project?.entsorgungswege || [];
  const materialIsUnknown = e.material && !materialien.some(m => m.name === e.material);
  const probenehmerIsCustom = e.probenehmer && !formRoster.some(u => u.name === e.probenehmer);
  const entnahmeortIsCustom = e.entnahmeort && !projectEntnahmeorte.includes(e.entnahmeort);
  const entsorgungswegIsCustom = e.entsorgungsweg && !projectEntsorgungswege.includes(e.entsorgungsweg);
  const laborIsCustom = e.labor && !labore.some(l => l.name === e.labor);
  const labelSize = loadLabelSize();
  const canManageThisEntry = standalone ? (isAdmin(me) || e.createdBy === me?.id) : canManageThisProject(me, project);
  const externOptions = formRoster.filter(u => u.role === 'extern');
  if (isNew && !e.probenehmer && me) e.probenehmer = me.name;
  if (!Array.isArray(e.analytikProgramme)) e.analytikProgramme = [];
  e.standard = materialToStandard(e.material, materialien);
  if (e.standard === 'vbbo' && !e.nutzungsart) e.nutzungsart = NUTZUNGSARTEN[0].id;
  recomputeClassification(); // Standard kann sich gerade erst geändert haben (z.B. beim Laden)

  appEl.innerHTML = `
    <div class="card">
      <h2>${isNew ? 'Neue Probe' : `Probe ${escapeHtml(e.probeBezeichnung)}`}</h2>

      ${isNew ? (standalone ? `
        <p class="hint">📝 Probenahmeprotokoll — eigenständige Probe <strong>ohne Projekt</strong>. Chargenname
        wird automatisch als „PP-####“ vergeben. Nur du (und der Admin) siehst diese Probe — siehe
        <a href="#/protokoll">Probenahmeprotokoll</a>.</p>
      ` : `
        <div class="field">
          <label>Projekt *</label>
          <select id="f-projekt">${formProjects.map(p => `<option value="${p.id}" ${p.id === e.projektId ? 'selected' : ''}>${escapeHtml(p.name)} (${escapeHtml(p.kuerzel)})</option>`).join('')}</select>
          <p class="hint" id="projekt-hint">${projektHint()}</p>
        </div>
      `) : (standalone ? `
        <div class="field"><label>Projekt</label><p>📝 ${escapeHtml(e.baustelle)} <span class="hint">(nur für dich sichtbar, siehe <a href="#/protokoll">Probenahmeprotokoll</a>)</span></p></div>
      ` : `
        <div class="field"><label>Projekt</label><p>${escapeHtml(e.baustelle)}</p></div>
      `)}

      <div class="grid-2">
        <div class="field">
          <label>Material</label>
          <select id="f-material">
            <option value="">– wählen –</option>
            ${materialien.map(m => `<option value="${escapeHtml(m.name)}" ${e.material === m.name ? 'selected' : ''}>${escapeHtml(m.name)}</option>`).join('')}
            ${materialIsUnknown ? `<option value="${escapeHtml(e.material)}" selected>${escapeHtml(e.material)} (nicht in Materialien-Liste)</option>` : ''}
          </select>
          ${materialIsUnknown ? '<p class="hint">Dieses Material ist nicht (mehr) in der Materialien-Liste hinterlegt — Standard und VeVA-Code können nicht automatisch bestimmt werden. Bitte ein passendes Material wählen oder unter Einstellungen &gt; Materialien ergänzen.</p>' : ''}
          ${materialien.length === 0 ? '<p class="hint">Noch keine Materialien hinterlegt — unter Einstellungen &gt; Materialien anlegen.</p>' : ''}
        </div>
        <div class="field">
          <label>Probenehmer/in</label>
          <select id="f-person">
            <option value="">– wählen –</option>
            ${formRoster.map(u => `<option value="${escapeHtml(u.name)}" ${e.probenehmer === u.name ? 'selected' : ''}>${escapeHtml(u.name)}</option>`).join('')}
            <option value="${ANDERE}" ${probenehmerIsCustom ? 'selected' : ''}>Andere (Freitext)…</option>
          </select>
          <input id="f-person-andere" placeholder="Name angeben" style="margin-top:.4rem;display:${probenehmerIsCustom ? 'block' : 'none'};" value="${escapeHtml(probenehmerIsCustom ? e.probenehmer : '')}">
        </div>
        <div class="field">
          <label>Beprobungsort <span class="hint">(oder per GPS unten)</span></label>
          <select id="f-ort">
            <option value="">– wählen –</option>
            ${projectEntnahmeorte.map(o => `<option value="${escapeHtml(o)}" ${e.entnahmeort === o ? 'selected' : ''}>${escapeHtml(o)}</option>`).join('')}
            <option value="${ANDERE}" ${entnahmeortIsCustom ? 'selected' : ''}>Andere (Freitext)…</option>
          </select>
          <input id="f-ort-andere" placeholder="Beprobungsort angeben" style="margin-top:.4rem;display:${entnahmeortIsCustom ? 'block' : 'none'};" value="${escapeHtml(entnahmeortIsCustom ? e.entnahmeort : '')}">
          ${projectEntnahmeorte.length === 0 ? '<p class="hint">Noch keine Beprobungsorte im Projekt hinterlegt – unter „Projekte“ ergänzbar.</p>' : ''}
        </div>
        <div class="field"><label>Datum</label><input id="f-datum" type="datetime-local" value="${toLocalInputValue(e.createdAt)}"></div>
        <div class="field">
          <label>Menge <span class="hint">(geschätzt, optional)</span></label>
          <div style="display:flex;gap:.5rem;">
            <input id="f-menge" type="number" step="any" min="0" inputmode="decimal" placeholder="z.B. 12.5" value="${e.menge ?? ''}" style="flex:2;min-width:0;">
            <select id="f-menge-einheit" style="flex:1;min-width:0;">
              <option value="t" ${e.mengeEinheit !== 'm3' ? 'selected' : ''}>t</option>
              <option value="m3" ${e.mengeEinheit === 'm3' ? 'selected' : ''}>m³</option>
            </select>
          </div>
        </div>
      </div>
      <div class="field"><label>Bemerkungen</label><textarea id="f-bemerkungen" rows="2">${escapeHtml(e.bemerkungen)}</textarea></div>
      <button class="btn secondary" id="btn-gps" type="button">📍 GPS-Standort erfassen</button>
      <span class="hint" id="gps-status">${e.gps ? `Position: ${e.gps.lat.toFixed(5)}, ${e.gps.lng.toFixed(5)}` : ''}</span>
    </div>

    <div class="card">
      <h2>Einstufung & Entsorgung</h2>
      <div class="grid-2">
        <div class="field">
          <label>Standard <span class="hint">(automatisch aus Material)</span></label>
          <p id="f-standard-display">${e.standard === 'vbbo' ? 'VBBo (Bodenqualität)' : 'VVEA (Deponieklassen)'}</p>
        </div>
        <div class="field" id="f-nutzungsart-field" style="display:${e.standard === 'vbbo' ? 'block' : 'none'};">
          <label>Nutzungsart <span class="hint">(nur VBBo)</span></label>
          <select id="f-nutzungsart">
            ${NUTZUNGSARTEN.map(n => `<option value="${n.id}" ${e.nutzungsart === n.id ? 'selected' : ''}>${escapeHtml(n.label)}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>VeVA-Code <span class="hint">(automatisch aus Material + Standard + Einstufung, nicht änderbar)</span></label>
          <p id="f-veva-code-display">–</p>
          <p class="hint" id="veva-code-hint"></p>
        </div>
        <div class="field">
          <label>Entsorgungsweg</label>
          <select id="f-entsorgungsweg">
            <option value="">– wählen –</option>
            ${projectEntsorgungswege.map(w => `<option value="${escapeHtml(w)}" ${e.entsorgungsweg === w ? 'selected' : ''}>${escapeHtml(w)}</option>`).join('')}
            <option value="${ANDERE}" ${entsorgungswegIsCustom ? 'selected' : ''}>Andere (Freitext)…</option>
          </select>
          <input id="f-entsorgungsweg-andere" placeholder="Entsorgungsweg angeben" style="margin-top:.4rem;display:${entsorgungswegIsCustom ? 'block' : 'none'};" value="${escapeHtml(entsorgungswegIsCustom ? e.entsorgungsweg : '')}">
          ${projectEntsorgungswege.length === 0 ? '<p class="hint">Noch keine Entsorgungswege im Projekt hinterlegt – unter „Projekte“ ergänzbar.</p>' : ''}
        </div>
      </div>
    </div>

    <div class="card">
      <h2>Fotos</h2>
      <input type="file" accept="image/*" capture="environment" multiple id="photo-input" style="display:none">
      <button class="btn" id="btn-photo" type="button">📷 Foto(s) aufnehmen / hinzufügen</button>
      <p class="hint">${isNew ? 'Fotos werden beim Speichern auf den Server hochgeladen.' : ''}</p>
      <div class="photo-grid" id="photo-grid"></div>
    </div>

    <div class="card">
      <h2>Analytik</h2>
      <p class="hint">Analytik-Programm(e) und Labor auswählen und „Analysen auslösen" — das schickt eine
      E-Mail mit den gewünschten Parametern und einem Analysenauftrag als PDF ans Labor. Die Analysewerte
      selbst werden separat erfasst (manuell oder per CSV/PDF-Import unten), sobald die Laborresultate
      vorliegen. Weitere Programme/Labore unter Einstellungen verwaltbar.</p>
      <div id="analytik-programme-list" class="choice-list">
        ${relevantAnalytikProgramme().map(p => `<label class="choice-item">
          <input type="checkbox" data-ap="${p.id}" ${e.analytikProgramme.includes(p.id) ? 'checked' : ''}>
          <span>${escapeHtml(p.name)} <span class="hint">(${p.parameterKeys.length} Parameter)</span></span>
        </label>`).join('') || '<p class="hint">Keine Analytik-Programme für diesen Standard hinterlegt.</p>'}
      </div>
      <div class="field">
        <label>Labor</label>
        <select id="f-labor">
          <option value="">– wählen –</option>
          ${labore.map(l => `<option value="${escapeHtml(l.name)}" ${e.labor === l.name ? 'selected' : ''}>${escapeHtml(l.name)}${l.ort ? ', ' + escapeHtml(l.ort) : ''}</option>`).join('')}
          <option value="${ANDERE}" ${laborIsCustom ? 'selected' : ''}>Andere (Freitext)…</option>
        </select>
        <input id="f-labor-andere" placeholder="Labor angeben" style="margin-top:.4rem;display:${laborIsCustom ? 'block' : 'none'};" value="${escapeHtml(laborIsCustom ? e.labor : '')}">
      </div>
      <button class="btn secondary" id="btn-trigger-analytik" type="button">📧 Analysen auslösen</button>
    </div>

    <div class="card">
      <h2>Analysewerte</h2>
      <div class="btn-row">
        <button class="btn secondary" id="btn-add-row" type="button">+ Wert manuell hinzufügen</button>
        <input type="file" accept=".csv,text/csv" id="csv-input" style="display:none">
        <button class="btn secondary" id="btn-import-csv" type="button">⬆ CSV/Excel-CSV importieren</button>
        <input type="file" accept="application/pdf" id="pdf-input" style="display:none">
        <button class="btn secondary" id="btn-import-pdf" type="button">⬆ PDF-Laborbericht importieren</button>
      </div>
      <div id="import-preview"></div>
      <div style="overflow-x:auto"><table class="analyse-table" id="analyse-table"></table></div>

      <div id="classification-banner"></div>
    </div>

    <div class="card">
      <h2>Etikette</h2>
      ${isNew ? `
        <p class="hint">Nach dem Speichern verfügbar (braucht den vergebenen Chargennamen).</p>
      ` : `
        <p class="hint">Druckt Chargenname + QR-Code (mit den wichtigsten Probe-Infos fürs Labor) direkt über
        den Systemdruckdialog — geeignet für Etikettendrucker (z.B. Brother QL/PT-Serie). Etikettengrösse bei
        Bedarf anpassen (wird im Browser gemerkt).</p>
        <div class="grid-2">
          <div class="field"><label>Breite (mm)</label><input id="f-label-w" type="number" step="1" min="10" value="${labelSize.w}"></div>
          <div class="field"><label>Höhe (mm)</label><input id="f-label-h" type="number" step="1" min="10" value="${labelSize.h}"></div>
        </div>
        <button class="btn secondary" id="btn-print-label" type="button">🏷️ Etikette drucken</button>
      `}
    </div>

    ${(!isNew && !standalone && canManageThisEntry) ? `
    <div class="card">
      <h2>Sichtbarkeit für externe Nutzer</h2>
      <p class="hint">Wer hier angehakt ist, sieht GENAU diese Probe (nur lesend) — unabhängig vom
      restlichen Projekt. Weitere externe Nutzer unter Einstellungen &gt; Benutzer anlegen.</p>
      ${externOptions.length === 0 ? '<p class="hint">Keine Benutzer mit Rolle „Extern“ vorhanden.</p>' : `
      <div class="choice-list">
        ${externOptions.map(u => `<label class="choice-item">
          <input type="checkbox" data-extern-zugriff value="${u.id}" ${(e.externZugriff || []).includes(u.id) ? 'checked' : ''}>
          <span>${escapeHtml(u.name)}</span>
        </label>`).join('')}
      </div>`}
    </div>` : ''}

    ${(!isNew && e.deletionRequestedAt) ? `
    <div class="card" style="border:2px solid #b71c1c;">
      <h2>⚠️ Löschung beantragt</h2>
      <p class="hint">Beantragt am ${fmtDate(e.deletionRequestedAt)}${e.deletionRequestedBy === me?.id ? ' (von dir)' : ''}.</p>
      <div class="btn-row">
        ${canManageThisEntry ? `
          <button class="btn danger" id="btn-approve-delete" type="button">✅ Löschung freigeben</button>
          <button class="btn secondary" id="btn-reject-delete" type="button">❌ Ablehnen (Probe bleibt)</button>
        ` : (e.deletionRequestedBy === me?.id ? `<button class="btn secondary" id="btn-cancel-delete-request" type="button">Antrag zurückziehen</button>` : '')}
      </div>
    </div>` : ''}

    <div class="btn-row">
      <a class="btn secondary" href="#/start">🏠 Übersicht</a>
      <button class="btn" id="btn-save" type="button">💾 Speichern</button>
      <button class="btn secondary" id="btn-pdf" type="button">📄 Als PDF generieren</button>
      <button class="btn secondary" id="btn-mail" type="button">✉️ E-Mail mit PDF senden</button>
      ${(!isNew && !e.deletionRequestedAt) ? (canManageThisEntry
          ? '<button class="btn danger" id="btn-delete" type="button">🗑 Löschen</button>'
          : (isProbenehmer(me) ? '<button class="btn danger" id="btn-delete" type="button">🗑 Löschung beantragen</button>' : '')
        ) : ''}
    </div>
  `;

  if (isNew && !standalone) {
    $('#f-projekt').addEventListener('change', ev => {
      e.projektId = ev.target.value;
      // Beprobungsorte/Entsorgungswege sind projektabhängig — bei Projektwechsel
      // neu aufbauen, statt Werte des vorherigen Projekts zu übernehmen.
      e.entnahmeort = '';
      e.entsorgungsweg = '';
      paintEntryForm();
    });
  }

  // Standard (VVEA/VBBo) hängt direkt am Material — bei jeder Materialänderung
  // neu ableiten (Humus/Ober-/Unterboden -> VBBo, sonst VVEA), Nutzungsart-Feld
  // ein-/ausblenden und Analysetabelle (andere Parameterliste!) + VeVA-Code neu
  // aufbauen.
  function applyMaterialStandard() {
    e.standard = materialToStandard(e.material, materialien);
    if (e.standard === 'vbbo' && !e.nutzungsart) e.nutzungsart = NUTZUNGSARTEN[0].id;
    $('#f-standard-display').textContent = e.standard === 'vbbo' ? 'VBBo (Bodenqualität)' : 'VVEA (Deponieklassen)';
    $('#f-nutzungsart-field').style.display = e.standard === 'vbbo' ? 'block' : 'none';
    recomputeClassification();
    paintAnalyseTable();
  }

  const materialSel = $('#f-material');
  materialSel.addEventListener('change', () => {
    e.material = materialSel.value;
    applyMaterialStandard();
  });

  const personSel = $('#f-person'), personAndere = $('#f-person-andere');
  personSel.addEventListener('change', () => {
    if (personSel.value === ANDERE) { personAndere.style.display = 'block'; e.probenehmer = personAndere.value; }
    else { personAndere.style.display = 'none'; e.probenehmer = personSel.value; }
  });
  personAndere.addEventListener('input', () => { e.probenehmer = personAndere.value; });

  const ortSel = $('#f-ort'), ortAndere = $('#f-ort-andere');
  ortSel.addEventListener('change', () => {
    if (ortSel.value === ANDERE) { ortAndere.style.display = 'block'; e.entnahmeort = ortAndere.value; }
    else { ortAndere.style.display = 'none'; e.entnahmeort = ortSel.value; }
  });
  ortAndere.addEventListener('input', () => { e.entnahmeort = ortAndere.value; });

  const entsorgungswegSel = $('#f-entsorgungsweg'), entsorgungswegAndere = $('#f-entsorgungsweg-andere');
  entsorgungswegSel.addEventListener('change', () => {
    if (entsorgungswegSel.value === ANDERE) { entsorgungswegAndere.style.display = 'block'; e.entsorgungsweg = entsorgungswegAndere.value; }
    else { entsorgungswegAndere.style.display = 'none'; e.entsorgungsweg = entsorgungswegSel.value; }
  });
  entsorgungswegAndere.addEventListener('input', () => { e.entsorgungsweg = entsorgungswegAndere.value; });

  const laborSel = $('#f-labor'), laborAndere = $('#f-labor-andere');
  laborSel.addEventListener('change', () => {
    if (laborSel.value === ANDERE) { laborAndere.style.display = 'block'; e.labor = laborAndere.value; }
    else { laborAndere.style.display = 'none'; e.labor = laborSel.value; }
  });
  laborAndere.addEventListener('input', () => { e.labor = laborAndere.value; });

  $('#f-bemerkungen').addEventListener('input', ev => e.bemerkungen = ev.target.value);
  $('#f-datum').addEventListener('input', ev => { if (ev.target.value) e.createdAt = new Date(ev.target.value).toISOString(); });
  $('#f-menge').addEventListener('input', ev => { const v = ev.target.value; e.menge = v === '' ? null : parseFloat(v); });
  $('#f-menge-einheit').addEventListener('change', ev => { e.mengeEinheit = ev.target.value; });

  $$('#analytik-programme-list [data-ap]').forEach(cb => {
    cb.addEventListener('change', ev => {
      const id = ev.target.dataset.ap;
      if (ev.target.checked) { if (!e.analytikProgramme.includes(id)) e.analytikProgramme.push(id); }
      else e.analytikProgramme = e.analytikProgramme.filter(x => x !== id);
    });
  });
  // "Analysen auslösen" fügt keine Zeilen mehr in die Analysewerte-Tabelle
  // ein, sondern schickt einen Analysenauftrag (PDF + E-Mail-Text mit den
  // gewünschten Parametern) ans gewählte Labor — die Analysewerte selbst
  // werden separat erfasst, sobald die Laborresultate vorliegen (manuell
  // oder per CSV/PDF-Import unten).
  $('#btn-trigger-analytik').addEventListener('click', async () => {
    const chosen = analytikProgramme.filter(p => e.analytikProgramme.includes(p.id));
    if (!chosen.length) { toast('Bitte mindestens ein Analytik-Programm auswählen.'); return; }
    if (!e.labor) { toast('Bitte ein Labor auswählen.'); return; }
    if (isNew) { toast('Bitte die Probe zuerst speichern, dann können die Analysen ausgelöst werden.'); return; }
    const labor = labore.find(l => l.name === e.labor) || { name: e.labor };
    if (!labor.email) {
      toast(`Für „${labor.name}" ist keine E-Mail-Adresse hinterlegt — unter Einstellungen > Labore ergänzen.`);
      return;
    }
    const params = activeParamList();
    // Für Niutec gibt es das ECHTE Auftragsformular des Labors (siehe
    // niutec-form.js) — statt sofort zu erzeugen, erst eine Kontroll-Ansicht
    // zeigen (automatisch vorausgefüllt, aber vor dem Senden anpassbar).
    if (labor.id === 'niutec') {
      try {
        const proposal = buildNiutecProposal(e, unsereFirma, chosen);
        paintNiutecReview(e, proposal, labor, chosen, params);
      } catch (err) {
        console.error(err);
        toast('Niutec-Formular konnte nicht vorbereitet werden: ' + errMsg(err));
      }
      return;
    }
    const btn = $('#btn-trigger-analytik');
    btn.disabled = true;
    try {
      const blob = await generateLabOrderPDF(e, labor, chosen, params);
      const filename = `Analysenauftrag_${(e.probeBezeichnung || 'Probe')}`.replace(/[^\w\-]+/g, '_') + '.pdf';
      const subject = `Analysenauftrag – ${e.baustelle || ''} – ${e.probeBezeichnung || ''}`.trim();
      const body = buildLabOrderMailSummary(e, labor, chosen, params);
      const result = await sharePDFOrDownload(blob, filename, subject, body);
      if (result === 'shared') {
        toast('Analysenauftrag geteilt.');
      } else if (result === 'downloaded') {
        toast('Analysenauftrag-PDF heruntergeladen — bitte manuell an die E-Mail anhängen.');
        window.location.href = buildLabOrderMailto(e, labor, chosen, params);
      }
    } catch (err) {
      console.error(err);
      toast('Analysenauftrag konnte nicht erstellt werden: ' + errMsg(err));
    } finally {
      btn.disabled = false;
    }
  });

  const nutzungsartSel = $('#f-nutzungsart');
  if (nutzungsartSel) nutzungsartSel.addEventListener('change', ev => {
    e.nutzungsart = ev.target.value;
    recomputeClassification();
    paintClassificationBanner();
  });

  $('#btn-gps').addEventListener('click', () => {
    if (!navigator.geolocation) { toast('Geolocation nicht verfügbar'); return; }
    navigator.geolocation.getCurrentPosition(pos => {
      e.gps = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      $('#gps-status').textContent = `Position: ${e.gps.lat.toFixed(5)}, ${e.gps.lng.toFixed(5)}`;
      toast('Standort erfasst');
    }, err => toast('Standort konnte nicht ermittelt werden: ' + err.message));
  });

  $('#btn-photo').addEventListener('click', () => $('#photo-input').click());
  $('#photo-input').addEventListener('change', ev => {
    for (const file of ev.target.files) pendingPhotos.push(file);
    ev.target.value = '';
    paintPhotoGrid();
  });
  paintPhotoGrid();

  $('#btn-add-row').addEventListener('click', () => {
    e.analyse.push({ parameterKey: '', wert: null, einheit: '', art: 'gesamt', quelle: 'manuell' });
    paintAnalyseTable();
  });
  $('#btn-import-csv').addEventListener('click', () => $('#csv-input').click());
  $('#csv-input').addEventListener('change', async ev => {
    const file = ev.target.files[0];
    ev.target.value = '';
    if (!file) return;
    const text = await file.text();
    const rows = parseCSV(text, activeParamList());
    showImportPreview(rows, 'CSV');
  });
  $('#btn-import-pdf').addEventListener('click', () => $('#pdf-input').click());
  $('#pdf-input').addEventListener('change', async ev => {
    const file = ev.target.files[0];
    ev.target.value = '';
    if (!file) return;
    toast('PDF wird analysiert …');
    try {
      const buf = await file.arrayBuffer();
      const rows = await parsePDF(buf, activeParamList());
      if (!rows.length) toast('Keine bekannten Parameter im PDF gefunden – bitte manuell erfassen.');
      showImportPreview(rows, 'PDF');
    } catch (err) {
      console.error(err);
      toast('PDF konnte nicht gelesen werden: ' + err.message);
    }
  });

  paintAnalyseTable();

  $('#btn-save').addEventListener('click', async () => {
    if (isNew && !standalone && !e.projektId) { toast('Bitte ein Projekt auswählen.'); return; }
    const btn = $('#btn-save');
    btn.disabled = true;
    try {
      recomputeClassification();
      updateVevaCodeUI();
      const payload = { ...e };
      delete payload.photos;
      if (!isNew && !standalone && canManageThisEntry) {
        payload.externZugriff = $$('[data-extern-zugriff]').filter(cb => cb.checked).map(cb => cb.value);
      }
      const wasNewStandalone = isNew && standalone;
      let saved;
      if (isNew) saved = await createEntryApi(payload);
      else saved = await updateEntryApi(e.id, payload);
      if (pendingPhotos.length) {
        toast(`Lade ${pendingPhotos.length} Foto(s) hoch …`);
        const uploaded = await uploadPhotos(saved.id, pendingPhotos);
        saved.photos = [...(saved.photos || []), ...uploaded];
        pendingPhotos = [];
      }
      currentEntry = saved;
      isNew = false;
      toast('Gespeichert');
      if (wasNewStandalone) {
        // Neue Einzelprobe ohne Projekt (Probenahmeprotokoll) — direkt auf die
        // Übersicht (Startseite), nicht ins Eintragsformular der frisch
        // angelegten Probe (die lässt sich jederzeit übers Probenahmeprotokoll
        // wiederfinden und weiterbearbeiten).
        location.hash = '#/start';
        return;
      }
      const targetHash = `#/eintrag/${saved.id}`;
      if (location.hash === targetHash) await renderEntryForm(saved.id);
      else location.hash = targetHash;
    } catch (err) {
      toast('Fehler beim Speichern: ' + errMsg(err));
    } finally {
      btn.disabled = false;
    }
  });

  async function buildPdfReportEntry() {
    const reportEntry = { ...e, photos: [] };
    for (const p of pendingPhotos) reportEntry.photos.push({ blob: p, filename: p.name });
    for (const p of (e.photos || [])) {
      try {
        const blob = await fetchPhotoBlob(e.id, p.id);
        reportEntry.photos.push({ blob, filename: p.originalName || p.filename });
      } catch (err) { /* Foto überspringen */ }
    }
    return reportEntry;
  }
  function pdfFilename() {
    return `${(e.baustelle || 'Probe')}_${(e.probeBezeichnung || 'neu')}`.replace(/[^\w\-]+/g, '_') + '.pdf';
  }

  $('#btn-pdf').addEventListener('click', async () => {
    recomputeClassification();
    toast('PDF wird erstellt …');
    try {
      const reportEntry = await buildPdfReportEntry();
      const blob = await generateReportPDF(reportEntry, currentClassification, classesForEntry(e), thresholdsForEntry(e));
      downloadBlob(pdfFilename(), blob);
    } catch (err) {
      console.error(err);
      toast('PDF konnte nicht erstellt werden: ' + errMsg(err));
    }
  });

  $('#btn-mail').addEventListener('click', async () => {
    recomputeClassification();
    toast('PDF wird erstellt …');
    try {
      const classes = classesForEntry(e);
      const reportEntry = await buildPdfReportEntry();
      const blob = await generateReportPDF(reportEntry, currentClassification, classes, thresholdsForEntry(e));
      const subject = `Probennahmejournal – ${e.baustelle || ''} – ${e.probeBezeichnung || ''}`.trim();
      const body = buildMailSummary(e, currentClassification, classes);
      const result = await sharePDFOrDownload(blob, pdfFilename(), subject, body);
      if (result === 'shared') {
        toast('Zum Teilen/Senden bereit – PDF ist angehängt.');
      } else if (result === 'downloaded') {
        toast('PDF heruntergeladen – bitte in der E-Mail manuell anhängen (mailto: kann keine Anhänge setzen).');
        window.location.href = buildMailto(e, currentClassification, '', classes);
      }
    } catch (err) {
      console.error(err);
      toast('PDF/E-Mail konnte nicht vorbereitet werden: ' + errMsg(err));
    }
  });

  if (!isNew) {
    if ($('#btn-delete')) {
      $('#btn-delete').addEventListener('click', async () => {
        const confirmMsg = canManageThisEntry
          ? 'Diese Probe wirklich löschen?'
          : 'Löschung dieser Probe bei der Projektleitung/Admin beantragen?';
        if (!confirm(confirmMsg)) return;
        try {
          const result = await deleteEntryApi(e.id);
          if (result && result.entry) {
            // 202 — nur beantragt, Probe bleibt bestehen
            toast(result.message || 'Löschung beantragt');
            await renderEntryForm(e.id);
          } else {
            // 204 — sofort gelöscht
            toast('Gelöscht');
            location.hash = '#/journal';
          }
        } catch (err) {
          toast('Fehler: ' + errMsg(err));
        }
      });
    }

    if ($('#btn-approve-delete')) {
      $('#btn-approve-delete').addEventListener('click', async () => {
        if (!confirm('Löschung dieser Probe endgültig freigeben?')) return;
        try {
          await approveDeleteApi(e.id);
          toast('Gelöscht');
          location.hash = '#/journal';
        } catch (err) {
          toast('Fehler: ' + errMsg(err));
        }
      });
    }
    if ($('#btn-reject-delete')) {
      $('#btn-reject-delete').addEventListener('click', async () => {
        try {
          await rejectDeleteApi(e.id);
          toast('Löschantrag abgelehnt — Probe bleibt bestehen');
          await renderEntryForm(e.id);
        } catch (err) {
          toast('Fehler: ' + errMsg(err));
        }
      });
    }
    if ($('#btn-cancel-delete-request')) {
      $('#btn-cancel-delete-request').addEventListener('click', async () => {
        try {
          await cancelDeleteRequestApi(e.id);
          toast('Antrag zurückgezogen');
          await renderEntryForm(e.id);
        } catch (err) {
          toast('Fehler: ' + errMsg(err));
        }
      });
    }

    $('#btn-print-label').addEventListener('click', async () => {
      const size = { w: parseFloat($('#f-label-w').value) || 62, h: parseFloat($('#f-label-h').value) || 29 };
      saveLabelSize(size);
      const chosen = analytikProgramme.filter(p => e.analytikProgramme.includes(p.id));
      const labor = labore.find(l => l.name === e.labor) || (e.labor ? { name: e.labor } : null);
      const subLine = [e.material, e.baustelle].filter(Boolean).join(' · ');
      const qrText = buildLabelQrText(e, labor, chosen);
      try {
        await printLabel(e.probeBezeichnung, subLine, qrText, size);
      } catch (err) {
        console.error(err);
        toast('Etikette konnte nicht erstellt werden: ' + errMsg(err));
      }
    });
  }
}

// ---------- Niutec-Analysenauftrag: Kontroll-/Anpass-Ansicht ----------
// Zeigt den automatisch erstellten Vorschlag (siehe niutec-form.js) VOR dem
// Erzeugen des echten Formular-PDFs — Firmendaten, Probentitel und vor allem
// die angekreuzten Analysen (Zuordnung Analytik-Programm -> Niutec-Checkbox
// ist eine Bestmöglich-Zuordnung, keine von Niutec bestätigte Referenz)
// lassen sich hier noch korrigieren, bevor irgendetwas verschickt wird.
function paintNiutecReview(e, proposal, labor, chosen, params) {
  const labels = NIUTEC_CHECKBOX_LABELS[proposal.standard];
  appEl.innerHTML = `
    <div class="card">
      <h2>📋 Niutec-Analysenauftrag prüfen &amp; anpassen</h2>
      <p class="hint">Automatisch aus der Probe und den gewählten Analytik-Programmen vorausgefüllt — bitte
      vor dem Senden kontrollieren, besonders die angekreuzten Analysen (die Zuordnung Analytik-Programm →
      Niutec-Checkbox ist eine Bestmöglich-Zuordnung, keine von Niutec bestätigte Referenz). Es wird das
      echte Niutec-Formular befüllt, keine Probendaten verlassen dabei vorher das Gerät.</p>
    </div>

    <div class="card">
      <h2>Auftraggeber (Firma)</h2>
      <p class="hint">Startwerte aus Einstellungen &gt; Unsere Firma — hier nur für diesen Auftrag anpassbar.</p>
      <div class="grid-2">
        <div class="field"><label>Firma</label><input id="nf-firma" value="${escapeHtml(proposal.firma)}"></div>
        <div class="field"><label>Ansprechperson</label><input id="nf-name" value="${escapeHtml(proposal.name)}"></div>
        <div class="field"><label>Strasse / PF</label><input id="nf-strasse" value="${escapeHtml(proposal.strasse)}"></div>
        <div class="field"><label>PLZ / Ort</label><input id="nf-plzort" value="${escapeHtml(proposal.plzOrt)}"></div>
        <div class="field"><label>Tel</label><input id="nf-tel" value="${escapeHtml(proposal.tel)}"></div>
        <div class="field"><label>E-Mail</label><input id="nf-email" value="${escapeHtml(proposal.email)}"></div>
      </div>
    </div>

    <div class="card">
      <h2>Probe</h2>
      <div class="field"><label>Titel <span class="hint">(erscheint auf dem Bericht)</span></label><input id="nf-titel" value="${escapeHtml(proposal.titel)}"></div>
      <div class="field"><label>Probenbezeichnung</label><input id="nf-probenbezeichnung" value="${escapeHtml(proposal.probenbezeichnung)}"></div>
      ${proposal.standard === 'vbbo' ? `
      <div class="grid-2">
        <div class="field"><label>Tiefe von (cm)</label><input id="nf-tiefevon" value="${escapeHtml(proposal.tiefeVon)}"></div>
        <div class="field"><label>Tiefe bis (cm)</label><input id="nf-tiefebis" value="${escapeHtml(proposal.tiefeBis)}"></div>
      </div>` : ''}
    </div>

    <div class="card">
      <h2>Gewünschte Analysen</h2>
      <div class="choice-list">
        ${Object.entries(labels).map(([key, label]) => `
          <label class="choice-item">
            <input type="checkbox" data-nf-cb="${key}" ${proposal.checkboxes[key] ? 'checked' : ''}>
            <span>${escapeHtml(label)}</span>
          </label>`).join('')}
      </div>
      <div class="field"><label>Andere Parameter <span class="hint">(Freitext, z.B. für nicht oben aufgeführte Analysen)</span></label><textarea id="nf-andere" rows="2">${escapeHtml(proposal.andereParameter)}</textarea></div>
    </div>

    <div class="card">
      <h2>Weiteres</h2>
      <div class="field"><label>Datum</label><input id="nf-datum" value="${escapeHtml(proposal.datum)}"></div>
      <div class="field"><label>Bemerkungen</label><textarea id="nf-bemerkungen" rows="2">${escapeHtml(proposal.bemerkungen)}</textarea></div>
    </div>

    <div class="btn-row">
      <button class="btn" id="btn-niutec-generate" type="button">📧 PDF erzeugen &amp; senden</button>
      <button class="btn secondary" id="btn-niutec-cancel" type="button">Abbrechen</button>
    </div>
  `;

  $('#btn-niutec-cancel').addEventListener('click', () => paintEntryForm());

  $('#btn-niutec-generate').addEventListener('click', async () => {
    const btn = $('#btn-niutec-generate');
    btn.disabled = true;
    try {
      const edited = {
        ...proposal,
        firma: $('#nf-firma').value.trim(),
        name: $('#nf-name').value.trim(),
        strasse: $('#nf-strasse').value.trim(),
        plzOrt: $('#nf-plzort').value.trim(),
        tel: $('#nf-tel').value.trim(),
        email: $('#nf-email').value.trim(),
        berichtEmail: !!$('#nf-email').value.trim(),
        titel: $('#nf-titel').value.trim(),
        probenbezeichnung: $('#nf-probenbezeichnung').value.trim(),
        tiefeVon: proposal.standard === 'vbbo' ? $('#nf-tiefevon').value.trim() : '',
        tiefeBis: proposal.standard === 'vbbo' ? $('#nf-tiefebis').value.trim() : '',
        andereParameter: $('#nf-andere').value.trim(),
        datum: $('#nf-datum').value.trim(),
        bemerkungen: $('#nf-bemerkungen').value.trim(),
        checkboxes: Object.fromEntries($$('[data-nf-cb]').map(cb => [cb.dataset.nfCb, cb.checked])),
      };
      const blob = await fillNiutecPdf(edited);
      const filename = `Analysenauftrag-Niutec_${(e.probeBezeichnung || 'Probe')}`.replace(/[^\w\-]+/g, '_') + '.pdf';
      const subject = `Analysenauftrag – ${e.baustelle || ''} – ${e.probeBezeichnung || ''}`.trim();
      const body = buildLabOrderMailSummary(e, labor, chosen, params);
      const result = await sharePDFOrDownload(blob, filename, subject, body);
      if (result === 'shared') {
        toast('Analysenauftrag geteilt.');
      } else if (result === 'downloaded') {
        toast('Analysenauftrag-PDF heruntergeladen — bitte manuell an die E-Mail anhängen.');
        window.location.href = buildLabOrderMailto(e, labor, chosen, params);
      }
      paintEntryForm();
    } catch (err) {
      console.error(err);
      toast('Niutec-Formular konnte nicht erstellt werden: ' + errMsg(err));
      btn.disabled = false;
    }
  });
}

function toLocalInputValue(iso) {
  const d = new Date(iso);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function paintPhotoGrid() {
  const grid = $('#photo-grid');
  grid.innerHTML = '';
  (currentEntry.photos || []).forEach(p => {
    const div = document.createElement('div');
    div.className = 'photo-thumb';
    const img = document.createElement('img');
    grid.appendChild(div);
    div.appendChild(img);
    getPhotoUrl(currentEntry.id, p).then(url => { img.src = url; }).catch(() => {});
    const del = document.createElement('button');
    del.textContent = '×';
    del.type = 'button';
    del.addEventListener('click', async () => {
      try {
        await deletePhotoApi(currentEntry.id, p.id);
        currentEntry.photos = currentEntry.photos.filter(x => x.id !== p.id);
        paintPhotoGrid();
      } catch (err) { toast('Foto konnte nicht gelöscht werden: ' + errMsg(err)); }
    });
    div.appendChild(del);
  });
  pendingPhotos.forEach((file, idx) => {
    const div = document.createElement('div');
    div.className = 'photo-thumb';
    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    const badge = document.createElement('span');
    badge.textContent = '⏳';
    badge.style.cssText = 'position:absolute;bottom:2px;left:2px;background:rgba(0,0,0,.6);color:#fff;border-radius:4px;padding:0 4px;font-size:.7rem;';
    const del = document.createElement('button');
    del.textContent = '×';
    del.type = 'button';
    del.addEventListener('click', () => { pendingPhotos.splice(idx, 1); paintPhotoGrid(); });
    div.append(img, badge, del);
    grid.appendChild(div);
  });
}

function activeParamList() {
  return currentEntry.standard === 'vbbo' ? VBBO_PARAMETERS : PARAMETERS;
}

// Zeigt nur Analytik-Programme an, die mindestens einen Parameter aus der
// zum aktuellen Standard (VVEA/VBBo) der Probe passenden Parameterliste
// enthalten — so tauchen z.B. reine VBBo-Programme bei einer VVEA-Probe
// nicht in der Auswahl auf.
function relevantAnalytikProgramme() {
  const activeKeys = new Set(activeParamList().map(p => p.key));
  return analytikProgramme.filter(p => (p.parameterKeys || []).some(k => activeKeys.has(k)));
}

// Gruppiert die verfügbaren Parameter (VVEA Feststoff/Eluat + VBBo) für die
// Checkbox-Auswahl in den Einstellungen (Analytik-Programme bearbeiten).
function analytikParamGroups() {
  return [
    { label: 'VVEA – Feststoff', list: PARAMETERS.filter(p => p.art !== 'eluat') },
    { label: 'VVEA – Eluat', list: PARAMETERS.filter(p => p.art === 'eluat') },
    { label: 'VBBo', list: VBBO_PARAMETERS },
  ];
}

function paramOptionsHtml(selected) {
  return `<option value="">– wählen –</option>` + activeParamList().map(p =>
    `<option value="${p.key}" ${p.key === selected ? 'selected' : ''}>${escapeHtml(p.label)}</option>`).join('');
}

// Badge mit der Einstufung, die dieser einzelne Wert für sich genommen
// ergibt (aus currentClassification.perParameter, siehe classify() in
// vvea.js) — so ist auf einen Blick erkennbar, welche Werte zu hoch sind und
// welche unauffällig, unabhängig von der Gesamteinstufung der Probe (die vom
// jeweils schlechtesten Wert bestimmt wird). "–" = Zeile noch unvollständig
// oder für diesen Parameter ist kein Grenzwert hinterlegt (unbewertet).
function rowClassBadge(row) {
  if (!currentClassification || !row.parameterKey || row.wert === null || row.wert === undefined || Number.isNaN(row.wert)) {
    return '<span class="hint">–</span>';
  }
  const info = currentClassification.perParameter.find(p => p.parameterKey === row.parameterKey);
  if (!info) return '<span class="hint" title="Kein Grenzwert für diesen Parameter hinterlegt">–</span>';
  const classes = classesForEntry(currentEntry);
  const classInfo = classes[info.classIndex];
  if (!classInfo) return '<span class="hint">–</span>';
  return `<span class="badge" style="background:${classInfo.color}" title="${escapeHtml(classInfo.label)}">${escapeHtml(classInfo.short)}</span>`;
}

function paintAnalyseTable() {
  const table = $('#analyse-table');
  const rows = currentEntry.analyse;
  const isVbbo = currentEntry.standard === 'vbbo';
  if (rows.length === 0) {
    table.innerHTML = '<tr><td class="hint" colspan="6">Noch keine Werte – manuell hinzufügen oder CSV/PDF importieren.</td></tr>';
  } else {
    table.innerHTML = `<tr><th>Parameter</th><th>Wert</th><th>Einheit</th><th>Art</th><th>Einstufung</th><th></th></tr>` +
      rows.map((r, i) => `
        <tr>
          <td><select data-i="${i}" data-f="parameterKey">${paramOptionsHtml(r.parameterKey)}</select></td>
          <td><input data-i="${i}" data-f="wert" type="number" step="any" inputmode="decimal" value="${r.wert ?? ''}"></td>
          <td class="hint">${escapeHtml(r.einheit || '')}</td>
          <td>${isVbbo ? '<span class="hint">Gesamtgehalt</span>' : `<select data-i="${i}" data-f="art">
                <option value="gesamt" ${r.art === 'gesamt' ? 'selected' : ''}>Gesamtgehalt</option>
                <option value="eluat" ${r.art === 'eluat' ? 'selected' : ''}>Eluat</option>
              </select>`}</td>
          <td data-badge="${i}">${rowClassBadge(r)}</td>
          <td><button type="button" data-del="${i}" class="btn danger" style="padding:.2rem .5rem;">×</button></td>
        </tr>`).join('');
  }
  // Aktualisiert nur die Einstufungs-Badges (statt die ganze Tabelle neu zu
  // zeichnen) — sonst würde der Fokus/die Cursorposition im gerade
  // bearbeiteten Eingabefeld bei jedem Tastendruck verloren gehen.
  function refreshRowBadges() {
    $$('#analyse-table [data-badge]').forEach(td => {
      const r = currentEntry.analyse[Number(td.dataset.badge)];
      if (r) td.innerHTML = rowClassBadge(r);
    });
  }
  $$('#analyse-table select, #analyse-table input').forEach(el => {
    el.addEventListener('input', ev => {
      const i = Number(ev.target.dataset.i);
      const f = ev.target.dataset.f;
      let val = ev.target.value;
      if (f === 'wert') val = val === '' ? null : parseFloat(val);
      currentEntry.analyse[i][f] = val;
      if (f === 'parameterKey') {
        const def = activeParamList().find(p => p.key === val);
        if (def) {
          currentEntry.analyse[i].einheit = def.unit;
          currentEntry.analyse[i].art = def.art || 'gesamt';
          paintAnalyseTable();
          return;
        }
      }
      recomputeClassification();
      refreshRowBadges();
      paintClassificationBanner();
    });
  });
  $$('#analyse-table [data-del]').forEach(btn => {
    btn.addEventListener('click', () => {
      currentEntry.analyse.splice(Number(btn.dataset.del), 1);
      recomputeClassification();
      paintAnalyseTable();
      paintClassificationBanner();
    });
  });
  paintClassificationBanner();
}

function paintClassificationBanner() {
  const el = $('#classification-banner');
  if (!currentClassification) {
    el.innerHTML = '<p class="hint">Noch keine bewertbaren Analysewerte.</p>';
  } else {
    const classes = classesForEntry(currentEntry);
    const info = classes[currentClassification.classIndex];
    const unbewertetHint = currentClassification.unbewertet.length
      ? `<p class="hint">${currentClassification.unbewertet.length} Wert(e) ohne hinterlegten Grenzwert – nicht in Klassifizierung eingeflossen.</p>`
      : '';
    el.innerHTML = `<div class="classification-banner" style="background:${info.color}">
      Einstufung: ${escapeHtml(info.label)}
    </div>${unbewertetHint}`;
  }
  updateVevaCodeUI();
}

// Bestimmt den VeVA-Aushubcode ausschliesslich automatisch aus Material +
// Standard + aktueller Einstufung und zeigt ihn nur an — anders als früher
// gibt es dafür keine manuelle Auswahl mehr im Formular: Der Code ist mit
// dem Material fix verknüpft (siehe Einstellungen > Materialien) und wird
// bei jeder Änderung an Material oder Analysewerten neu berechnet.
function updateVevaCodeUI() {
  const display = $('#f-veva-code-display');
  const hint = $('#veva-code-hint');
  if (!display || !hint) return; // Formular (noch) nicht im DOM, z.B. beim ersten recomputeClassification()

  const classId = currentClassification?.classId || null;
  const suggestion = suggestVevaCode(currentEntry.material, currentEntry.standard, classId, vevaCodes, materialien);
  currentEntry.vevaCode = suggestion ? suggestion.code : '';
  display.textContent = suggestion ? `${suggestion.code} – ${suggestion.bezeichnung}` : '–';
  if (!currentEntry.material) {
    hint.textContent = 'Noch kein Material gewählt.';
  } else if (!classId) {
    hint.textContent = 'Noch keine bewertbaren Analysewerte – automatische Zuordnung folgt nach der ersten Einstufung.';
  } else if (suggestion) {
    hint.textContent = '🤖 automatisch zugeordnet.';
  } else {
    hint.textContent = 'Kein passender VeVA-Aushubcode für Material/Einstufung hinterlegt.';
  }
}

function showImportPreview(rows, source) {
  const el = $('#import-preview');
  if (rows.length === 0) {
    el.innerHTML = `<p class="hint">Keine verwertbaren Zeilen im ${source}-Import gefunden.</p>`;
    return;
  }
  el.innerHTML = `<div class="import-preview">
    <table class="analyse-table">
      <tr><th></th><th>Erkannt (roh)</th><th>Parameter</th><th>Wert</th><th>Art</th></tr>
      ${rows.map((r, i) => `
        <tr>
          <td><input type="checkbox" data-imp="${i}" ${r.parameterKey ? 'checked' : ''}></td>
          <td class="hint">${escapeHtml(r.roh)}</td>
          <td><select data-imp-f="${i}" data-f="parameterKey">${paramOptionsHtml(r.parameterKey)}</select></td>
          <td>${r.wert}</td>
          <td>${r.art === 'eluat' ? 'Eluat' : 'Gesamtgehalt'}</td>
        </tr>`).join('')}
    </table>
  </div>
  <div class="btn-row">
    <button class="btn" id="btn-confirm-import" type="button">Ausgewählte übernehmen</button>
    <button class="btn secondary" id="btn-cancel-import" type="button">Verwerfen</button>
  </div>`;
  $$('[data-imp-f]').forEach(sel => sel.addEventListener('change', ev => {
    rows[Number(ev.target.dataset.impF)].parameterKey = ev.target.value || null;
  }));
  $('#btn-confirm-import').addEventListener('click', () => {
    let added = 0;
    $$('[data-imp]').forEach(cb => {
      if (!cb.checked) return;
      const r = rows[Number(cb.dataset.imp)];
      if (!r.parameterKey) return;
      currentEntry.analyse.push({ parameterKey: r.parameterKey, wert: r.wert, einheit: r.einheit, art: r.art, quelle: source.toLowerCase() });
      added++;
    });
    el.innerHTML = '';
    recomputeClassification();
    paintAnalyseTable();
    toast(`${added} Wert(e) übernommen`);
  });
  $('#btn-cancel-import').addEventListener('click', () => { el.innerHTML = ''; });
}

// ---------- Einstellungen ----------
const VBBO_COLS = [
  { key: 'richtwert', label: 'Richtwert' },
  { key: 'pwDirekt', label: 'Prüfwert (Direktkontakt)' },
  { key: 'pwNahrung', label: 'Prüfwert (Nahrungspfl.)' },
  { key: 'pwFutter', label: 'Prüfwert (Futterpfl.)' },
  { key: 'sanSpielplatz', label: 'Sanierung (Spielplatz)' },
  { key: 'sanGarten', label: 'Sanierung (Garten)' },
  { key: 'sanLandwirtschaft', label: 'Sanierung (Landwirtschaft)' },
];
const VEVA_MATERIALIEN = ['Oberboden', 'Unterboden', 'Aushub'];

async function renderSettings() {
  appEl.innerHTML = '<p class="hint">Lade Einstellungen …</p>';
  await loadVveaConfig();
  const me = getCurrentUser();
  thresholdRequests = (isAdmin(me) || isProjektleiter(me)) ? await listThresholdRequestsApi().catch(() => []) : [];
  await paintSettings();
}

// Zeichnet die Einstellungsseite aus dem bereits geladenen Zustand
// (thresholds/vbboThresholds/vevaCodes/PARAMETERS/VBBO_PARAMETERS) neu, ohne
// erneut vom Server zu laden — wichtig, damit z.B. eine gerade erst
// hinzugefügte, noch ungespeicherte VeVA-Code-Zeile beim Neuzeichnen nicht
// verloren geht.
async function paintSettings() {
  const me = getCurrentUser();
  const isAdmin = me?.role === 'admin';
  const isProjektleiterRole = me?.role === 'projektleiter';
  const canProposeThresholds = isAdmin || isProjektleiterRole;
  const canEditAnalytik = isAdmin || isProjektleiterRole;
  const editableClasses = CLASSES.filter(c => !c.terminal);

  let usersHtml = '';
  if (isAdmin) {
    usersHtml = `<div class="card">
      <h2>Benutzer verwalten</h2>
      <p class="hint">Individuelle Zugänge für dein Baustellen-Team. Es gibt keinen Selbst-Registrierungslink –
      Konten werden hier durch eine Administrationsperson angelegt.</p>
      <div id="user-list" class="entry-list"></div>
      <h3>Neuen Benutzer anlegen</h3>
      <div class="grid-2">
        <div class="field"><label>Name</label><input id="nu-name"></div>
        <div class="field"><label>E-Mail oder Kürzel <span class="hint">(zum Anmelden, muss eindeutig sein)</span></label><input id="nu-email" type="text" autocomplete="off"></div>
        <div class="field"><label>Passwort (mind. 8 Zeichen)</label><input id="nu-pass" type="password" autocomplete="new-password"></div>
        <div class="field"><label>Rolle</label>
          <select id="nu-role">
            <option value="probenehmer">Probenehmer/in</option>
            <option value="projektleiter">Projektleitung</option>
            <option value="extern">Extern (nur lesen)</option>
            <option value="admin">Administrator/in</option>
          </select>
        </div>
      </div>
      <button class="btn" id="btn-create-user" type="button">+ Benutzer anlegen</button>
    </div>`;
  }

  appEl.innerHTML = `
    <div class="btn-row" style="margin-bottom:1rem;">
      <button type="button" class="btn ${settingsTab === 'grenzwerte' ? '' : 'secondary'}" data-settings-tab="grenzwerte">📏 Grenzwerte</button>
      <button type="button" class="btn ${settingsTab === 'stammdaten' ? '' : 'secondary'}" data-settings-tab="stammdaten">🗂️ Stammdaten</button>
      ${isAdmin ? `<button type="button" class="btn ${settingsTab === 'benutzer' ? '' : 'secondary'}" data-settings-tab="benutzer">👤 Benutzer</button>` : ''}
      <button type="button" class="btn ${settingsTab === 'info' ? '' : 'secondary'}" data-settings-tab="info">ℹ️ Info</button>
    </div>

    <div class="settings-section" style="display:${settingsTab === 'grenzwerte' ? '' : 'none'};">
    <div class="card">
      <h2>Grenzwerte (Deponieklassen)</h2>
      <p class="hint">Leeres Feld = für diese Klasse nicht geregelt. Diese Tabelle bestimmt die Farbcodierung
      für <strong>alle</strong> Benutzer/innen.
      ${isAdmin ? '' : isProjektleiterRole ? ' Projektleitung kann eine Änderung vorschlagen — wirksam erst nach Freigabe durch einen Admin.' : ' Nur Administrator/innen (bzw. auf Antrag die Projektleitung) können sie ändern.'}</p>
      <div style="overflow-x:auto">
      <table class="threshold-table" id="threshold-table">
        <tr><th>Parameter</th><th>Art</th><th>Einheit</th>${editableClasses.map(c => `<th style="color:${c.color}">${c.short}</th>`).join('')}${isAdmin ? '<th></th>' : ''}</tr>
        ${PARAMETERS.map(p => `
          <tr>
            <td>${escapeHtml(p.label)}</td>
            <td class="readonly">${p.art === 'eluat' ? 'Eluat' : 'Gesamt'}</td>
            <td class="readonly">${escapeHtml(p.unit || '–')}</td>
            ${editableClasses.map(c => `<td><input type="number" step="any" ${canProposeThresholds ? '' : 'disabled'} data-p="${p.key}" data-c="${c.id}" value="${thresholds[p.key]?.[c.id] ?? ''}"></td>`).join('')}
            ${isAdmin ? `<td><button type="button" class="btn danger" style="padding:.2rem .5rem;" data-del-param="${p.key}">×</button></td>` : ''}
          </tr>`).join('')}
      </table>
      </div>
      ${isAdmin ? `
      <div class="btn-row">
        <button class="btn" id="btn-save-thresholds">💾 Grenzwerte speichern</button>
        <button class="btn secondary" id="btn-reset-thresholds">Zurücksetzen auf Beispielwerte</button>
        <button class="btn secondary" id="btn-export-thresholds">⬇ Vorlage als CSV herunterladen</button>
        <input type="file" accept=".csv,text/csv" id="thresholds-csv-input" style="display:none">
        <button class="btn secondary" id="btn-import-thresholds">⬆ Grenzwerte aus CSV importieren</button>
      </div>
      <p class="hint">Excel: zuerst „Datei → Speichern unter → CSV“, dann hier importieren. Format siehe
      heruntergeladene Vorlage (Spalten: Parameter;Art;Einheit;${editableClasses.map(c => c.short).join(';')}).
      Unbekannte Parameter-Namen werden als neue Parameter vorgeschlagen.</p>
      <div id="thresholds-import-preview"></div>
      <h3>Neuen Parameter manuell hinzufügen</h3>
      <div class="grid-2">
        <div class="field"><label>Bezeichnung</label><input id="np-label" placeholder="z.B. Arsen (As)"></div>
        <div class="field"><label>Einheit</label><input id="np-unit" placeholder="z.B. mg/kg"></div>
        <div class="field"><label>Art</label><select id="np-art"><option value="gesamt">Gesamtgehalt</option><option value="eluat">Eluat</option></select></div>
      </div>
      <button class="btn secondary" id="btn-add-param" type="button">+ Parameter hinzufügen</button>
      ` : isProjektleiterRole ? `
      <div class="field"><label>Notiz zum Antrag <span class="hint">(optional, z.B. Grund der Anpassung)</span></label><input id="thr-request-note"></div>
      <div class="btn-row"><button class="btn" id="btn-request-thresholds" type="button">📨 Änderung beantragen</button></div>
      ` : ''}
      ${(isAdmin || isProjektleiterRole) ? `
      <h3>${isAdmin ? 'Offene Änderungsanträge' : 'Meine offenen Änderungsanträge'}</h3>
      ${thresholdRequests.length === 0 ? '<p class="hint">Keine offenen Anträge.</p>' : `
      <div class="entry-list">
        ${thresholdRequests.map(r => `
          <div class="entry-card" style="cursor:default;">
            <div class="entry-info">
              <h3 class="entry-title">${escapeHtml(r.requestedByName || 'Unbekannt')} <span class="hint">${fmtDate(r.requestedAt)}</span></h3>
              <p class="hint">${escapeHtml(r.note || 'Keine Notiz.')}</p>
            </div>
            <div class="btn-row" style="margin:0;">
              ${isAdmin ? `
                <button class="btn secondary" type="button" data-apply-thr-req="${r.id}">✅ Übernehmen</button>
                <button class="btn danger" type="button" data-reject-thr-req="${r.id}">❌ Ablehnen</button>
              ` : `<button class="btn secondary" type="button" data-cancel-thr-req="${r.id}">Zurückziehen</button>`}
            </div>
          </div>`).join('')}
      </div>`}
      ` : ''}
    </div>

    <div class="card">
      <h2>Grenzwerte (VBBo – Bodenqualität)</h2>
      <p class="hint">Rohwerte je Substanz. Welche Prüfwert-/Sanierungswert-Spalte zur Anwendung kommt, hängt von
      der bei der Probe gewählten Nutzungsart ab (siehe Legende unten). Leeres Feld = nicht geregelt.
      ${isAdmin ? '' : ' Nur Administrator/innen können sie ändern.'}</p>
      <div style="overflow-x:auto">
      <table class="threshold-table" id="vbbo-threshold-table">
        <tr><th>Parameter</th><th>Einheit</th>${VBBO_COLS.map(c => `<th>${escapeHtml(c.label)}</th>`).join('')}${isAdmin ? '<th></th>' : ''}</tr>
        ${VBBO_PARAMETERS.map(p => `
          <tr>
            <td>${escapeHtml(p.label)}</td>
            <td class="readonly">${escapeHtml(p.unit || '–')}</td>
            ${VBBO_COLS.map(c => `<td><input type="number" step="any" ${isAdmin ? '' : 'disabled'} data-vp="${p.key}" data-vc="${c.key}" value="${vbboThresholds[p.key]?.[c.key] ?? ''}"></td>`).join('')}
            ${isAdmin ? `<td><button type="button" class="btn danger" style="padding:.2rem .5rem;" data-del-vbbo-param="${p.key}">×</button></td>` : ''}
          </tr>`).join('')}
      </table>
      </div>
      ${isAdmin ? `
      <div class="btn-row">
        <button class="btn" id="btn-save-vbbo-thresholds">💾 VBBo-Grenzwerte speichern</button>
        <button class="btn secondary" id="btn-reset-vbbo-thresholds">Zurücksetzen auf Beispielwerte</button>
      </div>
      <h3>Neuen VBBo-Parameter manuell hinzufügen</h3>
      <div class="grid-2">
        <div class="field"><label>Bezeichnung</label><input id="nvp-label" placeholder="z.B. Kupfer (Cu)"></div>
        <div class="field"><label>Einheit</label><input id="nvp-unit" placeholder="z.B. mg/kg"></div>
      </div>
      <button class="btn secondary" id="btn-add-vbbo-param" type="button">+ Parameter hinzufügen</button>
      ` : ''}
    </div>
    </div>

    <div class="settings-section" style="display:${settingsTab === 'stammdaten' ? '' : 'none'};">
    <div class="card">
      <h2>Materialien</h2>
      <p class="hint">Legt fest, welche Materialien bei einer Probe wählbar sind und welcher Einstufungsstandard
      (VVEA/VBBo) sowie welcher VeVA-Aushubcode-„Eimer" (siehe VeVA-Codes unten) dafür jeweils gilt. Standard und
      VeVA-Code werden bei der Probe daraus automatisch bestimmt und sind dort nicht mehr änderbar.
      ${isAdmin ? '' : ' Nur Administrator/innen können sie ändern.'}</p>
      <div style="overflow-x:auto">
      <table class="threshold-table" id="materialien-table">
        <tr><th>Name</th><th>Standard</th><th>VeVA-Eimer</th>${isAdmin ? '<th></th>' : ''}</tr>
        ${materialien.map((m, i) => `
          <tr>
            <td><input data-mat="${i}" data-matf="name" ${isAdmin ? '' : 'disabled'} value="${escapeHtml(m.name)}" style="width:14rem;"></td>
            <td>
              <select data-mat="${i}" data-matf="standard" ${isAdmin ? '' : 'disabled'}>
                <option value="vvea" ${m.standard !== 'vbbo' ? 'selected' : ''}>VVEA (Deponieklassen)</option>
                <option value="vbbo" ${m.standard === 'vbbo' ? 'selected' : ''}>VBBo (Bodenqualität)</option>
              </select>
            </td>
            <td>
              <select data-mat="${i}" data-matf="vevaBucket" ${isAdmin ? '' : 'disabled'}>
                <option value="" ${!m.vevaBucket ? 'selected' : ''}>– keiner –</option>
                ${VEVA_MATERIALIEN.map(v => `<option value="${v}" ${m.vevaBucket === v ? 'selected' : ''}>${v}</option>`).join('')}
              </select>
            </td>
            ${isAdmin ? `<td><button type="button" class="btn danger" style="padding:.2rem .5rem;" data-del-mat="${i}">×</button></td>` : ''}
          </tr>`).join('')}
      </table>
      </div>
      ${isAdmin ? `
      <div class="btn-row">
        <button class="btn secondary" id="btn-add-mat" type="button">+ Neues Material</button>
        <button class="btn" id="btn-save-mat" type="button">💾 Materialien speichern</button>
        <button class="btn secondary" id="btn-reset-mat" type="button">Zurücksetzen auf Beispielwerte</button>
      </div>
      ` : ''}
    </div>

    <div class="card">
      <h2>VeVA-Codes (Aushub/Boden)</h2>
      <p class="hint">Abfallcodes für die Begleitschein-Zuordnung bei Aushub- und Bodenaushubmaterial.
      ${isAdmin ? '' : ' Nur Administrator/innen können sie ändern.'}
      <strong>Hinweis:</strong> Vor Verwendung auf einem offiziellen Begleitschein bitte die Codes gegen die
      aktuelle VeVA-Liste prüfen.</p>
      <div style="overflow-x:auto">
      <table class="threshold-table" id="veva-codes-table">
        <tr><th>Code</th><th>Bezeichnung</th><th>Material <span class="hint">(mehrfach wählbar)</span></th><th>VVEA-Klasse <span class="hint">(mehrfach wählbar)</span></th>${isAdmin ? '<th></th>' : ''}</tr>
        ${vevaCodes.map((c, i) => `
          <tr>
            <td><input data-vv="${i}" data-vvf="code" ${isAdmin ? '' : 'disabled'} value="${escapeHtml(c.code)}" style="width:9rem;"></td>
            <td><input data-vv="${i}" data-vvf="bezeichnung" ${isAdmin ? '' : 'disabled'} value="${escapeHtml(c.bezeichnung)}" style="width:16rem;"></td>
            <td style="min-width:10rem;">
              <div style="display:flex;flex-direction:column;gap:.15rem;">
                ${VEVA_MATERIALIEN.map(m => `<label style="display:flex;align-items:center;gap:.35rem;font-size:.85rem;white-space:nowrap;"><input type="checkbox" data-vv="${i}" data-vvf-arr="materialien" value="${m}" ${isAdmin ? '' : 'disabled'} ${(c.materialien || []).includes(m) ? 'checked' : ''}> ${m}</label>`).join('')}
              </div>
            </td>
            <td style="min-width:16rem;">
              <div style="display:flex;flex-wrap:wrap;gap:.15rem .7rem;">
                ${CLASSES.map(k => `<label style="display:flex;align-items:center;gap:.25rem;font-size:.85rem;white-space:nowrap;"><input type="checkbox" data-vv="${i}" data-vvf-arr="klassen" value="${k.id}" ${isAdmin ? '' : 'disabled'} ${(c.klassen || []).includes(k.id) ? 'checked' : ''}> ${escapeHtml(k.short)}</label>`).join('')}
              </div>
            </td>
            ${isAdmin ? `<td><button type="button" class="btn danger" style="padding:.2rem .5rem;" data-del-veva="${i}">×</button></td>` : ''}
          </tr>`).join('')}
      </table>
      </div>
      ${isAdmin ? `
      <div class="btn-row">
        <button class="btn secondary" id="btn-add-veva" type="button">+ Neuer Code</button>
        <button class="btn" id="btn-save-veva" type="button">💾 VeVA-Codes speichern</button>
        <button class="btn secondary" id="btn-reset-veva" type="button">Zurücksetzen auf Beispielwerte</button>
      </div>
      ` : ''}
    </div>

    <div class="card">
      <h2>Analytik-Programme</h2>
      <p class="hint">Benannte Zusammenstellungen von Analyseparametern, die bei einer Probe ausgewählt und
      ausgelöst werden können (Analysewerte-Tabelle wird damit vorbefüllt).
      ${canEditAnalytik ? '' : ' Nur Administrator/innen bzw. Projektleitung können sie ändern.'}</p>
      <div style="overflow-x:auto">
      <table class="threshold-table" id="analytik-programme-table">
        <tr><th>Name</th><th>Parameter <span class="hint">(mehrfach wählbar)</span></th>${canEditAnalytik ? '<th></th>' : ''}</tr>
        ${analytikProgramme.map((prog, i) => `
          <tr>
            <td><input data-anp="${i}" data-anpf="name" ${canEditAnalytik ? '' : 'disabled'} value="${escapeHtml(prog.name)}" style="width:14rem;"></td>
            <td style="min-width:18rem;max-height:14rem;overflow-y:auto;">
              ${analytikParamGroups().map(g => `
                <div class="hint" style="margin-top:.3rem;font-weight:600;">${escapeHtml(g.label)}</div>
                <div style="display:flex;flex-wrap:wrap;gap:.1rem .6rem;">
                  ${g.list.map(p => `<label style="display:flex;align-items:center;gap:.25rem;font-size:.8rem;white-space:nowrap;">
                    <input type="checkbox" data-anp="${i}" data-anpf-arr="parameterKeys" value="${p.key}" ${canEditAnalytik ? '' : 'disabled'} ${(prog.parameterKeys || []).includes(p.key) ? 'checked' : ''}> ${escapeHtml(p.label)}
                  </label>`).join('')}
                </div>`).join('')}
            </td>
            ${canEditAnalytik ? `<td><button type="button" class="btn danger" style="padding:.2rem .5rem;" data-del-analytik="${i}">×</button></td>` : ''}
          </tr>`).join('')}
      </table>
      </div>
      ${canEditAnalytik ? `
      <div class="btn-row">
        <button class="btn secondary" id="btn-add-analytik" type="button">+ Neues Programm</button>
        <button class="btn" id="btn-save-analytik" type="button">💾 Analytik-Programme speichern</button>
        <button class="btn secondary" id="btn-reset-analytik" type="button">Zurücksetzen auf Beispielwerte</button>
      </div>
      ` : ''}
    </div>

    <div class="card">
      <h2>Labore</h2>
      <p class="hint">Labore, an die „Analysen auslösen" bei der Probe einen Analysenauftrag per E-Mail
      schickt. <strong>E-Mail-Adresse ist Pflicht</strong>, damit ein Auftrag zugestellt werden kann — Name/Ort
      als Startwerte sind ggf. noch zu prüfen/anzupassen.
      ${isAdmin ? '' : ' Nur Administrator/innen können sie ändern.'}</p>
      <div style="overflow-x:auto">
      <table class="threshold-table" id="labore-table">
        <tr><th>Name</th><th>Ort</th><th>E-Mail</th><th>Adresse</th><th>Telefon</th>${isAdmin ? '<th></th>' : ''}</tr>
        ${labore.map((l, i) => `
          <tr>
            <td><input data-lab="${i}" data-labf="name" ${isAdmin ? '' : 'disabled'} value="${escapeHtml(l.name)}" style="width:10rem;"></td>
            <td><input data-lab="${i}" data-labf="ort" ${isAdmin ? '' : 'disabled'} value="${escapeHtml(l.ort || '')}" style="width:8rem;"></td>
            <td><input data-lab="${i}" data-labf="email" type="email" ${isAdmin ? '' : 'disabled'} value="${escapeHtml(l.email || '')}" style="width:12rem;"></td>
            <td><input data-lab="${i}" data-labf="adresse" ${isAdmin ? '' : 'disabled'} value="${escapeHtml(l.adresse || '')}" style="width:12rem;"></td>
            <td><input data-lab="${i}" data-labf="telefon" ${isAdmin ? '' : 'disabled'} value="${escapeHtml(l.telefon || '')}" style="width:8rem;"></td>
            ${isAdmin ? `<td><button type="button" class="btn danger" style="padding:.2rem .5rem;" data-del-lab="${i}">×</button></td>` : ''}
          </tr>`).join('')}
      </table>
      </div>
      ${isAdmin ? `
      <div class="btn-row">
        <button class="btn secondary" id="btn-add-lab" type="button">+ Neues Labor</button>
        <button class="btn" id="btn-save-lab" type="button">💾 Labore speichern</button>
        <button class="btn secondary" id="btn-reset-lab" type="button">Zurücksetzen auf Beispielwerte</button>
      </div>
      ` : ''}
    </div>

    <div class="card">
      <h2>Unsere Firma</h2>
      <p class="hint">Wird als „Auftraggeber 1" auf offizielle Labor-Auftragsformulare eingesetzt (aktuell:
      Niutec — siehe „Analysen auslösen" bei der Probe). Einmalig hinterlegen, gilt für alle künftigen
      Aufträge; lässt sich bei Bedarf pro Auftrag noch anpassen, bevor er verschickt wird.
      ${isAdmin ? '' : ' Nur Administrator/innen können sie ändern.'}</p>
      <div class="grid-2">
        <div class="field"><label>Firma</label><input id="uf-firma" ${isAdmin ? '' : 'disabled'} value="${escapeHtml(unsereFirma.firma || '')}"></div>
        <div class="field"><label>Ansprechperson</label><input id="uf-name" ${isAdmin ? '' : 'disabled'} value="${escapeHtml(unsereFirma.name || '')}"></div>
        <div class="field"><label>Strasse / PF</label><input id="uf-strasse" ${isAdmin ? '' : 'disabled'} value="${escapeHtml(unsereFirma.strasse || '')}"></div>
        <div class="field"><label>PLZ / Ort</label><input id="uf-plzort" ${isAdmin ? '' : 'disabled'} value="${escapeHtml(unsereFirma.plzOrt || '')}"></div>
        <div class="field"><label>Tel</label><input id="uf-tel" ${isAdmin ? '' : 'disabled'} value="${escapeHtml(unsereFirma.tel || '')}"></div>
        <div class="field"><label>E-Mail</label><input id="uf-email" type="email" ${isAdmin ? '' : 'disabled'} value="${escapeHtml(unsereFirma.email || '')}"></div>
      </div>
      ${isAdmin ? `
      <div class="btn-row">
        <button class="btn" id="btn-save-firma" type="button">💾 Speichern</button>
        <button class="btn secondary" id="btn-reset-firma" type="button">Zurücksetzen (leeren)</button>
      </div>
      ` : ''}
    </div>
    </div>

    <div class="settings-section" style="display:${settingsTab === 'benutzer' ? '' : 'none'};">${usersHtml}</div>

    <div class="settings-section" style="display:${settingsTab === 'grenzwerte' ? '' : 'none'};">
    <div class="card">
      <h2>Legende Deponieklassen (VVEA)</h2>
      <div class="entry-list">
        ${CLASSES.map(c => `<div style="display:flex;align-items:center;gap:.5rem;">
          <span class="badge" style="background:${c.color}">${escapeHtml(c.short)}</span>
          <span>${escapeHtml(c.label)}</span>
        </div>`).join('')}
      </div>
    </div>

    <div class="card">
      <h2>Legende Bodenqualität (VBBo)</h2>
      <div class="entry-list">
        ${VBBO_CLASSES.map(c => `<div style="display:flex;align-items:center;gap:.5rem;">
          <span class="badge" style="background:${c.color}">${escapeHtml(c.short)}</span>
          <span>${escapeHtml(c.label)}</span>
        </div>`).join('')}
      </div>
      <p class="hint">Nutzungsarten und ihre Prüfwert-/Sanierungswert-Zuordnung:
        ${NUTZUNGSARTEN.map(n => escapeHtml(n.label)).join(' · ')}</p>
    </div>
    </div>

    <div class="settings-section" style="display:${settingsTab === 'info' ? '' : 'none'};">
    <div class="card">
      <h2>Über diese App</h2>
      <p class="hint">Baustellen-Probennahmejournal – Fotodokumentation, Analyse-Import (CSV/PDF) mit
      automatischer Farbcodierung nach Deponieklassen (VVEA) oder Bodenqualität (VBBo), VeVA-Codes,
      Entsorgungsweg sowie PDF/E-Mail-Export. Proben, Fotos, Projekte und Grenzwerte werden zentral auf dem
      Server gespeichert und sind für alle angemeldeten Team-Mitglieder sichtbar.</p>
    </div>
    </div>
  `;

  $$('[data-settings-tab]').forEach(btn => btn.addEventListener('click', () => {
    settingsTab = btn.dataset.settingsTab;
    paintSettings();
  }));

  function collectThresholdsFromTable() {
    const t = JSON.parse(JSON.stringify(thresholds));
    $$('#threshold-table input[data-p]').forEach(inp => {
      const p = inp.dataset.p, c = inp.dataset.c;
      t[p] = t[p] || {};
      t[p][c] = inp.value === '' ? null : parseFloat(inp.value);
    });
    return t;
  }

  if (canProposeThresholds && !isAdmin) {
    // Projektleitung: keine direkte Speicherung, nur Antrag stellen.
    $('#btn-request-thresholds').addEventListener('click', async () => {
      const newT = collectThresholdsFromTable();
      const note = $('#thr-request-note').value.trim();
      try {
        await requestThresholdChangeApi(newT, note);
        toast('Änderung beantragt — wartet auf Freigabe durch einen Admin.');
        await renderSettings();
      } catch (err) { toast('Fehler: ' + errMsg(err)); }
    });
  }

  // ---------- Analytik-Programme (admin ODER projektleiter) ----------
  if (canEditAnalytik) {
    function collectAnalytikProgrammeFromTable() {
      const programme = analytikProgramme.map(p => ({ id: p.id, name: p.name, parameterKeys: [] }));
      $$('#analytik-programme-table [data-anp]').forEach(el => {
        const i = Number(el.dataset.anp);
        if (!programme[i]) return;
        if (el.dataset.anpf) programme[i][el.dataset.anpf] = el.value;
        else if (el.dataset.anpfArr && el.checked) programme[i][el.dataset.anpfArr].push(el.value);
      });
      return programme;
    }
    $$('[data-del-analytik]').forEach(btn => btn.addEventListener('click', async () => {
      if (!confirm('Dieses Analytik-Programm wirklich entfernen?')) return;
      const newProgramme = collectAnalytikProgrammeFromTable();
      newProgramme.splice(Number(btn.dataset.delAnalytik), 1);
      try {
        await saveAnalytikProgrammeApi(newProgramme);
        analytikProgramme = newProgramme;
        toast('Programm entfernt');
        await renderSettings();
      } catch (err) { toast('Fehler: ' + errMsg(err)); }
    }));
    $('#btn-add-analytik').addEventListener('click', async () => {
      analytikProgramme = collectAnalytikProgrammeFromTable();
      analytikProgramme.push({ id: slugifyParamKey(`programm_${analytikProgramme.length + 1}`, new Set(analytikProgramme.map(p => p.id))), name: '', parameterKeys: [] });
      await paintSettings();
    });
    $('#btn-save-analytik').addEventListener('click', async () => {
      const newProgramme = collectAnalytikProgrammeFromTable();
      try { await saveAnalytikProgrammeApi(newProgramme); analytikProgramme = newProgramme; toast('Analytik-Programme gespeichert'); }
      catch (err) { toast('Fehler: ' + errMsg(err)); }
    });
    $('#btn-reset-analytik').addEventListener('click', async () => {
      if (!confirm('Analytik-Programme wirklich auf die Beispielwerte zurücksetzen?')) return;
      try {
        analytikProgramme = await resetAnalytikProgrammeApi();
        toast('Zurückgesetzt');
        await renderSettings();
      } catch (err) { toast('Fehler: ' + errMsg(err)); }
    });
  }

  if (isAdmin) {
    $('#btn-save-thresholds').addEventListener('click', async () => {
      const newT = collectThresholdsFromTable();
      try { await saveThresholdsApi(newT); thresholds = newT; toast('Grenzwerte gespeichert'); }
      catch (err) { toast('Fehler: ' + errMsg(err)); }
    });
    $('#btn-reset-thresholds').addEventListener('click', async () => {
      if (!confirm('Grenzwerte UND Parameterliste wirklich auf die Beispielwerte zurücksetzen?')) return;
      try {
        thresholds = await resetThresholdsApi();
        setParameters(await resetParametersApi());
        toast('Zurückgesetzt');
        await renderSettings();
      } catch (err) { toast('Fehler: ' + errMsg(err)); }
    });
    $('#btn-export-thresholds').addEventListener('click', () => {
      const csv = buildThresholdsCSVTemplate(PARAMETERS, collectThresholdsFromTable());
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'vvea-grenzwerte.csv'; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    });
    $('#btn-import-thresholds').addEventListener('click', () => $('#thresholds-csv-input').click());
    $('#thresholds-csv-input').addEventListener('change', async ev => {
      const file = ev.target.files[0];
      ev.target.value = '';
      if (!file) return;
      const text = await file.text();
      const rows = parseThresholdsCSV(text);
      showThresholdsImportPreview(rows);
    });

    $$('[data-del-param]').forEach(btn => btn.addEventListener('click', async () => {
      if (!confirm(`Parameter „${btn.dataset.delParam}“ wirklich entfernen? Bereits erfasste Analysewerte mit diesem Parameter bleiben gespeichert, werden aber nicht mehr bewertet.`)) return;
      try {
        const newParams = PARAMETERS.filter(p => p.key !== btn.dataset.delParam);
        await saveParametersApi(newParams);
        setParameters(newParams);
        toast('Parameter entfernt');
        await renderSettings();
      } catch (err) { toast('Fehler: ' + errMsg(err)); }
    }));
    $('#btn-add-param').addEventListener('click', async () => {
      const label = $('#np-label').value.trim();
      const unit = $('#np-unit').value.trim();
      const art = $('#np-art').value;
      if (!label) { toast('Bitte eine Bezeichnung angeben.'); return; }
      const key = slugifyParamKey(label, new Set(PARAMETERS.map(p => p.key)));
      const newParams = [...PARAMETERS, { key, label, unit, art, aliases: [label.toLowerCase()] }];
      try {
        await saveParametersApi(newParams);
        setParameters(newParams);
        toast('Parameter hinzugefügt');
        await renderSettings();
      } catch (err) { toast('Fehler: ' + errMsg(err)); }
    });

    // ---------- VBBo-Grenzwerte ----------
    function collectVbboThresholdsFromTable() {
      const t = JSON.parse(JSON.stringify(vbboThresholds));
      $$('#vbbo-threshold-table input[data-vp]').forEach(inp => {
        const p = inp.dataset.vp, c = inp.dataset.vc;
        t[p] = t[p] || {};
        t[p][c] = inp.value === '' ? null : parseFloat(inp.value);
      });
      return t;
    }
    $('#btn-save-vbbo-thresholds').addEventListener('click', async () => {
      const newT = collectVbboThresholdsFromTable();
      try { await saveVbboThresholdsApi(newT); vbboThresholds = newT; toast('VBBo-Grenzwerte gespeichert'); }
      catch (err) { toast('Fehler: ' + errMsg(err)); }
    });
    $('#btn-reset-vbbo-thresholds').addEventListener('click', async () => {
      if (!confirm('VBBo-Grenzwerte UND Parameterliste wirklich auf die Beispielwerte zurücksetzen?')) return;
      try {
        vbboThresholds = await resetVbboThresholdsApi();
        setVbboParameters(await resetVbboParametersApi());
        toast('Zurückgesetzt');
        await renderSettings();
      } catch (err) { toast('Fehler: ' + errMsg(err)); }
    });
    $$('[data-del-vbbo-param]').forEach(btn => btn.addEventListener('click', async () => {
      if (!confirm(`VBBo-Parameter „${btn.dataset.delVbboParam}“ wirklich entfernen?`)) return;
      try {
        const newParams = VBBO_PARAMETERS.filter(p => p.key !== btn.dataset.delVbboParam);
        await saveVbboParametersApi(newParams);
        setVbboParameters(newParams);
        toast('Parameter entfernt');
        await renderSettings();
      } catch (err) { toast('Fehler: ' + errMsg(err)); }
    }));
    $('#btn-add-vbbo-param').addEventListener('click', async () => {
      const label = $('#nvp-label').value.trim();
      const unit = $('#nvp-unit').value.trim();
      if (!label) { toast('Bitte eine Bezeichnung angeben.'); return; }
      const key = slugifyParamKey(label, new Set(VBBO_PARAMETERS.map(p => p.key)));
      const newParams = [...VBBO_PARAMETERS, { key, label, unit, aliases: [label.toLowerCase()] }];
      try {
        await saveVbboParametersApi(newParams);
        setVbboParameters(newParams);
        toast('Parameter hinzugefügt');
        await renderSettings();
      } catch (err) { toast('Fehler: ' + errMsg(err)); }
    });

    // ---------- Materialien ----------
    function collectMaterialienFromTable() {
      const list = materialien.map(m => ({ id: m.id, name: m.name, standard: m.standard, vevaBucket: m.vevaBucket }));
      $$('#materialien-table [data-mat]').forEach(el => {
        const i = Number(el.dataset.mat);
        if (!list[i]) return;
        list[i][el.dataset.matf] = el.value;
      });
      return list;
    }
    $$('[data-del-mat]').forEach(btn => btn.addEventListener('click', async () => {
      if (!confirm('Dieses Material wirklich entfernen? Bereits erfasste Proben mit diesem Material bleiben gespeichert, zeigen aber keinen automatisch bestimmten Standard/VeVA-Code mehr.')) return;
      const newList = collectMaterialienFromTable();
      newList.splice(Number(btn.dataset.delMat), 1);
      try {
        await saveMaterialienApi(newList);
        materialien = newList;
        toast('Material entfernt');
        await renderSettings();
      } catch (err) { toast('Fehler: ' + errMsg(err)); }
    }));
    $('#btn-add-mat').addEventListener('click', async () => {
      materialien = collectMaterialienFromTable();
      const id = slugifyParamKey(`material_${materialien.length + 1}`, new Set(materialien.map(m => m.id)));
      materialien.push({ id, name: '', standard: 'vvea', vevaBucket: '' });
      await paintSettings();
    });
    $('#btn-save-mat').addEventListener('click', async () => {
      const newList = collectMaterialienFromTable();
      try { await saveMaterialienApi(newList); materialien = newList; toast('Materialien gespeichert'); }
      catch (err) { toast('Fehler: ' + errMsg(err)); }
    });
    $('#btn-reset-mat').addEventListener('click', async () => {
      if (!confirm('Materialien wirklich auf die Beispielwerte zurücksetzen?')) return;
      try {
        materialien = await resetMaterialienApi();
        toast('Zurückgesetzt');
        await renderSettings();
      } catch (err) { toast('Fehler: ' + errMsg(err)); }
    });

    // ---------- VeVA-Codes ----------
    function collectVevaCodesFromTable() {
      const codes = vevaCodes.map(c => ({ code: c.code, bezeichnung: c.bezeichnung, materialien: [], klassen: [] }));
      $$('#veva-codes-table [data-vv]').forEach(el => {
        const i = Number(el.dataset.vv);
        if (!codes[i]) return;
        if (el.dataset.vvf) {
          codes[i][el.dataset.vvf] = el.value;
        } else if (el.dataset.vvfArr && el.checked) {
          codes[i][el.dataset.vvfArr].push(el.value);
        }
      });
      return codes;
    }
    $$('[data-del-veva]').forEach(btn => btn.addEventListener('click', async () => {
      if (!confirm('Diesen VeVA-Code wirklich entfernen?')) return;
      const newCodes = collectVevaCodesFromTable();
      newCodes.splice(Number(btn.dataset.delVeva), 1);
      try {
        await saveVevaCodesApi(newCodes);
        vevaCodes = newCodes;
        toast('Code entfernt');
        await renderSettings();
      } catch (err) { toast('Fehler: ' + errMsg(err)); }
    }));
    $('#btn-add-veva').addEventListener('click', async () => {
      // Aktuelle (noch ungespeicherte) Tabelleneingaben übernehmen, damit sie beim
      // Hinzufügen einer neuen Zeile nicht verloren gehen — Speichern bleibt bewusst
      // ein separater Schritt, analog zu den VVEA-/VBBo-Grenzwerttabellen.
      vevaCodes = collectVevaCodesFromTable();
      vevaCodes.push({ code: '', bezeichnung: '', materialien: [], klassen: [] });
      await paintSettings();
    });
    $('#btn-save-veva').addEventListener('click', async () => {
      const newCodes = collectVevaCodesFromTable();
      try { await saveVevaCodesApi(newCodes); vevaCodes = newCodes; toast('VeVA-Codes gespeichert'); }
      catch (err) { toast('Fehler: ' + errMsg(err)); }
    });
    $('#btn-reset-veva').addEventListener('click', async () => {
      if (!confirm('VeVA-Codes wirklich auf die Beispielwerte zurücksetzen?')) return;
      try {
        vevaCodes = await resetVevaCodesApi();
        toast('Zurückgesetzt');
        await renderSettings();
      } catch (err) { toast('Fehler: ' + errMsg(err)); }
    });

    // ---------- Labore ----------
    function collectLaboreFromTable() {
      const list = labore.map(l => ({ id: l.id, name: l.name, ort: l.ort, email: l.email, adresse: l.adresse, telefon: l.telefon }));
      $$('#labore-table [data-lab]').forEach(el => {
        const i = Number(el.dataset.lab);
        if (!list[i]) return;
        list[i][el.dataset.labf] = el.value;
      });
      return list;
    }
    $$('[data-del-lab]').forEach(btn => btn.addEventListener('click', async () => {
      if (!confirm('Dieses Labor wirklich entfernen?')) return;
      const newList = collectLaboreFromTable();
      newList.splice(Number(btn.dataset.delLab), 1);
      try {
        await saveLaboreApi(newList);
        labore = newList;
        toast('Labor entfernt');
        await renderSettings();
      } catch (err) { toast('Fehler: ' + errMsg(err)); }
    }));
    $('#btn-add-lab').addEventListener('click', async () => {
      labore = collectLaboreFromTable();
      const id = slugifyParamKey(`labor_${labore.length + 1}`, new Set(labore.map(l => l.id)));
      labore.push({ id, name: '', ort: '', email: '', adresse: '', telefon: '' });
      await paintSettings();
    });
    $('#btn-save-lab').addEventListener('click', async () => {
      const newList = collectLaboreFromTable();
      try { await saveLaboreApi(newList); labore = newList; toast('Labore gespeichert'); }
      catch (err) { toast('Fehler: ' + errMsg(err)); }
    });
    $('#btn-reset-lab').addEventListener('click', async () => {
      if (!confirm('Labore wirklich auf die Beispielwerte zurücksetzen?')) return;
      try {
        labore = await resetLaboreApi();
        toast('Zurückgesetzt');
        await renderSettings();
      } catch (err) { toast('Fehler: ' + errMsg(err)); }
    });

    // ---------- Unsere Firma ----------
    $('#btn-save-firma').addEventListener('click', async () => {
      const newFirma = {
        firma: $('#uf-firma').value.trim(), name: $('#uf-name').value.trim(),
        strasse: $('#uf-strasse').value.trim(), plzOrt: $('#uf-plzort').value.trim(),
        tel: $('#uf-tel').value.trim(), email: $('#uf-email').value.trim(),
      };
      try { await saveUnsereFirmaApi(newFirma); unsereFirma = newFirma; toast('Gespeichert'); }
      catch (err) { toast('Fehler: ' + errMsg(err)); }
    });
    $('#btn-reset-firma').addEventListener('click', async () => {
      if (!confirm('Firmendaten wirklich leeren?')) return;
      try {
        unsereFirma = await resetUnsereFirmaApi();
        toast('Zurückgesetzt');
        await renderSettings();
      } catch (err) { toast('Fehler: ' + errMsg(err)); }
    });

    await paintUserList();
    $('#btn-create-user').addEventListener('click', async () => {
      const name = $('#nu-name').value.trim();
      const email = $('#nu-email').value.trim();
      const password = $('#nu-pass').value;
      const role = $('#nu-role').value;
      if (!name || !email || !password) { toast('Bitte Name, Login (E-Mail/Kürzel) und Passwort ausfüllen.'); return; }
      try {
        await createUserApi({ name, email, password, role });
        toast('Benutzer angelegt');
        $('#nu-name').value = ''; $('#nu-email').value = ''; $('#nu-pass').value = '';
        await paintUserList();
      } catch (err) { toast('Fehler: ' + errMsg(err)); }
    });
  }

  // Änderungsanträge VVEA-Grenzwerte: Übernehmen/Ablehnen nur Admin,
  // Zurückziehen Admin oder die antragstellende Projektleitung selbst.
  $$('[data-apply-thr-req]').forEach(btn => btn.addEventListener('click', async () => {
    if (!confirm('Diese Grenzwert-Änderung übernehmen? Ersetzt die aktuellen VVEA-Grenzwerte.')) return;
    try {
      thresholds = await applyThresholdRequestApi(btn.dataset.applyThrReq);
      toast('Grenzwerte übernommen');
      await renderSettings();
    } catch (err) { toast('Fehler: ' + errMsg(err)); }
  }));
  $$('[data-reject-thr-req]').forEach(btn => btn.addEventListener('click', async () => {
    if (!confirm('Diesen Änderungsantrag wirklich ablehnen?')) return;
    try {
      await rejectThresholdRequestApi(btn.dataset.rejectThrReq);
      toast('Antrag abgelehnt');
      await renderSettings();
    } catch (err) { toast('Fehler: ' + errMsg(err)); }
  }));
  $$('[data-cancel-thr-req]').forEach(btn => btn.addEventListener('click', async () => {
    try {
      await cancelThresholdRequestApi(btn.dataset.cancelThrReq);
      toast('Antrag zurückgezogen');
      await renderSettings();
    } catch (err) { toast('Fehler: ' + errMsg(err)); }
  }));
}

function showThresholdsImportPreview(rows) {
  const el = $('#thresholds-import-preview');
  const editableClasses = CLASSES.filter(c => !c.terminal);
  if (rows.length === 0) {
    el.innerHTML = '<p class="hint">Keine verwertbaren Zeilen in der Datei gefunden.</p>';
    return;
  }
  el.innerHTML = `<div class="import-preview"><table class="analyse-table">
    <tr><th></th><th>Parameter</th><th>Einheit</th><th>Art</th>${editableClasses.map(c => `<th>${c.short}</th>`).join('')}</tr>
    ${rows.map((r, i) => `<tr>
      <td><input type="checkbox" data-timp="${i}" checked></td>
      <td>${escapeHtml(r.label)} ${r.isNew ? '<span class="badge" style="background:#2e7d32;">neu</span>' : ''}</td>
      <td>${escapeHtml(r.unit || '–')}</td>
      <td>${r.art === 'eluat' ? 'Eluat' : 'Gesamt'}</td>
      ${editableClasses.map(c => `<td>${r.values[c.id] ?? ''}</td>`).join('')}
    </tr>`).join('')}
  </table></div>
  <div class="btn-row">
    <button class="btn" id="btn-confirm-thresholds-import" type="button">Ausgewählte übernehmen</button>
    <button class="btn secondary" id="btn-cancel-thresholds-import" type="button">Verwerfen</button>
  </div>`;
  $('#btn-confirm-thresholds-import').addEventListener('click', async () => {
    const newParams = [...PARAMETERS];
    const newThresholds = JSON.parse(JSON.stringify(thresholds));
    let count = 0;
    $$('[data-timp]').forEach(cb => {
      if (!cb.checked) return;
      const r = rows[Number(cb.dataset.timp)];
      if (r.isNew && !newParams.some(p => p.key === r.key)) {
        newParams.push({ key: r.key, label: r.label, unit: r.unit, art: r.art, aliases: [r.roh.toLowerCase()] });
      }
      newThresholds[r.key] = r.values;
      count++;
    });
    try {
      await saveParametersApi(newParams);
      await saveThresholdsApi(newThresholds);
      setParameters(newParams);
      thresholds = newThresholds;
      toast(`${count} Parameter/Grenzwerte übernommen und gespeichert`);
      await renderSettings();
    } catch (err) { toast('Fehler: ' + errMsg(err)); }
  });
  $('#btn-cancel-thresholds-import').addEventListener('click', () => { el.innerHTML = ''; });
}

// Wessen Passwort-Formular gerade aufgeklappt ist (id) — kein Self-Service-
// Reset per E-Mail (die App verschickt keine E-Mails), daher setzt der Admin
// hier direkt ein neues Passwort, auch fürs eigene Konto.
let passwordResetUserId = null;

async function paintUserList() {
  const box = $('#user-list');
  if (!box) return;
  box.innerHTML = '<p class="hint">Lade Benutzer …</p>';
  try {
    const users = await listUsersApi();
    const me = getCurrentUser();
    const roleOptions = [
      ['probenehmer', 'Probenehmer/in'], ['projektleiter', 'Projektleitung'],
      ['extern', 'Extern (nur lesen)'], ['admin', 'Administrator/in'],
    ];
    box.innerHTML = users.map(u => `
      <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;padding:.3rem 0;border-bottom:1px solid var(--border);">
        <span style="flex:1;min-width:0;">${escapeHtml(u.name)} — ${escapeHtml(u.email)}</span>
        ${u.id !== me.id ? `
          <select data-role-user="${u.id}" style="width:auto;">
            ${roleOptions.map(([val, label]) => `<option value="${val}" ${u.role === val ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('')}
          </select>
        ` : `<span class="hint">${escapeHtml(ROLE_LABELS[u.role] || u.role)} (du)</span>`}
        <button class="btn secondary" style="padding:.2rem .6rem;" data-toggle-pw="${u.id}">🔑 Passwort</button>
        ${u.id !== me.id ? `<button class="btn danger" style="padding:.2rem .6rem;" data-del-user="${u.id}">Entfernen</button>` : ''}
        ${passwordResetUserId === u.id ? `
          <div style="display:flex;align-items:center;gap:.5rem;flex-basis:100%;margin-top:.3rem;">
            <input type="password" id="pw-reset-input" placeholder="Neues Passwort (mind. 8 Zeichen)" autocomplete="new-password" style="flex:1;min-width:0;">
            <button class="btn" style="padding:.2rem .6rem;" data-set-pw="${u.id}">Setzen</button>
          </div>` : ''}
      </div>`).join('');
    $$('[data-role-user]').forEach(sel => sel.addEventListener('change', async () => {
      try { await updateUserRoleApi(sel.dataset.roleUser, sel.value); toast('Rolle geändert'); }
      catch (err) { toast('Fehler: ' + errMsg(err)); await paintUserList(); }
    }));
    $$('[data-del-user]').forEach(btn => btn.addEventListener('click', async () => {
      if (!confirm('Diesen Benutzer wirklich entfernen?')) return;
      try { await deleteUserApi(btn.dataset.delUser); await paintUserList(); }
      catch (err) { toast('Fehler: ' + errMsg(err)); }
    }));
    $$('[data-toggle-pw]').forEach(btn => btn.addEventListener('click', () => {
      passwordResetUserId = passwordResetUserId === btn.dataset.togglePw ? null : btn.dataset.togglePw;
      paintUserList();
    }));
    $$('[data-set-pw]').forEach(btn => btn.addEventListener('click', async () => {
      const pw = $('#pw-reset-input').value;
      if (pw.length < 8) { toast('Passwort muss mindestens 8 Zeichen haben.'); return; }
      try {
        await updateUserPasswordApi(btn.dataset.setPw, pw);
        toast('Passwort gesetzt');
        passwordResetUserId = null;
        await paintUserList();
      } catch (err) { toast('Fehler: ' + errMsg(err)); }
    }));
  } catch (err) {
    box.innerHTML = `<p class="hint">Fehler beim Laden: ${escapeHtml(errMsg(err))}</p>`;
  }
}

// ---------- Init ----------
initDisclaimer();
route();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  });
}
