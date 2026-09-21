import { useMemo, useState } from 'react';
import { Plus, Pencil, ChevronLeft, ChevronRight, Route } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import {
  Button, Input, Select, Badge, Modal,
  PageHeader, EmptyState, Spinner, ErrorMessage,
} from '@/components/ui';
import {
  useMissions, useCreerMission, useModifierMission, useChangerStatutMission,
  useSaisons, useCamions, useChauffeurs, useUsines, useCgis, useAvs,
} from '@/hooks';
import type {
  AV, CGI, Camion, Chauffeur, Mission, Saison, StatutMission, Usine,
} from '@/types';
import {
  ORDRE_STATUTS_MISSION, STATUTS_MISSION, formatDate,
  labelStatutMission, varianteStatutMission,
} from '@/utils';

// ─── Schéma de validation ─────────────────────────────────────────────────────
const schema = z.object({
  saison_id:    z.coerce.number({ invalid_type_error: 'La campagne est requise' }).min(1, 'La campagne est requise'),
  date_mission: z.string().min(1, 'La date est requise'),
  camion_id:    z.coerce.number({ invalid_type_error: 'Le camion est requis' }).min(1, 'Le camion est requis'),
  chauffeur_id: z.coerce.number().optional().transform((v) => (v ? v : undefined)),
  usine_id:     z.coerce.number().optional().transform((v) => (v ? v : undefined)),
  cgi_id:       z.coerce.number().optional().transform((v) => (v ? v : undefined)),
  av_id:        z.coerce.number().optional().transform((v) => (v ? v : undefined)),
  observations: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

// ─── Formulaire (création + modification) ─────────────────────────────────────
interface MissionFormProps {
  defaultValues: Partial<FormValues>;
  onSubmit: (values: FormValues) => Promise<void>;
  loading: boolean;
  error?: string | null;
  submitLabel: string;
  onCancel: () => void;
  isEdit?: boolean;
  saisons: Saison[];
  camions: Camion[];
  chauffeurs: Chauffeur[];
  usines: Usine[];
  cgis: CGI[];
  avs: AV[];
}

function MissionForm({
  defaultValues, onSubmit, loading, error, submitLabel, onCancel, isEdit = false,
  saisons, camions, chauffeurs, usines, cgis, avs,
}: MissionFormProps) {
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  // Cascade Usine → CGI → AV
  const usineId = Number(watch('usine_id')) || 0;
  const cgiId   = Number(watch('cgi_id')) || 0;

  const saisonOptions = [
    { value: 0, label: '— Sélectionner —' },
    ...saisons.map((s) => ({ value: s.id, label: s.libelle })),
  ];
  const camionOptions = [
    { value: 0, label: '— Sélectionner —' },
    ...camions
      .filter((c) => c.actif === 1 || c.id === defaultValues.camion_id)
      .map((c) => ({ value: c.id, label: c.immatriculation })),
  ];
  const chauffeurOptions = [
    { value: 0, label: '— Aucun —' },
    ...chauffeurs
      .filter((c) => c.actif === 1 || c.id === defaultValues.chauffeur_id)
      .map((c) => ({ value: c.id, label: `${c.nom}${c.prenom ? ` ${c.prenom}` : ''}` })),
  ];
  const usineOptions = [
    { value: 0, label: '— Aucune —' },
    ...usines.map((u) => ({ value: u.id, label: u.nom })),
  ];
  const cgiOptions = [
    { value: 0, label: '— Aucun —' },
    ...cgis
      .filter((c) => !usineId || c.usine_id === usineId)
      .map((c) => ({ value: c.id, label: c.nom })),
  ];
  const avOptions = [
    { value: 0, label: '— Aucun —' },
    ...avs
      .filter((a) => !cgiId || a.cgi_id === cgiId)
      .map((a) => ({ value: a.id, label: a.nom })),
  ];

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Campagne"
          required
          disabled={isEdit}
          options={saisonOptions}
          error={errors.saison_id?.message}
          {...register('saison_id')}
        />
        <Input
          label="Date de la mission"
          type="date"
          required
          error={errors.date_mission?.message}
          {...register('date_mission')}
        />
        <Select
          label="Camion"
          required
          options={camionOptions}
          error={errors.camion_id?.message}
          {...register('camion_id')}
        />
        <Select
          label="Chauffeur"
          options={chauffeurOptions}
          error={errors.chauffeur_id?.message}
          {...register('chauffeur_id')}
        />
        <Select
          label="Usine"
          options={usineOptions}
          error={errors.usine_id?.message}
          {...register('usine_id', {
            onChange: () => { setValue('cgi_id', 0); setValue('av_id', 0); },
          })}
        />
        <Select
          label="CGI"
          options={cgiOptions}
          error={errors.cgi_id?.message}
          {...register('cgi_id', {
            onChange: () => { setValue('av_id', 0); },
          })}
        />
        <Select
          label="AV (Agent villageois)"
          options={avOptions}
          error={errors.av_id?.message}
          {...register('av_id')}
        />
      </div>
      <Input
        label="Observations"
        placeholder="Remarques éventuelles…"
        {...register('observations')}
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
export default function MissionsPage() {
  const [filtreSaisonId, setFiltreSaisonId] = useState<number | undefined>(undefined);
  const [filtreStatut, setFiltreStatut]     = useState<StatutMission | undefined>(undefined);

  const { data: missions = [], isLoading, error } = useMissions(filtreSaisonId, filtreStatut);
  const { data: saisons = [] }    = useSaisons();
  const { data: camions = [] }    = useCamions();
  const { data: chauffeurs = [] } = useChauffeurs();
  const { data: usines = [] }     = useUsines();
  const { data: cgis = [] }       = useCgis();
  const { data: avs = [] }        = useAvs();

  const creer         = useCreerMission();
  const modifier      = useModifierMission();
  const changerStatut = useChangerStatutMission();

  const [showCreate, setShowCreate]       = useState(false);
  const [editing, setEditing]             = useState<Mission | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [actionError, setActionError]     = useState<string | null>(null);

  // Correspondances id → libellé pour l'affichage du tableau
  const saisonMap    = useMemo(() => new Map(saisons.map((s) => [s.id, s.libelle])), [saisons]);
  const camionMap    = useMemo(() => new Map(camions.map((c) => [c.id, c.immatriculation])), [camions]);
  const chauffeurMap = useMemo(
    () => new Map(chauffeurs.map((c) => [c.id, `${c.nom}${c.prenom ? ` ${c.prenom}` : ''}`])),
    [chauffeurs],
  );
  const usineMap = useMemo(() => new Map(usines.map((u) => [u.id, u.nom])), [usines]);
  const cgiMap   = useMemo(() => new Map(cgis.map((c) => [c.id, c.nom])), [cgis]);
  const avMap    = useMemo(() => new Map(avs.map((a) => [a.id, a.nom])), [avs]);

  const saisonOuverte = saisons.find((s) => s.statut === 'ouverte');

  // ── Création ──────────────────────────────────────────────────────────────
  async function handleCreate(values: FormValues) {
    setMutationError(null);
    try {
      await creer.mutateAsync({
        saison_id:    values.saison_id,
        camion_id:    values.camion_id,
        chauffeur_id: values.chauffeur_id,
        usine_id:     values.usine_id,
        cgi_id:       values.cgi_id,
        av_id:        values.av_id,
        date_mission: values.date_mission,
        observations: values.observations || undefined,
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
          camion_id:    values.camion_id,
          chauffeur_id: values.chauffeur_id,
          usine_id:     values.usine_id,
          cgi_id:       values.cgi_id,
          av_id:        values.av_id,
          date_mission: values.date_mission,
          observations: values.observations || undefined,
        },
      });
      setEditing(null);
    } catch (e: unknown) {
      setMutationError(e as string);
    }
  }

  // ── Changement de statut (une seule étape à la fois) ──────────────────────
  async function handleChangerStatut(mission: Mission, statut: StatutMission) {
    setActionError(null);
    try {
      await changerStatut.mutateAsync({ id: mission.id, statut });
    } catch (e: unknown) {
      setActionError(e as string);
    }
  }

  if (isLoading) return <Spinner className="mt-16" />;
  if (error)     return <ErrorMessage message="Impossible de charger les missions." className="mt-4" />;

  return (
    <div>
      <PageHeader
        title="Missions"
        description="Suivez le parcours complet de chaque camion, de l'arrivée à l'usine jusqu'à la clôture de la mission."
        actions={
          <Button icon={<Plus size={15} />} onClick={() => { setMutationError(null); setShowCreate(true); }}>
            Nouvelle mission
          </Button>
        }
      />

      {/* ── Filtres ─────────────────────────────────────────────────────── */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Select
          label="Campagne"
          options={[
            { value: 0, label: 'Toutes les campagnes' },
            ...saisons.map((s) => ({ value: s.id, label: s.libelle })),
          ]}
          value={filtreSaisonId ?? 0}
          onChange={(e) => setFiltreSaisonId(Number(e.target.value) || undefined)}
          className="w-56"
        />
        <Select
          label="Statut"
          options={[{ value: '', label: 'Tous les statuts' }, ...STATUTS_MISSION]}
          value={filtreStatut ?? ''}
          onChange={(e) => setFiltreStatut((e.target.value || undefined) as StatutMission | undefined)}
          className="w-56"
        />
      </div>

      {actionError && <ErrorMessage message={actionError} className="mb-4" />}

      {/* ── Tableau ─────────────────────────────────────────────────────── */}
      {missions.length === 0 ? (
        <EmptyState
          icon={<Route size={40} />}
          title="Aucune mission enregistrée"
          description="Créez la première mission pour démarrer le suivi des camions."
          action={
            <Button size="sm" icon={<Plus size={14} />} onClick={() => setShowCreate(true)}>
              Nouvelle mission
            </Button>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Camion</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Chauffeur</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Campagne</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Usine</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">CGI</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">AV</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Statut</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {missions.map((m) => {
                const idx       = ORDRE_STATUTS_MISSION.indexOf(m.statut);
                const precedent = idx > 0 ? ORDRE_STATUTS_MISSION[idx - 1] : null;
                const suivant   = idx >= 0 && idx < ORDRE_STATUTS_MISSION.length - 1 ? ORDRE_STATUTS_MISSION[idx + 1] : null;

                return (
                  <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(m.date_mission)}</td>
                    <td className="px-4 py-3 font-medium text-foreground">
                      {camionMap.get(m.camion_id) ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {m.chauffeur_id ? chauffeurMap.get(m.chauffeur_id) ?? '—' : '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{saisonMap.get(m.saison_id) ?? '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {m.usine_id ? usineMap.get(m.usine_id) ?? '—' : '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {m.cgi_id ? cgiMap.get(m.cgi_id) ?? '—' : '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {m.av_id ? avMap.get(m.av_id) ?? '—' : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={varianteStatutMission(m.statut)}>{labelStatutMission(m.statut)}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {precedent && (
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<ChevronLeft size={14} />}
                            title={`Reculer vers « ${labelStatutMission(precedent)} »`}
                            aria-label={`Reculer vers « ${labelStatutMission(precedent)} »`}
                            disabled={changerStatut.isPending}
                            onClick={() => handleChangerStatut(m, precedent)}
                          />
                        )}
                        {suivant && (
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<ChevronRight size={14} />}
                            title={`Avancer vers « ${labelStatutMission(suivant)} »`}
                            aria-label={`Avancer vers « ${labelStatutMission(suivant)} »`}
                            disabled={changerStatut.isPending}
                            onClick={() => handleChangerStatut(m, suivant)}
                          />
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Pencil size={13} />}
                          title="Modifier"
                          onClick={() => { setMutationError(null); setEditing(m); }}
                        >
                          Modifier
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modal création ─────────────────────────────────────────────── */}
      <Modal
        open={showCreate}
        onClose={() => { setShowCreate(false); setMutationError(null); }}
        title="Nouvelle mission"
        size="lg"
      >
        <MissionForm
          defaultValues={{
            saison_id:    saisonOuverte?.id ?? 0,
            date_mission: new Date().toISOString().slice(0, 10),
            camion_id:    0,
            chauffeur_id: 0,
            usine_id:     0,
            cgi_id:       0,
            av_id:        0,
          }}
          onSubmit={handleCreate}
          loading={creer.isPending}
          error={mutationError}
          submitLabel="Créer la mission"
          onCancel={() => { setShowCreate(false); setMutationError(null); }}
          saisons={saisons}
          camions={camions}
          chauffeurs={chauffeurs}
          usines={usines}
          cgis={cgis}
          avs={avs}
        />
      </Modal>

      {/* ── Modal modification ─────────────────────────────────────────── */}
      <Modal
        open={!!editing}
        onClose={() => { setEditing(null); setMutationError(null); }}
        title="Modifier la mission"
        size="lg"
      >
        {editing && (
          <MissionForm
            isEdit
            defaultValues={{
              saison_id:    editing.saison_id,
              date_mission: editing.date_mission,
              camion_id:    editing.camion_id,
              chauffeur_id: editing.chauffeur_id ?? 0,
              usine_id:     editing.usine_id ?? 0,
              cgi_id:       editing.cgi_id ?? 0,
              av_id:        editing.av_id ?? 0,
              observations: editing.observations,
            }}
            onSubmit={handleEdit}
            loading={modifier.isPending}
            error={mutationError}
            submitLabel="Enregistrer"
            onCancel={() => { setEditing(null); setMutationError(null); }}
            saisons={saisons}
            camions={camions}
            chauffeurs={chauffeurs}
            usines={usines}
            cgis={cgis}
            avs={avs}
          />
        )}
      </Modal>
    </div>
  );
}
