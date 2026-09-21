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
export type TypeFret = 'direct' | 'retour' | 'evacuation' | 'transfert';

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
  created_at: string;
  updated_at: string;
}

export interface LigneBordereau {
  id: number;
  bordereau_id: number;
  av_id?: number;
  localite?: string;
  poids_kg: number;
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
}

/** Récapitulatif des mouvements d'une campagne (AGENT.md §16). */
export interface Recapitulatif {
  saison_id: number;
  saison_libelle: string;
  date_debut: string;
  date_fin?: string;
  lignes: LigneRapport[];
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Réponse générique renvoyée par les commandes Tauri */
export interface TauriResponse<T> {
  data?: T;
  error?: string;
}
