import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Fuel, Save } from 'lucide-react';

import {
  Button, Input, Select, PageHeader, Spinner, ErrorMessage, EmptyState,
} from '@/components/ui';
import { useSaisons } from '@/hooks/useSaisons';
import { usePrixGasoil, useSetPrixGasoil } from '@/hooks/usePrixGasoil';
import { useState } from 'react';

const schema = z.object({
  prix_litre: z.coerce
    .number({ invalid_type_error: 'Nombre requis' })
    .min(0.01, 'Le prix doit être supérieur à 0'),
});
type FormValues = z.infer<typeof schema>;

export default function PrixGasoilPage() {
  const { data: saisons = [], isLoading: loadingSaisons } = useSaisons();
  const [saisonId, setSaisonId] = useState<number | undefined>(undefined);

  const saisonActive = saisons.find((s) => s.id === saisonId);
  const estOuverte   = saisonActive?.statut === 'ouverte';

  const { data: prixActuel, isLoading: loadingPrix } = usePrixGasoil(saisonId);
  const setPrix = useSetPrixGasoil();

  const [saved, setSaved]         = useState(false);
  const [mutationError, setError] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { errors, isDirty } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { prix_litre: 0 },
  });

  // Pré-remplir quand le prix existant est chargé
  useEffect(() => {
    if (prixActuel) reset({ prix_litre: prixActuel.prix_litre });
    else reset({ prix_litre: 0 });
  }, [prixActuel, reset]);

  async function onSubmit(values: FormValues) {
    if (!saisonId) return;
    setError(null);
    setSaved(false);
    try {
      await setPrix.mutateAsync({ saison_id: saisonId, prix_litre: values.prix_litre });
      setSaved(true);
      reset({ prix_litre: values.prix_litre });
    } catch (e: unknown) {
      setError(e as string);
    }
  }

  const saisonOptions = saisons.map((s) => ({
    value: s.id,
    label: `${s.libelle} (${s.statut === 'ouverte' ? 'ouverte' : 'clôturée'})`,
  }));

  return (
    <div>
      <PageHeader
        title="Prix du gasoil"
        description="Définissez le prix unitaire du gasoil pour chaque campagne. Ce prix est fixe pour toute la durée de la campagne."
      />

      <div className="max-w-md space-y-6">
        {/* Sélecteur saison */}
        {loadingSaisons ? (
          <Spinner label="Chargement des saisons..." />
        ) : (
          <Select
            label="Campagne"
            options={saisonOptions}
            placeholder="Sélectionner une campagne"
            value={saisonId ?? ''}
            onChange={(e) => {
              setSaisonId(e.target.value ? Number(e.target.value) : undefined);
              setSaved(false);
              setError(null);
            }}
          />
        )}

        {!saisonId ? (
          <EmptyState
            icon={<Fuel size={36} />}
            title="Sélectionnez une campagne"
            description="Choisissez une campagne pour gérer son prix de gasoil."
          />
        ) : loadingPrix ? (
          <Spinner className="mt-4" />
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Prix par litre (FCFA)"
              type="number"
              step="0.01"
              required
              disabled={!estOuverte}
              hint={
                !estOuverte
                  ? 'Cette campagne est clôturée, le prix ne peut plus être modifié.'
                  : prixActuel
                  ? 'Un prix est déjà défini. Enregistrez pour le mettre à jour.'
                  : 'Aucun prix défini pour cette campagne.'
              }
              error={errors.prix_litre?.message}
              {...register('prix_litre')}
            />

            {mutationError && <ErrorMessage message={mutationError} />}

            {saved && (
              <p className="text-sm font-medium text-green-600">
                Prix enregistré avec succès.
              </p>
            )}

            {estOuverte && (
              <Button
                type="submit"
                loading={setPrix.isPending}
                disabled={!isDirty && !!prixActuel}
                icon={<Save size={14} />}
              >
                {prixActuel ? 'Mettre à jour' : 'Définir le prix'}
              </Button>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
