import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { authRouter } from './routes/auth.js';
import { usersRouter } from './routes/users.js';
import { settingsRouter } from './routes/settings.js';
import { entriesRouter } from './routes/entries.js';
import { projectsRouter } from './routes/projects.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', '..', 'public');

export const app = express();

// Hinter einem Reverse Proxy (Caddy/nginx, siehe README > Deployment) sieht
// Express sonst nur die Proxy-IP statt der echten Client-IP — u.a. wichtig
// für den Login-Rate-Limiter (rate-limit.js), der pro IP zählt. Nur aktivieren,
// wenn der Server TATSÄCHLICH hinter einem vertrauenswürdigen Proxy läuft
// (sonst liesse sich die IP über den X-Forwarded-For-Header fälschen und der
// Rate-Limiter umgehen) — daher explizit per Env-Var opt-in, nicht default an.
if (process.env.TRUST_PROXY) app.set('trust proxy', 1);

// CORS: ohne gesetzte CORS_ORIGIN bewusst offen (jede Herkunft erlaubt) — für
// lokale Entwicklung/Tests praktisch, für den produktiven Einsatz aber die
// eigene Domain eintragen (.env, kommagetrennt bei mehreren). Betrifft nur
// browserseitige Cross-Origin-Aufrufe der API von einer ANDEREN Domain aus;
// die App selbst (Frontend + API vom selben Server ausgeliefert) ist davon
// ohnehin nicht betroffen (same-origin).
const corsOrigins = String(process.env.CORS_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
if (corsOrigins.length) {
  app.use(cors({ origin: corsOrigins }));
} else {
  console.warn('[warnung] CORS_ORIGIN ist nicht gesetzt — die API akzeptiert Cross-Origin-Anfragen von jeder '
    + 'Herkunft. Für den produktiven Einsatz die eigene Domain in der .env eintragen (siehe .env.example).');
  app.use(cors());
}
app.use(express.json({ limit: '2mb' }));

app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/entries', entriesRouter);
app.use('/api/projects', projectsRouter);

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Frontend (SPA) ausliefern.
app.use(express.static(publicDir));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(publicDir, 'index.html'));
});

// zentrale Fehlerbehandlung
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Interner Serverfehler.' });
});
