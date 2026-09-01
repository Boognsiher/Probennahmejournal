// Server-seitige Kopie der Klassifizierungsdaten (VVEA + VBBo), mit der die
// Datenbank beim allerersten Start vorbefüllt wird (danach über die App unter
// "Einstellungen" durch eine Fachperson editierbar).
// Muss inhaltlich mit public/js/vvea.js übereinstimmen.
//
// DEMO_THRESHOLDS (VVEA-Deponietypen, Aushub-/Ausbruchmaterial) sind gegen den
// offiziellen Verordnungstext abgeglichen (VVEA Anhang 3 Ziff. 1/2 und Anhang 5
// Ziff. 2.3/3/4.4/5.2, Stand 1. August 2026 — Fassung vom Nutzer bereitgestellt).
// "unbelastet" und "typA" sind bewusst identisch: Deponietyp A lässt gemäss
// Art. 19 Abs. 1 i.V.m. Anhang 5 Ziff. 1 VVEA ausschliesslich unverschmutztes
// Material (Anhang 3 Ziff. 1) zu, es gibt dafür keinen eigenen, grosszügigeren
// Grenzwert. "typB" verwendet die grosszügigeren Anhang-5-Ziff.-2.3-Werte
// ("andere Abfälle"), nicht die engeren Anhang-3-Ziff.-2-Werte für reines
// Aushubmaterial — Typ B nimmt beide Pfade auf, der Ziff.-2.3-Wert ist daher
// die praktisch massgebliche Obergrenze. "typC" hat bewusst keine
// Feststoff-Grenzwerte (nur die *_el-Eluatparameter, Anhang 5 Ziff. 3.2/3.4) —
// die Zulassung zu Typ C erfolgt eluatbasiert (behandeltes/immobilisiertes
// Material), nicht über den Gesamtgehalt. Für Cobalt, Thallium und Zinn nennt
// die VVEA für Aushub-/Ausbruchmaterial keinen Feststoff-Grenzwert (nur
// Cobalt zusätzlich eluatbasiert für Typ C, siehe co_el) — frühere Platzhalter
// hier stammten irrtümlich aus Anhang 4 (Zementwerk-Grenzwerte, ein anderer
// Verwendungszweck) und wurden entfernt.
//
// WICHTIG: VBBo-Werte (Bodenqualität) und alle übrigen Parameter/Materialien
// stammen weiterhin aus vom Nutzer bereitgestellten Quellen (u.a. eigene
// Recherche "grenzwerte.swiss"/Master-Tabelle, Stand 14.08.2026;
// Tabelle_Grenzwerte.pdf für die VeVA-Codes). Trotzdem gilt: vor produktivem
// Einsatz durch eine Fachperson gegen die aktuelle VVEA/VBBo und kantonale
// Vollzugshilfen verifizieren.

export const CLASSES = [
  { id: 'unbelastet', label: 'Unbelastet / Verwertung möglich', short: 'Verwertung', color: '#2e7d32' },
  { id: 'typA', label: 'Deponietyp A (Aushubdeponie)', short: 'Typ A', color: '#66bb6a' },
  { id: 'typB', label: 'Deponietyp B (Inertstoffdeponie)', short: 'Typ B', color: '#29b6f6' },
  { id: 'typC', label: 'Deponietyp C (Reststoffdeponie)', short: 'Typ C', color: '#ffa726' },
  { id: 'typD', label: 'Deponietyp D (Reaktordeponie)', short: 'Typ D', color: '#ef5350' },
  { id: 'typE', label: 'Deponietyp E (Reaktordeponie)', short: 'Typ E', color: '#b71c1c' },
  { id: 'sonderfall', label: 'Nicht deponierbar / Sonderabfall – Fachperson beiziehen', short: 'Sonderfall', color: '#4a148c', terminal: true },
];

// VBBo (Bodenschutz) — eigenständige 4-Stufen-Skala, unabhängig von VVEA.
// Kat. I/II/IIIa/IIIb: gebräuchliche Entsorgungspraxis-Bezeichnung für die
// vier VBBo-Belastungsstufen (unter Richtwert / Richtwert-Prüfwert /
// Prüfwert-Sanierungswert / über Sanierungswert) — die VBBo selbst kennt nur
// Richt-, Prüf- und Sanierungswert als Zahlenwerte, keine eigene "Kat."
// Nummerierung; die Zuordnung folgt der auch für die VeVA-Aushubcodes
// verwendeten Einstufung (siehe VBBO_TO_VEVA_KLASSE in public/js/vvea.js).
export const VBBO_CLASSES = [
  { id: 'unauffaellig', label: 'Unbelastet (Kat. I) – unter Richtwert', short: 'Kat. I', color: '#2e7d32' },
  { id: 'ueberRichtwert', label: 'Schwach belastet (Kat. II) – über Richtwert, unter Prüfwert', short: 'Kat. II', color: '#fbc02d' },
  { id: 'ueberPruefwert', label: 'Stark belastet (Kat. IIIa) – über Prüfwert, unter Sanierungswert', short: 'Kat. IIIa', color: '#ef6c00' },
  { id: 'ueberSanierungswert', label: 'Stark belastet (Kat. IIIb) – über Sanierungswert, Sanierung nötig', short: 'Kat. IIIb', color: '#b71c1c', terminal: true },
];

export const NUTZUNGSARTEN = [
  { id: 'spielplatz', label: 'Kinderspielplatz', pruefwertSpalte: 'pwDirekt', sanierungSpalte: 'sanSpielplatz' },
  { id: 'garten', label: 'Haus-/Familiengarten', pruefwertSpalte: 'pwNahrung', sanierungSpalte: 'sanGarten' },
  { id: 'landwirtschaft', label: 'Landwirtschaft/Gartenbau', pruefwertSpalte: 'pwFutter', sanierungSpalte: 'sanLandwirtschaft' },
];

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

// Grenzwerte gemäss VVEA (Verwertung=unbelastet, Typ A/B/C/D/E). Typ D war
// in den Quelldaten für keinen Parameter separat erfasst; auf Anweisung des
// Auftraggebers als Näherung ergänzt: bei organischen Schadstoffen = Wert
// von Typ B. Für Feststoff-Schwermetalle gibt es dagegen bewusst KEINEN
// eigenen Typ-D-Grenzwert: bei erhöhten Feststoffgehalten der Metalle ist
// gemäss Auftraggeber grundsätzlich Typ E einzustufen (nicht Typ D). Die
// dazugehörige Sonderfall->Typ-C-Rückstufung (Eluatprüfung nach Behandlung)
// ist client-seitig in public/js/vvea.js bzw. shell/js/vvea.js implementiert
// (classify() / METAL_GESAMT_KEYS / METAL_ELUAT_KEYS) — der Server liefert
// hier nur die Grenzwert-Rohdaten, die Klassifizierung läuft im Browser.
export const DEMO_THRESHOLDS = {
  toc:      { unbelastet: null, typA: null,  typB: null,  typC: null,  typD: null,  typE: null },
  toc400:   { unbelastet: null, typA: null,  typB: 20000, typC: 20000, typD: 20000, typE: 50000 },
  kw:       { unbelastet: 50,   typA: 50,    typB: 500,   typC: 500,   typD: 500,   typE: 5000 },
  kw_c5:    { unbelastet: 1,    typA: 1,     typB: 10,    typC: 10,    typD: 10,    typE: 100 },
  pak:      { unbelastet: 3,    typA: 3,     typB: 25,    typC: 25,    typD: 25,    typE: 250 },
  bap:      { unbelastet: 0.3,  typA: 0.3,   typB: 3,     typC: 3,     typD: 3,     typE: 10 },
  pcb:      { unbelastet: 0.1,  typA: 0.1,   typB: 1,     typC: 1,     typD: 1,     typE: 10 },
  btex:     { unbelastet: 1,    typA: 1,     typB: 10,    typC: 10,    typD: 10,    typE: 100 },
  benzol:   { unbelastet: 0.1,  typA: 0.1,   typB: 1,     typC: 1,     typD: 1,     typE: 1 },
  sb:       { unbelastet: 3,    typA: 3,     typB: 30,    typC: null,  typD: 50,    typE: 50 },
  as:       { unbelastet: 15,   typA: 15,    typB: 30,    typC: null,  typD: 50,    typE: 50 },
  pb:       { unbelastet: 50,   typA: 50,    typB: 500,   typC: null,  typD: 2000,  typE: 2000 },
  cd:       { unbelastet: 1,    typA: 1,     typB: 10,    typC: null,  typD: 10,    typE: 10 },
  cr:       { unbelastet: 50,   typA: 50,    typB: 500,   typC: null,  typD: 1000,  typE: 1000 },
  cr6:      { unbelastet: 0.05, typA: 0.05,  typB: 0.1,   typC: null,  typD: 0.5,   typE: 0.5 },
  co:       { unbelastet: null, typA: null,  typB: null,  typC: null,  typD: null,  typE: null },
  cu:       { unbelastet: 40,   typA: 40,    typB: 500,   typC: null,  typD: 5000,  typE: 5000 },
  ni:       { unbelastet: 50,   typA: 50,    typB: 500,   typC: null,  typD: 1000,  typE: 1000 },
  hg:       { unbelastet: 0.5,  typA: 0.5,   typB: 2,     typC: null,  typD: 5,     typE: 5 },
  tl:       { unbelastet: null, typA: null,  typB: null,  typC: null,  typD: null,  typE: null },
  zn:       { unbelastet: 150,  typA: 150,   typB: 1000,  typC: null,  typD: 5000,  typE: 5000 },
  sn:       { unbelastet: null, typA: null,  typB: null,  typC: null,  typD: null,  typE: null },
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

// VBBo (Bodenschutzverordnung) — Substanzliste getrennt von der VVEA-Liste
// (andere Regelungsebene: Bodenqualität statt Deponie-Annahmekriterien).
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

// Rohwerte je Substanz: richtwert, pwDirekt/pwNahrung/pwFutter (Prüfwerte),
// sanSpielplatz/sanGarten/sanLandwirtschaft (Sanierungswerte). null = nicht
// geregelt/keine Angabe in der Quelle.
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

// Materialien-Datenbank: legt für jede auf der Baustelle vorkommende
// Material-Kategorie fest, welcher Einstufungsstandard (VVEA/VBBo) gilt und
// welchem VeVA-Aushubcode-„Eimer" (siehe `materialien`-Feld bei
// DEFAULT_VEVA_CODES unten) sie zugeordnet ist. Ersetzt die frühere freie
// Texteingabe bei der Probe: Das Material wird jetzt aus dieser (unter
// Einstellungen von einer Administrationsperson gepflegten) Liste gewählt,
// wodurch Standard und VeVA-Code für jede Probe eindeutig feststehen und im
// Formular nicht mehr manuell überschrieben werden können/müssen.
// `vevaBucket`: '' bzw. kein Eintrag = Material erhält bewusst keinen
// VeVA-Aushubcode (z.B. Mischabbruch, Betonabbruch — dafür gibt es in der
// hinterlegten Codeliste keine Einträge).
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

// VeVA/LVA-Codes für Aushub- und Bodenaushubmaterial, Kapitel 17 05 der
// offiziellen Abfallliste (veva-online.admin.ch) — nur die reinen
// Erdstoff-Kategorien (Oberboden/Unterboden/Aushub), keine
// Bauabfälle/Beton/Asphalt/Asbest/Gleisaushub usw. "klassen" bezieht sich
// auf die VVEA-Einstufung(en), für die der Code jeweils verwendet wird —
// ein Code kann für mehrere Materialien (z.B. Ober- UND Unterboden teilen
// sich dieselben Codes) und/oder mehrere Klassen gleichzeitig gelten, daher
// Arrays statt Einzelwerten.
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
// Wie bei allen anderen Grenzwerten/Codes gilt: vor produktivem Einsatz
// durch eine Fachperson gegen die aktuelle VeVA-Abfallliste verifizieren.
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

// Analytik-Programme: benannte Zusammenstellungen von Analyseparametern, die
// bei einer Probe ausgewählt werden können ("welche Analysen sollen
// ausgelöst werden") — parameterKeys referenzieren die Parameter-Keys aus
// DEFAULT_PARAMETERS (VVEA) bzw. DEFAULT_VBBO_PARAMETERS (VBBo). Eine Probe
// kann mehrere Programme gleichzeitig auswählen (siehe app.js); "Analysen
// auslösen" löst daraus einen Analysenauftrag (PDF) sowie eine E-Mail ans
// gewählte Labor mit den gewünschten Parametern aus — die Analysewerte
// selbst werden separat erfasst (manuell oder per CSV/PDF-Import), sobald
// die Laborresultate vorliegen. Dies ist nur eine Startauswahl — weitere
// Programme können unter Einstellungen > Analytik-Programme
// ergänzt/angepasst werden.
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

// Labore, an die Analysenaufträge per E-Mail gehen können (Einstellungen >
// Labore) — nur Name/Ort als Startwerte, `email`/`adresse`/`telefon` bewusst
// leer: die App erfindet keine Kontaktdaten für echte Firmen, diese müssen
// vor der ersten Nutzung von einer Fachperson/Administrationsperson ergänzt
// werden. Auch Namen/Schreibweise vor produktivem Einsatz verifizieren.
export const DEFAULT_LABORE = [
  { id: 'bachema', name: 'Bachema AG', ort: 'Schlieren', email: '', adresse: '', telefon: '' },
  { id: 'niutec', name: 'Niutec', ort: 'Winterthur', email: '', adresse: '', telefon: '' },
  { id: 'eurofins', name: 'Eurofins', ort: 'Deutschland', email: '', adresse: '', telefon: '' },
];

// Eigene Firma — wird auf offizielle Labor-Auftragsformulare eingesetzt
// (aktuell: Niutec-Analysenauftrag, siehe niutec-form.js), als "Auftraggeber
// 1". Bewusst leer als Startwert, die App erfindet keine Firmendaten.
export const DEFAULT_UNSERE_FIRMA = {
  firma: '', name: '', strasse: '', plzOrt: '', tel: '', email: '',
};
