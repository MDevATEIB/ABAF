//! Génère une base SQLite de démonstration à partir du rapport annuel réel
//! « RAPPORT ANNUEL ACTIVITE COTON GRAINE AVEC BSM 2024 2025.xlsx ».
//!
//! Usage (depuis la racine du projet) :
//!   cargo run --manifest-path src-tauri/Cargo.toml --example generer_base_demo
//!
//! Le fichier « abaf-campagne-2024-2025.db » est créé dans le répertoire
//! courant. Il peut ensuite être restauré depuis le système (Paramètres →
//! Restauration).
//!
//! Les données sont transcrites fidèlement du fichier Excel (aucune
//! normalisation) :
//!   - Poids Coton  -> pesées vide/chargée de la mission (charge − vide) ;
//!   - Poids INT    -> lignes AV du bordereau ;
//!   - Distance     -> distance facturée (1ʳᵉ valeur si tronçons « 203/183 ») ;
//!   - Distance réf.-> 2ᵉ colonne du fichier, reportée dans le référentiel
//!                     CGI ↔ usine quand elle est plausible ;
//!   - Montant      -> montant réel du rapport, inséré tel quel dans la ligne
//!                     de facture (les tarifs de campagne restent indicatifs) ;
//!   - OBSER « SSC »-> observations du bordereau ; BMS multiples (« a/b/c »)
//!                     -> plusieurs BSM rattachés à la mission.

use chrono::NaiveDate;
use rusqlite::{params, Connection};
use std::collections::{HashMap, HashSet};

/// Une ligne du rapport annuel (une opération).
struct Ligne {
    fac: &'static str,
    usine: &'static str,
    cgi: &'static str,
    av: &'static str,
    coton: f64,     // Poids Coton (tonnes)
    ints: f64,      // Poids INT (tonnes)
    dist: f64,      // distance facturée (km)
    dist_ref: f64,  // distance de référence CGI ↔ usine (0 = inconnue)
    montant: f64,   // montant transport (FCFA)
    obser: &'static str,
    bms: &'static str, // numéros BSM séparés par '/'
}

#[rustfmt::skip]
const LIGNES: &[Ligne] = &[
    Ligne { fac: "18P2908A", usine: "MDOU", cgi: "BITOYE", av: "SAKARA", coton: 18.82, ints: 0.0, dist: 229.0, dist_ref: 276.0, montant: 658395.0, obser: "", bms: "51904" },
    Ligne { fac: "18P2908A", usine: "MDOU", cgi: "BITOYE", av: "NGOD", coton: 22.1, ints: 0.0, dist: 230.0, dist_ref: 276.0, montant: 816132.0, obser: "", bms: "71519" },
    Ligne { fac: "14P1122A", usine: "MDOU", cgi: "BAKÉ", av: "BENODJO KOURADJIM", coton: 18.2, ints: 0.0, dist: 183.0, dist_ref: 229.0, montant: 496242.0, obser: "", bms: "71502" },
    Ligne { fac: "14P1122A", usine: "MDOU", cgi: "BAKÉ", av: "BENODJO KOURADJIM", coton: 19.28, ints: 0.0, dist: 203.0, dist_ref: 229.0, montant: 579319.0, obser: "", bms: "71540" },
    Ligne { fac: "08P0049A", usine: "MDOU", cgi: "MANDAKAO", av: "LAOUMOUDOU", coton: 14.44, ints: 0.0, dist: 110.0, dist_ref: 132.0, montant: 166760.0, obser: "", bms: "51930" },
    Ligne { fac: "08P0050A", usine: "MDOU", cgi: "KOKO", av: "GPA POULARA", coton: 21.88, ints: 0.0, dist: 181.0, dist_ref: 190.0, montant: 649447.0, obser: "", bms: "51921" },
    Ligne { fac: "18P1306A", usine: "MDOU", cgi: "BAKE", av: "BEKOUROU GP", coton: 14.82, ints: 0.0, dist: 190.0, dist_ref: 228.0, montant: 392023.0, obser: "", bms: "71520" },
    Ligne { fac: "08T0072A", usine: "MDOU", cgi: "OUDIMIAN", av: "BETOKO DOUMOU", coton: 14.16, ints: 0.0, dist: 203.0, dist_ref: 252.0, montant: 400159.0, obser: "", bms: "71508" },
    Ligne { fac: "14T0021A", usine: "MDOU", cgi: "BEMAL GPA", av: "DJANANDJO", coton: 11.78, ints: 0.0, dist: 158.0, dist_ref: 189.0, montant: 228493.0, obser: "", bms: "71538" },
    Ligne { fac: "08P0050A", usine: "KMRA", cgi: "ROH GUELDAMI", av: "NODJIRESSENGAR PATRICE", coton: 14.0, ints: 0.0, dist: 134.0, dist_ref: 228.0, montant: 200304.0, obser: "", bms: "53521" },
    Ligne { fac: "08P0050A", usine: "KMRA", cgi: "ROH GUELDAMI", av: "ROTI GUELDAMI", coton: 17.3, ints: 0.0, dist: 134.0, dist_ref: 225.0, montant: 292913.0, obser: "", bms: "53532" },
    Ligne { fac: "08P0050A", usine: "KMRA", cgi: "ROTI GUELDAMI", av: "ROTI GUELDAMI", coton: 13.48, ints: 0.0, dist: 185.0, dist_ref: 222.0, montant: 326606.0, obser: "", bms: "55702" },
    Ligne { fac: "08T0038A", usine: "KMRA", cgi: "YOMI", av: "KOSMADJI /LAFI/RAKINAN/NDORMADJIKOD", coton: 14.6, ints: 0.0, dist: 51.0, dist_ref: 118.0, montant: 51673.0, obser: "", bms: "3534" },
    Ligne { fac: "08T0038A", usine: "KMRA", cgi: "BEBOPEN", av: "BEAGOTO/MATTEDJOUE", coton: 15.94, ints: 0.0, dist: 93.0, dist_ref: 120.0, montant: 206414.0, obser: "", bms: "55706" },
    Ligne { fac: "08P0588A", usine: "MDOU", cgi: "BIDANGA", av: "SALMBAYE/GPA MANDERA", coton: 22.4, ints: 0.0, dist: 178.0, dist_ref: 214.0, montant: 650316.0, obser: "", bms: "71567" },
    Ligne { fac: "08T0321A", usine: "MDOU", cgi: "ANDOUM", av: "MEKAB/BANGYOM", coton: 13.42, ints: 0.0, dist: 95.0, dist_ref: 114.0, montant: 162743.0, obser: "", bms: "71569" },
    Ligne { fac: "14P1122A", usine: "MDOU", cgi: "KOKO", av: "GPA TAKEULA", coton: 12.46, ints: 0.0, dist: 165.0, dist_ref: 212.0, montant: 241285.0, obser: "", bms: "76352" },
    Ligne { fac: "14T0021A", usine: "MDOU", cgi: "BEKAO FERME", av: "BEMAL GPA", coton: 13.86, ints: 0.0, dist: 158.0, dist_ref: 189.0, montant: 295536.0, obser: "", bms: "71741" },
    Ligne { fac: "08P1306A", usine: "MDOU", cgi: "BAKE", av: "BEMADJI JEKOME KOSNAYAL MENODJI", coton: 17.0, ints: 0.0, dist: 172.0, dist_ref: 228.0, montant: 466516.0, obser: "", bms: "76351" },
    Ligne { fac: "18P2572A", usine: "MDOU", cgi: "BAIBOKOUM", av: "MBAIDOGLO", coton: 16.18, ints: 0.0, dist: 200.0, dist_ref: 240.0, montant: 457006.0, obser: "", bms: "76353" },
    Ligne { fac: "14P1122A", usine: "MDOU", cgi: "BAKE", av: "DOH SANDANA/DJIMRANGAR", coton: 16.42, ints: 0.0, dist: 183.0, dist_ref: 229.0, montant: 429791.0, obser: "", bms: "71714" },
    Ligne { fac: "18P1306A", usine: "MDOU", cgi: "BAKE", av: "NODJIHITE TOMASDE", coton: 15.9, ints: 0.0, dist: 190.0, dist_ref: 228.0, montant: 433884.0, obser: "", bms: "71581" },
    Ligne { fac: "18P2572A", usine: "MDOU", cgi: "MBAIBOKOUM", av: "DINGOMBAYE TOUASSIRI MELOM", coton: 16.82, ints: 0.0, dist: 200.0, dist_ref: 240.0, montant: 476957.0, obser: "", bms: "71579" },
    Ligne { fac: "18P2908A", usine: "MDOU", cgi: "BITOYE", av: "MBAIDOGLO", coton: 21.94, ints: 0.0, dist: 200.0, dist_ref: 276.0, montant: 684058.0, obser: "", bms: "71708" },
    Ligne { fac: "08P0050A", usine: "KMRA", cgi: "KOUTOUTOU", av: "BATARITI", coton: 15.6, ints: 0.0, dist: 137.0, dist_ref: 200.0, montant: 275989.0, obser: "", bms: "5571" },
    Ligne { fac: "08P0050A", usine: "KMRA", cgi: "MOUSTANGAR PIERRE", av: "BALSIEN/MOUSTABRA", coton: 14.08, ints: 0.0, dist: 165.0, dist_ref: 0.0, montant: 255763.0, obser: "", bms: "55729" },
    Ligne { fac: "08P0050A", usine: "KMRA", cgi: "KOUTOUTOU", av: "KOUTOUTOU", coton: 16.18, ints: 0.0, dist: 135.0, dist_ref: 135.0, montant: 337597.0, obser: "", bms: "55748" },
    Ligne { fac: "08P0444A", usine: "KMRA", cgi: "BITARARIATI", av: "DJIMNINGAR BARDE", coton: 17.6, ints: 0.0, dist: 250.0, dist_ref: 250.0, montant: 344146.0, obser: "", bms: "53525" },
    Ligne { fac: "08T0038A", usine: "KMRA", cgi: "BODO", av: "TOMTE REMY FRANCOIS ISIDORE", coton: 12.44, ints: 0.0, dist: 119.0, dist_ref: 200.0, montant: 211284.0, obser: "", bms: "51913" },
    Ligne { fac: "08P0444A", usine: "KMRA", cgi: "BITARARIATI", av: "EMILE RAPHAEL ELYSEE", coton: 18.88, ints: 0.0, dist: 179.0, dist_ref: 250.0, montant: 500707.0, obser: "", bms: "53548" },
    Ligne { fac: "08P0444A", usine: "KMRA", cgi: "BITARARIATI", av: "BITARARIATI/MASDONGAR/NAMO", coton: 13.86, ints: 0.0, dist: 206.0, dist_ref: 50.0, montant: 542453.0, obser: "", bms: "54205" },
    Ligne { fac: "08P0050A", usine: "KMRA", cgi: "NGARLEM SAMUEL", av: "NGARLEM SAMUEL DOBA DJANGA", coton: 10.7, ints: 0.0, dist: 148.0, dist_ref: 200.0, montant: 163054.0, obser: "", bms: "51912" },
    Ligne { fac: "08P0444A", usine: "KMRA", cgi: "GAMA", av: "ADENGAR/BLAISE/EMILE/MADAMA", coton: 10.3, ints: 0.0, dist: 145.0, dist_ref: 250.0, montant: 104674.0, obser: "", bms: "55723" },
    Ligne { fac: "14T0021A", usine: "MDOU", cgi: "BEKAO FERME", av: "GPA OUNDARO/NOUDJIGOTO", coton: 14.88, ints: 0.0, dist: 162.0, dist_ref: 197.0, montant: 337116.0, obser: "", bms: "76347" },
    Ligne { fac: "14T0021A", usine: "MDOU", cgi: "BEKAO FERME", av: "AREMADJIIBEYE/DJAREMAYE", coton: 15.48, ints: 0.0, dist: 158.0, dist_ref: 189.0, montant: 342390.0, obser: "", bms: "76363" },
    Ligne { fac: "18P2908A", usine: "MDOU", cgi: "BITOYE", av: "MINI/LOUSSAYE", coton: 21.52, ints: 0.0, dist: 233.0, dist_ref: 279.0, montant: 799689.0, obser: "", bms: "76420" },
    Ligne { fac: "08P0588A", usine: "MDOU", cgi: "BIDANGA", av: "TOKO/GPA MENDERA/LEKEPOU", coton: 18.56, ints: 0.0, dist: 178.0, dist_ref: 217.0, montant: 506373.0, obser: "", bms: "76357" },
    Ligne { fac: "08T0321A", usine: "MDOU", cgi: "ANDOUM", av: "MEKAB", coton: 14.12, ints: 0.0, dist: 95.0, dist_ref: 114.0, montant: 182446.0, obser: "", bms: "76358" },
    Ligne { fac: "18P1306A", usine: "MDOU", cgi: "KOKO", av: "LAOUMEKON/GPA MENDJIMO/MIANMARYO", coton: 12.44, ints: 0.0, dist: 163.0, dist_ref: 198.0, montant: 261273.0, obser: "", bms: "76398" },
    Ligne { fac: "18P2572A", usine: "MDOU", cgi: "BAIBOKOUM", av: "MBAIDOGLO/NZEUGU", coton: 15.64, ints: 0.0, dist: 190.0, dist_ref: 0.0, montant: 236804.0, obser: "", bms: "76409" },
    Ligne { fac: "141122A", usine: "MDOU", cgi: "PANZINGUE", av: "GPA MANOUDJI", coton: 17.74, ints: 0.0, dist: 170.0, dist_ref: 204.0, montant: 452023.0, obser: "", bms: "76331" },
    Ligne { fac: "08P0049A", usine: "MDOU", cgi: "MANDAKAO", av: "DAOUTABE/NADJILIM/GPA MELOM/MBOH", coton: 19.64, ints: 0.0, dist: 88.0, dist_ref: 106.0, montant: 249183.0, obser: "", bms: "76330" },
    Ligne { fac: "08T0072A", usine: "MDOU", cgi: "OUDIMIAN", av: "DOUMOU", coton: 14.58, ints: 0.0, dist: 203.0, dist_ref: 0.0, montant: 603787.0, obser: "SSC", bms: "" },
    Ligne { fac: "08T050A", usine: "KMRA", cgi: "NDOUBEUMLEMA¨/DJIMRAKINGAR/DJIMODE", av: "NDOUBEUMLEMA¨/DJIMRAKINGAR/DJIMODE", coton: 17.92, ints: 0.0, dist: 249.0, dist_ref: 330.0, montant: 660610.0, obser: "", bms: "77051/5505/5526" },
    Ligne { fac: "08T050A", usine: "KMRA", cgi: "BENGAR DILLAH/BENGAR NEMEKAR", av: "BENGAR DILLAH/BENGAR NEMEKAR", coton: 15.75, ints: 0.0, dist: 253.0, dist_ref: 250.0, montant: 612889.0, obser: "", bms: "55534" },
    Ligne { fac: "08T0050A", usine: "KMRA", cgi: "BENGAR", av: "GONLAOMAYE /DOGORO/NEMEKAR", coton: 14.08, ints: 0.0, dist: 214.0, dist_ref: 340.0, montant: 342676.0, obser: "", bms: "" },
    Ligne { fac: "08P0050A", usine: "KMRA", cgi: "BENGAR", av: "SAOU", coton: 16.24, ints: 0.0, dist: 259.0, dist_ref: 300.0, montant: 618057.0, obser: "", bms: "72857" },
    Ligne { fac: "08P0050A", usine: "KMRA", cgi: "BENGAR", av: "SAOU", coton: 15.82, ints: 0.0, dist: 259.0, dist_ref: 300.0, montant: 595866.0, obser: "", bms: "72898" },
    Ligne { fac: "08P0444A", usine: "KMRA", cgi: "KAKONDO", av: "HADJE HAWA BENODJO", coton: 12.26, ints: 0.0, dist: 146.0, dist_ref: 218.0, montant: 190752.0, obser: "", bms: "55744" },
    Ligne { fac: "08P0444A", usine: "KMRA", cgi: "KAKONDO", av: "KAKONDO/KAKONDO", coton: 14.94, ints: 0.0, dist: 158.0, dist_ref: 218.0, montant: 135516.0, obser: "", bms: "55518" },
    Ligne { fac: "08P0444A", usine: "KMRA", cgi: "KAKONDO", av: "KAKONDO/KAKONDO", coton: 16.82, ints: 0.0, dist: 182.0, dist_ref: 218.0, montant: 223434.0, obser: "", bms: "76001" },
    Ligne { fac: "08P0444A", usine: "KMRA", cgi: "KAKONDO", av: "KAKONDO II/KAKONDO", coton: 17.52, ints: 0.0, dist: 158.0, dist_ref: 180.0, montant: 263843.0, obser: "", bms: "76035" },
    Ligne { fac: "08P0444A", usine: "KMRA", cgi: "KABA", av: "KADONDO", coton: 16.16, ints: 0.0, dist: 122.0, dist_ref: 180.0, montant: 376869.0, obser: "", bms: "72867" },
    Ligne { fac: "08T0038A", usine: "KMRA", cgi: "BEMADJA", av: "BEMADJAII /DJASRA./BEKONO", coton: 11.06, ints: 0.0, dist: 166.0, dist_ref: 207.0, montant: 212265.0, obser: "", bms: "55521" },
    Ligne { fac: "06P0113A", usine: "KMRA", cgi: "OUDIMIAN", av: "BETIMONG/DJEBOGOTO/BENDAIDOURA", coton: 12.76, ints: 0.0, dist: 297.0, dist_ref: 300.0, montant: 489731.0, obser: "", bms: "72861" },
    Ligne { fac: "06P0113A", usine: "KMRA", cgi: "OUDIMIAN", av: "BEDORO I/OUDOUMIAN/GPA DJANAKO", coton: 19.84, ints: 0.0, dist: 263.0, dist_ref: 300.0, montant: 832599.0, obser: "", bms: "72861" },
    Ligne { fac: "18P2908A", usine: "MDOU", cgi: "LAOKOIMASSE", av: "BELAOKEL/KOUROULEYO/LAOKEIN", coton: 10.82, ints: 0.0, dist: 174.0, dist_ref: 209.0, montant: 212803.0, obser: "SSC", bms: "" },
    Ligne { fac: "08P0588A", usine: "MDOU", cgi: "BIDANGA", av: "GPA BOGOULARA/GPA MBOUBENE/GPA NDOUKOUBAR", coton: 18.68, ints: 0.0, dist: 181.0, dist_ref: 220.0, montant: 517918.0, obser: "", bms: "4042" },
    Ligne { fac: "14P1122A", usine: "MDOU", cgi: "PANZINGUE", av: "BETABAR II/GPA NDOMADJI/BEBAMAABEE", coton: 16.1, ints: 0.0, dist: 153.0, dist_ref: 224.0, montant: 349462.0, obser: "", bms: "64220" },
    Ligne { fac: "08P0049A", usine: "MDOU", cgi: "MANDAKAO", av: "DJENE/GPA LOSSANGKOULA/GPA DEULEMGOTO", coton: 18.14, ints: 0.0, dist: 95.0, dist_ref: 114.0, montant: 251806.0, obser: "SSC", bms: "" },
    Ligne { fac: "08T0321A", usine: "MDOU", cgi: "ANDOUM", av: "MANHOUMAN/DJEKOUA GARANTIE", coton: 16.98, ints: 0.0, dist: 86.0, dist_ref: 103.0, montant: 151415.0, obser: "", bms: "64208" },
    Ligne { fac: "08T0321A", usine: "MDOU", cgi: "ANDOUM", av: "MANHOUMAN", coton: 15.42, ints: 0.0, dist: 86.0, dist_ref: 103.0, montant: 129933.0, obser: "", bms: "64804" },
    Ligne { fac: "18T2572", usine: "MDOU", cgi: "NDOL", av: "LAOUSSAYE /DINGAMBAYE LEON", coton: 15.58, ints: 0.0, dist: 115.0, dist_ref: 138.0, montant: 251251.0, obser: "", bms: "64225" },
    Ligne { fac: "18T2572", usine: "MDOU", cgi: "NDOL", av: "LAOUSSAYE /MBOUROUM/DINGAMBAYE LEON", coton: 14.52, ints: 0.0, dist: 115.0, dist_ref: 138.0, montant: 225821.0, obser: "SSC", bms: "" },
    Ligne { fac: "18P1306A", usine: "MDOU", cgi: "KOKO", av: "BIGOTO ALAIN/GPA LETIMONBI/GPA MENDJIMO", coton: 16.08, ints: 0.0, dist: 165.0, dist_ref: 198.0, montant: 387655.0, obser: "", bms: "64059" },
    Ligne { fac: "18P1306A", usine: "MDOU", cgi: "KOKO", av: "BIGOTO ALAIN/GPA LETIMONBI/GPA MENDJIMO", coton: 0.0, ints: 15.717, dist: 165.0, dist_ref: 0.0, montant: 271546.0, obser: "SSC", bms: "" },
    Ligne { fac: "14T0021A", usine: "MDOU", cgi: "BEKAO FERME", av: "MBAIHAMAYE JOUSE/NESSAINGUE/DINGAONAISSEM", coton: 9.7, ints: 0.0, dist: 152.0, dist_ref: 186.0, montant: 157363.0, obser: "", bms: "57514" },
    Ligne { fac: "14T0021A", usine: "MDOU", cgi: "BEKAO FERME", av: "MBAIHAMAYE JOUSE/NESSAINGUE/DINGAONAISSEM", coton: 0.0, ints: 18.759, dist: 155.0, dist_ref: 0.0, montant: 308108.0, obser: "SSC", bms: "" },
    Ligne { fac: "18P2572A", usine: "MDOU", cgi: "NDOL", av: "LOUSSAYE MBOUROUM/BEKOUTOU ABEL", coton: 15.42, ints: 0.0, dist: 112.0, dist_ref: 138.0, montant: 247155.0, obser: "", bms: "57748" },
    Ligne { fac: "18P2572A", usine: "MDOU", cgi: "NDOL", av: "LOUSSAYE MBOUROUM/BEKOUTOU ABEL", coton: 0.0, ints: 23.79, dist: 112.0, dist_ref: 0.0, montant: 273460.0, obser: "SSC", bms: "" },
    Ligne { fac: "08T0321A", usine: "MDOU", cgi: "ANDOUM", av: "GPA DJANANKOH/GPA MEKASNAN/BEMBIBO", coton: 14.58, ints: 0.0, dist: 85.0, dist_ref: 102.0, montant: 118367.0, obser: "", bms: "57706" },
    Ligne { fac: "08T0321A", usine: "MDOU", cgi: "ANDOUM", av: "GPA DJANANKOH/GPA MEKASNAN/BEMBIBO", coton: 0.0, ints: 20.94, dist: 75.0, dist_ref: 0.0, montant: 153503.0, obser: "SSC", bms: "" },
    Ligne { fac: "08P0049A", usine: "MDOU", cgi: "LOUMBOGO/TAPOL", av: "MANKINI II/NEHOOGUEMEL THOMAS", coton: 12.12, ints: 0.0, dist: 79.0, dist_ref: 171.0, montant: 168402.0, obser: "", bms: "57687" },
    Ligne { fac: "08P0049A", usine: "MDOU", cgi: "TAPOL LOUMBOGO", av: "MANKINI II/NEHOOGUEMEL THOMAS", coton: 0.0, ints: 22.269, dist: 60.0, dist_ref: 0.0, montant: 149355.0, obser: "SSC", bms: "" },
    Ligne { fac: "14T0021A", usine: "MDOU", cgi: "BEKAO FERME", av: "DODANG", coton: 13.28, ints: 0.0, dist: 164.0, dist_ref: 197.0, montant: 286696.0, obser: "", bms: "64098" },
    Ligne { fac: "14T0021A", usine: "MDOU", cgi: "BEKAO FERME", av: "DODANG", coton: 0.0, ints: 22.737, dist: 152.0, dist_ref: 0.0, montant: 368936.0, obser: "SSC", bms: "" },
    Ligne { fac: "08T0038A", usine: "MDOU", cgi: "BESSAO CENTRE", av: "BESSAO CENTRE", coton: 16.92, ints: 0.0, dist: 145.0, dist_ref: 174.0, montant: 361294.0, obser: "", bms: "64245" },
    Ligne { fac: "14P1122A", usine: "MDOU", cgi: "BESSAO CENTRE", av: "DJEKAGUE JOSEPH/MEGALANG", coton: 16.96, ints: 0.0, dist: 158.0, dist_ref: 189.0, montant: 420702.0, obser: "", bms: "57740" },
    Ligne { fac: "18P2908A", usine: "MDOU", cgi: "LAOKOIMASSE", av: "LARBOUSOU/BAGUISSA", coton: 19.6, ints: 0.0, dist: 168.0, dist_ref: 203.0, montant: 510833.0, obser: "", bms: "64241" },
    Ligne { fac: "08P0588A", usine: "MDOU", cgi: "BIDANGA", av: "LANZAHANG/BIDANGA/GPA MBIKONE", coton: 21.24, ints: 0.0, dist: 181.0, dist_ref: 220.0, montant: 613358.0, obser: "", bms: "64226" },
    Ligne { fac: "14P1122A", usine: "MDOU", cgi: "PANZINGUE", av: "MALAIDAH/KOIEURGORO/KISSIMADJI", coton: 17.32, ints: 0.0, dist: 153.0, dist_ref: 204.0, montant: 385491.0, obser: "", bms: "57529" },
    Ligne { fac: "08P0049A", usine: "MDOU", cgi: "MANDAKAO", av: "GPA DJAKISSIMAYE/MBOH/DJEKOUNYOM/GPA NEMAILEM/GPA NESSANG/GPA MEKASNA", coton: 12.08, ints: 0.0, dist: 81.0, dist_ref: 154.0, montant: 67577.0, obser: "", bms: "57506/57509" },
    Ligne { fac: "08P0049A", usine: "MDOU", cgi: "LOUMBOGO/TAPOL", av: "MANKINI/DAKINGADJE/KOULAKAMBAYE", coton: 15.66, ints: 0.0, dist: 85.0, dist_ref: 177.0, montant: 214196.0, obser: "", bms: "57730" },
    Ligne { fac: "14T0021A", usine: "MDOU", cgi: "NDOL", av: "BOUGA", coton: 13.56, ints: 0.0, dist: 112.0, dist_ref: 134.0, montant: 202619.0, obser: "", bms: "57654" },
    Ligne { fac: "18P2572A", usine: "MDOU", cgi: "NDOL", av: "LAOUSSAYE", coton: 16.92, ints: 0.0, dist: 112.0, dist_ref: 138.0, montant: 281770.0, obser: "", bms: "57538" },
    Ligne { fac: "08P0050A", usine: "KMRA", cgi: "KAKONDO", av: "KAKONDO/BOUROU DAOUA", coton: 17.02, ints: 0.0, dist: 158.0, dist_ref: 180.0, montant: 355990.0, obser: "", bms: "72899" },
    Ligne { fac: "08P0444A", usine: "KMRA", cgi: "SAOU", av: "SAOU", coton: 11.28, ints: 0.0, dist: 259.0, dist_ref: 300.0, montant: 208212.0, obser: "", bms: "72963" },
    Ligne { fac: "08T0038A", usine: "MDOU", cgi: "BESSAO CENTRE", av: "BESSSAO", coton: 15.32, ints: 0.0, dist: 245.0, dist_ref: 274.0, montant: 546494.0, obser: "", bms: "57692/57731" },
    Ligne { fac: "08T0038A", usine: "MDOU", cgi: "BESSAO CENTRE", av: "BESSAO CENTRE", coton: 18.16, ints: 0.0, dist: 145.0, dist_ref: 300.0, montant: 297173.0, obser: "", bms: "76040" },
    Ligne { fac: "08T0038A", usine: "MDOU", cgi: "BENDOMBI/ANDOUM", av: "GPA KAS NDOH MAYE", coton: 13.46, ints: 0.0, dist: 85.0, dist_ref: 102.0, montant: 103744.0, obser: "", bms: "62690" },
    Ligne { fac: "08T0038A", usine: "MDOU", cgi: "BOUGA NDOL", av: "GPA PETIT À PETIT", coton: 14.2, ints: 0.0, dist: 112.0, dist_ref: 134.0, montant: 217242.0, obser: "", bms: "62614" },
    Ligne { fac: "18P1306A", usine: "MDOU", cgi: "KOKO", av: "DIBA I", coton: 10.9, ints: 0.0, dist: 280.0, dist_ref: 316.0, montant: 369808.0, obser: "", bms: "57504/57691" },
    Ligne { fac: "18P1306A", usine: "MDOU", cgi: "KOKO", av: "DIBA I", coton: 0.0, ints: 15.054, dist: 180.0, dist_ref: 0.0, montant: 268829.0, obser: "SSC", bms: "" },
    Ligne { fac: "18P1306A", usine: "MDOU", cgi: "NDOL", av: "GPA NGARAMKOL", coton: 13.0, ints: 0.0, dist: 112.0, dist_ref: 135.0, montant: 189024.0, obser: "", bms: "62663" },
    Ligne { fac: "18P1306A", usine: "MDOU", cgi: "NDOL", av: "DINGAO SANGBE JOSEPH/BEMBAR", coton: 16.28, ints: 0.0, dist: 113.0, dist_ref: 152.0, montant: 253687.0, obser: "", bms: "62633" },
    Ligne { fac: "08T0321A", usine: "MDOU", cgi: "BEMBIBO", av: "NDOLELEM", coton: 14.2, ints: 0.0, dist: 85.0, dist_ref: 104.0, montant: 112334.0, obser: "", bms: "62658" },
    Ligne { fac: "08P0444A", usine: "MDOU", cgi: "NDOL", av: "DOUNDOUBA", coton: 14.76, ints: 0.0, dist: 137.0, dist_ref: 260.0, montant: 204512.0, obser: "", bms: "72995" },
    Ligne { fac: "08P0588A", usine: "MDOU", cgi: "TAPOL", av: "ALYO MALON/MBAGUEMAYE", coton: 22.64, ints: 0.0, dist: 81.0, dist_ref: 157.0, montant: 186153.0, obser: "", bms: "62676" },
    Ligne { fac: "08P0588A", usine: "MDOU", cgi: "PANZINGUE", av: "MEGALANG", coton: 21.42, ints: 0.0, dist: 172.0, dist_ref: 206.0, montant: 586785.0, obser: "", bms: "57671" },
    Ligne { fac: "14P1122A", usine: "MDOU", cgi: "NDOL", av: "KERBAYE MANDAH/KOUDJOB", coton: 15.4, ints: 0.0, dist: 120.0, dist_ref: 0.0, montant: 376992.0, obser: "SSC", bms: "" },
    Ligne { fac: "14P1122A", usine: "MDOU", cgi: "NDOL", av: "KERBAYE MANDAH/GPA AKILAS", coton: 17.1, ints: 0.0, dist: 120.0, dist_ref: 144.0, montant: 303408.0, obser: "", bms: "62693" },
    Ligne { fac: "18P2908A", usine: "MDOU", cgi: "KEUNI", av: "GPA GUELTAREL/DOBOUYODJE/SYLVAIN/KEUNI II/MOYE LAZARD", coton: 7.76, ints: 0.0, dist: 190.0, dist_ref: 142.0, montant: 37593.0, obser: "", bms: "62611" },
    Ligne { fac: "18P2908A", usine: "MDOU", cgi: "LOIKOIMASSE", av: "BENGONYON/GPA BENDEM/BESSAO CB", coton: 19.78, ints: 0.0, dist: 150.0, dist_ref: 306.0, montant: 758725.0, obser: "", bms: "57729/57693" },
    Ligne { fac: "18P2572A", usine: "MDOU", cgi: "NDOL", av: "LOUSSAYE MBOUROUM/DAMBE/BEKOUTOU", coton: 16.06, ints: 0.0, dist: 115.0, dist_ref: 138.0, montant: 261924.0, obser: "", bms: "62603" },
    Ligne { fac: "18P2572A", usine: "MDOU", cgi: "NDOL", av: "MBAIREDA/DOUMDOUBA/GPA SAMO", coton: 15.12, ints: 0.0, dist: 112.0, dist_ref: 138.0, montant: 252708.0, obser: "", bms: "62669" },
    Ligne { fac: "08P0049A", usine: "MDOU", cgi: "NDOL", av: "MANKENI II", coton: 18.92, ints: 0.0, dist: 143.0, dist_ref: 171.0, montant: 415134.0, obser: "", bms: "62645" },
    Ligne { fac: "08P0049A", usine: "MDOU", cgi: "LOUMBOGO/TAPOL", av: "KAIKOUNDA II/LOYONDJA/LOUGUI/MBAIRABE", coton: 13.84, ints: 0.0, dist: 61.0, dist_ref: 171.0, montant: 118625.0, obser: "", bms: "62685" },
    Ligne { fac: "08P0049A", usine: "MDOU", cgi: "MISE EN PLACE", av: "MISE EN PLACE", coton: 0.0, ints: 22.434, dist: 170.0, dist_ref: 196.0, montant: 547072.0, obser: "", bms: "62713/62699" },
    Ligne { fac: "08P0588A", usine: "MDOU", cgi: "MISE EN PLACE", av: "MISE EN PLACE", coton: 0.0, ints: 31.317, dist: 114.0, dist_ref: 256.0, montant: 972242.0, obser: "", bms: "62720" },
    Ligne { fac: "08P0444A", usine: "KMRA", cgi: "BEDEYA ET MOISSALA", av: "BEDEYA ET MOISSALA", coton: 12.68, ints: 0.0, dist: 171.0, dist_ref: 205.0, montant: 278329.0, obser: "", bms: "72974" },
    Ligne { fac: "14P1122A", usine: "MDOU", cgi: "NGAL", av: "NGAL", coton: 0.0, ints: 23.155, dist: 93.0, dist_ref: 130.0, montant: 335297.0, obser: "", bms: "62741" },
    Ligne { fac: "14P1122A", usine: "MDOU", cgi: "MISE EN PLACE", av: "MISE EN PLACE", coton: 0.0, ints: 21.162, dist: 135.0, dist_ref: 188.0, montant: 440593.0, obser: "", bms: "63890" },
    Ligne { fac: "18P2908A", usine: "MDOU", cgi: "MISE EN PLACE", av: "MISE EN PLACE", coton: 0.0, ints: 26.956, dist: 230.0, dist_ref: 302.0, montant: 1016159.0, obser: "", bms: "62743" },
    Ligne { fac: "08T0038A", usine: "MDOU", cgi: "MISE EN PLACE", av: "MISE EN PLACE", coton: 0.0, ints: 23.094, dist: 185.0, dist_ref: 256.0, montant: 671750.0, obser: "", bms: "63857" },
    Ligne { fac: "14T0021A", usine: "MDOU", cgi: "MISE EN PLACE", av: "MISE EN PLACE", coton: 0.0, ints: 19.189, dist: 152.0, dist_ref: 210.0, montant: 439627.0, obser: "", bms: "63855" },
    Ligne { fac: "08T0038A", usine: "MDOU", cgi: "MISE EN PLACE", av: "MISE EN PLACE", coton: 0.0, ints: 40.346, dist: 53.0, dist_ref: 92.0, montant: 421646.0, obser: "", bms: "63872" },
    Ligne { fac: "08T0444A", usine: "KMRA", cgi: "MISE EN PLACE", av: "MISE EN PLACE", coton: 0.0, ints: 3.375, dist: 72.0, dist_ref: 0.0, montant: 29363.0, obser: "SSC", bms: "" },
    Ligne { fac: "08P0050A", usine: "DOBA", cgi: "MISE EN PLACE", av: "MISE EN PLACE", coton: 0.0, ints: 13.95, dist: 45.0, dist_ref: 120.0, montant: 116474.0, obser: "", bms: "79502" },
    Ligne { fac: "08P0444A", usine: "DOBA", cgi: "MISE EN PLACE", av: "MISE EN PLACE", coton: 0.0, ints: 13.8, dist: 66.0, dist_ref: 130.0, montant: 125244.0, obser: "", bms: "79508" },
    Ligne { fac: "08P0444A", usine: "DOBA", cgi: "MISE EN PLACE", av: "MISE EN PLACE", coton: 0.0, ints: 17.05, dist: 53.0, dist_ref: 200.0, montant: 66930.0, obser: "", bms: "79511" },
    Ligne { fac: "08T0038A", usine: "MDOU", cgi: "MISE EN PLACE", av: "MISE EN PLACE", coton: 0.0, ints: 31.334, dist: 153.0, dist_ref: 230.0, montant: 844270.0, obser: "", bms: "63955" },
    Ligne { fac: "08P0444A", usine: "DOBA", cgi: "MISE EN PLACE", av: "MISE EN PLACE", coton: 0.0, ints: 15.72, dist: 61.0, dist_ref: 200.0, montant: 10489.0, obser: "", bms: "54225" },
    Ligne { fac: "08P0444A", usine: "DOBA", cgi: "MISE EN PLACE", av: "MISE EN PLACE", coton: 0.0, ints: 22.6, dist: 38.0, dist_ref: 200.0, montant: 347336.0, obser: "", bms: "54238" },
    Ligne { fac: "08P0444A", usine: "DOBA", cgi: "MISE EN PLACE", av: "MISE EN PLACE", coton: 0.0, ints: 13.527, dist: 157.0, dist_ref: 200.0, montant: 380368.0, obser: "", bms: "54219" },
    Ligne { fac: "08P0050A", usine: "DOBA", cgi: "MISE EN PLACE", av: "MISE EN PLACE", coton: 0.0, ints: 14.177, dist: 58.0, dist_ref: 140.0, montant: 62023.0, obser: "", bms: "79506" },
    Ligne { fac: "08P0050A", usine: "DOBA", cgi: "MISE EN PLACE", av: "MISE EN PLACE", coton: 0.0, ints: 9.175, dist: 35.0, dist_ref: 60.0, montant: 65122.0, obser: "", bms: "54249" },
    Ligne { fac: "08P0050A", usine: "DOBA", cgi: "MISE EN PLACE", av: "MISE EN PLACE", coton: 0.0, ints: 14.705, dist: 45.0, dist_ref: 140.0, montant: 72989.0, obser: "", bms: "54245" },
    Ligne { fac: "08P0050A", usine: "DOBA", cgi: "MISE EN PLACE", av: "MISE EN PLACE", coton: 0.0, ints: 7.775, dist: 47.0, dist_ref: 50.0, montant: 55438.0, obser: "", bms: "79516" },
    Ligne { fac: "14P1122A", usine: "MDOU", cgi: "MISE EN PLACE", av: "MISE EN PLACE", coton: 0.0, ints: 35.974, dist: 157.0, dist_ref: 236.0, montant: 1022462.0, obser: "", bms: "63882" },
    Ligne { fac: "14P1122A", usine: "MDOU", cgi: "MISE EN PLACE", av: "MISE EN PLACE", coton: 0.0, ints: 25.936, dist: 200.0, dist_ref: 260.0, montant: 844770.0, obser: "", bms: "63970" },
    Ligne { fac: "08P0050A", usine: "DOBA", cgi: "MISE EN PLACE", av: "MISE EN PLACE", coton: 0.0, ints: 10.569, dist: 81.0, dist_ref: 120.0, montant: 57392.0, obser: "", bms: "54221" },
    Ligne { fac: "08P0050A", usine: "DOBA", cgi: "MISE EN PLACE", av: "MISE EN PLACE", coton: 0.0, ints: 13.85, dist: 31.0, dist_ref: 100.0, montant: 132725.0, obser: "", bms: "79514" },
    Ligne { fac: "08P0050A", usine: "DOBA", cgi: "MISE EN PLACE", av: "MISE EN PLACE", coton: 0.0, ints: 10.262, dist: 91.0, dist_ref: 150.0, montant: 55162.0, obser: "", bms: "54239" },
    Ligne { fac: "08P0050A", usine: "DOBA", cgi: "MISE EN PLACE", av: "MISE EN PLACE", coton: 0.0, ints: 23.212, dist: 38.0, dist_ref: 100.0, montant: 204927.0, obser: "", bms: "54242" },
    Ligne { fac: "08P0050A", usine: "DOBA", cgi: "MISE EN PLACE", av: "MISE EN PLACE", coton: 0.0, ints: 10.83, dist: 35.0, dist_ref: 150.0, montant: 14060.0, obser: "", bms: "54228" },
    Ligne { fac: "08P0050A", usine: "DOBA", cgi: "MISE EN PLACE", av: "MISE EN PLACE", coton: 0.0, ints: 15.246, dist: 40.0, dist_ref: 100.0, montant: 112250.0, obser: "", bms: "54224" },
    Ligne { fac: "08P0444A", usine: "MDOU", cgi: "MISE EN PLACE", av: "MISE EN PLACE", coton: 11.5, ints: 0.0, dist: 118.0, dist_ref: 134.0, montant: 169628.0, obser: "", bms: "62648" },
    Ligne { fac: "08P0444A", usine: "MDOU", cgi: "MISE EN PLACE", av: "MISE EN PLACE", coton: 0.0, ints: 27.826, dist: 142.0, dist_ref: 207.0, montant: 607107.0, obser: "", bms: "63967" },
    Ligne { fac: "14P1122A", usine: "MDOU", cgi: "MISE EN PLACE", av: "MISE EN PLACE", coton: 0.0, ints: 26.859, dist: 124.0, dist_ref: 190.0, montant: 581775.0, obser: "", bms: "63986" },
    Ligne { fac: "14P1122A", usine: "MDOU", cgi: "MISE EN PLACE", av: "MISE EN PLACE", coton: 0.0, ints: 14.145, dist: 200.0, dist_ref: 260.0, montant: 285986.0, obser: "", bms: "63980" },
    Ligne { fac: "14P1122A", usine: "MDOU", cgi: "MISE EN PLACE", av: "MISE EN PLACE", coton: 0.0, ints: 5.365, dist: 162.0, dist_ref: 0.0, montant: 168519.0, obser: "SSC", bms: "" },
    Ligne { fac: "14T0021A", usine: "MDOU", cgi: "MISE EN PLACE", av: "MISE EN PLACE", coton: 0.0, ints: 23.6, dist: 118.0, dist_ref: 164.0, montant: 437858.0, obser: "", bms: "6399" },
    Ligne { fac: "14T0021A", usine: "MDOU", cgi: "MISE EN PLACE", av: "MISE EN PLACE", coton: 0.0, ints: 29.7, dist: 124.0, dist_ref: 168.0, montant: 554365.0, obser: "", bms: "63994" },
    Ligne { fac: "14T0021A", usine: "MDOU", cgi: "MISE EN PLACE", av: "MISE EN PLACE", coton: 0.0, ints: 15.257, dist: 109.0, dist_ref: 210.0, montant: 335694.0, obser: "", bms: "60305" },
    Ligne { fac: "14P1122A", usine: "MDOU", cgi: "MISE EN PLACE", av: "MISE EN PLACE", coton: 0.0, ints: 21.142, dist: 148.0, dist_ref: 204.0, montant: 475002.0, obser: "", bms: "60308" },
];

/// Date de l'opération : étalée du 15/11/2024 au ~02/06/2025.
fn date_de(index: usize) -> String {
    let debut = NaiveDate::from_ymd_opt(2024, 11, 15).expect("date de début valide");
    (debut + chrono::Duration::days((index as i64) * 200 / LIGNES.len() as i64))
        .format("%Y-%m-%d")
        .to_string()
}

/// Retourne l'id de l'usine, en la créant si nécessaire.
fn usine_id(
    conn: &Connection,
    cache: &mut HashMap<String, i64>,
    nom: &str,
) -> Result<i64, Box<dyn std::error::Error>> {
    if let Some(id) = cache.get(nom) {
        return Ok(*id);
    }
    let localite = match nom {
        "MDOU" => "Moundou",
        "KMRA" => "Koumra",
        "DOBA" => "Doba",
        _ => "",
    };
    conn.execute(
        "INSERT INTO usines (nom, localite) VALUES (?1, ?2)",
        params![nom, localite],
    )?;
    let id = conn.last_insert_rowid();
    cache.insert(nom.to_string(), id);
    Ok(id)
}

/// Retourne l'id du CGI, en le créant si nécessaire (dédupliqué par nom et usine).
fn cgi_id(
    conn: &Connection,
    cache: &mut HashMap<String, i64>,
    nom: &str,
    usine: i64,
) -> Result<i64, Box<dyn std::error::Error>> {
    let cle = format!("{nom}|{usine}");
    if let Some(id) = cache.get(&cle) {
        return Ok(*id);
    }
    conn.execute(
        "INSERT INTO cgis (nom, usine_id) VALUES (?1, ?2)",
        params![nom, usine],
    )?;
    let id = conn.last_insert_rowid();
    cache.insert(cle, id);
    Ok(id)
}

/// Retourne l'id de l'AV, en le créant si nécessaire (dédupliqué par nom et CGI).
fn av_id(
    conn: &Connection,
    cache: &mut HashMap<String, i64>,
    nom: &str,
    cgi: i64,
) -> Result<i64, Box<dyn std::error::Error>> {
    let cle = format!("{nom}|{cgi}");
    if let Some(id) = cache.get(&cle) {
        return Ok(*id);
    }
    conn.execute(
        "INSERT INTO avs (nom, cgi_id) VALUES (?1, ?2)",
        params![nom, cgi],
    )?;
    let id = conn.last_insert_rowid();
    cache.insert(cle, id);
    Ok(id)
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let chemin = std::env::current_dir()?.join("abaf-campagne-2024-2025.db");
    if chemin.exists() {
        std::fs::remove_file(&chemin)?;
    }

    // 1. Schéma complet (migration initiale du système).
    let conn = Connection::open(&chemin)?;
    conn.execute_batch(include_str!("../migrations/001_initial.sql"))?;

    // 2. Campagne, prix du gasoil et barème tarifaire indicatif.
    conn.execute(
        "INSERT INTO saisons (libelle, date_debut, date_fin, statut)
         VALUES (?1, ?2, ?3, 'ouverte')",
        params!["Campagne 2024-2025", "2024-11-01", "2025-06-30"],
    )?;
    let saison_id = conn.last_insert_rowid();
    conn.execute(
        "INSERT INTO prix_gasoil (saison_id, prix_litre) VALUES (?1, 800.0)",
        params![saison_id],
    )?;
    // Barème indicatif reconstitué des montants du rapport (~120-160 F/t/km) :
    // les montants réels du fichier sont insérés tels quels dans les lignes de
    // facture, ce barème n'est là que pour le module Tarifs.
    for (min, max, prix) in [
        (0.0, 100.0, 160.0),
        (100.0, 200.0, 150.0),
        (200.0, 300.0, 140.0),
        (300.0, 400.0, 130.0),
        (400.0, 10000.0, 120.0),
    ] {
        conn.execute(
            "INSERT INTO tarifs (saison_id, distance_min, distance_max, prix_tonne_km)
             VALUES (?1, ?2, ?3, ?4)",
            params![saison_id, min, max, prix],
        )?;
    }

    // 3. Parc de camions et chauffeurs (le rapport ne les mentionne pas :
    //    répartition déterministe pour la démonstration).
    let mut camions: Vec<i64> = Vec::new();
    for i in 1..=10 {
        conn.execute(
            "INSERT INTO camions (immatriculation, marque, capacite_tonnes)
             VALUES (?1, 'Mercedes-Benz', 30.0)",
            params![format!("TD-{:04}", 1000 + i)],
        )?;
        camions.push(conn.last_insert_rowid());
    }
    let mut chauffeurs: Vec<i64> = Vec::new();
    for i in 1..=10 {
        conn.execute(
            "INSERT INTO chauffeurs (nom, prenom) VALUES (?1, 'Démo')",
            params![format!("Chauffeur {i:02}")],
        )?;
        chauffeurs.push(conn.last_insert_rowid());
    }

    let client_id: i64 = conn.query_row(
        "SELECT id FROM clients WHERE nom = 'COTONTCHAD SN'",
        [],
        |row| row.get(0),
    )?;

    let mut cache_usines: HashMap<String, i64> = HashMap::new();
    let mut cache_cgis: HashMap<String, i64> = HashMap::new();
    let mut cache_avs: HashMap<String, i64> = HashMap::new();
    let mut factures: HashMap<String, i64> = HashMap::new();
    let mut numeros_bsm: HashSet<String> = HashSet::new();

    // 4. Une itération par opération du rapport.
    for (index, ligne) in LIGNES.iter().enumerate() {
        let u = usine_id(&conn, &mut cache_usines, ligne.usine)?;
        let cgi = cgi_id(&conn, &mut cache_cgis, ligne.cgi, u)?;
        let av = av_id(&conn, &mut cache_avs, ligne.av, cgi)?;
        let camion = camions[index % camions.len()];
        let chauffeur = chauffeurs[index % chauffeurs.len()];
        let date = date_de(index);

        // Référentiel des distances CGI ↔ usine (2ᵉ colonne du rapport).
        if ligne.dist_ref >= 20.0 {
            conn.execute(
                "INSERT OR IGNORE INTO distances (cgi_id, usine_id, distance_km)
                 VALUES (?1, ?2, ?3)",
                params![cgi, u, ligne.dist_ref],
            )?;
        }

        // Mission (statut final : facturé).
        conn.execute(
            "INSERT INTO missions (saison_id, camion_id, chauffeur_id, usine_id, cgi_id,
                                   av_id, date_mission, statut)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'facture')",
            params![saison_id, camion, chauffeur, u, cgi, av, date],
        )?;
        let mission = conn.last_insert_rowid();

        // Pesées vide + chargée -> Poids Coton du rapport (charge − vide).
        let (poids_vide, poids_charge) = if ligne.coton > 0.0 {
            (Some(10_000.0), Some(10_000.0 + ligne.coton * 1000.0))
        } else {
            (None, None)
        };
        if let (Some(vide), Some(charge)) = (poids_vide, poids_charge) {
            conn.execute(
                "INSERT INTO pesees (mission_id, camion_id, usine_id, type_pesee, poids_kg,
                                     date_pesee, heure_pesee, ticket_pesee)
                 VALUES (?1, ?2, ?3, 'vide', ?4, ?5, '08:30', ?6)",
                params![
                    mission,
                    camion,
                    u,
                    vide,
                    date,
                    format!("B-{:05}", 10_000 + index)
                ],
            )?;
            conn.execute(
                "INSERT INTO pesees (mission_id, camion_id, usine_id, type_pesee, poids_kg,
                                     date_pesee, heure_pesee, ticket_pesee)
                 VALUES (?1, ?2, ?3, 'charge', ?4, ?5, '16:30', ?6)",
                params![
                    mission,
                    camion,
                    u,
                    charge,
                    date,
                    format!("B-{:05}", 20_000 + index)
                ],
            )?;
        }

        // Bordereau validé (poids repris des pesées quand elles existent).
        let observations = if ligne.obser.is_empty() {
            None
        } else {
            Some(ligne.obser)
        };
        conn.execute(
            "INSERT INTO bordereaux (numero, saison_id, mission_id, camion_id, chauffeur_id,
                                     usine_id, cgi_id, date_bordereau, poids_vide_kg,
                                     poids_charge_kg, distance_km, statut, observations)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, 'valide', ?12)",
            params![
                format!("BR-2025-{:04}", index + 1),
                saison_id,
                mission,
                camion,
                chauffeur,
                u,
                cgi,
                date,
                poids_vide,
                poids_charge,
                ligne.dist,
                observations
            ],
        )?;
        let bordereau = conn.last_insert_rowid();

        // Ligne AV -> Poids INT du rapport.
        conn.execute(
            "INSERT INTO lignes_bordereau (bordereau_id, av_id, poids_kg)
             VALUES (?1, ?2, ?3)",
            params![bordereau, av, ligne.ints * 1000.0],
        )?;

        // BSM gasoil rattachés à la mission (plusieurs numéros possibles).
        if !ligne.bms.is_empty() {
            for (j, num) in ligne.bms.split('/').enumerate() {
                let num = num.trim();
                // Deux opérations du rapport partagent le même numéro BSM
                // (« 72861 ») : le second est suffixé pour rester unique.
                let numero = if numeros_bsm.contains(num) {
                    format!("{num}-bis")
                } else {
                    num.to_string()
                };
                numeros_bsm.insert(numero.clone());
                // Quantité non fournie par le rapport : valeur de démonstration.
                let quantite = 160.0 + ((index + j * 3) % 9) as f64 * 20.0;
                conn.execute(
                    "INSERT INTO bsm (numero, saison_id, mission_id, camion_id, usine_id,
                                      date_bsm, beneficiaire, quantite_litres, prix_litre, statut)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'ABAF SARL', ?7, 800.0, 'facture')",
                    params![numero, saison_id, mission, camion, u, date, quantite],
                )?;
            }
        }

        // Facture regroupant les opérations (créée à la première occurrence).
        let facture = match factures.get(ligne.fac) {
            Some(id) => *id,
            None => {
                conn.execute(
                    "INSERT INTO factures (numero, saison_id, client_id, date_facture, statut)
                     VALUES (?1, ?2, ?3, ?4, 'validee')",
                    params![ligne.fac, saison_id, client_id, date],
                )?;
                let id = conn.last_insert_rowid();
                factures.insert(ligne.fac.to_string(), id);
                id
            }
        };

        // Ligne de facture : montant réel du rapport.
        let poids_ligne = ligne.coton * 1000.0;
        let tarif = if poids_ligne > 0.0 && ligne.dist > 0.0 {
            ligne.montant / (ligne.coton * ligne.dist)
        } else {
            0.0
        };
        conn.execute(
            "INSERT INTO lignes_facture (facture_id, bordereau_id, description, poids_net_kg,
                                         distance_km, tarif_tonne, montant_brut,
                                         montant_gasoil, montant_net)
             VALUES (?1, ?2, 'Transport coton graine', ?3, ?4, ?5, ?6, 0, ?6)",
            params![
                facture,
                bordereau,
                poids_ligne,
                ligne.dist,
                tarif,
                ligne.montant
            ],
        )?;
    }

    // 5. Consolidation des montants de tête des factures.
    conn.execute(
        "UPDATE factures
         SET montant_brut = COALESCE((SELECT SUM(lf.montant_brut) FROM lignes_facture lf
                                      WHERE lf.facture_id = factures.id), 0),
             montant_net  = COALESCE((SELECT SUM(lf.montant_net) FROM lignes_facture lf
                                      WHERE lf.facture_id = factures.id), 0)",
        [],
    )?;

    // 6. Contrôles : comparaison avec les totaux du rapport.
    let nb_bordereaux: i64 =
        conn.query_row("SELECT COUNT(*) FROM bordereaux", [], |r| r.get(0))?;
    let nb_pesees: i64 = conn.query_row("SELECT COUNT(*) FROM pesees", [], |r| r.get(0))?;
    let nb_bsm: i64 = conn.query_row("SELECT COUNT(*) FROM bsm", [], |r| r.get(0))?;
    let nb_factures: i64 = conn.query_row("SELECT COUNT(*) FROM factures", [], |r| r.get(0))?;
    let tonnage_coton: f64 = conn.query_row(
        "SELECT COALESCE(SUM(poids_net_kg), 0.0) FROM bordereaux",
        [],
        |r| r.get(0),
    )?;
    let tonnage_int: f64 = conn.query_row(
        "SELECT COALESCE(SUM(poids_kg), 0.0) FROM lignes_bordereau",
        [],
        |r| r.get(0),
    )?;
    let montant_total: f64 = conn.query_row(
        "SELECT COALESCE(SUM(montant_brut), 0.0) FROM lignes_facture",
        [],
        |r| r.get(0),
    )?;

    conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);")?;
    drop(conn);

    println!("Base de démonstration générée : {}", chemin.display());
    println!(
        "  {nb_bordereaux} opérations, {nb_pesees} pesées, {nb_bsm} BSM, {nb_factures} factures"
    );
    println!("  Tonnage coton : {:.2} t (rapport : 1 584,27 t)", tonnage_coton / 1000.0);
    println!("  Tonnage INT   : {:.2} t (rapport :   833,88 t)", tonnage_int / 1000.0);
    println!("  Montant total : {montant_total:.0} F (rapport : 49 847 164 F)");
    Ok(())
}
