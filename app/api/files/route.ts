import { NextRequest } from 'next/server';
import { getDb, deleteFile, listFiles } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/files — liste de tous les fichiers, du plus récent au plus ancien. */
export async function GET() {
  return Response.json(listFiles());
}

/** DELETE /api/files?id=<uuid> — suppression définitive (PDF + TXT + base). */
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return Response.json({ error: 'Identifiant manquant.' }, { status: 400 });

  const db = getDb();
  const row = db.prepare('SELECT status FROM files WHERE id = ?').get(id) as
    | { status: string }
    | undefined;
  if (!row) return Response.json({ error: 'Fichier introuvable.' }, { status: 404 });
  if (row.status === 'processing') {
    return Response.json(
      { error: "Impossible de supprimer un fichier en cours de traitement." },
      { status: 409 },
    );
  }

  const ok = deleteFile(id);
  return ok
    ? Response.json({ ok: true })
    : Response.json({ error: 'Fichier introuvable.' }, { status: 404 });
}
