/**
 * Découverte du poste ABAF depuis le téléphone.
 *
 * Le serveur UDP 9471 du poste répond à `ABAF_DISCOVER?`, mais Expo Go
 * n'expose pas de sockets UDP côté client : le mobile sonde donc les
 * passerelles connues des hotspots en `GET /sync/hello` (sans jeton), puis
 * laisse la saisie manuelle `IP:port` en dernier recours. Les deux topologies
 * (hotspot du téléphone ou du PC) sont couvertes par ces adresses fixes.
 */
import type { HelloResponse } from '../types/api';

export const PASSERELLES_CANDIDATES = ['192.168.43.1', '172.20.10.1', '192.168.137.1'];
export const PORT_DEFAUT = 9470;

const SONDE_TIMEOUT_MS = 2500;

export interface PosteTrouve {
  host: string;
  port: number;
  hello: HelloResponse;
}

async function sonner(host: string, port: number): Promise<PosteTrouve | null> {
  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), SONDE_TIMEOUT_MS);
  try {
    const reponse = await fetch(`http://${host}:${port}/sync/hello`, { signal: controleur.signal });
    if (!reponse.ok) return null;
    const hello = (await reponse.json()) as HelloResponse;
    if (hello.server_name !== 'ABAF') return null;
    return { host, port, hello };
  } catch {
    return null;
  } finally {
    clearTimeout(minuteur);
  }
}

/** Sonde les passerelles en parallèle ; renvoie le premier poste ABAF trouvé. */
export async function decouvrirPoste(port = PORT_DEFAUT): Promise<PosteTrouve | null> {
  const resultats = await Promise.all(PASSERELLES_CANDIDATES.map((h) => sonner(h, port)));
  return resultats.find((r): r is PosteTrouve => r !== null) ?? null;
}

/** Saisie manuelle : vérifie qu'un poste ABAF répond bien à cette adresse. */
export async function sonnerAdresse(host: string, port: number): Promise<PosteTrouve | null> {
  return sonner(host, port);
}
