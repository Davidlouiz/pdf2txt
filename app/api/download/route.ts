import { NextRequest } from 'next/server';
import fs from 'fs';
import { Readable } from 'stream';
import { getFile } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function contentDisposition(name: string): string {
  const ascii = name.replace(/[^\x20-\x7E]/g, '_');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

/**
 * GET /api/download?id=<uuid>&type=pdf|txt
 * Télécharge le PDF original ou le TXT généré (streamé, pas en mémoire).
 */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  const type = req.nextUrl.searchParams.get('type');
  if (!id || (type !== 'pdf' && type !== 'txt')) {
    return Response.json({ error: 'Paramètres invalides.' }, { status: 400 });
  }

  const row = getFile(id);
  if (!row) return Response.json({ error: 'Fichier introuvable.' }, { status: 404 });

  let filePath: string;
  let contentType: string;
  let downloadName: string;

  if (type === 'pdf') {
    filePath = row.pdf_path;
    contentType = 'application/pdf';
    downloadName = row.filename;
  } else {
    if (row.status !== 'completed' || !row.txt_path) {
      return Response.json({ error: 'Le TXT n’est pas encore disponible.' }, { status: 404 });
    }
    filePath = row.txt_path;
    contentType = 'text/plain; charset=utf-8';
    downloadName = row.filename.replace(/\.pdf$/i, '') + '.txt';
  }

  if (!fs.existsSync(filePath)) {
    return Response.json({ error: 'Fichier introuvable sur le disque.' }, { status: 404 });
  }

  const stat = fs.statSync(filePath);
  const stream = fs.createReadStream(filePath);
  return new Response(Readable.toWeb(stream) as never, {
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(stat.size),
      'Content-Disposition': contentDisposition(downloadName),
      'Cache-Control': 'private, max-age=0, no-store',
    },
  });
}
