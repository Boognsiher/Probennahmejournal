// vvea.js
// Klassifizierungs-Engine für Deponietypen (VVEA) und Bodenqualität (VBBo).
//
// WICHTIG: Die hinterlegten Zahlenwerte stammen aus vom Nutzer bereitgestellten
// Quellen (eigene Recherche/Auszüge, Stand siehe README). Vor produktivem
// Einsatz müssen die Grenzwerte von einer Fachperson anhand der aktuellen
// VVEA/VBBo und kantonaler Vollzugshilfen geprüft werden – siehe
// Einstellungen > Grenzwerte.

export const STORAGE_KEY_ACK = 'pnj_vvea_disclaimer_ack_v1';

// ---------- VVEA (Deponieklassen) ----------

// Von "sauber" nach "am stärksten belastet" sortiert. `terminal: true`
// markiert die Klasse, die verwendet wird, wenn ein Wert selbst den
// grosszügigsten definierten Grenzwert überschreitet.
export const CLASSES = [
  { id: 'unbelastet', label: 'Unbelastet / Verwertung möglich', short: 'Verwertung', color: '#2e7d32' },
  { id: 'typA', label: 'Deponietyp A (Aushubdeponie)', short: 'Typ A', color: '#66bb6a' },
  { id: 'typB', label: 'Deponietyp B (Inertstoffdeponie)', short: 'Typ B', color: '#29b6f6' },
  { id: 'typC', label: 'Deponietyp C (Reststoffdeponie)', short: 'Typ C', color: '#ffa726' },
  { id: 'typD', label: 'Deponietyp D (Reaktordeponie)', short: 'Typ D', color: '#ef5350' },
  { id: 'typE', label: 'Deponietyp E (Reaktordeponie)', short: 'Typ E', color: '#b71c1c' },
  { id: 'sonderfall', label: 'Nicht deponierbar / Sonderabfall – Fachperson beiziehen', short: 'Sonderfall', color: '#4a148c', terminal: true },
];

// ---------- VBBo (Bodenqualität) ----------

// Eigenständige 4-Stufen-Skala, unabhängig von VVEA. Nutzt denselben
// classify()-Mechanismus (siehe unten) mit anderen Klassen/Grenzwerten.
export const VBBO_CLASSES = [
  { id: 'unauffaellig', label: 'Unauffällig (unter Richtwert)', short: 'Unauffällig', color: '#2e7d32' },
  { id: 'ueberRichtwert', label: 'Über Richtwert, unter Prüfwert – Beobachtung empfohlen', short: 'Über Richtwert', color: '#fbc02d' },
  { id: 'ueberPruefwert', label: 'Über Prüfwert – weitere Abklärung/Nutzungseinschränkung nötig', short: 'Über Prüfwert', color: '#ef6c00' },
  { id: 'ueberSanierungswert', label: 'Über Sanierungswert – Sanierung nötig', short: 'Sanierungsbedarf', color: '#b71c1c', terminal: true },
];

// Nutzungsart bestimmt, welche Prüfwert-/Sanierungswert-Spalte der VBBo-
// Rohdaten (siehe DEFAULT_VBBO_THRESHOLDS) zur Anwendung kommt.
// Reihenfolge bestimmt auch die Standardauswahl im Formular (erster Eintrag
// = Vorbelegung, siehe NUTZUNGSARTEN[0].id in app.js) — Landwirtschaft/
// Gartenbau ist der häufigste Baustellenfall und steht daher an erster Stelle.
export const NUTZUNGSARTEN = [
  { id: 'landwirtschaft', label: 'Landwirtschaft/Gartenbau', pruefwertSpalte: 'pwFutter', sanierungSpalte: 'sanLandwirtschaft' },
  { id: 'garten', label: 'Haus-/Familiengarten', pruefwertSpalte: 'pwNahrung', sanierungSpalte: 'sanGarten' },
  { id: 'spielplatz', label: 'Kinderspielplatz', pruefwertSpalte: 'pwDirekt', sanierungSpalte: 'sanSpielplatz' },
];

export const DEFAULT_VBBO_PARAMETERS = [
  { key: 'pb', label: 'Blei (Pb)', unit: 'mg/kg', aliases: ['blei', 'pb'] },
  { key: 'cd', label: 'Cadmium (Cd)', unit: 'mg/kg', aliases: ['cadmium', 'cd'] },
  { key: 'cr', label: 'Chrom (Cr)', unit: 'mg/kg', aliases: ['chrom', 'cr'] },
  { key: 'cu', label: 'Kupfer (Cu)', unit: 'mg/kg', aliases: ['kupfer', 'cu'] },
  { key: 'hg', label: 'Quecksilber (Hg)', unit: 'mg/kg', aliases: ['quecksilber', 'hg'] },
  { key: 'ni', label: 'Nickel (Ni)', unit: 'mg/kg', aliases: ['nickel', 'ni'] },
  { key: 'zn', label: 'Zink (Zn)', unit: 'mg/kg', aliases: ['zink', 'zn'] },
  { key: 'pak', label: 'PAK (Σ16 EPA)', unit: 'mg/kg', aliases: ['pak'] },
  { key: 'bap', label: 'Benzo[a]pyren', unit: 'mg/kg', aliases: ['benzo(a)pyren', 'benzo[a]pyren', 'bap'] },
  { key: 'pcb', label: 'PCB', unit: 'mg/kg', aliases: ['pcb'] },
];

export let VBBO_PARAMETERS = DEFAULT_VBBO_PARAMETERS.map(p => ({ ...p }));
export function setVbboParameters(list) {
  VBBO_PARAMETERS = Array.isArray(list) && list.length ? list : DEFAULT_VBBO_PARAMETERS.map(p => ({ ...p }));
}

// Rohwerte je Substanz: richtwert, pwDirekt/pwNahrung/pwFutter (Prüfwerte),
// sanSpielplatz/sanGarten/sanLandwirtschaft (Sanierungswerte).
export const DEFAULT_VBBO_THRESHOLDS = {
  pb:  { richtwert: 50,  pwDirekt: 300, pwNahrung: 200, pwFutter: 200, sanSpielplatz: 1000, sanGarten: 1000, sanLandwirtschaft: 2000 },
  cd:  { richtwert: 0.8, pwDirekt: 10,  pwNahrung: 2,   pwFutter: 2,   sanSpielplatz: 20,   sanGarten: 20,   sanLandwirtschaft: 30 },
  cu:  { richtwert: 40,  pwDirekt: null, pwNahrung: null, pwFutter: 150, sanSpielplatz: null, sanGarten: 1000, sanLandwirtschaft: 1000 },
  zn:  { richtwert: 150, pwDirekt: null, pwNahrung: null, pwFutter: null, sanSpielplatz: null, sanGarten: 2000, sanLandwirtschaft: 2000 },
  hg:  { richtwert: 0.5, pwDirekt: null, pwNahrung: null, pwFutter: null, sanSpielplatz: null, sanGarten: null, sanLandwirtschaft: null },
  pak: { richtwert: 1,   pwDirekt: 10,  pwNahrung: 20,  pwFutter: null, sanSpielplatz: 100,  sanGarten: 100,  sanLandwirtschaft: 100 },
  bap: { richtwert: 0.2, pwDirekt: 1,   pwNahrung: 2,   pwFutter: null, sanSpielplatz: 10,   sanGarten: 10,   sanLandwirtschaft: 10 },
  pcb: { richtwert: null, pwDirekt: 0.1, pwNahrung: 0.2, pwFutter: 0.2, sanSpielplatz: 1,    sanGarten: 1,    sanLandwirtschaft: 3 },
  cr:  { richtwert: null, pwDirekt: null, pwNahrung: null, pwFutter: null, sanSpielplatz: null, sanGarten: null, sanLandwirtschaft: null },
  ni:  { richtwert: null, pwDirekt: null, pwNahrung: null, pwFutter: null, sanSpielplatz: null, sanGarten: null, sanLandwirtschaft: null },
};

// Baut aus den VBBo-Rohwerten + gewählter Nutzungsart ein Grenzwert-Objekt im
// selben Format wie VVEA-Thresholds (eine Klasse -> ein Zahlenwert), damit
// dieselbe classify()-Funktion wiederverwendet werden kann.
export function buildVbboThresholdsForNutzung(vbboThresholds, nutzungsart) {
  const nutzung = NUTZUNGSARTEN.find(n => n.id === nutzungsart) || NUTZUNGSARTEN[0];
  const out = {};
  for (const key of Object.keys(vbboThresholds)) {
    const t = vbboThresholds[key] || {};
    out[key] = {
      unauffaellig: t.richtwert ?? null,
      ueberRichtwert: t[nutzung.pruefwertSpalte] ?? null,
      ueberPruefwert: t[nutzung.sanierungSpalte] ?? null,
      // 'ueberSanierungswert' ist die terminale Klasse, braucht keinen Wert.
    };
  }
  return out;
}

/** Klassifiziert nach VBBo (Nutzungsart-abhängig) — nutzt classify() intern. */
export function classifyVBBO(werte, vbboThresholds, nutzungsart) {
  const projected = buildVbboThresholdsForNutzung(vbboThresholds, nutzungsart);
  return classify(werte, projected, VBBO_CLASSES, VBBO_PARAMETERS);
}

// ---------- VeVA-Code-Zuteilung (automatisch) ----------

// Ordnet die freie Material-Bezeichnung der Probe (z.B. "Unverschmutzter
// Aushub", "Humus/Oberboden") einem der drei Material-Eimer zu, die die
// hinterlegten VeVA-Aushubcodes unterscheiden. Materialien, die nicht
// Boden/Aushub sind (Mischabbruch, Betonabbruch, Asphalt, …), liefern
// bewusst `null` — dafür gibt es keine VeVA-Aushubcodes in der Liste.
export function materialToVevaBucket(material) {
  const text = String(material || '');
  if (/ober|humus/i.test(text)) return 'Oberboden';
  if (/unter/i.test(text)) return 'Unterboden';
  if (/aushub/i.test(text)) return 'Aushub';
  return null;
}

// Der Standard (VVEA/VBBo) wird nicht mehr manuell gewählt, sondern direkt
// aus dem Material abgeleitet: Ober-/Unterboden (inkl. Humus) -> VBBo
// (Bodenqualität), alles andere (Aushub, Kies/Sand, Mischabbruch, …) ->
// VVEA (Deponieklassen). Nutzt denselben Material-Eimer wie die
// VeVA-Code-Zuteilung.
export function materialToStandard(material) {
  const bucket = materialToVevaBucket(material);
  return (bucket === 'Oberboden' || bucket === 'Unterboden') ? 'vbbo' : 'vvea';
}

// VBBo kennt keine eigene Deponietyp-Systematik. Für die VeVA-Aushubcode-
// Zuteilung wird die VBBo-Klasse daher auf die entsprechende Kategorie
// abgebildet:
//   unauffällig          -> Kat. I    (unbelastet)                    -> "unbelastet"
//   über Richtwert       -> Kat. II   (schwach belastet)               -> Typ A
//   über Prüfwert        -> Kat. IIIa (stark belastet)                 -> Typ B*
//   über Sanierungswert  -> Kat. IIIb (stark belastet, VVEA "über Typ B") -> Typ C*
// * Kat. IIIa und Kat. IIIb sind beide "stark belastet", aber zwei
//   unterschiedliche Kategorien; die hinterlegte VeVA-Codeliste kennt aber
//   nur die vier VVEA-Buckets unbelastet/Typ A/Typ B/Typ C, daher werden
//   beide auf den jeweils nächstliegenden Bucket abgebildet. "Sonderabfall"
//   (VVEA "über Typ E") hat in der VBBo-Skala keine eigene Entsprechung und
//   wird nur bei einer VVEA-Einstufung automatisch erkannt.
// Das ist eine vereinfachende fachliche Einschätzung (keine normative
// Gleichsetzung) — bei Sanierungsfällen zusätzlich prüfen lassen.
const VBBO_TO_VEVA_KLASSE = {
  unauffaellig: 'unbelastet',
  ueberRichtwert: 'typA',
  ueberPruefwert: 'typB',
  ueberSanierungswert: 'typC',
};

/**
 * Schlägt automatisch einen VeVA-Aushubcode vor, basierend auf Material,
 * gewähltem Standard (VVEA/VBBo) und dem Einstufungsergebnis (classId aus
 * classify()/classifyVBBO()). Gibt den passenden Eintrag aus `vevaCodes`
 * zurück (mit `code`/`bezeichnung`) oder `null`, wenn nichts passt (z.B.
 * Material ist kein Boden/Aushub, oder noch keine Einstufung vorhanden).
 */
export function suggestVevaCode(material, standard, classId, vevaCodes) {
  if (!classId || !Array.isArray(vevaCodes)) return null;
  const bucket = materialToVevaBucket(material);
  if (!bucket) return null;
  const klasse = standard === 'vbbo' ? VBBO_TO_VEVA_KLASSE[classId] : classId;
  if (!klasse) return null;
  return vevaCodes.find(c => c.material === bucket && c.klasse === klasse) || null;
}

// ---------- Parameter (VVEA) ----------

// Bekannte Parameter inkl. Alias-Liste für den automatischen Import (CSV/PDF).
// `art`: 'gesamt' (Gesamtgehalt, i.d.R. mg/kg TS) oder 'eluat' (i.d.R. mg/l).
// Startbefüllung — die tatsächlich aktive Liste (`PARAMETERS`) wird vom Server
// geladen und kann dort um eigene Parameter erweitert werden (Einstellungen).
export const DEFAULT_PARAMETERS = [
  { key: 'toc', label: 'TOC (organischer Kohlenstoff)', unit: '%', art: 'gesamt', aliases: ['toc', 'org. kohlenstoff', 'organischer kohlenstoff', 'gesamter organischer kohlenstoff'] },
  { key: 'toc400', label: 'TOC400 (VVEA)', unit: 'mg/kg', art: 'gesamt', aliases: ['toc400', 'toc/toc400'] },
  { key: 'kw', label: 'Kohlenwasserstoffe C10–C40', unit: 'mg/kg', art: 'gesamt', aliases: ['mineralölkohlenwasserstoffe', 'tph', 'c10-c40', 'c10–c40', 'kw c10-c40', 'kw c10–c40', 'kwin (c10-c40)'] },
  { key: 'kw_c5', label: 'Kohlenwasserstoffe C5-C10', unit: 'mg/kg', art: 'gesamt', aliases: ['c5-c10', 'c5–c10', 'kw c5-c10'] },
  { key: 'pak', label: 'PAK (Σ16 EPA)', unit: 'mg/kg', art: 'gesamt', aliases: ['pak', 'pah', 'polyzyklische aromatische kohlenwasserstoffe', 'σ16 pak', 'epa-pak'] },
  { key: 'bap', label: 'Benzo[a]pyren', unit: 'mg/kg', art: 'gesamt', aliases: ['benzo(a)pyren', 'benzo[a]pyren', 'benzo a pyren', 'bap'] },
  { key: 'pcb', label: 'PCB (Σ7 Kongenere)', unit: 'mg/kg', art: 'gesamt', aliases: ['pcb', 'polychlorierte biphenyle', 'σ7 pcb'] },
  { key: 'btex', label: 'BTEX (Summe)', unit: 'mg/kg', art: 'gesamt', aliases: ['btex'] },
  { key: 'benzol', label: 'Benzol', unit: 'mg/kg', art: 'gesamt', aliases: ['benzol'] },
  { key: 'sb', label: 'Antimon (Sb)', unit: 'mg/kg', art: 'gesamt', aliases: ['antimon', 'sb'] },
  { key: 'as', label: 'Arsen (As)', unit: 'mg/kg', art: 'gesamt', aliases: ['arsen', 'as'] },
  { key: 'pb', label: 'Blei (Pb)', unit: 'mg/kg', art: 'gesamt', aliases: ['blei', 'pb'] },
  { key: 'cd', label: 'Cadmium (Cd)', unit: 'mg/kg', art: 'gesamt', aliases: ['cadmium', 'cd'] },
  { key: 'cr', label: 'Chrom, gesamt (Cr)', unit: 'mg/kg', art: 'gesamt', aliases: ['cr', 'chrom gesamt', 'chrom total', 'chrom ges.'] },
  { key: 'cr6', label: 'Chrom(VI)', unit: 'mg/kg', art: 'gesamt', aliases: ['chrom vi', 'chrom(vi)', 'chrom 6', 'cr(vi)', 'cr vi'] },
  { key: 'co', label: 'Kobalt (Co)', unit: 'mg/kg', art: 'gesamt', aliases: ['kobalt', 'cobalt'] },
  { key: 'cu', label: 'Kupfer (Cu)', unit: 'mg/kg', art: 'gesamt', aliases: ['kupfer', 'cu'] },
  { key: 'ni', label: 'Nickel (Ni)', unit: 'mg/kg', art: 'gesamt', aliases: ['nickel', 'ni'] },
  { key: 'hg', label: 'Quecksilber (Hg)', unit: 'mg/kg', art: 'gesamt', aliases: ['quecksilber', 'hg'] },
  { key: 'tl', label: 'Thallium (Tl)', unit: 'mg/kg', art: 'gesamt', aliases: ['thallium', 'tl'] },
  { key: 'zn', label: 'Zink (Zn)', unit: 'mg/kg', art: 'gesamt', aliases: ['zink', 'zn'] },
  { key: 'sn', label: 'Zinn (Sn)', unit: 'mg/kg', art: 'gesamt', aliases: ['zinn', 'sn'] },
  { key: 'cn', label: 'Cyanid, gesamt (CN)', unit: 'mg/kg', art: 'gesamt', aliases: ['cyanid gesamt', 'cyanid, gesamt', 'cng'] },
  { key: 'salze', label: 'Lösliche Salze', unit: 'Gew.-%', art: 'gesamt', aliases: ['lösliche salze', 'losliche salze'] },
  { key: 'pH', label: 'pH-Wert (Eluat)', unit: '', art: 'eluat', aliases: ['ph-wert'] },
  { key: 'doc', label: 'DOC (Eluat)', unit: 'mg/l', art: 'eluat', aliases: ['doc', 'gelöster organischer kohlenstoff'] },
  { key: 'leitf', label: 'Leitfähigkeit (Eluat)', unit: 'µS/cm', art: 'eluat', aliases: ['leitfähigkeit', 'leitfaehigkeit', 'ec'] },
  { key: 'chlorid', label: 'Chlorid (Eluat)', unit: 'mg/l', art: 'eluat', aliases: ['chlorid', 'cl-'] },
  { key: 'sulfat', label: 'Sulfat (Eluat)', unit: 'mg/l', art: 'eluat', aliases: ['sulfat', 'so4--'] },
  { key: 'fluorid', label: 'Fluorid (Eluat)', unit: 'mg/l', art: 'eluat', aliases: ['fluorid', 'fluoride', 'f-'] },
  { key: 'as_el', label: 'Arsen (As) – Eluat', unit: 'mg/l', art: 'eluat', aliases: ['arsen eluat'] },
  { key: 'pb_el', label: 'Blei (Pb) – Eluat', unit: 'mg/l', art: 'eluat', aliases: ['blei eluat'] },
  { key: 'cd_el', label: 'Cadmium (Cd) – Eluat', unit: 'mg/l', art: 'eluat', aliases: ['cadmium eluat'] },
  { key: 'cr6_el', label: 'Chrom(VI) – Eluat', unit: 'mg/l', art: 'eluat', aliases: ['chrom vi eluat', 'chrom(vi) eluat'] },
  { key: 'cr3_el', label: 'Chrom(III) – Eluat', unit: 'mg/l', art: 'eluat', aliases: ['chrom iii', 'chrom(iii)', 'cr(iii)', 'cr iii'] },
  { key: 'cu_el', label: 'Kupfer (Cu) – Eluat', unit: 'mg/l', art: 'eluat', aliases: ['kupfer eluat'] },
  { key: 'ni_el', label: 'Nickel (Ni) – Eluat', unit: 'mg/l', art: 'eluat', aliases: ['nickel eluat'] },
  { key: 'hg_el', label: 'Quecksilber (Hg) – Eluat', unit: 'mg/l', art: 'eluat', aliases: ['quecksilber eluat'] },
  { key: 'zn_el', label: 'Zink (Zn) – Eluat', unit: 'mg/l', art: 'eluat', aliases: ['zink eluat'] },
  { key: 'co_el', label: 'Kobalt (Co) – Eluat', unit: 'mg/l', art: 'eluat', aliases: ['kobalt eluat', 'cobalt eluat'] },
  { key: 'sn_el', label: 'Zinn (Sn) – Eluat', unit: 'mg/l', art: 'eluat', aliases: ['zinn eluat'] },
  { key: 'al_el', label: 'Aluminium – Eluat', unit: 'mg/l', art: 'eluat', aliases: ['aluminium'] },
  { key: 'ba_el', label: 'Barium – Eluat', unit: 'mg/l', art: 'eluat', aliases: ['barium'] },
  { key: 'nh4_el', label: 'Ammoniak/Ammonium – Eluat', unit: 'mg N/l', art: 'eluat', aliases: ['ammoniak', 'ammonium'] },
  { key: 'cnfrei_el', label: 'Cyanid, frei – Eluat', unit: 'mg CN/l', art: 'eluat', aliases: ['cyanid frei', 'cyanid, frei', 'cnf'] },
  { key: 'no2_el', label: 'Nitrit – Eluat', unit: 'mg/l', art: 'eluat', aliases: ['nitrit', 'nitrite'] },
  { key: 'so3_el', label: 'Sulfit – Eluat', unit: 'mg/l', art: 'eluat', aliases: ['sulfit', 'sulfite'] },
  { key: 's2_el', label: 'Sulfid – Eluat', unit: 'mg/l', art: 'eluat', aliases: ['sulfid', 'sulfide'] },
  { key: 'po4_el', label: 'Phosphat – Eluat', unit: 'mg P/l', art: 'eluat', aliases: ['phosphat'] },
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

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Findet einen Alias nur als eigenständiges Wort/Token (Wortgrenzen), nie als
// blossen Teilstring mitten in einem anderen Wort — sonst würde z.B. der
// Alias "ni" (Nickel) fälschlich in "Alumi-ni-um" oder "Ammo-ni-um" matchen.
function containsAliasAsToken(text, alias) {
  const re = new RegExp(`(^|[^a-zà-ÿ0-9])${escapeRegExp(alias)}($|[^a-zà-ÿ0-9])`, 'i');
  return re.test(text);
}

export function findParamByAlias(text, list = PARAMETERS) {
  const t = text.trim().toLowerCase().replace(/\s+/g, ' ');
  let best = null;
  for (const p of list) {
    for (const a of (p.aliases || [])) {
      if (t === a) return p; // exact match wins immediately
      if (containsAliasAsToken(t, a) && (!best || a.length > best._matchLen)) {
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

// Grenzwerte gemäss VVEA (gesamt in mg/kg TS, eluat in mg/l sofern nicht
// anders vermerkt). `null` = für diese Klasse nicht geregelt/nicht
// beschränkend. Typ D bewusst nicht erfasst (für Aushub-/Bodenmaterial i.d.R.
// nicht relevant).
export const DEMO_THRESHOLDS = {
  toc:      { unbelastet: null, typA: null,  typB: null,  typC: null,  typD: null, typE: null },
  toc400:   { unbelastet: null, typA: 10000, typB: 20000, typC: 20000, typD: null, typE: 50000 },
  kw:       { unbelastet: 50,   typA: 250,   typB: 500,   typC: 500,   typD: null, typE: 5000 },
  kw_c5:    { unbelastet: 1,    typA: 5,     typB: 10,    typC: 10,    typD: null, typE: 100 },
  pak:      { unbelastet: 3,    typA: 12.5,  typB: 25,    typC: 25,    typD: null, typE: 250 },
  bap:      { unbelastet: 0.3,  typA: 1.5,   typB: 3,     typC: 3,     typD: null, typE: 10 },
  pcb:      { unbelastet: 0.1,  typA: 0.5,   typB: 1,     typC: 1,     typD: null, typE: 10 },
  btex:     { unbelastet: 1,    typA: 5,     typB: 10,    typC: 10,    typD: null, typE: 100 },
  benzol:   { unbelastet: 0.1,  typA: 0.5,   typB: 1,     typC: 1,     typD: null, typE: 1 },
  sb:       { unbelastet: 3,    typA: 15,    typB: 30,    typC: null,  typD: null, typE: 50 },
  as:       { unbelastet: 15,   typA: 15,    typB: 30,    typC: null,  typD: null, typE: 50 },
  pb:       { unbelastet: 50,   typA: 250,   typB: 500,   typC: null,  typD: null, typE: 2000 },
  cd:       { unbelastet: 1,    typA: 5,     typB: 10,    typC: null,  typD: null, typE: 10 },
  cr:       { unbelastet: 50,   typA: 250,   typB: 500,   typC: null,  typD: null, typE: 1000 },
  cr6:      { unbelastet: 0.05, typA: 0.05,  typB: 0.1,   typC: null,  typD: null, typE: 0.5 },
  co:       { unbelastet: null, typA: null,  typB: 250,   typC: null,  typD: null, typE: null },
  cu:       { unbelastet: 40,   typA: 250,   typB: 500,   typC: null,  typD: null, typE: 5000 },
  ni:       { unbelastet: 50,   typA: 250,   typB: 500,   typC: null,  typD: null, typE: 1000 },
  hg:       { unbelastet: 0.5,  typA: 1,     typB: 2,     typC: null,  typD: null, typE: 5 },
  tl:       { unbelastet: null, typA: null,  typB: 3,     typC: null,  typD: null, typE: null },
  zn:       { unbelastet: 150,  typA: 500,   typB: 1000,  typC: null,  typD: null, typE: 5000 },
  sn:       { unbelastet: null, typA: null,  typB: 100,   typC: null,  typD: null, typE: null },
  cn:       { unbelastet: 0.5,  typA: null,  typB: null,  typC: null,  typD: null, typE: null },
  salze:    { unbelastet: null, typA: null,  typB: 0.5,   typC: 3,     typD: null, typE: 5 },
  pH:       { unbelastet: null, typA: null,  typB: null,  typC: null,  typD: null, typE: null },
  doc:      { unbelastet: null, typA: null,  typB: 20,    typC: 20,    typD: null, typE: null },
  leitf:    { unbelastet: null, typA: null,  typB: null,  typC: null,  typD: null, typE: null },
  chlorid:  { unbelastet: null, typA: null,  typB: null,  typC: null,  typD: null, typE: null },
  sulfat:   { unbelastet: null, typA: null,  typB: null,  typC: null,  typD: null, typE: null },
  fluorid:  { unbelastet: null, typA: null,  typB: 2,     typC: 10,    typD: null, typE: null },
  as_el:    { unbelastet: null, typA: null,  typB: null,  typC: 0.1,   typD: null, typE: null },
  pb_el:    { unbelastet: null, typA: null,  typB: null,  typC: 1,     typD: null, typE: null },
  cd_el:    { unbelastet: null, typA: null,  typB: null,  typC: 0.1,   typD: null, typE: null },
  cr6_el:   { unbelastet: null, typA: null,  typB: null,  typC: 0.1,   typD: null, typE: null },
  cr3_el:   { unbelastet: null, typA: null,  typB: null,  typC: 2,     typD: null, typE: null },
  cu_el:    { unbelastet: null, typA: null,  typB: null,  typC: 0.5,   typD: null, typE: null },
  ni_el:    { unbelastet: null, typA: null,  typB: null,  typC: 2,     typD: null, typE: null },
  hg_el:    { unbelastet: null, typA: null,  typB: null,  typC: 0.01,  typD: null, typE: null },
  zn_el:    { unbelastet: null, typA: null,  typB: null,  typC: 10,    typD: null, typE: null },
  co_el:    { unbelastet: null, typA: null,  typB: null,  typC: 0.5,   typD: null, typE: null },
  sn_el:    { unbelastet: null, typA: null,  typB: null,  typC: 2,     typD: null, typE: null },
  al_el:    { unbelastet: null, typA: null,  typB: null,  typC: 10,    typD: null, typE: null },
  ba_el:    { unbelastet: null, typA: null,  typB: null,  typC: 5,     typD: null, typE: null },
  nh4_el:   { unbelastet: null, typA: null,  typB: 0.5,   typC: 5,     typD: null, typE: null },
  cnfrei_el:{ unbelastet: null, typA: null,  typB: 0.02,  typC: 0.1,   typD: null, typE: 0.3 },
  no2_el:   { unbelastet: null, typA: null,  typB: 1,     typC: 1,     typD: null, typE: null },
  so3_el:   { unbelastet: null, typA: null,  typB: null,  typC: 1,     typD: null, typE: null },
  s2_el:    { unbelastet: null, typA: null,  typB: null,  typC: 0.1,   typD: null, typE: null },
  po4_el:   { unbelastet: null, typA: null,  typB: null,  typC: 10,    typD: null, typE: null },
};

// Hinweis: Grenzwerte & Parameterlisten (VVEA und VBBo) werden zentral
// gespeichert (Server bzw. simulierter Speicher der Test-Schale) und über
// api.js geladen/gespeichert, damit alle Benutzer:innen dieselbe
// Klassifizierung sehen. Die DEFAULT_*/DEMO_*-Exporte hier dienen nur als
// Fallback bzw. Reset-Vorlage.

export function hasAcknowledgedDisclaimer() {
  return localStorage.getItem(STORAGE_KEY_ACK) === '1';
}
export function acknowledgeDisclaimer() {
  localStorage.setItem(STORAGE_KEY_ACK, '1');
}

/**
 * Klassifiziert eine Probe anhand ihrer Analysewerte. Generisch für VVEA und
 * VBBo nutzbar — `classes` (Standard: VVEA CLASSES) und `params` (Standard:
 * VVEA PARAMETERS) bestimmen, welches Klassifizierungssystem angewendet wird.
 * @param {Array<{parameterKey:string, wert:number, art?:string}>} werte
 * @param {object} thresholds  Grenzwert-Set: {parameterKey: {classId: number|null}}
 * @param {Array} classes  geordnete Klassenliste (siehe CLASSES/VBBO_CLASSES)
 * @param {Array} params   Parameterliste für Label/Einheit-Anreicherung
 * @returns {{classId:string, classIndex:number, classInfo:object, perParameter:Array, unbewertet:Array}}
 */
// TOC (organischer Kohlenstoff) ist als Kriterium erst relevant, sobald die
// Probe aufgrund der übrigen Parameter bereits schlechter als Typ B
// eingestuft ist — bei Typ B oder besser fliesst der TOC-Wert nicht in die
// Gesamteinstufung ein (wird aber weiterhin zeilenweise angezeigt).
const TOC_KEYS = ['toc', 'toc400'];

export function classify(werte, thresholds, classes = CLASSES, params = PARAMETERS) {
  const perParameter = [];
  const unbewertet = [];
  const tocEntries = [];
  let worstIndex = 0;
  const typBIndex = classes.findIndex(c => c.id === 'typB');

  for (const w of werte) {
    const paramThresholds = thresholds[w.parameterKey];
    const paramDef = params.find(p => p.key === w.parameterKey);
    if (!paramThresholds || w.wert === null || w.wert === undefined || Number.isNaN(w.wert)) {
      unbewertet.push(w);
      continue;
    }
    const anyLimitDefined = classes.some(c => paramThresholds[c.id] !== null && paramThresholds[c.id] !== undefined);
    if (!anyLimitDefined) {
      unbewertet.push(w);
      continue;
    }

    let matchedIndex = classes.findIndex(c => c.terminal); // default: strengste/letzte Stufe
    for (let i = 0; i < classes.length; i++) {
      const c = classes[i];
      if (c.terminal) continue;
      const limit = paramThresholds[c.id];
      if (limit === null || limit === undefined) continue; // nicht geregelt auf dieser Stufe -> weiterprüfen
      if (w.wert <= limit) {
        matchedIndex = i;
        break;
      }
    }
    const entry = {
      ...w,
      label: paramDef ? paramDef.label : w.parameterKey,
      unit: paramDef ? paramDef.unit : '',
      classIndex: matchedIndex,
      classId: classes[matchedIndex].id,
      color: classes[matchedIndex].color,
    };
    perParameter.push(entry);

    if (typBIndex >= 0 && TOC_KEYS.includes(w.parameterKey)) {
      // Erst am Schluss (siehe unten) berücksichtigen, falls die übrige
      // Einstufung bereits über Typ B liegt.
      tocEntries.push(entry);
      continue;
    }
    if (matchedIndex > worstIndex) worstIndex = matchedIndex;
  }

  if (tocEntries.length && worstIndex > typBIndex) {
    for (const entry of tocEntries) {
      if (entry.classIndex > worstIndex) worstIndex = entry.classIndex;
    }
  }

  return {
    classId: classes[worstIndex].id,
    classIndex: worstIndex,
    classInfo: classes[worstIndex],
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
    let existing = findParamByAlias(nameRaw);
    const art = /eluat/i.test(artRaw) ? 'eluat' : (/gesamt/i.test(artRaw) ? 'gesamt' : (existing ? existing.art : 'gesamt'));
    // Ein Namens-Treffer zählt nur, wenn auch die Art (Gesamt/Eluat) übereinstimmt
    // — sonst würde z.B. "Blei (Pb) – Eluat" denselben Schlüssel wie das
    // bestehende Gesamtgehalt-"Blei (Pb)" bekommen und dessen Werte überschreiben.
    if (existing && existing.art !== art) existing = null;
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
