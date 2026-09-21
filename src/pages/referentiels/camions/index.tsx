import { useState } from 'react';
import { Plus, Pencil, PowerOff, Truck } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import {
  Button, Input, Badge, Modal, ConfirmDialog,
  PageHeader, EmptyState, Spinner, ErrorMessage,
} from '@/components/ui';
import {
  useCamions, useCreerCamion, useModifierCamion, useDesactiverCamion,
} from '@/hooks';
import type { Camion } from '@/types';

// ─── Schéma ──────────────────────────────────────────────────────────────────
const schema = z.object({
  immatriculation: z.string().min(1, "L'immatriculation est requise"),
  marque:          z.string().optional(),
  modele:          z.string().optional(),
  capacite_tonnes: z.coerce.number({ invalid_type_error: 'Nombre invalide' }).min(0).optional()
    .transform((v) => (v === 0 ? undefined : v)),
});
type FormValues = z.infer<typeof schema>;

// ─── Formulaire ───────────────────────────────────────────────────────────────
function CamionForm({
  defaultValues,
  onSubmit,
  loading,
  error,
  submitLabel,
  onCancel,
}: {
  defaultValues?: Partial<FormValues>;
  onSubmit: (v: FormValues) => Promise<void>;
  loading: boolean;
  error?: string | null;
  submitLabel: string;
  onCancel: () => void;
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <Input
        label="Immatriculation"
        placeholder="Ex : AB 1234 TD"
        required
        error={errors.immatriculation?.message}
        {...register('immatriculation')}
      />
      <div className="grid grid-cols-2 gap-4">
        <Input label="Marque" placeholder="Ex : Mercedes" {...register('marque')} />
        <Input label="Modèle" placeholder="Ex : Actros" {...register('modele')} />
      </div>
      <Input
        label="Capacité (tonnes)"
        type="number"
        step="0.1"
        placeholder="Ex : 30"
        error={errors.capacite_tonnes?.message}
        {...register('capacite_tonnes')}
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
export default function CamionsPage() {
  const { data: camions = [], isLoading, error } = useCamions();
  const creer     = useCreerCamion();
  const modifier  = useModifierCamion();
  const desactiver = useDesactiverCamion();

  const [showCreate, setShowCreate]       = useState(false);
  const [editing, setEditing]             = useState<Camion | null>(null);
  const [toggling, setToggling]           = useState<Camion | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);

  async function handleCreate(values: FormValues) {
    setMutationError(null);
    try {
      await creer.mutateAsync({
        immatriculation: values.immatriculation,
        marque:          values.marque || undefined,
        modele:          values.modele || undefined,
        capacite_tonnes: values.capacite_tonnes,
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
          immatriculation: values.immatriculation,
          marque:          values.marque || undefined,
          modele:          values.modele || undefined,
          capacite_tonnes: values.capacite_tonnes,
        },
      });
      setEditing(null);
    } catch (e: unknown) { setMutationError(e as string); }
  }

  async function handleToggle() {
    if (!toggling) return;
    try {
      await desactiver.mutateAsync(toggling.id);
      setToggling(null);
    } catch (e: unknown) { setMutationError(e as string); }
  }

  if (isLoading) return <Spinner className="mt-16" />;
  if (error)     return <ErrorMessage message="Impossible de charger les camions." className="mt-4" />;

  return (
    <div>
      <PageHeader
        title="Camions"
        description="Gérez le parc de camions. Un camion inactif ne peut pas être assigné à une mission."
        actions={
          <Button icon={<Plus size={15} />} onClick={() => { setMutationError(null); setShowCreate(true); }}>
            Nouveau camion
          </Button>
        }
      />

      {camions.length === 0 ? (
        <EmptyState
          icon={<Truck size={40} />}
          title="Aucun camion enregistré"
          description="Ajoutez le premier camion du parc."
          action={
            <Button size="sm" icon={<Plus size={14} />} onClick={() => setShowCreate(true)}>
              Nouveau camion
            </Button>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Immatriculation</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Marque / Modèle</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Capacité</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Statut</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {camions.map((c) => (
                <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-mono font-medium text-foreground">{c.immatriculation}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {[c.marque, c.modele].filter(Boolean).join(' ') || '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {c.capacite_tonnes ? `${c.capacite_tonnes} t` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {c.actif === 1
                      ? <Badge variant="success">Actif</Badge>
                      : <Badge variant="muted">Inactif</Badge>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost" size="sm" icon={<Pencil size={13} />}
                        onClick={() => { setMutationError(null); setEditing(c); }}
                        title="Modifier"
                      >
                        Modifier
                      </Button>
                      <Button
                        variant="ghost" size="sm" icon={<PowerOff size={13} />}
                        onClick={() => setToggling(c)}
                        title={c.actif === 1 ? 'Désactiver' : 'Réactiver'}
                        className={c.actif === 1 ? 'text-destructive hover:text-destructive' : ''}
                      >
                        {c.actif === 1 ? 'Désactiver' : 'Réactiver'}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={showCreate} onClose={() => { setShowCreate(false); setMutationError(null); }} title="Nouveau camion">
        <CamionForm onSubmit={handleCreate} loading={creer.isPending} error={mutationError}
          submitLabel="Créer le camion" onCancel={() => { setShowCreate(false); setMutationError(null); }} />
      </Modal>

      <Modal open={!!editing} onClose={() => { setEditing(null); setMutationError(null); }} title="Modifier le camion">
        {editing && (
          <CamionForm
            defaultValues={{
              immatriculation: editing.immatriculation,
              marque:          editing.marque,
              modele:          editing.modele,
              capacite_tonnes: editing.capacite_tonnes,
            }}
            onSubmit={handleEdit} loading={modifier.isPending} error={mutationError}
            submitLabel="Enregistrer" onCancel={() => { setEditing(null); setMutationError(null); }} />
        )}
      </Modal>

      <ConfirmDialog
        open={!!toggling} onClose={() => setToggling(null)} onConfirm={handleToggle}
        title={toggling?.actif === 1 ? 'Désactiver le camion' : 'Réactiver le camion'}
        message={
          toggling?.actif === 1
            ? `Désactiver le camion ${toggling?.immatriculation} ? Il ne pourra plus être assigné à de nouvelles missions.`
            : `Réactiver le camion ${toggling?.immatriculation} ?`
        }
        confirmLabel={toggling?.actif === 1 ? 'Désactiver' : 'Réactiver'}
        variant={toggling?.actif === 1 ? 'destructive' : 'primary'}
        loading={desactiver.isPending}
      />
    </div>
  );
}
