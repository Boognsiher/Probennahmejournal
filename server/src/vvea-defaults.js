// Server-seitige Kopie der Deponieklassen-Struktur & Platzhalter-Grenzwerte,
// mit der die Datenbank beim allerersten Start vorbefüllt wird (danach über
// die App unter "Einstellungen" durch eine Fachperson editierbar).
// Muss inhaltlich mit public/js/vvea.js übereinstimmen — siehe dortigen
// Hinweis zur Verlässlichkeit der Zahlenwerte.

export const CLASSES = [
  { id: 'unbelastet', label: 'Unbelastet / Verwertung möglich', short: 'Verwertung', color: '#2e7d32' },
  { id: 'typA', label: 'Deponietyp A (Aushubdeponie)', short: 'Typ A', color: '#66bb6a' },
  { id: 'typB', label: 'Deponietyp B (Inertstoffdeponie)', short: 'Typ B', color: '#29b6f6' },
  { id: 'typC', label: 'Deponietyp C (Reststoffdeponie)', short: 'Typ C', color: '#ffa726' },
  { id: 'typD', label: 'Deponietyp D (Reaktordeponie)', short: 'Typ D', color: '#ef5350' },
  { id: 'typE', label: 'Deponietyp E (Reaktordeponie)', short: 'Typ E', color: '#b71c1c' },
  { id: 'sonderfall', label: 'Nicht deponierbar / Sonderabfall – Fachperson beiziehen', short: 'Sonderfall', color: '#4a148c', terminal: true },
];

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
