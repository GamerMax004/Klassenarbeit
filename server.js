const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'mathe10-geheim-bitte-aendern';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin2025!';

// ── Datenbank ──────────────────────────────────────────
const DB_PATH = process.env.DATABASE_URL || path.join(__dirname, 'data', 'users.db');
if (!fs.existsSync(path.dirname(DB_PATH))) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    display_name TEXT,
    blocked INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    last_login TEXT,
    progress TEXT DEFAULT '{}'
  );
`);

// ── Middleware ─────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// ── Auth Middleware ────────────────────────────────────
function requireAuth(req, res, next) {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Nicht eingeloggt' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Sitzung abgelaufen' });
  }
}

function requireAdmin(req, res, next) {
  const pw = req.headers['x-admin-password'];
  if (pw !== ADMIN_PASSWORD) return res.status(403).json({ error: 'Kein Admin-Zugriff' });
  next();
}

// ══════════════════════════════════════════════════════
// AUTH ROUTES
// ══════════════════════════════════════════════════════

// Registrieren
app.post('/api/register', (req, res) => {
  const { username, password, displayName } = req.body;

  if (!username || !password)
    return res.status(400).json({ error: 'Benutzername und Passwort erforderlich' });
  if (username.length < 3)
    return res.status(400).json({ error: 'Benutzername muss mindestens 3 Zeichen haben' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Passwort muss mindestens 6 Zeichen haben' });
  if (!/^[a-zA-Z0-9._\-äöüÄÖÜß]+$/.test(username))
    return res.status(400).json({ error: 'Benutzername darf nur Buchstaben, Zahlen und . _ - enthalten' });

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) return res.status(409).json({ error: 'Benutzername bereits vergeben' });

  const hash = bcrypt.hashSync(password, 12);
  const name = displayName?.trim() || username;

  db.prepare('INSERT INTO users (username, password_hash, display_name) VALUES (?, ?, ?)')
    .run(username, hash, name);

  res.json({ ok: true, message: 'Konto erstellt! Du kannst dich jetzt einloggen.' });
});

// Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'Benutzername und Passwort erforderlich' });

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) return res.status(401).json({ error: 'Benutzername oder Passwort falsch' });
  if (user.blocked) return res.status(403).json({ error: 'Dieses Konto wurde gesperrt. Wende dich an deinen Lehrer.' });

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Benutzername oder Passwort falsch' });

  db.prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?").run(user.id);

  const token = jwt.sign({ id: user.id, username: user.username, displayName: user.display_name }, JWT_SECRET, { expiresIn: '30d' });

  res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'Lax', maxAge: 30 * 24 * 60 * 60 * 1000 });
  res.json({ ok: true, user: { id: user.id, username: user.username, displayName: user.display_name } });
});

// Logout
app.post('/api/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

// Session prüfen
app.get('/api/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT id, username, display_name, blocked FROM users WHERE id = ?').get(req.user.id);
  if (!user || user.blocked) {
    res.clearCookie('token');
    return res.status(403).json({ error: 'Konto gesperrt oder gelöscht' });
  }
  res.json({ user: { id: user.id, username: user.username, displayName: user.display_name } });
});

// Fortschritt speichern
app.post('/api/progress', requireAuth, (req, res) => {
  const { progress } = req.body;
  db.prepare('UPDATE users SET progress = ? WHERE id = ?').run(JSON.stringify(progress), req.user.id);
  res.json({ ok: true });
});

// Fortschritt laden
app.get('/api/progress', requireAuth, (req, res) => {
  const user = db.prepare('SELECT progress FROM users WHERE id = ?').get(req.user.id);
  res.json({ progress: JSON.parse(user?.progress || '{}') });
});

// ══════════════════════════════════════════════════════
// ADMIN ROUTES
// ══════════════════════════════════════════════════════

// Alle User auflisten
app.get('/api/admin/users', requireAdmin, (req, res) => {
  const users = db.prepare(
    'SELECT id, username, display_name, blocked, created_at, last_login FROM users ORDER BY created_at DESC'
  ).all();
  res.json({ users });
});

// User-Details (inkl. Passwort-Hash für Admin)
app.get('/api/admin/users/:id', requireAdmin, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User nicht gefunden' });
  res.json({ user });
});

// User sperren / entsperren
app.patch('/api/admin/users/:id/block', requireAdmin, (req, res) => {
  const { blocked } = req.body;
  db.prepare('UPDATE users SET blocked = ? WHERE id = ?').run(blocked ? 1 : 0, req.params.id);
  res.json({ ok: true });
});

// Passwort zurücksetzen (Admin)
app.patch('/api/admin/users/:id/password', requireAdmin, (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6)
    return res.status(400).json({ error: 'Passwort muss mindestens 6 Zeichen haben' });
  const hash = bcrypt.hashSync(newPassword, 12);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.params.id);
  res.json({ ok: true });
});

// Benutzernamen ändern (Admin)
app.patch('/api/admin/users/:id/username', requireAdmin, (req, res) => {
  const { newUsername } = req.body;
  if (!newUsername) return res.status(400).json({ error: 'Benutzername fehlt' });
  try {
    db.prepare('UPDATE users SET username = ? WHERE id = ?').run(newUsername, req.params.id);
    res.json({ ok: true });
  } catch {
    res.status(409).json({ error: 'Benutzername bereits vergeben' });
  }
});

// User löschen
app.delete('/api/admin/users/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Admin-Passwort prüfen
app.post('/api/admin/verify', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) res.json({ ok: true });
  else res.status(403).json({ error: 'Falsches Passwort' });
});

// ── Catch-all: SPA ─────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`Mathe10-App läuft auf Port ${PORT}`));
