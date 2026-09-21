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
