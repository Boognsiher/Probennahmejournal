// Minimaler In-Memory-Rate-Limiter für den Login-Endpunkt (Schutz vor
// Passwort-Brute-Force). Bewusst ohne zusätzliche Abhängigkeit (z.B.
// express-rate-limit) — für den Alpha-Massstab (ein einzelner Node-Prozess,
// kleiner bekannter Nutzerkreis) reicht eine simple In-Memory-Zählung pro
// IP-Adresse. Läuft der Server künftig als mehrere Instanzen hinter einem
// Load Balancer, müsste das durch einen gemeinsamen Store (z.B. Redis)
// ersetzt werden — für den aktuellen Einzelprozess-Betrieb nicht nötig.
//
// Zählt NUR fehlgeschlagene Login-Versuche (falsches Passwort/unbekannte
// E-Mail) — ein erfolgreicher Login setzt den Zähler der anfragenden IP
// zurück, damit normale Nutzer:innen nie ausgesperrt werden, nur wer
// wiederholt falsche Zugangsdaten probiert.
const WINDOW_MS = 10 * 60 * 1000; // 10 Minuten Zeitfenster
const MAX_FAILED_ATTEMPTS = 10;   // fehlgeschlagene Versuche pro IP in diesem Fenster

const failedAttempts = new Map(); // ip -> { count, resetAt }

// Periodisch aufräumen, damit die Map bei Dauerbetrieb nicht unbegrenzt wächst.
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of failedAttempts) {
    if (entry.resetAt <= now) failedAttempts.delete(ip);
  }
}, WINDOW_MS).unref();

function getEntry(ip) {
  const now = Date.now();
  let entry = failedAttempts.get(ip);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + WINDOW_MS };
    failedAttempts.set(ip, entry);
  }
  return entry;
}

// Vor der eigentlichen Login-Prüfung: blockt, wenn die anfragende IP das
// Limit an fehlgeschlagenen Versuchen bereits erreicht hat.
export function loginRateLimit(req, res, next) {
  const entry = getEntry(req.ip);
  if (entry.count >= MAX_FAILED_ATTEMPTS) {
    res.setHeader('Retry-After', String(Math.ceil((entry.resetAt - Date.now()) / 1000)));
    return res.status(429).json({ error: 'Zu viele fehlgeschlagene Login-Versuche. Bitte in einigen Minuten erneut versuchen.' });
  }
  next();
}

// Nach der Login-Prüfung aufrufen: `success=false` zählt einen fehlgeschlagenen
// Versuch, `success=true` setzt den Zähler dieser IP zurück.
export function recordLoginAttempt(req, success) {
  if (success) {
    failedAttempts.delete(req.ip);
    return;
  }
  const entry = getEntry(req.ip);
  entry.count += 1;
}
