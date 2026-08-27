import { NextRequest } from 'next/server';
import fs from 'fs';
import { getFile } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/text?id=<uuid> — renvoie le contenu du TXT (pour "Copier le texte"). */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return Response.json({ error: 'Identifiant manquant.' }, { status: 400 });

  const row = getFile(id);
  if (!row) return Response.json({ error: 'Fichier introuvable.' }, { status: 404 });
  if (row.status !== 'completed' || !row.txt_path) {
    return Response.json({ error: 'Le TXT n’est pas encore disponible.' }, { status: 404 });
  }
  if (!fs.existsSync(row.txt_path)) {
    return Response.json({ error: 'Fichier introuvable sur le disque.' }, { status: 404 });
  }

  const content = fs.readFileSync(row.txt_path, 'utf8');
  return new Response(content, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
