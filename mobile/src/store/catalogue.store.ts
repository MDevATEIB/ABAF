/**
 * Catalogue en mémoire pour les formulaires de saisie : camions, chauffeurs,
 * intervenants, pièces, saisons. Tout vient du SQLite local — le formulaire
 * fonctionne intégralement hors ligne.
 */
import { create } from 'zustand';
import {
  listerCamions,
  listerChauffeurs,
  listerIntervenants,
  listerPieces,
  listerSaisons,
  type CamionLocal,
  type ChauffeurLocal,
  type IntervenantLocal,
  type PieceLocale,
  type SaisonLocale,
} from '../db/repos/referentiels';

export interface EtatCatalogue {
  camions: CamionLocal[];
  chauffeurs: ChauffeurLocal[];
  mecaniciens: IntervenantLocal[];
  chefsParc: IntervenantLocal[];
  apprentis: IntervenantLocal[];
  pieces: PieceLocale[];
  saisons: SaisonLocale[];
  charge: boolean;
}

interface ActionsCatalogue {
  charger: () => Promise<void>;
}

const JOUES: EtatCatalogue = {
  camions: [],
  chauffeurs: [],
  mecaniciens: [],
  chefsParc: [],
  apprentis: [],
  pieces: [],
  saisons: [],
  charge: false,
};

export const useCatalogue = create<EtatCatalogue & ActionsCatalogue>((set) => ({
  ...JOUES,

  charger: async () => {
    const [camions, chauffeurs, intervenants, pieces, saisons] = await Promise.all([
      listerCamions(),
      listerChauffeurs(),
      listerIntervenants(),
      listerPieces(),
      listerSaisons(),
    ]);
    set({
      camions,
      chauffeurs,
      mecaniciens: intervenants.filter((i) => i.role === 'mecanicien' && i.actif === 1),
      chefsParc: intervenants.filter((i) => i.role === 'chef_parc' && i.actif === 1),
      apprentis: intervenants.filter((i) => i.role === 'apprenti' && i.actif === 1),
      pieces,
      saisons,
      charge: true,
    });
  },
}));
