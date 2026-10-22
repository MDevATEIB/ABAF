import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Printer, Receipt } from 'lucide-react';
import { useQueries } from '@tanstack/react-query';

import { Button, EmptyState, ErrorMessage, Spinner } from '@/components/ui';
import {
  useBsms,
  useBordereaux,
  useCamions,
  useClients,
  useFactures,
  useLignesFacture,
  useParametres,
  useSaisons,
  useTarifs,
  useUsines,
} from '@/hooks';
import { getLignesBordereau } from '@/services/bordereau';
import { FactureDocument } from '@/templates';
import type { LigneBordereau } from '@/types';

/**
 * Aperçu et impression d'une facture (AGENT.md §20.3) : le document HTML est
 * affiché en A4 et imprimé via la boîte de dialogue du système (impression ou
 * PDF).
 */
export default function ImpressionFacturePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const factureId = Number(id);

  const factures = useFactures();
  const clients = useClients();
  const bordereaux = useBordereaux();
  const bsms = useBsms();
  const camions = useCamions();
  const usines = useUsines();
  const saisons = useSaisons();
  const parametres = useParametres();

  const facture = factures.data?.find((f) => f.id === factureId);
  const lignes = useLignesFacture(facture?.id);
  const tarifs = useTarifs(facture?.saison_id);

  // Unique bordereau_ids referenced by this facture's LigneFacture rows
  const bordereauIds: number[] = Array.from(
    new Set(
      (lignes.data ?? [])
        .map((l) => l.bordereau_id)
        .filter((bid): bid is number => bid != null)
    )
  );

  // Load all LigneBordereau sets in parallel
  const lignesBordereauQueries = useQueries({
    queries: bordereauIds.map((bid) => ({
      queryKey: ['bordereaux', 'lignes', bid] as const,
      queryFn: () => getLignesBordereau(bid),
      enabled: !lignes.isLoading && lignes.data != null,
    })),
  });

  // Build Map<bordereau_id, LigneBordereau[]>
  const lignesBordereauParBordereauId = new Map<number, LigneBordereau[]>(
    bordereauIds.map((bid, i) => [bid, lignesBordereauQueries[i]?.data ?? []])
  );

  const enChargement =
    factures.isLoading ||
    clients.isLoading ||
    bordereaux.isLoading ||
    bsms.isLoading ||
    camions.isLoading ||
    usines.isLoading ||
    saisons.isLoading ||
    tarifs.isLoading ||
    lignes.isLoading ||
    parametres.isLoading ||
    lignesBordereauQueries.some((q) => q.isLoading);

  const erreur =
    factures.error ??
    clients.error ??
    bordereaux.error ??
    bsms.error ??
    camions.error ??
    usines.error ??
    saisons.error ??
    tarifs.error ??
    lignes.error ??
    parametres.error ??
    lignesBordereauQueries.find((q) => q.error)?.error ??
    null;

  const client = facture ? clients.data?.find((c) => c.id === facture.client_id) : undefined;
  const saisonLibelle = facture ? saisons.data?.find((s) => s.id === facture.saison_id)?.libelle : undefined;
  const bordereauParId = new Map((bordereaux.data ?? []).map((b) => [b.id, b]));
  const bsmParId = new Map((bsms.data ?? []).map((b) => [b.id, b]));
  const camionNom = new Map((camions.data ?? []).map((c) => [c.id, c.immatriculation]));
  const usineNom = new Map((usines.data ?? []).map((u) => [u.id, u.nom]));

  const boutonRetour = (
    <Button variant="outline" icon={<ArrowLeft size={14} />} onClick={() => navigate(-1)}>
      Retour
    </Button>
  );

  if (enChargement) {
    return <Spinner className="mt-16" />;
  }

  if (erreur) {
    return (
      <div className="space-y-4">
        {boutonRetour}
        <ErrorMessage message={erreur instanceof Error ? erreur.message : String(erreur)} />
      </div>
    );
  }

  if (!facture) {
    return (
      <div className="space-y-4">
        {boutonRetour}
        <EmptyState
          icon={<Receipt size={40} />}
          title="Facture introuvable"
          description="Cette facture n'existe pas ou a été supprimée."
        />
      </div>
    );
  }

  return (
    <div>
      {/* ── Barre d'actions (non imprimée) ── */}
      <div className="no-print mb-4 flex items-center justify-between gap-3">
        {boutonRetour}
        <Button icon={<Printer size={14} />} onClick={() => window.print()}>
          Imprimer
        </Button>
      </div>

      <FactureDocument
        facture={facture}
        lignes={lignes.data ?? []}
        client={client}
        saisonLibelle={saisonLibelle}
        bordereauParId={bordereauParId}
        bsmParId={bsmParId}
        camionNom={camionNom}
        usineNom={usineNom}
        entreprise={parametres.data}
        tarifs={tarifs.data ?? []}
        lignesBordereauParBordereauId={lignesBordereauParBordereauId}
      />
    </div>
  );
}
