import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { signToken, requireAuth } from '../auth.js';
import { loginRateLimit, recordLoginAttempt } from '../rate-limit.js';

export const authRouter = Router();

authRouter.post('/login', loginRateLimit, (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'E-Mail und Passwort erforderlich.' });
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email).toLowerCase().trim());
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    recordLoginAttempt(req, false);
    return res.status(401).json({ error: 'E-Mail oder Passwort falsch.' });
  }
  recordLoginAttempt(req, true);
  const token = signToken(user);
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});
