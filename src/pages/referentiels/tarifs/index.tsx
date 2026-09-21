import { useState } from 'react';
import { Plus, Pencil, Trash2, DollarSign } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import {
  Button, Input, Select, Modal, ConfirmDialog,
  PageHeader, EmptyState, Spinner, ErrorMessage,
} from '@/components/ui';
import {
  useSaisons,
  useTarifs, useCreerTarif, useModifierTarif, useSupprimerTarif,
} from '@/hooks';
import type { Tarif } from '@/types';
import {
  TYPES_FRET, UNITES_TARIF, labelTypeFret, labelUniteTarif, trancheDistance,
} from '@/utils';

// ─── Schéma ──────────────────────────────────────────────────────────────────
// Tranche du barème (CDC v1.1) : type de fret, unité de tarification et
// distance de fin optionnelle (vide = tranche ouverte « X km et plus »).
const schema = z
  .object({
    type_fret: z.enum(['direct', 'retour', 'evacuation', 'transfert']),
    unite_tarif: z.enum(['fcfa_tonne', 'fcfa_tkm']),
    distance_min: z.coerce.number({ invalid_type_error: 'Nombre requis' }).min(0, 'Doit être ≥ 0'),
    distance_max: z.number({ invalid_type_error: 'Nombre requis' })
      .positive('Doit être > 0')
      .optional(),
    tarif: z.coerce.number({ invalid_type_error: 'Nombre requis' }).positive('Doit être > 0'),
  })
  .refine((d) => d.distance_max === undefined || d.distance_max > d.distance_min, {
    message: 'La distance de fin doit être supérieure à la distance de début',
    path: ['distance_max'],
  });
type FormValues = z.infer<typeof schema>;

// ─── Formulaire ───────────────────────────────────────────────────────────────
interface TarifFormProps {
  defaultValues?: Partial<FormValues>;
  onSubmit: (v: FormValues) => Promise<void>;
  loading: boolean;
  error?: string | null;
  submitLabel: string;
  onCancel: () => void;
}

function TarifForm({ defaultValues, onSubmit, loading, error, submitLabel, onCancel }: TarifFormProps) {
  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  });
  const uniteTarif = watch('unite_tarif');

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Type de fret"
          required
          options={TYPES_FRET}
          error={errors.type_fret?.message}
          {...register('type_fret')}
        />
        <Select
          label="Unité de tarification"
          required
          options={UNITES_TARIF}
          error={errors.unite_tarif?.message}
          {...register('unite_tarif')}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Distance de début (km)"
          type="number"
          step="0.1"
          required
          error={errors.distance_min?.message}
          {...register('distance_min')}
        />
        <Input
          label="Distance de fin (km)"
          type="number"
          step="0.1"
          hint="Laisser vide pour une tranche ouverte (« et plus »)"
          error={errors.distance_max?.message}
          {...register('distance_max', {
            setValueAs: (v) => (v === '' || v == null ? undefined : Number(v)),
          })}
        />
      </div>
      <Input
        label={uniteTarif === 'fcfa_tonne' ? 'Tarif (FCFA / tonne)' : 'Tarif (FCFA / tonne-km)'}
        type="number"
        step="0.01"
        required
        error={errors.tarif?.message}
        {...register('tarif')}
      />
      {error && <ErrorMessage message={error} />}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" type="button" onClick={onCancel}>Annuler</Button>
        <Button type="submit" loading={loading}>{submitLabel}</Button>
      </div>
    </form>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function TarifsPage() {
  const { data: saisons = [], isLoading: loadingSaisons } = useSaisons();

  const [saisonId, setSaisonId] = useState<number | undefined>(undefined);

  const saisonActive = saisons.find((s) => s.id === saisonId);
  const estOuverte   = saisonActive?.statut === 'ouverte';

  const { data: tarifs = [], isLoading: loadingTarifs, error } = useTarifs(saisonId);
  const creer    = useCreerTarif();
  const modifier = useModifierTarif(saisonId);
  const supprimer = useSupprimerTarif(saisonId);

  const [showCreate, setShowCreate]       = useState(false);
  const [editing, setEditing]             = useState<Tarif | null>(null);
  const [deleting, setDeleting]           = useState<Tarif | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);

  async function handleCreate(values: FormValues) {
    if (!saisonId) return;
    setMutationError(null);
    try {
      await creer.mutateAsync({
        saison_id: saisonId,
        type_fret: values.type_fret,
        unite_tarif: values.unite_tarif,
        distance_min: values.distance_min,
        distance_max: values.distance_max ?? null,
        tarif: values.tarif,
      });
      setShowCreate(false);
    } catch (e: unknown) { setMutationError(e as string); }
  }

  async function handleEdit(values: FormValues) {
    if (!editing) return;
    setMutationError(null);
    try {
      await modifier.mutateAsync({
        id: editing.id,
        payload: {
          type_fret: values.type_fret,
          unite_tarif: values.unite_tarif,
          distance_min: values.distance_min,
          distance_max: values.distance_max ?? null,
          tarif: values.tarif,
        },
      });
      setEditing(null);
    } catch (e: unknown) { setMutationError(e as string); }
  }

  async function handleDelete() {
    if (!deleting) return;
    try {
      await supprimer.mutateAsync(deleting.id);
      setDeleting(null);
    } catch (e: unknown) { setMutationError(e as string); }
  }

  const saisonOptions = saisons.map((s) => ({
    value: s.id,
    label: `${s.libelle} (${s.statut === 'ouverte' ? 'ouverte' : 'clôturée'})`,
  }));

  return (
    <div>
      <PageHeader
        title="Tarifs"
        description="Définissez le barème par type de fret et par tranche de distance pour chaque campagne."
        actions={
          estOuverte && (
            <Button icon={<Plus size={15} />} onClick={() => { setMutationError(null); setShowCreate(true); }}>
              Nouveau tarif
            </Button>
          )
        }
      />

      {/* Sélecteur de saison */}
      <div className="mb-6 max-w-xs">
        {loadingSaisons ? (
          <Spinner label="Chargement des saisons..." />
        ) : (
          <Select
            label="Campagne"
            options={saisonOptions}
            placeholder="Sélectionner une campagne"
            value={saisonId ?? ''}
            onChange={(e) => setSaisonId(e.target.value ? Number(e.target.value) : undefined)}
          />
        )}
      </div>

      {/* Contenu */}
      {!saisonId ? (
        <EmptyState
          icon={<DollarSign size={40} />}
          title="Sélectionnez une campagne"
          description="Choisissez une campagne pour afficher et gérer ses tarifs."
        />
      ) : loadingTarifs ? (
        <Spinner className="mt-8" />
      ) : error ? (
        <ErrorMessage message="Impossible de charger les tarifs." />
      ) : tarifs.length === 0 ? (
        <EmptyState
          icon={<DollarSign size={40} />}
          title="Aucun tarif pour cette campagne"
          description={estOuverte ? 'Ajoutez la première tranche du barème.' : 'Campagne clôturée.'}
          action={
            estOuverte && (
              <Button size="sm" icon={<Plus size={14} />} onClick={() => setShowCreate(true)}>
                Nouveau tarif
              </Button>
            )
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type de fret</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Tranche de distance</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Unité</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Tarif</th>
                {estOuverte && <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tarifs.map((t) => (
                <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">{labelTypeFret(t.type_fret)}</td>
                  <td className="px-4 py-3">{trancheDistance(t.distance_min, t.distance_max)}</td>
                  <td className="px-4 py-3">{labelUniteTarif(t.unite_tarif)}</td>
                  <td className="px-4 py-3 font-medium">
                    {t.tarif.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
                  </td>
                  {estOuverte && (
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost" size="sm" icon={<Pencil size={13} />}
                          onClick={() => { setMutationError(null); setEditing(t); }}
                          title="Modifier"
                        >
                          Modifier
                        </Button>
                        <Button
                          variant="ghost" size="sm" icon={<Trash2 size={13} />}
                          onClick={() => setDeleting(t)}
                          title="Supprimer"
                          className="text-destructive hover:text-destructive"
                        >
                          Supprimer
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      <Modal open={showCreate} onClose={() => { setShowCreate(false); setMutationError(null); }} title="Nouveau tarif">
        <TarifForm
          defaultValues={{ type_fret: 'direct', unite_tarif: 'fcfa_tonne' }}
          onSubmit={handleCreate} loading={creer.isPending} error={mutationError}
          submitLabel="Créer le tarif" onCancel={() => { setShowCreate(false); setMutationError(null); }} />
      </Modal>

      <Modal open={!!editing} onClose={() => { setEditing(null); setMutationError(null); }} title="Modifier le tarif">
        {editing && (
          <TarifForm
            defaultValues={{
              type_fret: editing.type_fret,
              unite_tarif: editing.unite_tarif,
              distance_min: editing.distance_min,
              distance_max: editing.distance_max ?? undefined,
              tarif: editing.tarif,
            }}
            onSubmit={handleEdit} loading={modifier.isPending} error={mutationError}
            submitLabel="Enregistrer" onCancel={() => { setEditing(null); setMutationError(null); }} />
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleting} onClose={() => setDeleting(null)} onConfirm={handleDelete}
        title="Supprimer le tarif"
        message={deleting
          ? `Supprimer la tranche « ${labelTypeFret(deleting.type_fret)} — ${trancheDistance(deleting.distance_min, deleting.distance_max)} » ? Cette action est irréversible.`
          : ''}
        confirmLabel="Supprimer" loading={supprimer.isPending}
      />
    </div>
  );
}
