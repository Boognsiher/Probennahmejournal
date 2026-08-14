// vvea.js
// Klassifizierungs-Engine für Deponietypen (Schweiz, Struktur gemäss VVEA).
//
// WICHTIG: Die in DEMO_THRESHOLDS hinterlegten Zahlenwerte sind PLATZHALTER
// zur Illustration der Funktion. Sie sind NICHT als aktuelle, rechtsverbindliche
// VVEA-Grenzwerte zu verstehen. Vor produktivem Einsatz müssen die Grenzwerte
// von einer Fachperson anhand der aktuellen VVEA (Anhang 5) bzw. kantonaler
// Vollzugshilfen erfasst/korrigiert werden – siehe Einstellungen > Grenzwerte.

export const STORAGE_KEY_ACK = 'pnj_vvea_disclaimer_ack_v1';

// Deponieklassen, von "sauber" nach "am stärksten belastet" sortiert.
// `terminal: true` markiert die Klasse, die verwendet wird, wenn ein Wert
// selbst den grosszügigsten definierten Grenzwert überschreitet.
export const CLASSES = [
  { id: 'unbelastet', label: 'Unbelastet / Verwertung möglich', short: 'Verwertung', color: '#2e7d32' },
  { id: 'typA', label: 'Deponietyp A (Aushubdeponie)', short: 'Typ A', color: '#66bb6a' },
  { id: 'typB', label: 'Deponietyp B (Inertstoffdeponie)', short: 'Typ B', color: '#29b6f6' },
  { id: 'typC', label: 'Deponietyp C (Reststoffdeponie)', short: 'Typ C', color: '#ffa726' },
  { id: 'typD', label: 'Deponietyp D (Reaktordeponie)', short: 'Typ D', color: '#ef5350' },
  { id: 'typE', label: 'Deponietyp E (Reaktordeponie)', short: 'Typ E', color: '#b71c1c' },
  { id: 'sonderfall', label: 'Nicht deponierbar / Sonderabfall – Fachperson beiziehen', short: 'Sonderfall', color: '#4a148c', terminal: true },
];

// Bekannte Parameter inkl. Alias-Liste für den automatischen Import (CSV/PDF).
// `art`: 'gesamt' (Gesamtgehalt, i.d.R. mg/kg TS) oder 'eluat' (i.d.R. mg/l).
// Startbefüllung — die tatsächlich aktive Liste (`PARAMETERS`) wird vom Server
// geladen und kann dort um eigene Parameter erweitert werden (Einstellungen).
export const DEFAULT_PARAMETERS = [
  { key: 'toc', label: 'TOC (organischer Kohlenstoff)', unit: '%', art: 'gesamt', aliases: ['toc', 'org. kohlenstoff', 'organischer kohlenstoff', 'gesamter organischer kohlenstoff'] },
  { key: 'kw', label: 'Kohlenwasserstoffe C10–C40', unit: 'mg/kg', art: 'gesamt', aliases: ['kw', 'kohlenwasserstoffe', 'mineralölkohlenwasserstoffe', 'tph', 'c10-c40', 'c10–c40'] },
  { key: 'pak', label: 'PAK (Σ16 EPA)', unit: 'mg/kg', art: 'gesamt', aliases: ['pak', 'pah', 'polyzyklische aromatische kohlenwasserstoffe', 'σ16 pak', 'epa-pak'] },
  { key: 'pcb', label: 'PCB (Σ7 Kongenere)', unit: 'mg/kg', art: 'gesamt', aliases: ['pcb', 'polychlorierte biphenyle', 'σ7 pcb'] },
  { key: 'pb', label: 'Blei (Pb)', unit: 'mg/kg', art: 'gesamt', aliases: ['blei', 'pb'] },
  { key: 'cd', label: 'Cadmium (Cd)', unit: 'mg/kg', art: 'gesamt', aliases: ['cadmium', 'cd'] },
  { key: 'cr', label: 'Chrom, gesamt (Cr)', unit: 'mg/kg', art: 'gesamt', aliases: ['chrom', 'cr', 'chrom gesamt'] },
  { key: 'cu', label: 'Kupfer (Cu)', unit: 'mg/kg', art: 'gesamt', aliases: ['kupfer', 'cu'] },
  { key: 'ni', label: 'Nickel (Ni)', unit: 'mg/kg', art: 'gesamt', aliases: ['nickel', 'ni'] },
  { key: 'hg', label: 'Quecksilber (Hg)', unit: 'mg/kg', art: 'gesamt', aliases: ['quecksilber', 'hg'] },
  { key: 'zn', label: 'Zink (Zn)', unit: 'mg/kg', art: 'gesamt', aliases: ['zink', 'zn'] },
  { key: 'cn', label: 'Cyanid, gesamt (CN)', unit: 'mg/kg', art: 'gesamt', aliases: ['cyanid', 'cn'] },
  { key: 'pH', label: 'pH-Wert (Eluat)', unit: '', art: 'eluat', aliases: ['ph', 'ph-wert'] },
  { key: 'doc', label: 'DOC (Eluat)', unit: 'mg/l', art: 'eluat', aliases: ['doc', 'gelöster organischer kohlenstoff'] },
  { key: 'leitf', label: 'Leitfähigkeit (Eluat)', unit: 'µS/cm', art: 'eluat', aliases: ['leitfähigkeit', 'leitfaehigkeit', 'ec'] },
  { key: 'chlorid', label: 'Chlorid (Eluat)', unit: 'mg/l', art: 'eluat', aliases: ['chlorid', 'cl-', 'cl'] },
  { key: 'sulfat', label: 'Sulfat (Eluat)', unit: 'mg/l', art: 'eluat', aliases: ['sulfat', 'so4', 'so4--'] },
  { key: 'fluorid', label: 'Fluorid (Eluat)', unit: 'mg/l', art: 'eluat', aliases: ['fluorid', 'f-'] },
];

// Aktive Parameterliste — live gebunden: setParameters() (aufgerufen von
// app.js nach dem Laden vom Server/aus dem lokalen Speicher) ersetzt den
// Inhalt; alle Importe von {PARAMETERS} in anderen Modulen sehen die
// Änderung automatisch (ES-Module-Live-Bindings), inkl. findParamByAlias/
// classify() unten.
export let PARAMETERS = DEFAULT_PARAMETERS.map(p => ({ ...p }));
export function setParameters(list) {
  PARAMETERS = Array.isArray(list) && list.length ? list : DEFAULT_PARAMETERS.map(p => ({ ...p }));
}

export function findParamByAlias(text) {
  const t = text.trim().toLowerCase().replace(/\s+/g, ' ');
  let best = null;
  for (const p of PARAMETERS) {
    for (const a of (p.aliases || [])) {
      if (t === a) return p; // exact match wins immediately
      if (t.includes(a) && (!best || a.length > best._matchLen)) {
        best = p;
        best._matchLen = a.length;
      }
    }
  }
  return best;
}

export function slugifyParamKey(label, existingKeys) {
  let base = String(label).toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // Umlaute/Akzente entfernen
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24) || 'parameter';
  let key = base;
  let i = 2;
  while (existingKeys.has(key)) { key = `${base}_${i}`; i++; }
  return key;
}

// Platzhalter-Grenzwerte – siehe Hinweis oben. gesamt in mg/kg TS (TOC in %),
// eluat in mg/l (pH dimensionslos). `null` = für diese Klasse nicht geregelt/
// nicht beschränkend.
export const DEMO_THRESHOLDS = {
  toc:     { unbelastet: 1,   typA: 2,   typB: 5,    typC: null, typD: null, typE: null },
  kw:      { unbelastet: 50,  typA: 100, typB: 500,  typC: 1000, typD: null, typE: null },
  pak:     { unbelastet: 1,   typA: 5,   typB: 20,   typC: 50,   typD: null, typE: null },
  pcb:     { unbelastet: 0.1, typA: 0.5, typB: 1,    typC: 5,    typD: null, typE: null },
  pb:      { unbelastet: 50,  typA: 150, typB: 500,  typC: 1000, typD: null, typE: null },
  cd:      { unbelastet: 0.8, typA: 2,   typB: 5,    typC: 20,   typD: null, typE: null },
  cr:      { unbelastet: 50,  typA: 150, typB: 500,  typC: 1000, typD: null, typE: null },
  cu:      { unbelastet: 40,  typA: 150, typB: 500,  typC: 1000, typD: null, typE: null },
  ni:      { unbelastet: 50,  typA: 150, typB: 500,  typC: 1000, typD: null, typE: null },
  hg:      { unbelastet: 0.5, typA: 1,   typB: 5,    typC: 20,   typD: null, typE: null },
  zn:      { unbelastet: 150, typA: 500, typB: 2000, typC: 5000, typD: null, typE: null },
  cn:      { unbelastet: 1,   typA: 5,   typB: 10,   typC: 50,   typD: null, typE: null },
  pH:      { unbelastet: null, typA: null, typB: null, typC: null, typD: null, typE: null },
  doc:     { unbelastet: 20,  typA: 50,  typB: 100,  typC: 200,  typD: null, typE: null },
  leitf:   { unbelastet: null, typA: null, typB: null, typC: null, typD: null, typE: null },
  chlorid: { unbelastet: null, typA: null, typB: null, typC: null, typD: null, typE: null },
  sulfat:  { unbelastet: null, typA: null, typB: null, typC: null, typD: null, typE: null },
  fluorid: { unbelastet: null, typA: null, typB: null, typC: null, typD: null, typE: null },
};

// Hinweis: Grenzwerte & Parameterliste werden zentral gespeichert (Server bzw.
// simulierter Speicher der Test-Schale) und über api.js geladen/gespeichert,
// damit alle Benutzer:innen dieselbe Klassifizierung sehen. DEMO_THRESHOLDS/
// DEFAULT_PARAMETERS dienen hier nur als Fallback bzw. Reset-Vorlage.

export function hasAcknowledgedDisclaimer() {
  return localStorage.getItem(STORAGE_KEY_ACK) === '1';
}
export function acknowledgeDisclaimer() {
  localStorage.setItem(STORAGE_KEY_ACK, '1');
}

/**
 * Klassifiziert eine Probe anhand ihrer Analysewerte.
 * @param {Array<{parameterKey:string, wert:number, art:'gesamt'|'eluat'}>} werte
 * @param {object} thresholds  Grenzwert-Set (siehe DEMO_THRESHOLDS)
 * @returns {{classId:string, classIndex:number, perParameter:Array, unbewertet:Array}}
 */
export function classify(werte, thresholds) {
  const perParameter = [];
  const unbewertet = [];
  let worstIndex = 0;

  for (const w of werte) {
    const paramThresholds = thresholds[w.parameterKey];
    const paramDef = PARAMETERS.find(p => p.key === w.parameterKey);
    if (!paramThresholds || w.wert === null || w.wert === undefined || Number.isNaN(w.wert)) {
      unbewertet.push(w);
      continue;
    }
    const anyLimitDefined = CLASSES.some(c => paramThresholds[c.id] !== null && paramThresholds[c.id] !== undefined);
    if (!anyLimitDefined) {
      unbewertet.push(w);
      continue;
    }

    let matchedIndex = CLASSES.findIndex(c => c.terminal); // default: Sonderfall
    for (let i = 0; i < CLASSES.length; i++) {
      const c = CLASSES[i];
      if (c.terminal) continue;
      const limit = paramThresholds[c.id];
      if (limit === null || limit === undefined) continue; // nicht geregelt auf dieser Stufe -> weiterprüfen
      if (w.wert <= limit) {
        matchedIndex = i;
        break;
      }
    }
    perParameter.push({
      ...w,
      label: paramDef ? paramDef.label : w.parameterKey,
      unit: paramDef ? paramDef.unit : '',
      classIndex: matchedIndex,
      classId: CLASSES[matchedIndex].id,
      color: CLASSES[matchedIndex].color,
    });
    if (matchedIndex > worstIndex) worstIndex = matchedIndex;
  }

  return {
    classId: CLASSES[worstIndex].id,
    classIndex: worstIndex,
    classInfo: CLASSES[worstIndex],
    perParameter,
    unbewertet,
  };
}

// ---------- Grenzwerte-Import aus CSV (z.B. aus Excel exportiert) ----------

function parseThresholdNumber(str) {
  if (str === undefined || str === null) return null;
  const s = String(str).trim();
  if (s === '') return null;
  let n = s.replace(/[^\d,.\-]/g, '');
  if (n.includes(',') && n.includes('.')) n = n.replace(/\./g, '').replace(',', '.');
  else if (n.includes(',')) n = n.replace(',', '.');
  const val = parseFloat(n);
  return Number.isNaN(val) ? null : val;
}

function splitCsvLine(line, delim) {
  const out = [];
  let cur = '', inQuotes = false;
  for (const ch of line) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === delim && !inQuotes) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map(s => s.trim().replace(/^"|"$/g, ''));
}

/**
 * Erwartetes Format (Header-Zeile nötig), z.B. per Excel "Speichern unter -> CSV":
 * Parameter;Art;Einheit;Verwertung;Typ A;Typ B;Typ C;Typ D;Typ E
 * Blei (Pb);Gesamt;mg/kg;50;150;500;1000;;
 *
 * Unbekannte Parameter-Namen werden als NEUE Parameter vorgeschlagen (nicht
 * automatisch übernommen — Vorschau vor dem Übernehmen prüfen lassen).
 */
export function parseThresholdsCSV(text) {
  const lines = text.split(/\r\n|\n|\r/).filter(l => l.trim().length > 0);
  if (lines.length < 2) return [];
  const delim = (lines[0].match(/;/g) || []).length >= (lines[0].match(/,/g) || []).length ? ';' : ',';
  const header = splitCsvLine(lines[0], delim).map(h => h.trim().toLowerCase());
  const paramCol = header.findIndex(h => /parameter|analyt|bezeichnung/.test(h));
  const artCol = header.findIndex(h => /^art$|typ.*matrix|matrix/.test(h));
  const unitCol = header.findIndex(h => /einheit|unit/.test(h));
  const classCols = CLASSES.filter(c => !c.terminal).map(c => ({
    classId: c.id,
    col: header.findIndex(h => h === c.short.toLowerCase() || h === c.label.toLowerCase()),
  }));

  const existingKeys = new Set(PARAMETERS.map(p => p.key));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i], delim);
    const nameRaw = paramCol >= 0 ? cells[paramCol] : cells[0];
    if (!nameRaw) continue;
    const artRaw = artCol >= 0 ? cells[artCol] : '';
    const unitRaw = unitCol >= 0 ? cells[unitCol] : '';
    const existing = findParamByAlias(nameRaw);
    const art = /eluat/i.test(artRaw) ? 'eluat' : (/gesamt/i.test(artRaw) ? 'gesamt' : (existing ? existing.art : 'gesamt'));
    const unit = unitRaw || (existing ? existing.unit : '');
    const values = {};
    for (const { classId, col } of classCols) {
      values[classId] = col >= 0 ? parseThresholdNumber(cells[col]) : null;
    }
    const isNew = !existing;
    const key = existing ? existing.key : slugifyParamKey(nameRaw, existingKeys);
    if (isNew) existingKeys.add(key); // Duplikate innerhalb der Datei vermeiden
    rows.push({ roh: nameRaw, key, label: existing ? existing.label : nameRaw, unit, art, isNew, values });
  }
  return rows;
}

export function buildThresholdsCSVTemplate(parameters, thresholds) {
  const editableClasses = CLASSES.filter(c => !c.terminal);
  const header = ['Parameter', 'Art', 'Einheit', ...editableClasses.map(c => c.short)];
  const lines = [header.join(';')];
  for (const p of parameters) {
    const t = thresholds[p.key] || {};
    const row = [
      p.label, p.art === 'eluat' ? 'Eluat' : 'Gesamt', p.unit || '',
      ...editableClasses.map(c => (t[c.id] ?? '')),
    ];
    lines.push(row.join(';'));
  }
  return lines.join('\r\n');
}
