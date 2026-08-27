'use client';
import { useState } from 'react';
import type { FileRow } from '@/lib/types';
import { formatSize, formatDate } from '@/lib/format';
import { postJson, del, getText, triggerDownload } from '@/lib/api';
import ProgressBar from './ProgressBar';

const STATUS_LABEL: Record<string, string> = {
  uploading: 'Upload',
  queued: 'En attente',
  processing: 'Traitement en cours...',
  completed: 'Terminé',
  failed: 'Échec',
  cancelled: 'Annulé',
};

interface Props {
  file: FileRow;
  onRefresh: () => void;
  onToast: (msg: string) => void;
}

export default function FileRow({ file, onRefresh, onToast }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const run = async (fn: () => Promise<void>, then: () => void = onRefresh) => {
    setBusy(true);
    try {
      await fn();
      then();
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Une erreur est survenue.');
    } finally {
      setBusy(false);
    }
  };

  const copyText = () =>
    run(async () => {
      const text = await getText(`/api/text?id=${encodeURIComponent(file.id)}`);
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });

  return (
    <div className="file-row">
      <div className="file-head">
        <div>
          <div className="file-name">{file.filename}</div>
          <div className="file-meta">
            Envoyé le {formatDate(file.created_at)} · {formatSize(file.original_size)}
          </div>
        </div>
        <div className={`status ${file.status}`}>
          <span className="dot" />
          {STATUS_LABEL[file.status] ?? file.status}
        </div>
      </div>

      {file.status === 'processing' && (
        <div className="progress-wrap">
          <div className="progress-label">
            <span className="spinner" /> Conversion en cours...
          </div>
        </div>
      )}

      {file.status === 'uploading' && (
        <div className="progress-wrap">
          <div className="progress-label">Upload : {file.upload_progress} %</div>
          <ProgressBar percent={file.upload_progress} />
        </div>
      )}

      {file.status === 'failed' && file.error_message && (
        <div className="error-msg">{file.error_message}</div>
      )}

      <div className="actions">
        {file.status === 'completed' && (
          <>
            <button
              className="small"
              onClick={() => triggerDownload(`/api/download?id=${encodeURIComponent(file.id)}&type=pdf`)}
            >
              Télécharger PDF
            </button>
            <button
              className="small"
              onClick={() => triggerDownload(`/api/download?id=${encodeURIComponent(file.id)}&type=txt`)}
            >
              Télécharger TXT
            </button>
            <button className="small" onClick={copyText} disabled={busy || copied}>
              {copied ? 'Copié !' : 'Copier le texte'}
            </button>
            <button className="small danger" onClick={() => setConfirming(true)}>
              Supprimer
            </button>
          </>
        )}

        {(file.status === 'failed' || file.status === 'cancelled') && (
          <>
            <button
              className="small primary"
              disabled={busy}
              onClick={() => run(() => postJson('/api/retry', { id: file.id }))}
            >
              Relancer
            </button>
            <button
              className="small"
              onClick={() => triggerDownload(`/api/download?id=${encodeURIComponent(file.id)}&type=pdf`)}
            >
              Télécharger PDF
            </button>
            <button className="small danger" onClick={() => setConfirming(true)}>
              Supprimer
            </button>
          </>
        )}

        {(file.status === 'queued' || file.status === 'processing') && (
          <button
            className="small"
            disabled={busy}
            onClick={() => run(() => postJson('/api/cancel', { id: file.id }))}
          >
            Annuler
          </button>
        )}
      </div>

      {confirming && (
        <div className="overlay" onClick={() => setConfirming(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Supprimer ce fichier ?</h3>
            <p>
              Le PDF et le TXT de « {file.filename} » seront définitivement supprimés. Cette
              action est irréversible.
            </p>
            <div className="actions">
              <button onClick={() => setConfirming(false)}>Annuler</button>
              <button
                className="danger"
                disabled={busy}
                onClick={() => {
                  setConfirming(false);
                  run(() => del(`/api/files?id=${encodeURIComponent(file.id)}`));
                }}
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
