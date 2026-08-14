// email.js — baut die Textzusammenfassung/den mailto:-Link. Der eigentliche
// PDF-Anhang läuft über report-pdf.js (Web-Share-API bzw. Download-Fallback,
// da mailto: selbst keine Dateianhänge setzen kann — Browser-Beschränkung).
import { CLASSES } from './vvea.js';

export function buildMailSummary(entry, classification) {
  const overall = classification ? CLASSES[classification.classIndex] : null;
  const lines = [];
  lines.push(`Probennahmejournal – ${entry.probeBezeichnung || '(ohne Bezeichnung)'}`);
  lines.push('');
  lines.push(`Baustelle/Projekt: ${entry.baustelle || '–'}`);
  lines.push(`Entnahmeort: ${entry.entnahmeort || '–'}`);
  lines.push(`Material: ${entry.material || '–'}`);
  lines.push(`Probenehmer/in: ${entry.probenehmer || '–'}`);
  lines.push(`Datum: ${new Date(entry.createdAt).toLocaleString('de-CH')}`);
  lines.push('');
  lines.push(`Einstufung: ${overall ? overall.label : 'keine Analysewerte erfasst'}`);
  if (classification?.perParameter?.length) {
    lines.push('');
    lines.push('Analysewerte:');
    for (const p of classification.perParameter) {
      lines.push(`  - ${p.label}: ${p.wert} ${p.unit} (${p.art === 'eluat' ? 'Eluat' : 'Gesamtgehalt'}) -> ${CLASSES[p.classIndex].short}`);
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

export function buildMailto(entry, classification, to = '') {
  const overall = classification ? CLASSES[classification.classIndex].short : 'unklassifiziert';
  const subject = `Probennahmejournal – ${entry.baustelle || ''} – ${entry.probeBezeichnung || entry.id} – ${overall}`;
  const body = buildMailSummary(entry, classification);
  const params = new URLSearchParams();
  params.set('subject', subject);
  params.set('body', body);
  return `mailto:${encodeURIComponent(to)}?${params.toString().replace(/\+/g, '%20')}`;
}
