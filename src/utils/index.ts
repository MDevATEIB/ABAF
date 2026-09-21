import type { StatutMission, TypeFret, UniteTarif } from '@/types';

/**
 * Formate un montant en FCFA
 * Ex. : 1250000 → "1 250 000 FCFA"
 */
export function formatFCFA(montant: number): string {
  return (
    new Intl.NumberFormat('fr-FR', {
      maximumFractionDigits: 0,
    }).format(montant) + ' FCFA'
  );
}

/**
 * Formate un poids en kg
 * Ex. : 24200 → "24 200 kg"
 */
export function formatKg(poids: number): string {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(poids) + ' kg';
}

/**
 * Formate une quantité de gasoil en litres
 * Ex. : 350 → "350 L"
 */
export function formatLitres(quantite: number): string {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(quantite) + ' L';
}

/**
 * Formate une distance en km
 * Ex. : 245.4 → "245,4 km"
 */
export function formatDistance(km: number): string {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(km) + ' km';
}

/**
 * Formate une date ISO en date locale française
 * Ex. : "2026-03-15" → "15/03/2026"
 */
export function formatDate(iso: string): string {
  if (!iso) return '—';
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

/**
 * Calcule le poids net coton
 * Retourne null si l'un des deux poids est absent ou si le résultat est négatif
 */
export function calculPoidsNet(poidsCharge: number, poidsVide: number): number | null {
  const net = poidsCharge - poidsVide;
  return net >= 0 ? net : null;
}

/**
 * Calcule le montant brut d'une ligne de facture
 * Montant brut = Poids net (t) × Tarif (FCFA/t)
 */
export function calculMontantBrut(poidsNetKg: number, tarifTonne: number): number {
  return (poidsNetKg / 1000) * tarifTonne;
}

/**
 * Calcule le montant gasoil
 * Montant gasoil = Quantité (L) × Prix unitaire (FCFA/L)
 */
export function calculMontantGasoil(quantiteLitres: number, prixLitre: number): number {
  return quantiteLitres * prixLitre;
}

/**
 * Calcule le montant net
 * Montant net = Montant brut − Montant gasoil
 */
export function calculMontantNet(montantBrut: number, montantGasoil: number): number {
  return montantBrut - montantGasoil;
}

/**
 * Calcule le solde d'une avance
 * Solde = Avance initiale − Montant utilisé
 */
export function calculSoldeAvance(montantInitial: number, montantUtilise: number): number {
  return montantInitial - montantUtilise;
}

// ─── Cycle de vie des missions (AGENT.md §9.2) ────────────────────────────────

/**
 * Statuts d'une mission, dans l'ordre du parcours du camion.
 */
export const STATUTS_MISSION: { value: StatutMission; label: string }[] = [
  { value: 'brouillon',         label: 'Brouillon' },
  { value: 'arrive_usine',      label: "Arrivé à l'usine" },
  { value: 'pese_vide',         label: 'Pesé à vide' },
  { value: 'gasoil_pris',       label: 'Gasoil pris' },
  { value: 'en_route',          label: 'En route' },
  { value: 'chargement',        label: 'Chargement' },
  { value: 'retour_usine',      label: "Retour à l'usine" },
  { value: 'pese_charge',       label: 'Pesé chargé' },
  { value: 'poids_net_calcule', label: 'Poids net calculé' },
  { value: 'dechargement',      label: 'Déchargement' },
  { value: 'valide',            label: 'Validé' },
  { value: 'facture',           label: 'Facturé' },
  { value: 'paye',              label: 'Payé' },
];

/** Ordre des statuts, du début à la fin du cycle de vie d'une mission. */
export const ORDRE_STATUTS_MISSION: StatutMission[] = STATUTS_MISSION.map((s) => s.value);

/** Libellé français d'un statut de mission. */
export function labelStatutMission(statut: StatutMission): string {
  return STATUTS_MISSION.find((s) => s.value === statut)?.label ?? statut;
}

/** Variante de Badge associée à un statut de mission. */
export function varianteStatutMission(statut: StatutMission): 'muted' | 'default' | 'success' {
  if (statut === 'brouillon') return 'muted';
  if (statut === 'valide' || statut === 'facture' || statut === 'paye') return 'success';
  return 'default';
}

// ─── Tarification (CDC v1.1) ─────────────────────────────────────────────────

/**
 * Types de fret du contrat 2026-2027 : direct, retour, évacuation et
 * transfert.
 */
export const TYPES_FRET: { value: TypeFret; label: string }[] = [
  { value: 'direct', label: 'Direct — coton graine' },
  { value: 'retour', label: 'Retour (à vide)' },
  { value: 'evacuation', label: 'Évacuation' },
  { value: 'transfert', label: 'Transfert' },
];

/** Libellé français d'un type de fret. */
export function labelTypeFret(typeFret: TypeFret): string {
  return TYPES_FRET.find((t) => t.value === typeFret)?.label ?? typeFret;
}

/** Libellés courts des types de fret (colonnes des tableaux). */
const LIBELLES_COURTS_FRET: Record<TypeFret, string> = {
  direct: 'Direct',
  retour: 'Retour',
  evacuation: 'Évacuation',
  transfert: 'Transfert',
};

/** Libellé court d'un type de fret, « — » lorsqu'il n'est pas renseigné. */
export function labelCourtTypeFret(typeFret: TypeFret | undefined): string {
  return typeFret ? LIBELLES_COURTS_FRET[typeFret] : '—';
}

/** Unités de tarification : FCFA/tonne (≤ 90 km) et FCFA/TKM (au-delà). */
export const UNITES_TARIF: { value: UniteTarif; label: string }[] = [
  { value: 'fcfa_tonne', label: 'FCFA / tonne (≤ 90 km)' },
  { value: 'fcfa_tkm', label: 'FCFA / tonne-km (TKM)' },
];

/** Libellé français d'une unité de tarification. */
export function labelUniteTarif(unite: UniteTarif): string {
  return UNITES_TARIF.find((u) => u.value === unite)?.label ?? unite;
}

/**
 * Libellé d'une tranche de distance : « 0 – 65 km » ou « 91 km et plus »
 * lorsque la tranche est ouverte (distance_max null).
 */
export function trancheDistance(min: number, max: number | null | undefined): string {
  if (max === null || max === undefined) return `${min} km et plus`;
  return `${min} – ${max} km`;
}

/**
 * Seuil du contrat (CDC v1.1) : jusqu'à 90 km la facturation se fait au
 * FCFA/tonne, au-delà au FCFA/TKM.
 */
export const SEUIL_KM_FACTURATION_TONNE = 90;

/**
 * Tonne-kilomètres d'un transport (CDC v1.1, §11.2) : la TKM n'est calculée
 * que pour les distances dépassant 90 km, null sinon.
 */
export function tkmLigne(poidsNetKg: number, distanceKm: number): number | null {
  if (distanceKm <= SEUIL_KM_FACTURATION_TONNE) return null;
  return (poidsNetKg / 1000) * distanceKm;
}

/**
 * Formate des tonnes-kilomètres
 * Ex. : 3660 → "3 660 TKM"
 */
export function formatTKM(tkm: number): string {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(tkm) + ' TKM';
}
