# Guide de saisie — Campagne 2025-2026

> Insertion manuelle progressive des données réelles de la campagne 2025-2026 dans l'application
> (rapport annuel client : **210 opérations** de transport coton et intrants).

## Comment utiliser ce guide

- Les sections **1 à 3** se font une seule fois (préparation de la campagne).
- Les sections **4 et 5** se répètent pour chacune des 210 opérations, **lot par lot** (11 lots).
- La section **6** permet de contrôler le résultat.
- Cochez les cases `- [ ]` au fur et à mesure pour suivre la progression.
- Avant de commencer : choisissez votre base de travail, puis **Paramètres → Sauvegarde → « Sauvegarder maintenant »**.

### Conventions de saisie

| Élément | Convention retenue dans ce guide |
|---|---|
| Poids à vide | poids à vide du camion concerné — voir le tableau de la section 3 (`8 100` à `20 000 kg` selon le camion) |
| Poids chargé | `poids à vide du camion + poids de la marchandise` : coton = Coton (t) × 1000 ; intrants = Intr. (kg) tel quel |
| Date | une date par opération, choisie dans la plage de dates du lot (section 5.1), réutilisée sur tous ses écrans |
| N° de bordereau | `BD-2026-XXX` (XXX = n° de l'opération sur 3 chiffres, ex. `BD-2026-007`) — ou le n° réel du bordereau papier (`0054494`, `0051628`, …) si vous préférez, en gardant un numéro unique par bordereau |
| N° de facture | `FAC-2026-XXX` (même numérotation) |
| N° de BSM | numéro(s) de la colonne BSM du tableau (section 5.2) : ce sont les n° des bons de sortie magasin, repris à 5 chiffres (bon n° `0053031` → BSM `53031`) |
| Quantité de gasoil par BSM | `220 L` (quantité des bons de sortie magasin de la campagne ; reportez la quantité réelle du bon) |
| Bénéficiaire du BSM | le chauffeur du camion de la mission |
| Imputation du BSM | `COTONTCHAD SN` |
| Montant des factures | calculé automatiquement par l'application (voir la remarque en section 2.1) |

## 1. Ouvrir la campagne 2025-2026

- [ ] Menu **Référentiels → Saisons** → bouton « Nouvelle saison ».
- [ ] Remplir :
  - **Libellé** : `Campagne 2025-2026`
  - **Date de début** : `01/11/2025`
  - **Date de fin prévisionnelle** : `30/06/2026`
- [ ] Cliquer sur « Créer la saison » : le badge **Ouverte** s'affiche sur la ligne de la campagne.

Règles à connaître :
- une seule saison peut être **ouverte** à la fois, et son libellé doit être unique ;
- si une campagne précédente est encore ouverte, clôturez-la d'abord (Référentiels → Saisons → « Clôturer ») ;
- la campagne ouverte est pré-remplie automatiquement dans tous les formulaires (missions, BSM, bordereaux, factures).

## 2. Paramétrer la campagne

### 2.1 Tarifs de transport (barème indicatif – 5 tranches)

Créer cinq tranches : menu **Référentiels → Tarifs** → « Nouveau tarif ».
Pour chaque tranche : **Type de fret** = « Direct — coton graine », **Unité de tarification** = « FCFA / tonne-km (TKM) ».

| Distance de début (km) | Distance de fin (km) | Tarif (FCFA / tonne-km) |
|---:|---:|---:|
| 0 | 100 | 160 |
| 101 | 200 | 150 |
| 201 | 300 | 140 |
| 301 | 400 | 130 |
| 401 | (laisser vide = tranche ouverte) | 120 |

- [ ] Les 5 tranches sont créées.

Remarques :
- les bornes sont incluses : 100 km → tranche 0-100, 101 km → tranche 101-200, et ainsi de suite ;
- les tarifs ne sont modifiables que si la campagne est ouverte ;
- **les montants ne sont pas saisis à la main** : l'application calcule le montant du bordereau (et donc de la
  facture) à la validation, à partir de ce barème, du poids net des pesées et de la distance. Le rapport
  annuel comporte des taux particuliers (non uniformes) : avec ce barème, le total calculé des 210 factures
  sera d'environ **90,6 M F**, contre **70 513 434 F** affichés dans le rapport. Cet écart est normal et
  n'affecte pas les contrôles de tonnage, de distance et de nombre de factures ;
- variante possible pour se rapprocher du montant historique : une **tranche unique ouverte**
  (distance de début `0`, distance de fin vide) au tarif d'environ **113 FCFA / tonne-km** donne un total
  calculé d'environ **70,5 M F**. Le guide privilégie toutefois le barème à 5 tranches ci-dessus.

### 2.2 Prix du gasoil

- [ ] Menu **Référentiels → Prix Gasoil**, sélectionner la campagne `Campagne 2025-2026`.
- [ ] Saisir **Prix par litre (FCFA)** : `840`, puis cliquer sur « Définir le prix ».

Ce prix est pré-rempli automatiquement dans chaque nouveau BSM (modifiable ligne par ligne si besoin).

## 3. Créer les référentiels

Rappel des écrans et des champs :

| Référentiel | Où | Bouton | Champs à remplir |
|---|---|---|---|
| Usines | Référentiels → Usines | « Nouvelle usine » | Nom de l'usine ; Localité (facultatif) |
| Camions | Référentiels → Camions | « Nouveau camion » | Immatriculation (Marque, Modèle, Capacité facultatifs) |
| Chauffeurs | Référentiels → Chauffeurs | « Nouveau chauffeur » | Nom (Prénom, Téléphone facultatifs) |
| CGI | Référentiels → CGI | « Nouveau CGI » | Nom du CGI ; Usine ; Localité (facultatif) |
| AV | Référentiels → AV | « Nouvel AV » | Nom de l'AV ; CGI (à renseigner pour que l'AV apparaisse dans la cascade Usine → CGI → AV) ; Localité (facultatif) |

Créez les enregistrements à partir des listes ci-dessous (extraites du rapport annuel).

### Usines à créer (3)

- MOUNDOU
- KOUMRA
- DOBA

### Camions à créer (20)

La colonne « Poids à vide » sert aux pesées (sections 4.2 et 4.4) ; elle ne se saisit pas dans le
référentiel (à la création, Marque, Modèle et Capacité restent facultatifs). Sa détermination est
expliquée après la note ci-dessous.

| Immatriculation | Poids à vide (kg) |
|---|---:|
| 08P0444A | 20 000 |
| 18P2908A | 19 980 |
| 08P0049A | 20 000 |
| 18P0740A | 10 000 |
| 12P0116A | 20 000 |
| 18P2572A | 20 000 |
| 14P1122A | 20 000 |
| 08P0588A | 20 000 |
| 14T0021A | 10 000 |
| 08P0050A | 20 000 |
| 08T0038A | 20 000 |
| 08T0072A | 10 000 |
| 08T0681A | 8 100 |
| 08T0321A | 20 000 |
| 08T0680A | 10 000 |
| 18T2572A | 10 000 |
| 09T0015A | 10 000 |
| 08T068 | 10 000 |
| 08P0029A | 20 000 |
| 08P0041A | 20 000 |

> Note : le rapport contient l'immatriculation « 08T068 » (opération n° 75) — très proche de « 08T0681A ». Saisir l'immatriculation telle qu'elle apparaît dans le tableau ci-dessous pour rester fidèle au rapport.

**Détermination des poids à vide** (d'après les données de la campagne 2025-2026) :

- `08T0681A` : **8 100 kg**, déduit du bordereau réel `0051628` (opération n° 138) : pesée brute
  24 720 kg − coton 16 620 kg ;
- `18P2908A` : **19 980 kg**, déduit du bordereau réel `0054494` (opération n° 202) : pesée brute
  40 580 kg − intrants 20 600 kg (ensemble tracteur TP 08 + remorque) ;
- les autres valeurs sont **estimées** d'après les charges maximales transportées sur la campagne :
  11 camions ont dépassé 20 t en une seule opération (jusqu'à 31 t), signature de trains routiers —
  20 000 kg à vide leur sont attribués ; les 7 camions restant (charges max 14 à 19,6 t) gardent
  la valeur par défaut 10 000 kg, faute de document de pesée.

Quelle que soit la valeur retenue, le poids net (chargé − vide) reste égal au poids de la marchandise :
totaux et montants de la campagne sont inchangés. Si vous retrouvez d'autres bordereaux ou tickets de
pesée, la valeur réelle (poids brut − poids net) peut remplacer toute estimation.

### Chauffeurs à créer (suggestion : 1 chauffeur par camion)

| Camion | Nom suggéré | Prénom | Téléphone |
|---|---|---|---|
| 08P0444A | Chauffeur 01 | — | — |
| 18P2908A | Chauffeur 02 | — | — |
| 08P0049A | Chauffeur 03 | — | — |
| 18P0740A | Chauffeur 04 | — | — |
| 12P0116A | Chauffeur 05 | — | — |
| 18P2572A | Chauffeur 06 | — | — |
| 14P1122A | Chauffeur 07 | — | — |
| 08P0588A | Chauffeur 08 | — | — |
| 14T0021A | Chauffeur 09 | — | — |
| 08P0050A | Chauffeur 10 | — | — |
| 08T0038A | Chauffeur 11 | — | — |
| 08T0072A | Chauffeur 12 | — | — |
| 08T0681A | Chauffeur 13 | — | — |
| 08T0321A | Chauffeur 14 | — | — |
| 08T0680A | Chauffeur 15 | — | — |
| 18T2572A | Chauffeur 16 | — | — |
| 09T0015A | Chauffeur 17 | — | — |
| 08T068 | Chauffeur 18 | — | — |
| 08P0029A | Chauffeur 19 | — | — |
| 08P0041A | Chauffeur 20 | — | — |

> Note : sur les bordereaux de la campagne fournis, on relève par exemple `Brahim` (camion `18P2908A`) et `Abdel Hamid` (camion `08T0681A`). Si vous connaissez les noms réels, remplacez les noms provisoires.

### CGI à créer (par usine)

**Usine MOUNDOU — 42 CGI :**

- BAKE
- KOUH BAKE
- BEMBAITADA
- CGI BEMBA
- BEDJAL
- GAMA
- CGI KOUTOUTOU
- CGI BODO
- BODO
- CGI BEBOTO
- BEBOTO
- MOUKOUM
- TAPOL
- OUDIMIAN
- BEBDJA
- LARAMANAYE
- MOUKOUMTOULOUM
- MOUROUMTOULOU
- ANDOUM
- BAIBOKOUM
- LOUMBOGO
- BEINAMAR
- PANZANUE
- BENGAR
- BADEI
- MBAIDOGLO
- NDOL
- BEKAO FERME
- BITOYE
- KAYE LARMANAYE
- BEDANE
- GADJIBIAN
- BIDANGA
- BESSAO FERME
- LAOKOIMASSE
- BESSAO C
- BESSAO
- MISE EN PLACE
- BAIBOKOUM/BESSAO CENTRE
- BESSAO CENTRE
- LOUMBOGO/ LARMANAYE
- LAOUKOIMASSE

**Usine KOUMRA — 8 CGI :**

- BEBOPEN KAWA
- BEBOPEN GPMT AMADJIBEY
- GOUNDI
- BENGOTO DJIRADOUM
- GOHONGO
- PALOUM
- BOUNA
- MISE EN PLACE

**Usine DOBA — 1 CGI :**

- MISE EN PLACE

### AV à créer (par CGI)

**MOUNDOU / BAKE — 6 AV :**

- MASRANE/ALLARABAYE
- GP MASRANE
- GPA MENDAH GPA ATOKAN
- DJIMHOYEL JOEL
- GP ALLAGOME
- KOUH/GPA ESPOIR/KOUH II

**MOUNDOU / KOUH BAKE — 1 AV :**

- KODIADOUM

**MOUNDOU / BEMBAITADA — 2 AV :**

- BEMADJA/BEKONON
- GP DJIMADOUM GP ALLARBEYE

**MOUNDOU / CGI BEMBA — 1 AV :**

- GP  NOUDJI,GP TADE

**MOUNDOU / BEDJAL — 2 AV :**

- BEDE GPA MEKASNAN
- BEBOYE NGARA

**MOUNDOU / GAMA — 1 AV :**

- KORO GOUDO GP NGARHOIDJI EMILE

**MOUNDOU / CGI KOUTOUTOU — 2 AV :**

- BEMIAN
- BEMIAN GP DOUMSENGAR

**MOUNDOU / CGI BODO — 2 AV :**

- MEMTODJIM DJEDANOUM
- MBAIOUROUM

**MOUNDOU / BODO — 1 AV :**

- GPA MENDAH

**MOUNDOU / CGI BEBOTO — 1 AV :**

- GP HONDE GP ALLARAMADJI

**MOUNDOU / BEBOTO — 1 AV :**

- LAISSEDJE MIANBE

**MOUNDOU / MOUKOUM — 1 AV :**

- MEDILATI/DJAMAYE

**MOUNDOU / TAPOL — 6 AV :**

- GP LOHOUDJA/GP DJARAKO
- GP NEHOGUEMEL/GPA MARAMADJI
- GP CHARLE/GP BRUNO/MBAGUEMAYE
- MBAGUEMAYE/GP DJERABE
- MBAGUEMAYE/DJERABE
- DAMBAYE/ARGAO/BOUADOHI/DOMANE TAPOL DOILI/MOROM

**MOUNDOU / OUDIMIAN — 14 AV :**

- GPA MBAILASSEM/GP NARROYE
- GP NADJIMBAYE
- BENGAMOUNDOU II
- HAMBEYE MEKASNAN
- MAREMADJI/MEKASNAN II
- DJAKOMBETE/GPA MEKASNA
- MBAIRE
- BENGAKARA/GP KASRA
- MEMNOUDJI/BENGAMOUNDOU
- BENDAIDOURA/BENGAMOND
- NEMAYE/DJIMTOLOUM/MEKASNAN/KOILAMAYE
- NDAMADJI/ SANGMAYE
- BEHAMAKA/BEMBAINDI/BETABAR /BETOUBAM
- KOSSOURA/BETOUBAM/BETAR

**MOUNDOU / BEBDJA — 1 AV :**

- KOUBEBE/HOBOMENGALI

**MOUNDOU / LARAMANAYE — 18 AV :**

- GPA YINE BINGO/GPA MBAH I
- GOUSSOURO
- LARMANAYE LIEMOUKOU/DINGAMGOTODIE
- GPA LIEMOUKOU/LARMANAYE
- GPA YINE BINGO/GPA MBATOYE
- GPA LAOBIOW GPA MBAIBOL I
- KAYE LARMANAYE
- PAO
- KOUNDAYE PAO
- LARAMANAYE
- MINZOUKOU/HOULRING
- GPA ALLA KARIM
- BOUFIAN DANIEL
- MAINI MBAIBOL/LAOMBION
- KOUMBITE
- MEMROREM/NGARAMGORE
- NGAL I/MAINI MBAIBOL
- MANDARI II/MBAIBEDJE MAETIN/KOILANOUDJI/BOUYOU

**MOUNDOU / MOUKOUMTOULOUM — 1 AV :**

- GP DOSSENGAR/DOGBARA I/GAGAN

**MOUNDOU / MOUROUMTOULOU — 1 AV :**

- KOSAMBE/MOSSENGAR

**MOUNDOU / ANDOUM — 15 AV :**

- DJERALAR/GPA AREMADJIBAYE
- GP MAKABDJE B/GP DJEKOLAO
- GP MELOMGOTO
- GPA ALLAKASSI/GP MELOMGOTO
- TOKELEMA BEMBAIDA I
- GP TOKELEMAJ/GP NGAOBATANI
- GP LAOUMADJIBE/BEMBAIDAI
- GPA DJANKOH/GPA AREMADJIBEI
- BEMBIBO/GPA AREMADJIBE
- MELASNAN/DJASDOH
- GPA DJANAKO/BEMBAINDI/KOMABITA
- LAO ANDOUM
- GPA LAO ANDOUM
- BEGAMBE
- GPA MADJIYAM/GPA NDOLELEM/GPA NEKASRA/NDANRI

**MOUNDOU / BAIBOKOUM — 6 AV :**

- NGEBEME/BOUM II
- GP DINGAMBAYE
- GPA ZOUPAYE/DJIGAMBAYE
- NGEBEME
- ZALAPAYE/KEREKON
- MBIORE/GPA LARAKORO

**MOUNDOU / LOUMBOGO — 3 AV :**

- GP MARAMADI /AV MANKINRIN 2
- MANKINTI/MARAMADJI/DJILA EDOUARD
- LOUGOU NEOGUEMEL

**MOUNDOU / BEINAMAR — 3 AV :**

- GP DJENOUDJEKENE MBAYAM
- GP GUELYO/GP GREGOIR
- GPA DJEMAKOH2/ GP DJENOUDJI

**MOUNDOU / PANZANUE — 16 AV :**

- NENA PANZANGUEN BEIMON II
- MANOUDJI
- LOMBOLIMAN/AREMADJI/MEKASNA
- MANDAH/BEGUIDI
- BETABAR/BEGUINDI
- DJENKAGUE JOSEPH/MANOUDJI
- MANDAH/BEBAMA ABBE
- GPA SAMOUSSA/MANDAH
- MALAIDA/KAMKOUTOU
- GPA DJARA/ DJAIRAN
- DOLOGUE II/ MALAIDAH
- GPA RONEL/KAYTIA/GPA NODJIOADJIGAM
- KAITIA/YODAREM/MELOM/MEKASNAN/DOTOGUE/MEKARA
- BEKOR II
- KAMKOUTOU/DJASRA
- LOKOUNDJI/KAITIA/OYOGUE I/GPA NEKINGATINANG

**MOUNDOU / BENGAR — 3 AV :**

- BAMBODO
- GP LAOHOMAYE/GP NDOUKASNA
- LAO TIBO  F

**MOUNDOU / BADEI — 2 AV :**

- GPA DJAONANG AV BETABARA
- GP DJAOURANG/GPA AREMADJIBEYE

**MOUNDOU / MBAIDOGLO — 1 AV :**

- MBAIDOGLO GPA LAOVOUNA

**MOUNDOU / NDOL — 17 AV :**

- KERBAYE MOUDAH
- BOUAKAG/GPA NDOMADJIBE
- GP BOYNDOUL
- GP JEAN
- KOUJOB/SOLKOR
- GPA KOUMANAYE/GPA DJANAKO
- GPA DJANAKO/GP DEUASSEMNOUDJI
- MBAIDAMBE
- GPA DJANANKO
- MBIBARAN/MBENG
- BIDARE
- KOUDJOB/PEURKAR
- SARA
- BIDANE/SOMOUZA/AS BA/DAMBAYE/BOUGA II
- KERBAYE MOUDAH/GPA SALKOR/GPA MBADANBE/JEAN
- DAMBE BLAISE/BOUGA II/BEMBAR/GPA SOUMOUZO
- GPA DJOUILLE/ GPO BIDANE

**MOUNDOU / BEKAO FERME — 5 AV :**

- DJANADJO/LOKADJIRO/NOUDJIGOLE
- AV DOLAO/GPA DJAREMADJI/GPA DJANADJO
- MADJITOLOM/LOUDJIKOURA
- KOMNANGUE/BEDOG/LOKADJIROH/NOUDJIGOTO/MRLOM
- NAMO/MAKASNAN/SOLIDARITE DE MEME CŒUR.DOKAG

**MOUNDOU / BITOYE — 3 AV :**

- LATOL/NGORO
- MULANABAIS/GPA SOUROU/MENDJIMO
- BEBO/BOGOKERING

**MOUNDOU / KAYE LARMANAYE — 1 AV :**

- KAYE LARMANAYE

**MOUNDOU / BEDANE — 3 AV :**

- GPA KEUNOUDJO BEKOLE
- BEDANE/NDOGONOUDJI/LAOUMAYE
- BETABAR/BEDO BENOYE

**MOUNDOU / GADJIBIAN — 4 AV :**

- LAOUMIAN/DJANDOH
- GP DJARAKO/GP LAOMIAN
- BETOLOUM/NGAMADJI GUELBE/LAO KEIN KIBIDJE
- DJAREMADJI/NENOUDJI/TOURA I/SOYAH/LAOMAYE ROBERT

**MOUNDOU / BIDANGA — 6 AV :**

- GP DIRONG/GPA POULARA
- GP SALMBAYE
- GP DJINGAO/GPA BOGOTIONS
- BOL/NIAN/ABELABEYE/BAKY/WARA/NGANAGOU/BERE OYA
- GPA LAWYOMA/GPA POUTOUMANII/GPA POUTOUMANI
- NDERANBIN/GPA WALDA

**MOUNDOU / BESSAO FERME — 1 AV :**

- YALLO/MADJITOLOM/AREMADJIBI

**MOUNDOU / LAOKOIMASSE — 8 AV :**

- NGAMINGA/BENDOLOUM
- GP ALLARAMADJI/GP LAOWEMOEL/GP LAOMIAN SIMEON
- BEMBAI KANDJI
- GP KOUROULEYO/ GP LAOKOLE
- LAOBENGAKOR/DJARANE/NGANINGA/BENDOH/BEKOR
- SAOU
- GPA NAMGAMNE/BEMBAIKANDJI/NAMO/NEKINGAMDOK
- DJEKONDANGUE/MELOM/LAO BENGAKOR /NAMO

**MOUNDOU / BESSAO C — 2 AV :**

- GP KOUDJI GJIME
- KEZMDJEDAB

**MOUNDOU / BESSAO — 2 AV :**

- KODJI
- BESSAO

**MOUNDOU / MISE EN PLACE — 3 AV :**

- LAOUMBAIKASSE/SAOUNDAL/MIKODA/KOYABAYE/LEBELA
- DJASRA NDAB/DOLAODJE/TISSEM JOEL/BENGARII/KAINTAR
- LAOUDOLEMAYE/DINGAOOSSANGUE /MOROMBAYE/KOUMBE

**MOUNDOU / BAIBOKOUM/BESSAO CENTRE — 1 AV :**

- GPO NGBENE/GPA ZAKAKPAN/GPA LAOVONA

**MOUNDOU / BESSAO CENTRE — 4 AV :**

- DJARAKO/BEDARALAL/YALLO/NESSANGUE2
- DJARAKO/BEKOR II/BE DARA LEL/YALLO/NESSANGUE II
- BEDARALAL/MAIDOH/SAMAYE/BENGOR/BEKAO/BETAM I
- BESSAO/BEKIBI I/KOSHAMNODJI/GAMAIDJRLAOUHORMAYE

**MOUNDOU / LOUMBOGO/ LARMANAYE — 1 AV :**

- DOUASSEMNODJI/KOSMAYE/NDOYO JOEL/LAOTOKO II

**MOUNDOU / LAOUKOIMASSE — 1 AV :**

- DJIMADEM SA MEDI/DINGAOSSABE NDOLO/DINGAONAISSEM

**KOUMRA / BEBOPEN KAWA — 1 AV :**

- BEBOPEN KAWA

**KOUMRA / BEBOPEN GPMT AMADJIBEY — 1 AV :**

- BEBOPEN GPMT AMADJIBEY

**KOUMRA / GOUNDI — 1 AV :**

- GOUNDI

**KOUMRA / BENGOTO DJIRADOUM — 1 AV :**

- BENGOTO DJIRADOUM

**KOUMRA / GOHONGO — 1 AV :**

- KABA II DJASKO DENIS

**KOUMRA / PALOUM — 1 AV :**

- BEIGUI II /GOUNDI

**KOUMRA / BOUNA — 2 AV :**

- BOUNA
- MADJIGUERBAYE/LOUBAHOSSAIN/ALBERT

**KOUMRA / MISE EN PLACE — 12 AV :**

- RAKAMAN/DJASRA/KOSMADJI/BEMADJI/NDORMADJI
- RADOUMADJI.LOWEI/KOTANA/KONAN/MAITAMAN
- NDIGEBEYE/MAINDIGUE/ALLAHGOMADJI/MAIBOGO
- BEHOMONII/ASRANE/DJAIGONANI/NARANGAR.DJOTINAN
- KOLO/NARTEBAYE/BEBO/ACT/MASRANE/DJASRAMADJI
- GOUAR/BOLBANG/NAHOSSENGAR/GAMI BOUKAR/PALOUM
- KOUTYO/NGANDILI/NGAMBOH/KANGTE/GUEDESSI
- DJIMRABEYE AMOS/NGARTOIDE DJIMRANGAR/KOUH
- KOSGUIMBE/KOKABRI/BEDJONDO/NANHANDOUM
- SANDANAN/GUIDITI/DOBOII/MANDANG/TOINGAR/KOIMAYE
- NODJIRENGAR/DJIMASBEYE/YALDE DJIMASGAR/KOKA
- MAYE/BEIGUI II/ADOUMNGAR/MAIBA/LIBERTE/ALI DOGUIR

**DOBA / MISE EN PLACE — 8 AV :**

- BENGALA/NDOLEDJANGA/BENGREU/KARA II/ MAMGAGA
- NGARABE/TOMAPYI II/DJIMTONI/DOHOLO/TOGDJIM
- NGRYEBE/BAMAN/NGARLAYE/BEDJEME/BETI/BEJOME
- DJIMTINE/TOGDJIM/DOHOLO/BERO/NGARABE/DJINGAM
- DJIMASDE/YOGOTO/MASRANE
- MAIBO GABRI/KOURATI/DJAMAYE/MOULAMADJIBE
- BEDE/MEKASNAN/NDEULMADJI/BEDJAL
- BENDOL/BAOUMADJI/ROTANGA/DAMADJI/RAMADJI

### Vérifications de la section 3

- [ ] 3 usines créées : `MOUNDOU`, `KOUMRA`, `DOBA`.
- [ ] 20 camions créés (y compris `08T068`, voir la note du tableau ci-dessus).
- [ ] 20 chauffeurs créés (un par camion).
- [ ] 51 CGI créés : 42 pour MOUNDOU, 8 pour KOUMRA, 1 pour DOBA. Un même nom peut exister dans
      plusieurs usines (ex. `MISE EN PLACE`) : créer un enregistrement par usine.
- [ ] AV créés : suivre la liste par CGI (chaque AV est rattaché à son CGI).
- [ ] Client `COTONTCHAD SN` présent dans Référentiels → Clients (créé à l'installation : rien à saisir).

## 4. Cycle de saisie d'une opération

Répéter ce cycle pour chacune des 210 opérations (données en section 5). Une opération = 1 mission,
2 pesées, 1 BSM (sauf les opérations sans BSM, voir 5.3), 1 bordereau, 1 facture.

Les statuts avancent automatiquement au fil des saisies :
**Brouillon → Pesé à vide → Gasoil pris → Poids net calculé → Déchargement → Facturé → Payé**.
Si besoin, les chevrons ◀ ▶ de la liste des missions font avancer d'une étape (jamais de retour en arrière).

**Chronologie du terrain (en cours de campagne)** :
1. Au poste de sortie, le camion prend son gasoil (BSM) et passe à la pesée à vide, puis part charger le coton.
2. Retour à l'usine : le bordereau papier est remis au bureau.
3. La saisie dans le système s'effectue bordereau en main — **c'est à ce moment que les CGI et AV sont connus** (ils figurent sur le bordereau).

L'application impose de créer la mission avant la pesée à vide et la BSM (qui lui sont liées) : au départ,
créez la mission avec le camion et la date (chauffeur et usine si connus) ; complétez CGI et AV au retour
avec le bordereau, via « Modifier ». Pour la saisie rétroactive des 210 opérations du rapport (section 5),
toutes les données sont déjà connues : déroulez simplement les étapes 4.1 à 4.7 dans l'ordre.

### 4.1 Mission

- [ ] Menu **Opérations → Missions** → « Nouvelle mission ».
- Remplir : Campagne (pré-remplie), Date et Camion (seuls champs obligatoires), puis Chauffeur et Usine ;
  **CGI et AV** : les choisir si déjà connus — la sélection se fait en cascade (les CGI dépendent de
  l'usine choisie, les AV du CGI) ; sinon les laisser vides et les compléter au retour avec le bordereau
  (bouton « Modifier »). Observations si besoin (ex. « SSC » pour l'opération n° 41).
- [ ] Cliquer sur « Créer la mission » : la mission apparaît au statut « Brouillon ».

### 4.2 Pesée à vide

- [ ] Menu **Opérations → Pesées** → bouton « Pesées » sur la ligne de la mission → « Pesée à vide ».
- Remplir : Date (celle de l'opération), Heure, **Poids (kg)** : le poids à vide du camion (tableau de la
  section 3 — ex. `8 100` pour `08T0681A`, `19 980` pour `18P2908A`, `10 000` ou `20 000` pour les
  autres), N° ticket (facultatif).
- [ ] Cliquer sur « Enregistrer la pesée » : la mission passe à « Pesé à vide ».

La pesée à vide est exigée avant la création de la BSM.

### 4.3 BSM gasoil

- [ ] Menu **Opérations → BSM / Gasoil** → « Nouveau BSM ».
- Remplir : Campagne (pré-remplie) ; **Mission** : sélectionner la mission (le camion et l'usine se
  remplissent automatiquement) ; Date (celle de l'opération) ; **Numéro** : le numéro de la colonne BSM
  du tableau (section 5.2), c'est-à-dire le n° du bon de sortie magasin (ex. bon `0053031` → `53031`) ;
  **Quantité (L)** : 220 (quantité du bon — le total par mission figure en colonne « Gasoil (L) »
  du tableau 5.2) ; **Prix au litre** : pré-rempli (840) ;
  **Bénéficiaire** : le chauffeur du camion ; **Imputation** : `COTONTCHAD SN` ; Référence : facultatif.
- [ ] Cliquer sur « Créer le BSM » : la mission passe à « Gasoil pris ».

Cas particuliers (détail en 5.3) :
- colonne BSM `—` : pas de BSM à créer (la facture n'aura pas de déduction gasoil) ;
- colonne BSM `— (SSC)` (n° 41) : pas de BSM ; indiquer « SSC » dans les observations de la mission ;
- plusieurs numéros (ex. `60393/60374`) : créer un BSM par numéro.

### 4.4 Pesée chargée

- [ ] **Opérations → Pesées** → « Pesée chargée » sur la ligne de la mission.
- **Poids (kg) = poids à vide du camion + marchandise** :
  - opération coton : `poids à vide + Coton (t) × 1000` — ex. opération n° 138 (`08T0681A`, 8 100 à vide) :
    coton 16,62 t → 8 100 + 16 620 = 24 720 kg (c'est la pesée brute du bordereau `0051628`) ;
  - opération intrants : `poids à vide + Intr. (kg)` — ex. opération n° 202 (`18P2908A`, 19 980 à vide) :
    20 600 kg → 19 980 + 20 600 = 40 580 kg (c'est la pesée brute du bordereau `0054494`).
- [ ] Cliquer sur « Enregistrer la pesée » : la synthèse affiche le poids net (il doit correspondre à la
  marchandise du tableau) et la mission passe à « Poids net calculé ».

### 4.5 Bordereau de transport

- [ ] Menu **Opérations → Bordereaux** → « Nouveau bordereau ».
- Remplir : Campagne (pré-remplie) ; **Mission** : sélectionner la mission (camion, chauffeur, usine et
  CGI se remplissent automatiquement ; si le CGI de la mission est encore vide — mission créée au départ —
  le choisir ici d'après le bordereau papier) ; Date ; **Numéro** : `BD-2026-XXX` ; **Type de fret** :
  « Direct — coton graine » (valeur par défaut) ; **Distance (km)** : colonne « Dist. (km) » du tableau ;
  Observations : facultatif.
- Ligne de chargement : **AV** = colonne AV ; **Localité** = nom du CGI (ou laisser vide) ;
  **Poids (kg)** = Coton (t) × 1000 ou Intr. (kg) ; Code : facultatif.
- [ ] Cliquer sur « Créer le bordereau » (création en brouillon).
- [ ] Dans la liste, cliquer sur ✓ « Valider » : l'application vérifie les deux pesées et la distance,
  fige le tarif et calcule le montant ; le bordereau passe « Validé » et la mission « Déchargement ».

Si la validation est refusée, vérifier : la pesée à vide et la pesée chargée de la mission, au moins une
ligne de chargement, et la distance (« Renseignez la distance du bordereau avant de le valider »).

### 4.6 Facture

- [ ] Menu **Finance → Factures** → « Nouvelle facture ».
- Remplir : Campagne (pré-remplie) ; **Client** : `COTONTCHAD SN` ; **Numéro** : `FAC-2026-XXX` ;
  Date (celle de l'opération) ; Observations et case « ORIGINAL PAYABLE » selon votre procédure.
- **Bordereaux à facturer (transport)** : cocher le bordereau de l'opération — si la mission a une BSM,
  celle-ci se coche automatiquement dans « BSM à déduire (gasoil) » (liaison par la mission).
- Vérifier les totaux affichés : Montant brut / Gasoil (déduit) / Montant net.
- [ ] Cliquer sur « Créer la facture » (brouillon).
- [ ] Dans la liste, cliquer sur ✓ « Valider la facture » : les missions et BSM passent au statut « Facturé ».

### 4.7 Paiement (facultatif)

- [ ] Menu **Finance → Paiements** → « Nouveau paiement » : Facture, Date du paiement,
  **Montant (FCFA)** = montant net, Mode de paiement, Référence, Statut.
- [ ] Cliquer sur « Enregistrer le paiement » : lorsque le total réglé atteint le montant net, la facture
  passe « Payée » et la mission « Payé ».

Contrôle rapide par opération : la mission est « Facturé » et la facture est « Validée » (Finance → Factures).

## 5. Les 210 opérations du rapport

Mode d'emploi :
- traiter **un lot à la fois** (section 5.1) ; après chaque lot, sauvegarder et contrôler (section 6.1) ;
- pour chaque opération, dérouler le cycle de la section 4 avec la date choisie dans la plage du lot ;
- colonnes du tableau (5.2) : N° (numéro de l'opération), Lot, Camion, Usine, CGI, AV, Coton (t),
  Intr. (kg) (`—` = sans intrants), Dist. (km) (`*` = valeur suggérée : la cellule est vide dans le
  rapport, la valeur indiquée est la première distance de tronçon — à saisir telle quelle),
  Montant rapport (F) (référence historique ; l'application recalcule), BSM (`—` = aucune BSM,
  `— (SSC)` = mention SSC).

### 5.1 Lots et planning conseillé

| Lot | Opérations | Dates suggérées | Nb op. | Coton (t) | Intrants (kg) | Distance (km) | Montant rapport (F) |
|---|---|---|---:|---:|---:|---:|---:|
| 1 | n° 1 à 20 | du 15/11/2025 au 06/12/2025 | 20 | 368,54 | 0 | 4 259 | 9 813 661 |
| 2 | n° 21 à 40 | du 06/12/2025 au 26/12/2025 | 20 | 304,74 | 0 | 3 479 | 6 123 982 |
| 3 | n° 41 à 60 | du 26/12/2025 au 16/01/2026 | 20 | 321,20 | 0 | 3 124 | 7 159 542 |
| 4 | n° 61 à 80 | du 16/01/2026 au 06/02/2026 | 20 | 321,20 | 0 | 3 300 | 6 347 503 |
| 5 | n° 81 à 100 | du 06/02/2026 au 26/02/2026 | 20 | 318,98 | 0 | 3 906 | 6 976 252 |
| 6 | n° 101 à 120 | du 26/02/2026 au 19/03/2026 | 20 | 292,08 | 0 | 2 994 | 4 646 273 |
| 7 | n° 121 à 140 | du 19/03/2026 au 08/04/2026 | 20 | 286,30 | 31 200 | 2 929 | 5 870 285 |
| 8 | n° 141 à 160 | du 08/04/2026 au 29/04/2026 | 20 | 297,36 | 34 723 | 3 362 | 7 191 275 |
| 9 | n° 161 à 180 | du 29/04/2026 au 20/05/2026 | 20 | 77,22 | 336 919 | 3 075 | 7 177 035 |
| 10 | n° 181 à 200 | du 20/05/2026 au 09/06/2026 | 20 | 0,00 | 369 254 | 2 612 | 5 450 353 |
| 11 | n° 201 à 210 | du 09/06/2026 au 30/06/2026 | 10 | 0,00 | 192 709 | 1 731 | 3 757 273 |

### 5.2 Tableau complet des 210 opérations

| N° | Lot | Camion | Usine | CGI | AV | Coton (t) | Intr. (kg) | Dist. (km) | Montant rapport (F) | BSM | Gasoil (L) |
|---:|---:|---|---|---|---|---:|---:|---:|---:|---|---:|
| 1 | 1 | 08P0444A | MOUNDOU | BAKE | MASRANE/ALLARABAYE | 17,34 | — | 229 | 471 926 | 60312 | 220 |
| 2 | 1 | 08P0444A | MOUNDOU | BAKE | MASRANE/ALLARABAYE | 17,16 | — | 229 | 460 199 | 60335 | 220 |
| 3 | 1 | 08P0444A | MOUNDOU | KOUH BAKE | KODIADOUM | 18,14 | — | 229 | 521 358 | 73461 | 220 |
| 4 | 1 | 08P0444A | MOUNDOU | BAKE | GP MASRANE | 16,14 | — | 229 | 470 429 | 73337 | 220 |
| 5 | 1 | 18P2908A | MOUNDOU | BEMBAITADA | BEMADJA/BEKONON | 18,44 | — | 208 | 494 683 | 60364 | 220 |
| 6 | 1 | 18P2908A | MOUNDOU | BEMBAITADA | GP DJIMADOUM GP ALLARBEYE | 18,80 | — | 258 | 477 085 | 73307 | 220 |
| 7 | 1 | 18P2908A | MOUNDOU | CGI BEMBA | GP  NOUDJI,GP TADE | 17,00 | — | 258 | 437 147 | 60318 | 220 |
| 8 | 1 | 08P0049A | MOUNDOU | BAKE | GPA MENDAH GPA ATOKAN | 19,84 | — | 228 | 781 037 | 60375 | 220 |
| 9 | 1 | 08P0049A | MOUNDOU | BEDJAL | BEDE GPA MEKASNAN | 24,60 | — | 152 | 532 379 | 60322 | 220 |
| 10 | 1 | 08P0049A | MOUNDOU | BEDJAL | BEBOYE NGARA | 25,64 | — | 147 | 563 970 | 73312 | 220 |
| 11 | 1 | 18P0740A | MOUNDOU | GAMA | KORO GOUDO GP NGARHOIDJI EMILE | 17,84 | — | 202 | 483 942 | 60315 | 220 |
| 12 | 1 | 12P0116A | MOUNDOU | CGI KOUTOUTOU | BEMIAN | 20,18 | — | 165 | 460 141 | 60341 | 220 |
| 13 | 1 | 12P0116A | MOUNDOU | CGI KOUTOUTOU | BEMIAN GP DOUMSENGAR | 18,44 | — | 165 | 412 875 | 73350 | 220 |
| 14 | 1 | 18P2572A | MOUNDOU | CGI BODO | MEMTODJIM DJEDANOUM | 15,66 | — | 273 | 374 636 | 60393/60374 | 440 |
| 15 | 1 | 18P2572A | MOUNDOU | CGI BODO | MBAIOUROUM | 18,76 | — | 199 | 502 384 | 60365 | 220 |
| 16 | 1 | 14P1122A | MOUNDOU | BODO | GPA MENDAH | 16,86 | — | 273 | 597 157 | 60374 | 220 |
| 17 | 1 | 14P1122A | MOUNDOU | BAKE | DJIMHOYEL JOEL | 12,56 | — | 228 | 321 556 | 73463 | 220 |
| 18 | 1 | 08P0588A | MOUNDOU | CGI BEBOTO | GP HONDE GP ALLARAMADJI | 21,40 | — | 169 | 506 781 | 60336 | 220 |
| 19 | 1 | 08P0588A | MOUNDOU | BEBOTO | LAISSEDJE MIANBE | 14,14 | — | 169 | 287 305 | 60357 | 220 |
| 20 | 1 | 18P0740A | MOUNDOU | MOUKOUM | MEDILATI/DJAMAYE | 19,60 | — | 249 | 656 671 | 73340 | 220 |
| 21 | 2 | 18P2908A | MOUNDOU | TAPOL | GP LOHOUDJA/GP DJARAKO | 15,88 | — | 88 | 139 557 | 59752 | 220 |
| 22 | 2 | 14T0021A | MOUNDOU | OUDIMIAN | GPA MBAILASSEM/GP NARROYE | 10,74 | — | 252 | 214 398 | 59776 | 220 |
| 23 | 2 | 14T0021A | MOUNDOU | OUDIMIAN | GP NADJIMBAYE | 14,92 | — | 252 | 461 958 | 73459 | 220 |
| 24 | 2 | 18P2572A | MOUNDOU | BEBDJA | KOUBEBE/HOBOMENGALI | 15,22 | — | 132 | 184 569 | 73478 | 220 |
| 25 | 2 | 18P2572A | MOUNDOU | LARAMANAYE | GPA YINE BINGO/GPA MBAH I | 15,54 | — | 147 | 223 917 | 59794 | 220 |
| 26 | 2 | 12P0116A | MOUNDOU | LARAMANAYE | GOUSSOURO | 13,46 | — | 120 | 136 886 | 46143 | 220 |
| 27 | 2 | 12P0116A | MOUNDOU | MOUKOUMTOULOUM | GP DOSSENGAR/DOGBARA I/GAGAN | 16,56 | — | 253 | 528 207 | 73467 | 220 |
| 28 | 2 | 12P0116A | MOUNDOU | MOUROUMTOULOU | KOSAMBE/MOSSENGAR | 18,78 | — | 248 | 622 337 | 59791 | 220 |
| 29 | 2 | 08P0444A | MOUNDOU | ANDOUM | DJERALAR/GPA AREMADJIBAYE | 13,92 | — | 96 | 121 381 | — | — |
| 30 | 2 | 08P0444A | MOUNDOU | ANDOUM | GP MAKABDJE B/GP DJEKOLAO | 15,12 | — | 90 | 143 837 | 59801 | 220 |
| 31 | 2 | 08P0444A | MOUNDOU | BAKE | GP ALLAGOME | 13,86 | — | 219 | 361 362 | 59762 | 220 |
| 32 | 2 | 08P0050A | MOUNDOU | ANDOUM | GP MELOMGOTO | 8,40 | — | 63 | 55 751 | 59789 | 220 |
| 33 | 2 | 08P0050A | MOUNDOU | ANDOUM | GPA ALLAKASSI/GP MELOMGOTO | 15,50 | — | 63 | 147 604 | 73486 | 220 |
| 34 | 2 | 08P0050A | MOUNDOU | BAIBOKOUM | NGEBEME/BOUM II | 18,10 | — | 240 | 558 511 | — | — |
| 35 | 2 | 14P1122A | MOUNDOU | BAIBOKOUM | GP DINGAMBAYE | 16,44 | — | 240 | 486 959 | 59799 | 220 |
| 36 | 2 | 14P1122A | MOUNDOU | BAIBOKOUM | GPA ZOUPAYE/DJIGAMBAYE | 17,16 | — | 240 | 518 607 | 59843 | 220 |
| 37 | 2 | 14P1122A | MOUNDOU | BAKE | KOUH/GPA ESPOIR/KOUH II | 14,48 | — | 222 | 383 236 | 59754 | 220 |
| 38 | 2 | 08P0050A | MOUNDOU | TAPOL | GP NEHOGUEMEL/GPA MARAMADJI | 14,60 | — | 171 | 214 338 | 73481 | 220 |
| 39 | 2 | 08P0049A | MOUNDOU | LOUMBOGO | GP MARAMADI /AV MANKINRIN 2 | 16,70 | — | 172 | 368 962 | 59800 | 220 |
| 40 | 2 | 08P0049A | MOUNDOU | LOUMBOGO | MANKINTI/MARAMADJI/DJILA EDOUARD | 19,36 | — | 171 | 251 605 | 59839 | 220 |
| 41 | 3 | 08T0038A | KOUMRA | BEBOPEN KAWA | BEBOPEN KAWA | 18,82 | — | 159 * | 643 362 | — (SSC) | — |
| 42 | 3 | 08T0038A | KOUMRA | BEBOPEN KAWA | BEBOPEN KAWA | 18,36 | — | 120 | 526 837 | 72509 | 220 |
| 43 | 3 | 08T0038A | KOUMRA | BEBOPEN GPMT AMADJIBEY | BEBOPEN GPMT AMADJIBEY | 15,78 | — | 150 | 413 439 | 72516 | 220 |
| 44 | 3 | 08T0038A | KOUMRA | GOUNDI | GOUNDI | 17,78 | — | 100 | 165 783 | 72526 | 220 |
| 45 | 3 | 08T0038A | KOUMRA | BENGOTO DJIRADOUM | BENGOTO DJIRADOUM | 16,86 | — | 135 | 455 709 | 72538 | 220 |
| 46 | 3 | 08T0038A | KOUMRA | GOHONGO | KABA II DJASKO DENIS | 15,92 | — | 236 | 585 581 | 55959 | 220 |
| 47 | 3 | 08T0038A | KOUMRA | PALOUM | BEIGUI II /GOUNDI | 15,30 | — | 120 | 293 940 | 55977 | 220 |
| 48 | 3 | 18P2908A | MOUNDOU | BEINAMAR | GP DJENOUDJEKENE MBAYAM | 17,60 | — | 130 | 274 098 | — | — |
| 49 | 3 | 08T0072A | MOUNDOU | OUDIMIAN | BENGAMOUNDOU II | 11,02 | — | 206 | 253 434 | — | — |
| 50 | 3 | 08P0588A | MOUNDOU | PANZANUE | NENA PANZANGUEN BEIMON II | 20,44 | — | 216 | 609 588 | 71498 | 220 |
| 51 | 3 | 08T0681A | MOUNDOU | OUDIMIAN | HAMBEYE MEKASNAN | 14,56 | — | 210 | 366 841 | 59971 | 220 |
| 52 | 3 | 08T0321A | MOUNDOU | BENGAR | BAMBODO | 14,12 | — | 148 | 252 119 | 59763 | 220 |
| 53 | 3 | 08P0049A | MOUNDOU | LOUMBOGO | LOUGOU NEOGUEMEL | 17,56 | — | 172 | 273 773 | 59988 | 220 |
| 54 | 3 | 14P1122A | MOUNDOU | BADEI | GPA DJAONANG AV BETABARA | 15,80 | — | 115 | 107 805 | 53503 | 220 |
| 55 | 3 | 14P1122A | MOUNDOU | MBAIDOGLO | MBAIDOGLO GPA LAOVOUNA | 18,02 | — | 240 | 560 231 | — | — |
| 56 | 3 | 08T0680A | MOUNDOU | NDOL | KERBAYE MOUDAH | 14,10 | — | 158 | 267 438 | 53525 | 220 |
| 57 | 3 | 08T0680A | MOUNDOU | NDOL | KERBAYE MOUDAH | 14,46 | — | 178 | 260 855 | — | — |
| 58 | 3 | 08T0681A | MOUNDOU | OUDIMIAN | MAREMADJI/MEKASNAN II | 15,22 | — | 210 | 396 253 | 59844 | 220 |
| 59 | 3 | 08T0680A | MOUNDOU | OUDIMIAN | DJAKOMBETE/GPA MEKASNA | 13,12 | — | 196 | 297 971 | — | — |
| 60 | 3 | 08P0050A | MOUNDOU | ANDOUM | TOKELEMA BEMBAIDA I | 16,36 | — | 84 | 154 485 | 53535 | 220 |
| 61 | 4 | 08P0050A | MOUNDOU | BAIBOKOUM | NGEBEME | 18,30 | — | 228 | 556 035 | — | — |
| 62 | 4 | 08P0444A | MOUNDOU | ANDOUM | GP TOKELEMAJ/GP NGAOBATANI | 14,16 | — | 108 | 92 468 | — | — |
| 63 | 4 | 08P0444A | MOUNDOU | PANZANUE | MANOUDJI | 16,42 | — | 204 | 428 791 | — | — |
| 64 | 4 | 12P0116A | MOUNDOU | LARAMANAYE | LARMANAYE LIEMOUKOU/DINGAMGOTODIE | 14,04 | — | 120 | 102 963 | 5998 | 220 |
| 65 | 4 | 12P0116A | MOUNDOU | LARAMANAYE | GPA LIEMOUKOU/LARMANAYE | 17,18 | — | 120 | 148 533 | 5994 | 220 |
| 66 | 4 | 18P2572A | MOUNDOU | LARAMANAYE | GPA YINE BINGO/GPA MBATOYE | 14,38 | — | 147 | 198 104 | 59910 | 220 |
| 67 | 4 | 18T2572A | MOUNDOU | LARAMANAYE | GPA LAOBIOW GPA MBAIBOL I | 14,02 | — | 147 | 190 876 | 59909 | 220 |
| 68 | 4 | 09T0015A | MOUNDOU | LARAMANAYE | KAYE LARMANAYE | 13,66 | — | 103 | 111 728 | 53690 | 220 |
| 69 | 4 | 09T0015A | MOUNDOU | LARAMANAYE | PAO | 13,20 | — | 132 | 201 300 | 53526 | 220 |
| 70 | 4 | 14P1122A | MOUNDOU | BADEI | GP DJAOURANG/GPA AREMADJIBEYE | 14,66 | — | 30 | 175 299 | 53691 | 220 |
| 71 | 4 | 18P2908A | MOUNDOU | BEINAMAR | GP GUELYO/GP GREGOIR | 16,88 | — | 260 | 151 778 | 53542/53681/53686 | 660 |
| 72 | 4 | 08P0050A | MOUNDOU | ANDOUM | GP LAOUMADJIBE/BEMBAIDAI | 16,28 | — | 84 | 153 955 | 53692 | 220 |
| 73 | 4 | 18P0740A | MOUNDOU | NDOL | BOUAKAG/GPA NDOMADJIBE | 15,74 | — | 164 | 325 862 | 53521 | 220 |
| 74 | 4 | 08T0681A | MOUNDOU | LARAMANAYE | KOUNDAYE PAO | 15,16 | — | 151 | 283 844 | 53689 | 220 |
| 75 | 4 | 08T068 | MOUNDOU | NDOL | KERBAYE MOUDAH | 15,46 | — | 158 | 306 035 | 53678 | 220 |
| 76 | 4 | 08P0049A | MOUNDOU | BAIBOKOUM | ZALAPAYE/KEREKON | 20,04 | — | 240 | 660 120 | 59998 | 220 |
| 77 | 4 | 12P0116A | MOUNDOU | BEKAO FERME | DJANADJO/LOKADJIRO/NOUDJIGOLE | 14,78 | — | 201 | 333 830 | 53668 | 220 |
| 78 | 4 | 08P0588A | MOUNDOU | PANZANUE | LOMBOLIMAN/AREMADJI/MEKASNA | 21,84 | — | 216 | 663 768 | 53532 | 220 |
| 79 | 4 | 18P2572A | MOUNDOU | BITOYE | LATOL/NGORO | 16,10 | — | 248 | 503 988 | 53523 | 220 |
| 80 | 4 | 08T0038A | KOUMRA | BOUNA | BOUNA | 18,90 | — | 239 | 758 226 | 63003 | 220 |
| 81 | 5 | 08T0038A | KOUMRA | BOUNA | MADJIGUERBAYE/LOUBAHOSSAIN/ALBERT | 19,20 | — | 309 | 223 941 | 63028 | 220 |
| 82 | 5 | 08T0072A | MOUNDOU | OUDIMIAN | MBAIRE | 13,38 | — | 206 | 321 752 | 53666 | 220 |
| 83 | 5 | 08T0321A | MOUNDOU | BENGAR | BAMBODO | 12,54 | — | 158 | 201 596 | 53679 | 220 |
| 84 | 5 | 08T0321A | MOUNDOU | KAYE LARMANAYE | KAYE LARMANAYE | 14,30 | — | 103 | 121 016 | 60948 | 220 |
| 85 | 5 | 18P0740A | MOUNDOU | BEDANE | GPA KEUNOUDJO BEKOLE | 18,36 | — | 246 | 503 488 | 59777/73484 | 440 |
| 86 | 5 | 09T0015A | MOUNDOU | LARAMANAYE | LARAMANAYE | 14,08 | — | 103 | 117 823 | 60902 | 220 |
| 87 | 5 | 08P0049A | MOUNDOU | BAIBOKOUM | MBIORE/GPA LARAKORO | 18,80 | — | 240 | 606 800 | 60868 | 220 |
| 88 | 5 | 14T0021A | MOUNDOU | OUDIMIAN | BENGAKARA/GP KASRA | 14,54 | — | 252 | 437 164 | 59919 | 220 |
| 89 | 5 | 18P2572A | MOUNDOU | GADJIBIAN | LAOUMIAN/DJANDOH | 14,04 | — | 159 | 211 721 | 60864 | 220 |
| 90 | 5 | 12P0116A | MOUNDOU | BEKAO FERME | AV DOLAO/GPA DJAREMADJI/GPA DJANADJO | 17,42 | — | 213 | 418 552 | 60933/60909 | 440 |
| 91 | 5 | 08T0680A | MOUNDOU | NDOL | GP BOYNDOUL | 14,44 | — | 158 | 277 087 | 53258 | 220 |
| 92 | 5 | 08T0681A | MOUNDOU | LARAMANAYE | MINZOUKOU/HOULRING | 15,60 | — | 151 | 295 764 | 53729 | 220 |
| 93 | 5 | 08T0681A | MOUNDOU | LARAMANAYE | KOUNDAYE PAO | 16,78 | — | 151 | 327 730 | 60920 | 220 |
| 94 | 5 | 08T0038A | MOUNDOU | BIDANGA | GP DIRONG/GPA POULARA | 12,22 | — | 217 | 293 261 | 53272 | 220 |
| 95 | 5 | 08T0038A | MOUNDOU | BIDANGA | GP SALMBAYE | 18,64 | — | 153 | 596 856 | 73309 | 220 |
| 96 | 5 | 08P0050A | MOUNDOU | PANZANUE | MANDAH/BEGUIDI | 13,90 | — | 204 | 296 579 | 60882 | 220 |
| 97 | 5 | 08P0050A | MOUNDOU | PANZANUE | BETABAR/BEGUINDI | 14,48 | — | 199 | 335 123 | — | — |
| 98 | 5 | 18P2908A | MOUNDOU | BEDANE | BEDANE/NDOGONOUDJI/LAOUMAYE | 17,92 | — | 120 | 290 440 | 59785 | 220 |
| 99 | 5 | 18P2908A | MOUNDOU | BITOYE | MULANABAIS/GPA SOUROU/MENDJIMO | 19,38 | — | 282 | 588 733 | 53696 | 220 |
| 100 | 5 | 18P2908A | MOUNDOU | BITOYE | BEBO/BOGOKERING | 18,96 | — | 282 | 510 826 | 53254 | 220 |
| 101 | 6 | 08P0444A | MOUNDOU | ANDOUM | GPA DJANKOH/GPA AREMADJIBEI | 14,50 | — | 105 | 122 239 | — | — |
| 102 | 6 | 08P0444A | MOUNDOU | PANZANUE | DJENKAGUE JOSEPH/MANOUDJI | 15,30 | — | 204 | 385 180 | 53665 | 220 |
| 103 | 6 | 14P1122A | MOUNDOU | BEKAO FERME | MADJITOLOM/LOUDJIKOURA | 16,68 | — | 214 | 386 860 | — | — |
| 104 | 6 | 14P1122A | MOUNDOU | BESSAO FERME | YALLO/MADJITOLOM/AREMADJIBI | 16,30 | — | 194 | 404 769 | 60923 | 220 |
| 105 | 6 | 08T0680A | MOUNDOU | NDOL | GP JEAN | 14,20 | — | 158 | 270 276 | 60888 | 220 |
| 106 | 6 | 08T0680A | MOUNDOU | NDOL | KOUJOB/SOLKOR | 14,44 | — | 158 | 239 832 | 60962 | 220 |
| 107 | 6 | 08T0680A | MOUNDOU | NDOL | KERBAYE MOUDAH | 14,06 | — | 158 | 266 303 | 53358 | 220 |
| 108 | 6 | 14P1122A | MOUNDOU | NDOL | GPA KOUMANAYE/GPA DJANAKO | 13,52 | — | 168 | 248 039 | 60952 | 220 |
| 109 | 6 | 14P1122A | MOUNDOU | NDOL | GPA DJANAKO/GP DEUASSEMNOUDJI | 15,90 | — | 162 | 333 695 | 53352 | 220 |
| 110 | 6 | 08P0444A | MOUNDOU | TAPOL | GP CHARLE/GP BRUNO/MBAGUEMAYE | 14,18 | — | 157 | 73 914 | 53351/53354 | 440 |
| 111 | 6 | 08P0444A | MOUNDOU | PANZANUE | MANDAH/BEBAMA ABBE | 15,32 | — | 209 | 336 110 | 60964 | 220 |
| 112 | 6 | 09T0015A | MOUNDOU | LARAMANAYE | KAYE LARMANAYE | 13,18 | — | 103 | 104 761 | 53286 | 220 |
| 113 | 6 | 09T0015A | MOUNDOU | NDOL | MBAIDAMBE | 14,30 | — | 110 | 276 540 | 60997 | 220 |
| 114 | 6 | 14T0021A | MOUNDOU | NDOL | GPA DJANANKO | 13,88 | — | 164 | 271 075 | 53278 | 220 |
| 115 | 6 | 14T0021A | MOUNDOU | NDOL | MBIBARAN/MBENG | 12,46 | — | 110 | 154 059 | 60983 | 220 |
| 116 | 6 | 08P0049A | MOUNDOU | ANDOUM | BEMBIBO/GPA AREMADJIBE | 17,96 | — | 105 | 172 453 | 53353 | 220 |
| 117 | 6 | 08P0049A | MOUNDOU | ANDOUM | MELASNAN/DJASDOH | 17,18 | — | 122 | 135 569 | 60980 | 220 |
| 118 | 6 | 08T0072A | MOUNDOU | NDOL | BIDARE | 11,68 | — | 161 | 161 082 | 53376/53297 | 440 |
| 119 | 6 | 18P2572A | MOUNDOU | GADJIBIAN | GP DJARAKO/GP LAOMIAN | 12,74 | — | 130 | 181 661 | 53273 | 220 |
| 120 | 6 | 12P0116A | MOUNDOU | ANDOUM | GPA DJANAKO/BEMBAINDI/KOMABITA | 14,30 | — | 102 | 121 856 | 60972 | 220 |
| 121 | 7 | 08T0321A | MOUNDOU | LARAMANAYE | GPA ALLA KARIM | 14,76 | — | 103 | 127 692 | 53369 | 220 |
| 122 | 7 | 08T0038A | MOUNDOU | LARAMANAYE | BOUFIAN DANIEL | 16,90 | — | 147 | 323 441 | 60955 | 220 |
| 123 | 7 | 08P0050A | MOUNDOU | LARAMANAYE | MAINI MBAIBOL/LAOMBION | 12,66 | — | 126 | 179 960 | 53398 | 220 |
| 124 | 7 | 18P2908A | MOUNDOU | TAPOL | MBAGUEMAYE/GP DJERABE | 19,62 | — | 171 | 178 834 | 60960 | 220 |
| 125 | 7 | 08P0588A | MOUNDOU | TAPOL | MBAGUEMAYE/DJERABE | 20,92 | — | 97 | 222 132 | 60919 | 220 |
| 126 | 7 | 08T0681A | MOUNDOU | OUDIMIAN | MEMNOUDJI/BENGAMOUNDOU | 17,36 | — | 226 | 452 133 | 53385 | 220 |
| 127 | 7 | 08T0038A | MOUNDOU | LARAMANAYE | KOUMBITE | 17,56 | — | 147 | 340 894 | 53023 | 220 |
| 128 | 7 | 08P0444A | MOUNDOU | PANZANUE | GPA SAMOUSSA/MANDAH | 14,26 | — | 189 | 317 998 | 53159 | 220 |
| 129 | 7 | 08P0049A | MOUNDOU | BENGAR | GP LAOHOMAYE/GP NDOUKASNA | 14,00 | — | 169 | 294 043 | 53160 | 220 |
| 130 | 7 | 08T0680A | MOUNDOU | NDOL | KOUDJOB/PEURKAR | 13,74 | — | 158 | 234 285 | 53032 | 220 |
| 131 | 7 | 14T0021A | MOUNDOU | NDOL | SARA | 13,40 | — | 110 | 172 652 | 53156 | 220 |
| 132 | 7 | 08P0050A | MOUNDOU | LARAMANAYE | MEMROREM/NGARAMGORE | 14,34 | — | 126 | 185 914 | 53168 | 220 |
| 133 | 7 | 08T0072A | MOUNDOU | NDOL | BIDARE | 14,42 | — | 141 | 247 395 | 53029 | 220 |
| 134 | 7 | 08T0072A | MOUNDOU | NDOL | BIDANE/SOMOUZA/AS BA/DAMBAYE/BOUGA II | 0,00 | 13 338 | 117 * | 163 378 | — | — |
| 135 | 7 | 14P1122A | MOUNDOU | BIDANGA | GP DJINGAO/GPA BOGOTIONS | 17,36 | — | 248 | 500 836 | 53025/53167 | 440 |
| 136 | 7 | 14P1122A | MOUNDOU | BIDANGA | BOL/NIAN/ABELABEYE/BAKY/WARA/NGANAGOU/BERE OYA | 0,00 | 17 862 | 186 * | 358 312 | — | — |
| 137 | 7 | 14P1122A | MOUNDOU | BIDANGA | GPA LAWYOMA/GPA POUTOUMANII/GPA POUTOUMANI | 19,64 | — | 228 | 610 774 | 50978 | 220 |
| 138 | 7 | 08T0681A | MOUNDOU | OUDIMIAN | BENDAIDOURA/BENGAMOND | 16,62 | — | 226 | 420 313 | 53031 | 220 |
| 139 | 7 | 18P2908A | MOUNDOU | LARAMANAYE | NGAL I/MAINI MBAIBOL | 15,84 | — | 111 | 235 297 | 53171 | 220 |
| 140 | 7 | 08T0321A | MOUNDOU | LAOKOIMASSE | NGAMINGA/BENDOLOUM | 12,90 | — | 206 | 304 002 | 53189 | 220 |
| 141 | 8 | 08P0050A | MOUNDOU | LAOKOIMASSE | GP ALLARAMADJI/GP LAOWEMOEL/GP LAOMIAN SIMEON | 13,46 | — | 214 | 313 867 | 51000 | 220 |
| 142 | 8 | 12P0116A | MOUNDOU | BEDANE | BETABAR/BEDO BENOYE | 15,86 | — | 208 | 402 121 | 53169 | 220 |
| 143 | 8 | 08T0072A | MOUNDOU | BESSAO C | GP KOUDJI GJIME | 16,32 | — | 176 | 367 954 | 53200 | 220 |
| 144 | 8 | 08T0680A | MOUNDOU | BESSAO | KODJI | 18,80 | — | 176 | 446 334 | 50963 | 220 |
| 145 | 8 | 08P0444A | MOUNDOU | PANZANUE | MALAIDA/KAMKOUTOU | 17,58 | — | 189 | 430 538 | 50954 | 220 |
| 146 | 8 | 18P2572A | MOUNDOU | PANZANUE | GPA DJARA/ DJAIRAN | 20,28 | — | 193 | 539 872 | 50983 | 220 |
| 147 | 8 | 08T0681A | MOUNDOU | ANDOUM | LAO ANDOUM | 17,36 | — | 103 | 165 426 | 51318 | 220 |
| 148 | 8 | 08P0588A | MOUNDOU | BESSAO C | KEZMDJEDAB | 17,20 | — | 176 | 395 766 | 51319 | 220 |
| 149 | 8 | 14P1122A | MOUNDOU | BIDANGA | NDERANBIN/GPA WALDA | 18,18 | — | 228 | 431 163 | 51330 | 220 |
| 150 | 8 | 08P0049A | MOUNDOU | BENGAR | LAO TIBO  F | 12,24 | — | 178 | 245 143 | 50968 | 220 |
| 151 | 8 | 08T0038A | MOUNDOU | OUDIMIAN | NEMAYE/DJIMTOLOUM/MEKASNAN/KOILAMAYE | 14,70 | — | 224 | 394 051 | 50986 | 220 |
| 152 | 8 | 08T0321A | MOUNDOU | BEINAMAR | GPA DJEMAKOH2/ GP DJENOUDJI | 12,34 | — | 122 | 119 036 | 51316 | 220 |
| 153 | 8 | 08T0681A | MOUNDOU | ANDOUM | GPA LAO ANDOUM | 21,02 | — | 90 | 229 463 | 51340 | 220 |
| 154 | 8 | 14T0021A | MOUNDOU | LAOKOIMASSE | BEMBAI KANDJI | 16,64 | — | 206 | 456 618 | 50987 | 220 |
| 155 | 8 | 12P0116A | MOUNDOU | PANZANUE | DOLOGUE II/ MALAIDAH | 16,64 | — | 206 | 403 014 | 51311 | 220 |
| 156 | 8 | 18P2572A | MOUNDOU | PANZANUE | GPA RONEL/KAYTIA/GPA NODJIOADJIGAM | 11,18 | — | 219 | 248 005 | 53006 | 220 |
| 157 | 8 | 18P2572A | MOUNDOU | PANZANUE | KAITIA/YODAREM/MELOM/MEKASNAN/DOTOGUE/MEKARA | 0,00 | 13 559 | 178 * | 262 541 | — | — |
| 158 | 8 | 08T0321A | MOUNDOU | LAOKOIMASSE | GP KOUROULEYO/ GP LAOKOLE | 12,98 | — | 210 | 303 291 | 60996 | 220 |
| 159 | 8 | 08T0321A | MOUNDOU | LAOKOIMASSE | LAOBENGAKOR/DJARANE/NGANINGA/BENDOH/BEKOR | 0,00 | 21 164 | 168 * | 385 911 | — | — |
| 160 | 8 | 18P2908A | MOUNDOU | OUDIMIAN | NDAMADJI/ SANGMAYE | 24,58 | — | 244 | 651 161 | 51307/51348/50999 | 660 |
| 161 | 9 | 08T0680A | MOUNDOU | LAOKOIMASSE | SAOU | 17,42 | — | 211 | 347 102 | 51347 | 220 |
| 162 | 9 | 18P2908A | MOUNDOU | LAOKOIMASSE | GPA NAMGAMNE/BEMBAIKANDJI/NAMO/NEKINGAMDOK | 14,96 | — | 211 | 382 276 | 51426 | 220 |
| 163 | 9 | 08T0038A | MOUNDOU | BESSAO | BESSAO | 14,68 | — | 174 | 311 489 | 51427 | 220 |
| 164 | 9 | 08T0681A | MOUNDOU | ANDOUM | BEGAMBE | 2,62 | — | 86 * | 38 024 | — | — |
| 165 | 9 | 08T0681A | MOUNDOU | BEKAO FERME | KOMNANGUE/BEDOG/LOKADJIROH/NOUDJIGOTO/MRLOM | 0,00 | 23 150 | 196 | 642 481 | 52321 | 220 |
| 166 | 9 | 08P0050A | MOUNDOU | PANZANUE | BEKOR II | 14,48 | — | 229 | 294 297 | 51339 | 220 |
| 167 | 9 | 08P0050A | MOUNDOU | PANZANUE | KAMKOUTOU/DJASRA | 0,00 | 24 570 | 154 * | 435 685 | — | — |
| 168 | 9 | 14P1122A | MOUNDOU | NDOL | KERBAYE MOUDAH/GPA SALKOR/GPA MBADANBE/JEAN | 0,00 | 25 550 | 276 | 427 350 | 51328 | 220 |
| 169 | 9 | 08T0038A | MOUNDOU | ANDOUM | GPA MADJIYAM/GPA NDOLELEM/GPA NEKASRA/NDANRI | 0,00 | 24 935 | 172 | 227 637 | 51425/51345 | 440 |
| 170 | 9 | 08T0681A | MOUNDOU | MISE EN PLACE | LAOUMBAIKASSE/SAOUNDAL/MIKODA/KOYABAYE/LEBELA | 0,00 | 25 830 | 240 | 902 830 | 52306 | 220 |
| 171 | 9 | 18P2908A | MOUNDOU | TAPOL | DAMBAYE/ARGAO/BOUADOHI/DOMANE TAPOL DOILI/MOROM | 0,00 | 24 258 | 170 | 217 923 | 52334 | 220 |
| 172 | 9 | 14P1122A | MOUNDOU | MISE EN PLACE | DJASRA NDAB/DOLAODJE/TISSEM JOEL/BENGARII/KAINTAR | 0,00 | 24 466 | 225 | 610 434 | 52319 | 220 |
| 173 | 9 | 08P0050A | MOUNDOU | MISE EN PLACE | LAOUDOLEMAYE/DINGAOOSSANGUE /MOROMBAYE/KOUMBE | 0,00 | 28 119 | 158 | 560 837 | 51431 | 220 |
| 174 | 9 | 18P2908A | MOUNDOU | LAOKOIMASSE | DJEKONDANGUE/MELOM/LAO BENGAKOR /NAMO | 13,06 | — | 241 | 279 642 | 52304 | 220 |
| 175 | 9 | 18P2908A | MOUNDOU | BEKAO FERME | NAMO/MAKASNAN/SOLIDARITE DE MEME CŒUR.DOKAG | 0,00 | 14 157 | 148 * | 259 717 | — | — |
| 176 | 9 | 08P0049A | KOUMRA | MISE EN PLACE | RAKAMAN/DJASRA/KOSMADJI/BEMADJI/NDORMADJI | 0,00 | 20 967 | 100 | 187 250 | 58522 | 220 |
| 177 | 9 | 08P0049A | KOUMRA | MISE EN PLACE | RADOUMADJI.LOWEI/KOTANA/KONAN/MAITAMAN | 0,00 | 23 640 | 106 | 216 791 | 58525 | 220 |
| 178 | 9 | 08P0049A | KOUMRA | MISE EN PLACE | NDIGEBEYE/MAINDIGUE/ALLAHGOMADJI/MAIBOGO | 0,00 | 24 850 | 106 | 232 444 | 58532 | 220 |
| 179 | 9 | 08P0049A | KOUMRA | MISE EN PLACE | BEHOMONII/ASRANE/DJAIGONANI/NARANGAR.DJOTINAN | 0,00 | 31 027 | 160 | 400 361 | 58258 | 220 |
| 180 | 9 | 08P0049A | KOUMRA | MISE EN PLACE | KOLO/NARTEBAYE/BEBO/ACT/MASRANE/DJASRAMADJI | 0,00 | 21 400 | 100 | 202 465 | 58271 | 220 |
| 181 | 10 | 08P0049A | KOUMRA | MISE EN PLACE | GOUAR/BOLBANG/NAHOSSENGAR/GAMI BOUKAR/PALOUM | 0,00 | 20 898 | 100 | 276 622 | 58267 | 220 |
| 182 | 10 | 08P0049A | KOUMRA | MISE EN PLACE | KOUTYO/NGANDILI/NGAMBOH/KANGTE/GUEDESSI | 0,00 | 16 085 | 170 | 124 352 | 58279 | 220 |
| 183 | 10 | 08P0049A | KOUMRA | MISE EN PLACE | DJIMRABEYE AMOS/NGARTOIDE DJIMRANGAR/KOUH | 0,00 | 19 040 | 120 | 211 709 | 58537 | 220 |
| 184 | 10 | 08P0049A | KOUMRA | MISE EN PLACE | KOSGUIMBE/KOKABRI/BEDJONDO/NANHANDOUM | 0,00 | 16 130 | 150 | 83 147 | 58268 | 220 |
| 185 | 10 | 08P0049A | KOUMRA | MISE EN PLACE | SANDANAN/GUIDITI/DOBOII/MANDANG/TOINGAR/KOIMAYE | 0,00 | 20 436 | 150 | 154 361 | 58257/58255 | 440 |
| 186 | 10 | 08P0049A | KOUMRA | MISE EN PLACE | NODJIRENGAR/DJIMASBEYE/YALDE DJIMASGAR/KOKA | 0,00 | 16 963 | 130 | 204 869 | 58541 | 220 |
| 187 | 10 | 08P0049A | KOUMRA | MISE EN PLACE | MAYE/BEIGUI II/ADOUMNGAR/MAIBA/LIBERTE/ALI DOGUIR | 0,00 | 25 363 | 150 | 325 473 | 58545 | 220 |
| 188 | 10 | 08P0444A | DOBA | MISE EN PLACE | BENGALA/NDOLEDJANGA/BENGREU/KARA II/ MAMGAGA | 0,00 | 14 453 | 100 | 102 978 | 79694 | 220 |
| 189 | 10 | 08P0444A | DOBA | MISE EN PLACE | NGARABE/TOMAPYI II/DJIMTONI/DOHOLO/TOGDJIM | 0,00 | 18 050 | 50 | 191 513 | 59003 | 220 |
| 190 | 10 | 08P0444A | DOBA | MISE EN PLACE | NGRYEBE/BAMAN/NGARLAYE/BEDJEME/BETI/BEJOME | 0,00 | 14 159 | 60 | 132 904 | 59009 | 220 |
| 191 | 10 | 08P0444A | DOBA | MISE EN PLACE | DJIMTINE/TOGDJIM/DOHOLO/BERO/NGARABE/DJINGAM | 0,00 | 15 158 | 80 | 128 899 | 79667 | 220 |
| 192 | 10 | 08P0444A | DOBA | MISE EN PLACE | DJIMASDE/YOGOTO/MASRANE | 0,00 | 16 000 | 180 | 263 213 | 79672 | 220 |
| 193 | 10 | 18P2908A | MOUNDOU | NDOL | DAMBE BLAISE/BOUGA II/BEMBAR/GPA SOUMOUZO | 0,00 | 25 650 | 164 | 500 263 | 52435 | 220 |
| 194 | 10 | 14P1122A | MOUNDOU | BAIBOKOUM/BESSAO CENTRE | GPO NGBENE/GPA ZAKAKPAN/GPA LAOVONA | 0,00 | 28 200 | 253 | 849 860 | 52451 | 220 |
| 195 | 10 | 14P1122A | MOUNDOU | BESSAO CENTRE | DJARAKO/BEDARALAL/YALLO/NESSANGUE2 | 0,00 | 10 478 | 147 * | 181 573 | — | — |
| 196 | 10 | 14P1122A | MOUNDOU | GADJIBIAN | BETOLOUM/NGAMADJI GUELBE/LAO KEIN KIBIDJE | 0,00 | 10 491 | 80 * | 130 720 | — | — |
| 197 | 10 | 14P1122A | MOUNDOU | BESSAO CENTRE | DJARAKO/BEKOR II/BE DARA LEL/YALLO/NESSANGUE II | 0,00 | 19 786 | 211 | 488 677 | 52346 | 220 |
| 198 | 10 | 14P1122A | MOUNDOU | GADJIBIAN | DJAREMADJI/NENOUDJI/TOURA I/SOYAH/LAOMAYE ROBERT | 0,00 | 20 514 | 179 | 339 329 | 52421/52348 | 440 |
| 199 | 10 | 18P2908A | MOUNDOU | LARAMANAYE | MANDARI II/MBAIBEDJE MAETIN/KOILANOUDJI/BOUYOU | 0,00 | 20 350 | 103 | 208 820 | 52423 | 220 |
| 200 | 10 | 14P1122A | MOUNDOU | BESSAO CENTRE | BEDARALAL/MAIDOH/SAMAYE/BENGOR/BEKAO/BETAM I | 0,00 | 21 050 | 262 | 551 071 | 52426 | 220 |
| 201 | 11 | 08P0029A | MOUNDOU | NDOL | GPA DJOUILLE/ GPO BIDANE | 0,00 | 22 400 | 145 | 448 036 | — | — |
| 202 | 11 | 18P2908A | MOUNDOU | OUDIMIAN | BEHAMAKA/BEMBAINDI/BETABAR /BETOUBAM | 0,00 | 20 600 | 272 | 504 573 | 52443 | 220 |
| 203 | 11 | 18P2908A | MOUNDOU | OUDIMIAN | KOSSOURA/BETOUBAM/BETAR | 0,00 | 6 450 | 103 * | 109 252 | — | — |
| 204 | 11 | 14P1122A | MOUNDOU | PANZANUE | LOKOUNDJI/KAITIA/OYOGUE I/GPA NEKINGATINANG | 0,00 | 19 098 | 239 | 498 155 | 52488 | 220 |
| 205 | 11 | 14P1122A | MOUNDOU | LOUMBOGO/ LARMANAYE | DOUASSEMNODJI/KOSMAYE/NDOYO JOEL/LAOTOKO II | 0,00 | 21 099 | 182 | 326 253 | 52492 | 220 |
| 206 | 11 | 14P1122A | MOUNDOU | LAOUKOIMASSE | DJIMADEM SA MEDI/DINGAOSSABE NDOLO/DINGAONAISSEM | 0,00 | 28 050 | 231 | 842 862 | — | — |
| 207 | 11 | 08P0041A | MOUNDOU | BESSAO CENTRE | BESSAO/BEKIBI I/KOSHAMNODJI/GAMAIDJRLAOUHORMAYE | 0,00 | 22 617 | 242 | 532 830 | 52497 | 220 |
| 208 | 11 | 08P0444A | DOBA | MISE EN PLACE | MAIBO GABRI/KOURATI/DJAMAYE/MOULAMADJIBE | 0,00 | 16 812 | 160 | 253 374 | 79685 | 220 |
| 209 | 11 | 08P0444A | DOBA | MISE EN PLACE | BEDE/MEKASNAN/NDEULMADJI/BEDJAL | 0,00 | 20 800 | 100 | 185 090 | 79694 | 220 |
| 210 | 11 | 08P0444A | DOBA | MISE EN PLACE | BENDOL/BAOUMADJI/ROTANGA/DAMADJI/RAMADJI | 0,00 | 14 783 | 160 | 56 848 | 59028 | 220 |

### 5.3 Points particuliers

- **26 opérations sans BSM** — colonne BSM `—` : n° 29, 34, 48, 49, 55, 57, 59, 61, 62, 63, 97, 101,
  103, 134, 136, 157, 159, 164, 167, 175, 195, 196, 201, 203, 206 ; et `— (SSC)` : n° 41. Passer
  l'étape 4.3 ; pour la n° 41, noter « SSC » dans les observations de la mission.
- **11 opérations à plusieurs numéros de BSM** : n° 14, 71, 85, 90, 110, 118, 135, 160, 169, 185, 198.
  Créer un BSM par numéro (les n° 71 et 160 en comptent trois) : **197 BSM au total**.
- **11 distances à reprendre de la suggestion `*`** : n° 41, 134, 136, 157, 159, 164, 167, 175, 195,
  196, 203. Ces valeurs sont nécessaires pour valider le bordereau.
- **Camion `08T068`** (n° 75) : immatriculation reprise telle quelle du rapport, à créer en plus de
  `08T0681A`.

### 5.4 Consommation de gasoil par camion

La consommation d'une mission est la somme des bons de sortie magasin de son opération : la colonne
« Gasoil (L) » du tableau 5.2 indique ce total par mission (**220 L par BSM**, section 4.3 ; `—` pour
les 26 opérations sans BSM, voir 5.3). Récapitulatif par camion :

| Camion | Missions | Missions avec gasoil | BSM créés | Gasoil total (L) |
|---|---:|---:|---:|---:|
| 08P0444A | 23 | 19 | 20 | 4 400 |
| 18P2908A | 20 | 17 | 21 | 4 620 |
| 08P0049A | 24 | 24 | 25 | 5 500 |
| 18P0740A | 4 | 4 | 5 | 1 100 |
| 12P0116A | 12 | 12 | 13 | 2 860 |
| 18P2572A | 11 | 10 | 11 | 2 420 |
| 14P1122A | 27 | 21 | 23 | 5 060 |
| 08P0588A | 6 | 6 | 6 | 1 320 |
| 14T0021A | 7 | 7 | 7 | 1 540 |
| 08P0050A | 15 | 11 | 11 | 2 420 |
| 08T0038A | 16 | 15 | 16 | 3 520 |
| 08T0072A | 6 | 4 | 5 | 1 100 |
| 08T0681A | 12 | 11 | 11 | 2 420 |
| 08T0321A | 8 | 7 | 7 | 1 540 |
| 08T0680A | 10 | 8 | 8 | 1 760 |
| 18T2572A | 1 | 1 | 1 | 220 |
| 09T0015A | 5 | 5 | 5 | 1 100 |
| 08T068 | 1 | 1 | 1 | 220 |
| 08P0029A | 1 | 0 | 0 | 0 |
| 08P0041A | 1 | 1 | 1 | 220 |
| **Total** | **210** | **184** | **197** | **43 340** |

Contrôle de fin de campagne : le Tableau de bord et le Rapport Annuel doivent totaliser 43 340 L
de gasoil (197 BSM × 220 L). Les 26 opérations sans BSM n'ont pas de déduction gasoil sur leur
facture (dont la n° 41, « SSC »).

## 6. Contrôles finaux

### 6.1 Après chaque lot

- Vérifier le nombre d'opérations saisies par rapport à la colonne « Nb op. » de la section 5.1.
- **Paramètres → Sauvegarde → « Sauvegarder maintenant »**.

### 6.2 Bilan de fin de campagne

À comparer avec **Rapports → Rapport Annuel** (et le Tableau de bord) :

| Contrôle | Valeur attendue |
|---|---|
| Missions créées | 210 |
| Pesées enregistrées | 420 (2 par mission) |
| BSM gasoil créés | 197 (26 opérations sans BSM) |
| Gasoil consommé | 43 340 L (197 BSM × 220 L — détail par camion en section 5.4) |
| Bordereaux validés | 210 |
| Factures validées | 210 |
| Coton transporté | 2 587,62 t |
| Intrants transportés | 964 804,8 kg (≈ 964,80 t) |
| Distance facturée | 36 297 km si les 11 distances suggérées `*` sont saisies (rapport : 34 771 km + 1 526 km) |
| Montant total | recalculé par l'application : ≈ 90,6 M F (barème 5 tranches) ou ≈ 70,5 M F (tranche unique à 113 F/TKM) — rapport historique : 70 513 434 F |

Checklist finale :
- [ ] 210 missions créées, toutes au statut « Facturé » (ou « Payé » pour les opérations déjà réglées).
- [ ] 210 bordereaux validés.
- [ ] 210 factures validées.
- [ ] Tonnages, distance, BSM, gasoil et nombre de factures conformes aux tableaux ci-dessus.
- [ ] Dernière sauvegarde effectuée (Paramètres → Sauvegarde).

En cas d'écart, vérifier en priorité les pesées chargées (poids de la marchandise) et les poids des
lignes de bordereau des opérations du lot concerné.
