'use client';
import type { FileRow } from '@/lib/types';
import FileRowComponent from './FileRow';

interface Props {
  files: FileRow[];
  onRefresh: () => void;
  onToast: (msg: string) => void;
}

export default function FileList({ files, onRefresh, onToast }: Props) {
  if (files.length === 0) {
    return <div className="empty">Aucun fichier pour le moment.</div>;
  }
  return (
    <div className="list">
      {files.map((f) => (
        <FileRowComponent key={f.id} file={f} onRefresh={onRefresh} onToast={onToast} />
      ))}
    </div>
  );
}
