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
export const PARAMETERS = [
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

function findParamByAlias(text) {
  const t = text.trim().toLowerCase().replace(/\s+/g, ' ');
  let best = null;
  for (const p of PARAMETERS) {
    for (const a of p.aliases) {
      if (t === a) return p; // exact match wins immediately
      if (t.includes(a) && (!best || a.length > best._matchLen)) {
        best = p;
        best._matchLen = a.length;
      }
    }
  }
  return best;
}
export { findParamByAlias };

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

// Hinweis: Die Grenzwerte werden serverseitig gespeichert und über api.js
// (getThresholdsApi/saveThresholdsApi/resetThresholdsApi) geladen/gespeichert,
// damit alle Benutzer:innen dieselbe Klassifizierung sehen. DEMO_THRESHOLDS
// dient hier nur noch als Fallback, falls der Server (noch) nicht erreichbar ist.

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
