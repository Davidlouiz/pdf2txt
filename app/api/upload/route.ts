import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import busboy from 'busboy';
import { config, pdfPath } from '@/lib/config';
import { getDb, nowIso } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/upload
 * Reçoit UN fichier PDF en multipart et le streame vers le stockage local
 * (jamais chargé en mémoire intégralement, cf. section 29).
 */
export async function POST(req: NextRequest) {
  const body = req.body;
  if (!body) return Response.json({ error: 'Corps de requête vide.' }, { status: 400 });

  const contentType = req.headers.get('content-type') || 'application/octet-stream';
  const nodeStream = Readable.fromWeb(body as never);
  const bb = busboy({
    headers: { 'content-type': contentType },
    limits: { fileSize: config.maxFileSizeBytes, files: 1, fields: 0 },
  });

  const db = getDb();
  const id = randomUUID();
  const outPath = pdfPath(id);
  let filename = 'fichier.pdf';
  let size = 0;
  let uploadError: { code: number; message: string } | null = null;

  return new Promise<Response>((resolve) => {
    bb.on('file', (_fieldname, file, info) => {
      filename = info.filename || 'fichier.pdf';
      const ext = path.extname(filename).toLowerCase();
      if (ext !== '.pdf') {
        uploadError = { code: 400, message: 'Seuls les fichiers PDF sont acceptés.' };
        file.resume();
        return;
      }

      // Entrée créée en base : statut uploading (progression 0).
      db.prepare(
        `INSERT INTO files (id, filename, original_size, mime_type, status, upload_progress, pdf_path, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'uploading', 0, ?, ?, ?)`,
      ).run(id, filename, 0, info.mimeType || 'application/pdf', outPath, nowIso(), nowIso());

      const ws = fs.createWriteStream(outPath);
      let first = true;

      file.on('limit', () => {
        uploadError = {
          code: 413,
          message: `Le fichier dépasse la taille maximale de ${config.maxFileSizeMB} Mo.`,
        };
      });

      file.on('data', (chunk: Buffer) => {
        if (first) {
          first = false;
          const head = chunk.toString('latin1', 0, Math.min(5, chunk.length));
          if (head !== '%PDF-') {
            uploadError = { code: 400, message: "Le fichier n'est pas un PDF valide." };
          }
        }
        size += chunk.length;
      });

      file.pipe(ws);
      ws.on('error', () => {
        if (!uploadError) uploadError = { code: 500, message: "Erreur d'écriture sur le disque." };
      });
    });

    bb.on('close', () => {
      if (uploadError) {
        try {
          fs.unlinkSync(outPath);
        } catch {
          /* rien */
        }
        db.prepare('DELETE FROM files WHERE id = ?').run(id);
        resolve(Response.json({ error: uploadError.message }, { status: uploadError.code }));
        return;
      }

      db.prepare(
        `UPDATE files SET status = 'queued', upload_progress = 100, original_size = ?, updated_at = ? WHERE id = ?`,
      ).run(size, nowIso(), id);
      const row = db.prepare('SELECT * FROM files WHERE id = ?').get(id);
      resolve(Response.json(row));
    });

    nodeStream.pipe(bb);
  });
}
