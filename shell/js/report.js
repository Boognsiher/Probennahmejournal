// report.js — erzeugt einen eigenständigen HTML-Bericht pro Probe (mit
// eingebetteten Fotos), der heruntergeladen und einer E-Mail manuell als
// Anhang beigefügt oder per Browser "Drucken -> als PDF speichern" exportiert
// werden kann.
import { CLASSES } from './vvea.js';

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function generateReportHTML(entry, classification, classes = CLASSES) {
  const photoTags = [];
  for (const p of entry.photos || []) {
    try {
      const dataUrl = await blobToDataURL(p.blob);
      photoTags.push(`<figure><img src="${dataUrl}" alt="${escapeHtml(p.filename)}"><figcaption>${escapeHtml(p.filename)}</figcaption></figure>`);
    } catch (e) { /* Foto überspringen falls nicht lesbar */ }
  }

  const rows = (classification?.perParameter || []).map(p => `
    <tr style="background:${p.color}22">
      <td>${escapeHtml(p.label)}</td>
      <td>${p.wert}</td>
      <td>${escapeHtml(p.unit)}</td>
      <td>${p.art === 'eluat' ? 'Eluat' : 'Gesamtgehalt'}</td>
      <td><span class="badge" style="background:${p.color}">${escapeHtml(classes[p.classIndex].short)}</span></td>
    </tr>`).join('');

  const unbewertetRows = (classification?.unbewertet || []).map(p => `
    <tr>
      <td>${escapeHtml(p.roh || p.parameterKey)}</td>
      <td>${p.wert ?? '–'}</td>
      <td>${escapeHtml(p.einheit || '')}</td>
      <td colspan="2">nicht bewertet (kein Grenzwert hinterlegt)</td>
    </tr>`).join('');

  const overall = classification ? classes[classification.classIndex] : null;

  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8">
<title>Probennahmejournal – ${escapeHtml(entry.probeBezeichnung || entry.id)}</title>
<style>
  body{font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:900px;margin:2rem auto;padding:0 1rem;color:#1b1b1b;}
  h1{font-size:1.4rem;} h2{font-size:1.1rem;margin-top:2rem;border-bottom:1px solid #ddd;padding-bottom:.25rem;}
  table{border-collapse:collapse;width:100%;margin-top:.5rem;}
  td,th{border:1px solid #ccc;padding:.4rem .6rem;text-align:left;font-size:.9rem;}
  .badge{color:#fff;padding:.15rem .5rem;border-radius:1rem;font-size:.8rem;}
  .meta{display:grid;grid-template-columns:repeat(2,1fr);gap:.25rem 1.5rem;}
  .meta div span{color:#666;font-size:.8rem;display:block;}
  figure{display:inline-block;width:220px;margin:.5rem;vertical-align:top;}
  figure img{max-width:100%;border-radius:6px;border:1px solid #ddd;}
  figcaption{font-size:.75rem;color:#666;word-break:break-all;}
  .overall{padding:.75rem 1rem;border-radius:8px;color:#fff;font-weight:600;display:inline-block;margin-top:.5rem;}
  .disclaimer{font-size:.75rem;color:#a00;border:1px solid #a00;padding:.5rem .75rem;border-radius:6px;margin-top:2rem;}
</style></head>
<body>
  <h1>Probennahmejournal – Bericht</h1>
  <div class="meta">
    <div><span>Baustelle / Projekt</span>${escapeHtml(entry.baustelle)}</div>
    <div><span>Probenbezeichnung</span>${escapeHtml(entry.probeBezeichnung)}</div>
    <div><span>Entnahmeort</span>${escapeHtml(entry.entnahmeort)}</div>
    <div><span>Material</span>${escapeHtml(entry.material)}</div>
    <div><span>Probenehmer/in</span>${escapeHtml(entry.probenehmer)}</div>
    <div><span>Datum</span>${escapeHtml(new Date(entry.createdAt).toLocaleString('de-CH'))}</div>
    ${entry.menge !== null && entry.menge !== undefined && entry.menge !== '' ? `<div><span>Menge</span>${escapeHtml(entry.menge)} ${entry.mengeEinheit === 'm3' ? 'm³' : 't'}</div>` : ''}
  </div>
  ${entry.bemerkungen ? `<h2>Bemerkungen</h2><p>${escapeHtml(entry.bemerkungen)}</p>` : ''}

  <h2>Klassifizierung</h2>
  ${overall ? `<div class="overall" style="background:${overall.color}">${escapeHtml(overall.label)}</div>` : '<p>Keine Analysewerte erfasst.</p>'}

  <h2>Analysewerte</h2>
  <table>
    <thead><tr><th>Parameter</th><th>Wert</th><th>Einheit</th><th>Art</th><th>Einstufung</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="5">Keine Werte</td></tr>'}${unbewertetRows}</tbody>
  </table>

  <h2>Fotos</h2>
  <div>${photoTags.join('') || '<p>Keine Fotos vorhanden.</p>'}</div>

  <p class="disclaimer">Hinweis: Die hinterlegten Grenzwerte sind ggf. Platzhalter/Beispielwerte und ersetzen keine
  fachliche Prüfung. Verbindliche Einstufung gemäss aktueller VVEA und kantonaler Vollzugshilfe durch eine
  Fachperson vornehmen lassen.</p>
</body></html>`;
}

export function downloadHTML(filename, html) {
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
