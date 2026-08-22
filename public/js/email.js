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

// ---------- Analysenauftrag ans Labor ----------

// Textzusammenfassung des Analysenauftrags (mailto:-Body bzw. Web-Share-Text)
// — listet die gewünschten Parameter gruppiert nach Analytik-Programm auf.
// `chosenProgramme`: Array von {name, parameterKeys}; `params`: PARAMETERS
// oder VBBO_PARAMETERS je nach entry.standard, für Label/Einheit/Art.
export function buildLabOrderMailSummary(entry, labor, chosenProgramme, params) {
  const lines = [];
  lines.push(`Analysenauftrag – ${entry.probeBezeichnung || '(ohne Bezeichnung)'}`);
  lines.push('');
  if (labor?.name) lines.push(`An: ${labor.name}${labor.ort ? ', ' + labor.ort : ''}`);
  lines.push('');
  lines.push(`Projekt: ${entry.baustelle || '–'}`);
  lines.push(`Chargenname: ${entry.probeBezeichnung || '–'}`);
  lines.push(`Entnahmeort: ${entry.entnahmeort || '–'}`);
  lines.push(`Material: ${entry.material || '–'}`);
  lines.push(`Probenehmer/in: ${entry.probenehmer || '–'}`);
  lines.push(`Datum: ${new Date(entry.createdAt).toLocaleString('de-CH')}`);
  if (entry.menge !== null && entry.menge !== undefined && entry.menge !== '') {
    lines.push(`Menge: ${entry.menge} ${entry.mengeEinheit === 'm3' ? 'm³' : 't'}`);
  }
  lines.push('');
  lines.push('Gewünschte Analysen:');
  const seen = new Set();
  for (const prog of chosenProgramme) {
    lines.push(`  ${prog.name}:`);
    for (const key of prog.parameterKeys || []) {
      if (seen.has(key)) continue;
      const def = params.find(p => p.key === key);
      if (!def) continue;
      seen.add(key);
      lines.push(`    - ${def.label}${def.unit ? ' (' + def.unit + ')' : ''}${def.art === 'eluat' ? ' – Eluat' : ''}`);
    }
  }
  if (entry.bemerkungen) {
    lines.push('');
    lines.push(`Bemerkungen: ${entry.bemerkungen}`);
  }
  lines.push('');
  lines.push('Analysenauftrag als PDF angehängt bzw. im Download-Ordner (siehe Hinweis beim Versand).');
  lines.push('');
  lines.push('— Erstellt mit dem Baustellen-Probennahmejournal');
  return lines.join('\n');
}

export function buildLabOrderMailto(entry, labor, chosenProgramme, params) {
  const subject = `Analysenauftrag – ${entry.baustelle || ''} – ${entry.probeBezeichnung || entry.id}`.trim();
  const body = buildLabOrderMailSummary(entry, labor, chosenProgramme, params);
  const urlParams = new URLSearchParams();
  urlParams.set('subject', subject);
  urlParams.set('body', body);
  return `mailto:${encodeURIComponent(labor?.email || '')}?${urlParams.toString().replace(/\+/g, '%20')}`;
}
