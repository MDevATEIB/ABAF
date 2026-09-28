import type { Bordereau, BSM, Facture, Recapitulatif, StatutMission, TypeFret, UniteTarif } from '@/types';

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
 * Convertit la capacité d'un camion (en tonnes, enregistrée lors de sa
 * création) en poids à vide (tare) en kilogrammes. Cette tare est utilisée
 * par défaut pour toutes les missions du camion et pour le calcul du poids
 * brut/ net lors de la validation du bordereau.
 * Retourne undefined si la capacité n'est pas renseignée.
 */
export function capaciteToPoidsVideKg(capaciteTonnes?: number): number | undefined {
  if (capaciteTonnes === undefined || capaciteTonnes === null || Number.isNaN(capaciteTonnes)) {
    return undefined;
  }
  return capaciteTonnes * 1000;
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

// ─── Montant en lettres (FCFA) ────────────────────────────────────────────────

const UNITES = [
  '', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
  'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept',
  'dix-huit', 'dix-neuf',
];
const DIZAINES = [
  '', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante',
  'quatre-vingt', 'quatre-vingt',
];

function moinsCent(n: number): string {
  if (n < 20) return UNITES[n];
  const d = Math.floor(n / 10);
  const u = n % 10;
  const diz = DIZAINES[d];
  if (d === 7 || d === 9) {
    const base = DIZAINES[d - 1];
    const reste = n - (d - 1) * 10;
    return u === 0 ? `${diz}` : (reste === 11 ? `${base} et onze` : `${base}-${UNITES[reste]}`);
  }
  if (u === 0) return diz;
  const sep = (d === 1 || u === 1 && d < 8) ? ' et ' : '-';
  return `${diz}${sep}${UNITES[u]}`;
}

function moinsMille(n: number): string {
  const c = Math.floor(n / 100);
  const r = n % 100;
  let s = '';
  if (c > 0) {
    s = c === 1 ? 'cent' : `${UNITES[c]} cent`;
    if (r === 0 && c > 1) s += 's';
  }
  if (r > 0) s += (s ? ' ' : '') + moinsCent(r);
  return s;
}

/**
 * Convertit un entier positif en français, pour écrire le montant d'un
 * relevé ou d'une facture en toutes lettres (unités : francs CFA).
 */
function nombreEnLettres(n: number): string {
  if (!Number.isFinite(n) || n < 0) return String(n);
  n = Math.round(n);
  if (n === 0) return 'zéro';

  const milliards = Math.floor(n / 1_000_000_000);
  const millions = Math.floor((n % 1_000_000_000) / 1_000_000);
  const milliers = Math.floor((n % 1_000_000) / 1000);
  const reste = n % 1000;
  const parties: string[] = [];

  if (milliards > 0) {
    parties.push((milliards === 1 ? 'un milliard' : `${nombreEnLettres(milliards)} milliards`));
  }
  if (millions > 0) {
    parties.push((millions === 1 ? 'un million' : `${moinsMille(millions)} millions`));
  }
  if (milliers > 0) {
    parties.push((milliers === 1 ? 'mille' : `${moinsMille(milliers)} mille`));
  }
  if (reste > 0) {
    parties.push(moinsMille(reste));
  }
  return parties.join(' ');
}

/**
 * Convertit un montant FCFA en toutes lettres (français), p. ex.
 * 3988812 → "Trois millions neuf cent quatre-vingt-huit mille huit cent douze francs CFA".
 */
export function montantFCFAEnLettres(montant: number): string {
  const m = Math.round(montant);
  const lettres = nombreEnLettres(m);
  const capitalise = lettres.charAt(0).toUpperCase() + lettres.slice(1);
  return `${capitalise} franc${m > 1 ? 's' : ''} CFA`;
}

// ─── Numérotation dynamique des documents imprimés ────────────────────────────

/**
 * Extrait l'année (YYYY) à partir d'une date ISO ou d'un libellé de saison
 * (ex. : "Campagne 2025/2026" → "2026"). Retourne l'année civile par défaut.
 */
export function extraireAnneeDocument(source?: string | null): string {
  if (source) {
    const iso = source.match(/^\s*(\d{4})-?\d{0,2}/);
    if (iso?.[1]) return iso[1];
    const any = source.match(/\d{4}/g);
    if (any && any.length > 0) return any[any.length - 1];
  }
  return new Date().getFullYear().toString();
}

/**
 * Détermine le code site 2 lettres d'après le nom d'une usine :
 * Moundou → MD, Mandoul → MP, Moïssala/Moussoro → MM, Pala → PA,
 * Doba → DB, Koumra → KM, Sarh → SH, N'Djaména → ND.
 * Défaut : MD (siège d'ABAF).
 */
export function codeSiteUsine(nomUsine?: string | null): string {
  if (!nomUsine) return 'MD';
  const n = nomUsine.toUpperCase();
  if (n.includes('MOUNDOU')) return 'MD';
  if (n.includes('MANDOUL') || n.includes('MOUNDOR')) return 'MP';
  if (n.includes('MOISSALA') || n.includes('MOUSSORO') || n.includes('MOUSSOLO')) return 'MM';
  if (n.includes('PALA')) return 'PA';
  if (n.includes('DOBA')) return 'DB';
  if (n.includes('KOUMRA') || n.includes('GOUMRA')) return 'KM';
  if (n.includes('SARH') || n.includes('FORT-ARCHAMBAULT')) return 'SH';
  if (n.includes('NDJAMENA') || n.includes('N\'DJAMENA') || n.includes('DJAMENA')) return 'ND';
  return 'MD';
}

/**
 * Extrait le numéro séquentiel (chiffres) depuis un numéro d'enregistrement
 * complet. Ex. : "FACT-2026-138" → "138", "0013" → "0013".
 */
function extraireSeq(numero?: string | null): string {
  if (!numero) return '0';
  const digits = numero.match(/\d+/g);
  return digits ? digits[digits.length - 1] : numero;
}

/**
 * Numéro long de facture (format document imprimé).
 * Format : `FACTURE N°{seq}/ABAF/{code_usine}/{année}`
 * Exemple : `FACTURE N°138/ABAF/MD/2026`
 */
export function formatNumeroFacture(
  facture: Pick<Facture, 'numero' | 'date_facture'>,
  nomUsine?: string | null,
): string {
  const annee = extraireAnneeDocument(facture.date_facture);
  const site = codeSiteUsine(nomUsine);
  return `FACTURE N°${extraireSeq(facture.numero)}/ABAF/${site}/${annee}`;
}

/**
 * Numéro long de relevé de factures (format document imprimé).
 * Format : `RELEVE FACTURE N°{seq_4_chiffres}/COTON GRAINE/ABAF/{code_usine}/{année}`
 * Exemple : `RELEVE FACTURE N°0013/COTON GRAINE/ABAF/MP/2026`
 */
export function formatNumeroReleve(
  recap: Pick<Recapitulatif, 'saison_libelle' | 'date_debut' | 'date_fin' | 'totaux'>,
  nbFactures: number,
): string {
  const annee = extraireAnneeDocument(recap.date_fin || recap.date_debut || recap.saison_libelle);
  const seq = recap.totaux.nb_factures || nbFactures || 1;
  return `RELEVE FACTURE N°${String(seq).padStart(4, '0')}/COTON GRAINE/ABAF/MD/${annee}`;
}

/**
 * Numéro long de bordereau (format document imprimé).
 * Format : `BORDEREAU N°{seq}/ABAF/{code_usine}/{année}`
 */
export function formatNumeroBordereau(
  bordereau: Pick<Bordereau, 'numero' | 'date_bordereau'>,
  nomUsine?: string | null,
): string {
  const annee = extraireAnneeDocument(bordereau.date_bordereau);
  const site = codeSiteUsine(nomUsine);
  return `BORDEREAU N°${extraireSeq(bordereau.numero)}/ABAF/${site}/${annee}`;
}

/**
 * Numéro long de BSM (Bon de sortie magasin) — format document imprimé.
 * Format : `BSM N°{seq}/ABAF/{code_usine}/{année}`
 */
export function formatNumeroBsm(
  bsm: Pick<BSM, 'numero' | 'date_bsm'>,
  nomUsine?: string | null,
): string {
  const annee = extraireAnneeDocument(bsm.date_bsm);
  const site = codeSiteUsine(nomUsine);
  return `BSM N°${extraireSeq(bsm.numero)}/ABAF/${site}/${annee}`;
}

// ─── Pré-calcul du prochain numéro (commande Tauri) ───────────────────────────

import { invoke } from '@tauri-apps/api/core';

/** Type de document pris en charge par la numérotation auto. */
export type TypeDocument = 'factures' | 'bordereaux' | 'bsm';

/**
 * Interroge le backend pour obtenir le prochain numéro séquentiel qui sera
 * attribué à un document donné (format `2026-0138`). Aucune insertion en base
 * : c'est un aperçu pour pré-remplir / placeholder le formulaire de création.
 */
export async function prochainNumeroDocument(
  typeDoc: TypeDocument,
  dateIso: string,
): Promise<string> {
  return invoke<string>('prochain_numero_document', {
    typeDoc,
    dateIso,
  });
}

