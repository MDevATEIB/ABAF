-- Migration v3 : Refonte Bordereau Système Global
-- Ajoute la colonne `bsm_id` sur `bordereaux` pour lier un bordereau à 0 ou 1 BSM
-- (1 BSM auto-généré si section gasoil remplie lors de la création/modification du bordereau).
-- Idempotente : ne fait rien si la colonne existe déjà.

ALTER TABLE bordereaux ADD COLUMN bsm_id INTEGER NULL REFERENCES bsm(id);
CREATE INDEX IF NOT EXISTS idx_bordereaux_bsm_id ON bordereaux(bsm_id);
