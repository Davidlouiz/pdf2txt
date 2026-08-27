/**
 * Worker de conversion PDF → TXT (processus séparé).
 *
 * - Surveille les fichiers `queued` en base.
 * - Traite au maximum `config.maxConcurrentConversions` fichiers simultanément.
 * - Exécute `pdftotext` localement (aucune API externe).
 * - Gère l'annulation (tue proprement le processus pdftotext).
 * - Au démarrage, remet les fichiers `processing` abandonnés en `queued`
 *   (reprise après redémarrage, cf. section 28 et 46).
 *
 * Lancement : `npm run worker` (processus indépendant de l'interface web).
 */
import { spawn, type ChildProcess } from 'child_process';
import fs from 'fs';
import { config, pdfPath, txtPath } from '../lib/config';
import { getDb, initDb, nowIso, type FileRow } from '../lib/db';

// Processus pdftotext actifs, indexés par id de fichier.
const active = new Map<string, ChildProcess>();

function log(msg: string): void {
  console.log(`[worker ${new Date().toISOString()}] ${msg}`);
}

/** Met à jour la progression "processing" d'un fichier. */
function setProcessing(row: FileRow): void {
  getDb()
    .prepare(
      `UPDATE files SET status = 'processing', started_at = ?, updated_at = ? WHERE id = ?`,
    )
    .run(nowIso(), nowIso(), row.id);
}

/** Marque un fichier comme terminé avec succès. */
function setCompleted(row: FileRow, txtOut: string): void {
  getDb()
    .prepare(
      `UPDATE files SET status = 'completed', completed_at = ?, txt_path = ?, error_message = NULL, updated_at = ? WHERE id = ?`,
    )
    .run(nowIso(), txtOut, nowIso(), row.id);
}

/** Marque un fichier comme échec avec un message. */
function setFailed(row: FileRow, message: string): void {
  getDb()
    .prepare(
      `UPDATE files SET status = 'failed', error_message = ?, txt_path = NULL, completed_at = NULL, updated_at = ? WHERE id = ?`,
    )
    .run(message, nowIso(), row.id);
}

/** Lance pdftotext pour un fichier. */
function processFile(row: FileRow): void {
  const input = pdfPath(row.id);
  const output = txtPath(row.id);

  if (!fs.existsSync(input)) {
    setFailed(row, "Le fichier PDF est introuvable sur le disque.");
    return;
  }

  let proc: ChildProcess;
  try {
    proc = spawn(config.pdftotextPath, [input, output], {
      stdio: ['ignore', 'ignore', 'pipe'],
    });
  } catch (err) {
    setFailed(row, `Impossible de lancer pdftotext : ${String(err)}`);
    return;
  }

  active.set(row.id, proc);
  let stderr = '';

  proc.stderr?.on('data', (d: Buffer) => {
    stderr += d.toString();
  });

  proc.on('error', (err: Error) => {
    active.delete(row.id);
    setFailed(row, `pdftotext n'a pas pu démarrer : ${err.message}`);
  });

  proc.on('close', (code: number | null) => {
    active.delete(row.id);

    // L'utilisateur a annulé : on n'écrase pas le statut 'cancelled' et on
    // supprime le TXT partiel éventuel (un fichier annulé n'est pas valide).
    const cur = getDb().prepare('SELECT status FROM files WHERE id = ?').get(row.id) as
      | { status: string }
      | undefined;
    if (cur && cur.status === 'cancelled') {
      try {
        fs.unlinkSync(output);
      } catch {
        /* rien */
      }
      return;
    }

    if (code === 0 && fs.existsSync(output)) {
      setCompleted(row, output);
      log(`Terminé : ${row.filename}`);
    } else {
      let msg: string;
      if (code === null) {
        msg = 'Traitement interrompu.';
      } else if (code !== 0) {
        msg = `pdftotext a retourné le code d'erreur ${code}.`;
      } else {
        msg = "Aucun texte exploitable n'a pu être extrait du PDF.";
      }
      const detail = stderr.trim();
      if (detail) msg += ` (${detail.slice(0, 300)})`;
      setFailed(row, msg);
      log(`Échec : ${row.filename} → ${msg}`);
      try {
        fs.unlinkSync(output);
      } catch {
        /* rien */
      }
    }
  });
}

/**
 * Réclame jusqu'à `slots` fichiers en attente (statut `queued`), du plus ancien
 * au plus récent, sans doublon (chaque fichier n'est traité qu'une fois).
 */
function claimJobs(slots: number): FileRow[] {
  return getDb()
    .prepare('SELECT * FROM files WHERE status = ? ORDER BY created_at ASC, rowid ASC LIMIT ?')
    .all('queued', slots) as FileRow[];
}

/** Boucle de traitement, appelée périodiquement. */
function tick(): void {
  const db = getDb();

  // Annulation : tue les pdftotext dont le fichier a été marqué 'cancelled'.
  for (const [id, proc] of active) {
    const row = db.prepare('SELECT status FROM files WHERE id = ?').get(id) as
      | { status: string }
      | undefined;
    if (row && row.status === 'cancelled' && !proc.killed) {
      proc.kill();
      log(`Annulation du traitement : ${id}`);
    }
  }

  // Remplit les créneaux libres.
  const slots = config.maxConcurrentConversions - active.size;
  if (slots > 0) {
    const jobs = claimJobs(slots);
    for (const job of jobs) {
      setProcessing(job);
      processFile(job);
      log(`Démarrage du traitement : ${job.filename}`);
    }
  }
}

function shutdown(): void {
  log('Arrêt du worker…');
  for (const proc of active.values()) {
    if (!proc.killed) proc.kill();
  }
  process.exit(0);
}

function main(): void {
  const db = initDb();
  log(`Worker démarré — pdftotext : ${config.pdftotextPath}`);
  log(`Concurrence maximale : ${config.maxConcurrentConversions}`);

  // Reprise : tout traitement laissé `processing` par un crash est remis en
  // attente (les fichiers `completed` ne sont jamais retraités).
  const reset = db
    .prepare(
      `UPDATE files SET status = 'queued', started_at = NULL, updated_at = ? WHERE status = 'processing'`,
    )
    .run(nowIso());
  if (reset.changes > 0) {
    log(`${reset.changes} traitement(s) interrompu(s) remis en attente.`);
  }

  setInterval(tick, 1000);
  tick();

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main();
