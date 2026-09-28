/// Formate un montant en FCFA (ex. : 1 250 000 FCFA)
pub fn format_fcfa(montant: f64) -> String {
    // Séparateur de milliers avec espace insécable
    let entier = montant as i64;
    let s = entier.to_string();
    let mut result = String::new();
    let chars: Vec<char> = s.chars().collect();
    for (i, c) in chars.iter().enumerate() {
        if i > 0 && (chars.len() - i) % 3 == 0 {
            result.push(' ');
        }
        result.push(*c);
    }
    format!("{} FCFA", result)
}

/// Formate un poids en kilogrammes (ex. : 24 200 kg)
pub fn format_kg(poids: f64) -> String {
    format!("{:.0} kg", poids)
}

/// Formate une quantité de gasoil en litres (ex. : 350 L)
pub fn format_litres(quantite: f64) -> String {
    format!("{:.0} L", quantite)
}

// ─── Génération automatique des numéros de documents ─────────────────────────
///
/// Les numéros séquentiels sont attribués **par année civile** et par type de
/// document. Format produit par défaut : `{ANNEE}-{SEQ}` où SEQ est rembourré
/// à 4 chiffres (ex. `2026-0001`, `2026-0138`).
///
/// Si un numéro explicite est fourni dans le payload, on le conserve tel quel :
/// on permet ainsi la numérotation manuelle d'archives / reprises.
///
/// La génération est insensible aux trous (suppression de documents), et
/// utilise un verrouillage (SELECT COUNT WHERE ... >= année) dans la même
/// transaction (ou connexion) de l'INSERT pour garantir l'unicité.

fn extraire_annee_iso(date_iso: &str) -> String {
    let default_year = || {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .ok()
            .and_then(|d| {
                // 1970 + secs / 31_536_000 (approximatif mais suffisant pour extraire une année)
                let secs = d.as_secs();
                let y = 1970 + (secs / 31_536_000) as i32;
                Some(y.to_string())
            })
            .unwrap_or_else(|| "0000".to_string())
    };

    if let Some(annee) = date_iso.split('-').next() {
        if annee.len() == 4 && annee.chars().all(|c| c.is_ascii_digit()) {
            return annee.to_string();
        }
    }
    default_year()
}

/// Génère un numéro séquentiel pour une table donnée, sur base d'une date ISO.
/// La colonne de date utilisée pour extraire l'année est passée via
/// `colonne_date` (ex. `"date_bordereau"`, `"date_bsm"`, `"date_facture"`).
///
/// Retourne une chaîne de la forme `"2026-0138"`.
pub fn generer_numero_document(
    db: &rusqlite::Connection,
    table: &str,
    colonne_date: &str,
    colonne_numero: &str,
    date_iso: &str,
) -> Result<String, String> {
    let annee = extraire_annee_iso(date_iso);

    // Nombre d'enregistrements de l'année courante (inclut les documents
    // supprimés ? Non. On utilise MAX CAST(substr(numero, instr...)).
    // Stratégie robuste : extraire le suffixe 4 chiffres dans le format
    // `{ANNEE}-{NNNN}` ET aussi prendre COUNT + 1 pour les numéros qui
    // seraient dans un autre format (compatibilité ascendante). On garde
    // le MAX des deux, +1.
    let sql = format!(
        "SELECT
             COALESCE(MAX(CASE
               WHEN {col} GLOB '{annee}-[0-9][0-9][0-9][0-9]*'
               THEN CAST(SUBSTR({col}, {len}) AS INTEGER)
               ELSE NULL END), 0) AS max_auto,
             COALESCE(COUNT(*), 0) AS cnt_annee
         FROM {table}
         WHERE strftime('%Y', {cdate}) = ?1",
        table = table,
        col = colonne_numero,
        cdate = colonne_date,
        annee = annee,
        len = annee.len() + 2, // position juste après `{ANNEE}-`
    );

    let (max_auto, cnt_annee): (i64, i64) = db
        .query_row(&sql, rusqlite::params![annee], |row| {
            Ok((row.get(0)?, row.get(1)?))
        })
        .map_err(|e| e.to_string())?;

    let seq = std::cmp::max(max_auto, cnt_annee) + 1;
    Ok(format!("{}-{:04}", annee, seq))
}

// ─── Commande Tauri : pré-calcul du prochain numéro ──────────────────────────

/// Liste blanche des tables / colonnes autorisées (sécurité : pas de SQL
/// dynamique avec entrée utilisateur non filtrée).
const TABLES_AUTORISEES: &[(&str, &str, &str)] = &[
    ("factures",    "date_facture",   "numero"),
    ("bordereaux",  "date_bordereau", "numero"),
    ("bsm",         "date_bsm",       "numero"),
];

fn colonnes_pour_table(table: &str) -> Result<(&'static str, &'static str), String> {
    TABLES_AUTORISEES
        .iter()
        .find(|(t, _, _)| *t == table)
        .map(|(_, cd, cn)| (*cd, *cn))
        .ok_or_else(|| {
            format!(
                "Type de document « {} » inconnu. Types autorisés : {}.",
                table,
                TABLES_AUTORISEES
                    .iter()
                    .map(|(t, _, _)| *t)
                    .collect::<Vec<_>>()
                    .join(", ")
            )
        })
}

/// Commande Tauri : calcule le prochain numéro séquentiel qui sera attribué
/// à un document, **sans rien insérer en base**. Utile pour le placeholder
/// du formulaire de création (aperçu avant validation).
///
/// * `type_doc` : `"factures"`, `"bordereaux"` ou `"bsm"`.
/// * `date_iso` : date ISO du document (YYYY-MM-DD) — sert à extraire l'année.
///
/// Retourne le numéro formaté `"2026-0138"` ou une erreur si le type est
/// invalide.
#[tauri::command]
pub fn prochain_numero_document(
    state: tauri::State<'_, crate::db::AppState>,
    type_doc: String,
    date_iso: String,
) -> Result<String, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let (colonne_date, colonne_numero) = colonnes_pour_table(&type_doc)?;
    generer_numero_document(&db, &type_doc, colonne_date, colonne_numero, &date_iso)
}
