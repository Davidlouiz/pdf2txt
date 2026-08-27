/** Formatage d'une taille d'octets en "Mo" / "Ko" lisible. */
export function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} Ko`;
  }
  return `${bytes} o`;
}

/** Formatage d'un timestamp ISO en "JJ/MM/AAAA à HH:MM". */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} à ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
