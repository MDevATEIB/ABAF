import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Fuel, Printer } from 'lucide-react';

import { Button, EmptyState, ErrorMessage, Spinner } from '@/components/ui';
import { useBsms, useCamions, useMissions, useParametres, useSaisons, useUsines } from '@/hooks';
import { BsmDocument } from '@/templates';
import { formatDate } from '@/utils';

/**
 * Aperçu et impression d'un BSM (AGENT.md §20.1) : le document HTML est affiché
 * en A4 et imprimé via la boîte de dialogue du système (impression ou PDF).
 */
export default function ImpressionBsmPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const bsmId = Number(id);

  const bsms = useBsms();
  const camions = useCamions();
  const usines = useUsines();
  const saisons = useSaisons();
  const missions = useMissions();
  const parametres = useParametres();

  const enChargement =
    bsms.isLoading ||
    camions.isLoading ||
    usines.isLoading ||
    saisons.isLoading ||
    missions.isLoading ||
    parametres.isLoading;
  const erreur =
    bsms.error ?? camions.error ?? usines.error ?? saisons.error ?? missions.error ?? parametres.error;

  const bsm = bsms.data?.find((b) => b.id === bsmId);
  const camionNom = bsm ? camions.data?.find((c) => c.id === bsm.camion_id)?.immatriculation : undefined;
  const usineNom = bsm?.usine_id ? usines.data?.find((u) => u.id === bsm.usine_id)?.nom : undefined;
  const saisonLibelle = bsm ? saisons.data?.find((s) => s.id === bsm.saison_id)?.libelle : undefined;
  const dateMission = bsm?.mission_id
    ? missions.data?.find((m) => m.id === bsm.mission_id)?.date_mission
    : undefined;

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

  if (!bsm) {
    return (
      <div className="space-y-4">
        {boutonRetour}
        <EmptyState
          icon={<Fuel size={40} />}
          title="BSM introuvable"
          description="Ce bon de sortie magasin n'existe pas ou a été supprimé."
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

      <BsmDocument
        bsm={bsm}
        camionNom={camionNom}
        usineNom={usineNom}
        missionRef={dateMission ? formatDate(dateMission) : undefined}
        saisonLibelle={saisonLibelle}
        entreprise={parametres.data}
      />
    </div>
  );
}
