import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Printer, Receipt } from 'lucide-react';

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
  useUsines,
} from '@/hooks';
import { FactureDocument } from '@/templates';

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

  const enChargement =
    factures.isLoading ||
    clients.isLoading ||
    bordereaux.isLoading ||
    bsms.isLoading ||
    camions.isLoading ||
    usines.isLoading ||
    saisons.isLoading ||
    lignes.isLoading ||
    parametres.isLoading;
  const erreur =
    factures.error ??
    clients.error ??
    bordereaux.error ??
    bsms.error ??
    camions.error ??
    usines.error ??
    saisons.error ??
    lignes.error ??
    parametres.error;

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
      />
    </div>
  );
}
