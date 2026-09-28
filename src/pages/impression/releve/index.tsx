import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FileBarChart, Printer } from 'lucide-react';

import { Button, EmptyState, ErrorMessage, Spinner } from '@/components/ui';
import { useParametres, useRecapitulatif, useSaisons } from '@/hooks';
import { ReleveDocument } from '@/templates';

/**
 * Aperçu et impression du Relevé / Récapitulatif de campagne.
 * Document listant l'ensemble des bordereaux avec totaux transport et
 * finances, similaire au modèle Relevé facture.
 */
export default function ImpressionRelevePage() {
  const { saisonId } = useParams<{ saisonId?: string }>();
  const navigate = useNavigate();
  const filtreSaisonId = saisonId ? Number(saisonId) || undefined : undefined;

  const saisons = useSaisons();
  const parametres = useParametres();
  const { data: recap, isLoading, error } = useRecapitulatif(filtreSaisonId);

  const enChargement = saisons.isLoading || parametres.isLoading || isLoading;
  const erreur =
    saisons.error ?? parametres.error ?? error
      ? (saisons.error ?? parametres.error ?? error)
      : null;

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

  if (!recap || recap.lignes.length === 0) {
    return (
      <div className="space-y-4">
        {boutonRetour}
        <EmptyState
          icon={<FileBarChart size={40} />}
          title="Aucune donnée pour cette campagne"
          description="Le relevé ne peut pas être généré : aucun bordereau n'a été enregistré pour la campagne sélectionnée."
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

      <ReleveDocument recap={recap} entreprise={parametres.data} />
    </div>
  );
}
