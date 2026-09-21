import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FileText, Printer } from 'lucide-react';

import { Button, EmptyState, ErrorMessage, Spinner } from '@/components/ui';
import {
  useAvs,
  useBordereaux,
  useCamions,
  useChauffeurs,
  useCgis,
  useLignesBordereau,
  useMissions,
  useSaisons,
  useUsines,
} from '@/hooks';
import { BordereauDocument } from '@/templates';
import { formatDate } from '@/utils';

/**
 * Aperçu et impression d'un bordereau de transport et de livraison
 * (AGENT.md §20.2) : le document HTML est affiché en A4 et imprimé via la
 * boîte de dialogue du système (impression ou PDF).
 */
export default function ImpressionBordereauPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const bordereauId = Number(id);

  const bordereaux = useBordereaux();
  const camions = useCamions();
  const chauffeurs = useChauffeurs();
  const usines = useUsines();
  const cgis = useCgis();
  const avs = useAvs();
  const saisons = useSaisons();
  const missions = useMissions();

  const bordereau = bordereaux.data?.find((b) => b.id === bordereauId);
  const lignes = useLignesBordereau(bordereau?.id);

  const enChargement =
    bordereaux.isLoading ||
    camions.isLoading ||
    chauffeurs.isLoading ||
    usines.isLoading ||
    cgis.isLoading ||
    avs.isLoading ||
    saisons.isLoading ||
    missions.isLoading ||
    lignes.isLoading;
  const erreur =
    bordereaux.error ??
    camions.error ??
    chauffeurs.error ??
    usines.error ??
    cgis.error ??
    avs.error ??
    saisons.error ??
    missions.error ??
    lignes.error;

  const camionNom = bordereau
    ? camions.data?.find((c) => c.id === bordereau.camion_id)?.immatriculation
    : undefined;
  const chauffeur = bordereau?.chauffeur_id
    ? chauffeurs.data?.find((c) => c.id === bordereau.chauffeur_id)
    : undefined;
  const chauffeurNom = chauffeur
    ? `${chauffeur.nom}${chauffeur.prenom ? ` ${chauffeur.prenom}` : ''}`
    : undefined;
  const usineNom = bordereau?.usine_id
    ? usines.data?.find((u) => u.id === bordereau.usine_id)?.nom
    : undefined;
  const cgiNom = bordereau?.cgi_id ? cgis.data?.find((c) => c.id === bordereau.cgi_id)?.nom : undefined;
  const saisonLibelle = bordereau
    ? saisons.data?.find((s) => s.id === bordereau.saison_id)?.libelle
    : undefined;
  const dateMission = bordereau?.mission_id
    ? missions.data?.find((m) => m.id === bordereau.mission_id)?.date_mission
    : undefined;
  const avNom = new Map((avs.data ?? []).map((av) => [av.id, av.nom]));

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

  if (!bordereau) {
    return (
      <div className="space-y-4">
        {boutonRetour}
        <EmptyState
          icon={<FileText size={40} />}
          title="Bordereau introuvable"
          description="Ce bordereau n'existe pas ou a été supprimé."
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

      <BordereauDocument
        bordereau={bordereau}
        lignes={lignes.data ?? []}
        camionNom={camionNom}
        chauffeurNom={chauffeurNom}
        usineNom={usineNom}
        cgiNom={cgiNom}
        missionRef={dateMission ? formatDate(dateMission) : undefined}
        saisonLibelle={saisonLibelle}
        avNom={avNom}
      />
    </div>
  );
}
