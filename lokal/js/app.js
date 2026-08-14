import {
  newEntry, saveEntry, deleteEntry, getEntry, getAllEntries, uuid,
  newProject, saveProject, deleteProject, getProject, getAllProjects,
  getRecentProbenehmer, rememberProbenehmer,
} from './db.js';
import {
  CLASSES, PARAMETERS, DEFAULT_PARAMETERS, classify, setParameters, slugifyParamKey,
  parseThresholdsCSV, buildThresholdsCSVTemplate,
  loadThresholds, saveThresholds, resetThresholds,
  loadParameters, saveParameters, resetParametersStorage,
  hasAcknowledgedDisclaimer, acknowledgeDisclaimer,
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

// ---------- Disclaimer ----------
function initDisclaimer() {
  const el = $('#disclaimer');
  if (!hasAcknowledgedDisclaimer()) el.classList.remove('hidden');
  $('#ack-disclaimer').addEventListener('click', () => {
    acknowledgeDisclaimer();
    el.classList.add('hidden');
  });
}

// ---------- Router ----------
function setActiveTab(route) {
  $$('.tabs a').forEach(a => a.classList.toggle('active', a.dataset.route === route));
}

async function route() {
  const hash = location.hash || '#/journal';
  const parts = hash.replace('#/', '').split('/');
  if (parts[0] === 'eintrag') {
    setActiveTab('eintrag');
    await renderEntryForm(parts[1] || 'neu');
  } else if (parts[0] === 'projekte') {
    setActiveTab('projekte');
    await renderProjects();
  } else if (parts[0] === 'einstellungen') {
    setActiveTab('einstellungen');
    renderSettings();
  } else {
    setActiveTab('journal');
    await renderJournal();
  }
}
window.addEventListener('hashchange', route);

// ---------- Journal (Liste mit Filtern) ----------
let journalEntries = [];
let journalFilter = { projekt: '', material: '', klasse: '', sort: 'neu' };

async function renderJournal() {
  journalEntries = await getAllEntries();
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
      <div class="field"><label>Deponieklasse</label><select id="filter-klasse">
        <option value="">Alle</option>
        ${CLASSES.map(c => `<option value="${c.id}" ${journalFilter.klasse === c.id ? 'selected' : ''}>${escapeHtml(c.short)}</option>`).join('')}
      </select></div>
      <div class="field"><label>Sortierung</label><select id="filter-sort">
        <option value="neu" ${journalFilter.sort === 'neu' ? 'selected' : ''}>Neueste zuerst</option>
        <option value="alt" ${journalFilter.sort === 'alt' ? 'selected' : ''}>Älteste zuerst</option>
        <option value="klasse" ${journalFilter.sort === 'klasse' ? 'selected' : ''}>Deponieklasse (kritischste zuerst)</option>
      </select></div>
    </div>
    <p class="hint" id="filter-count"></p>
    <div class="entry-list" id="entry-list"></div>`;

  $('#filter-projekt').addEventListener('change', ev => { journalFilter.projekt = ev.target.value; paintJournalList(); });
  $('#filter-material').addEventListener('change', ev => { journalFilter.material = ev.target.value; paintJournalList(); });
  $('#filter-klasse').addEventListener('change', ev => { journalFilter.klasse = ev.target.value; paintJournalList(); });
  $('#filter-sort').addEventListener('change', ev => { journalFilter.sort = ev.target.value; paintJournalList(); });
  paintJournalList();
}

function paintJournalList() {
  let list = journalEntries.filter(e =>
    (!journalFilter.projekt || e.baustelle === journalFilter.projekt) &&
    (!journalFilter.material || e.material === journalFilter.material) &&
    (!journalFilter.klasse || e.klassifizierung?.classId === journalFilter.klasse)
  );
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
    const thumbPhoto = entry.photos && entry.photos[0];
    const thumbEl = document.createElement('div');
    thumbEl.className = 'entry-thumb';
    if (thumbPhoto) thumbEl.style.backgroundImage = `url(${URL.createObjectURL(thumbPhoto.blob)})`;
    else thumbEl.textContent = '📷';
    const cls = entry.klassifizierung ? CLASSES[entry.klassifizierung.classIndex] : null;
    card.innerHTML = `<div class="entry-info">
        <h3 class="entry-title">${escapeHtml(entry.probeBezeichnung || '(ohne Bezeichnung)')}</h3>
        <p class="entry-sub">${escapeHtml(entry.baustelle || '–')} · ${escapeHtml(entry.material || '')} · ${fmtDate(entry.createdAt)}</p>
        ${cls ? `<span class="badge" style="background:${cls.color}">${escapeHtml(cls.short)}</span>` : '<span class="hint">keine Analyse</span>'}
      </div>`;
    card.prepend(thumbEl);
    card.addEventListener('click', () => { location.hash = `#/eintrag/${entry.id}`; });
    container.appendChild(card);
  }
}

// ---------- Projekte ----------
let editingProjectId = null;

async function renderProjects() {
  const projects = await getAllProjects();
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
    const usedBy = journalEntries.some(e => e.projektId === btn.dataset.delProject);
    const allEntries = await getAllEntries();
    if (allEntries.some(e => e.projektId === btn.dataset.delProject)) {
      toast('Projekt hat noch Proben und kann nicht gelöscht werden.');
      return;
    }
    if (!confirm('Dieses Projekt wirklich löschen?')) return;
    await deleteProject(btn.dataset.delProject);
    toast('Projekt gelöscht');
    await renderProjects();
  }));
  const cancelBtn = $('#btn-cancel-edit-project');
  if (cancelBtn) cancelBtn.addEventListener('click', () => { editingProjectId = null; paintProjects(projects); });

  $('#btn-save-project').addEventListener('click', async () => {
    const name = $('#p-name').value.trim();
    const kuerzel = $('#p-kuerzel').value.trim().toUpperCase().replace(/[^A-Z0-9\-]/g, '').slice(0, 12);
    if (!name || !kuerzel) { toast('Bitte Projektname und Kürzel angeben.'); return; }
    const payload = {
      name, kuerzel,
      auftraggeber: $('#p-auftraggeber').value.trim(),
      ort: $('#p-ort').value.trim(),
      bemerkungen: $('#p-bemerkungen').value.trim(),
    };
    if (editing) {
      await saveProject({ ...editing, ...payload });
      toast('Projekt gespeichert');
    } else {
      await saveProject(newProject(payload));
      toast('Projekt angelegt');
    }
    await renderProjects();
  });
}

// ---------- Eintrag-Formular ----------
let currentEntry = null;
let isNew = true;
let currentClassification = null;
let thresholds = loadThresholds();
let formProjects = [];
let formEntnahmeorte = [];

async function renderEntryForm(idOrNeu) {
  thresholds = loadThresholds();
  setParameters(loadParameters());
  if (idOrNeu === 'neu') {
    currentEntry = newEntry();
    isNew = true;
    formProjects = await getAllProjects();
    if (formProjects.length === 0) {
      appEl.innerHTML = `<div class="empty-state">
        <p>Bevor eine Probe erfasst werden kann, muss zuerst ein Projekt angelegt werden.</p>
        <a class="btn" href="#/projekte">+ Projekt anlegen</a>
      </div>`;
      return;
    }
    const allEntries = await getAllEntries();
    formEntnahmeorte = allEntries.map(en => en.entnahmeort).filter(Boolean);
    currentEntry.projektId = formProjects[0].id;
    const recent = getRecentProbenehmer();
    if (recent.length) currentEntry.probenehmer = recent[0];
  } else {
    const loaded = await getEntry(idOrNeu);
    if (!loaded) { location.hash = '#/journal'; return; }
    currentEntry = loaded;
    isNew = false;
  }
  recomputeClassification();
  paintEntryForm();
}

function recomputeClassification() {
  const werte = (currentEntry.analyse || [])
    .filter(a => a.parameterKey && a.wert !== null && a.wert !== undefined && !Number.isNaN(a.wert))
    .map(a => ({ parameterKey: a.parameterKey, wert: a.wert, art: a.art || 'gesamt' }));
  currentClassification = werte.length ? classify(werte, thresholds) : null;
  currentEntry.klassifizierung = currentClassification;
}

function projektHint() {
  const p = formProjects.find(pr => pr.id === currentEntry.projektId);
  if (!p) return '';
  return `Nächste Chargennummer (voraussichtlich): <strong>${escapeHtml(p.kuerzel)}-${pad3(p.nextChargeNumber)}</strong>`;
}

function paintEntryForm() {
  const e = currentEntry;
  const recentNames = getRecentProbenehmer();
  const materialIsCustom = e.material && !MATERIAL_OPTIONS.includes(e.material);
  const probenehmerIsCustom = e.probenehmer && !recentNames.includes(e.probenehmer);

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
            ${recentNames.map(n => `<option value="${escapeHtml(n)}" ${e.probenehmer === n ? 'selected' : ''}>${escapeHtml(n)}</option>`).join('')}
            <option value="${ANDERE}" ${probenehmerIsCustom || !e.probenehmer ? 'selected' : ''}>Andere (Freitext)…</option>
          </select>
          <input id="f-person-andere" placeholder="Name angeben" style="margin-top:.4rem;display:${probenehmerIsCustom || !e.probenehmer ? 'block' : 'none'};" value="${escapeHtml(probenehmerIsCustom ? e.probenehmer : '')}">
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
      <h2>Fotos</h2>
      <input type="file" accept="image/*" capture="environment" multiple id="photo-input" style="display:none">
      <button class="btn" id="btn-photo" type="button">📷 Foto(s) aufnehmen / hinzufügen</button>
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
    for (const file of ev.target.files) {
      e.photos.push({ id: uuid(), blob: file, filename: file.name || `foto-${Date.now()}.jpg`, takenAt: new Date().toISOString() });
    }
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
    const rows = parseCSV(text);
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
      const rows = await parsePDF(buf);
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
    try {
      if (isNew) {
        const project = await getProject(e.projektId);
        if (!project) { toast('Projekt nicht gefunden.'); return; }
        const seq = project.nextChargeNumber || 1;
        e.probeBezeichnung = `${project.kuerzel}-${pad3(seq)}`;
        e.baustelle = project.name;
        project.nextChargeNumber = seq + 1;
        await saveProject(project);
      }
      recomputeClassification();
      if (e.probenehmer) rememberProbenehmer(e.probenehmer);
      await saveEntry(e);
      toast('Gespeichert');
      isNew = false;
      location.hash = `#/eintrag/${e.id}`;
    } catch (err) {
      toast('Fehler beim Speichern: ' + err.message);
    }
  });

  function buildPdfReportEntry() { return { ...e }; }
  function pdfFilename() {
    return `${(e.baustelle || 'Probe')}_${(e.probeBezeichnung || 'neu')}`.replace(/[^\w\-]+/g, '_') + '.pdf';
  }

  $('#btn-pdf').addEventListener('click', async () => {
    recomputeClassification();
    toast('PDF wird erstellt …');
    try {
      const blob = await generateReportPDF(buildPdfReportEntry(), currentClassification);
      downloadBlob(pdfFilename(), blob);
    } catch (err) {
      console.error(err);
      toast('PDF konnte nicht erstellt werden: ' + err.message);
    }
  });

  $('#btn-mail').addEventListener('click', async () => {
    recomputeClassification();
    toast('PDF wird erstellt …');
    try {
      const blob = await generateReportPDF(buildPdfReportEntry(), currentClassification);
      const subject = `Probennahmejournal – ${e.baustelle || ''} – ${e.probeBezeichnung || ''}`.trim();
      const body = buildMailSummary(e, currentClassification);
      const result = await sharePDFOrDownload(blob, pdfFilename(), subject, body);
      if (result === 'shared') {
        toast('Zum Teilen/Senden bereit – PDF ist angehängt.');
      } else if (result === 'downloaded') {
        toast('PDF heruntergeladen – bitte in der E-Mail manuell anhängen (mailto: kann keine Anhänge setzen).');
        window.location.href = buildMailto(e, currentClassification);
      }
    } catch (err) {
      console.error(err);
      toast('PDF/E-Mail konnte nicht vorbereitet werden: ' + err.message);
    }
  });

  if (!isNew) {
    $('#btn-delete').addEventListener('click', async () => {
      if (!confirm('Diese Probe wirklich löschen?')) return;
      await deleteEntry(e.id);
      toast('Gelöscht');
      location.hash = '#/journal';
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
  currentEntry.photos.forEach((p, idx) => {
    const div = document.createElement('div');
    div.className = 'photo-thumb';
    const img = document.createElement('img');
    img.src = URL.createObjectURL(p.blob);
    const del = document.createElement('button');
    del.textContent = '×';
    del.type = 'button';
    del.addEventListener('click', () => { currentEntry.photos.splice(idx, 1); paintPhotoGrid(); });
    div.append(img, del);
    grid.appendChild(div);
  });
}

function paramOptionsHtml(selected) {
  return `<option value="">– wählen –</option>` + PARAMETERS.map(p =>
    `<option value="${p.key}" ${p.key === selected ? 'selected' : ''}>${escapeHtml(p.label)}</option>`).join('');
}

function paintAnalyseTable() {
  const table = $('#analyse-table');
  const rows = currentEntry.analyse;
  if (rows.length === 0) {
    table.innerHTML = '<tr><td class="hint" colspan="5">Noch keine Werte – manuell hinzufügen oder CSV/PDF importieren.</td></tr>';
  } else {
    table.innerHTML = `<tr><th>Parameter</th><th>Wert</th><th>Einheit</th><th>Art</th><th></th></tr>` +
      rows.map((r, i) => `
        <tr>
          <td><select data-i="${i}" data-f="parameterKey">${paramOptionsHtml(r.parameterKey)}</select></td>
          <td><input data-i="${i}" data-f="wert" type="number" step="any" inputmode="decimal" value="${r.wert ?? ''}"></td>
          <td class="hint">${escapeHtml(r.einheit || '')}</td>
          <td><select data-i="${i}" data-f="art">
                <option value="gesamt" ${r.art === 'gesamt' ? 'selected' : ''}>Gesamtgehalt</option>
                <option value="eluat" ${r.art === 'eluat' ? 'selected' : ''}>Eluat</option>
              </select></td>
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
        const def = PARAMETERS.find(p => p.key === val);
        if (def) {
          currentEntry.analyse[i].einheit = def.unit;
          currentEntry.analyse[i].art = def.art;
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
  const info = CLASSES[currentClassification.classIndex];
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
function renderSettings() {
  const t = loadThresholds();
  setParameters(loadParameters());
  thresholds = t;
  const editableClasses = CLASSES.filter(c => !c.terminal);

  appEl.innerHTML = `
    <div class="card">
      <h2>Grenzwerte (Deponieklassen)</h2>
      <p class="hint">Leeres Feld = für diese Klasse nicht geregelt. Diese Tabelle bestimmt die Farbcodierung
      der Analysewerte.</p>
      <div style="overflow-x:auto">
      <table class="threshold-table" id="threshold-table">
        <tr><th>Parameter</th><th>Art</th><th>Einheit</th>${editableClasses.map(c => `<th style="color:${c.color}">${c.short}</th>`).join('')}<th></th></tr>
        ${PARAMETERS.map(p => `
          <tr>
            <td>${escapeHtml(p.label)}</td>
            <td class="readonly">${p.art === 'eluat' ? 'Eluat' : 'Gesamt'}</td>
            <td class="readonly">${escapeHtml(p.unit || '–')}</td>
            ${editableClasses.map(c => `<td><input type="number" step="any" data-p="${p.key}" data-c="${c.id}" value="${t[p.key]?.[c.id] ?? ''}"></td>`).join('')}
            <td><button type="button" class="btn danger" style="padding:.2rem .5rem;" data-del-param="${p.key}">×</button></td>
          </tr>`).join('')}
      </table>
      </div>
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
    </div>

    <div class="card">
      <h2>Legende Deponieklassen</h2>
      <div class="entry-list">
        ${CLASSES.map(c => `<div style="display:flex;align-items:center;gap:.5rem;">
          <span class="badge" style="background:${c.color}">${escapeHtml(c.short)}</span>
          <span>${escapeHtml(c.label)}</span>
        </div>`).join('')}
      </div>
    </div>

    <div class="card">
      <h2>Über diese App</h2>
      <p class="hint">Baustellen-Probennahmejournal – Fotodokumentation, Analyse-Import (CSV/PDF) mit
      automatischer Farbcodierung nach Deponieklassen, sowie PDF/E-Mail-Export. Alle Daten werden ausschliesslich
      lokal im Browser gespeichert (IndexedDB) – es findet keine automatische Übertragung an einen Server statt.</p>
    </div>
  `;

  function collectThresholdsFromTable() {
    const nt = JSON.parse(JSON.stringify(t));
    $$('#threshold-table input[data-p]').forEach(inp => {
      const p = inp.dataset.p, c = inp.dataset.c;
      nt[p] = nt[p] || {};
      nt[p][c] = inp.value === '' ? null : parseFloat(inp.value);
    });
    return nt;
  }

  $('#btn-save-thresholds').addEventListener('click', () => {
    const newT = collectThresholdsFromTable();
    saveThresholds(newT);
    thresholds = newT;
    toast('Grenzwerte gespeichert');
  });
  $('#btn-reset-thresholds').addEventListener('click', () => {
    if (!confirm('Grenzwerte UND Parameterliste wirklich auf die Beispielwerte zurücksetzen?')) return;
    resetThresholds();
    thresholds = loadThresholds();
    setParameters(resetParametersStorage());
    toast('Zurückgesetzt');
    renderSettings();
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

  $$('[data-del-param]').forEach(btn => btn.addEventListener('click', () => {
    if (!confirm(`Parameter „${btn.dataset.delParam}“ wirklich entfernen?`)) return;
    const newParams = PARAMETERS.filter(p => p.key !== btn.dataset.delParam);
    saveParameters(newParams);
    setParameters(newParams);
    toast('Parameter entfernt');
    renderSettings();
  }));
  $('#btn-add-param').addEventListener('click', () => {
    const label = $('#np-label').value.trim();
    const unit = $('#np-unit').value.trim();
    const art = $('#np-art').value;
    if (!label) { toast('Bitte eine Bezeichnung angeben.'); return; }
    const key = slugifyParamKey(label, new Set(PARAMETERS.map(p => p.key)));
    const newParams = [...PARAMETERS, { key, label, unit, art, aliases: [label.toLowerCase()] }];
    saveParameters(newParams);
    setParameters(newParams);
    toast('Parameter hinzugefügt');
    renderSettings();
  });
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
  $('#btn-confirm-thresholds-import').addEventListener('click', () => {
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
    saveParameters(newParams);
    saveThresholds(newThresholds);
    setParameters(newParams);
    thresholds = newThresholds;
    toast(`${count} Parameter/Grenzwerte übernommen und gespeichert`);
    renderSettings();
  });
  $('#btn-cancel-thresholds-import').addEventListener('click', () => { el.innerHTML = ''; });
}

// ---------- Init ----------
initDisclaimer();
route();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  });
}
