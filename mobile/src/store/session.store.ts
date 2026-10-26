/**
 * Session de l'appareil : hôte/port du poste, device_uuid, agent, et le jeton
 * secret (jamais en SQLite — `expo-secure-store` uniquement).
 */
import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { getMeta, META_CLES, setMeta } from '../db/client';

const CLE_JETON = 'abaf_sync_token';

export interface EtatSession {
  charge: boolean;
  host: string | null;
  port: number;
  deviceUuid: string | null;
  nomAppareil: string;
  agent: string;
  saisonActiveUuid: string | null;
  saisonActiveLibelle: string | null;
  jetonPresent: boolean;
}

interface ActionsSession {
  restaurer: () => Promise<void>;
  enregistrerAppairage: (params: {
    host: string;
    port: number;
    token: string;
    deviceUuid: string;
    nomAppareil: string;
    agent: string;
    saisonActive: { uuid: string; libelle: string } | null;
  }) => Promise<void>;
  deconnecter: () => Promise<void>;
  getJeton: () => Promise<string | null>;
}

const JOUES: EtatSession = {
  charge: false,
  host: null,
  port: 9470,
  deviceUuid: null,
  nomAppareil: '',
  agent: '',
  saisonActiveUuid: null,
  saisonActiveLibelle: null,
  jetonPresent: false,
};

export const useSession = create<EtatSession & ActionsSession>((set, get) => ({
  ...JOUES,

  restaurer: async () => {
    const [host, port, deviceUuid, nomAppareil, agent, saisonUuid, saisonLibelle, jeton] =
      await Promise.all([
        getMeta(META_CLES.host),
        getMetaNumberSafe(META_CLES.port, 9470),
        getMeta(META_CLES.deviceUuid),
        getMeta(META_CLES.nomAppareil),
        getMeta(META_CLES.agent),
        getMeta(META_CLES.saisonActiveUuid),
        getMeta(META_CLES.saisonActiveLibelle),
        SecureStore.getItemAsync(CLE_JETON),
      ]);
    set({
      charge: true,
      host,
      port,
      deviceUuid,
      nomAppareil: nomAppareil ?? '',
      agent: agent ?? '',
      saisonActiveUuid: saisonUuid,
      saisonActiveLibelle: saisonLibelle,
      jetonPresent: jeton !== null,
    });
  },

  enregistrerAppairage: async ({ host, port, token, deviceUuid, nomAppareil, agent, saisonActive }) => {
    await SecureStore.setItemAsync(CLE_JETON, token);
    await Promise.all([
      setMeta(META_CLES.host, host),
      setMeta(META_CLES.port, String(port)),
      setMeta(META_CLES.deviceUuid, deviceUuid),
      setMeta(META_CLES.nomAppareil, nomAppareil),
      setMeta(META_CLES.agent, agent),
      setMeta(META_CLES.saisonActiveUuid, saisonActive?.uuid ?? null),
      setMeta(META_CLES.saisonActiveLibelle, saisonActive?.libelle ?? null),
    ]);
    set({
      host,
      port,
      deviceUuid,
      nomAppareil,
      agent,
      saisonActiveUuid: saisonActive?.uuid ?? null,
      saisonActiveLibelle: saisonActive?.libelle ?? null,
      jetonPresent: true,
    });
  },

  deconnecter: async () => {
    await SecureStore.deleteItemAsync(CLE_JETON);
    await Promise.all([
      setMeta(META_CLES.deviceUuid, null),
      setMeta(META_CLES.host, null),
      setMeta(META_CLES.saisonActiveUuid, null),
      setMeta(META_CLES.saisonActiveLibelle, null),
    ]);
    set({ ...JOUES, charge: true });
  },

  getJeton: async () => SecureStore.getItemAsync(CLE_JETON),
}));

async function getMetaNumberSafe(cle: string, defaut: number): Promise<number> {
  try {
    const brut = await getMeta(cle);
    const n = brut === null ? NaN : Number(brut);
    return Number.isFinite(n) ? n : defaut;
  } catch {
    return defaut;
  }
}

/** URL de base du poste, ou null hors connexion. */
export function baseUrlSession(etat: Pick<EtatSession, 'host' | 'port'>): string | null {
  if (!etat.host) return null;
  return `http://${etat.host}:${etat.port}`;
}

/// Une session exploitable exige un poste joint, un device appairé et un jeton.
export function sessionComplete(etat: EtatSession): boolean {
  return Boolean(etat.host && etat.deviceUuid && etat.jetonPresent);
}
