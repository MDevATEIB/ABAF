/**
 * Client HTTP du protocole de synchronisation.
 * Timeout 8 s, retry backoff 1/2/4 s sur les erreurs réseau seulement,
 * erreurs typées pour que l'UI distingue hors-ligne / jeton révoqué / serveur absent.
 */
import { useSession } from '../store/session.store';

export type ErreurSynchro =
  | { genre: 'horsLigne' }
  | { genre: 'serveurAbsent'; detail: string }
  | { genre: 'nonAuthorise'; reason: string }
  | { genre: 'codeInvalide' }
  | { genre: 'serveur'; status: number; detail: string };

export class SynchroError extends Error {
  genre: ErreurSynchro['genre'];
  status: number;
  reason?: string;

  constructor(erreur: ErreurSynchro) {
    super(decireErreur(erreur));
    this.genre = erreur.genre;
    this.status = erreur.genre === 'serveur' ? erreur.status : erreur.genre === 'nonAuthorise' ? 401 : 0;
    if (erreur.genre === 'nonAuthorise' || erreur.genre === 'serveur') {
      this.reason = 'detail' in erreur ? erreur.detail : undefined;
    }
  }
}

export function decireErreur(e: ErreurSynchro): string {
  switch (e.genre) {
    case 'horsLigne':
      return 'Aucune connexion réseau avec le poste.';
    case 'serveurAbsent':
      return `Poste injoignable (${e.detail}).`;
    case 'nonAuthorise':
      return 'Jeton refusé : appareil révoqué ou session à refaire.';
    case 'codeInvalide':
      return 'Code d’appairage invalide ou expiré.';
    case 'serveur':
      return `Erreur poste (${e.status}) : ${e.detail}`;
  }
}

interface ReponseAttendue {
  status: number;
  body: unknown;
}

const TIMEOUT_MS = 8000;
const BACKOFF_MS = [0, 1000, 2000, 4000];

function estErreurReseau(e: unknown): boolean {
  // RN lève des TypeError ("Network request failed") sans code quand le host est mort.
  return e instanceof TypeError || (e instanceof Error && /network|timeout|abort/i.test(e.message));
}

async function fetchAvecTimeout(url: string, init: RequestInit): Promise<Response> {
  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controleur.signal });
  } finally {
    clearTimeout(minuteur);
  }
}

async function uneTentative(url: string, init: RequestInit): Promise<ReponseAttendue> {
  const reponse = await fetchAvecTimeout(url, init);
  const texte = await reponse.text();
  let corps: unknown = null;
  try {
    corps = texte ? JSON.parse(texte) : null;
  } catch {
    corps = texte;
  }
  return { status: reponse.status, body: corps };
}

/** POST/GET JSON typé avec jetons. `sansJeton` pour /sync/hello et /sync/pair. */
export async function requete<T>(
  chemin: string,
  options: { methode?: 'GET' | 'POST'; corps?: unknown; sansJeton?: boolean; base?: string } = {},
): Promise<T> {
  const base = options.base ?? (await baseUrlCourante());
  if (!base) throw new SynchroError({ genre: 'horsLigne' });
  const url = `${base}${chemin}`;

  const session = useSession.getState();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (!options.sansJeton) {
    const token = await session.getJeton();
    if (!session.deviceUuid || !token) throw new SynchroError({ genre: 'nonAuthorise', reason: 'jeton_manquant' });
    headers['X-Device'] = session.deviceUuid;
    headers['X-Token'] = token;
  }

  let derniere: ErreurSynchro = { genre: 'horsLigne' };
  for (const delai of BACKOFF_MS) {
    if (delai > 0) await new Promise((r) => setTimeout(r, delai));
    try {
      const { status, body } = await uneTentative(url, {
        method: options.methode ?? 'POST',
        headers,
        body: options.corps === undefined ? undefined : JSON.stringify(options.corps),
      });
      if (status === 401 || status === 403) {
        const reason = (body as { erreur?: string } | null)?.erreur ?? 'non_authorise';
        if (reason === 'code_invalide' || reason === 'code_expire') throw new SynchroError({ genre: 'codeInvalide' });
        throw new SynchroError({ genre: 'nonAuthorise', reason });
      }
      if (status >= 400) {
        const detail =
          (body as { erreur?: string; detail?: string } | null)?.detail ??
          (body as { erreur?: string } | null)?.erreur ??
          `HTTP ${status}`;
        // 4xx : l'état du poste, pas le réseau — on ne retry pas.
        throw new SynchroError({ genre: 'serveur', status, detail });
      }
      return body as T;
    } catch (e) {
      if (e instanceof SynchroError) throw e;
      if (!estErreurReseau(e)) throw new SynchroError({ genre: 'serveurAbsent', detail: String(e) });
      derniere = { genre: 'horsLigne' };
    }
  }
  throw new SynchroError(derniere);
}

async function baseUrlCourante(): Promise<string | null> {
  const { host, port } = useSession.getState();
  if (!host) return null;
  return `http://${host}:${port}`;
}

/** Message d'erreur lisible d'une exception quelconque. */
export function messageErreur(e: unknown): string {
  if (e instanceof SynchroError) return decireErreur({ genre: e.genre, status: e.status, detail: e.reason ?? '' } as ErreurSynchro);
  if (e instanceof Error) return e.message;
  return String(e);
}
