/**
 * Appairage : code à 6 chiffres généré au poste, jeton renvoyé une seule fois.
 * En cas de jeton refusé plus tard (révocation), le téléphone repasse par ici.
 */
import { requete } from './client';
import { useSession } from '../store/session.store';
import type { PairResponse } from '../types/api';

export async function appairer(
  host: string,
  port: number,
  code: string,
  nomAppareil: string,
  agent: string,
): Promise<PairResponse> {
  const reponse = await requete<PairResponse>('/sync/pair', {
    base: `http://${host}:${port}`,
    sansJeton: true,
    corps: { code, nom_appareil: nomAppareil.trim(), agent: agent.trim() },
  });
  await useSession
    .getState()
    .enregistrerAppairage({
      host,
      port,
      token: reponse.token,
      deviceUuid: reponse.device_uuid,
      nomAppareil: nomAppareil.trim(),
      agent: agent.trim(),
      saisonActive: reponse.saison_active,
    });
  return reponse;
}
