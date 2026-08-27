import { NextRequest } from 'next/server';
import { getDb, nowIso, getFile } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/retry
 * Corps : { "id": "<uuid>" }  → relance un fichier en échec/annulé.
 * Corps : { "all": true }     → relance tous les fichiers en échec.
 * Les fichiers réussis ne sont jamais retraités.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { id?: string; all?: boolean } | null;
  const db = getDb();

  if (body && body.all) {
    const res = db
      .prepare(
        `UPDATE files SET status = 'queued', error_message = NULL, txt_path = NULL,
         started_at = NULL, completed_at = NULL, updated_at = ? WHERE status = 'failed'`,
      )
      .run(nowIso());
    return Response.json({ ok: true, count: res.changes });
  }

  if (body && body.id) {
    const row = getFile(body.id);
    if (!row) return Response.json({ error: 'Fichier introuvable.' }, { status: 404 });
    if (row.status !== 'failed' && row.status !== 'cancelled') {
      return Response.json(
        { error: "Seuls les fichiers en échec ou annulés peuvent être relancés." },
        { status: 409 },
      );
    }
    db.prepare(
      `UPDATE files SET status = 'queued', error_message = NULL, txt_path = NULL,
       started_at = NULL, completed_at = NULL, updated_at = ? WHERE id = ?`,
    ).run(nowIso(), body.id);
    return Response.json({ ok: true });
  }

  return Response.json({ error: 'Paramètres invalides.' }, { status: 400 });
}
