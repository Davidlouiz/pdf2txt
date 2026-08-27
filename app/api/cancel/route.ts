import { NextRequest } from 'next/server';
import { getDb, nowIso, getFile } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/cancel   Corps : { "id": "<uuid>" }
 * Annule un fichier en attente (`queued`) ou en cours de traitement
 * (`processing`). Pour un fichier en traitement, le worker tue proprement
 * pdftotext ; le statut passe à `cancelled` et aucun TXT n'est considéré valide.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { id?: string } | null;
  if (!body || !body.id) {
    return Response.json({ error: 'Identifiant manquant.' }, { status: 400 });
  }

  const db = getDb();
  const row = getFile(body.id);
  if (!row) return Response.json({ error: 'Fichier introuvable.' }, { status: 404 });
  if (row.status !== 'queued' && row.status !== 'processing') {
    return Response.json(
      { error: "Ce fichier ne peut pas être annulé dans son état actuel." },
      { status: 409 },
    );
  }

  db.prepare(
    `UPDATE files SET status = 'cancelled', started_at = NULL, updated_at = ? WHERE id = ?`,
  ).run(nowIso(), body.id);
  return Response.json({ ok: true });
}
