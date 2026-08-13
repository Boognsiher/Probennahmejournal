import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { db } from '../db.js';
import { requireAuth, requireAdmin } from '../auth.js';

export const usersRouter = Router();
usersRouter.use(requireAuth, requireAdmin);

usersRouter.get('/', (req, res) => {
  const users = db.prepare('SELECT id, email, name, role, createdAt FROM users ORDER BY createdAt').all();
  res.json({ users });
});

usersRouter.post('/', (req, res) => {
  const { email, name, password, role } = req.body || {};
  if (!email || !name || !password) return res.status(400).json({ error: 'E-Mail, Name und Passwort erforderlich.' });
  if (password.length < 8) return res.status(400).json({ error: 'Passwort muss mindestens 8 Zeichen haben.' });
  const normalizedEmail = String(email).toLowerCase().trim();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
  if (existing) return res.status(409).json({ error: 'Ein Benutzer mit dieser E-Mail existiert bereits.' });
  const id = randomUUID();
  const passwordHash = bcrypt.hashSync(password, 12);
  const finalRole = role === 'admin' ? 'admin' : 'user';
  db.prepare('INSERT INTO users (id, email, passwordHash, name, role, createdAt) VALUES (?,?,?,?,?,?)')
    .run(id, normalizedEmail, passwordHash, name, finalRole, new Date().toISOString());
  res.status(201).json({ user: { id, email: normalizedEmail, name, role: finalRole } });
});

usersRouter.delete('/:id', (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: 'Eigenes Konto kann nicht gelöscht werden.' });
  const info = db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Benutzer nicht gefunden.' });
  res.status(204).end();
});
