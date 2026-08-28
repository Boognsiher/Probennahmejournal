// label.js — druckt eine kleine Etikette (Chargenname + QR-Code mit
// Proben-Infos für das Labor) direkt aus der Website über den normalen
// Browser-Druckdialog (window.print()) — funktioniert mit jedem als
// Systemdrucker eingerichteten Etikettendrucker (z.B. Brother QL-/PT-Serie),
// da diese über ihren Treiber wie ein normaler Drucker erscheinen. Beim
// Drucken „Tatsächliche Grösse / 100 %“ wählen und den Etikettendrucker als
// Ziel — die Etikettengrösse (siehe loadLabelSize()) bestimmt die
// @page-Grösse, damit nicht skaliert werden muss.
//
// Der QR-Code wird zur Laufzeit im Browser gerendert (kein externer Dienst,
// keine Probendaten verlassen das Gerät), per CDN-ESM-Import — derselbe
// Ansatz wie jsPDF in report-pdf.js.
const QRCODE_ESM = 'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/+esm';
let qrcodeModPromise = null;
function loadQRCode() {
  if (!qrcodeModPromise) {
    qrcodeModPromise = import(QRCODE_ESM).then(mod => mod.default || mod);
  }
  return qrcodeModPromise;
}

export async function generateQrDataUrl(text) {
  const QRCode = await loadQRCode();
  return QRCode.toDataURL(text, { margin: 1, width: 300 });
}

const STORAGE_KEY_LABEL_SIZE = 'pnj_label_size';
// Standardgrösse 62×29 mm entspricht gängigen Brother-QL-Etiketten (z.B.
// DK-11209) — rein geräte-/browserlokal, bei Bedarf unten im Formular
// anpassbar (z.B. bei anderer Etikettenrolle).
export function loadLabelSize() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY_LABEL_SIZE) || 'null');
    if (raw && Number(raw.w) > 0 && Number(raw.h) > 0) return { w: Number(raw.w), h: Number(raw.h) };
  } catch (e) { /* fällt auf Standardgrösse zurück */ }
  return { w: 62, h: 29 };
}
export function saveLabelSize(size) {
  localStorage.setItem(STORAGE_KEY_LABEL_SIZE, JSON.stringify(size));
}

function ensurePrintArea() {
  let area = document.getElementById('label-print-area');
  if (!area) {
    area = document.createElement('div');
    area.id = 'label-print-area';
    document.body.appendChild(area);
  }
  return area;
}
function ensurePageStyle() {
  let styleEl = document.getElementById('label-page-style');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'label-page-style';
    document.head.appendChild(styleEl);
  }
  return styleEl;
}
function escapeHtmlLocal(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/**
 * Baut die Etikette (Chargenname + QR-Code, optional Unterzeile) auf und
 * öffnet den Browser-Druckdialog.
 * @param {string} chargenname
 * @param {string} subLine  z.B. "Material · Projekt" (optional)
 * @param {string} qrText   Klartext-Inhalt des QR-Codes (siehe buildLabelQrText() in email.js)
 * @param {{w:number,h:number}} size  Etikettengrösse in mm
 */
function clampMm(v, min, max) { return Math.max(min, Math.min(max, v)); }

export async function printLabel(chargenname, subLine, qrText, size) {
  const qrDataUrl = await generateQrDataUrl(qrText);
  // 2mm Innenabstand oben+unten (siehe #label-print-area padding im
  // @media print unten) — das ist die tatsächlich nutzbare Höhe.
  const padMm = 4;
  const availH = Math.max(4, size.h - padMm);
  // Vorher fix "Math.max(10, ...)" — bei kleinen Etiketten (z.B. 12mm hoch,
  // 8mm nutzbar) wurde der QR-Code dadurch grösser als die Etikette selbst
  // erzwungen und lief auf eine zweite (leere) Seite über, siehe den
  // "43 gleiche Seiten"-Bug oben in style.css. Jetzt begrenzt auf den
  // tatsächlich verfügbaren Platz, mit kleiner Untergrenze nur für absurd
  // niedrige Etiketten.
  const qrSizeMm = Math.max(4, availH);
  // Schriftgrössen ebenfalls proportional zur verfügbaren Höhe statt fest
  // 14pt/7pt — aus demselben Grund: bei 12mm Etikettenhöhe war der Text
  // (Chargenname + Unterzeile) selbst mit korrektem QR-Code schon knapp
  // höher als die Etikette.
  const chargeFontMm = clampMm(availH * 0.55, 2.2, 5.2);
  const subFontMm = clampMm(availH * 0.28, 1.3, 2.6);
  const subMarginMm = clampMm(availH * 0.08, 0.3, 1);
  const area = ensurePrintArea();
  area.innerHTML = `
    <img src="${qrDataUrl}" alt="QR-Code" style="width:${qrSizeMm}mm;height:${qrSizeMm}mm;flex-shrink:0;">
    <div class="label-text">
      <div class="label-charge" style="font-size:${chargeFontMm}mm;">${escapeHtmlLocal(chargenname)}</div>
      ${subLine ? `<div class="label-sub" style="font-size:${subFontMm}mm;margin-top:${subMarginMm}mm;">${escapeHtmlLocal(subLine)}</div>` : ''}
    </div>`;
  ensurePageStyle().textContent = `@media print { @page { size: ${size.w}mm ${size.h}mm; margin: 0; } }`;
  window.print();
}
