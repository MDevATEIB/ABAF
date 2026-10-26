/**
 * Le poste écrit `updated_at` avec `datetime('now')` (SQLite) :
 * `YYYY-MM-DD HH:MM:SS` en UTC. Le LWW du serveur étant une comparaison lexicale,
 * le mobile doit produire exactement le même format, ni `T` ni `Z`.
 */

export function nowSqlite(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ` +
    `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`
  );
}

/** Date locale `YYYY-MM-DD` pour le champ `date_depense`. */
export function todayDate(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** `2025-01-15` → `15/01/2025` (journal et listes). */
export function formatDateCourte(date: string | null): string {
  if (!date) return '—';
  const [annee, mois, jour] = date.slice(0, 10).split('-');
  return jour && mois && annee ? `${jour}/${mois}/${annee}` : date;
}

/** FCFA sans décimale, séparateur d'espace. */
export function formatFCFA(montant: number | null | undefined): string {
  if (montant === null || montant === undefined || !Number.isFinite(montant)) return '—';
  return `${Math.round(montant).toLocaleString('fr-FR').replace(/\s/g, ' ')} FCFA`;
}

/** Écart d'horloge mobile/serveur en minutes (avertissement si > 5 min). */
export function ecartHorlogeMinutes(serverTime: string): number {
  const serveur = Date.parse(serverTime.replace(' ', 'T') + 'Z');
  if (Number.isNaN(serveur)) return 0;
  return Math.round((Date.now() - serveur) / 60000);
}
