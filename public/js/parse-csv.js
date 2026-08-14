// parse-csv.js — robuster, minimaler CSV/Excel-CSV-Parser für Laborwerte.
import { findParamByAlias } from './vvea.js';

function detectDelimiter(sample) {
  const candidates = [';', ',', '\t'];
  let best = ';';
  let bestCount = -1;
  for (const c of candidates) {
    const count = (sample.match(new RegExp('\\' + c, 'g')) || []).length;
    if (count > bestCount) { bestCount = count; best = c; }
  }
  return best;
}

function splitLine(line, delim) {
  // einfacher CSV-Split mit Unterstützung für "..." maskierte Felder
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === delim && !inQuotes) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map(s => s.trim().replace(/^"|"$/g, ''));
}

function parseNumber(str) {
  if (str === undefined || str === null) return NaN;
  let s = String(str).trim();
  s = s.replace(/</g, '').replace(/[^\d,.\-]/g, ''); // "<0.1" -> "0.1"
  if (s.includes(',') && s.includes('.')) {
    s = s.replace(/\./g, '').replace(',', '.'); // 1.234,56 -> 1234.56
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  return parseFloat(s);
}

/**
 * Parst CSV-Text mit Spalten Parameter;Wert;Einheit;(Typ optional).
 * Erkennt Kopfzeile automatisch, sonst wird Position 0/1/2/3 angenommen.
 * @param {Array} paramList  Parameterliste für den Alias-Abgleich (VVEA
 *   PARAMETERS oder VBBO_PARAMETERS, je nach gewähltem Standard der Probe).
 * @returns {Array<{roh:string, parameterKey:string|null, wert:number, einheit:string, art:string}>}
 */
export function parseCSV(text, paramList) {
  const lines = text.split(/\r\n|\n|\r/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return [];
  const delim = detectDelimiter(lines[0]);

  let headerIdx = { parameter: 0, wert: 1, einheit: 2, art: 3 };
  let startRow = 0;
  const firstCells = splitLine(lines[0], delim).map(c => c.toLowerCase());
  const looksLikeHeader = firstCells.some(c => /parameter|analyt|bezeichnung/.test(c)) ||
                           firstCells.some(c => /wert|ergebnis|konzentration/.test(c));
  if (looksLikeHeader) {
    startRow = 1;
    headerIdx = { parameter: -1, wert: -1, einheit: -1, art: -1 };
    firstCells.forEach((c, i) => {
      if (/parameter|analyt|bezeichnung/.test(c)) headerIdx.parameter = i;
      else if (/wert|ergebnis|konzentration/.test(c)) headerIdx.wert = i;
      else if (/einheit|unit/.test(c)) headerIdx.einheit = i;
      else if (/typ|art|matrix/.test(c)) headerIdx.art = i;
    });
    if (headerIdx.parameter === -1) headerIdx.parameter = 0;
    if (headerIdx.wert === -1) headerIdx.wert = 1;
  }

  const rows = [];
  for (let i = startRow; i < lines.length; i++) {
    const cells = splitLine(lines[i], delim);
    const paramRaw = cells[headerIdx.parameter] || '';
    const wertRaw = cells[headerIdx.wert] || '';
    if (!paramRaw || !wertRaw) continue;
    const einheit = headerIdx.einheit >= 0 ? (cells[headerIdx.einheit] || '') : '';
    const artRaw = headerIdx.art >= 0 ? (cells[headerIdx.art] || '') : '';
    const paramDef = findParamByAlias(paramRaw, paramList);
    const art = /eluat/i.test(artRaw) ? 'eluat' : (/gesamt/i.test(artRaw) ? 'gesamt' : (paramDef ? paramDef.art : 'gesamt'));
    rows.push({
      roh: paramRaw,
      parameterKey: paramDef ? paramDef.key : null,
      wert: parseNumber(wertRaw),
      einheit: einheit || (paramDef ? paramDef.unit : ''),
      art,
    });
  }
  return rows;
}
