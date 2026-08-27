export type FileStatus =
  | 'uploading'
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface FileRow {
  id: string;
  filename: string;
  original_size: number;
  mime_type: string;
  status: FileStatus;
  upload_progress: number;
  pdf_path: string;
  txt_path: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
}

/** Entrée d'upload en cours côté client (provisoire, non encore en base). */
export interface UploadingEntry {
  localId: string;
  filename: string;
  percent: number;
}
