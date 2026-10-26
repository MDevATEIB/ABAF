/**
 * État visible de la synchronisation : progression, horodatages, file.
 * Les valeurs persistantes (curseur, dernière synchro) vivent dans `meta`.
 */
import { create } from 'zustand';

export type PhaseSynchro = 'repos' | 'push' | 'photos' | 'pull' | 'erreur';

export interface EtatSynchroStore {
  enCours: boolean;
  phase: PhaseSynchro;
  progression: number; // 0..1 sur la phase en cours
  lignesPoussees: number;
  photosPoussees: number;
  lignesTirees: number;
  dernierError: string | null;
  avertissementHorloge: number | null; // écart en minutes, si > 5
  enAttente: number; // lignes pending hors connexion
}

interface ActionsSynchro {
  debuter: () => void;
  progresser: (phase: PhaseSynchro, ratio: number) => void;
  terminer: (res: { poussees: number; photos: number; tirees: number; horloge: number | null }) => void;
  echouer: (message: string) => void;
  setEnAttente: (nb: number) => void;
}

const JOUES: EtatSynchroStore = {
  enCours: false,
  phase: 'repos',
  progression: 0,
  lignesPoussees: 0,
  photosPoussees: 0,
  lignesTirees: 0,
  dernierError: null,
  avertissementHorloge: null,
  enAttente: 0,
};

export const useSync = create<EtatSynchroStore & ActionsSynchro>((set) => ({
  ...JOUES,

  debuter: () => set({ ...JOUES, enCours: true, phase: 'push', enAttente: 0 }),

  progresser: (phase, ratio) => set({ phase, progression: Math.max(0, Math.min(1, ratio)) }),

  terminer: ({ poussees, photos, tirees, horloge }) =>
    set({
      enCours: false,
      phase: 'repos',
      progression: 1,
      lignesPoussees: poussees,
      photosPoussees: photos,
      lignesTirees: tirees,
      dernierError: null,
      avertissementHorloge: horloge,
    }),

  echouer: (message) => set({ enCours: false, phase: 'erreur', dernierError: message }),

  setEnAttente: (nb) => set({ enAttente: nb }),
}));
