export function buildLignesFactureTableData(lignes, bordereauParId = new Map()) {
  return lignes
    .filter((ligne) => ligne.bordereau_id != null)
    .map((ligne) => {
      const numeroBordereau = bordereauParId.get(ligne.bordereau_id)?.numero ?? '—';

      return {
        numeroBordereau,
        cotonGraineKg: Number(ligne.poids_net_kg ?? 0),
        distanceKm: Number(ligne.distance_km ?? 0),
        tarifTonne: Number(ligne.tarif_tonne ?? 0),
        montantBrut: Number(ligne.montant_brut ?? 0),
        montantNet: Number(ligne.montant_net ?? ligne.montant_brut ?? 0),
      };
    });
}
