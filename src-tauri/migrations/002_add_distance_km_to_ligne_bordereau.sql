-- Migration 002
-- Ajoute la colonne distance_km (réel, nullable) sur la table lignes_bordereau.
-- Historique : la distance était auparavant stockée GLOBALEMENT par bordereau.
-- Désormais chaque ligne (par AV, par lot chargé) possède sa propre distance,
-- utilisée pour le calcul ligne-par-ligne des TKM lors de la facturation.

ALTER TABLE lignes_bordereau ADD COLUMN distance_km REAL NULL;
