# Mathe 10 – Lernapp

Interaktive Lernapp für Klasse 10 – Exponentialfunktionen & Logarithmen  
Hollenberg-Gymnasium Waldbröl

---

## 🚀 Deployment auf Render.com

### Schritt 1 – GitHub Repository erstellen

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/DEIN-NAME/mathe10-lernapp.git
git push -u origin main
```

### Schritt 2 – Render Web Service erstellen

1. **render.com** → „New +" → „Web Service"
2. GitHub-Repository verbinden
3. Einstellungen:
   | Feld | Wert |
   |------|------|
   | Name | `mathe10-lernapp` |
   | Runtime | `Node` |
   | Build Command | `npm install` |
   | Start Command | `npm start` |

### Schritt 3 – Umgebungsvariablen setzen

Im Render-Dashboard unter **Environment**:

| Variable | Wert | Beschreibung |
|----------|------|--------------|
| `NODE_ENV` | `production` | Pflicht |
| `JWT_SECRET` | *zufälliger langer String* | Für Session-Tokens – **geheim halten!** |
| `ADMIN_PASSWORD` | *dein Passwort* | Admin-Dashboard-Zugang |

> **JWT_SECRET** Beispiel: `openssl rand -base64 32` im Terminal ausführen

### Schritt 4 – Disk hinzufügen (für Datenbank)

Im Render-Dashboard unter **Disks** → „Add Disk":

| Feld | Wert |
|------|------|
| Name | `db` |
| Mount Path | `/app/data` |
| Size | `1 GB` |

> ⚠️ Ohne Disk gehen alle Nutzerdaten beim Neustart verloren!

### Schritt 5 – Deploy

Render deployed automatisch. Nach ca. 2 Minuten ist die App erreichbar unter:  
`https://mathe10-lernapp.onrender.com`

---

## 🔐 Admin-Dashboard

- Auf der Login-Seite unten auf **„Administrator-Zugang"** klicken
- Admin-Passwort eingeben (aus `ADMIN_PASSWORD` Umgebungsvariable)
- Im Dashboard: Benutzer einsehen, sperren, entsperren, Passwort zurücksetzen, löschen

> **Standard-Passwort** (nur lokal): `Admin2025!`  
> Vor dem Deploy unbedingt in Render ändern!

---

## 💻 Lokale Entwicklung

```bash
npm install
node server.js
# App läuft auf http://localhost:3000
```

---

## 📁 Projektstruktur

```
mathe10-lernapp/
├── server.js          # Express-Server + API-Routen
├── package.json
├── render.yaml        # Render-Deployment-Konfiguration
├── .gitignore
├── data/              # SQLite-Datenbank (wird automatisch erstellt)
│   └── users.db
└── public/
    └── index.html     # Komplettes Frontend (Single Page App)
```

---

## 🛡️ Sicherheit

- Passwörter werden mit **bcrypt (Kostenfaktor 12)** gehasht – niemals im Klartext gespeichert
- Sessions über **JWT-Cookies** (httpOnly, SameSite=Lax)
- Admin-Routen durch **separates Admin-Passwort** geschützt
- Benutzernamen-Validierung verhindert Sonderzeichen
