import { invoke } from '@tauri-apps/api/core';
import type { Appareil, CodeAppairage, EtatSync } from '@/types';

// Le serveur de synchronisation tourne dans le process Tauri (axum, port
// 9470 par défaut) : ces commandes le pilotent et alimentent la carte
// « Synchronisation mobile » des Paramètres.

/** Démarre le serveur HTTP ; sans port précisé, 9470 ou la valeur mémorisée. */
export async function demarrerServeurSync(port?: number): Promise<EtatSync> {
  return invoke<EtatSync>('demarrer_serveur_sync', { port: port ?? null });
}

export async function arreterServeurSync(): Promise<EtatSync> {
  return invoke<EtatSync>('arreter_serveur_sync');
}

export async function getEtatSync(): Promise<EtatSync> {
  return invoke<EtatSync>('get_etat_sync');
}

/** Génère un code d'appairage à six chiffres, valable dix minutes à usage unique. */
export async function genererCodeAppairage(appareil?: string): Promise<CodeAppairage> {
  return invoke<CodeAppairage>('generer_code_appairage', { appareil: appareil ?? null });
}

export async function annulerCodeAppairage(): Promise<void> {
  return invoke<void>('annuler_code_appairage');
}

export async function listerAppareils(): Promise<Appareil[]> {
  return invoke<Appareil[]>('lister_appareils');
}

/** Révoque le jeton d'un téléphone : ses prochaines requêtes seront refusées. */
export async function revoquerAppareil(uuid: string): Promise<void> {
  return invoke<void>('revoquer_appareil', { uuid });
}

export async function supprimerAppareil(uuid: string): Promise<void> {
  return invoke<void>('supprimer_appareil', { uuid });
}

/** Chemin du dossier des justificatifs (l'ouverture est faite côté interface). */
export async function ouvrirDossierJustificatifs(): Promise<string> {
  return invoke<string>('ouvrir_dossier_justificatifs');
}

/** Ajoute les règles entrantes au pare-feu Windows ; l'élévation UAC est demandée. */
export async function configurerPareFeu(): Promise<string> {
  return invoke<string>('configurer_pare_feu');
}

export async function testerPortDisponible(port: number): Promise<boolean> {
  return invoke<boolean>('tester_port_disponible', { port });
}
