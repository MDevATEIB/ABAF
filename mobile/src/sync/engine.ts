/**
 * Moteur de synchronisation : push → photos → pull, sous verrou mutuel
 * (jamais deux synchros en parallèle). Déclencheurs : ouverture à froid,
 * retour au premier plan, recouvrement réseau, appui manuel.
 */
import { AppState } from 'react-native';
import * as Network from 'expo-network';
import { useSession, sessionComplete } from '../store/session.store';
import { useSync } from '../store/sync.store';
import { useCatalogue } from '../store/catalogue.store';
import { META_CLES, setMeta } from '../db/client';
import { compterEnAttente } from '../db/repos/depenses';
import { compterPhotosEnAttente } from './photos';
import { pousser } from './push';
import { pousserPhotos } from './photos';
import { tirer } from './pull';
import { messageErreur, SynchroError } from './client';
import { ecartHorlogeMinutes } from '../utils/time';
import { nowSqlite } from '../utils/time';

let enMarche = false;
const files: (() => void)[] = [];

async function work(): Promise<void> {
  const sync = useSync.getState();

  sync.debuter();
  try {
    const bilanPush = await pousser((fait, total) =>
      sync.progresser('push', total > 0 ? fait / total : 1),
    );

    sync.progresser('photos', 0);
    const bilanPhotos = await pousserPhotos((fait, total) => sync.progresser('photos', total > 0 ? fait / total : 1));

    sync.progresser('pull', 0);
    const bilanPull = await tirer((nb) => sync.progresser('pull', Math.min(1, nb / 500)));

    await setMeta(META_CLES.derniereSynchro, nowSqlite());
    const ecart = ecartHorlogeMinutes(bilanPull.serverTime);
    await useCatalogue.getState().charger();
    sync.terminer({
      poussees: bilanPush.depensesPoussees + bilanPush.intervenantsPousses + bilanPush.piecesPoussees,
      photos: bilanPhotos.envoyees,
      tirees: bilanPull.tirees,
      horloge: Math.abs(ecart) > 5 ? ecart : null,
    });
  } catch (e) {
    // Un appareil révoqué se déconnecte franchement : l'UI renvoie à l'appairage.
    if (e instanceof SynchroError && e.genre === 'nonAuthorise') {
      await useSession.getState().deconnecter();
    }
    sync.echouer(messageErreur(e));
  }
}

/** Lance une synchro ; mise en file d'attente si une tourne déjà. */
export async function synchroniser(): Promise<void> {
  if (!sessionComplete(useSession.getState())) return;
  if (enMarche) {
    await new Promise<void>((relance) => files.push(relance));
    return synchroniser();
  }
  enMarche = true;
  try {
    await work();
  } finally {
    enMarche = false;
    const relance = files.shift();
    if (relance) relance();
  }
}

/** Rafraîchit le compteur « en attente » affiché hors connexion. */
export async function actualiserCompteurs(): Promise<void> {
  const [lignes, photos] = await Promise.all([compterEnAttente(), compterPhotosEnAttente()]);
  useSync.getState().setEnAttente(lignes + photos);
}

/**
 * Planificateur, à brancher dans le layout racine. Rend la fonction de
 * nettoyage pour l'effet React.
 */
export function demarrerPlanificateur(): () => void {
  const ecouteurs: (() => void)[] = [];

  const synchroDouce = () => {
    void actualiserCompteurs();
    if (sessionComplete(useSession.getState())) void synchroniser();
  };

  // Retour au premier plan.
  const souscriptionApp = AppState.addEventListener('change', (etat) => {
    if (etat === 'active') synchroDouce();
  });
  ecouteurs.push(() => souscriptionApp.remove());

  // Recouvrement réseau.
  const souscriptionReseau = Network.addNetworkStateListener(() => {
    synchroDouce();
  });
  ecouteurs.push(() => souscriptionReseau.remove());

  // Filet de sécurité : coup d'œil périodique (dépenses laissées en attente).
  const minuteur = setInterval(() => void actualiserCompteurs(), 60_000);
  ecouteurs.push(() => clearInterval(minuteur));

  synchroDouce();

  return () => ecouteurs.forEach((f) => f());
}
