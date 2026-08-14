import {
  listEntries, getEntryApi, createEntryApi, updateEntryApi, deleteEntryApi,
  uploadPhotos, deletePhotoApi, fetchPhotoBlob,
  getThresholdsApi, saveThresholdsApi, resetThresholdsApi,
  getParametersApi, saveParametersApi, resetParametersApi,
  getVbboThresholdsApi, saveVbboThresholdsApi, resetVbboThresholdsApi,
  getVbboParametersApi, saveVbboParametersApi, resetVbboParametersApi,
  getVevaCodesApi, saveVevaCodesApi, resetVevaCodesApi,
  listUsersApi, createUserApi, deleteUserApi, getUserRosterApi,
  listProjectsApi, createProjectApi, updateProjectApi, deleteProjectApi,
  login, logout, isLoggedIn, getCurrentUser, ApiError,
} from './api.js';
import {
  CLASSES, PARAMETERS, DEFAULT_PARAMETERS, classify, setParameters, slugifyParamKey,
  parseThresholdsCSV, buildThresholdsCSVTemplate,
  hasAcknowledgedDisclaimer, acknowledgeDisclaimer,
  VBBO_CLASSES, NUTZUNGSARTEN, VBBO_PARAMETERS, DEFAULT_VBBO_PARAMETERS,
  setVbboParameters, classifyVBBO,
} from './vvea.js';
import { parseCSV } from './parse-csv.js';
import { parsePDF } from './parse-pdf.js';
import { generateReportHTML, downloadHTML } from './report.js';
import { buildMailto, buildMailSummary } from './email.js';
import { generateReportPDF, downloadBlob, sharePDFOrDownload } from './report-pdf.js';

const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const appEl = $('#app');
const ANDERE = '__andere__';

// Häufige Materialkategorien für die Baustelle — als Auswahl statt Freitext,
// damit möglichst wenig getippt werden muss (Handschuhe/Schutzausrüstung).
const MATERIAL_OPTIONS = [
  'Unverschmutzter Aushub', 'Aushub (allgemein)', 'Humus/Oberboden', 'Kies/Sand',
  'Mischabbruch', 'Betonabbruch', 'Asphalt', 'Ziegel/Mauerwerk', 'Bauschutt gemischt',
];

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

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function errMsg(err) {
  return err instanceof ApiError ? err.message : (err?.message || 'Unbekannter Fehler.');
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
function paintTopbar() {
  document.body.classList.toggle('logged-out', !isLoggedIn());
  let userBox = $('#user-box');
  if (!userBox) {
    userBox = document.createElement('div');
    userBox.id = 'user-box';
    userBox.className = 'user-box';
    $('.topbar').appendChild(userBox);
  }
  const user = getCurrentUser();
  if (user) {
    userBox.innerHTML = `<span class="hint">${escapeHtml(user.name)}${user.role === 'admin' ? ' (Admin)' : ''}</span>
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
  const hash = location.hash || '#/journal';

  if (!isLoggedIn()) {
    renderLogin();
    return;
  }
  if (hash === '#/login') { location.hash = '#/journal'; return; }

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
    } else {
      setActiveTab('journal');
      await renderJournal();
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
      <div class="field"><label>E-Mail</label><input id="li-email" type="email" autocomplete="username"></div>
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
    if (!email || !pass) { $('#li-error').textContent = 'Bitte E-Mail und Passwort eingeben.'; return; }
    try {
      await login(email, pass);
      paintTopbar();
      location.hash = '#/journal';
      route();
    } catch (err) {
      $('#li-error').textContent = errMsg(err);
    }
  };
  $('#li-submit').addEventListener('click', submit);
  $('#li-pass').addEventListener('keydown', ev => { if (ev.key === 'Enter') submit(); });
}

// ---------- Journal (Liste mit Filtern) ----------
const photoUrlCache = new Map(); // photoId -> objectURL
let journalEntries = [];
let journalFilter = { projekt: '', material: '', standard: '', klasse: '', sort: 'neu' };

// Klassen-Array passend zum Standard einer Probe (Default 'vvea' für alte Proben).
function classesForEntry(entry) {
  return entry?.standard === 'vbbo' ? VBBO_CLASSES : CLASSES;
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
    card.querySelector('.entry-sub').textContent = `${entry.baustelle || '–'} · ${entry.material || ''} · ${stdLabel} · ${fmtDate(entry.createdAt)}`;
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
  const projects = await listProjectsApi();
  editingProjectId = null;
  paintProjects(projects);
}

function paintProjects(projects) {
  const editing = projects.find(p => p.id === editingProjectId) || null;
  appEl.innerHTML = `
    <div class="card">
      <h2>Projekte</h2>
      <p class="hint">Vor der ersten Probennahme ein Projekt anlegen — Chargennamen werden danach automatisch
      und fortlaufend pro Projekt vergeben (Kürzel-Nummer, z.B. <code>A123-001</code>).</p>
      ${projects.length === 0 ? '<p class="hint">Noch keine Projekte.</p>' : `
      <div class="entry-list">
        ${projects.map(p => `
          <div class="entry-card" style="cursor:default;">
            <div class="entry-info">
              <h3 class="entry-title">${escapeHtml(p.name)} <span class="hint">(${escapeHtml(p.kuerzel)})</span></h3>
              <p class="entry-sub">${escapeHtml(p.auftraggeber || '–')} · ${escapeHtml(p.ort || '–')} · nächste Charge: ${escapeHtml(p.kuerzel)}-${pad3(p.nextChargeNumber)}</p>
            </div>
            <div class="btn-row" style="margin:0;">
              <button class="btn secondary" type="button" data-edit-project="${p.id}">Bearbeiten</button>
              <button class="btn danger" type="button" data-del-project="${p.id}">Löschen</button>
            </div>
          </div>`).join('')}
      </div>`}
    </div>

    <div class="card">
      <h2>${editing ? 'Projekt bearbeiten' : 'Neues Projekt anlegen'}</h2>
      <div class="grid-2">
        <div class="field"><label>Projektname *</label><input id="p-name" value="${escapeHtml(editing?.name || '')}"></div>
        <div class="field"><label>Kürzel * <span class="hint">(für Chargennamen, z.B. „A123“)</span></label><input id="p-kuerzel" maxlength="12" value="${escapeHtml(editing?.kuerzel || '')}"></div>
        <div class="field"><label>Auftraggeber</label><input id="p-auftraggeber" value="${escapeHtml(editing?.auftraggeber || '')}"></div>
        <div class="field"><label>Ort</label><input id="p-ort" value="${escapeHtml(editing?.ort || '')}"></div>
      </div>
      <div class="field"><label>Bemerkungen</label><textarea id="p-bemerkungen" rows="2">${escapeHtml(editing?.bemerkungen || '')}</textarea></div>
      <div class="btn-row">
        <button class="btn" id="btn-save-project" type="button">${editing ? '💾 Speichern' : '+ Projekt anlegen'}</button>
        ${editing ? '<button class="btn secondary" id="btn-cancel-edit-project" type="button">Abbrechen</button>' : ''}
      </div>
    </div>`;

  const nameInput = $('#p-name'), kuerzelInput = $('#p-kuerzel');
  let kuerzelTouched = !!editing?.kuerzel;
  kuerzelInput.addEventListener('input', () => { kuerzelTouched = true; });
  nameInput.addEventListener('input', () => {
    if (kuerzelTouched) return;
    kuerzelInput.value = nameInput.value.toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 8);
  });

  $$('[data-edit-project]').forEach(btn => btn.addEventListener('click', () => {
    editingProjectId = btn.dataset.editProject;
    paintProjects(projects);
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  }));
  $$('[data-del-project]').forEach(btn => btn.addEventListener('click', async () => {
    if (!confirm('Dieses Projekt wirklich löschen? Geht nur, wenn keine Proben mehr darauf verweisen.')) return;
    try {
      await deleteProjectApi(btn.dataset.delProject);
      toast('Projekt gelöscht');
      await renderProjects();
    } catch (err) { toast('Fehler: ' + errMsg(err)); }
  }));
  const cancelBtn = $('#btn-cancel-edit-project');
  if (cancelBtn) cancelBtn.addEventListener('click', () => { editingProjectId = null; paintProjects(projects); });

  $('#btn-save-project').addEventListener('click', async () => {
    const payload = {
      name: $('#p-name').value.trim(),
      kuerzel: $('#p-kuerzel').value.trim(),
      auftraggeber: $('#p-auftraggeber').value.trim(),
      ort: $('#p-ort').value.trim(),
      bemerkungen: $('#p-bemerkungen').value.trim(),
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
let formProjects = [];
let formRoster = [];
let formEntnahmeorte = [];
let formEntsorgungswege = [];

function newDraftEntry() {
  return {
    id: null,
    createdAt: new Date().toISOString(),
    projektId: null, baustelle: '', probeBezeichnung: '', entnahmeort: '', gps: null,
    material: '', probenehmer: '', bemerkungen: '',
    standard: 'vvea', nutzungsart: NUTZUNGSARTEN[0].id, entsorgungsweg: '', vevaCode: '',
    photos: [], analyse: [], klassifizierung: null,
  };
}

async function loadVveaConfig() {
  try {
    const [t, p, vt, vp, vc] = await Promise.all([
      getThresholdsApi(), getParametersApi(),
      getVbboThresholdsApi(), getVbboParametersApi(), getVevaCodesApi(),
    ]);
    thresholds = t;
    setParameters(p);
    vbboThresholds = vt;
    setVbboParameters(vp);
    vevaCodes = vc;
  } catch (e) { /* Fallback-Werte aus vvea.js bleiben aktiv */ }
}

async function renderEntryForm(idOrNeu) {
  await loadVveaConfig();
  pendingPhotos = [];
  if (idOrNeu === 'neu') {
    currentEntry = newDraftEntry();
    isNew = true;
    formProjects = await listProjectsApi();
    if (formProjects.length === 0) {
      appEl.innerHTML = `<div class="empty-state">
        <p>Bevor eine Probe erfasst werden kann, muss zuerst ein Projekt angelegt werden.</p>
        <a class="btn" href="#/projekte">+ Projekt anlegen</a>
      </div>`;
      return;
    }
    const allEntries = await listEntries().catch(() => []);
    formEntnahmeorte = allEntries.map(en => en.entnahmeort).filter(Boolean);
    formEntsorgungswege = allEntries.map(en => en.entsorgungsweg).filter(Boolean);
    currentEntry.projektId = formProjects[0].id;
  } else {
    currentEntry = await getEntryApi(idOrNeu);
    isNew = false;
    if (!currentEntry.standard) currentEntry.standard = 'vvea';
    if (currentEntry.standard === 'vbbo' && !currentEntry.nutzungsart) currentEntry.nutzungsart = NUTZUNGSARTEN[0].id;
    const allEntries = await listEntries().catch(() => []);
    formEntnahmeorte = allEntries.map(en => en.entnahmeort).filter(Boolean);
    formEntsorgungswege = allEntries.map(en => en.entsorgungsweg).filter(Boolean);
  }
  formRoster = await getUserRosterApi().catch(() => []);
  recomputeClassification();
  paintEntryForm();
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
  const materialIsCustom = e.material && !MATERIAL_OPTIONS.includes(e.material);
  const probenehmerIsCustom = e.probenehmer && !formRoster.some(u => u.name === e.probenehmer);
  if (isNew && !e.probenehmer && me) e.probenehmer = me.name;

  appEl.innerHTML = `
    <div class="card">
      <h2>${isNew ? 'Neue Probe' : `Probe ${escapeHtml(e.probeBezeichnung)}`}</h2>

      ${isNew ? `
        <div class="field">
          <label>Projekt *</label>
          <select id="f-projekt">${formProjects.map(p => `<option value="${p.id}" ${p.id === e.projektId ? 'selected' : ''}>${escapeHtml(p.name)} (${escapeHtml(p.kuerzel)})</option>`).join('')}</select>
          <p class="hint" id="projekt-hint">${projektHint()}</p>
        </div>
      ` : `
        <div class="field"><label>Projekt</label><p>${escapeHtml(e.baustelle)}</p></div>
      `}

      <div class="grid-2">
        <div class="field">
          <label>Material</label>
          <select id="f-material">
            <option value="">– wählen –</option>
            ${MATERIAL_OPTIONS.map(m => `<option value="${escapeHtml(m)}" ${e.material === m ? 'selected' : ''}>${escapeHtml(m)}</option>`).join('')}
            <option value="${ANDERE}" ${materialIsCustom ? 'selected' : ''}>Andere (Freitext)…</option>
          </select>
          <input id="f-material-andere" placeholder="Material angeben" style="margin-top:.4rem;display:${materialIsCustom ? 'block' : 'none'};" value="${escapeHtml(materialIsCustom ? e.material : '')}">
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
          <label>Entnahmeort</label>
          <input id="f-ort" list="entnahmeort-vorschlaege" value="${escapeHtml(e.entnahmeort)}">
          <datalist id="entnahmeort-vorschlaege">${[...new Set(formEntnahmeorte)].map(o => `<option value="${escapeHtml(o)}">`).join('')}</datalist>
        </div>
        <div class="field"><label>Datum</label><input id="f-datum" type="datetime-local" value="${toLocalInputValue(e.createdAt)}"></div>
      </div>
      <div class="field"><label>Bemerkungen</label><textarea id="f-bemerkungen" rows="2">${escapeHtml(e.bemerkungen)}</textarea></div>
      <button class="btn secondary" id="btn-gps" type="button">📍 GPS-Standort erfassen</button>
      <span class="hint" id="gps-status">${e.gps ? `Position: ${e.gps.lat.toFixed(5)}, ${e.gps.lng.toFixed(5)}` : ''}</span>
    </div>

    <div class="card">
      <h2>Einstufung & Entsorgung</h2>
      <div class="grid-2">
        <div class="field">
          <label>Standard</label>
          <select id="f-standard">
            <option value="vvea" ${e.standard !== 'vbbo' ? 'selected' : ''}>VVEA (Deponieklassen)</option>
            <option value="vbbo" ${e.standard === 'vbbo' ? 'selected' : ''}>VBBo (Bodenqualität)</option>
          </select>
        </div>
        <div class="field" id="f-nutzungsart-field" style="display:${e.standard === 'vbbo' ? 'block' : 'none'};">
          <label>Nutzungsart <span class="hint">(nur VBBo)</span></label>
          <select id="f-nutzungsart">
            ${NUTZUNGSARTEN.map(n => `<option value="${n.id}" ${e.nutzungsart === n.id ? 'selected' : ''}>${escapeHtml(n.label)}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>VeVA-Code <span class="hint">(Aushub/Boden)</span></label>
          <select id="f-veva-code">
            <option value="">– keiner –</option>
            ${vevaCodes.map(c => `<option value="${escapeHtml(c.code)}" ${e.vevaCode === c.code ? 'selected' : ''}>${escapeHtml(c.code)} – ${escapeHtml(c.bezeichnung)}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>Entsorgungsweg</label>
          <input id="f-entsorgungsweg" list="entsorgungsweg-vorschlaege" value="${escapeHtml(e.entsorgungsweg)}">
          <datalist id="entsorgungsweg-vorschlaege">${[...new Set(formEntsorgungswege)].map(o => `<option value="${escapeHtml(o)}">`).join('')}</datalist>
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
      <h2>Analysewerte</h2>
      <div class="btn-row">
        <button class="btn secondary" id="btn-add-row" type="button">+ Wert manuell hinzufügen</button>
        <input type="file" accept=".csv,text/csv" id="csv-input" style="display:none">
        <button class="btn secondary" id="btn-import-csv" type="button">⬆ CSV/Excel-CSV importieren</button>
        <input type="file" accept="application/pdf" id="pdf-input" style="display:none">
        <button class="btn secondary" id="btn-import-pdf" type="button">⬆ PDF-Laborbericht importieren</button>
      </div>
      <div id="import-preview"></div>
      <table class="analyse-table" id="analyse-table"></table>

      <div id="classification-banner"></div>
    </div>

    <div class="btn-row">
      <button class="btn" id="btn-save" type="button">💾 Speichern</button>
      <button class="btn secondary" id="btn-pdf" type="button">📄 Als PDF generieren</button>
      <button class="btn secondary" id="btn-mail" type="button">✉️ E-Mail mit PDF senden</button>
      ${!isNew ? `<button class="btn danger" id="btn-delete" type="button">🗑 Löschen</button>` : ''}
    </div>
  `;

  if (isNew) {
    $('#f-projekt').addEventListener('change', ev => {
      e.projektId = ev.target.value;
      $('#projekt-hint').innerHTML = projektHint();
    });
  }

  const materialSel = $('#f-material'), materialAndere = $('#f-material-andere');
  materialSel.addEventListener('change', () => {
    if (materialSel.value === ANDERE) { materialAndere.style.display = 'block'; e.material = materialAndere.value; }
    else { materialAndere.style.display = 'none'; e.material = materialSel.value; }
  });
  materialAndere.addEventListener('input', () => { e.material = materialAndere.value; });

  const personSel = $('#f-person'), personAndere = $('#f-person-andere');
  personSel.addEventListener('change', () => {
    if (personSel.value === ANDERE) { personAndere.style.display = 'block'; e.probenehmer = personAndere.value; }
    else { personAndere.style.display = 'none'; e.probenehmer = personSel.value; }
  });
  personAndere.addEventListener('input', () => { e.probenehmer = personAndere.value; });

  $('#f-ort').addEventListener('input', ev => e.entnahmeort = ev.target.value);
  $('#f-bemerkungen').addEventListener('input', ev => e.bemerkungen = ev.target.value);
  $('#f-datum').addEventListener('input', ev => { if (ev.target.value) e.createdAt = new Date(ev.target.value).toISOString(); });

  $('#f-standard').addEventListener('change', ev => {
    e.standard = ev.target.value;
    if (e.standard === 'vbbo' && !e.nutzungsart) e.nutzungsart = NUTZUNGSARTEN[0].id;
    $('#f-nutzungsart-field').style.display = e.standard === 'vbbo' ? 'block' : 'none';
    recomputeClassification();
    paintAnalyseTable();
  });
  const nutzungsartSel = $('#f-nutzungsart');
  if (nutzungsartSel) nutzungsartSel.addEventListener('change', ev => {
    e.nutzungsart = ev.target.value;
    recomputeClassification();
    paintClassificationBanner();
  });
  $('#f-veva-code').addEventListener('change', ev => { e.vevaCode = ev.target.value; });
  $('#f-entsorgungsweg').addEventListener('input', ev => { e.entsorgungsweg = ev.target.value; });

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
    if (isNew && !e.projektId) { toast('Bitte ein Projekt auswählen.'); return; }
    const btn = $('#btn-save');
    btn.disabled = true;
    try {
      recomputeClassification();
      const payload = { ...e };
      delete payload.photos;
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
      const blob = await generateReportPDF(reportEntry, currentClassification, classesForEntry(e));
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
      const blob = await generateReportPDF(reportEntry, currentClassification, classes);
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
    $('#btn-delete').addEventListener('click', async () => {
      if (!confirm('Diese Probe wirklich löschen?')) return;
      try {
        await deleteEntryApi(e.id);
        toast('Gelöscht');
        location.hash = '#/journal';
      } catch (err) {
        toast('Fehler beim Löschen: ' + errMsg(err));
      }
    });
  }
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

function paramOptionsHtml(selected) {
  return `<option value="">– wählen –</option>` + activeParamList().map(p =>
    `<option value="${p.key}" ${p.key === selected ? 'selected' : ''}>${escapeHtml(p.label)}</option>`).join('');
}

function paintAnalyseTable() {
  const table = $('#analyse-table');
  const rows = currentEntry.analyse;
  const isVbbo = currentEntry.standard === 'vbbo';
  if (rows.length === 0) {
    table.innerHTML = '<tr><td class="hint" colspan="5">Noch keine Werte – manuell hinzufügen oder CSV/PDF importieren.</td></tr>';
  } else {
    table.innerHTML = `<tr><th>Parameter</th><th>Wert</th><th>Einheit</th><th>Art</th><th></th></tr>` +
      rows.map((r, i) => `
        <tr>
          <td><select data-i="${i}" data-f="parameterKey">${paramOptionsHtml(r.parameterKey)}</select></td>
          <td><input data-i="${i}" data-f="wert" type="number" step="any" inputmode="decimal" value="${r.wert ?? ''}"></td>
          <td class="hint">${escapeHtml(r.einheit || '')}</td>
          <td>${isVbbo ? '<span class="hint">Gesamtgehalt</span>' : `<select data-i="${i}" data-f="art">
                <option value="gesamt" ${r.art === 'gesamt' ? 'selected' : ''}>Gesamtgehalt</option>
                <option value="eluat" ${r.art === 'eluat' ? 'selected' : ''}>Eluat</option>
              </select>`}</td>
          <td><button type="button" data-del="${i}" class="btn danger" style="padding:.2rem .5rem;">×</button></td>
        </tr>`).join('');
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
    return;
  }
  const classes = classesForEntry(currentEntry);
  const info = classes[currentClassification.classIndex];
  const unbewertetHint = currentClassification.unbewertet.length
    ? `<p class="hint">${currentClassification.unbewertet.length} Wert(e) ohne hinterlegten Grenzwert – nicht in Klassifizierung eingeflossen.</p>`
    : '';
  el.innerHTML = `<div class="classification-banner" style="background:${info.color}">
      Einstufung: ${escapeHtml(info.label)}
    </div>${unbewertetHint}`;
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
        <div class="field"><label>E-Mail</label><input id="nu-email" type="email"></div>
        <div class="field"><label>Passwort (mind. 8 Zeichen)</label><input id="nu-pass" type="password"></div>
        <div class="field"><label>Rolle</label>
          <select id="nu-role"><option value="user">Team-Mitglied</option><option value="admin">Administrator/in</option></select>
        </div>
      </div>
      <button class="btn" id="btn-create-user" type="button">+ Benutzer anlegen</button>
    </div>`;
  }

  appEl.innerHTML = `
    <div class="card">
      <h2>Grenzwerte (Deponieklassen)</h2>
      <p class="hint">Leeres Feld = für diese Klasse nicht geregelt. Diese Tabelle bestimmt die Farbcodierung
      für <strong>alle</strong> Benutzer/innen.${isAdmin ? '' : ' Nur Administrator/innen können sie ändern.'}</p>
      <div style="overflow-x:auto">
      <table class="threshold-table" id="threshold-table">
        <tr><th>Parameter</th><th>Art</th><th>Einheit</th>${editableClasses.map(c => `<th style="color:${c.color}">${c.short}</th>`).join('')}${isAdmin ? '<th></th>' : ''}</tr>
        ${PARAMETERS.map(p => `
          <tr>
            <td>${escapeHtml(p.label)}</td>
            <td class="readonly">${p.art === 'eluat' ? 'Eluat' : 'Gesamt'}</td>
            <td class="readonly">${escapeHtml(p.unit || '–')}</td>
            ${editableClasses.map(c => `<td><input type="number" step="any" ${isAdmin ? '' : 'disabled'} data-p="${p.key}" data-c="${c.id}" value="${thresholds[p.key]?.[c.id] ?? ''}"></td>`).join('')}
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

    <div class="card">
      <h2>VeVA-Codes (Aushub/Boden)</h2>
      <p class="hint">Abfallcodes für die Begleitschein-Zuordnung bei Aushub- und Bodenaushubmaterial.
      ${isAdmin ? '' : ' Nur Administrator/innen können sie ändern.'}
      <strong>Hinweis:</strong> Vor Verwendung auf einem offiziellen Begleitschein bitte die Codes gegen die
      aktuelle VeVA-Liste prüfen.</p>
      <div style="overflow-x:auto">
      <table class="threshold-table" id="veva-codes-table">
        <tr><th>Code</th><th>Bezeichnung</th><th>Material</th><th>VVEA-Klasse</th>${isAdmin ? '<th></th>' : ''}</tr>
        ${vevaCodes.map((c, i) => `
          <tr>
            <td><input data-vv="${i}" data-vvf="code" ${isAdmin ? '' : 'disabled'} value="${escapeHtml(c.code)}" style="width:9rem;"></td>
            <td><input data-vv="${i}" data-vvf="bezeichnung" ${isAdmin ? '' : 'disabled'} value="${escapeHtml(c.bezeichnung)}" style="width:16rem;"></td>
            <td><select data-vv="${i}" data-vvf="material" ${isAdmin ? '' : 'disabled'}>
              ${VEVA_MATERIALIEN.map(m => `<option value="${m}" ${c.material === m ? 'selected' : ''}>${m}</option>`).join('')}
            </select></td>
            <td><select data-vv="${i}" data-vvf="klasse" ${isAdmin ? '' : 'disabled'}>
              ${CLASSES.map(k => `<option value="${k.id}" ${c.klasse === k.id ? 'selected' : ''}>${escapeHtml(k.short)}</option>`).join('')}
            </select></td>
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

    ${usersHtml}

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

    <div class="card">
      <h2>Über diese App</h2>
      <p class="hint">Baustellen-Probennahmejournal – Fotodokumentation, Analyse-Import (CSV/PDF) mit
      automatischer Farbcodierung nach Deponieklassen (VVEA) oder Bodenqualität (VBBo), VeVA-Codes,
      Entsorgungsweg sowie PDF/E-Mail-Export. Proben, Fotos, Projekte und Grenzwerte werden zentral auf dem
      Server gespeichert und sind für alle angemeldeten Team-Mitglieder sichtbar.</p>
    </div>
  `;

  if (isAdmin) {
    function collectThresholdsFromTable() {
      const t = JSON.parse(JSON.stringify(thresholds));
      $$('#threshold-table input[data-p]').forEach(inp => {
        const p = inp.dataset.p, c = inp.dataset.c;
        t[p] = t[p] || {};
        t[p][c] = inp.value === '' ? null : parseFloat(inp.value);
      });
      return t;
    }

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

    // ---------- VeVA-Codes ----------
    function collectVevaCodesFromTable() {
      const codes = vevaCodes.map(c => ({ ...c }));
      $$('#veva-codes-table [data-vv]').forEach(el => {
        const i = Number(el.dataset.vv), f = el.dataset.vvf;
        if (codes[i]) codes[i][f] = el.value;
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
      vevaCodes.push({ code: '', bezeichnung: '', material: 'Aushub', klasse: 'unbelastet' });
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

    await paintUserList();
    $('#btn-create-user').addEventListener('click', async () => {
      const name = $('#nu-name').value.trim();
      const email = $('#nu-email').value.trim();
      const password = $('#nu-pass').value;
      const role = $('#nu-role').value;
      if (!name || !email || !password) { toast('Bitte Name, E-Mail und Passwort ausfüllen.'); return; }
      try {
        await createUserApi({ name, email, password, role });
        toast('Benutzer angelegt');
        $('#nu-name').value = ''; $('#nu-email').value = ''; $('#nu-pass').value = '';
        await paintUserList();
      } catch (err) { toast('Fehler: ' + errMsg(err)); }
    });
  }
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

async function paintUserList() {
  const box = $('#user-list');
  if (!box) return;
  box.innerHTML = '<p class="hint">Lade Benutzer …</p>';
  try {
    const users = await listUsersApi();
    const me = getCurrentUser();
    box.innerHTML = users.map(u => `
      <div style="display:flex;align-items:center;gap:.5rem;">
        <span style="flex:1;">${escapeHtml(u.name)} — ${escapeHtml(u.email)} ${u.role === 'admin' ? '<span class="badge" style="background:#4a148c;">Admin</span>' : ''}</span>
        ${u.id !== me.id ? `<button class="btn danger" style="padding:.2rem .6rem;" data-del-user="${u.id}">Entfernen</button>` : '<span class="hint">(du)</span>'}
      </div>`).join('');
    $$('[data-del-user]').forEach(btn => btn.addEventListener('click', async () => {
      if (!confirm('Diesen Benutzer wirklich entfernen?')) return;
      try { await deleteUserApi(btn.dataset.delUser); await paintUserList(); }
      catch (err) { toast('Fehler: ' + errMsg(err)); }
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
