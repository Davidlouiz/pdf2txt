-- ============================================================
-- Schéma de la base PDF to TXT
-- Base locale (SQLite). Une seule table `files` suffit (section 23).
-- Ce fichier sert de référence/documentation : la table est créée
-- automatiquement au premier accès (lib/db.ts → initDb).
-- ============================================================

CREATE TABLE IF NOT EXISTS files (
  id              TEXT PRIMARY KEY,            -- UUID interne
  filename        TEXT NOT NULL,               -- nom original du PDF
  original_size   INTEGER NOT NULL,            -- taille en octets
  mime_type       TEXT NOT NULL,               -- type MIME
  status          TEXT NOT NULL DEFAULT 'uploading', -- uploading|queued|processing|completed|failed|cancelled
  upload_progress INTEGER NOT NULL DEFAULT 0,  -- progression d'upload (0-100)
  pdf_path        TEXT NOT NULL,               -- chemin physique du PDF
  txt_path        TEXT,                        -- chemin physique du TXT (null tant que non généré)
  error_message   TEXT,                        -- raison d'un échec
  created_at      TEXT NOT NULL,               -- date d'envoi
  updated_at      TEXT NOT NULL,               -- dernière mise à jour
  started_at      TEXT,                        -- début du traitement
  completed_at    TEXT                         -- fin du traitement réussi
);

CREATE INDEX IF NOT EXISTS idx_files_status  ON files(status);
CREATE INDEX IF NOT EXISTS idx_files_created ON files(created_at DESC);
