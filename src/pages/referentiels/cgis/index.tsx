import { useState } from 'react';
import { Plus, Pencil, MapPin } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import {
  Button, Input, Select, Modal, PageHeader, EmptyState, Spinner, ErrorMessage,
} from '@/components/ui';
import { useUsines } from '@/hooks/useUsines';
import { useCgis, useCreerCgi, useModifierCgi } from '@/hooks/useCgis';
import type { CGI } from '@/types';

// ─── Schéma ──────────────────────────────────────────────────────────────────
const schema = z.object({
  nom:      z.string().min(1, 'Le nom est requis'),
  usine_id: z.coerce.number({ invalid_type_error: "L'usine est requise" }).min(1, "L'usine est requise"),
  localite: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

// ─── Formulaire ───────────────────────────────────────────────────────────────
function CgiForm({
  defaultValues,
  onSubmit,
  loading,
  error,
  submitLabel,
  onCancel,
  usineOptions,
}: {
  defaultValues?: Partial<FormValues>;
  onSubmit: (v: FormValues) => Promise<void>;
  loading: boolean;
  error?: string | null;
  submitLabel: string;
  onCancel: () => void;
  usineOptions: { value: number; label: string }[];
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <Input
        label="Nom du CGI"
        placeholder="Ex : CGI de Bénoye"
        required
        error={errors.nom?.message}
        {...register('nom')}
      />
      <Select
        label="Usine"
        required
        placeholder="Sélectionner une usine"
        options={usineOptions}
        error={errors.usine_id?.message}
        {...register('usine_id')}
      />
      <Input
        label="Localité"
        placeholder="Ex : Bénoye"
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
export default function CgisPage() {
  const { data: usines = [], isLoading: loadingUsines } = useUsines();
  const [filtreUsineId, setFiltreUsineId] = useState<number | undefined>(undefined);

  const { data: cgis = [], isLoading: loadingCgis, error } = useCgis(filtreUsineId);
  const creer    = useCreerCgi();
  const modifier = useModifierCgi();

  const [showCreate, setShowCreate]       = useState(false);
  const [editing, setEditing]             = useState<CGI | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const usineOptions = usines.map((u) => ({ value: u.id, label: u.nom }));
  const filtreOptions = [{ value: 0, label: 'Toutes les usines' }, ...usineOptions];

  // Retrouver le nom d'usine pour l'affichage dans le tableau
  const usineMap = Object.fromEntries(usines.map((u) => [u.id, u.nom]));

  async function handleCreate(values: FormValues) {
    setMutationError(null);
    try {
      await creer.mutateAsync({
        nom:      values.nom,
        usine_id: values.usine_id,
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
          usine_id: values.usine_id,
          localite: values.localite || undefined,
        },
      });
      setEditing(null);
    } catch (e: unknown) { setMutationError(e as string); }
  }

  if (loadingUsines) return <Spinner className="mt-16" />;

  return (
    <div>
      <PageHeader
        title="CGI – Centres de Gestion Intégrés"
        description="Gérez les CGI rattachés aux usines. Le nom doit être unique par usine."
        actions={
          <Button icon={<Plus size={15} />} onClick={() => { setMutationError(null); setShowCreate(true); }}>
            Nouveau CGI
          </Button>
        }
      />

      {/* Filtre usine */}
      <div className="mb-6 max-w-xs">
        <Select
          label="Filtrer par usine"
          options={filtreOptions}
          value={filtreUsineId ?? 0}
          onChange={(e) => setFiltreUsineId(Number(e.target.value) || undefined)}
        />
      </div>

      {loadingCgis ? (
        <Spinner className="mt-8" />
      ) : error ? (
        <ErrorMessage message="Impossible de charger les CGI." />
      ) : cgis.length === 0 ? (
        <EmptyState
          icon={<MapPin size={40} />}
          title="Aucun CGI enregistré"
          description={filtreUsineId ? 'Aucun CGI pour cette usine.' : 'Ajoutez le premier CGI.'}
          action={
            <Button size="sm" icon={<Plus size={14} />} onClick={() => setShowCreate(true)}>
              Nouveau CGI
            </Button>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Nom</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Usine</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Localité</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {cgis.map((c) => (
                <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{c.nom}</td>
                  <td className="px-4 py-3 text-muted-foreground">{usineMap[c.usine_id] ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.localite || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <Button
                        variant="ghost" size="sm" icon={<Pencil size={13} />}
                        onClick={() => { setMutationError(null); setEditing(c); }}
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

      <Modal open={showCreate} onClose={() => { setShowCreate(false); setMutationError(null); }} title="Nouveau CGI">
        <CgiForm
          onSubmit={handleCreate} loading={creer.isPending} error={mutationError}
          submitLabel="Créer le CGI" onCancel={() => { setShowCreate(false); setMutationError(null); }}
          usineOptions={usineOptions}
          defaultValues={{ usine_id: filtreUsineId }}
        />
      </Modal>

      <Modal open={!!editing} onClose={() => { setEditing(null); setMutationError(null); }} title="Modifier le CGI">
        {editing && (
          <CgiForm
            defaultValues={{ nom: editing.nom, usine_id: editing.usine_id, localite: editing.localite }}
            onSubmit={handleEdit} loading={modifier.isPending} error={mutationError}
            submitLabel="Enregistrer" onCancel={() => { setEditing(null); setMutationError(null); }}
            usineOptions={usineOptions}
          />
        )}
      </Modal>
    </div>
  );
}
