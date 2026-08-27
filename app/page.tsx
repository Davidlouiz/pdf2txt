'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { FileRow, UploadingEntry } from '@/lib/types';
import FileUploader, { type UploadHandlers } from '@/components/FileUploader';
import FileList from '@/components/FileList';
import Stats from '@/components/Stats';
import { postJson } from '@/lib/api';

export default function Home() {
  const [files, setFiles] = useState<FileRow[]>([]);
  const [uploads, setUploads] = useState<UploadingEntry[]>([]);
  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/files');
      const data = await res.json();
      if (Array.isArray(data)) setFiles(data);
    } catch {
      /* serveur temporairement indisponible */
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const t = setInterval(refresh, 1500);
    return () => clearInterval(t);
  }, [refresh]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2400);
  }, []);

  const uploadHandlers: UploadHandlers = {
    onAdd: (filename) => {
      const localId = crypto.randomUUID();
      setUploads((u) => [...u, { localId, filename, percent: 0 }]);
      return localId;
    },
    onProgress: (localId, percent) =>
      setUploads((u) => u.map((x) => (x.localId === localId ? { ...x, percent } : x))),
    onDone: (localId) => setUploads((u) => u.filter((x) => x.localId !== localId)),
    onError: (localId, message) => {
      setUploads((u) => u.filter((x) => x.localId !== localId));
      showToast(message);
    },
  };

  const retryAll = async () => {
    try {
      await postJson('/api/retry', { all: true });
      await refresh();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Une erreur est survenue.');
    }
  };

  const failedCount = files.filter((f) => f.status === 'failed').length;

  // Entrées d'upload transitoires, fusionnées avec la liste persistante.
  const uploadRows: FileRow[] = uploads.map((u) => ({
    id: u.localId,
    filename: u.filename,
    original_size: 0,
    mime_type: 'application/pdf',
    status: 'uploading',
    upload_progress: u.percent,
    pdf_path: '',
    txt_path: null,
    error_message: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    started_at: null,
    completed_at: null,
  }));
  const merged: FileRow[] = [...uploadRows, ...files];

  return (
    <div className="container">
      <h1>PDF to TXT</h1>

      <FileUploader handlers={uploadHandlers} onRefresh={refresh} />

      <Stats files={files} />

      {failedCount > 0 && (
        <div className="card" style={{ padding: 14 }}>
          <button className="danger" onClick={retryAll}>
            Relancer tous les échecs ({failedCount})
          </button>
        </div>
      )}

      <FileList files={merged} onRefresh={refresh} onToast={showToast} />

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
