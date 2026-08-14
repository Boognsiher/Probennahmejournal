// email.js — baut die Textzusammenfassung/den mailto:-Link. Der eigentliche
// PDF-Anhang läuft über report-pdf.js (Web-Share-API bzw. Download-Fallback,
// da mailto: selbst keine Dateianhänge setzen kann — Browser-Beschränkung).
import { CLASSES } from './vvea.js';

export function buildMailSummary(entry, classification, classes = CLASSES) {
  const overall = classification ? classes[classification.classIndex] : null;
  const lines = [];
  lines.push(`Probennahmejournal – ${entry.probeBezeichnung || '(ohne Bezeichnung)'}`);
  lines.push('');
  lines.push(`Baustelle/Projekt: ${entry.baustelle || '–'}`);
  lines.push(`Entnahmeort: ${entry.entnahmeort || '–'}`);
  lines.push(`Material: ${entry.material || '–'}`);
  lines.push(`Probenehmer/in: ${entry.probenehmer || '–'}`);
  lines.push(`Datum: ${new Date(entry.createdAt).toLocaleString('de-CH')}`);
  if (entry.menge !== null && entry.menge !== undefined && entry.menge !== '') {
    lines.push(`Menge: ${entry.menge} ${entry.mengeEinheit === 'm3' ? 'm³' : 't'}`);
  }
  lines.push(`Standard: ${entry.standard === 'vbbo' ? 'VBBo (Bodenqualität)' : 'VVEA (Deponieklassen)'}`);
  if (entry.vevaCode) lines.push(`VeVA-Code: ${entry.vevaCode}`);
  if (entry.entsorgungsweg) lines.push(`Entsorgungsweg: ${entry.entsorgungsweg}`);
  lines.push('');
  lines.push(`Einstufung: ${overall ? overall.label : 'keine Analysewerte erfasst'}`);
  if (classification?.perParameter?.length) {
    lines.push('');
    lines.push('Analysewerte:');
    for (const p of classification.perParameter) {
      lines.push(`  - ${p.label}: ${p.wert} ${p.unit} (${p.art === 'eluat' ? 'Eluat' : 'Gesamtgehalt'}) -> ${classes[p.classIndex].short}`);
    }
  }
  if (entry.bemerkungen) {
    lines.push('');
    lines.push(`Bemerkungen: ${entry.bemerkungen}`);
  }
  lines.push('');
  lines.push(`Fotos: ${(entry.photos || []).length} Stück (im PDF-Anhang enthalten, falls beigefügt).`);
  lines.push('');
  lines.push('— Erstellt mit dem Baustellen-Probennahmejournal');
  return lines.join('\n');
}

export function buildMailto(entry, classification, to = '', classes = CLASSES) {
  const overall = classification ? classes[classification.classIndex].short : 'unklassifiziert';
  const subject = `Probennahmejournal – ${entry.baustelle || ''} – ${entry.probeBezeichnung || entry.id} – ${overall}`;
  const body = buildMailSummary(entry, classification, classes);
  const params = new URLSearchParams();
  params.set('subject', subject);
  params.set('body', body);
  return `mailto:${encodeURIComponent(to)}?${params.toString().replace(/\+/g, '%20')}`;
}
