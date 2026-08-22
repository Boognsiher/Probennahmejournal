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
export async function printLabel(chargenname, subLine, qrText, size) {
  const qrDataUrl = await generateQrDataUrl(qrText);
  const qrSizeMm = Math.max(10, size.h - 4);
  const area = ensurePrintArea();
  area.innerHTML = `
    <img src="${qrDataUrl}" alt="QR-Code" style="width:${qrSizeMm}mm;height:${qrSizeMm}mm;flex-shrink:0;">
    <div class="label-text">
      <div class="label-charge">${escapeHtmlLocal(chargenname)}</div>
      ${subLine ? `<div class="label-sub">${escapeHtmlLocal(subLine)}</div>` : ''}
    </div>`;
  ensurePageStyle().textContent = `@media print { @page { size: ${size.w}mm ${size.h}mm; margin: 0; } }`;
  window.print();
}
