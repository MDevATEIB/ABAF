import { useState } from 'react';
import { Plus, Pencil, Users } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import {
  Button, Input, Select, Modal, PageHeader, EmptyState, Spinner, ErrorMessage,
} from '@/components/ui';
import { useUsines } from '@/hooks/useUsines';
import { useCgis } from '@/hooks/useCgis';
import { useAvs, useCreerAv, useModifierAv } from '@/hooks/useAvs';
import type { AV } from '@/types';

// ─── Schéma ──────────────────────────────────────────────────────────────────
const schema = z.object({
  nom:      z.string().min(1, 'Le nom est requis'),
  cgi_id:   z.coerce.number().optional()
    .transform((v) => (v === 0 ? undefined : v)),
  localite: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

// ─── Formulaire ───────────────────────────────────────────────────────────────
function AvForm({
  defaultValues,
  onSubmit,
  loading,
  error,
  submitLabel,
  onCancel,
  cgiOptions,
}: {
  defaultValues?: Partial<FormValues>;
  onSubmit: (v: FormValues) => Promise<void>;
  loading: boolean;
  error?: string | null;
  submitLabel: string;
  onCancel: () => void;
  cgiOptions: { value: number; label: string }[];
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <Input
        label="Nom de l'AV"
        placeholder="Ex : AV Koumra"
        required
        error={errors.nom?.message}
        {...register('nom')}
      />
      <Select
        label="CGI (optionnel)"
        placeholder="— Aucun CGI —"
        options={cgiOptions}
        error={errors.cgi_id?.message}
        {...register('cgi_id')}
      />
      <Input
        label="Localité"
        placeholder="Ex : Koumra"
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
export default function AvsPage() {
  // Filtres en cascade : Usine → CGI → AV
  const { data: usines = [], isLoading: loadingUsines } = useUsines();
  const [filtreUsineId, setFiltreUsineId] = useState<number | undefined>(undefined);

  const { data: cgis = [], isLoading: loadingCgis } = useCgis(filtreUsineId);
  const [filtreCgiId, setFiltreCgiId] = useState<number | undefined>(undefined);

  const { data: avs = [], isLoading: loadingAvs, error } = useAvs(filtreCgiId);
  const creer    = useCreerAv();
  const modifier = useModifierAv();

  const [showCreate, setShowCreate]       = useState(false);
  const [editing, setEditing]             = useState<AV | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const usineOptions = usines.map((u) => ({ value: u.id, label: u.nom }));
  const cgiOptions   = cgis.map((c) => ({ value: c.id, label: c.nom }));
  const cgiMap       = Object.fromEntries(cgis.map((c) => [c.id, c.nom]));

  function handleFiltreUsine(id: number | undefined) {
    setFiltreUsineId(id);
    setFiltreCgiId(undefined); // reset filtre CGI quand on change d'usine
  }

  async function handleCreate(values: FormValues) {
    setMutationError(null);
    try {
      await creer.mutateAsync({
        nom:      values.nom,
        cgi_id:   values.cgi_id,
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
          cgi_id:   values.cgi_id,
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
        title="AV – Agents Villageois"
        description="Gérez les Agents Villageois. Utilisez les filtres pour naviguer par usine et par CGI."
        actions={
          <Button icon={<Plus size={15} />} onClick={() => { setMutationError(null); setShowCreate(true); }}>
            Nouvel AV
          </Button>
        }
      />

      {/* Filtres en cascade */}
      <div className="mb-6 grid grid-cols-2 gap-4 max-w-lg">
        <Select
          label="Filtrer par usine"
          options={[{ value: 0, label: 'Toutes les usines' }, ...usineOptions]}
          value={filtreUsineId ?? 0}
          onChange={(e) => handleFiltreUsine(Number(e.target.value) || undefined)}
        />
        <Select
          label="Filtrer par CGI"
          options={[
            { value: 0, label: loadingCgis ? 'Chargement...' : 'Tous les CGI' },
            ...cgiOptions,
          ]}
          value={filtreCgiId ?? 0}
          disabled={!filtreUsineId || loadingCgis}
          onChange={(e) => setFiltreCgiId(Number(e.target.value) || undefined)}
        />
      </div>

      {loadingAvs ? (
        <Spinner className="mt-8" />
      ) : error ? (
        <ErrorMessage message="Impossible de charger les AV." />
      ) : avs.length === 0 ? (
        <EmptyState
          icon={<Users size={40} />}
          title="Aucun AV enregistré"
          description="Ajoutez le premier Agent Villageois."
          action={
            <Button size="sm" icon={<Plus size={14} />} onClick={() => setShowCreate(true)}>
              Nouvel AV
            </Button>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Nom</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">CGI</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Localité</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {avs.map((a) => (
                <tr key={a.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{a.nom}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {a.cgi_id ? (cgiMap[a.cgi_id] ?? `CGI #${a.cgi_id}`) : '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{a.localite || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <Button
                        variant="ghost" size="sm" icon={<Pencil size={13} />}
                        onClick={() => { setMutationError(null); setEditing(a); }}
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

      <Modal open={showCreate} onClose={() => { setShowCreate(false); setMutationError(null); }} title="Nouvel AV">
        <AvForm
          onSubmit={handleCreate} loading={creer.isPending} error={mutationError}
          submitLabel="Créer l'AV" onCancel={() => { setShowCreate(false); setMutationError(null); }}
          cgiOptions={cgiOptions}
          defaultValues={{ cgi_id: filtreCgiId }}
        />
      </Modal>

      <Modal open={!!editing} onClose={() => { setEditing(null); setMutationError(null); }} title="Modifier l'AV">
        {editing && (
          <AvForm
            defaultValues={{ nom: editing.nom, cgi_id: editing.cgi_id, localite: editing.localite }}
            onSubmit={handleEdit} loading={modifier.isPending} error={mutationError}
            submitLabel="Enregistrer" onCancel={() => { setEditing(null); setMutationError(null); }}
            cgiOptions={cgiOptions}
          />
        )}
      </Modal>
    </div>
  );
}
