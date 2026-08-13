// email.js — bereitet eine E-Mail über mailto: vor. mailto: kann keine
// Dateianhänge setzen (Browser-Beschränkung) — deshalb wird im Body auf den
// zuvor heruntergeladenen HTML-Bericht/Fotos als manuell anzuhängende Datei
// hingewiesen (siehe report.js).
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
  lines.push(`Fotos: ${(entry.photos || []).length} Stück – bitte den heruntergeladenen Bericht`
    + ' bzw. die Fotos dieser E-Mail manuell als Anhang beifügen (mailto: unterstützt keine automatischen Anhänge).');
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
