CAHIER DES CHARGES TECHNIQUE
SYSTÈME DE GESTION ABAF – ACTIVITÉ COTON GRAINE AVEC BSM
Version : 1.0
Date : 2026
Client : ABAF SARL
Destinataire : Équipe de développement
Technologies : Tauri + React + SQLite + Print HTML
Chemin du projet : C:\Users\acer\Dev\Projects\ABAF
________________________________________
TABLE DES MATIÈRES
1.	Contexte et objectifs
2.	Périmètre fonctionnel
3.	Architecture technique
4.	Modèle de données
5.	Spécifications fonctionnelles
6.	Instructions de développement pas à pas
7.	Spécifications des documents
8.	Règles de gestion
9.	Tests et recette
10.	Déploiement
11.	Planning
12.	Livrables
13.	Conclusion
________________________________________
1. CONTEXTE ET OBJECTIFS
1.1. Contexte
ABAF SARL est une société de commerce général, import-export, commissionnaire et transport basée à Moundou (Tchad).
Elle assure notamment le transport de coton graine et d'intrants agricoles pour le compte de son client COTONTCHAD SN, depuis les CGI (Centres de Gestion Intégrés) vers les usines de COTONTCHAD SN.
Actuellement, la gestion de l'activité repose principalement sur des fichiers Excel remplis manuellement et sur plusieurs documents opérationnels.
Le fonctionnement réel d'une opération de transport doit être pris en compte dans le futur système.
Avant d'aller charger le coton graine, le camion se rend d'abord à l'usine afin de :
1.	effectuer une pesée à vide ;
2.	prendre le gasoil nécessaire à la mission ;
3.	quitter l'usine pour se rendre au site de chargement ;
4.	charger le coton graine ;
5.	revenir à l'usine ;
6.	effectuer une nouvelle pesée avec le camion chargé ;
7.	déterminer le poids net du coton par différence entre le poids chargé et le poids vide initial ;
8.	procéder au déchargement ;
9.	enregistrer et clôturer les mouvements liés à la mission.
Les documents utilisés dans ce processus comprennent notamment :
•	le bordereau de livraison / transport ;
•	le document de gasoil / BSM ;
•	le document Récap, qui récapitule les différents mouvements ;
•	les documents de facturation et de paiement.
Le futur logiciel devra donc être conçu autour du processus réel de l'activité, et non autour d'une simple reproduction des tableaux Excel.
La gestion manuelle actuelle entraîne notamment :
•	des erreurs de saisie fréquentes ;
•	des doubles saisies ;
•	des pertes de temps considérables ;
•	un manque de traçabilité ;
•	des difficultés de consolidation ;
•	des risques d'incohérence entre les documents ;
•	des difficultés de suivi ;
•	une génération manuelle des rapports ;
•	des risques de fraude ou de modification non tracée.
L'objectif est donc de construire un système dans lequel une information est saisie une seule fois, puis réutilisée automatiquement dans les différents documents, états et rapports.
________________________________________
1.2. Objectifs
Objectif	Description
Centraliser	Toutes les données dans une base de données unique
Automatiser	Les calculs de poids, montants, tarifs et autres données dérivées
Tracer	Chaque opération et chaque document : BSM, bordereau, facture, paiement
Générer	Les documents nécessaires à l'activité
Suivre	Les paiements et les avances
Produire	Le Rapport Annuel automatiquement
Fiabiliser	Les données et les rapports
Gagner du temps	Éviter les doubles saisies et automatiser les calculs
Modéliser	Reproduire fidèlement le fonctionnement réel de l'activité ABAF
________________________________________
1.3. Contraintes
Contrainte	Description
Desktop uniquement	Application locale, sans application web
Personnel ABAF uniquement	Utilisation interne
Hors ligne	Fonctionnement sans connexion Internet
Client unique	COTONTCHAD SN
Une campagne par année	Campagne coton graine et intrants
Tarifs fixes	Définis avant la campagne et fixes pour la campagne
Prix gasoil fixe	Défini avant la campagne et fixe pour la campagne
Budget	Avances fournies par COTONTCHAD SN
Pas d'authentification	Accès direct à l'application
Pas de gestion des rôles	Tous les utilisateurs disposent des mêmes droits
Mono-poste	Utilisation sur un seul ordinateur
________________________________________
2. PÉRIMÈTRE FONCTIONNEL
2.1. Modules inclus
Module	Description	Priorité
Saisons	Création, clôture et consultation des campagnes	Critique
Tarifs	Définition des tarifs par campagne	Critique
Prix Gasoil	Définition du prix du gasoil par campagne	Critique
Client	Gestion du client COTONTCHAD SN	Critique
Camions	Gestion du parc de camions	Critique
Chauffeurs	Gestion des chauffeurs	Haute
Usines	Gestion des usines	Critique
CGI	Gestion des Centres de Gestion Intégrés	Critique
AV	Gestion des Agents Villageois	Critique
BSM	Gestion des Bons de Sortie Magasin / gasoil	Critique
Bordereaux	Gestion des bordereaux de transport et de livraison	Critique
Pesées	Gestion des pesées à vide et chargé	Critique
Missions	Gestion du parcours complet du camion	Critique
Factures	Gestion des factures récapitulatives	Critique
Paiements	Suivi des paiements	Critique
Avances	Suivi des avances COTONTCHAD	Haute
Rapport Annuel	Génération automatique du rapport	Critique
Tableau de bord	KPI et graphiques	Haute
Export	Export Excel et PDF	Haute
Impression	Impression BSM, bordereaux et factures	Critique
Paramètres	Configuration générale de l'application	Moyenne
________________________________________
2.2. Modules exclus
Module	Raison
Authentification	Non demandé
Gestion des rôles	Non demandé
Comptabilité générale	Non demandé
Gestion des stocks	Non demandé
Paie	Non demandé
CRM	Non demandé
Site web	Application desktop uniquement
Application mobile	Application desktop uniquement
Multi-utilisateur en réseau	Application mono-poste
Intégration API COTONTCHAD	Non demandé
________________________________________
3. ARCHITECTURE TECHNIQUE
3.1. Stack technologique
Couche	Technologie	Version	Justification
Frontend	React	18+	Moderne et réactif
Langage Frontend	TypeScript	5+	Typage statique et fiabilité
Build Frontend	Vite	5+	Rapide et moderne
UI	TailwindCSS	3+	Utility-first
Composants UI	Shadcn/UI	Latest	Composants accessibles
Formulaires	React Hook Form	7+	Performant et flexible
Validation	Zod	3+	Validation type-safe
État global	Zustand	4+	Léger et simple
Requêtes	React Query	5+	Cache et synchronisation
Graphiques	Recharts	2+	Graphiques React
Backend	Tauri	2+	Desktop léger et sécurisé
Langage Backend	Rust	1.70+	Performant et sécurisé
Base de données	SQLite	3+	Locale, légère et fiable
ORM / Query	rusqlite	Latest	Accès SQLite en Rust
Documents	Print HTML	-	Flexibilité et simplicité
Export Excel	rust_xlsxwriter	Latest	Génération Excel
Export PDF	jsPDF / print	Latest	Génération PDF
________________________________________
4. MODÈLE FONCTIONNEL DE L'ACTIVITÉ
4.1. Principe général
Le logiciel doit être conçu autour d'une mission de camion.
Une mission représente le parcours complet d'un camion depuis son arrivée à l'usine jusqu'à la clôture de l'opération.
Le parcours de référence est le suivant :
Arrivée du camion à l'usine
↓
Pesée à vide
↓
Prise de gasoil
↓
Départ vers le site de chargement
↓
Chargement du coton graine
↓
Établissement du bordereau
↓
Retour à l'usine
↓
Pesée du camion chargé
↓
Calcul du poids net
↓
Déchargement du coton
↓
Clôture de la mission
↓
Facturation
↓
Paiement
↓
Rapport Annuel
________________________________________
4.2. Parcours détaillé d'un camion
Étape 1 – Arrivée à l'usine
Le camion arrive à l'usine avant de commencer sa mission.
Le système doit identifier :
•	le camion ;
•	le chauffeur ;
•	la campagne ;
•	l'usine ;
•	la date ;
•	l'heure ;
•	la mission concernée.
Étape 2 – Pesée à vide
Avant de partir charger le coton, le camion est pesé à vide.
Le système enregistre :
•	le camion ;
•	la date et l'heure ;
•	l'usine ;
•	le poids à vide ;
•	le numéro du ticket de pesée, lorsque disponible.
Cette valeur constitue le poids vide initial de la mission.
Étape 3 – Prise de gasoil
Avant de quitter l'usine pour aller charger le coton, le camion prend son carburant.
Le système enregistre notamment :
•	le numéro du BSM ;
•	la date ;
•	le camion ;
•	la quantité de gasoil ;
•	le prix unitaire du gasoil ;
•	l'usine ;
•	le bénéficiaire ;
•	les références nécessaires.
Le BSM constitue la trace documentaire de cette opération.
Étape 4 – Départ vers le site de chargement
Le camion quitte l'usine pour rejoindre le site de chargement.
Le système doit conserver la mission associée au déplacement.
Étape 5 – Chargement du coton graine
Le camion arrive sur le site concerné et procède au chargement du coton graine.
Le système doit enregistrer notamment :
•	le CGI ;
•	l'AV ;
•	la localité ;
•	le camion ;
•	le chauffeur ;
•	la date ;
•	le numéro de bordereau ;
•	les informations relatives au chargement ;
•	le poids lorsque celui-ci est disponible.
Le bordereau constitue le document associé au mouvement.
Étape 6 – Retour à l'usine
Après chargement, le camion revient à l'usine avec le coton.
Étape 7 – Pesée du camion chargé
À son retour, le camion est de nouveau pesé.
Le système enregistre :
Poids chargé / poids brut
Cette deuxième pesée est associée à la première pesée à vide.
Étape 8 – Calcul automatique du poids net
Le poids net de coton est calculé automatiquement :
Poids net coton = Poids chargé − Poids vide initial
Exemple :
Poids vide initial : 18 500 kg
Poids chargé : 42 700 kg
Poids net coton :
42 700 − 18 500 = 24 200 kg
Le logiciel doit conserver les deux valeurs sources ainsi que le résultat calculé.
Étape 9 – Déchargement
Le camion décharge le coton à l'usine.
Le bordereau ou le document correspondant permet d'assurer la traçabilité de la livraison.
Étape 10 – Clôture de la mission
Lorsque toutes les informations sont disponibles, la mission est clôturée.
Le système peut alors déterminer automatiquement les données nécessaires :
•	tonnage ;
•	distance ;
•	gasoil ;
•	tarif ;
•	montant brut ;
•	montant gasoil ;
•	montant net ;
•	références documentaires.
Étape 11 – Facturation
Les opérations validées peuvent être regroupées dans une facture.
Étape 12 – Paiement
Le paiement est enregistré et rattaché à la facture concernée.
Étape 13 – Rapport Annuel
Le Rapport Annuel est généré automatiquement à partir des données enregistrées au cours des différentes étapes.
________________________________________
5. ARCHITECTURE APPLICATIVE
5.1. Architecture générale
L'application sera organisée en quatre grandes couches :
Couche 1 – Interface utilisateur
React + TypeScript
↓
Couche 2 – Communication
Tauri IPC
↓
Couche 3 – Logique métier
Rust
↓
Couche 4 – Persistance
SQLite
Les documents seront générés à partir des données enregistrées dans la base.
________________________________________
5.2. Structure logique
APPLICATION ABAF
│
├── Tableau de bord
│
├── Référentiels
│   ├── Saisons
│   ├── Tarifs
│   ├── Prix Gasoil
│   ├── Clients
│   ├── Camions
│   ├── Chauffeurs
│   ├── Usines
│   ├── CGI
│   └── AV
│
├── Opérations
│   ├── Missions
│   ├── Pesées
│   ├── BSM / Gasoil
│   ├── Chargements
│   ├── Bordereaux
│   └── Livraisons
│
├── Finance
│   ├── Factures
│   ├── Paiements
│   └── Avances
│
├── Rapports
│   ├── Récapitulatif
│   ├── Rapport Annuel
│   ├── Export Excel
│   └── Export PDF
│
└── Paramètres
________________________________________
6. MODÈLE DE DONNÉES
La base SQLite devra contenir au minimum les entités suivantes :
•	Saison
•	Tarif
•	Prix Gasoil
•	Client
•	Camion
•	Chauffeur
•	Usine
•	CGI
•	AV
•	Mission
•	Pesée
•	BSM
•	Bordereau
•	Ligne Bordereau
•	Distance
•	Facture
•	Ligne Facture
•	Paiement
•	Avance
•	Utilisation Avance
________________________________________
6.1. Principe de relation
SAISON
   │
   ├── TARIFS
   ├── PRIX GASOIL
   ├── MISSIONS
   ├── BSM
   ├── BORDEREAUX
   ├── FACTURES
   ├── PAIEMENTS
   └── AVANCES

MISSION
   │
   ├── CAMION
   ├── CHAUFFEUR
   ├── USINE
   ├── PESÉE À VIDE
   ├── BSM / GASOIL
   ├── CHARGEMENT
   ├── BORDEREAU
   ├── PESÉE CHARGÉ
   ├── LIVRAISON
   └── FACTURATION
________________________________________
7. RAPPORT ANNUEL
7.1. Principe
Le Rapport Annuel ne doit pas être une saisie indépendante.
Il doit être généré automatiquement à partir des mouvements enregistrés dans le logiciel.
Le principe est :
Pesée
   +
Gasoil / BSM
   +
Chargement
   +
Bordereau
   +
Livraison
   +
Facturation
   +
Paiement
        ↓
BASE DE DONNÉES
        ↓
RAPPORT ANNUEL
________________________________________
7.2. Colonnes du Rapport Annuel
Le rapport devra reprendre les colonnes du fichier Excel historique, notamment :
•	N° Fac
•	N° Camion
•	USINE
•	CGI
•	AV
•	Poids Coton
•	Poids INT
•	Distance
•	Gasoil
•	Montant
•	OBSER
•	BMS
Les correspondances exactes entre chaque colonne et les événements métier devront être validées à partir des documents et fichiers historiques ABAF.
________________________________________
8. SPÉCIFICATIONS FONCTIONNELLES
8.1. Module Saisons
Fonction	Description
Créer	Ajouter une nouvelle saison
Modifier	Modifier une saison existante
Lister	Afficher toutes les saisons
Clôturer	Passer une saison en « Fermée »
Consulter	Voir le détail d'une saison
Règles :
•	Une seule saison peut être ouverte à la fois.
•	Une saison fermée ne peut plus être modifiée.
•	Le libellé est unique.
________________________________________
8.2. Module Tarifs
Fonction	Description
Créer	Ajouter un tarif
Modifier	Modifier un tarif si la saison est ouverte
Lister	Afficher les tarifs
Supprimer	Supprimer un tarif si la saison est ouverte
Règles :
•	Les tarifs sont liés à une saison.
•	Les tarifs sont fixes pendant la campagne.
•	Les plages de distance ne doivent pas se chevaucher.
•	Chaque tarif porte un type de fret (direct, retour, évacuation, transfert) et une unité : FCFA/tonne jusqu'à 90 km, FCFA/tonne-km (TKM) au-delà (CDC v1.1).
•	La dernière tranche de distance peut être ouverte (« 91 km et plus »).
________________________________________
8.3. Module Prix Gasoil
Fonction	Description
Définir	Définir le prix unitaire du gasoil
Modifier	Modifier le prix si la saison est ouverte
Consulter	Consulter le prix
Règles :
•	Un prix est défini pour chaque saison.
•	Le prix est fixe pendant la campagne.
________________________________________
8.4. Module Camions
Fonction	Description
Créer	Ajouter un camion
Modifier	Modifier un camion
Lister	Afficher les camions
Désactiver	Désactiver un camion
Consulter	Voir le détail
Règles :
•	L'immatriculation est unique.
•	Un camion inactif ne peut pas être utilisé pour une nouvelle mission.
________________________________________
8.5. Module Chauffeurs
Fonction	Description
Créer	Ajouter un chauffeur
Modifier	Modifier un chauffeur
Lister	Afficher les chauffeurs
Désactiver	Désactiver un chauffeur
________________________________________
8.6. Module Usines
Fonction	Description
Créer	Ajouter une usine
Modifier	Modifier une usine
Lister	Afficher les usines
Consulter	Voir le détail
________________________________________
8.7. Module CGI
Fonction	Description
Créer	Ajouter un CGI
Modifier	Modifier un CGI
Lister	Afficher les CGI
Consulter	Voir le détail
Règles :
•	Un CGI est rattaché à une usine.
•	Le nom est unique par usine.
________________________________________
8.8. Module AV
Fonction	Description
Créer	Ajouter un AV
Modifier	Modifier un AV
Lister	Afficher les AV
Consulter	Voir le détail
________________________________________
9. MODULE MISSION
Le module Mission constitue le cœur opérationnel du système.
9.1. Création d'une mission
Une mission doit permettre d'identifier :
•	la campagne ;
•	le camion ;
•	le chauffeur ;
•	l'usine ;
•	le CGI ;
•	l'AV ;
•	la destination ;
•	le type de mouvement ;
•	la date ;
•	le statut.
________________________________________
9.2. Cycle de vie d'une mission
BROUILLON
    ↓
CAMION ARRIVÉ À L'USINE
    ↓
PESÉ À VIDE
    ↓
GASOIL PRIS
    ↓
EN ROUTE
    ↓
CHARGEMENT
    ↓
RETOUR USINE
    ↓
PESÉ CHARGÉ
    ↓
POIDS NET CALCULÉ
    ↓
DÉCHARGEMENT
    ↓
VALIDÉ
    ↓
FACTURÉ
    ↓
PAYÉ
Les statuts exacts pourront être ajustés après validation du fonctionnement réel.
________________________________________
10. MODULE PESÉE
Le module Pesée doit gérer au minimum deux événements :
Pesée à vide
•	camion ;
•	mission ;
•	usine ;
•	date ;
•	heure ;
•	poids vide ;
•	ticket de pesée.
Pesée chargé
•	camion ;
•	mission ;
•	usine ;
•	date ;
•	heure ;
•	poids chargé ;
•	ticket de pesée.
Calcul
Poids net = Poids chargé − Poids vide
Le calcul est automatique.
Le système doit empêcher un poids net négatif.
________________________________________
11. MODULE BSM / GASOIL
Fonction	Description
Créer	Créer un BSM
Modifier	Modifier un BSM non clôturé
Lister	Afficher les BSM
Consulter	Voir le détail
Imprimer	Générer le BSM
Le BSM doit être rattaché à la mission concernée lorsque cela est possible.
Données principales :
•	numéro ;
•	date ;
•	camion ;
•	bénéficiaire ;
•	quantité gasoil ;
•	prix unitaire ;
•	montant ;
•	imputation ;
•	référence ;
•	saison.
________________________________________
12. MODULE BORDEREAU
Fonction	Description
Créer	Créer un bordereau
Ajouter lignes	Ajouter les AV et poids
Saisir pesée	Enregistrer les pesées
Calculer	Calculer le poids net
Valider	Valider le bordereau
Consulter	Voir le détail
Imprimer	Générer le document
Un bordereau peut contenir plusieurs AV.
________________________________________
13. MODULE FACTURE
Fonction	Description
Créer	Créer une facture
Sélectionner bordereaux	Sélectionner les opérations
Sélectionner BSM	Associer les opérations de gasoil
Calculer	Calculer les montants
Valider	Valider la facture
Imprimer	Générer la facture
Règle (CDC v1.1 — factures hors TVA)
Distance ≤ 90 km : Montant brut = Poids net (t) × Tarif à la tonne
Distance > 90 km : Montant brut = Poids net (t) × Distance × Tarif à la tonne-km (TKM)
Montant gasoil = Quantité gasoil × Prix unitaire
Montant net = Montant brut − Montant gasoil
La TKM et le détail des trajets sont générés à la création de la facture.
La facture s'imprime en 4 exemplaires (original + 3 copies) ; l'original porte la mention « ORIGINAL PAYABLE ».
________________________________________
14. MODULE PAIEMENT
Le module permet de :
•	créer un paiement ;
•	modifier un paiement ;
•	consulter les paiements ;
•	rechercher par facture ;
•	suivre les montants payés et impayés.
Statuts :
•	Payé ;
•	Impayé ;
•	NP.
________________________________________
15. MODULE AVANCES
Le système doit permettre de :
•	enregistrer une avance ;
•	rattacher l'avance à une campagne ;
•	enregistrer son utilisation ;
•	suivre le montant utilisé ;
•	calculer automatiquement le solde.
Solde = Avance initiale − Montant utilisé
________________________________________
16. MODULE RÉCAPITULATIF
Le document Récap doit être considéré comme une synthèse des mouvements.
Il ne doit pas nécessiter une ressaisie indépendante.
Le système doit construire automatiquement le récapitulatif à partir des :
•	missions ;
•	pesées ;
•	BSM ;
•	chargements ;
•	bordereaux ;
•	livraisons ;
•	factures ;
•	paiements.
________________________________________
17. TABLEAU DE BORD
Le tableau de bord doit afficher notamment :
•	nombre de missions ;
•	nombre de camions actifs ;
•	nombre de bordereaux ;
•	nombre de BSM ;
•	tonnage total de coton ;
•	tonnage total d'intrants ;
•	distance totale ;
•	quantité totale de gasoil ;
•	montant brut ;
•	montant gasoil ;
•	montant net ;
•	montant payé ;
•	montant impayé ;
•	solde des avances.
Les données doivent pouvoir être filtrées par campagne.
________________________________________
18. ARCHITECTURE DU PROJET
C:\Users\acer\Dev\Projects\ABAF\
│
├── src-tauri\
│   ├── src\
│   │   ├── main.rs
│   │   ├── commands\
│   │   │   ├── saison.rs
│   │   │   ├── tarif.rs
│   │   │   ├── prix_gazoil.rs
│   │   │   ├── camion.rs
│   │   │   ├── chauffeur.rs
│   │   │   ├── usine.rs
│   │   │   ├── cgi.rs
│   │   │   ├── av.rs
│   │   │   ├── mission.rs
│   │   │   ├── pesee.rs
│   │   │   ├── bsm.rs
│   │   │   ├── bordereau.rs
│   │   │   ├── facture.rs
│   │   │   ├── paiement.rs
│   │   │   ├── avance.rs
│   │   │   └── rapport.rs
│   │   │
│   │   ├── models\
│   │   ├── services\
│   │   ├── db\
│   │   └── utils\
│   │
│   ├── migrations\
│   ├── Cargo.toml
│   └── tauri.conf.json
│
├── src\
│   ├── main.tsx
│   ├── App.tsx
│   ├── components\
│   ├── pages\
│   ├── hooks\
│   ├── services\
│   ├── stores\
│   ├── types\
│   ├── utils\
│   ├── templates\
│   └── styles\
│
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
└── README.md
________________________________________
19. INSTRUCTIONS DE DÉVELOPPEMENT
19.1. Ordre de développement
Le développement doit suivre l'ordre logique du métier :
Phase 1 – Fondations
1.	Initialisation Tauri + React
2.	Configuration TypeScript
3.	Configuration TailwindCSS
4.	Configuration SQLite
5.	Système de migrations
6.	Layout principal
Phase 2 – Référentiels
7.	Saison
8.	Tarifs
9.	Prix Gasoil
10.	Client
11.	Camion
12.	Chauffeur
13.	Usine
14.	CGI
15.	AV
Phase 3 – Opérations
16.	Mission
17.	Pesée
18.	BSM / Gasoil
19.	Chargement
20.	Bordereau
21.	Livraison
Phase 4 – Finance
22.	Facture
23.	Paiement
24.	Avance
Phase 5 – Rapports
25.	Récapitulatif
26.	Rapport Annuel
27.	Export Excel
28.	Export PDF
29.	Impression
Phase 6 – Pilotage
30.	Tableau de bord
31.	Paramètres
32.	Sauvegarde
33.	Restauration
________________________________________
20. SPÉCIFICATIONS DES DOCUMENTS
20.1. BSM
Format : HTML → Impression / PDF
Contenu :
•	en-tête ABAF ;
•	logo ;
•	coordonnées ;
•	titre ;
•	numéro BSM ;
•	date ;
•	bénéficiaire ;
•	camion ;
•	quantité de gasoil ;
•	désignation ;
•	imputation ;
•	signatures.
________________________________________
20.2. Bordereau de transport
Format : HTML → Impression / PDF
Contenu :
•	en-tête COTONTCHAD SN ;
•	titre ;
•	numéro ;
•	usine ;
•	responsable ;
•	date ;
•	camion ;
•	chauffeur ;
•	CGI ;
•	AV ;
•	poids ;
•	code ;
•	observations ;
•	total poids ;
•	informations de chargement ;
•	mention « ORIGINAL PAYABLE » (ajoutée automatiquement, CDC v1.1) ;
•	signatures.
________________________________________
20.3. Facture
Format : HTML → Impression / PDF
Contenu :
•	en-tête ABAF ;
•	numéro facture ;
•	date ;
•	client ;
•	usine ;
•	camion ;
•	bordereaux ;
•	tonnage ;
•	distance et TKM (trajets > 90 km) ;
•	détail du trajet ;
•	montant brut ;
•	gasoil ;
•	montant net ;
•	total ;
•	tarification (hors TVA) ;
•	mention « ORIGINAL PAYABLE » sur l'exemplaire original ;
•	signature.
Impression en 4 exemplaires (original + 3 copies) dans un même document (CDC v1.1).
________________________________________
20.4. Rapport Annuel
Format : HTML → Impression / PDF / Excel
Contenu :
•	en-tête ;
•	titre ;
•	campagne ;
•	tableau des opérations ;
•	totaux ;
•	données de gasoil ;
•	données BMS ;
•	observations ;
•	comparaison avec les campagnes précédentes.
Le rapport doit être généré automatiquement à partir de la base de données.
________________________________________
21. RÈGLES DE GESTION
21.1. Règles de calcul
Règle	Formule
Poids Net Coton	Poids Chargé − Poids Vide
Montant Brut (≤ 90 km)	Poids Net (t) × Tarif à la tonne
Montant Brut (> 90 km)	Poids Net (t) × Distance × Tarif à la tonne-km (TKM)
TKM (trajets > 90 km)	Poids Net (t) × Distance
Montant Gasoil	Quantité Gasoil × Prix Unitaire
Montant Net	Montant Brut − Montant Gasoil
Total Facture	Somme des Montants Nets
Solde Avance	Avance Initiale − Montant Utilisé
________________________________________
21.2. Règles générales
1.	Une seule saison ouverte à la fois.
2.	Les tarifs sont fixes pour une campagne.
3.	Le prix du gasoil est fixe pour une campagne.
4.	Un BSM clôturé ou facturé ne peut plus être modifié.
5.	Un bordereau validé ne peut plus être modifié.
6.	Une facture validée ne peut plus être modifiée.
7.	Le poids net ne peut pas être négatif.
8.	Les paiements doivent être rattachés aux factures.
9.	Le client principal est COTONTCHAD SN.
10.	Les avances doivent pouvoir être suivies jusqu'à leur consommation.
11.	Une opération doit être rattachée à une campagne.
12.	Les documents doivent être traçables à partir de la mission concernée.
13.	Les informations utilisées dans le Rapport Annuel doivent provenir des opérations enregistrées.
14.	Les données ne doivent pas être ressaisies inutilement dans plusieurs modules.
15.	Le tarif appliqué et le montant brut d'un transport sont figés à la validation du bordereau ; la facturation les réutilise sans recalcul.
16.	Les bordereaux imprimés portent automatiquement la mention « ORIGINAL PAYABLE ».
17.	Les factures s'impriment en 4 exemplaires (original + 3 copies).
________________________________________
22. TESTS ET RECETTE
22.1. Tests unitaires
Tester notamment :
•	calcul du poids net ;
•	calcul du montant brut ;
•	calcul du montant gasoil ;
•	calcul du montant net ;
•	calcul du solde d'avance ;
•	validation des données ;
•	règles tarifaires.
________________________________________
22.2. Tests d'intégration
Tester un parcours complet :
Campagne
   ↓
Camion
   ↓
Mission
   ↓
Pesée vide
   ↓
BSM / Gasoil
   ↓
Chargement
   ↓
Bordereau
   ↓
Retour usine
   ↓
Pesée chargé
   ↓
Calcul poids net
   ↓
Déchargement
   ↓
Facture
   ↓
Paiement
   ↓
Rapport Annuel
________________________________________
22.3. Tests utilisateurs
Les tests doivent être réalisés à partir de cas réels issus des campagnes ABAF.
Il faudra notamment vérifier que :
•	les données saisies correspondent aux documents papier ;
•	les calculs correspondent aux calculs historiques ;
•	le Rapport Annuel produit par le logiciel correspond au fichier Excel existant ;
•	les documents générés correspondent aux modèles utilisés par ABAF.
________________________________________
23. CRITÈRES D'ACCEPTATION
L'application sera considérée comme fonctionnelle lorsque :
•	elle démarre correctement ;
•	les données sont persistées dans SQLite ;
•	les relations entre les opérations sont cohérentes ;
•	le parcours complet d'un camion peut être enregistré ;
•	les pesées permettent de calculer automatiquement le poids net ;
•	le gasoil est correctement rattaché à la mission ;
•	les bordereaux peuvent être générés ;
•	les factures peuvent être générées ;
•	les paiements peuvent être enregistrés ;
•	les avances peuvent être suivies ;
•	le Récapitulatif est généré automatiquement ;
•	le Rapport Annuel est généré automatiquement ;
•	le Rapport Annuel est conforme au modèle Excel historique ;
•	les exports Excel et PDF fonctionnent ;
•	les documents peuvent être imprimés ;
•	les sauvegardes fonctionnent.
________________________________________
24. DÉPLOIEMENT
24.1. Packaging
Commande :
npm run tauri build
Le processus génère les packages Windows nécessaires à l'installation.
________________________________________
24.2. Installation
1.	Exécuter l'installateur.
2.	Suivre l'assistant d'installation.
3.	Installer l'application.
4.	Lancer ABAF.
5.	Initialiser la base de données.
________________________________________
24.3. Sauvegarde
La base de données SQLite doit être sauvegardée régulièrement.
Le système doit prévoir :
•	sauvegarde manuelle ;
•	sauvegarde automatique optionnelle ;
•	restauration ;
•	copie de sécurité de la base.
________________________________________
25. PLANNING
Semaine	Tâches	Livrable
1	Analyse finale + initialisation + SQLite	Architecture fonctionnelle
2	Saison + Tarifs + Prix Gasoil	Référentiels de base
3	Client + Camion + Chauffeur + Usine + CGI + AV	Référentiels
4	Mission + Pesée + BSM	Cycle opérationnel
5	Chargement + Bordereau + Livraison	Opérations
6	Facture + Paiement + Avance	Finance
7	Récapitulatif + Rapport Annuel	Rapports
8	Export + Dashboard + Paramètres	Finalisation
9	Tests et recette	Validation
10	Déploiement	Mise en production
________________________________________
26. LIVRABLES
Livrable	Description
Code source	Dépôt Git complet
Application	Installateur Windows .msi ou .exe
Base de données	Fichier SQLite abaf.db
Documentation technique	Architecture et documentation du système
Cahier des charges	Document de référence du projet
Guide utilisateur	Manuel d'utilisation
Manuel d'installation	Procédure d'installation et de configuration
Tests	Rapports de tests et recette
Modèles de documents	BSM, bordereaux, factures et rapports
________________________________________
27. CONCLUSION
Le système de gestion ABAF doit être conçu comme une reproduction numérique du fonctionnement réel de l'activité de transport, et non comme une simple copie des fichiers Excel existants.
Le point central du système est la mission du camion.
Une mission doit permettre de suivre l'intégralité du parcours :
Camion → Usine → Pesée à vide → Gasoil → Départ → Chargement → Bordereau → Retour usine → Pesée chargé → Calcul du poids net → Déchargement → Facturation → Paiement → Rapport.
Les documents actuellement utilisés par ABAF, notamment le BSM, le bordereau de livraison/transport et le document Récap, doivent être considérés comme des éléments du processus et non comme des systèmes de saisie indépendants.
Le principe fondamental sera donc :
SAISIR UNE INFORMATION UNE SEULE FOIS → LA RÉUTILISER AUTOMATIQUEMENT PARTOUT.
Ainsi, les informations enregistrées lors du parcours réel du camion alimenteront automatiquement :
•	les bordereaux ;
•	les BSM ;
•	les factures ;
•	les récapitulatifs ;
•	les paiements ;
•	les tableaux de bord ;
•	et surtout le Rapport Annuel actuellement produit dans Excel.
Le Rapport Annuel devient ainsi un état automatiquement généré à partir des opérations réelles enregistrées dans le système.
Avant le développement définitif, une phase d'analyse fonctionnelle devra toutefois permettre de comparer systématiquement :
Documents papier → Parcours réel → Données saisies → Règles de calcul → Base de données → Rapport Annuel Excel.
Cette étape permettra de garantir que le logiciel reproduit fidèlement le fonctionnement d'ABAF et qu'aucune règle métier importante n'est perdue lors de la transformation du processus Excel vers le système informatique.
