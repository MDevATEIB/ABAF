import { jsPDF } from 'jspdf';

import type { RapportAnnuel } from '@/types';
import { formatDate, formatDistance, formatFCFA, formatKg, formatLitres } from '@/utils';

// ─── Mise en page (A4 paysage, millimètres) ──────────────────────────────────
const LARGEUR_PAGE = 297;
const HAUTEUR_PAGE = 210;
const MARGE = 10;
const BAS_CONTENU = HAUTEUR_PAGE - 14;

interface ColonneTableau {
  titre: string;
  largeur: number;
  align?: 'left' | 'right';
}

// ─── Aides de rendu ──────────────────────────────────────────────────────────

/**
 * Remplace les caractères absents de l'encodage WinAnsi des polices standard
 * jsPDF (tirets longs, apostrophes typographiques, espaces insécables...).
 */
function assainir(texte: string): string {
  return texte
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\u2026/g, '...')
    .replace(/[\u00A0\u202F\u2009]/g, ' ');
}

/** Tronque un texte pour qu'il tienne dans la largeur disponible. */
function tronquer(doc: jsPDF, texte: string, largeurMax: number): string {
  const propre = assainir(texte);
  if (doc.getTextWidth(propre) <= largeurMax - 2) return propre;
  let resultat = propre;
  while (resultat.length > 1 && doc.getTextWidth(`${resultat}...`) > largeurMax - 2) {
    resultat = resultat.slice(0, -1);
  }
  return `${resultat}...`;
}

function appliquerStyleTableau(doc: jsPDF): void {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(30, 30, 30);
  doc.setDrawColor(210, 210, 210);
}

function largeurTableau(colonnes: ColonneTableau[]): number {
  return colonnes.reduce((total, colonne) => total + colonne.largeur, 0);
}

function dessinerEnteteTableau(doc: jsPDF, y: number, colonnes: ColonneTableau[]): number {
  doc.setFillColor(232, 232, 232);
  doc.rect(MARGE, y, largeurTableau(colonnes), 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(40, 40, 40);
  let x = MARGE;
  for (const colonne of colonnes) {
    const texte = assainir(colonne.titre);
    if (colonne.align === 'right') {
      doc.text(texte, x + colonne.largeur - 1.5, y + 4, { align: 'right' });
    } else {
      doc.text(texte, x + 1.5, y + 4);
    }
    x += colonne.largeur;
  }
  return y + 6;
}

/** Dessine un tableau paginé et retourne la position verticale après la dernière ligne. */
function dessinerTableau(
  doc: jsPDF,
  yDepart: number,
  colonnes: ColonneTableau[],
  lignes: string[][],
): number {
  let y = yDepart;
  if (y + 12 > BAS_CONTENU) {
    doc.addPage();
    y = MARGE;
  }
  y = dessinerEnteteTableau(doc, y, colonnes);
  appliquerStyleTableau(doc);

  for (const ligne of lignes) {
    if (y + 5 > BAS_CONTENU) {
      doc.addPage();
      y = MARGE;
      y = dessinerEnteteTableau(doc, y, colonnes);
      appliquerStyleTableau(doc);
    }
    let x = MARGE;
    for (let index = 0; index < colonnes.length; index += 1) {
      const colonne = colonnes[index];
      const texte = tronquer(doc, ligne[index] ?? '', colonne.largeur);
      if (colonne.align === 'right') {
        doc.text(texte, x + colonne.largeur - 1.5, y + 3.6, { align: 'right' });
      } else {
        doc.text(texte, x + 1.5, y + 3.6);
      }
      x += colonne.largeur;
    }
    doc.line(MARGE, y + 5, MARGE + largeurTableau(colonnes), y + 5);
    y += 5;
  }
  return y;
}

function titreSection(doc: jsPDF, y: number, titre: string): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(20, 20, 20);
  doc.text(assainir(titre), MARGE, y);
  return y + 3;
}

function sautPageSiBesoin(doc: jsPDF, y: number): number {
  if (y + 12 > BAS_CONTENU) {
    doc.addPage();
    return MARGE;
  }
  return y;
}

function libelleStatutBsm(statut: string): string {
  if (statut === 'ouvert') return 'Ouvert';
  if (statut === 'cloture') return 'Cloture';
  if (statut === 'facture') return 'Facture';
  return statut;
}

function libelleStatutPaiement(statut: string): string {
  if (statut === 'paye') return 'Paye';
  if (statut === 'impaye') return 'Impaye';
  if (statut === 'np') return 'Non paye';
  return statut;
}

// ─── Générateur du rapport annuel (AGENT.md §20.4) ───────────────────────────

export function genererRapportPdf(rapport: RapportAnnuel): jsPDF {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // ── En-tête ABAF officiel ──
  const DROITE = LARGEUR_PAGE - MARGE;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  doc.text('ABAF.SARL', MARGE, 9);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(20, 20, 20);
  const activites = [
    'TRANSPORT ET TRANSIT',
    'COMMERCE GENERAL-IMPORT-EXPORT',
    'COMMISSIONNAIRE ET TRANSPORT',
    'CONSTRUCTION ET REFECTION-GENIE CIVIL',
  ];
  let yInfo = 9;
  for (const ligne of activites) {
    doc.text(assainir(ligne), DROITE, yInfo, { align: 'right' });
    yInfo += 3;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(30, 30, 30);
  doc.text('RCCMTC-MOU2016 E0152  NIF : 60008772', DROITE, yInfo, { align: 'right' });
  yInfo += 3;
  doc.text('BP : 050  Tél : 66 21 38 55 / 99 59 71 07', DROITE, yInfo, { align: 'right' });
  yInfo += 3;
  doc.text(
    assainir("Siège social : Moundou (Représentations N'djaména, Abéché, Sarh, Koumra, Doba, Kélo, Pala, N'gaoundéré)"),
    DROITE,
    yInfo,
    { align: 'right' }
  );
  yInfo += 3;
  doc.text(
    'Comptes : Ecobank 03213961801-16 ; BAC 37100746001-03 ; Orabank 20654600201-70 ; CBT 37140329301-66',
    DROITE,
    yInfo,
    { align: 'right' }
  );
  yInfo += 4;

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.line(MARGE, yInfo, DROITE, yInfo);
  yInfo += 2;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(20, 20, 20);
  doc.text('Rapport annuel', LARGEUR_PAGE / 2, yInfo + 5, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  const periode = rapport.date_fin
    ? `Campagne ${rapport.saison_libelle} - du ${formatDate(rapport.date_debut)} au ${formatDate(rapport.date_fin)}`
    : `Campagne ${rapport.saison_libelle} - du ${formatDate(rapport.date_debut)} (en cours)`;
  doc.text(assainir(periode), LARGEUR_PAGE / 2, yInfo + 10.5, { align: 'center' });

  let y = yInfo + 17;

  // ── Tableau des opérations (colonnes AGENT.md §7.2) ──
  y = titreSection(doc, y, 'Tableau des opérations');
  const colonnesOperations: ColonneTableau[] = [
    { titre: 'N° Bordereau', largeur: 20 },
    { titre: 'Date', largeur: 16 },
    { titre: 'N° Fac', largeur: 16 },
    { titre: 'N° Camion', largeur: 17 },
    { titre: 'USINE', largeur: 24 },
    { titre: 'CGI', largeur: 20 },
    { titre: 'AV', largeur: 20 },
    { titre: 'Poids Coton (kg)', largeur: 19, align: 'right' },
    { titre: 'Poids INT (kg)', largeur: 17, align: 'right' },
    { titre: 'Distance (km)', largeur: 16, align: 'right' },
    { titre: 'Gasoil (L)', largeur: 15, align: 'right' },
    { titre: 'Montant (FCFA)', largeur: 20, align: 'right' },
    { titre: 'OBSER', largeur: 38 },
    { titre: 'BMS', largeur: 19 },
  ];
  const lignesOperations = rapport.lignes.map((ligne) => [
    ligne.numero_bordereau,
    formatDate(ligne.date_bordereau),
    ligne.numero_facture ?? '-',
    ligne.numero_camion ?? '-',
    ligne.usine ?? '-',
    ligne.cgi ?? '-',
    ligne.av ?? '-',
    ligne.poids_coton_kg != null ? formatKg(ligne.poids_coton_kg) : '-',
    ligne.poids_intrants_kg > 0 ? formatKg(ligne.poids_intrants_kg) : '-',
    ligne.distance_km != null ? formatDistance(ligne.distance_km) : '-',
    ligne.gasoil_litres > 0 ? formatLitres(ligne.gasoil_litres) : '-',
    ligne.montant_net != null ? formatFCFA(ligne.montant_net) : '-',
    ligne.observations ?? '',
    ligne.numeros_bms ?? '',
  ]);
  y = dessinerTableau(doc, y, colonnesOperations, lignesOperations);
  y += 6;

  // ── Totaux de la campagne (AGENT.md §21.1) ──
  y = sautPageSiBesoin(doc, y);
  y = titreSection(doc, y, 'Totaux de la campagne');
  const totauxPaires: [string, string][] = [
    ['Missions', String(rapport.totaux.nb_missions)],
    ['Bordereaux', String(rapport.totaux.nb_bordereaux)],
    ['BSM', String(rapport.totaux.nb_bsm)],
    ['Factures', String(rapport.totaux.nb_factures)],
    ['Paiements', String(rapport.totaux.nb_paiements)],
    ['Tonnage coton', formatKg(rapport.totaux.tonnage_coton_kg)],
    ['Tonnage intrants', formatKg(rapport.totaux.tonnage_intrants_kg)],
    ['Distance totale', formatDistance(rapport.totaux.distance_totale_km)],
    ['Gasoil', formatLitres(rapport.totaux.gasoil_litres)],
    ['Montant gasoil', formatFCFA(rapport.totaux.gasoil_montant)],
    ['Montant brut', formatFCFA(rapport.totaux.montant_brut)],
    ['Montant net', formatFCFA(rapport.totaux.montant_net)],
    ['Montant payé', formatFCFA(rapport.totaux.montant_paye)],
    ['Montant impayé', formatFCFA(rapport.totaux.montant_impaye)],
    ['Solde avances', formatFCFA(rapport.totaux.solde_avances)],
  ];
  const lignesTotaux: string[][] = [];
  for (let index = 0; index < totauxPaires.length; index += 2) {
    const gauche = totauxPaires[index];
    const droite = totauxPaires[index + 1];
    lignesTotaux.push([
      gauche[0],
      gauche[1],
      droite ? droite[0] : '',
      droite ? droite[1] : '',
    ]);
  }
  const colonnesTotaux: ColonneTableau[] = [
    { titre: 'Indicateur', largeur: 60 },
    { titre: 'Valeur', largeur: 45, align: 'right' },
    { titre: 'Indicateur', largeur: 60 },
    { titre: 'Valeur', largeur: 45, align: 'right' },
  ];
  y = dessinerTableau(doc, y, colonnesTotaux, lignesTotaux);
  y += 6;

  // ── Données de gasoil (BSM) ──
  y = sautPageSiBesoin(doc, y);
  y = titreSection(doc, y, 'Données de gasoil (BSM)');
  const colonnesBsm: ColonneTableau[] = [
    { titre: 'N° BSM', largeur: 24 },
    { titre: 'Date', largeur: 18 },
    { titre: 'Camion', largeur: 24 },
    { titre: 'Bénéficiaire', largeur: 62 },
    { titre: 'Litres', largeur: 20, align: 'right' },
    { titre: 'Montant (FCFA)', largeur: 28, align: 'right' },
    { titre: 'Statut', largeur: 22 },
  ];
  const lignesBsm = rapport.bsms.map((bsm) => [
    bsm.numero,
    formatDate(bsm.date_bsm),
    bsm.camion ?? '-',
    bsm.beneficiaire ?? '-',
    formatLitres(bsm.quantite_litres),
    formatFCFA(bsm.montant),
    libelleStatutBsm(bsm.statut),
  ]);
  y = dessinerTableau(doc, y, colonnesBsm, lignesBsm);
  y += 6;

  // ── Règlements ──
  y = sautPageSiBesoin(doc, y);
  y = titreSection(doc, y, 'Règlements');
  const colonnesReglements: ColonneTableau[] = [
    { titre: 'Date', largeur: 22 },
    { titre: 'N° Facture', largeur: 30 },
    { titre: 'Montant (FCFA)', largeur: 32, align: 'right' },
    { titre: 'Mode', largeur: 45 },
    { titre: 'Statut', largeur: 25 },
  ];
  const lignesReglements = rapport.paiements.map((paiement) => [
    formatDate(paiement.date_paiement),
    paiement.numero_facture ?? '-',
    formatFCFA(paiement.montant),
    paiement.mode_paiement ?? '-',
    libelleStatutPaiement(paiement.statut),
  ]);
  y = dessinerTableau(doc, y, colonnesReglements, lignesReglements);
  y += 6;

  // ── Comparaison avec les campagnes ──
  y = sautPageSiBesoin(doc, y);
  y = titreSection(doc, y, 'Comparaison avec les campagnes');
  const colonnesComparaison: ColonneTableau[] = [
    { titre: 'Campagne', largeur: 50 },
    { titre: 'Bordereaux', largeur: 26, align: 'right' },
    { titre: 'Tonnage coton (kg)', largeur: 34, align: 'right' },
    { titre: 'Distance (km)', largeur: 28, align: 'right' },
    { titre: 'Gasoil (L)', largeur: 24, align: 'right' },
    { titre: 'Montant net (FCFA)', largeur: 34, align: 'right' },
  ];
  const lignesComparaison = rapport.comparaison.map((campagne) => [
    campagne.saison_id === rapport.saison_id
      ? `${campagne.libelle} (affichée)`
      : campagne.libelle,
    String(campagne.nb_bordereaux),
    formatKg(campagne.tonnage_coton_kg),
    formatDistance(campagne.distance_totale_km),
    formatLitres(campagne.gasoil_litres),
    formatFCFA(campagne.montant_net),
  ]);
  y = dessinerTableau(doc, y, colonnesComparaison, lignesComparaison);
  y += 6;

  // ── Observations ──
  y = sautPageSiBesoin(doc, y);
  y = titreSection(doc, y, 'Observations');
  const observations = rapport.lignes.filter(
    (ligne) => (ligne.observations ?? '').trim() !== '',
  );
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(50, 50, 50);
  if (observations.length === 0) {
    doc.text('Aucune observation enregistrée pour cette campagne.', MARGE, y + 3);
  } else {
    for (const ligne of observations) {
      if (y + 4 > BAS_CONTENU) {
        doc.addPage();
        y = MARGE;
      }
      doc.text(
        tronquer(
          doc,
          `Bordereau ${ligne.numero_bordereau} - ${ligne.observations ?? ''}`,
          LARGEUR_PAGE - 2 * MARGE,
        ),
        MARGE,
        y + 3,
      );
      y += 4;
    }
  }

  // ── Pieds de page ──
  const nombrePages = doc.getNumberOfPages();
  const genereLe = new Date().toLocaleString('fr-FR');
  for (let page = 1; page <= nombrePages; page += 1) {
    doc.setPage(page);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(120, 120, 120);
    doc.text(
      assainir(
        `Rapport annuel ${rapport.saison_libelle} - page ${page}/${nombrePages} - généré le ${genereLe}`,
      ),
      LARGEUR_PAGE / 2,
      HAUTEUR_PAGE - 6,
      { align: 'center' },
    );
  }

  return doc;
}
