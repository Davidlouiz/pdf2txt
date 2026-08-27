# PDF to TXT

Application web **100 % locale** permettant de déposer des fichiers PDF, de les convertir
automatiquement en TXT avec `pdftotext`, puis de consulter, télécharger ou copier le texte.

- Mono-utilisateur, aucun compte, aucune authentification.
- Aucune donnée ne quitte la machine : pas de service externe, pas d'API, pas d'OCR.
- Jusqu'à **100 fichiers** par ajout, **100 Mo** max par fichier.
- **4 conversions simultanées** (configurable).
- Reprise après fermeture du navigateur / redémarrage du serveur.

---

## Architecture

```
        Navigateur
            │  HTTP
            ▼
   Next.js (UI + API)        Worker local (processus séparé)
            │                         │
            │                         ▼
   SQLite (base locale)  ←───   pdftotext (conversion)
   Stockage fichiers (pdf/ , txt/)
```

Deux processus indépendants :

1. **Next.js** (`npm run dev` ou `npm run build` + `npm run start`) — interface + API.
2. **Worker** (`npm run worker`) — exécute les conversions `pdftotext`.

Le worker étant séparé, les conversions continuent même si aucune page n'est ouverte.

> **Choix technique** : le cahier des charges recommande Supabase local + PostgreSQL, mais
> autorise explicitement (section 45) une alternative si la complexité est disproportionnée.
> Pour une robustesse et une simplicité maximales, **sans Docker ni serveur PostgreSQL**,
> ce projet utilise :
> - une base locale **SQLite** (`data/app.db`, table `files` conforme à la section 23) ;
> - un **stockage filesystem** local (`data/pdf/<uuid>.pdf`, `data/txt/<uuid>.txt`).
>
> L'ensemble fonctionne 100 % hors ligne, sans aucun service externe.

---

## Prérequis

- **Node.js ≥ 18** (testé avec Node 20)
- **pdftotext** (poppler-utils)

Vérifier :

```bash
node --version
pdftotext -v
```

Sur Debian/Ubuntu :

```bash
sudo apt install poppler-utils
```

---

## Installation

```bash
npm install
```

Cela compile la dépendance native `better-sqlite3` (précompilée pour les plateformes courantes).

---

## Configuration

Copier le fichier d'exemple si des réglages sont nécessaires (tout est optionnel) :

```bash
cp .env.local.example .env.local
```

| Variable | Défaut | Description |
|---|---|---|
| `DATA_DIR` | `./data` | Répertoire des données (PDF, TXT, base) |
| `MAX_CONCURRENT_CONVERSIONS` | `4` | Nombre de conversions simultanées |
| `PDFTOTEXT_PATH` | `pdftotext` | Chemin de l'exécutable |
| `PORT` | `3000` | Port du serveur |

La base et les répertoires de stockage sont créés automatiquement au premier accès.
Pour les créer sans lancer le serveur :

```bash
npm run db:init
```

---

## Lancement

**Terminal 1 — le serveur web** (mode développement) :

```bash
npm run dev
```

Ou en mode production :

```bash
npm run build
npm run start
```

**Terminal 2 — le worker de conversion** :

```bash
npm run worker
```

Puis ouvrir : http://localhost:3000

### Scripts de gestion

Des scripts de cycle de vie sont fournis à la racine du projet :

```bash
./start.sh      # build + démarre serveur web et worker en arrière-plan
./stop.sh       # arrête proprement serveur et worker
./restart.sh    # arrête puis redémarre
```

- Les PIDs et journaux sont stockés dans `.run/` (non versionné).
- Logs : `.run/server.log`, `.run/worker.log`, `.run/build.log`.
- Le port se change avec `PORT=3100 ./start.sh`.

## Docker

L'application peut aussi tourner dans un conteneur (serveur + worker + `pdftotext`),
avec les données persistées dans un volume Docker.

```bash
docker compose up -d --build     # http://localhost:3000
docker compose down              # arrêt (les données sont conservées)
docker compose down -v           # arrêt + suppression du volume de données
```

- Port hôte configurable : `PORT=3100 docker compose up -d`.
- Nombre de conversions : `MAX_CONCURRENT_CONVERSIONS=8 docker compose up -d`.
- Le volume `pdf2txt-data` (monté sur `/app/data`) conserve PDF, TXT et la base
  SQLite d'un redémarrage à l'autre. `restart: unless-stopped` relance le
  conteneur automatiquement.
- Le `docker-entrypoint.sh` lance le serveur et le worker ; si le worker
  s'arrête (crash), il est relancé automatiquement.

---

## Utilisation

1. Glissez-déposez des PDF (ou utilisez « Ajouter des fichiers »).
2. Les uploads démarrent avec une progression individuelle.
3. Le worker traite **4 fichiers à la fois** ; les suivants attendent.
4. Les TXT apparaissent progressivement dans la liste.
5. Téléchargez le PDF ou le TXT, ou copiez le texte dans le presse-papiers.

### Statuts

| Statut | Signification |
|---|---|
| `uploading` | Envoi vers le stockage local |
| `queued` | Uploadé, en attente de traitement |
| `processing` | En cours de conversion `pdftotext` |
| `completed` | TXT généré avec succès |
| `failed` | La conversion a échoué (raison affichée) |
| `cancelled` | Traitement annulé par l'utilisateur |

### Actions disponibles

| Statut | Actions |
|---|---|
| Uploading | (progression affichée) |
| Queued | Annuler |
| Processing | Annuler |
| Completed | Télécharger PDF, Télécharger TXT, Copier le texte, Supprimer |
| Failed | Relancer, Télécharger PDF, Supprimer |
| Cancelled | Relancer, Télécharger PDF, Supprimer |

**Relancer tous les échecs** remet tous les fichiers en échec dans la file. Les fichiers
réussis ne sont jamais retraités.

---

## Reprise après redémarrage

- L'état (statuts, historique) est persisté dans la base SQLite, pas dans le navigateur.
- À la fermeture de l'onglet, rien n'est perdu.
- Au démarrage, le worker remet les conversions laissées `processing` (crash) en `queued`
  pour les reprendre automatiquement. Un fichier déjà `completed` n'est **jamais** retraité.

---

## Structure du projet

```
app/
  page.tsx                  Interface principale
  api/
    upload/                 POST — upload streamé d'un PDF
    files/                  GET — liste · DELETE — suppression
    download/               GET — téléchargement PDF / TXT
    text/                   GET — contenu TXT (copie presse-papiers)
    retry/                  POST — relance individuelle / globale
    cancel/                 POST — annulation
components/
  FileUploader.tsx          Bouton + glisser-déposer + uploads
  FileList.tsx / FileRow.tsx
  Stats.tsx / ProgressBar.tsx
lib/
  config.ts                 Configuration centralisée
  db.ts                     Base SQLite + schéma
  types.ts / format.ts / api.ts / client-config.ts
worker/
  worker.ts                 Processus de conversion pdftotext
db/
  schema.sql                Schéma de référence
scripts/
  init-db.ts                Initialisation de la base
```

---

## Sécurité (application locale)

- Aucune commande shell n'est construite à partir du nom de fichier utilisateur
  (`pdftotext` est lancé avec des arguments séparés, jamais via une chaîne de shell).
- Les chemins physiques utilisent des **UUID**, jamais le nom utilisateur.
- Les extensions, MIME et tailles sont validées ; le contenu doit commencer par `%PDF-`.
- Le nom original n'est utilisé que pour le téléchargement (via `Content-Disposition`).
- Les limites sont centralisées dans `lib/config.ts`.
