// Modèles de documents imprimables (AGENT.md §20).
// Le générateur PDF du rapport annuel (rapportAnnuelPdf) est volontairement
// exclu de ce barrel : il charge jsPDF à la demande via import dynamique.
export { BsmDocument } from './bsmDocument';
export { BordereauDocument } from './bordereauDocument';
export { FactureDocument } from './factureDocument';
