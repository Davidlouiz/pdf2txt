/**
 * Miroir côté client des limites du serveur (lib/config.ts).
 * Doit rester en phase avec la configuration centralisée.
 */
export const MAX_FILE_SIZE_MB = 100;
export const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024;
export const MAX_FILES_PER_UPLOAD = 100;
export const UPLOAD_CONCURRENCY = 4;
