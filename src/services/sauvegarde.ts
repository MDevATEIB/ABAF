import { invoke } from '@tauri-apps/api/core';

/**
 * Sauvegarde manuelle de la base de données (AGENT.md §24.3) : une copie
 * horodatée est créée dans « Documents/ABAF » (ou le dossier précisé).
 * Retourne le chemin complet du fichier créé.
 */
export async function sauvegarderBase(dossier?: string): Promise<string> {
  return invoke<string>('sauvegarder_base', { dossier: dossier ?? null });
}

/**
 * Ouvre le dialogue de sélection d'une sauvegarde à restaurer (AGENT.md
 * §24.3). Retourne le chemin du fichier choisi, ou null si l'utilisateur
 * annule.
 */
export async function choisirFichierSauvegarde(): Promise<string | null> {
  return invoke<string | null>('choisir_fichier_sauvegarde');
}

/**
 * Restaure la base depuis une sauvegarde (AGENT.md §24.3) : le contenu de la
 * base en place est remplacé par celui du fichier choisi, après création
 * automatique d'une copie de sécurité. Retourne le chemin de cette copie.
 */
export async function restaurerBase(chemin: string): Promise<string> {
  return invoke<string>('restaurer_base', { chemin });
}
