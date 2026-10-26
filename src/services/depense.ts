import { invoke } from '@tauri-apps/api/core';
import type {
  Depense,
  DepenseFields,
  FiltresDepenses,
  JustificatifDepense,
  RapportExploitation,
  SyntheseExploitation,
  TotalParCategorie,
  CategorieCharge,
  LigneMarge,
} from '@/types';

/**
 * Liste les dépenses d'exploitation avec filtres. La pagination est assurée
 * côté interface (`usePagination`), comme pour les autres grilles du poste.
 * Les clés de `filtres` restent en snake_case : elles traversent serde tel
 * quel vers `FiltresDepenses` côté Rust.
 */
export async function listerDepenses(
  filtres: FiltresDepenses = {},
  tri?: string,
  ordre?: 'asc' | 'desc',
): Promise<Depense[]> {
  return invoke<Depense[]>('lister_depenses', {
    filtres,
    tri: tri ?? null,
    ordre: ordre ?? null,
  });
}

export async function getDepense(id: number): Promise<Depense> {
  return invoke<Depense>('get_depense', { id });
}

/** Création au bureau : la ligne naît en brouillon, la validation est un geste d'audit distinct. */
export async function creerDepense(
  payload: { saison_id: number } & DepenseFields,
): Promise<Depense> {
  return invoke<Depense>('creer_depense', { payload });
}

export async function modifierDepense(id: number, payload: DepenseFields): Promise<Depense> {
  return invoke<Depense>('modifier_depense', { id, payload });
}

export async function validerDepense(id: number): Promise<Depense> {
  return invoke<Depense>('valider_depense', { id });
}

/** Rejet avec motif obligatoire : le motif sert de retour au terrain. */
export async function rejeterDepense(id: number, motif: string): Promise<Depense> {
  return invoke<Depense>('rejeter_depense', { id, motif });
}

/** Suppression bloquée si la dépense est validée (elle est déjà dans la marge). */
export async function supprimerDepense(id: number): Promise<void> {
  return invoke<void>('supprimer_depense', { id });
}

/** Justificatif photo pour l'aperçu de la fiche de détail (`null` si absent). */
export async function getJustificatifDepense(id: number): Promise<JustificatifDepense | null> {
  return invoke<JustificatifDepense | null>('get_justificatif_depense', { id });
}

export async function totaliserDepensesParCategorie(
  saisonId?: number,
): Promise<TotalParCategorie[]> {
  return invoke<TotalParCategorie[]>('totaliser_depenses_par_categorie', {
    saisonId: saisonId ?? null,
  });
}

/** Charges de la campagne pour les cartes du tableau de bord. */
export async function getSyntheseExploitation(saisonId?: number): Promise<SyntheseExploitation> {
  return invoke<SyntheseExploitation>('get_synthese_exploitation', {
    saisonId: saisonId ?? null,
  });
}

export async function getRepartitionDepenses(saisonId?: number): Promise<CategorieCharge[]> {
  return invoke<CategorieCharge[]>('get_repartition_depenses', { saisonId: saisonId ?? null });
}

export async function getMargeParCamion(saisonId?: number): Promise<LigneMarge[]> {
  return invoke<LigneMarge[]>('get_marge_par_camion', { saisonId: saisonId ?? null });
}

/** État d'exploitation complet, prêt pour l'écran de rentabilité et l'export. */
export async function getRapportExploitation(saisonId?: number): Promise<RapportExploitation> {
  return invoke<RapportExploitation>('get_rapport_exploitation', { saisonId: saisonId ?? null });
}
