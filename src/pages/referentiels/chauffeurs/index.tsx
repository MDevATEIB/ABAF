import { useState } from 'react';
import { Plus, Pencil, PowerOff, User } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import {
  Button, Input, Badge, Modal, ConfirmDialog,
  PageHeader, EmptyState, Spinner, ErrorMessage,
} from '@/components/ui';
import {
  useChauffeurs, useCreerChauffeur, useModifierChauffeur, useDesactiverChauffeur,
} from '@/hooks';
import type { Chauffeur } from '@/types';

// ─── Schéma ──────────────────────────────────────────────────────────────────
const schema = z.object({
  nom:       z.string().min(1, 'Le nom est requis'),
  prenom:    z.string().optional(),
  telephone: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

// ─── Formulaire ───────────────────────────────────────────────────────────────
function ChauffeurForm({
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
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Nom"
          required
          error={errors.nom?.message}
          {...register('nom')}
        />
        <Input label="Prénom" {...register('prenom')} />
      </div>
      <Input
        label="Téléphone"
        type="tel"
        placeholder="Ex : +235 66 00 00 00"
        {...register('telephone')}
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
export default function ChauffeursPage() {
  const { data: chauffeurs = [], isLoading, error } = useChauffeurs();
  const creer      = useCreerChauffeur();
  const modifier   = useModifierChauffeur();
  const desactiver = useDesactiverChauffeur();

  const [showCreate, setShowCreate]       = useState(false);
  const [editing, setEditing]             = useState<Chauffeur | null>(null);
  const [toggling, setToggling]           = useState<Chauffeur | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);

  async function handleCreate(values: FormValues) {
    setMutationError(null);
    try {
      await creer.mutateAsync({
        nom:       values.nom,
        prenom:    values.prenom || undefined,
        telephone: values.telephone || undefined,
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
          nom:       values.nom,
          prenom:    values.prenom || undefined,
          telephone: values.telephone || undefined,
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
  if (error)     return <ErrorMessage message="Impossible de charger les chauffeurs." className="mt-4" />;

  return (
    <div>
      <PageHeader
        title="Chauffeurs"
        description="Gérez les chauffeurs. Un chauffeur inactif ne peut plus être assigné à une mission."
        actions={
          <Button icon={<Plus size={15} />} onClick={() => { setMutationError(null); setShowCreate(true); }}>
            Nouveau chauffeur
          </Button>
        }
      />

      {chauffeurs.length === 0 ? (
        <EmptyState
          icon={<User size={40} />}
          title="Aucun chauffeur enregistré"
          description="Ajoutez le premier chauffeur."
          action={
            <Button size="sm" icon={<Plus size={14} />} onClick={() => setShowCreate(true)}>
              Nouveau chauffeur
            </Button>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Nom</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Prénom</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Téléphone</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Statut</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {chauffeurs.map((c) => (
                <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{c.nom}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.prenom || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.telephone || '—'}</td>
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

      <Modal open={showCreate} onClose={() => { setShowCreate(false); setMutationError(null); }} title="Nouveau chauffeur">
        <ChauffeurForm onSubmit={handleCreate} loading={creer.isPending} error={mutationError}
          submitLabel="Créer le chauffeur" onCancel={() => { setShowCreate(false); setMutationError(null); }} />
      </Modal>

      <Modal open={!!editing} onClose={() => { setEditing(null); setMutationError(null); }} title="Modifier le chauffeur">
        {editing && (
          <ChauffeurForm
            defaultValues={{ nom: editing.nom, prenom: editing.prenom, telephone: editing.telephone }}
            onSubmit={handleEdit} loading={modifier.isPending} error={mutationError}
            submitLabel="Enregistrer" onCancel={() => { setEditing(null); setMutationError(null); }} />
        )}
      </Modal>

      <ConfirmDialog
        open={!!toggling} onClose={() => setToggling(null)} onConfirm={handleToggle}
        title={toggling?.actif === 1 ? 'Désactiver le chauffeur' : 'Réactiver le chauffeur'}
        message={
          toggling?.actif === 1
            ? `Désactiver ${toggling?.nom}${toggling?.prenom ? ' ' + toggling.prenom : ''} ?`
            : `Réactiver ${toggling?.nom}${toggling?.prenom ? ' ' + toggling.prenom : ''} ?`
        }
        confirmLabel={toggling?.actif === 1 ? 'Désactiver' : 'Réactiver'}
        variant={toggling?.actif === 1 ? 'destructive' : 'primary'}
        loading={desactiver.isPending}
      />
    </div>
  );
}
