import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET === 'bitte-aendern-langer-zufallswert') {
  console.warn('[warnung] JWT_SECRET ist nicht gesetzt oder verwendet noch den Platzhalterwert aus .env.example. '
    + 'Bitte in der .env durch einen eigenen, zufälligen Wert ersetzen.');
}

export function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, name: user.name, role: user.role },
    JWT_SECRET || 'unsicherer-entwicklungs-schluessel',
    { expiresIn: '30d' }
  );
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Nicht angemeldet.' });
  try {
    const payload = jwt.verify(token, JWT_SECRET || 'unsicherer-entwicklungs-schluessel');
    req.user = { id: payload.sub, email: payload.email, name: payload.name, role: payload.role };
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Sitzung ungültig oder abgelaufen. Bitte erneut anmelden.' });
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Nur für Administratoren.' });
  next();
}

// Rollenmodell: 'admin' (alles), 'projektleiter' (eigene Projekte anlegen/
// verwalten, Zugriff für Probenehmer/externe Nutzer steuern), 'probenehmer'
// (Proben in freigegebenen Projekten anlegen/bearbeiten, Löschung braucht
// Freigabe der Projektleitung), 'extern' (nur lesen, nur einzeln
// freigegebene Proben). Siehe routes/projects.js und routes/entries.js für
// die konkrete Sichtbarkeits-/Schreibrechte-Logik je Rolle.
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) return res.status(403).json({ error: 'Dafür fehlt die Berechtigung.' });
    next();
  };
}
