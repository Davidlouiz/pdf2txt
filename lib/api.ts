/** Helpers réseau côté client (aucune dépendance Node). */

export async function postJson<T = unknown>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Erreur (${res.status})`);
  }
  return data as T;
}

export async function del(url: string): Promise<void> {
  const res = await fetch(url, { method: 'DELETE' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Erreur (${res.status})`);
  }
}

export async function getText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || `Erreur (${res.status})`);
  }
  return res.text();
}

/** Déclenche un téléchargement via une ancre temporaire. */
export function triggerDownload(url: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = '';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
