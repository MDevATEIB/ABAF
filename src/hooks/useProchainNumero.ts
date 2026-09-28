import { useQuery } from '@tanstack/react-query';
import { prochainNumeroDocument, type TypeDocument } from '@/utils';

/**
 * Récupère le prochain numéro séquentiel qui sera attribué à un document
 * (facture, bordereau, BSM) pour une date donnée. Numéro formaté
 * `2026-0138`. Le résultat est mis en cache par type + date.
 *
 * @param typeDoc   Type de document cible.
 * @param dateIso   Date ISO (YYYY-MM-DD) du document (l'année est extraite).
 * @param enabled   Si `false`, la requête n'est pas déclenchée (défaut : `true`).
 */
export function useProchainNumero(
  typeDoc: TypeDocument,
  dateIso: string,
  enabled: boolean = true,
) {
  return useQuery({
    queryKey: ['prochain-numero', typeDoc, dateIso],
    queryFn: () => prochainNumeroDocument(typeDoc, dateIso),
    enabled: enabled && Boolean(typeDoc && dateIso),
    staleTime: 15_000,
  });
}
