// vvea.js
// Klassifizierungs-Engine für Deponieklassen (VVEA) und Bodenqualität (VBBo).
//
// WICHTIG: Die hinterlegten Zahlenwerte stammen aus vom Nutzer bereitgestellten
// Quellen (eigene Recherche/Auszüge, Stand siehe README). Vor produktivem
// Einsatz müssen die Grenzwerte von einer Fachperson anhand der aktuellen
// VVEA/VBBo und kantonaler Vollzugshilfen geprüft werden – siehe
// Einstellungen > Grenzwerte.

// v4: Typ-D-Grenzwert bei Schwermetallen wieder entfernt (führte dazu, dass
// Typ E nie erreicht wurde) — bei Metallen gilt grundsätzlich Typ E, bei
// organischen Schadstoffen bleibt Typ D = Typ B. Version angehoben, damit
// bestehende Installationen die korrigierten Werte erhalten.
export const STORAGE_KEY_THRESHOLDS = 'pnj_vvea_thresholds_v4';
export const STORAGE_KEY_PARAMETERS = 'pnj_vvea_parameters_v2';
export const STORAGE_KEY_VBBO_THRESHOLDS = 'pnj_vbbo_thresholds_v1';
export const STORAGE_KEY_VBBO_PARAMETERS = 'pnj_vbbo_parameters_v1';
// v2: Codes können jetzt für mehrere Materialien/Klassen gleichzeitig gelten
// (materialien/klassen-Arrays statt material/klasse-Einzelwerten) — Version
// angehoben, damit bestehende Installationen die neue Struktur erhalten.
export const STORAGE_KEY_VEVA_CODES = 'pnj_veva_codes_v2';
export const STORAGE_KEY_ANALYTIK_PROGRAMME = 'pnj_analytik_programme_v1';
export const STORAGE_KEY_MATERIALIEN = 'pnj_materialien_v1';
export const STORAGE_KEY_LABORE = 'pnj_labore_v1';
export const STORAGE_KEY_ACK = 'pnj_vvea_disclaimer_ack_v1';

// ---------- VVEA (Deponieklassen) ----------

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

export const VBBO_CLASSES = [
  { id: 'unauffaellig', label: 'Unauffällig (unter Richtwert)', short: 'Unauffällig', color: '#2e7d32' },
  { id: 'ueberRichtwert', label: 'Über Richtwert, unter Prüfwert – Beobachtung empfohlen', short: 'Über Richtwert', color: '#fbc02d' },
  { id: 'ueberPruefwert', label: 'Über Prüfwert – weitere Abklärung/Nutzungseinschränkung nötig', short: 'Über Prüfwert', color: '#ef6c00' },
  { id: 'ueberSanierungswert', label: 'Über Sanierungswert – Sanierung nötig', short: 'Sanierungsbedarf', color: '#b71c1c', terminal: true },
];

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
export function loadVbboParameters() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_VBBO_PARAMETERS);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* fällt auf Standardliste zurück */ }
  return DEFAULT_VBBO_PARAMETERS.map(p => ({ ...p }));
}
export function saveVbboParameters(list) {
  localStorage.setItem(STORAGE_KEY_VBBO_PARAMETERS, JSON.stringify(list));
}
export function resetVbboParametersStorage() {
  localStorage.removeItem(STORAGE_KEY_VBBO_PARAMETERS);
  return DEFAULT_VBBO_PARAMETERS.map(p => ({ ...p }));
}

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
export function loadVbboThresholds() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_VBBO_THRESHOLDS);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* fall through */ }
  return JSON.parse(JSON.stringify(DEFAULT_VBBO_THRESHOLDS));
}
export function saveVbboThresholds(t) {
  localStorage.setItem(STORAGE_KEY_VBBO_THRESHOLDS, JSON.stringify(t));
}
export function resetVbboThresholdsStorage() {
  localStorage.removeItem(STORAGE_KEY_VBBO_THRESHOLDS);
}

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
    };
  }
  return out;
}

export function classifyVBBO(werte, vbboThresholds, nutzungsart) {
  const projected = buildVbboThresholdsForNutzung(vbboThresholds, nutzungsart);
  return classify(werte, projected, VBBO_CLASSES, VBBO_PARAMETERS);
}

// ---------- VeVA-Codes (Aushub-/Bodenaushubmaterial) ----------

// Ein Code kann für mehrere Materialien und/oder mehrere VVEA-Klassen
// gleichzeitig gelten — daher `materialien`/`klassen` als Arrays statt
// Einzelwerten. Kapitel 17 05 der offiziellen Abfallliste
// (veva-online.admin.ch); nur die reinen Erdstoff-Kategorien.
//
// Kontroll-Stufen gemäss offizieller Abfallliste (bestätigt anhand eines
// Screenshots von veva-online.admin.ch, Kapitel 17 05):
//   17 05 04/06        unbelastet/unverschmutzt (keine Kennzeichnung)
//   17 05 93/94         schwach belastet/verschmutzt = Typ A (keine Kennzeichnung)
//   17 05 96/97 [ak]     wenig belastet/verschmutzt = Typ B ("andere
//                        kontrollpflichtige Abfälle", jährliche Meldung,
//                        kein Begleitschein)
//   17 05 90/91 [akb]    stark belastet/verschmutzt = Typ C/D/E ("andere
//                        kontrollpflichtige Abfälle mit Begleitscheinpflicht"
//                        — ausdrücklich "mit Ausnahme desjenigen, der/das
//                        unter 17 05 03/05 fällt", schliesst sich also mit
//                        dem Sonderabfall-Code gegenseitig aus)
//   17 05 03/05 [S]      durch gefährliche Stoffe verunreinigt = Sonderabfall
//                        (gemäss Originaltext explizit NICHT dasselbe wie
//                        "stark belastet [akb]") -> Klasse "sonderfall"
//                        (nicht deponierbar, jenseits Typ E)
export const DEFAULT_VEVA_CODES = [
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
export function loadVevaCodes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_VEVA_CODES);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* fall through */ }
  return DEFAULT_VEVA_CODES.map(c => ({ ...c }));
}
export function saveVevaCodes(list) {
  localStorage.setItem(STORAGE_KEY_VEVA_CODES, JSON.stringify(list));
}
export function resetVevaCodesStorage() {
  localStorage.removeItem(STORAGE_KEY_VEVA_CODES);
  return DEFAULT_VEVA_CODES.map(c => ({ ...c }));
}

// ---------- Analytik-Programme ----------

// Benannte Zusammenstellungen von Analyseparametern, die bei einer Probe
// ausgewählt werden können ("welche Analysen sollen ausgelöst werden") —
// parameterKeys referenzieren die Parameter-Keys aus PARAMETERS (VVEA) bzw.
// VBBO_PARAMETERS (VBBo). Eine Probe kann mehrere Programme gleichzeitig
// auswählen; die Parameter aller gewählten Programme werden dann als leere
// Zeilen in die Analysewerte-Tabelle übernommen. Dies ist nur eine
// Startauswahl — weitere Programme können unter Einstellungen ergänzt werden.
export const DEFAULT_ANALYTIK_PROGRAMME = [
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
export function loadAnalytikProgramme() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ANALYTIK_PROGRAMME);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* fall through */ }
  return DEFAULT_ANALYTIK_PROGRAMME.map(p => ({ ...p, parameterKeys: [...p.parameterKeys] }));
}
export function saveAnalytikProgramme(list) {
  localStorage.setItem(STORAGE_KEY_ANALYTIK_PROGRAMME, JSON.stringify(list));
}
export function resetAnalytikProgrammeStorage() {
  localStorage.removeItem(STORAGE_KEY_ANALYTIK_PROGRAMME);
  return DEFAULT_ANALYTIK_PROGRAMME.map(p => ({ ...p, parameterKeys: [...p.parameterKeys] }));
}

// ---------- Materialien (zentral gepflegte Material-Datenbank) ----------

// Material wird nicht mehr frei eingetippt, sondern aus dieser (unter
// Einstellungen > Materialien pflegbaren) Liste gewählt. Jeder Eintrag legt
// fest, welcher Einstufungsstandard (VVEA/VBBo) gilt und welchem
// VeVA-Aushubcode-„Eimer" (materialToVevaBucket) das Material zugeordnet ist
// — damit stehen Standard und VeVA-Code für jede Probe eindeutig fest,
// sobald das Material gewählt ist, und müssen im Formular nicht mehr
// manuell überschrieben werden. `vevaBucket`: '' = Material erhält bewusst
// keinen VeVA-Aushubcode (z.B. Mischabbruch, Betonabbruch — dafür gibt es
// keine VeVA-Aushubcodes in der Liste).
export const DEFAULT_MATERIALIEN = [
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
export function loadMaterialien() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MATERIALIEN);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* fall through */ }
  return DEFAULT_MATERIALIEN.map(m => ({ ...m }));
}
export function saveMaterialien(list) {
  localStorage.setItem(STORAGE_KEY_MATERIALIEN, JSON.stringify(list));
}
export function resetMaterialienStorage() {
  localStorage.removeItem(STORAGE_KEY_MATERIALIEN);
  return DEFAULT_MATERIALIEN.map(m => ({ ...m }));
}

// ---------- Labore (Analysenauftrag per E-Mail) ----------

// email/adresse/telefon bewusst leer: die App erfindet keine Kontaktdaten
// für echte Firmen, diese müssen vor der ersten Nutzung ergänzt werden. Auch
// Namen/Schreibweise vor produktivem Einsatz verifizieren.
export const DEFAULT_LABORE = [
  { id: 'bachema', name: 'Bachema AG', ort: 'Schlieren', email: '', adresse: '', telefon: '' },
  { id: 'nuitec', name: 'Nuitec', ort: 'Winterthur', email: '', adresse: '', telefon: '' },
  { id: 'eurofins', name: 'Eurofins', ort: 'Deutschland', email: '', adresse: '', telefon: '' },
];
export function loadLabore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LABORE);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* fall through */ }
  return DEFAULT_LABORE.map(l => ({ ...l }));
}
export function saveLabore(list) {
  localStorage.setItem(STORAGE_KEY_LABORE, JSON.stringify(list));
}
export function resetLaboreStorage() {
  localStorage.removeItem(STORAGE_KEY_LABORE);
  return DEFAULT_LABORE.map(l => ({ ...l }));
}

export function findMaterial(materialName, materialien) {
  if (!materialName || !Array.isArray(materialien)) return null;
  return materialien.find(m => m.name === materialName) || null;
}

// ---------- VeVA-Code-Zuteilung (automatisch) ----------

// Liefert den VeVA-Aushubcode-„Eimer" (z.B. "Oberboden"/"Unterboden"/
// "Aushub") des gewählten Materials, oder `null`, wenn das Material nicht
// (mehr) in der Liste steht oder bewusst keinem Eimer zugeordnet ist.
export function materialToVevaBucket(material, materialien) {
  const m = findMaterial(material, materialien);
  return (m && m.vevaBucket) ? m.vevaBucket : null;
}

// Der Standard (VVEA/VBBo) wird nicht manuell gewählt, sondern direkt aus
// dem in der Materialien-Liste hinterlegten Standard des gewählten Materials
// abgeleitet. Unbekanntes/nicht (mehr) in der Liste stehendes Material fällt
// auf VVEA zurück (der weitaus häufigere Fall).
export function materialToStandard(material, materialien) {
  const m = findMaterial(material, materialien);
  return (m && m.standard === 'vbbo') ? 'vbbo' : 'vvea';
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
 * classify()/classifyVBBO()). Ein Code kann gleichzeitig für mehrere
 * Materialien und/oder mehrere VVEA-Klassen gelten (z.B. ein gemeinsamer
 * Code für Typ C/D/E, oder derselbe Code für Ober- und Unterboden), daher
 * werden `materialien`/`klassen`-Arrays je Code geprüft. Gibt den
 * passenden Eintrag aus `vevaCodes` zurück (mit `code`/`bezeichnung`) oder
 * `null`, wenn nichts passt (z.B. Material ist keinem VeVA-Eimer zugeordnet,
 * oder noch keine Einstufung vorhanden). `materialien` ist die zentral
 * gepflegte Materialien-Liste (siehe materialToVevaBucket() oben).
 */
export function suggestVevaCode(material, standard, classId, vevaCodes, materialien) {
  if (!classId || !Array.isArray(vevaCodes)) return null;
  const bucket = materialToVevaBucket(material, materialien);
  if (!bucket) return null;
  const candidates = vevaCodes.filter(c => Array.isArray(c.materialien) && c.materialien.includes(bucket));
  if (!candidates.length) return null;

  if (standard === 'vbbo') {
    const klasse = VBBO_TO_VEVA_KLASSE[classId];
    if (!klasse) return null;
    return candidates.find(c => Array.isArray(c.klassen) && c.klassen.includes(klasse)) || null;
  }

  // VVEA: exakte Klasse zuerst versuchen (deckt auch Codes ab, die mehrere
  // Klassen gleichzeitig abdecken, z.B. klassen:['typC','typD','typE']).
  const exact = candidates.find(c => Array.isArray(c.klassen) && c.klassen.includes(classId));
  if (exact) return exact;

  // Kein exakter Treffer: bei den (nicht-terminalen) Klassen abwärts zur
  // nächstschwächeren noch codierten Klasse fallen, falls vorhanden.
  // "Sonderfall" (Sonderabfall) bekommt bewusst KEINEN automatischen
  // Fallback, da dafür eigene Sonderabfall-Codes nötig sind.
  const idx = CLASSES.findIndex(c => c.id === classId);
  if (idx <= 0 || CLASSES[idx].terminal) return null;
  for (let i = idx - 1; i >= 0; i--) {
    const found = candidates.find(c => Array.isArray(c.klassen) && c.klassen.includes(CLASSES[i].id));
    if (found) return found;
  }
  return null;
}

// ---------- Parameter (VVEA) ----------

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

export let PARAMETERS = DEFAULT_PARAMETERS.map(p => ({ ...p }));
export function setParameters(list) {
  PARAMETERS = Array.isArray(list) && list.length ? list : DEFAULT_PARAMETERS.map(p => ({ ...p }));
}
export function loadParameters() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PARAMETERS);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* fällt auf Standardliste zurück */ }
  return DEFAULT_PARAMETERS.map(p => ({ ...p }));
}
export function saveParameters(list) {
  localStorage.setItem(STORAGE_KEY_PARAMETERS, JSON.stringify(list));
}
export function resetParametersStorage() {
  localStorage.removeItem(STORAGE_KEY_PARAMETERS);
  return DEFAULT_PARAMETERS.map(p => ({ ...p }));
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function containsAliasAsToken(text, alias) {
  const re = new RegExp(`(^|[^a-zà-ÿ0-9])${escapeRegExp(alias)}($|[^a-zà-ÿ0-9])`, 'i');
  return re.test(text);
}

export function findParamByAlias(text, list = PARAMETERS) {
  const t = text.trim().toLowerCase().replace(/\s+/g, ' ');
  let best = null;
  for (const p of list) {
    for (const a of (p.aliases || [])) {
      if (t === a) return p;
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
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24) || 'parameter';
  let key = base;
  let i = 2;
  while (existingKeys.has(key)) { key = `${base}_${i}`; i++; }
  return key;
}

// Typ D war in den Quelldaten für keinen Parameter separat erfasst; auf
// Anweisung des Auftraggebers als Näherung ergänzt: bei organischen
// Schadstoffen = Wert von Typ B. Für Feststoff-Schwermetalle gibt es
// dagegen bewusst KEINEN eigenen Typ-D-Grenzwert: bei erhöhten
// Feststoffgehalten der Metalle ist gemäss Auftraggeber grundsätzlich
// Typ E einzustufen (nicht Typ D) — siehe METAL_GESAMT_KEYS /
// METAL_ELUAT_KEYS und die Sonderfall->Typ-C-Rückstufung in classify()
// weiter unten.
export const DEMO_THRESHOLDS = {
  toc:      { unbelastet: null, typA: null,  typB: null,  typC: null,  typD: null,  typE: null },
  toc400:   { unbelastet: null, typA: 10000, typB: 20000, typC: 20000, typD: 20000, typE: 50000 },
  kw:       { unbelastet: 50,   typA: 250,   typB: 500,   typC: 500,   typD: 500,   typE: 5000 },
  kw_c5:    { unbelastet: 1,    typA: 5,     typB: 10,    typC: 10,    typD: 10,    typE: 100 },
  pak:      { unbelastet: 3,    typA: 12.5,  typB: 25,    typC: 25,    typD: 25,    typE: 250 },
  bap:      { unbelastet: 0.3,  typA: 1.5,   typB: 3,     typC: 3,     typD: 3,     typE: 10 },
  pcb:      { unbelastet: 0.1,  typA: 0.5,   typB: 1,     typC: 1,     typD: 1,     typE: 10 },
  btex:     { unbelastet: 1,    typA: 5,     typB: 10,    typC: 10,    typD: 10,    typE: 100 },
  benzol:   { unbelastet: 0.1,  typA: 0.5,   typB: 1,     typC: 1,     typD: 1,     typE: 1 },
  sb:       { unbelastet: 3,    typA: 15,    typB: 30,    typC: null,  typD: null,  typE: 50 },
  as:       { unbelastet: 15,   typA: 15,    typB: 30,    typC: null,  typD: null,  typE: 50 },
  pb:       { unbelastet: 50,   typA: 250,   typB: 500,   typC: null,  typD: null,  typE: 2000 },
  cd:       { unbelastet: 1,    typA: 5,     typB: 10,    typC: null,  typD: null,  typE: 10 },
  cr:       { unbelastet: 50,   typA: 250,   typB: 500,   typC: null,  typD: null,  typE: 1000 },
  cr6:      { unbelastet: 0.05, typA: 0.05,  typB: 0.1,   typC: null,  typD: null,  typE: 0.5 },
  co:       { unbelastet: null, typA: null,  typB: 250,   typC: null,  typD: null,  typE: null },
  cu:       { unbelastet: 40,   typA: 250,   typB: 500,   typC: null,  typD: null,  typE: 5000 },
  ni:       { unbelastet: 50,   typA: 250,   typB: 500,   typC: null,  typD: null,  typE: 1000 },
  hg:       { unbelastet: 0.5,  typA: 1,     typB: 2,     typC: null,  typD: null,  typE: 5 },
  tl:       { unbelastet: null, typA: null,  typB: 3,     typC: null,  typD: null,  typE: null },
  zn:       { unbelastet: 150,  typA: 500,   typB: 1000,  typC: null,  typD: null,  typE: 5000 },
  sn:       { unbelastet: null, typA: null,  typB: 100,   typC: null,  typD: null,  typE: null },
  cn:       { unbelastet: 0.5,  typA: null,  typB: null,  typC: null,  typD: null,  typE: null },
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

export function loadThresholds() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_THRESHOLDS);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* fall through to default */ }
  return JSON.parse(JSON.stringify(DEMO_THRESHOLDS));
}
export function saveThresholds(thresholds) {
  localStorage.setItem(STORAGE_KEY_THRESHOLDS, JSON.stringify(thresholds));
}
export function resetThresholds() {
  localStorage.removeItem(STORAGE_KEY_THRESHOLDS);
}

export function hasAcknowledgedDisclaimer() {
  return localStorage.getItem(STORAGE_KEY_ACK) === '1';
}
export function acknowledgeDisclaimer() {
  localStorage.setItem(STORAGE_KEY_ACK, '1');
}

/**
 * Klassifiziert eine Probe anhand ihrer Analysewerte. Generisch für VVEA und
 * VBBo nutzbar — `classes`/`params` bestimmen das Klassifizierungssystem.
 */
// TOC (organischer Kohlenstoff) ist als Kriterium erst relevant, sobald die
// Probe aufgrund der übrigen Parameter bereits schlechter als Typ B
// eingestuft ist — bei Typ B oder besser fliesst der TOC-Wert nicht in die
// Gesamteinstufung ein (wird aber weiterhin zeilenweise angezeigt).
const TOC_KEYS = ['toc', 'toc400'];

// Schwermetalle: Feststoffgehalt (Gesamtgehalt) treibt die Einstufung
// grundsätzlich auf Typ E (kein eigener Typ-D-Grenzwert, siehe
// DEMO_THRESHOLDS oben). Übersteigt der Feststoffgehalt auch den
// Typ-E-Grenzwert, landet die Probe zunächst im Sonderfall — kann aber auf
// Typ C heruntergestuft werden (typischer Praxisfall: Aushub mit hohem
// Schwermetall-Feststoffgehalt, aber tiefen organischen Schadstoffen, wird
// durch Immobilisierung so behandelt, dass die Eluatwerte Typ-C-tauglich
// sind — spart die teure Sonderabfall-/Auslandentsorgung), wenn ALLE
// folgenden Bedingungen erfüllt sind:
// - keiner der erfassten organischen Feststoffwerte (inkl. TOC/TOC400)
//   liegt selbst im Sonderfall-Bereich (Typ C ist gemäss VVEA Anhang 5
//   Ziff. 3 nur für Abfälle mit vorgängig zurückgewonnenen/immobilisierten
//   Metallen bei gleichzeitig tiefem Organikagehalt zugelassen);
// - eine Eluatprüfung (i.d.R. nach einer Behandlung/Stabilisierung) für
//   die Schwermetalle liegt vor und ALLE erfassten Eluat-Metallwerte
//   halten den Typ-C-Grenzwert ein.
// Liegt keine (vollständig unauffällige) Eluatprüfung vor oder sind auch
// die organischen Schadstoffe zu hoch, bleibt es beim Sonderfall.
const METAL_GESAMT_KEYS = ['sb', 'as', 'pb', 'cd', 'cr', 'cr6', 'co', 'cu', 'ni', 'hg', 'tl', 'zn', 'sn'];
const METAL_ELUAT_KEYS = ['as_el', 'pb_el', 'cd_el', 'cr6_el', 'cr3_el', 'cu_el', 'ni_el', 'hg_el', 'zn_el', 'co_el', 'sn_el'];
const ORGANIC_GESAMT_KEYS = ['toc', 'toc400', 'kw', 'kw_c5', 'pak', 'bap', 'pcb', 'btex', 'benzol'];

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

    let matchedIndex = classes.findIndex(c => c.terminal);
    for (let i = 0; i < classes.length; i++) {
      const c = classes[i];
      if (c.terminal) continue;
      const limit = paramThresholds[c.id];
      if (limit === null || limit === undefined) continue;
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

  // Sonderfall wegen zu hoher Feststoff-Metallwerte -> Rückstufung auf Typ C
  // prüfen (siehe Kommentar bei METAL_GESAMT_KEYS/METAL_ELUAT_KEYS oben).
  const typCIndex = classes.findIndex(c => c.id === 'typC');
  const sonderfallIndex = classes.findIndex(c => c.id === 'sonderfall');
  if (worstIndex === sonderfallIndex && typCIndex >= 0) {
    const sonderfallEntries = perParameter.filter(p => p.classIndex === sonderfallIndex);
    const causedByMetalGesamt = sonderfallEntries.some(p => METAL_GESAMT_KEYS.includes(p.parameterKey));
    const causedByOrganicGesamt = sonderfallEntries.some(p => ORGANIC_GESAMT_KEYS.includes(p.parameterKey));
    if (causedByMetalGesamt && !causedByOrganicGesamt) {
      const metalEluatEntries = perParameter.filter(p => METAL_ELUAT_KEYS.includes(p.parameterKey));
      if (metalEluatEntries.length && metalEluatEntries.every(p => p.classIndex <= typCIndex)) {
        worstIndex = typCIndex;
      }
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
    if (existing && existing.art !== art) existing = null;
    const unit = unitRaw || (existing ? existing.unit : '');
    const values = {};
    for (const { classId, col } of classCols) {
      values[classId] = col >= 0 ? parseThresholdNumber(cells[col]) : null;
    }
    const isNew = !existing;
    const key = existing ? existing.key : slugifyParamKey(nameRaw, existingKeys);
    if (isNew) existingKeys.add(key);
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
