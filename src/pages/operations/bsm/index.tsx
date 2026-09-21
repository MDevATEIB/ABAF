import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, ChevronLeft, ChevronRight, Fuel, Printer } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import {
  Button, Input, Select, Badge, Modal,
  PageHeader, EmptyState, Spinner, ErrorMessage,
} from '@/components/ui';
import {
  useBsms, useCreerBsm, useModifierBsm, useChangerStatutBsm,
  useMissions, useSaisons, useCamions, useUsines, usePrixGasoil,
} from '@/hooks';
import type { BSM, Camion, Mission, Saison, StatutBSM, Usine } from '@/types';
import { calculMontantGasoil, formatDate, formatFCFA, formatLitres } from '@/utils';

// ─── Cycle de vie d'un BSM (AGENT.md §11) ─────────────────────────────────────
const STATUTS_BSM: { value: StatutBSM; label: string }[] = [
  { value: 'ouvert',  label: 'Ouvert' },
  { value: 'cloture', label: 'Clôturé' },
  { value: 'facture', label: 'Facturé' },
];

const ORDRE_BSM: StatutBSM[] = STATUTS_BSM.map((s) => s.value);

function labelStatutBsm(statut: StatutBSM) {
  return STATUTS_BSM.find((s) => s.value === statut)?.label ?? statut;
}

function varianteStatutBsm(statut: StatutBSM): 'default' | 'warning' | 'success' {
  if (statut === 'cloture') return 'warning';
  if (statut === 'facture') return 'success';
  return 'default';
}

// ─── Schéma de validation ─────────────────────────────────────────────────────
const schema = z.object({
  numero:          z.string().min(1, 'Le numéro est requis'),
  saison_id:       z.coerce.number({ invalid_type_error: 'La campagne est requise' }).min(1, 'La campagne est requise'),
  mission_id:      z.coerce.number().optional().transform((v) => (v ? v : undefined)),
  camion_id:       z.coerce.number({ invalid_type_error: 'Le camion est requis' }).min(1, 'Le camion est requis'),
  usine_id:        z.coerce.number().optional().transform((v) => (v ? v : undefined)),
  date_bsm:        z.string().min(1, 'La date est requise'),
  beneficiaire:    z.string().optional(),
  quantite_litres: z.coerce
    .number({ invalid_type_error: 'La quantité est requise' })
    .positive('La quantité doit être supérieure à 0'),
  prix_litre:      z.coerce
    .number({ invalid_type_error: 'Le prix au litre est requis' })
    .positive('Le prix au litre doit être supérieur à 0'),
  imputation:      z.string().optional(),
  reference:       z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

// ─── Formulaire (création + modification) ─────────────────────────────────────
interface BsmFormProps {
  defaultValues: Partial<FormValues>;
  onSubmit: (values: FormValues) => Promise<void>;
  loading: boolean;
  error?: string | null;
  submitLabel: string;
  onCancel: () => void;
  isEdit?: boolean;
  saisons: Saison[];
  camions: Camion[];
  usines: Usine[];
  missions: Mission[];
}

function BsmForm({
  defaultValues, onSubmit, loading, error, submitLabel, onCancel, isEdit = false,
  saisons, camions, usines, missions,
}: BsmFormProps) {
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const saisonId     = Number(watch('saison_id')) || 0;
  const camionActuel = Number(watch('camion_id')) || 0;
  const missionActuelle = Number(watch('mission_id')) || 0;
  const quantite     = Number(watch('quantite_litres')) || 0;
  const prixLitre    = Number(watch('prix_litre')) || 0;
  const montant      = calculMontantGasoil(quantite, prixLitre);

  // Le prix au litre est proposé automatiquement depuis le prix gasoil
  // de la campagne (module Prix gasoil).
  const { data: prixGasoil } = usePrixGasoil(saisonId || undefined);
  const prixInitialise = useRef(false);
  useEffect(() => {
    if (!prixGasoil) return;
    // En modification, conserver le prix enregistré du BSM jusqu'à
    // un changement explicite de campagne.
    if (isEdit && !prixInitialise.current) {
      prixInitialise.current = true;
      return;
    }
    setValue('prix_litre', prixGasoil.prix_litre);
  }, [prixGasoil, isEdit, setValue]);

  const saisonOptions = [
    { value: 0, label: '— Sélectionner —' },
    ...saisons.map((s) => ({ value: s.id, label: s.libelle })),
  ];

  // Missions de la campagne choisie (celle du BSM reste toujours listée)
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

  const usineOptions = [
    { value: 0, label: '— Aucun —' },
    ...usines.map((u) => ({ value: u.id, label: u.nom })),
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
              // La saison d'un BSM existant reste figée en modification
              if (!isEdit) setValue('saison_id', mission.saison_id);
              setValue('camion_id', mission.camion_id);
              setValue('usine_id', mission.usine_id ?? 0);
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
          label="Usine"
          options={usineOptions}
          error={errors.usine_id?.message}
          {...register('usine_id')}
        />
        <Input
          type="date"
          label="Date du BSM"
          error={errors.date_bsm?.message}
          {...register('date_bsm')}
        />
        <Input
          label="Numéro du BSM"
          placeholder="Ex. : BSM-2026-001"
          error={errors.numero?.message}
          {...register('numero')}
        />
        <Input
          type="number"
          step="1"
          label="Quantité de gasoil (L)"
          placeholder="Ex. : 350"
          error={errors.quantite_litres?.message}
          {...register('quantite_litres')}
        />
        <Input
          type="number"
          step="1"
          label="Prix au litre (FCFA/L)"
          placeholder="Ex. : 750"
          error={errors.prix_litre?.message}
          hint={prixGasoil ? 'Pré-rempli depuis le prix gasoil de la campagne.' : undefined}
          {...register('prix_litre')}
        />
        <Input
          label="Bénéficiaire"
          placeholder="Ex. : chauffeur, agent…"
          error={errors.beneficiaire?.message}
          {...register('beneficiaire')}
        />
        <Input
          label="Imputation"
          placeholder="Ex. : COTONTCHAD SN"
          error={errors.imputation?.message}
          {...register('imputation')}
        />
      </div>

      <Input
        label="Référence"
        placeholder="Référence éventuelle…"
        error={errors.reference?.message}
        {...register('reference')}
      />

      <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
        <span className="text-muted-foreground">Montant gasoil calculé :</span>{' '}
        <span className="font-medium text-foreground">{formatFCFA(montant)}</span>
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
export default function BsmPage() {
  const navigate = useNavigate();
  const [filtreSaisonId, setFiltreSaisonId] = useState<number | undefined>(undefined);
  const [filtreStatut, setFiltreStatut]     = useState<StatutBSM | undefined>(undefined);

  const { data: bsms = [], isLoading, error } = useBsms(filtreSaisonId, filtreStatut);
  const { data: saisons = [] }    = useSaisons();
  const { data: camions = [] }    = useCamions();
  const { data: usines = [] }     = useUsines();
  const { data: missions = [] }   = useMissions();

  const creer         = useCreerBsm();
  const modifier      = useModifierBsm();
  const changerStatut = useChangerStatutBsm();

  const [showCreate, setShowCreate]       = useState(false);
  const [editing, setEditing]             = useState<BSM | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [actionError, setActionError]     = useState<string | null>(null);

  // Correspondances id → libellé pour l'affichage du tableau
  const saisonMap  = useMemo(() => new Map(saisons.map((s) => [s.id, s.libelle])), [saisons]);
  const camionMap  = useMemo(() => new Map(camions.map((c) => [c.id, c.immatriculation])), [camions]);
  const missionMap = useMemo(
    () => new Map(missions.map((m) => [m.id, formatDate(m.date_mission)])),
    [missions],
  );

  const saisonOuverte = saisons.find((s) => s.statut === 'ouverte');

  // ── Création ──────────────────────────────────────────────────────────────
  async function handleCreate(values: FormValues) {
    setMutationError(null);
    try {
      await creer.mutateAsync({
        numero:          values.numero,
        saison_id:       values.saison_id,
        mission_id:      values.mission_id,
        camion_id:       values.camion_id,
        usine_id:        values.usine_id,
        date_bsm:        values.date_bsm,
        beneficiaire:    values.beneficiaire || undefined,
        quantite_litres: values.quantite_litres,
        prix_litre:      values.prix_litre,
        imputation:      values.imputation || undefined,
        reference:       values.reference || undefined,
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
          numero:          values.numero,
          mission_id:      values.mission_id,
          camion_id:       values.camion_id,
          usine_id:        values.usine_id,
          date_bsm:        values.date_bsm,
          beneficiaire:    values.beneficiaire || undefined,
          quantite_litres: values.quantite_litres,
          prix_litre:      values.prix_litre,
          imputation:      values.imputation || undefined,
          reference:       values.reference || undefined,
        },
      });
      setEditing(null);
    } catch (e: unknown) {
      setMutationError(e as string);
    }
  }

  // ── Changement de statut (une seule étape à la fois) ──────────────────────
  async function handleChangerStatut(bsm: BSM, statut: StatutBSM) {
    setActionError(null);
    try {
      await changerStatut.mutateAsync({ id: bsm.id, statut });
    } catch (e: unknown) {
      setActionError(e as string);
    }
  }

  if (isLoading) return <Spinner className="mt-16" />;
  if (error)     return <ErrorMessage message="Impossible de charger les BSM." className="mt-4" />;

  return (
    <div>
      <PageHeader
        title="BSM / Gasoil"
        description="Enregistrez les bons de sortie magasin du gasoil pris par les camions, rattachés aux missions."
        actions={
          <Button icon={<Plus size={15} />} onClick={() => { setMutationError(null); setShowCreate(true); }}>
            Nouveau BSM
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
          options={[{ value: '', label: 'Tous les statuts' }, ...STATUTS_BSM]}
          value={filtreStatut ?? ''}
          onChange={(e) => setFiltreStatut((e.target.value || undefined) as StatutBSM | undefined)}
          className="w-56"
        />
      </div>

      {actionError && <ErrorMessage message={actionError} className="mb-4" />}

      {/* ── Tableau ─────────────────────────────────────────────────────────── */}
      {bsms.length === 0 ? (
        <EmptyState
          icon={<Fuel size={40} />}
          title="Aucun BSM enregistré"
          description="Enregistrez le premier bon de sortie magasin pour tracer le gasoil des missions."
          action={
            <Button size="sm" icon={<Plus size={14} />} onClick={() => setShowCreate(true)}>
              Nouveau BSM
            </Button>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">N° BSM</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Camion</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Mission</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Campagne</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Quantité</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Prix/L</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Montant</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Statut</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {bsms.map((b) => {
                const idx       = ORDRE_BSM.indexOf(b.statut);
                const precedent = idx > 0 ? ORDRE_BSM[idx - 1] : null;
                const suivant   = idx >= 0 && idx < ORDRE_BSM.length - 1 ? ORDRE_BSM[idx + 1] : null;

                return (
                  <tr key={b.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(b.date_bsm)}</td>
                    <td className="px-4 py-3 font-medium text-foreground">{b.numero}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {camionMap.get(b.camion_id) ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {b.mission_id ? missionMap.get(b.mission_id) ?? `#${b.mission_id}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{saisonMap.get(b.saison_id) ?? '—'}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{formatLitres(b.quantite_litres)}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{formatFCFA(b.prix_litre)}/L</td>
                    <td className="px-4 py-3 text-right font-medium text-foreground">{formatFCFA(b.montant)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={varianteStatutBsm(b.statut)}>{labelStatutBsm(b.statut)}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Printer size={13} />}
                          title="Imprimer le BSM"
                          aria-label="Imprimer le BSM"
                          onClick={() => navigate(`/impression/bsm/${b.id}`)}
                        />
                        {precedent && (
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<ChevronLeft size={14} />}
                            title={`Reculer vers « ${labelStatutBsm(precedent)} »`}
                            aria-label={`Reculer vers « ${labelStatutBsm(precedent)} »`}
                            disabled={changerStatut.isPending}
                            onClick={() => handleChangerStatut(b, precedent)}
                          />
                        )}
                        {suivant && (
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<ChevronRight size={14} />}
                            title={`Avancer vers « ${labelStatutBsm(suivant)} »`}
                            aria-label={`Avancer vers « ${labelStatutBsm(suivant)} »`}
                            disabled={changerStatut.isPending}
                            onClick={() => handleChangerStatut(b, suivant)}
                          />
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Pencil size={13} />}
                          title={b.statut === 'ouvert' ? 'Modifier' : 'Un BSM clôturé ou facturé ne peut plus être modifié.'}
                          disabled={b.statut !== 'ouvert'}
                          onClick={() => { setMutationError(null); setEditing(b); }}
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

      {/* ── Modal création ─────────────────────────────────────────────────── */}
      <Modal
        open={showCreate}
        onClose={() => { setShowCreate(false); setMutationError(null); }}
        title="Nouveau BSM"
        size="lg"
      >
        <BsmForm
          defaultValues={{
            saison_id:  saisonOuverte?.id ?? 0,
            mission_id: 0,
            camion_id:  0,
            usine_id:   0,
            date_bsm:   new Date().toISOString().slice(0, 10),
            numero:     '',
          }}
          onSubmit={handleCreate}
          loading={creer.isPending}
          error={mutationError}
          submitLabel="Créer le BSM"
          onCancel={() => { setShowCreate(false); setMutationError(null); }}
          saisons={saisons}
          camions={camions}
          usines={usines}
          missions={missions}
        />
      </Modal>

      {/* ── Modal modification ─────────────────────────────────────────────── */}
      <Modal
        open={!!editing}
        onClose={() => { setEditing(null); setMutationError(null); }}
        title="Modifier le BSM"
        size="lg"
      >
        {editing && (
          <BsmForm
            isEdit
            defaultValues={{
              numero:          editing.numero,
              saison_id:       editing.saison_id,
              mission_id:      editing.mission_id ?? 0,
              camion_id:       editing.camion_id,
              usine_id:        editing.usine_id ?? 0,
              date_bsm:        editing.date_bsm,
              beneficiaire:    editing.beneficiaire,
              quantite_litres: editing.quantite_litres,
              prix_litre:      editing.prix_litre,
              imputation:      editing.imputation,
              reference:       editing.reference,
            }}
            onSubmit={handleEdit}
            loading={modifier.isPending}
            error={mutationError}
            submitLabel="Enregistrer"
            onCancel={() => { setEditing(null); setMutationError(null); }}
            saisons={saisons}
            camions={camions}
            usines={usines}
            missions={missions}
          />
        )}
      </Modal>
    </div>
  );
}
