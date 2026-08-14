// report-pdf.js — erzeugt eine echte PDF-Datei je Probe (Fotos, Analysewerte,
// Klassifizierung) mit jsPDF (zur Laufzeit von einem CDN geladen, ESM-Build).
// Wird sowohl für den eigenständigen PDF-Export als auch für den E-Mail-Versand
// (per Web-Share-API als Anhang) verwendet.
import { CLASSES } from './vvea.js';

const JSPDF_ESM = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/+esm';
let jsPDFCtorPromise = null;
function loadJsPDF() {
  if (!jsPDFCtorPromise) {
    jsPDFCtorPromise = import(JSPDF_ESM).then(mod => mod.jsPDF || mod.default?.jsPDF || mod.default);
  }
  return jsPDFCtorPromise;
}

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function getImageSize(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth || 800, height: img.naturalHeight || 600 });
    img.onerror = reject;
    img.src = dataUrl;
  });
}

function dataUrlFormat(dataUrl) {
  if (/^data:image\/png/i.test(dataUrl)) return 'PNG';
  if (/^data:image\/webp/i.test(dataUrl)) return 'WEBP';
  return 'JPEG';
}

function hexToRgb(hex) {
  const m = String(hex).replace('#', '');
  return { r: parseInt(m.slice(0, 2), 16) || 0, g: parseInt(m.slice(2, 4), 16) || 0, b: parseInt(m.slice(4, 6), 16) || 0 };
}

/**
 * @param {object} entry  Probe (wie im Frontend gehalten). entry.photos:
 *   Array von {filename, dataUrl} ODER {filename, blob}.
 * @param {object|null} classification  Rückgabe von vvea.classify()/classifyVBBO()
 * @param {Array} classes  Klassen-Array, das zur Klassifizierung passt (VVEA
 *   CLASSES oder VBBO_CLASSES je nach entry.standard) — Default: VVEA CLASSES.
 * @returns {Promise<Blob>} PDF als Blob (application/pdf)
 */
export async function generateReportPDF(entry, classification, classes = CLASSES) {
  const jsPDF = await loadJsPDF();
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentW = pageW - margin * 2;
  let y = margin;

  doc.setFontSize(16);
  doc.text('Probennahmejournal', margin, y);
  y += 9;

  doc.setFontSize(10);
  const meta = [
    ['Projekt', entry.baustelle || '–'],
    ['Chargenname', entry.probeBezeichnung || '–'],
    ['Entnahmeort', entry.entnahmeort || '–'],
    ['Material', entry.material || '–'],
    ['Probenehmer/in', entry.probenehmer || '–'],
    ['Datum', new Date(entry.createdAt).toLocaleString('de-CH')],
  ];
  if (entry.menge !== null && entry.menge !== undefined && entry.menge !== '') {
    meta.push(['Menge', `${entry.menge} ${entry.mengeEinheit === 'm3' ? 'm³' : 't'}`]);
  }
  for (const [label, value] of meta) {
    doc.setFont(undefined, 'bold'); doc.text(`${label}:`, margin, y);
    doc.setFont(undefined, 'normal'); doc.text(String(value), margin + 38, y);
    y += 5.5;
  }
  y += 2;

  if (entry.bemerkungen) {
    doc.setFont(undefined, 'bold'); doc.text('Bemerkungen:', margin, y); y += 5;
    doc.setFont(undefined, 'normal');
    const split = doc.splitTextToSize(entry.bemerkungen, contentW);
    doc.text(split, margin, y);
    y += split.length * 5 + 2;
  }

  const overall = classification ? classes[classification.classIndex] : null;
  if (overall) {
    const c = hexToRgb(overall.color);
    doc.setFillColor(c.r, c.g, c.b);
    doc.rect(margin, y, contentW, 9, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(11);
    doc.text(`Einstufung: ${overall.label}`, margin + 3, y + 6);
    doc.setTextColor(0, 0, 0); doc.setFontSize(10);
    y += 14;
  } else {
    doc.setFontSize(10); doc.text('Keine Analysewerte erfasst.', margin, y); y += 8;
  }

  const rows = classification?.perParameter || [];
  if (rows.length) {
    const cols = [
      { label: 'Parameter', w: 58 }, { label: 'Wert', w: 20 }, { label: 'Einheit', w: 22 },
      { label: 'Art', w: 26 }, { label: 'Einstufung', w: contentW - 58 - 20 - 22 - 26 },
    ];
    const drawHeader = () => {
      doc.setFont(undefined, 'bold'); doc.setFontSize(9);
      let x = margin;
      for (const c of cols) { doc.text(c.label, x, y); x += c.w; }
      doc.setFont(undefined, 'normal');
      y += 2;
      doc.setDrawColor(150, 150, 150);
      doc.line(margin, y, margin + contentW, y);
      y += 5;
    };
    drawHeader();
    for (const p of rows) {
      if (y > pageH - 25) { doc.addPage(); y = margin; drawHeader(); }
      const rc = hexToRgb(classes[p.classIndex].color);
      doc.setFillColor(rc.r, rc.g, rc.b); doc.setDrawColor(rc.r, rc.g, rc.b);
      doc.rect(margin, y - 4, contentW, 6, 'F');
      let x = margin;
      const cells = [p.label, String(p.wert), p.unit || '', p.art === 'eluat' ? 'Eluat' : 'Gesamt', classes[p.classIndex].short];
      cells.forEach((val, i) => {
        const text = doc.splitTextToSize(String(val), cols[i].w - 2)[0] || '';
        doc.text(text, x + 1, y);
        x += cols[i].w;
      });
      y += 6.5;
    }
    y += 5;
  }

  for (const photo of entry.photos || []) {
    try {
      const dataUrl = photo.dataUrl || await blobToDataURL(photo.blob);
      const { width, height } = await getImageSize(dataUrl);
      const maxW = contentW, maxH = 110;
      let w = maxW, h = (height / width) * w;
      if (h > maxH) { h = maxH; w = (width / height) * h; }
      if (y + h + 8 > pageH - margin) { doc.addPage(); y = margin; }
      doc.addImage(dataUrl, dataUrlFormat(dataUrl), margin, y, w, h);
      y += h + 4;
      doc.setFontSize(8); doc.text(photo.filename || '', margin, y); doc.setFontSize(10);
      y += 7;
    } catch (e) { /* Foto überspringen, falls nicht lesbar */ }
  }

  doc.setFontSize(8); doc.setTextColor(160, 0, 0);
  const disclaimer = doc.splitTextToSize(
    'Hinweis: Die hinterlegten Grenzwerte können Platzhalter sein. Verbindliche Einstufung gemäss aktueller '
    + 'VVEA/kantonaler Vollzugshilfe durch eine Fachperson prüfen lassen.', contentW);
  doc.text(disclaimer, margin, pageH - margin + 5);

  return doc.output('blob');
}

export function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/**
 * Versucht, die PDF über die native Teilen-Funktion (Web-Share-API) direkt als
 * Anhang bereitzustellen (funktioniert v.a. auf Handys). `mailto:` selbst kann
 * aus Browsern heraus KEINE Dateianhänge setzen — das ist eine Plattform-
 * Einschränkung, kein Bug dieser App. Wo Teilen nicht verfügbar ist, wird die
 * PDF stattdessen heruntergeladen (zum manuellen Anhängen).
 * @returns {Promise<'shared'|'downloaded'|'cancelled'>}
 */
export async function sharePDFOrDownload(pdfBlob, filename, shareTitle, shareText) {
  try {
    const file = new File([pdfBlob], filename, { type: 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: shareTitle, text: shareText });
      return 'shared';
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return 'cancelled';
    // sonst: unten auf Download zurückfallen
  }
  downloadBlob(filename, pdfBlob);
  return 'downloaded';
}
