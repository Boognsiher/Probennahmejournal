// parse-pdf.js — heuristische Extraktion von Parameter/Wert/Einheit-Zeilen
// aus PDF-Laborberichten mittels pdf.js. Ergebnis MUSS vom Anwender vor dem
// Übernehmen geprüft werden (Vorschau in der App) — Laborberichte sind sehr
// unterschiedlich formatiert.
import { findParamByAlias } from './vvea.js';

const PDFJS_CDN = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.min.mjs';
const PDFJS_WORKER_CDN = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs';

let pdfjsLibPromise = null;
function loadPdfJs() {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import(PDFJS_CDN).then(lib => {
      lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_CDN;
      return lib;
    });
  }
  return pdfjsLibPromise;
}

async function extractText(arrayBuffer) {
  const pdfjsLib = await loadPdfJs();
  const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const lines = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    // grob nach Y-Position zu Zeilen gruppieren
    const byY = new Map();
    for (const item of content.items) {
      const y = Math.round(item.transform[5]);
      if (!byY.has(y)) byY.set(y, []);
      byY.get(y).push(item.str);
    }
    const ys = Array.from(byY.keys()).sort((a, b) => b - a);
    for (const y of ys) {
      const line = byY.get(y).join(' ').replace(/\s+/g, ' ').trim();
      if (line) lines.push(line);
    }
  }
  return lines;
}

const NUMBER_UNIT_RE = /([<]?\s?-?\d+[.,]?\d*)\s*(mg\/kg|mg\/l|µg\/kg|µg\/l|ug\/kg|ug\/l|%|g\/kg)?/i;

function parseNumber(str) {
  let s = str.replace(/</g, '').trim();
  if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
  else if (s.includes(',')) s = s.replace(',', '.');
  return parseFloat(s);
}

/**
 * @param {ArrayBuffer} arrayBuffer
 * @param {Array} [paramList]  Parameterliste für den Alias-Abgleich (VVEA
 *   PARAMETERS oder VBBO_PARAMETERS, je nach gewähltem Standard der Probe).
 * @returns {Promise<Array<{roh:string, parameterKey:string|null, wert:number, einheit:string, art:string}>>}
 */
export async function parsePDF(arrayBuffer, paramList) {
  const lines = await extractText(arrayBuffer);
  const results = [];
  for (const line of lines) {
    const paramDef = findParamByAlias(line, paramList);
    if (!paramDef) continue;
    const match = line.match(NUMBER_UNIT_RE);
    if (!match) continue;
    const wert = parseNumber(match[1]);
    if (Number.isNaN(wert)) continue;
    const art = /eluat/i.test(line) ? 'eluat' : (paramDef.art || 'gesamt');
    results.push({
      roh: line,
      parameterKey: paramDef.key,
      wert,
      einheit: match[2] || paramDef.unit,
      art,
    });
  }
  return results;
}
