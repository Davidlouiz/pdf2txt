import Database from 'better-sqlite3';
import fs from 'fs';
import { config, pdfPath, txtPath } from './config';

let db: Database.Database | null = null;

/**
 * Initialise la base SQLite locale et garantit le schéma (cf. cahier des
 * charges, section 23). Crée aussi les répertoires de stockage.
 */
export function initDb(): Database.Database {
  if (db) return db;

  fs.mkdirSync(config.pdfDir, { recursive: true });
  fs.mkdirSync(config.txtDir, { recursive: true });

  db = new Database(config.dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS files (
      id              TEXT PRIMARY KEY,
      filename        TEXT NOT NULL,
      original_size   INTEGER NOT NULL,
      mime_type       TEXT NOT NULL,
      status          TEXT NOT NULL DEFAULT 'uploading',
      upload_progress INTEGER NOT NULL DEFAULT 0,
      pdf_path        TEXT NOT NULL,
      txt_path        TEXT,
      error_message   TEXT,
      created_at      TEXT NOT NULL,
      updated_at      TEXT NOT NULL,
      started_at      TEXT,
      completed_at    TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_files_status  ON files(status);
    CREATE INDEX IF NOT EXISTS idx_files_created ON files(created_at DESC);
  `);
  return db;
}

export function getDb(): Database.Database {
  return db ?? initDb();
}

export interface FileRow {
  id: string;
  filename: string;
  original_size: number;
  mime_type: string;
  status: string;
  upload_progress: number;
  pdf_path: string;
  txt_path: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function getFile(id: string): FileRow | undefined {
  return getDb().prepare('SELECT * FROM files WHERE id = ?').get(id) as FileRow | undefined;
}

export function listFiles(): FileRow[] {
  return getDb()
    .prepare('SELECT * FROM files ORDER BY created_at DESC, rowid DESC')
    .all() as FileRow[];
}

/** Supprime un fichier de la base + les objets sur le disque (PDF et TXT). */
export function deleteFile(id: string): boolean {
  const row = getFile(id);
  if (!row) return false;
  for (const p of [row.pdf_path, row.txt_path]) {
    if (p) {
      try {
        fs.unlinkSync(p);
      } catch {
        /* fichier déjà absent : sans objet */
      }
    }
  }
  getDb().prepare('DELETE FROM files WHERE id = ?').run(id);
  return true;
}

export { pdfPath, txtPath };
