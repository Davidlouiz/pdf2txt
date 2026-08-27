'use client';
import { useRef, useState, useCallback } from 'react';
import {
  MAX_FILE_SIZE_BYTES,
  MAX_FILE_SIZE_MB,
  MAX_FILES_PER_UPLOAD,
  UPLOAD_CONCURRENCY,
} from '@/lib/client-config';

export interface UploadHandlers {
  /** Ajoute une entrée d'upload transitoire, retourne son localId. */
  onAdd(filename: string): string;
  onProgress(localId: string, percent: number): void;
  onDone(localId: string): void;
  /** Signal une erreur d'upload (l'entrée est retirée, l'erreur affichée). */
  onError(localId: string, message: string): void;
}

interface Props {
  handlers: UploadHandlers;
  onRefresh: () => void;
}

export default function FileUploader({ handlers, onRefresh }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);

  const uploadOne = useCallback(
    (file: File, done: () => void) => {
      const localId = handlers.onAdd(file.name);
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/upload');
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          handlers.onProgress(localId, Math.round((e.loaded / e.total) * 100));
        }
      };
      xhr.onerror = () => {
        handlers.onError(localId, "Erreur réseau pendant l'upload.");
        done();
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          handlers.onDone(localId);
        } else {
          let msg = `Erreur d'upload (${xhr.status}).`;
          try {
            const j = JSON.parse(xhr.responseText);
            if (j && j.error) msg = j.error;
          } catch {
            /* pas de JSON */
          }
          handlers.onError(localId, msg);
        }
        done();
      };
      const fd = new FormData();
      fd.append('file', file, file.name);
      xhr.send(fd);
      onRefresh();
    },
    [handlers, onRefresh],
  );

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      const files = Array.from(fileList);
      const problemsLocal: string[] = [];
      const toUpload: File[] = [];

      for (const f of files) {
        if (!f.name.toLowerCase().endsWith('.pdf')) {
          problemsLocal.push(`« ${f.name} » : seuls les fichiers PDF sont acceptés.`);
          continue;
        }
        if (f.size > MAX_FILE_SIZE_BYTES) {
          problemsLocal.push(
            `« ${f.name} » : dépasse la taille maximale de ${MAX_FILE_SIZE_MB} Mo.`,
          );
          continue;
        }
        toUpload.push(f);
      }

      if (toUpload.length > MAX_FILES_PER_UPLOAD) {
        problemsLocal.push(
          `Maximum ${MAX_FILES_PER_UPLOAD} fichiers par opération (${toUpload.length - MAX_FILES_PER_UPLOAD} fichier(s) ignoré(s)).`,
        );
        toUpload.splice(MAX_FILES_PER_UPLOAD);
      }
      setProblems(problemsLocal);

      if (toUpload.length === 0) return;
      setUploading(true);

      let cursor = 0;
      let active = 0;
      const done = () => {
        active -= 1;
        if (cursor < toUpload.length) {
          const f = toUpload[cursor++];
          active += 1;
          uploadOne(f, done);
        } else if (active <= 0) {
          setUploading(false);
        }
      };
      const initial = Math.min(UPLOAD_CONCURRENCY, toUpload.length);
      for (let i = 0; i < initial; i++) {
        active += 1;
        const f = toUpload[cursor++];
        uploadOne(f, done);
      }
    },
    [uploadOne],
  );

  return (
    <div className="card">
      <div
        className={`dropzone${dragging ? ' dragging' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
      >
        <div className="hint">Glissez-déposez vos fichiers PDF ici</div>
        <div className="badge">
          PDF uniquement · max {MAX_FILE_SIZE_MB} Mo · {MAX_FILES_PER_UPLOAD} fichiers max
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        hidden
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = '';
        }}
      />

      <div className="upload-actions">
        <button
          type="button"
          className="primary"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          Ajouter des fichiers
        </button>
      </div>

      {uploading && <div className="badge" style={{ marginTop: 12 }}>Upload en cours…</div>}

      {problems.length > 0 && (
        <div className="error-msg" style={{ marginTop: 12 }}>
          {problems.map((p, i) => (
            <div key={i}>{p}</div>
          ))}
        </div>
      )}
    </div>
  );
}
