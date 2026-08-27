import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { db } from '../db.js';
import { requireAuth, requireAdmin } from '../auth.js';

export const usersRouter = Router();

// Namensliste für Dropdowns (z.B. "Probenehmer/in") — jede angemeldete Person
// darf sie sehen, unabhängig von der Rolle. Muss vor dem Admin-Guard stehen.
// `role` wird mitgeliefert, damit z.B. eine Projektleitung beim Zuweisen von
// Projekt-/Proben-Zugriff nach Rolle filtern kann (nur 'probenehmer' bzw.
// 'extern' zur Auswahl anbieten), ohne selbst Admin zu sein (die vollständige
// Benutzerliste mit E-Mail bleibt admin-exklusiv, siehe unten).
usersRouter.get('/roster', requireAuth, (req, res) => {
  const users = db.prepare('SELECT id, name, role FROM users ORDER BY name COLLATE NOCASE').all();
  res.json({ users });
});

usersRouter.use(requireAuth, requireAdmin);

const ROLES = ['admin', 'projektleiter', 'probenehmer', 'extern'];

usersRouter.get('/', (req, res) => {
  const users = db.prepare('SELECT id, email, name, role, createdAt FROM users ORDER BY createdAt').all();
  res.json({ users });
});

usersRouter.post('/', (req, res) => {
  const { email, name, password, role } = req.body || {};
  if (!email || !name || !password) return res.status(400).json({ error: 'Login (E-Mail/Kürzel), Name und Passwort erforderlich.' });
  if (password.length < 8) return res.status(400).json({ error: 'Passwort muss mindestens 8 Zeichen haben.' });
  const normalizedEmail = String(email).toLowerCase().trim();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
  if (existing) return res.status(409).json({ error: 'Dieser Login (E-Mail/Kürzel) ist bereits vergeben.' });
  const id = randomUUID();
  const passwordHash = bcrypt.hashSync(password, 12);
  const finalRole = ROLES.includes(role) ? role : 'probenehmer';
  db.prepare('INSERT INTO users (id, email, passwordHash, name, role, createdAt) VALUES (?,?,?,?,?,?)')
    .run(id, normalizedEmail, passwordHash, name, finalRole, new Date().toISOString());
  res.status(201).json({ user: { id, email: normalizedEmail, name, role: finalRole } });
});

// Rolle eines bestehenden Kontos ändern (z.B. Probenehmer/in zu Projektleitung
// hochstufen) — eigene Rolle kann nicht selbst geändert werden (verhindert,
// dass sich der letzte Admin versehentlich aussperrt).
usersRouter.put('/:id/role', (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: 'Eigene Rolle kann nicht selbst geändert werden.' });
  const { role } = req.body || {};
  if (!ROLES.includes(role)) return res.status(400).json({ error: 'Ungültige Rolle.' });
  const info = db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Benutzer nicht gefunden.' });
  const user = db.prepare('SELECT id, email, name, role, createdAt FROM users WHERE id = ?').get(req.params.id);
  res.json({ user });
});

// Passwort eines bestehenden Kontos setzen — es gibt keinen Self-Service-
// Reset per E-Mail (die App verschickt keine E-Mails, siehe README >
// Sicherheit), daher setzt der Admin ein neues Passwort direkt, z.B. wenn
// jemand sein Passwort vergessen hat. Auch für das eigene Konto erlaubt
// (anders als die Rolle — dort geht's um versehentliches Aussperren, hier
// nicht: wer sein eigenes Passwort ändert, kennt es ja gerade erst gesetzt).
usersRouter.put('/:id/password', (req, res) => {
  const { password } = req.body || {};
  if (!password || password.length < 8) return res.status(400).json({ error: 'Passwort muss mindestens 8 Zeichen haben.' });
  const passwordHash = bcrypt.hashSync(password, 12);
  const info = db.prepare('UPDATE users SET passwordHash = ? WHERE id = ?').run(passwordHash, req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Benutzer nicht gefunden.' });
  res.status(204).end();
});

usersRouter.delete('/:id', (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: 'Eigenes Konto kann nicht gelöscht werden.' });
  const info = db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Benutzer nicht gefunden.' });
  res.status(204).end();
});
