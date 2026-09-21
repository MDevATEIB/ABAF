import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Eye, Trash2, Check, Undo2, FileText, Printer } from 'lucide-react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import {
  Button, Input, Select, Badge, Modal,
  PageHeader, EmptyState, Spinner, ErrorMessage,
} from '@/components/ui';
import {
  useBordereaux, useLignesBordereau, useCreerBordereau, useModifierBordereau,
  useValiderBordereau, useDevaliderBordereau,
  useMissions, useSaisons, useCamions, useChauffeurs, useUsines, useCgis, useAvs,
} from '@/hooks';
import type {
  AV, Bordereau, CGI, Camion, Chauffeur, Mission, Saison, StatutBordereau, Usine,
} from '@/types';
import {
  TYPES_FRET, formatDate, formatFCFA, formatKg, labelCourtTypeFret, labelTypeFret,
} from '@/utils';

// ─── Cycle de vie d'un bordereau (AGENT.md §12) ───────────────────────────────
const STATUTS_BORDEREAU: { value: StatutBordereau; label: string }[] = [
  { value: 'brouillon', label: 'Brouillon' },
  { value: 'valide',    label: 'Validé' },
  { value: 'facture',   label: 'Facturé' },
];

function labelStatutBordereau(statut: StatutBordereau) {
  return STATUTS_BORDEREAU.find((s) => s.value === statut)?.label ?? statut;
}

function varianteStatutBordereau(statut: StatutBordereau): 'muted' | 'default' | 'success' {
  if (statut === 'brouillon') return 'muted';
  if (statut === 'valide') return 'success';
  return 'default';
}

// ─── Schéma de validation ─────────────────────────────────────────────────────
const ligneSchema = z.object({
  av_id:        z.coerce.number({ invalid_type_error: "L'AV est requis" }).min(1, "L'AV est requis"),
  localite:     z.string().optional(),
  poids_kg:     z.coerce
    .number({ invalid_type_error: 'Le poids est requis' })
    .positive('Le poids doit être supérieur à 0'),
  code:         z.string().optional(),
  observations: z.string().optional(),
});

const schema = z.object({
  numero:         z.string().min(1, 'Le numéro est requis'),
  saison_id:      z.coerce.number({ invalid_type_error: 'La campagne est requise' }).min(1, 'La campagne est requise'),
  mission_id:     z.coerce.number().optional().transform((v) => (v ? v : undefined)),
  camion_id:      z.coerce.number({ invalid_type_error: 'Le camion est requis' }).min(1, 'Le camion est requis'),
  chauffeur_id:   z.coerce.number().optional().transform((v) => (v ? v : undefined)),
  usine_id:       z.coerce.number().optional().transform((v) => (v ? v : undefined)),
  cgi_id:         z.coerce.number().optional().transform((v) => (v ? v : undefined)),
  date_bordereau: z.string().min(1, 'La date est requise'),
  distance_km:    z.coerce.number().optional().transform((v) => (v ? v : undefined)),
  type_fret:      z.enum(['direct', 'retour', 'evacuation', 'transfert']),
  observations:   z.string().optional(),
  lignes:         z.array(ligneSchema).min(1, 'Ajoutez au moins une ligne.'),
});
type FormValues = z.infer<typeof schema>;

const LIGNE_VIDE = {
  av_id: 0,
  localite: '',
  poids_kg: undefined as unknown as number,
  code: '',
  observations: '',
};

// ─── Formulaire (création + modification) ─────────────────────────────────────
interface BordereauFormProps {
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
  missions: Mission[];
}

function BordereauForm({
  defaultValues, onSubmit, loading, error, submitLabel, onCancel, isEdit = false,
  saisons, camions, chauffeurs, usines, cgis, avs, missions,
}: BordereauFormProps) {
  const { register, handleSubmit, watch, setValue, control, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'lignes' });

  const saisonId        = Number(watch('saison_id')) || 0;
  const cgiId           = Number(watch('cgi_id')) || 0;
  const camionActuel    = Number(watch('camion_id')) || 0;
  const missionActuelle = Number(watch('mission_id')) || 0;
  const lignesWatch     = watch('lignes') ?? [];
  const totalKg         = lignesWatch.reduce((somme, l) => somme + (Number(l?.poids_kg) || 0), 0);
  const avidsDesLignes  = lignesWatch.map((l) => Number(l?.av_id) || 0);

  const saisonOptions = [
    { value: 0, label: '— Sélectionner —' },
    ...saisons.map((s) => ({ value: s.id, label: s.libelle })),
  ];

  // Missions de la campagne choisie (celle du bordereau reste toujours listée)
  const missionsListees = missions.filter(
    (m) => !saisonId || m.saison_id === saisonId || m.id === missionActuelle,
  );
  const camionMiniMap = new Map(camions.map((c) => [c.id, c.immatriculation]));
  const missionOptions = [
    { value: 0, label: '— Aucune —' },
    ...missionsListees.map((m) => ({
      value: m.id,
      label: `${camionMiniMap.get(m.camion_id) ?? 'Camion'} — ${formatDate(m.date_mission)}`,
    })),
  ];

  const camionOptions = [
    { value: 0, label: '— Sélectionner —' },
    ...camions
      .filter((c) => c.actif === 1 || c.id === camionActuel)
      .map((c) => ({ value: c.id, label: c.immatriculation })),
  ];

  const chauffeurOptions = [
    { value: 0, label: '— Aucun —' },
    ...chauffeurs
      .filter((c) => c.actif === 1)
      .map((c) => ({ value: c.id, label: `${c.nom}${c.prenom ? ` ${c.prenom}` : ''}` })),
  ];

  const usineOptions = [
    { value: 0, label: '— Aucune —' },
    ...usines.map((u) => ({ value: u.id, label: u.nom })),
  ];

  const cgiOptions = [
    { value: 0, label: '— Aucun —' },
    ...cgis.map((c) => ({ value: c.id, label: c.nom })),
  ];

  // AV du CGI du bordereau (ou déjà référencés par une ligne)
  const avOptions = [
    { value: 0, label: '— Sélectionner —' },
    ...avs
      .filter((a) => !cgiId || a.cgi_id === cgiId || avidsDesLignes.includes(a.id))
      .map((a) => ({ value: a.id, label: a.nom })),
  ];

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Campagne"
          options={saisonOptions}
          error={errors.saison_id?.message}
          disabled={isEdit}
          {...register('saison_id')}
        />
        <Select
          label="Mission (facultatif)"
          options={missionOptions}
          error={errors.mission_id?.message}
          {...register('mission_id', {
            onChange: (e) => {
              const mission = missions.find((m) => m.id === Number(e.target.value));
              if (!mission) return;
              // La saison d'un bordereau existant reste figée en modification
              if (!isEdit) setValue('saison_id', mission.saison_id);
              setValue('camion_id', mission.camion_id);
              setValue('chauffeur_id', mission.chauffeur_id ?? 0);
              setValue('usine_id', mission.usine_id ?? 0);
              setValue('cgi_id', mission.cgi_id ?? 0);
            },
          })}
        />
        <Select
          label="Camion"
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
          {...register('usine_id')}
        />
        <Select
          label="CGI"
          options={cgiOptions}
          error={errors.cgi_id?.message}
          {...register('cgi_id')}
        />
        <Input
          type="date"
          label="Date du bordereau"
          error={errors.date_bordereau?.message}
          {...register('date_bordereau')}
        />
        <Input
          label="Numéro du bordereau"
          placeholder="Ex. : BD-2026-001"
          error={errors.numero?.message}
          {...register('numero')}
        />
        <Select
          label="Type de fret"
          options={TYPES_FRET}
          error={errors.type_fret?.message}
          {...register('type_fret')}
        />
        <Input
          type="number"
          step="1"
          label="Distance (km)"
          placeholder="Ex. : 120"
          error={errors.distance_km?.message}
          {...register('distance_km')}
        />
        <Input
          label="Observations"
          placeholder="Remarques éventuelles…"
          {...register('observations')}
        />
      </div>

      {/* ── Lignes du chargement (AV et poids) ──────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-foreground">Lignes du chargement (AV et poids)</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            icon={<Plus size={13} />}
            onClick={() => append({ ...LIGNE_VIDE })}
          >
            Ajouter une ligne
          </Button>
        </div>

        {errors.lignes?.root?.message && (
          <p className="text-xs text-destructive">{errors.lignes.root.message}</p>
        )}

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">AV</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Localité</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Poids (kg)</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Code</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Observations</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {fields.map((field, index) => (
                <tr key={field.id}>
                  <td className="px-3 py-2 align-middle">
                    <Select
                      options={avOptions}
                      error={errors.lignes?.[index]?.av_id?.message}
                      {...register(`lignes.${index}.av_id`, {
                        onChange: (e) => {
                          const av = avs.find((a) => a.id === Number(e.target.value));
                          if (av?.localite) setValue(`lignes.${index}.localite`, av.localite);
                        },
                      })}
                    />
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <Input
                      placeholder="Localité"
                      error={errors.lignes?.[index]?.localite?.message}
                      {...register(`lignes.${index}.localite`)}
                    />
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <Input
                      type="number"
                      step="1"
                      placeholder="Ex. : 2400"
                      error={errors.lignes?.[index]?.poids_kg?.message}
                      {...register(`lignes.${index}.poids_kg`)}
                    />
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <Input
                      placeholder="Code"
                      error={errors.lignes?.[index]?.code?.message}
                      {...register(`lignes.${index}.code`)}
                    />
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <Input
                      placeholder="Observation"
                      error={errors.lignes?.[index]?.observations?.message}
                      {...register(`lignes.${index}.observations`)}
                    />
                  </td>
                  <td className="px-3 py-2 align-middle text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      icon={<Trash2 size={13} />}
                      title="Supprimer la ligne"
                      aria-label="Supprimer la ligne"
                      disabled={fields.length === 1}
                      onClick={() => remove(index)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-sm text-muted-foreground">
          Total des lots : <span className="font-medium text-foreground">{formatKg(totalKg)}</span>
        </p>
      </div>

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
export default function BordereauxPage() {
  const navigate = useNavigate();
  const [filtreSaisonId, setFiltreSaisonId] = useState<number | undefined>(undefined);
  const [filtreStatut, setFiltreStatut]     = useState<StatutBordereau | undefined>(undefined);

  const { data: bordereaux = [], isLoading, error } = useBordereaux(filtreSaisonId, filtreStatut);
  const { data: saisons = [] }    = useSaisons();
  const { data: camions = [] }    = useCamions();
  const { data: chauffeurs = [] } = useChauffeurs();
  const { data: usines = [] }     = useUsines();
  const { data: cgis = [] }       = useCgis();
  const { data: avs = [] }        = useAvs();
  const { data: missions = [] }   = useMissions();

  const creer     = useCreerBordereau();
  const modifier  = useModifierBordereau();
  const valider   = useValiderBordereau();
  const devalider = useDevaliderBordereau();

  const [showCreate, setShowCreate]       = useState(false);
  const [editing, setEditing]             = useState<Bordereau | null>(null);
  const [viewing, setViewing]             = useState<Bordereau | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [actionError, setActionError]     = useState<string | null>(null);

  // Lignes du bordereau édité / consulté
  const { data: lignesEdition, isLoading: lignesEditionLoading } = useLignesBordereau(editing?.id);
  const { data: lignesLecture, isLoading: lignesLectureLoading } = useLignesBordereau(viewing?.id);

  // Correspondances id → libellé pour l'affichage
  const saisonMap  = useMemo(() => new Map(saisons.map((s) => [s.id, s.libelle])), [saisons]);
  const camionMap  = useMemo(() => new Map(camions.map((c) => [c.id, c.immatriculation])), [camions]);
  const cgiMap     = useMemo(() => new Map(cgis.map((c) => [c.id, c.nom])), [cgis]);
  const avMap      = useMemo(() => new Map(avs.map((a) => [a.id, a.nom])), [avs]);
  const chauffeurMap = useMemo(
    () => new Map(chauffeurs.map((c) => [c.id, `${c.nom}${c.prenom ? ` ${c.prenom}` : ''}`])),
    [chauffeurs],
  );
  const missionMap = useMemo(
    () => new Map(missions.map((m) => [m.id, formatDate(m.date_mission)])),
    [missions],
  );
  const totalLignesLecture = (lignesLecture ?? []).reduce((somme, l) => somme + l.poids_kg, 0);

  const saisonOuverte = saisons.find((s) => s.statut === 'ouverte');

  // ── Création ──────────────────────────────────────────────────────────────
  async function handleCreate(values: FormValues) {
    setMutationError(null);
    try {
      await creer.mutateAsync({
        numero:         values.numero,
        saison_id:      values.saison_id,
        mission_id:     values.mission_id,
        camion_id:      values.camion_id,
        chauffeur_id:   values.chauffeur_id,
        usine_id:       values.usine_id,
        cgi_id:         values.cgi_id,
        date_bordereau: values.date_bordereau,
        distance_km:    values.distance_km,
        type_fret:      values.type_fret,
        observations:   values.observations || undefined,
        lignes: values.lignes.map((l) => ({
          av_id:        l.av_id,
          localite:     l.localite || undefined,
          poids_kg:     l.poids_kg,
          code:         l.code || undefined,
          observations: l.observations || undefined,
        })),
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
          numero:         values.numero,
          mission_id:     values.mission_id,
          camion_id:      values.camion_id,
          chauffeur_id:   values.chauffeur_id,
          usine_id:       values.usine_id,
          cgi_id:         values.cgi_id,
          date_bordereau: values.date_bordereau,
          distance_km:    values.distance_km,
          type_fret:      values.type_fret,
          observations:   values.observations || undefined,
          lignes: values.lignes.map((l) => ({
            av_id:        l.av_id,
            localite:     l.localite || undefined,
            poids_kg:     l.poids_kg,
            code:         l.code || undefined,
            observations: l.observations || undefined,
          })),
        },
      });
      setEditing(null);
    } catch (e: unknown) {
      setMutationError(e as string);
    }
  }

  // ── Validation / dévalidation ─────────────────────────────────────────────
  async function handleValider(b: Bordereau) {
    setActionError(null);
    try {
      await valider.mutateAsync(b.id);
    } catch (e: unknown) {
      setActionError(e as string);
    }
  }

  async function handleDevalider(b: Bordereau) {
    setActionError(null);
    try {
      await devalider.mutateAsync(b.id);
    } catch (e: unknown) {
      setActionError(e as string);
    }
  }

  if (isLoading) return <Spinner className="mt-16" />;
  if (error)     return <ErrorMessage message="Impossible de charger les bordereaux." className="mt-4" />;

  return (
    <div>
      <PageHeader
        title="Bordereaux"
        description="Enregistrez les chargements de coton graine (AV et poids) et suivez le poids net calculé à partir des pesées."
        actions={
          <Button icon={<Plus size={15} />} onClick={() => { setMutationError(null); setShowCreate(true); }}>
            Nouveau bordereau
          </Button>
        }
      />

      {/* ── Filtres ─────────────────────────────────────────────────────────── */}
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
          options={[{ value: '', label: 'Tous les statuts' }, ...STATUTS_BORDEREAU]}
          value={filtreStatut ?? ''}
          onChange={(e) => setFiltreStatut((e.target.value || undefined) as StatutBordereau | undefined)}
          className="w-56"
        />
      </div>

      {actionError && <ErrorMessage message={actionError} className="mb-4" />}

      {/* ── Tableau ─────────────────────────────────────────────────────────── */}
      {bordereaux.length === 0 ? (
        <EmptyState
          icon={<FileText size={40} />}
          title="Aucun bordereau enregistré"
          description="Créez le premier bordereau pour tracer les chargements de coton graine."
          action={
            <Button size="sm" icon={<Plus size={14} />} onClick={() => setShowCreate(true)}>
              Nouveau bordereau
            </Button>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">N° Bordereau</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Camion</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Mission</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Campagne</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">CGI</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Distance</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Fret</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Poids net</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Montant brut</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Statut</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {bordereaux.map((b) => (
                <tr key={b.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(b.date_bordereau)}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{b.numero}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {camionMap.get(b.camion_id) ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {b.mission_id ? missionMap.get(b.mission_id) ?? `#${b.mission_id}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{saisonMap.get(b.saison_id) ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {b.cgi_id ? cgiMap.get(b.cgi_id) ?? '—' : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    {b.distance_km != null ? `${b.distance_km} km` : '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{labelCourtTypeFret(b.type_fret)}</td>
                  <td className="px-4 py-3 text-right font-medium text-foreground">
                    {b.poids_net_kg != null ? formatKg(b.poids_net_kg) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-foreground">
                    {b.montant_brut != null ? formatFCFA(b.montant_brut) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={varianteStatutBordereau(b.statut)}>
                      {labelStatutBordereau(b.statut)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Eye size={13} />}
                        title="Consulter"
                        aria-label="Consulter le bordereau"
                        onClick={() => setViewing(b)}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Printer size={13} />}
                        title="Imprimer le bordereau"
                        aria-label="Imprimer le bordereau"
                        onClick={() => navigate(`/impression/bordereau/${b.id}`)}
                      />
                      {b.statut === 'brouillon' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Check size={13} />}
                          title="Valider le bordereau"
                          aria-label="Valider le bordereau"
                          disabled={valider.isPending}
                          onClick={() => handleValider(b)}
                        />
                      )}
                      {b.statut === 'valide' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Undo2 size={13} />}
                          title="Remettre en brouillon"
                          aria-label="Remettre le bordereau en brouillon"
                          disabled={devalider.isPending}
                          onClick={() => handleDevalider(b)}
                        />
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Pencil size={13} />}
                        title={b.statut === 'brouillon' ? 'Modifier' : 'Seul un bordereau en brouillon peut être modifié.'}
                        disabled={b.statut !== 'brouillon'}
                        onClick={() => { setMutationError(null); setEditing(b); }}
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

      {/* ── Modal création ─────────────────────────────────────────────────── */}
      <Modal
        open={showCreate}
        onClose={() => { setShowCreate(false); setMutationError(null); }}
        title="Nouveau bordereau"
        size="lg"
      >
        <BordereauForm
          defaultValues={{
            saison_id:      saisonOuverte?.id ?? 0,
            mission_id:     0,
            camion_id:      0,
            chauffeur_id:   0,
            usine_id:       0,
            cgi_id:         0,
            date_bordereau: new Date().toISOString().slice(0, 10),
            numero:         '',
            type_fret:      'direct',
            lignes:         [{ ...LIGNE_VIDE }],
          }}
          onSubmit={handleCreate}
          loading={creer.isPending}
          error={mutationError}
          submitLabel="Créer le bordereau"
          onCancel={() => { setShowCreate(false); setMutationError(null); }}
          saisons={saisons}
          camions={camions}
          chauffeurs={chauffeurs}
          usines={usines}
          cgis={cgis}
          avs={avs}
          missions={missions}
        />
      </Modal>

      {/* ── Modal modification ─────────────────────────────────────────────── */}
      <Modal
        open={!!editing}
        onClose={() => { setEditing(null); setMutationError(null); }}
        title="Modifier le bordereau"
        size="lg"
      >
        {editing && (lignesEditionLoading ? (
          <Spinner />
        ) : (
          <BordereauForm
            key={editing.id}
            isEdit
            defaultValues={{
              numero:         editing.numero,
              saison_id:      editing.saison_id,
              mission_id:     editing.mission_id ?? 0,
              camion_id:      editing.camion_id,
              chauffeur_id:   editing.chauffeur_id ?? 0,
              usine_id:       editing.usine_id ?? 0,
              cgi_id:         editing.cgi_id ?? 0,
              date_bordereau: editing.date_bordereau,
              distance_km:    editing.distance_km,
              type_fret:      editing.type_fret ?? 'direct',
              observations:   editing.observations,
              lignes: (lignesEdition ?? []).map((l) => ({
                av_id:        l.av_id ?? 0,
                localite:     l.localite ?? '',
                poids_kg:     l.poids_kg,
                code:         l.code ?? '',
                observations: l.observations ?? '',
              })),
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
            missions={missions}
          />
        ))}
      </Modal>

      {/* ── Modal consultation ─────────────────────────────────────────────── */}
      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title="Détail du bordereau"
        size="lg"
      >
        {viewing && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Numéro</p>
                <p className="font-medium text-foreground">{viewing.numero}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Date</p>
                <p className="font-medium text-foreground">{formatDate(viewing.date_bordereau)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Camion</p>
                <p className="font-medium text-foreground">{camionMap.get(viewing.camion_id) ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Chauffeur</p>
                <p className="font-medium text-foreground">
                  {viewing.chauffeur_id ? chauffeurMap.get(viewing.chauffeur_id) ?? '—' : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Mission</p>
                <p className="font-medium text-foreground">
                  {viewing.mission_id ? missionMap.get(viewing.mission_id) ?? `#${viewing.mission_id}` : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Campagne</p>
                <p className="font-medium text-foreground">{saisonMap.get(viewing.saison_id) ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">CGI</p>
                <p className="font-medium text-foreground">
                  {viewing.cgi_id ? cgiMap.get(viewing.cgi_id) ?? '—' : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Statut</p>
                <Badge variant={varianteStatutBordereau(viewing.statut)}>
                  {labelStatutBordereau(viewing.statut)}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Poids à vide</p>
                <p className="mt-0.5 text-sm font-medium text-foreground">
                  {viewing.poids_vide_kg != null ? formatKg(viewing.poids_vide_kg) : '—'}
                </p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Poids chargé</p>
                <p className="mt-0.5 text-sm font-medium text-foreground">
                  {viewing.poids_charge_kg != null ? formatKg(viewing.poids_charge_kg) : '—'}
                </p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Poids net coton</p>
                <p className="mt-0.5 text-sm font-medium text-foreground">
                  {viewing.poids_net_kg != null ? formatKg(viewing.poids_net_kg) : '—'}
                </p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Type de fret</p>
                <p className="mt-0.5 text-sm font-medium text-foreground">
                  {viewing.type_fret ? labelTypeFret(viewing.type_fret) : '—'}
                </p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Tarif appliqué</p>
                <p className="mt-0.5 text-sm font-medium text-foreground">
                  {viewing.tarif_applique != null
                    ? `${formatFCFA(viewing.tarif_applique)} / ${viewing.unite_tarif === 'fcfa_tkm' ? 'TKM' : 't'}`
                    : '—'}
                </p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Montant brut transport</p>
                <p className="mt-0.5 text-sm font-medium text-foreground">
                  {viewing.montant_brut != null ? formatFCFA(viewing.montant_brut) : '—'}
                </p>
              </div>
            </div>

            {lignesLectureLoading ? (
              <Spinner />
            ) : (
              <>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">AV</th>
                        <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Localité</th>
                        <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Poids</th>
                        <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Code</th>
                        <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Observations</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {(lignesLecture ?? []).map((l) => (
                        <tr key={l.id}>
                          <td className="px-4 py-2.5 font-medium text-foreground">
                            {l.av_id ? avMap.get(l.av_id) ?? '—' : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground">{l.localite || '—'}</td>
                          <td className="px-4 py-2.5 text-right text-muted-foreground">{formatKg(l.poids_kg)}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">{l.code || '—'}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">{l.observations || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-sm text-muted-foreground">
                  Total des lots : <span className="font-medium text-foreground">{formatKg(totalLignesLecture)}</span>
                  {' '}· Distance : <span className="font-medium text-foreground">{viewing.distance_km != null ? `${viewing.distance_km} km` : '—'}</span>
                </p>
                {viewing.observations && (
                  <p className="text-sm text-muted-foreground">Observations : {viewing.observations}</p>
                )}
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
