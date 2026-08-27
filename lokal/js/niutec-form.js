// niutec-form.js — befüllt die ECHTEN Niutec-Analysenauftrag-PDF-Formulare
// (bereitgestellt vom Labor, siehe assets/niutec/) mit den Probendaten,
// statt wie beim generischen Analysenauftrag (report-pdf.js) ein eigenes
// Begleitdokument zu erzeugen.
//
// Die Feld-Zuordnung unten wurde von Hand anhand der Original-PDFs erstellt:
// Position + Beschriftung jedes Formularfelds wurde visuell mit dem
// gerenderten Formular abgeglichen (die PDF-internen Feldnamen wie
// "Check Box2005_3" sind kryptisch/automatisch generiert und für sich
// genommen nicht aussagekräftig). Es wird IMMER nur die erste Probenzeile
// des (mehrzeiligen) Formulars befüllt — die App löst pro Probe genau einen
// Analysenauftrag aus; weitere Proben trägt man von Hand in die Folgezeilen
// ein, falls ein Auftrag mehrere Proben umfassen soll.
//
// WICHTIG: Welche Analytik-Programme welche Niutec-Checkbox ansprechen
// (PROGRAMME_TO_NIUTEC unten) ist eine Bestmöglich-Zuordnung, keine von
// Niutec bestätigte Referenz — nicht jeder Parameter hat eine 1:1
// entsprechende Checkbox auf dem Formular (z.B. Cr/Ni bei VBBo). Nicht
// zugeordnete Programme landen als Text im Feld "Andere Parameter", nichts
// geht verloren. Der generierte Vorschlag wird IMMER erst in einer
// Kontroll-Ansicht gezeigt (siehe paintNiutecReview() in app.js) — dort
// lässt sich jede Checkbox und jedes Textfeld vor dem Erzeugen des PDFs
// noch anpassen.

const PDFLIB_CDN = 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm';
let pdfLibPromise = null;
function loadPdfLib() {
  if (!pdfLibPromise) pdfLibPromise = import(PDFLIB_CDN);
  return pdfLibPromise;
}

export const NIUTEC_TEMPLATES = {
  vvea: 'assets/niutec/analysenauftrag-vvea.pdf',
  vbbo: 'assets/niutec/analysenauftrag-vbbo.pdf',
};

// Menschenlesbare Beschriftung je Checkbox, EXAKT wie auf dem Formular
// aufgedruckt — wird 1:1 in der Kontroll-Ansicht angezeigt, damit man auch
// ohne Blick ins Original-PDF weiss, was man da ankreuzt/abwählt.
export const NIUTEC_CHECKBOX_LABELS = {
  vvea: {
    eluate: 'Eluate', voc: 'VOC',
    kwIndex: 'KW Index C10-C40', pakSummeBap: 'PAK Summe +BaP', smA1: 'SM A1 (Pb,Cd,Cr,Cu,Ni,Zn)',
    smA2: 'SM A2 (VVEA Typ A,B,D,E: +As,Hg,Sb)', smA3: 'SM A3 (Zementwerk: +Co,Sn,Tl)',
    pcb: 'PCB', pakBindem: 'PAK im Bindemittel',
    pfasNorm: 'PFAS NORM Bafu9', pfasPlus: 'PFAS PLUS 41 Verb.', toc400: 'TOC 400',
    voc2: 'VOC 2 (61 Verb.)', c5c10: 'C5-C10', btex: 'BTEX', lckw7: '7 LCKW', pfasBafu16: 'PFAS Bafu16',
  },
  vbbo: {
    smTotPbCdCuZn: 'SM tot Pb/Cd/Cu/Zn', smTotSb: 'SM tot Sb', smTotHg: 'SM tot Hg',
    pfasBafu9: 'PFAS Bafu9', pfasBafu9Plus: 'PFAS Bafu9 +PFDA/PFUnDA', pfasBafu16: 'PFAS Bafu16',
    pfasPlus41: 'PFAS PLUS 41 Verb.', pakSummeBap: 'PAK Summe +BaP', pcbSumme: 'PCB Summe', koernung: 'Körnung',
  },
};

const VVEA_FIELDS = {
  titel: 'Bezeichnung des Analysenauftrages erscheint auf Bericht als TitelRow1',
  firma: 'Firma', name: 'Name', strasse: 'Strasse  PF', plzOrt: 'PLZ  Ort', tel: 'Tel', email: 'Email',
  berichtEmail: 'Check Box13',
  datum: 'Datum', unterschrift: 'Name Unterschrift', bemerkungen: 'Bemerkungen',
  probenbezeichnung: 'Probenbezeichnung  Materialbeschreibung Erscheint auf BerichtRow1',
  andereParameter: 'Andere Parameter',
  checkboxes: {
    eluate: 'Check Box94', voc: 'Check Box941',
    kwIndex: 'Check Box19', pakSummeBap: 'Check Box20', smA1: 'Check Box21', smA2: 'Check Box22',
    smA3: 'Check Box23', pcb: 'Check Box24', pakBindem: 'Check Box25',
    pfasNorm: 'Check Box2000', pfasPlus: 'Check Box2001', toc400: 'Check Box2003',
    voc2: 'Check Box2004', c5c10: 'Check Box2005', btex: 'Check Box2006', lckw7: 'Check Box2007',
    pfasBafu16: 'Check Box3000_1',
  },
};
const VBBO_FIELDS = {
  titel: 'Bezeichnung des Analysenauftrages erscheint auf Bericht als TitelRow1',
  firma: 'Firma', name: 'Name', strasse: 'Strasse  PF', plzOrt: 'PLZ  Ort', tel: 'Tel', email: 'E-Mail',
  berichtEmail: 'Check Box69',
  datum: 'Datum', unterschrift: 'Datum Name  Unterschrift', bemerkungen: 'Bemerkungen',
  probenbezeichnung: 'Probenbezeichnung  Materialbeschreibung Erscheint auf BerichtRow1',
  andereParameter: 'Andere ParameterRow1',
  tiefeVon: 'vonRow1', tiefeBis: 'bisRow1',
  checkboxes: {
    smTotPbCdCuZn: 'Check Box1000', smTotSb: 'Check Box1001', smTotHg: 'Check Box1003',
    pfasBafu9: 'Check Box1004', pfasBafu9Plus: 'Check Box1005', pfasBafu16: 'Check Box1006',
    pfasPlus41: 'Check Box1007', pakSummeBap: 'Check Box1008', pcbSumme: 'Check Box1009', koernung: 'Check Box1010',
  },
};

// Bestmögliche Zuordnung Analytik-Programm (server/src/vvea-defaults.js
// DEFAULT_ANALYTIK_PROGRAMME) -> Niutec-Checkbox(en), siehe Warnhinweis oben.
const PROGRAMME_TO_NIUTEC = {
  'vvea-basis-feststoff': ['smA2', 'kwIndex', 'pakSummeBap', 'toc400'],
  'vvea-eluat-typc': ['eluate'],
  'vvea-organik-zusatz': ['voc2', 'c5c10', 'btex', 'pcb'],
  'vbbo-basis': ['smTotPbCdCuZn', 'smTotHg', 'pakSummeBap', 'pcbSumme'],
};

export function fieldsForStandard(standard) {
  return standard === 'vbbo' ? VBBO_FIELDS : VVEA_FIELDS;
}

// Baut einen editierbaren Vorschlag aus Probe + "Unsere Firma"-Einstellung +
// gewählten Analytik-Programmen — wird in der Kontroll-Ansicht angezeigt und
// kann dort vor dem Erzeugen des PDFs angepasst werden.
export function buildNiutecProposal(entry, unsereFirma, chosenProgramme) {
  const standard = entry.standard === 'vbbo' ? 'vbbo' : 'vvea';
  const labels = NIUTEC_CHECKBOX_LABELS[standard];
  const checkboxes = {};
  Object.keys(labels).forEach(k => { checkboxes[k] = false; });
  const unmapped = [];
  for (const p of (chosenProgramme || [])) {
    const keys = PROGRAMME_TO_NIUTEC[p.id];
    if (keys && keys.length) keys.forEach(k => { if (k in checkboxes) checkboxes[k] = true; });
    else unmapped.push(p.name);
  }
  return {
    standard,
    titel: `${entry.baustelle || ''} – ${entry.probeBezeichnung || ''}`.trim(),
    firma: unsereFirma?.firma || '',
    name: unsereFirma?.name || '',
    strasse: unsereFirma?.strasse || '',
    plzOrt: unsereFirma?.plzOrt || '',
    tel: unsereFirma?.tel || '',
    email: unsereFirma?.email || '',
    berichtEmail: !!unsereFirma?.email,
    datum: new Date().toLocaleDateString('de-CH'),
    unterschrift: unsereFirma?.name || '',
    bemerkungen: '',
    probenbezeichnung: `${entry.probeBezeichnung || ''}${entry.material ? ' – ' + entry.material : ''}`,
    tiefeVon: '', tiefeBis: '',
    checkboxes,
    andereParameter: unmapped.join(', '),
  };
}

// Lädt die passende Formularvorlage und befüllt sie mit dem (ggf. in der
// Kontroll-Ansicht angepassten) Vorschlag. Formularfelder bleiben dabei
// ausfüllbar (nicht "geflattened") — Niutec bzw. die eigene Person kann bei
// Bedarf noch etwas ergänzen, bevor der Auftrag verschickt wird.
export async function fillNiutecPdf(proposal) {
  const { PDFDocument } = await loadPdfLib();
  const fields = fieldsForStandard(proposal.standard);
  const templateUrl = NIUTEC_TEMPLATES[proposal.standard];
  const res = await fetch(templateUrl);
  if (!res.ok) throw new Error('Niutec-Formularvorlage nicht gefunden (' + templateUrl + ').');
  const bytes = await res.arrayBuffer();
  const pdfDoc = await PDFDocument.load(bytes);
  const form = pdfDoc.getForm();

  const setText = (fieldName, value) => {
    if (!fieldName || !value) return;
    try { form.getTextField(fieldName).setText(String(value)); }
    catch (err) { console.warn('Niutec-Formular: Textfeld nicht gefunden:', fieldName, err); }
  };
  const setCheck = (fieldName, checked) => {
    if (!fieldName) return;
    try {
      const cb = form.getCheckBox(fieldName);
      if (checked) cb.check(); else cb.uncheck();
    } catch (err) { console.warn('Niutec-Formular: Checkbox nicht gefunden:', fieldName, err); }
  };

  setText(fields.titel, proposal.titel);
  setText(fields.firma, proposal.firma);
  setText(fields.name, proposal.name);
  setText(fields.strasse, proposal.strasse);
  setText(fields.plzOrt, proposal.plzOrt);
  setText(fields.tel, proposal.tel);
  setText(fields.email, proposal.email);
  setCheck(fields.berichtEmail, !!proposal.berichtEmail);
  setText(fields.datum, proposal.datum);
  setText(fields.unterschrift, proposal.unterschrift);
  setText(fields.bemerkungen, proposal.bemerkungen);
  setText(fields.probenbezeichnung, proposal.probenbezeichnung);
  setText(fields.andereParameter, proposal.andereParameter);
  if (fields.tiefeVon) setText(fields.tiefeVon, proposal.tiefeVon);
  if (fields.tiefeBis) setText(fields.tiefeBis, proposal.tiefeBis);
  for (const [key, fieldName] of Object.entries(fields.checkboxes)) {
    setCheck(fieldName, !!proposal.checkboxes[key]);
  }

  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes], { type: 'application/pdf' });
}
