import {
  listEntries, getEntryApi, createEntryApi, updateEntryApi, deleteEntryApi,
  uploadPhotos, deletePhotoApi, fetchPhotoBlob,
  getThresholdsApi, saveThresholdsApi, resetThresholdsApi,
  listUsersApi, createUserApi, deleteUserApi,
  login, logout, isLoggedIn, getCurrentUser, ApiError,
} from './api.js';
import {
  CLASSES, PARAMETERS, classify, DEMO_THRESHOLDS,
  hasAcknowledgedDisclaimer, acknowledgeDisclaimer,
} from './vvea.js';
import { parseCSV } from './parse-csv.js';
import { parsePDF } from './parse-pdf.js';
import { generateReportHTML, downloadHTML } from './report.js';
import { buildMailto } from './email.js';

const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const appEl = $('#app');

function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 250); }, 3200);
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

// ---------- Journal (Liste) ----------
const photoUrlCache = new Map(); // photoId -> objectURL

async function getPhotoUrl(entryId, photo) {
  if (photoUrlCache.has(photo.id)) return photoUrlCache.get(photo.id);
  const blob = await fetchPhotoBlob(entryId, photo.id);
  const url = URL.createObjectURL(blob);
  photoUrlCache.set(photo.id, url);
  return url;
}

async function renderJournal() {
  appEl.innerHTML = '<p class="hint">Lade Journal …</p>';
  const entries = await listEntries();
  if (entries.length === 0) {
    appEl.innerHTML = `<div class="empty-state">
      <p>Noch keine Proben erfasst.</p>
      <a class="btn" href="#/eintrag/neu">+ Neue Probe erfassen</a>
    </div>`;
    return;
  }
  appEl.innerHTML = `<div class="btn-row"><a class="btn" href="#/eintrag/neu">+ Neue Probe</a></div>
    <div class="entry-list"></div>`;
  const list = $('.entry-list');
  for (const entry of entries) {
    const card = document.createElement('article');
    card.className = 'entry-card';
    const thumbEl = document.createElement('div');
    thumbEl.className = 'entry-thumb';
    thumbEl.textContent = '📷';
    const cls = entry.klassifizierung ? CLASSES[entry.klassifizierung.classIndex] : null;
    card.innerHTML = `<div class="entry-info">
        <h3 class="entry-title"></h3>
        <p class="entry-sub"></p>
        ${cls ? `<span class="badge" style="background:${cls.color}"></span>` : '<span class="hint">keine Analyse</span>'}
      </div>`;
    card.querySelector('.entry-title').textContent = entry.probeBezeichnung || '(ohne Bezeichnung)';
    card.querySelector('.entry-sub').textContent = `${entry.baustelle || '–'} · ${fmtDate(entry.createdAt)}`;
    if (cls) card.querySelector('.badge').textContent = cls.short;
    card.prepend(thumbEl);
    card.addEventListener('click', () => { location.hash = `#/eintrag/${entry.id}`; });
    list.appendChild(card);
    if (entry.photos && entry.photos[0]) {
      getPhotoUrl(entry.id, entry.photos[0]).then(url => { thumbEl.style.backgroundImage = `url(${url})`; thumbEl.textContent = ''; }).catch(() => {});
    }
  }
}

// ---------- Eintrag-Formular ----------
let currentEntry = null;
let isNew = true;
let pendingPhotos = []; // File[] noch nicht hochgeladen
let currentClassification = null;
let thresholds = DEMO_THRESHOLDS;

function newDraftEntry() {
  return {
    id: null,
    createdAt: new Date().toISOString(),
    baustelle: '', probeBezeichnung: '', entnahmeort: '', gps: null,
    material: '', probenehmer: '', bemerkungen: '',
    photos: [], analyse: [], klassifizierung: null,
  };
}

async function renderEntryForm(idOrNeu) {
  try { thresholds = await getThresholdsApi(); } catch (e) { /* Fallback bleibt aktiv */ }
  pendingPhotos = [];
  if (idOrNeu === 'neu') {
    currentEntry = newDraftEntry();
    isNew = true;
  } else {
    currentEntry = await getEntryApi(idOrNeu);
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

function paintEntryForm() {
  const e = currentEntry;
  appEl.innerHTML = `
    <div class="card">
      <h2>${isNew ? 'Neue Probe' : 'Probe bearbeiten'}</h2>
      <div class="grid-2">
        <div class="field"><label>Baustelle / Projekt</label><input id="f-baustelle" value="${escapeHtml(e.baustelle)}"></div>
        <div class="field"><label>Probenbezeichnung</label><input id="f-probe" value="${escapeHtml(e.probeBezeichnung)}"></div>
        <div class="field"><label>Entnahmeort</label><input id="f-ort" value="${escapeHtml(e.entnahmeort)}"></div>
        <div class="field"><label>Material</label><input id="f-material" placeholder="z.B. Aushub, Mischabbruch..." value="${escapeHtml(e.material)}"></div>
        <div class="field"><label>Probenehmer/in</label><input id="f-person" value="${escapeHtml(e.probenehmer)}"></div>
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
      <button class="btn secondary" id="btn-report" type="button">📄 Bericht exportieren (HTML)</button>
      <button class="btn secondary" id="btn-mail" type="button">✉️ E-Mail vorbereiten</button>
      ${!isNew ? `<button class="btn danger" id="btn-delete" type="button">🗑 Löschen</button>` : ''}
    </div>
  `;

  $('#f-baustelle').addEventListener('input', ev => e.baustelle = ev.target.value);
  $('#f-probe').addEventListener('input', ev => e.probeBezeichnung = ev.target.value);
  $('#f-ort').addEventListener('input', ev => e.entnahmeort = ev.target.value);
  $('#f-material').addEventListener('input', ev => e.material = ev.target.value);
  $('#f-person').addEventListener('input', ev => e.probenehmer = ev.target.value);
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
    if (!e.probeBezeichnung) { toast('Bitte eine Probenbezeichnung angeben.'); return; }
    const btn = $('#btn-save');
    btn.disabled = true;
    try {
      recomputeClassification();
      const payload = { ...e };
      delete payload.photos; // Fotos laufen über separaten Upload-Endpunkt
      let saved;
      if (isNew) {
        saved = await createEntryApi(payload);
      } else {
        saved = await updateEntryApi(e.id, payload);
      }
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
      if (location.hash === targetHash) {
        await renderEntryForm(saved.id);
      } else {
        location.hash = targetHash;
      }
    } catch (err) {
      toast('Fehler beim Speichern: ' + errMsg(err));
    } finally {
      btn.disabled = false;
    }
  });

  $('#btn-report').addEventListener('click', async () => {
    recomputeClassification();
    toast('Bericht wird erstellt …');
    const reportEntry = { ...e, photos: [] };
    for (const p of pendingPhotos) reportEntry.photos.push({ blob: p, filename: p.name });
    for (const p of (e.photos || [])) {
      try {
        const blob = await fetchPhotoBlob(e.id, p.id);
        reportEntry.photos.push({ blob, filename: p.originalName || p.filename });
      } catch (err) { /* Foto überspringen falls nicht ladbar */ }
    }
    const html = await generateReportHTML(reportEntry, currentClassification);
    const fname = `${(e.baustelle || 'Bericht')}_${(e.probeBezeichnung || 'Probe')}`.replace(/[^\w\-]+/g, '_') + '.html';
    downloadHTML(fname, html);
  });
  $('#btn-mail').addEventListener('click', () => {
    recomputeClassification();
    const mailEntry = { ...e, photos: [...(e.photos || []), ...pendingPhotos] };
    const url = buildMailto(mailEntry, currentClassification);
    window.location.href = url;
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
  // bereits hochgeladene Fotos
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
  // noch nicht hochgeladene Fotos
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
          <td><input data-i="${i}" data-f="wert" type="number" step="any" value="${r.wert ?? ''}"></td>
          <td><input data-i="${i}" data-f="einheit" value="${escapeHtml(r.einheit || '')}"></td>
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
async function renderSettings() {
  appEl.innerHTML = '<p class="hint">Lade Einstellungen …</p>';
  const me = getCurrentUser();
  const isAdmin = me?.role === 'admin';
  let t;
  try { t = await getThresholdsApi(); } catch (err) { appEl.innerHTML = `<div class="card"><p>Fehler: ${escapeHtml(errMsg(err))}</p></div>`; return; }
  thresholds = t;
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
      <p class="hint">Werte in mg/kg TS (Gesamtgehalt) bzw. mg/l (Eluat), TOC in %. Leeres Feld = für diese
      Klasse nicht geregelt. Diese Tabelle bestimmt die Farbcodierung für <strong>alle</strong> Benutzer/innen.
      ${isAdmin ? '' : ' Nur Administrator/innen können sie ändern.'}</p>
      <div style="overflow-x:auto">
      <table class="threshold-table" id="threshold-table">
        <tr><th>Parameter</th><th>Art</th>${editableClasses.map(c => `<th style="color:${c.color}">${c.short}</th>`).join('')}</tr>
        ${PARAMETERS.map(p => `
          <tr>
            <td>${escapeHtml(p.label)}</td>
            <td class="readonly">${p.art === 'eluat' ? 'Eluat' : 'Gesamt'}</td>
            ${editableClasses.map(c => `<td><input type="number" step="any" ${isAdmin ? '' : 'disabled'} data-p="${p.key}" data-c="${c.id}" value="${t[p.key]?.[c.id] ?? ''}"></td>`).join('')}
          </tr>`).join('')}
      </table>
      </div>
      ${isAdmin ? `<div class="btn-row">
        <button class="btn" id="btn-save-thresholds">💾 Grenzwerte speichern</button>
        <button class="btn secondary" id="btn-reset-thresholds">Zurücksetzen auf Beispielwerte</button>
        <button class="btn secondary" id="btn-export-thresholds">⬇ Als JSON exportieren</button>
      </div>` : ''}
    </div>

    ${usersHtml}

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
      automatischer Farbcodierung nach Deponieklassen, sowie E-Mail-Export. Proben, Fotos und Grenzwerte werden
      zentral auf dem Server gespeichert und sind für alle angemeldeten Team-Mitglieder sichtbar.</p>
    </div>
  `;

  if (isAdmin) {
    $('#btn-save-thresholds').addEventListener('click', async () => {
      const newT = JSON.parse(JSON.stringify(t));
      $$('#threshold-table input').forEach(inp => {
        const p = inp.dataset.p, c = inp.dataset.c;
        newT[p] = newT[p] || {};
        newT[p][c] = inp.value === '' ? null : parseFloat(inp.value);
      });
      try { await saveThresholdsApi(newT); thresholds = newT; toast('Grenzwerte gespeichert'); }
      catch (err) { toast('Fehler: ' + errMsg(err)); }
    });
    $('#btn-reset-thresholds').addEventListener('click', async () => {
      if (!confirm('Grenzwerte wirklich auf die Beispielwerte zurücksetzen?')) return;
      try { thresholds = await resetThresholdsApi(); toast('Zurückgesetzt'); await renderSettings(); }
      catch (err) { toast('Fehler: ' + errMsg(err)); }
    });
    $('#btn-export-thresholds').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(t, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'vvea-grenzwerte.json'; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
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
