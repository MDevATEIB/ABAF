// ─── Types partagés ABAF ──────────────────────────────────────────────────────

export type Statut = 'actif' | 'inactif';

export type StatutSaison = 'ouverte' | 'fermee';

export type StatutMission =
  | 'brouillon'
  | 'arrive_usine'
  | 'pese_vide'
  | 'gasoil_pris'
  | 'en_route'
  | 'chargement'
  | 'retour_usine'
  | 'pese_charge'
  | 'poids_net_calcule'
  | 'dechargement'
  | 'valide'
  | 'facture'
  | 'paye';

export type TypePesee = 'vide' | 'charge';

export type StatutBSM = 'ouvert' | 'cloture' | 'facture';

export type StatutBordereau = 'brouillon' | 'valide' | 'facture';

export type StatutFacture = 'brouillon' | 'validee' | 'payee';

export type StatutPaiement = 'paye' | 'impaye' | 'np';

/** Types de fret du contrat 2026-2027 (CDC v1.1). */
export type TypeFret =
  | 'direct'
  | 'retour'
  | 'evacuation'
  | 'transfert'
  | 'intrant_direct'
  | 'intrant_retour'
  | 'intrant_evacuation'
  | 'intrant_transfert';

/** Unités de tarification : FCFA/tonne (≤ 90 km) et FCFA/TKM (au-delà). */
export type UniteTarif = 'fcfa_tonne' | 'fcfa_tkm';

// ─── Entités ─────────────────────────────────────────────────────────────────

export interface Saison {
  id: number;
  libelle: string;
  date_debut: string;
  date_fin?: string;
  statut: StatutSaison;
  created_at: string;
  updated_at: string;
}

export interface Tarif {
  id: number;
  saison_id: number;
  type_fret: TypeFret;
  distance_min: number;
  /** Distance de fin de tranche ; null = tranche ouverte (« X km et plus »). */
  distance_max: number | null;
  unite_tarif: UniteTarif;
  tarif: number;
  created_at: string;
  updated_at: string;
}

export interface PrixGasoil {
  id: number;
  saison_id: number;
  prix_litre: number;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: number;
  nom: string;
  adresse?: string;
  telephone?: string;
  created_at: string;
  updated_at: string;
}

export interface Camion {
  id: number;
  immatriculation: string;
  marque?: string;
  modele?: string;
  capacite_tonnes?: number;
  actif: 0 | 1;
  created_at: string;
  updated_at: string;
}

export interface Chauffeur {
  id: number;
  nom: string;
  prenom?: string;
  telephone?: string;
  actif: 0 | 1;
  created_at: string;
  updated_at: string;
}

export interface Usine {
  id: number;
  nom: string;
  localite?: string;
  created_at: string;
  updated_at: string;
}

export interface CGI {
  id: number;
  nom: string;
  usine_id: number;
  localite?: string;
  created_at: string;
  updated_at: string;
}

export interface AV {
  id: number;
  nom: string;
  cgi_id?: number;
  localite?: string;
  created_at: string;
  updated_at: string;
}

export interface Mission {
  id: number;
  saison_id: number;
  camion_id: number;
  chauffeur_id?: number;
  usine_id?: number;
  cgi_id?: number;
  av_id?: number;
  date_mission: string;
  statut: StatutMission;
  observations?: string;
  created_at: string;
  updated_at: string;
}

export interface Pesee {
  id: number;
  mission_id: number;
  camion_id: number;
  usine_id?: number;
  type_pesee: TypePesee;
  poids_kg: number;
  date_pesee: string;
  heure_pesee?: string;
  ticket_pesee?: string;
  created_at: string;
}

export interface BSM {
  id: number;
  numero: string;
  saison_id: number;
  mission_id?: number;
  camion_id: number;
  usine_id?: number;
  date_bsm: string;
  beneficiaire?: string;
  quantite_litres: number;
  prix_litre: number;
  montant: number; // colonne générée
  imputation?: string;
  reference?: string;
  statut: StatutBSM;
  created_at: string;
  updated_at: string;
}

export interface Bordereau {
  id: number;
  numero: string;
  saison_id: number;
  mission_id?: number;
  bsm_id?: number;
  camion_id: number;
  chauffeur_id?: number;
  usine_id?: number;
  cgi_id?: number;
  date_bordereau: string;
  poids_vide_kg?: number;
  poids_charge_kg?: number;
  poids_net_kg?: number; // colonne générée
  distance_km?: number;
  type_fret?: TypeFret;
  tarif_applique?: number;
  unite_tarif?: UniteTarif;
  montant_brut?: number;
  statut: StatutBordereau;
  observations?: string;
  numero_cotontchad?: string;
  created_at: string;
  updated_at: string;
}

export interface LigneBordereau {
  id: number;
  bordereau_id: number;
  av_id?: number;
  localite?: string;
  poids_kg: number;
  /** Distance de cette livraison ligne par ligne (par AV). */
  distance_km?: number;
  code?: string;
  observations?: string;
}

// ─── Synthèse des livraisons (lecture seule) ─────────────────────────────────

export interface LivraisonsParCamion {
  camion_id: number;
  nb_livraisons: number;
  poids_net_kg: number;
}

export interface LivraisonsParAv {
  av_id: number;
  nb_lots: number;
  poids_lots_kg: number;
}

export interface SyntheseLivraisons {
  nb_livraisons: number;
  poids_net_total_kg: number;
  par_camion: LivraisonsParCamion[];
  par_av: LivraisonsParAv[];
}

export interface Facture {
  id: number;
  numero: string;
  saison_id: number;
  client_id: number;
  date_facture: string;
  montant_brut: number;
  montant_gasoil: number;
  montant_net: number;
  /** Tonnes-kilomètres facturés (CDC v1.1). */
  tkm?: number;
  /** Détail des trajets imprimé sur la facture (généré à la validation). */
  detail_trajet?: string;
  /** Mention « ORIGINAL PAYABLE » imprimée sur l'exemplaire original. */
  mention_original_payable: boolean;
  statut: StatutFacture;
  observations?: string;
  created_at: string;
  updated_at: string;
}

export interface LigneFacture {
  id: number;
  facture_id: number;
  bordereau_id?: number;
  bsm_id?: number;
  description?: string;
  poids_net_kg: number;
  distance_km: number;
  tarif_tonne: number;
  montant_brut: number;
  montant_gasoil: number;
  montant_net: number;
}

/** Opérations facturables d'une campagne : bordereaux validés sans facture et BSM non facturés. */
export interface OperationsDisponiblesFacture {
  bordereaux: Bordereau[];
  bsms: BSM[];
}

export interface Paiement {
  id: number;
  facture_id: number;
  date_paiement: string;
  montant: number;
  mode_paiement?: string;
  reference?: string;
  statut: StatutPaiement;
  observations?: string;
  created_at: string;
  updated_at: string;
}

export interface Avance {
  id: number;
  saison_id: number;
  date_avance: string;
  montant_initial: number;
  montant_utilise: number;
  reference?: string;
  observations?: string;
  created_at: string;
  updated_at: string;
}

export interface UtilisationAvance {
  id: number;
  avance_id: number;
  facture_id?: number;
  date_utilisation: string;
  montant: number;
  observations?: string;
  created_at: string;
}

export interface Distance {
  id: number;
  cgi_id: number;
  usine_id: number;
  distance_km: number;
}

// ─── Rapports (Phase 5) ──────────────────────────────────────────────────────

/** Ligne du tableau des opérations (colonnes du rapport annuel, AGENT.md §7.2). */
export interface LigneRapport {
  bordereau_id: number;
  numero_bordereau: string;
  date_bordereau: string;
  numero_facture?: string;
  numero_camion?: string;
  usine?: string;
  cgi?: string;
  av?: string;
  poids_coton_kg?: number;
  poids_intrants_kg: number;
  distance_km?: number;
  gasoil_litres: number;
  gasoil_montant: number;
  montant_net?: number;
  observations?: string;
  numeros_bms?: string;
}

/** Totaux d'une campagne, toutes opérations confondues. */
export interface TotauxRapport {
  nb_missions: number;
  nb_bordereaux: number;
  nb_bsm: number;
  nb_factures: number;
  nb_paiements: number;
  tonnage_coton_kg: number;
  tonnage_intrants_kg: number;
  distance_totale_km: number;
  gasoil_litres: number;
  gasoil_montant: number;
  montant_brut: number;
  montant_gasoil: number;
  montant_net: number;
  montant_paye: number;
  montant_impaye: number;
  avances_initiales: number;
  avances_utilisees: number;
  solde_avances: number;
  // ── Synthèse exploitation (module Exploitation, hors CDC v1.1) ──────────
  /** Montant des charges d'exploitation validées de la campagne. */
  total_depenses: number;
  /** Nombre de dépenses validées. */
  depenses_validees: number;
  /** Montant des dépenses encore en brouillon (terrain non audité). */
  depenses_en_attente: number;
  /** `montant_net − total_depenses` : marge réelle du parc. */
  marge_nette: number;
}

/** Facture et montant net réellement enregistré, affichés sur le relevé. */
export interface FactureReleve {
  numero: string;
  date_facture: string;
  usine?: string;
  montant_net: number;
}

/** Récapitulatif des mouvements d'une campagne (AGENT.md §16). */
export interface Recapitulatif {
  saison_id: number;
  saison_libelle: string;
  date_debut: string;
  date_fin?: string;
  lignes: LigneRapport[];
  factures: FactureReleve[];
  totaux: TotauxRapport;
}

/** BSM listé dans les « données BMS » du rapport annuel (AGENT.md §20.4). */
export interface BsmRapport {
  numero: string;
  date_bsm: string;
  camion?: string;
  beneficiaire?: string;
  quantite_litres: number;
  montant: number;
  statut: 'ouvert' | 'cloture' | 'facture';
}

/** Règlement listé dans le rapport annuel. */
export interface PaiementRapport {
  date_paiement: string;
  numero_facture?: string;
  montant: number;
  mode_paiement?: string;
  statut: 'paye' | 'impaye' | 'np';
}

/** Ligne de comparaison avec les campagnes précédentes (AGENT.md §20.4). */
export interface ComparaisonCampagne {
  saison_id: number;
  libelle: string;
  nb_bordereaux: number;
  tonnage_coton_kg: number;
  distance_totale_km: number;
  gasoil_litres: number;
  montant_net: number;
}

/** Rapport annuel d'une campagne (AGENT.md §7 et §20.4). */
export interface RapportAnnuel {
  saison_id: number;
  saison_libelle: string;
  date_debut: string;
  date_fin?: string;
  lignes: LigneRapport[];
  totaux: TotauxRapport;
  bsms: BsmRapport[];
  paiements: PaiementRapport[];
  comparaison: ComparaisonCampagne[];
}

// ─── Tableau de bord (Phase 6) ────────────────────────────────────────────────

/**
 * Données du tableau de bord (AGENT.md §17) : indicateurs de la campagne
 * sélectionnée, camions actifs du parc et comparaison des campagnes pour
 * les graphiques.
 */
export interface DashboardStats {
  saison_id: number;
  saison_libelle: string;
  nb_camions_actifs: number;
  totaux: TotauxRapport;
  comparaison: ComparaisonCampagne[];
}

// ─── Paramètres (Phase 6) ─────────────────────────────────────────────────────

/**
 * Paramètres généraux de l'application (AGENT.md étapes 31 et 32) :
 * informations de l'entreprise utilisées dans les en-têtes des documents
 * imprimés (§20.1 BSM, §20.3 facture) et sauvegarde automatique (§24.3).
 */
export interface Parametres {
  entreprise_nom: string;
  entreprise_adresse: string;
  entreprise_telephone: string;
  entreprise_email: string;
  /** Sauvegarde automatique de la base au démarrage de l'application. */
  sauvegarde_auto: boolean;
}

// ─── Exploitation (Phase 7) ──────────────────────────────────────────────────

/**
 * Nomenclature des catégories de charges d'exploitation — miroir de
 * `models/depense.rs` côté Rust : les deux listes doivent évoluer ensemble.
 */
export const CATEGORIES_DEPENSE = [
  'gasoil_hors_bsm',
  'piece_rechange',
  'main_oeuvre',
  'depannage',
  'pneu',
  'huile_entretien',
  'chef_parc',
  'perdiem',
  'peage',
  'stationnement',
  'amende',
  'autre',
] as const;
export type CategorieDepense = (typeof CATEGORIES_DEPENSE)[number];

/** Libellés français des catégories (miroir de `libelle_categorie`). */
export const LIBELLES_CATEGORIE_DEPENSE: Record<CategorieDepense, string> = {
  gasoil_hors_bsm: 'Gasoil hors BSM',
  piece_rechange: 'Pièce de rechange',
  main_oeuvre: "Main d'œuvre mécanicien",
  depannage: 'Dépannage',
  pneu: 'Pneu',
  huile_entretien: 'Huile & entretien',
  chef_parc: 'Indemnité chef de parc',
  perdiem: 'Perdiem',
  peage: 'Péage',
  stationnement: 'Stationnement',
  amende: 'Amende',
  autre: 'Autre charge',
};

/** Libellé d'une catégorie, en tolérant une valeur hors nomenclature. */
export function libelleCategorieDepense(categorie: string): string {
  return LIBELLES_CATEGORIE_DEPENSE[categorie as CategorieDepense] ?? categorie;
}

/** `brouillon` | `validee` | `rejete` (miroir de `STATUTS_DEPENSE`). */
export type StatutDepense = 'brouillon' | 'validee' | 'rejete';

/** Origine de la saisie : poste de gestion ou téléphone de terrain. */
export type SourceDepense = 'desktop' | 'mobile';

/** Dépense d'exploitation saisie au bureau ou sur le terrain. */
export interface Depense {
  id: number;
  uuid: string;
  saison_id: number;
  camion_id?: number | null;
  mission_id?: number | null;
  chauffeur_id?: number | null;
  apprenti_id?: number | null;
  mecanicien_id?: number | null;
  piece_id?: number | null;
  categorie: string;
  designation: string;
  quantite?: number | null;
  unite?: string | null;
  montant: number;
  date_depense: string;
  lieu?: string | null;
  observations?: string | null;
  /** Nom du fichier du justificatif, la photo elle-même vit sur disque. */
  photo?: string | null;
  statut: string;
  motif_rejet?: string | null;
  source: string;
  device_id?: string | null;
  created_at: string;
  updated_at: string;
  synced_at?: string | null;
  // Libellés joints calculés à la lecture par le poste.
  camion?: string | null;
  mission?: string | null;
  chauffeur?: string | null;
  apprenti?: string | null;
  mecanicien?: string | null;
  piece?: string | null;
  /** Nom de l'appareil de terrain qui a saisi la ligne. */
  appareil?: string | null;
}

/** Champs communs à la création et à la modification d'une dépense. */
export interface DepenseFields {
  categorie: CategorieDepense;
  designation: string;
  quantite?: number | null;
  unite?: string | null;
  montant: number;
  date_depense: string;
  lieu?: string | null;
  observations?: string | null;
  camion_id?: number | null;
  mission_id?: number | null;
  chauffeur_id?: number | null;
  apprenti_id?: number | null;
  mecanicien_id?: number | null;
  piece_id?: number | null;
}

/** Filtres de la grille de dépenses : absent = pas de filtre. */
export interface FiltresDepenses {
  saison_id?: number | null;
  camion_id?: number | null;
  categorie?: string | null;
  statut?: string | null;
  source?: string | null;
  device_id?: string | null;
  date_debut?: string | null;
  date_fin?: string | null;
  recherche?: string | null;
}

/** Total par catégorie (répartition de la grille). */
export interface TotalParCategorie {
  categorie: string;
  montant: number;
  nb_lignes: number;
}

/** Synthèse d'une campagne pour les cartes du tableau de bord. */
export interface SyntheseExploitation {
  charges_valides: number;
  charges_en_attente: number;
  nb_charges: number;
  nb_charges_attente: number;
  nb_charges_rejetees: number;
}

/** Justificatif photo d'une dépense, remonté en data URL pour l'aperçu. */
export interface JustificatifDepense {
  nom: string;
  chemin: string;
  data_url: string;
}

/** Nomenclature des rôles d'intervenants du parc (miroir de `ROLES_INTERVENANT`). */
export const ROLES_INTERVENANT = ['mecanicien', 'chef_parc', 'apprenti'] as const;
export type RoleIntervenant = (typeof ROLES_INTERVENANT)[number];

export const LIBELLES_ROLE_INTERVENANT: Record<RoleIntervenant, string> = {
  mecanicien: 'Mécanicien',
  chef_parc: 'Chef de parc',
  apprenti: 'Apprenti',
};

/** Intervenant du parc : mécanicien, chef de parc ou apprenti. */
export interface Intervenant {
  id: number;
  uuid: string;
  nom: string;
  prenom?: string | null;
  telephone?: string | null;
  role: string;
  actif: number;
  source: string;
  device_id?: string | null;
  created_at: string;
  updated_at: string;
  appareil?: string | null;
  nb_depenses: number;
}

/** Pièce du catalogue des pièces de rechange. */
export interface PieceRechange {
  id: number;
  uuid: string;
  nom: string;
  categorie?: string | null;
  unite: string;
  actif: number;
  source: string;
  device_id?: string | null;
  created_at: string;
  updated_at: string;
  appareil?: string | null;
  nb_depenses: number;
}

/** Ligne de rentabilité d'un camion pour une campagne. */
export interface LigneMarge {
  camion_id: number;
  uuid: string;
  immatriculation: string;
  marque?: string | null;
  modele?: string | null;
  actif: number;
  chiffre_affaires: number;
  charges: number;
  marge: number;
  taux_marge: number;
  nb_missions: number;
  charges_en_attente: number;
  nb_charges: number;
}

/** Total des charges validées d'une catégorie, avec sa part en pourcentage. */
export interface CategorieCharge {
  categorie: string;
  montant: number;
  nb_lignes: number;
  part: number;
}

/** État d'exploitation complet d'une campagne (écran Rentabilité + export). */
export interface RapportExploitation {
  saison_id: number;
  saison_libelle: string;
  lignes: LigneMarge[];
  total_chiffre_affaires: number;
  total_charges: number;
  total_marge: number;
  par_categorie: CategorieCharge[];
  camions_sans_activite: number;
}

// ─── Synchronisation mobile (Phase 7) ────────────────────────────────────────

/** Téléphone de terrain appairé avec le poste de gestion. */
export interface Appareil {
  uuid: string;
  nom: string;
  agent: string;
  /** `actif` | `revoque`. */
  statut: string;
  created_at: string;
  last_seen_at?: string | null;
  nb_lignes_sync: number;
  last_pull_lvn: number;
  nb_changes_en_attente: number;
  nb_depenses_a_valider: number;
}

/** État du serveur de synchronisation, affiché dans Paramètres. */
export interface EtatSync {
  actif: boolean;
  port: number;
  port_decouverte: number;
  /** Adresses IPv4 du poste à communiquer au terrain. */
  adresses: string[];
  nb_appareils_actifs: number;
  nb_appareils_revoques: number;
  nb_depenses_a_valider: number;
  dernier_lvn: number;
  appairage_en_cours: boolean;
  appairage_expire_a?: string | null;
  dossier_justificatifs: string;
  nb_justificatifs: number;
  taille_justificatifs_octets: number;
}

/** Code d'appairage à six chiffres généré pour un téléphone. */
export interface CodeAppairage {
  code: string;
  expire_a: string;
  duree_secondes: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Réponse générique renvoyée par les commandes Tauri */
export interface TauriResponse<T> {
  data?: T;
  error?: string;
}
