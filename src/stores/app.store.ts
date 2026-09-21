import { create } from 'zustand';
import type { Saison } from '@/types';

interface AppState {
  /** Saison actuellement sélectionnée dans l'interface */
  saisonActive: Saison | null;
  setSaisonActive: (saison: Saison | null) => void;

  /** Titre de la page courante */
  pageTitle: string;
  setPageTitle: (title: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  saisonActive: null,
  setSaisonActive: (saison) => set({ saisonActive: saison }),

  pageTitle: 'Tableau de bord',
  setPageTitle: (title) => set({ pageTitle: title }),
}));
