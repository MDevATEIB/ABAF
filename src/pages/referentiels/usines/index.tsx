import { useState } from 'react';
import { Plus, Pencil, Factory } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import {
  Button, Input, Modal, PageHeader, EmptyState, Spinner, ErrorMessage,
} from '@/components/ui';
import { useUsines, useCreerUsine, useModifierUsine } from '@/hooks';
import type { Usine } from '@/types';

// ─── Schéma ──────────────────────────────────────────────────────────────────
const schema = z.object({
  nom:      z.string().min(1, 'Le nom est requis'),
  localite: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

// ─── Formulaire ───────────────────────────────────────────────────────────────
function UsineForm({
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
        label="Nom de l'usine"
        placeholder="Ex : Usine de Moundou"
        required
        error={errors.nom?.message}
        {...register('nom')}
      />
      <Input
        label="Localité"
        placeholder="Ex : Moundou"
        {...register('localite')}
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
export default function UsinesPage() {
  const { data: usines = [], isLoading, error } = useUsines();
  const creer    = useCreerUsine();
  const modifier = useModifierUsine();

  const [showCreate, setShowCreate]       = useState(false);
  const [editing, setEditing]             = useState<Usine | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);

  async function handleCreate(values: FormValues) {
    setMutationError(null);
    try {
      await creer.mutateAsync({
        nom:      values.nom,
        localite: values.localite || undefined,
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
          nom:      values.nom,
          localite: values.localite || undefined,
        },
      });
      setEditing(null);
    } catch (e: unknown) { setMutationError(e as string); }
  }

  if (isLoading) return <Spinner className="mt-16" />;
  if (error)     return <ErrorMessage message="Impossible de charger les usines." className="mt-4" />;

  return (
    <div>
      <PageHeader
        title="Usines"
        description="Gérez les usines COTONTCHAD SN vers lesquelles le coton est livré."
        actions={
          <Button icon={<Plus size={15} />} onClick={() => { setMutationError(null); setShowCreate(true); }}>
            Nouvelle usine
          </Button>
        }
      />

      {usines.length === 0 ? (
        <EmptyState
          icon={<Factory size={40} />}
          title="Aucune usine enregistrée"
          description="Ajoutez la première usine."
          action={
            <Button size="sm" icon={<Plus size={14} />} onClick={() => setShowCreate(true)}>
              Nouvelle usine
            </Button>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Nom</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Localité</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {usines.map((u) => (
                <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{u.nom}</td>
                  <td className="px-4 py-3 text-muted-foreground">{u.localite || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <Button
                        variant="ghost" size="sm" icon={<Pencil size={13} />}
                        onClick={() => { setMutationError(null); setEditing(u); }}
                      >
                        Modifier
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={showCreate} onClose={() => { setShowCreate(false); setMutationError(null); }} title="Nouvelle usine">
        <UsineForm onSubmit={handleCreate} loading={creer.isPending} error={mutationError}
          submitLabel="Créer l'usine" onCancel={() => { setShowCreate(false); setMutationError(null); }} />
      </Modal>

      <Modal open={!!editing} onClose={() => { setEditing(null); setMutationError(null); }} title="Modifier l'usine">
        {editing && (
          <UsineForm
            defaultValues={{ nom: editing.nom, localite: editing.localite }}
            onSubmit={handleEdit} loading={modifier.isPending} error={mutationError}
            submitLabel="Enregistrer" onCancel={() => { setEditing(null); setMutationError(null); }} />
        )}
      </Modal>
    </div>
  );
}
