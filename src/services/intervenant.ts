import { invoke } from '@tauri-apps/api/core';
import type { Intervenant, RoleIntervenant } from '@/types';

export interface FiltresIntervenants {
  role?: RoleIntervenant;
  /** 1 = actifs uniquement, 0 = inactifs, absent = tous. */
  actif?: 0 | 1;
  recherche?: string;
}

export async function listerIntervenants(filtres: FiltresIntervenants = {}): Promise<Intervenant[]> {
  return invoke<Intervenant[]>('lister_intervenants', {
    role: filtres.role ?? null,
    actif: filtres.actif ?? null,
    recherche: filtres.recherche ?? null,
  });
}

export async function creerIntervenant(payload: {
  nom: string;
  prenom?: string;
  telephone?: string;
  role: RoleIntervenant;
}): Promise<Intervenant> {
  return invoke<Intervenant>('creer_intervenant', { payload });
}

export async function modifierIntervenant(
  id: number,
  payload: {
    nom?: string;
    prenom?: string;
    telephone?: string;
    role?: RoleIntervenant;
  },
): Promise<Intervenant> {
  return invoke<Intervenant>('modifier_intervenant', { id, payload });
}

/** Réactive si l'intervenant est inactif, désactive sinon. */
export async function desactiverIntervenant(id: number): Promise<Intervenant> {
  return invoke<Intervenant>('desactiver_intervenant', { id });
}
