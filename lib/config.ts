import path from 'path';

/**
 * Configuration centralisée du projet (cf. cahier des charges, section 35).
 * Toutes les valeurs sont surchargeables via variables d'environnement.
 */
function envNumber(name: string, def: number): number {
  const v = process.env[name];
  if (v === undefined || v === '') return def;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : def;
}

const MB = 1024 * 1024;

// Répertoire racine des données (PDF, TXT, base SQLite).
const dataDir = path.resolve(process.env.DATA_DIR || path.join(process.cwd(), 'data'));

export const config = {
  /** Taille maximale d'un fichier PDF (octets). */
  maxFileSizeBytes: 100 * MB,
  /** Taille maximale affichée (Mo). */
  maxFileSizeMB: 100,
  /** Nombre maximal de fichiers par opération d'ajout. */
  maxFilesPerUpload: 100,
  /** Nombre maximal de conversions pdftotext simultanées. */
  maxConcurrentConversions: envNumber('MAX_CONCURRENT_CONVERSIONS', 4),
  /** Chemin de l'exécutable pdftotext. */
  pdftotextPath: process.env.PDFTOTEXT_PATH || 'pdftotext',
  /** Répertoire racine des données. */
  dataDir,
  /** Chemin de la base SQLite. */
  dbPath: process.env.DB_PATH || path.join(dataDir, 'app.db'),
  /** Répertoire des PDF originaux. */
  pdfDir: path.join(dataDir, 'pdf'),
  /** Répertoire des TXT générés. */
  txtDir: path.join(dataDir, 'txt'),
};

/** Chemin physique du PDF pour un uuid (nom = uuid, jamais le nom utilisateur). */
export function pdfPath(uuid: string): string {
  return path.join(config.pdfDir, `${uuid}.pdf`);
}

/** Chemin physique du TXT pour un uuid. */
export function txtPath(uuid: string): string {
  return path.join(config.txtDir, `${uuid}.txt`);
}
