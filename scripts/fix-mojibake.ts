/**
 * Répare les noms de fichiers corrompus (mojibake) dans la base.
 *
 * Avant l'ajout de `defParamCharset: 'utf8'`, busboy décodait les noms UTF-8
 * comme du latin1, produisant par ex. "août" → "aoÃ»t". Ce script restaure
 * les noms concernés en ré-encodant en latin1 puis en décodant en UTF-8.
 *
 * Usage : npm run db:fix-filenames
 */
import { getDb, initDb } from '../lib/db';

function repairMojibake(s: string): string {
  try {
    const bytes = Buffer.from(s, 'latin1');
    const fixed = bytes.toString('utf8');
    // Rejet si le résultat contient des caractères de remplacement ou si rien
    // ne change, et garde de cohérence : ré-encoder doit redonner l'original.
    if (fixed.includes('\uFFFD')) return s;
    if (fixed === s) return s;
    if (Buffer.from(fixed, 'utf8').toString('latin1') !== s) return s;
    return fixed;
  } catch {
    return s;
  }
}

function main(): void {
  initDb();
  const db = getDb();
  const rows = db.prepare('SELECT id, filename FROM files').all() as {
    id: string;
    filename: string;
  }[];

  let fixed = 0;
  const update = db.prepare('UPDATE files SET filename = ? WHERE id = ?');
  for (const row of rows) {
    const repaired = repairMojibake(row.filename);
    if (repaired !== row.filename) {
      update.run(repaired, row.id);
      fixed += 1;
      console.log(`Corrigé : "${row.filename}" → "${repaired}"`);
    }
  }
  console.log(`${fixed} nom(s) de fichier corrigé(s) sur ${rows.length}.`);
}

main();
