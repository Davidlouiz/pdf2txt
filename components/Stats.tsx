'use client';
import type { FileRow } from '@/lib/types';

interface Props {
  files: FileRow[];
}

export default function Stats({ files }: Props) {
  const counts = {
    completed: files.filter((f) => f.status === 'completed').length,
    processing: files.filter((f) => f.status === 'processing').length,
    queued: files.filter((f) => f.status === 'queued').length,
    failed: files.filter((f) => f.status === 'failed').length,
  };

  return (
    <div className="stats">
      <div className="stat">
        <span className="num">{files.length}</span>
        <span className="label">fichier{files.length > 1 ? 's' : ''}</span>
      </div>
      <div className="stat completed">
        <span className="num">{counts.completed}</span>
        <span className="label">Terminés</span>
      </div>
      <div className="stat processing">
        <span className="num">{counts.processing}</span>
        <span className="label">En cours</span>
      </div>
      <div className="stat queued">
        <span className="num">{counts.queued}</span>
        <span className="label">En attente</span>
      </div>
      <div className="stat failed">
        <span className="num">{counts.failed}</span>
        <span className="label">Échecs</span>
      </div>
    </div>
  );
}
