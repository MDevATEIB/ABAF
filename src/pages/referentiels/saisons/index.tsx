import { useState } from 'react';
import { Plus, Pencil, Lock, CalendarRange } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import {
  Button, Input, Badge, Modal, ConfirmDialog,
  PageHeader, EmptyState, Spinner, ErrorMessage,
} from '@/components/ui';
import {
  useSaisons, useCreerSaison, useModifierSaison, useCloturerSaison,
} from '@/hooks';
import type { Saison } from '@/types';

// ─── Schéma de validation ─────────────────────────────────────────────────────
const schema = z.object({
  libelle:    z.string().min(1, 'Le libellé est requis'),
  date_debut: z.string().min(1, 'La date de début est requise'),
  date_fin:   z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function statutBadge(statut: string) {
  return statut === 'ouverte'
    ? <Badge variant="success">Ouverte</Badge>
    : <Badge variant="muted">Clôturée</Badge>;
}

function formatDate(d?: string) {
  if (!d) return '—';
  const [y, m, j] = d.split('-');
  return `${j}/${m}/${y}`;
}

// ─── Formulaire (création + modification) ─────────────────────────────────────
interface SaisonFormProps {
  defaultValues?: Partial<FormValues>;
  onSubmit: (values: FormValues) => Promise<void>;
  loading: boolean;
  error?: string | null;
  submitLabel: string;
  onCancel: () => void;
}

function SaisonForm({ defaultValues, onSubmit, loading, error, submitLabel, onCancel }: SaisonFormProps) {
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <Input
        label="Libellé"
        placeholder="Ex : Campagne 2025-2026"
        required
        error={errors.libelle?.message}
        {...register('libelle')}
      />
      <Input
        label="Date de début"
        type="date"
        required
        error={errors.date_debut?.message}
        {...register('date_debut')}
      />
      <Input
        label="Date de fin prévisionnelle"
        type="date"
        error={errors.date_fin?.message}
        {...register('date_fin')}
      />

      {error && <ErrorMessage message={error} />}

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" type="button" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit" loading={loading}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function SaisonsPage() {
  const { data: saisons = [], isLoading, error } = useSaisons();
  const creer    = useCreerSaison();
  const modifier = useModifierSaison();
  const cloturer = useCloturerSaison();

  const [showCreate, setShowCreate]       = useState(false);
  const [editing, setEditing]             = useState<Saison | null>(null);
  const [cloturant, setCloturant]         = useState<Saison | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);

  // ── Création ──────────────────────────────────────────────────────────────
  async function handleCreate(values: FormValues) {
    setMutationError(null);
    try {
      await creer.mutateAsync({
        libelle:    values.libelle,
        date_debut: values.date_debut,
        date_fin:   values.date_fin || undefined,
      });
      setShowCreate(false);
    } catch (e: unknown) {
      setMutationError(e as string);
    }
  }

  // ── Modification ──────────────────────────────────────────────────────────
  async function handleEdit(values: FormValues) {
    if (!editing) return;
    setMutationError(null);
    try {
      await modifier.mutateAsync({
        id: editing.id,
        payload: {
          libelle:    values.libelle,
          date_debut: values.date_debut,
          date_fin:   values.date_fin || undefined,
        },
      });
      setEditing(null);
    } catch (e: unknown) {
      setMutationError(e as string);
    }
  }

  // ── Clôture ───────────────────────────────────────────────────────────────
  async function handleCloturer() {
    if (!cloturant) return;
    try {
      await cloturer.mutateAsync(cloturant.id);
      setCloturant(null);
    } catch (e: unknown) {
      setMutationError(e as string);
    }
  }

  if (isLoading) return <Spinner className="mt-16" />;
  if (error)     return <ErrorMessage message="Impossible de charger les saisons." className="mt-4" />;

  return (
    <div>
      <PageHeader
        title="Saisons"
        description="Gérez les campagnes coton graine. Une seule saison peut être ouverte à la fois."
        actions={
          <Button icon={<Plus size={15} />} onClick={() => { setMutationError(null); setShowCreate(true); }}>
            Nouvelle saison
          </Button>
        }
      />

      {/* ── Tableau ─────────────────────────────────────────────────────── */}
      {saisons.length === 0 ? (
        <EmptyState
          icon={<CalendarRange size={40} />}
          title="Aucune saison enregistrée"
          description="Créez la première campagne pour commencer."
          action={
            <Button size="sm" icon={<Plus size={14} />} onClick={() => setShowCreate(true)}>
              Nouvelle saison
            </Button>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Libellé</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Début</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Fin</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Statut</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {saisons.map((s) => (
                <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{s.libelle}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(s.date_debut)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(s.date_fin)}</td>
                  <td className="px-4 py-3">{statutBadge(s.statut)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      {s.statut === 'ouverte' && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<Pencil size={13} />}
                            onClick={() => { setMutationError(null); setEditing(s); }}
                            title="Modifier"
                          >
                            Modifier
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            icon={<Lock size={13} />}
                            onClick={() => setCloturant(s)}
                            title="Clôturer"
                          >
                            Clôturer
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modal création ─────────────────────────────────────────────── */}
      <Modal
        open={showCreate}
        onClose={() => { setShowCreate(false); setMutationError(null); }}
        title="Nouvelle saison"
      >
        <SaisonForm
          onSubmit={handleCreate}
          loading={creer.isPending}
          error={mutationError}
          submitLabel="Créer la saison"
          onCancel={() => { setShowCreate(false); setMutationError(null); }}
        />
      </Modal>

      {/* ── Modal modification ─────────────────────────────────────────── */}
      <Modal
        open={!!editing}
        onClose={() => { setEditing(null); setMutationError(null); }}
        title="Modifier la saison"
      >
        {editing && (
          <SaisonForm
            defaultValues={{
              libelle:    editing.libelle,
              date_debut: editing.date_debut,
              date_fin:   editing.date_fin,
            }}
            onSubmit={handleEdit}
            loading={modifier.isPending}
            error={mutationError}
            submitLabel="Enregistrer"
            onCancel={() => { setEditing(null); setMutationError(null); }}
          />
        )}
      </Modal>

      {/* ── Dialog clôture ─────────────────────────────────────────────── */}
      <ConfirmDialog
        open={!!cloturant}
        onClose={() => setCloturant(null)}
        onConfirm={handleCloturer}
        title="Clôturer la saison"
        message={`Êtes-vous sûr de vouloir clôturer « ${cloturant?.libelle} » ? Cette action est irréversible.`}
        confirmLabel="Clôturer"
        loading={cloturer.isPending}
      />
    </div>
  );
}
