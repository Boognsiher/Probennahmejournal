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
app.use(cors());
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
