/**
 * Push des justificatifs photo, par lots ≤ 3,5 Mo de base64 cumulé (le poste
 * plafonne le corps à 4 Mo). Purge locale après accord du serveur : la photo
 * existe alors dans `app_data_dir/justificatifs/` et `depenses.photo` arrive
 * au prochain pull.
 */
import { requete } from './client';
import { getAll, run } from '../db/client';
import { journaliser } from '../db/repos/referentiels';
import { marquerDepenseConflit } from '../db/repos/depenses';
import type { PhotosRequest, PhotosResponse } from '../types/api';

const LIMITE_LOT_CARACTERES = 3_500_000; // ~2,6 Mo de binaire
const MAX_PHOTOS_SANS_PIECES = 200;

interface PhotoEnAttente {
  depense_uuid: string;
  uri: string;
  base64: string;
  tries: number;
}

export async function enregistrerPhoto(depenseUuid: string, uri: string, base64: string): Promise<void> {
  await run(
    'INSERT OR REPLACE INTO photos_en_attente (depense_uuid, uri, base64, status, tries, motif) VALUES (?, ?, ?, ?, 0, NULL)',
    [depenseUuid, uri, base64, 'pending'],
  );
  // Le formulaire marque la dépense « photo jointe » via photo = uri local.
}

export async function compterPhotosEnAttente(): Promise<number> {
  const ligne = await getAll<{ nb: number }>(
    "SELECT COUNT(*) AS nb FROM photos_en_attente WHERE status != 'ok'",
  );
  return ligne[0]?.nb ?? 0;
}

async function chargerLot(): Promise<PhotoEnAttente[]> {
  return getAll<PhotoEnAttente>(
    "SELECT depense_uuid, uri, base64, tries FROM photos_en_attente WHERE status != 'ok' ORDER BY tries LIMIT ?",
    [MAX_PHOTOS_SANS_PIECES],
  );
}

export interface BilanPhotos {
  envoyees: number;
  echouees: number;
}

export async function pousserPhotos(
  surProgression?: (fait: number, total: number) => void,
): Promise<BilanPhotos> {
  const bilan: BilanPhotos = { envoyees: 0, echouees: 0 };
  const candidates = await chargerLot();

  // Découpe en lots sous la limite de poids.
  const lots: PhotoEnAttente[][] = [];
  let lotCourant: PhotoEnAttente[] = [];
  let poids = 0;
  for (const photo of candidates) {
    if (poids + photo.base64.length > LIMITE_LOT_CARACTERES && lotCourant.length > 0) {
      lots.push(lotCourant);
      lotCourant = [];
      poids = 0;
    }
    lotCourant.push(photo);
    poids += photo.base64.length;
  }
  if (lotCourant.length > 0) lots.push(lotCourant);

  for (const lot of lots) {
    const corps: PhotosRequest = {
      items: lot.map((p) => ({
        depense_uuid: p.depense_uuid,
        filename: 'photo.jpg',
        mime: 'image/jpeg',
        base64: p.base64,
      })),
    };
    const reponse = await requete<PhotosResponse>('/sync/photos', { corps });
    for (const resultat of reponse.results) {
      const photo = lot.find((p) => p.depense_uuid === resultat.depense_uuid);
      if (!photo) continue;
      if (resultat.status === 'ok') {
        await run('DELETE FROM photos_en_attente WHERE depense_uuid = ? AND uri = ?', [
          resultat.depense_uuid,
          photo.uri,
        ]);
        bilan.envoyees += 1;
      } else {
        await run("UPDATE photos_en_attente SET tries = tries + 1, status = 'erreur', motif = ? WHERE depense_uuid = ? AND uri = ?", [
          resultat.motif ?? 'photo refusée',
          resultat.depense_uuid,
          photo.uri,
        ]);
        // Une photo refusée pour dépense inconnue est un vrai conflit métier.
        if (resultat.motif === 'depense_inconnue') {
          await marquerDepenseConflit(resultat.depense_uuid);
          await journaliser(resultat.depense_uuid, 'depenses', 'Photo refusée : dépense inconnue du poste.', 'rejected');
        }
        bilan.echouees += 1;
      }
    }
    surProgression?.(bilan.envoyees + bilan.echouees, candidates.length);
  }

  return bilan;
}
