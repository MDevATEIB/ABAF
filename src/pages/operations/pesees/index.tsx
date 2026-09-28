import { useMemo, useState } from 'react';
import { Plus, Scale, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import {
  Button, Input, Select, Badge, Modal, ConfirmDialog, Pagination,
  PageHeader, EmptyState, Spinner, ErrorMessage,
} from '@/components/ui';
import {
  useMissions, usePeseesMission, useCreerPesee, useSupprimerPesee,
  useSaisons, useCamions, useChauffeurs, useUsines, usePagination,
} from '@/hooks';

import type { Mission, Pesee, TypePesee } from '@/types';
import {
  calculPoidsNet, formatDate, formatKg,
  labelStatutMission, varianteStatutMission,
  capaciteToPoidsVideKg,
} from '@/utils';

// ─── Libellés des types de pesée ──────────────────────────────────────────────
const TYPE_LABELS: Record<TypePesee, string> = {
  vide: 'À vide',
  charge: 'Chargée',
};

// ─── Schéma de validation ─────────────────────────────────────────────────────
const schema = z.object({
  date_pesee:   z.string().min(1, 'La date est requise'),
  heure_pesee:  z.string().optional(),
  poids_kg:     z.coerce
    .number({ invalid_type_error: 'Le poids est requis' })
    .positive('Le poids doit être supérieur à 0'),
  ticket_pesee: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

// ─── Formulaire de pesée (à vide / chargée) ───────────────────────────────────
interface PeseeFormProps {
  type: TypePesee;
  poidsVide?: number;
  onSubmit: (values: FormValues) => Promise<void>;
  loading: boolean;
  error?: string | null;
  onCancel: () => void;
}

function PeseeForm({ type, poidsVide, onSubmit, loading, error, onCancel }: PeseeFormProps) {
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      date_pesee:  new Date().toISOString().slice(0, 10),
      heure_pesee: '',
      ticket_pesee: '',
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Input
          type="date"
          label="Date de pesée"
          error={errors.date_pesee?.message}
          {...register('date_pesee')}
        />
        <Input
          type="time"
          label="Heure"
          error={errors.heure_pesee?.message}
          {...register('heure_pesee')}
        />
        <Input
          type="number"
          step="1"
          label="Poids (kg)"
          placeholder="Ex. : 18500"
          error={errors.poids_kg?.message}
          hint={
            type === 'charge' && poidsVide !== undefined
              ? 'Le poids net sera calculé automatiquement : poids chargé − poids à vide.'
              : undefined
          }
          {...register('poids_kg')}
        />
        <Input
          label="N° ticket de pesée"
          placeholder="Facultatif"
          error={errors.ticket_pesee?.message}
          {...register('ticket_pesee')}
        />
      </div>

      {error && <ErrorMessage message={error} />}

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" type="button" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit" loading={loading}>
          Enregistrer la pesée
        </Button>
      </div>
    </form>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function PeseesPage() {
  const [filtreSaisonId, setFiltreSaisonId] = useState<number | undefined>(undefined);
  const [missionActive, setMissionActive]     = useState<Mission | null>(null);
  const [ajoutType, setAjoutType]             = useState<TypePesee | null>(null);
  const [peseeASupprimer, setPeseeASupprimer] = useState<Pesee | null>(null);
  const [mutationError, setMutationError]     = useState<string | null>(null);

  const { data: saisons = [] }    = useSaisons();
  const { data: camions = [] }    = useCamions();
  const { data: chauffeurs = [] } = useChauffeurs();
  const { data: usines = [] }     = useUsines();
  const { data: missions = [], isLoading, error } = useMissions(filtreSaisonId);

  const { data: pesees = [], isLoading: peseesLoading } = usePeseesMission(missionActive?.id);

  const creer     = useCreerPesee();
  const supprimer = useSupprimerPesee();

  const pagination = usePagination(missions);

  // Correspondances id → libellé pour l'affichage
  const saisonMap    = useMemo(() => new Map(saisons.map((s) => [s.id, s.libelle])), [saisons]);
  const camionMap    = useMemo(() => new Map(camions.map((c) => [c.id, c.immatriculation])), [camions]);
  const chauffeurMap = useMemo(
    () => new Map(chauffeurs.map((c) => [c.id, `${c.nom}${c.prenom ? ` ${c.prenom}` : ''}`])),
    [chauffeurs],
  );
  const usineMap = useMemo(() => new Map(usines.map((u) => [u.id, u.nom])), [usines]);

  const peseeVide   = pesees.find((p) => p.type_pesee === 'vide');
  const peseeCharge = pesees.find((p) => p.type_pesee === 'charge');
  const poidsNet    = peseeVide && peseeCharge
    ? calculPoidsNet(peseeCharge.poids_kg, peseeVide.poids_kg)
    : null;

  const camionMission = missionActive
    ? camions.find((c) => c.id === missionActive.camion_id)
    : undefined;
  const tareCamionKg = capaciteToPoidsVideKg(camionMission?.capacite_tonnes);

  // ── Ouverture du détail d'une mission ─────────────────────────────────────
  function ouvrirMission(mission: Mission) {
    setMutationError(null);
    setAjoutType(null);
    setMissionActive(mission);
  }

  function fermerModal() {
    setMissionActive(null);
    setAjoutType(null);
    setMutationError(null);
  }

  // ── Création d'une pesée ──────────────────────────────────────────────────
  async function handleCreate(values: FormValues) {
    if (!missionActive || !ajoutType) return;
    setMutationError(null);
    try {
      await creer.mutateAsync({
        mission_id:   missionActive.id,
        type_pesee:   ajoutType,
        poids_kg:     values.poids_kg,
        date_pesee:   values.date_pesee,
        heure_pesee:  values.heure_pesee || undefined,
        ticket_pesee: values.ticket_pesee || undefined,
      });
      setAjoutType(null);
    } catch (e: unknown) {
      setMutationError(e as string);
    }
  }

  // ── Suppression d'une pesée ───────────────────────────────────────────────
  async function handleSupprimer() {
    if (!peseeASupprimer) return;
    setMutationError(null);
    try {
      await supprimer.mutateAsync(peseeASupprimer.id);
      setPeseeASupprimer(null);
    } catch (e: unknown) {
      setMutationError(e as string);
      setPeseeASupprimer(null);
    }
  }

  if (isLoading) return <Spinner className="mt-16" />;
  if (error)     return <ErrorMessage message="Impossible de charger les missions." className="mt-4" />;

  return (
    <div>
      <PageHeader
        title="Pesées"
        description="Enregistrez les pesées à vide et chargées des camions, et suivez le poids net de coton calculé automatiquement."
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
          onChange={(e) => { setFiltreSaisonId(Number(e.target.value) || undefined); pagination.reset(); }}
          className="w-56"
        />
      </div>

      {/* ── Tableau des missions ────────────────────────────────────────────── */}
      {missions.length === 0 ? (
        <EmptyState
          icon={<Scale size={40} />}
          title="Aucune mission enregistrée"
          description="Les pesées se saisissent depuis une mission. Créez d'abord une mission dans le module Missions."
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Camion</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Chauffeur</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Campagne</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Usine</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Statut</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pagination.items.map((m) => (
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
                  <td className="px-4 py-3">
                    <Badge variant={varianteStatutMission(m.statut)}>{labelStatutMission(m.statut)}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Scale size={13} />}
                        onClick={() => ouvrirMission(m)}
                      >
                        Pesées
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          totalItems={pagination.totalItems}
          pageSize={pagination.pageSize}
          onPageChange={pagination.goToPage}
          onPageSizeChange={pagination.setPageSize}
        />
        </>
      )}

      {/* ── Modal détail / saisie ──────────────────────────────────────────── */}
      <Modal
        open={!!missionActive}
        onClose={fermerModal}
        title={
          missionActive
            ? ajoutType
              ? `Pesée ${TYPE_LABELS[ajoutType].toLowerCase()} — ${camionMap.get(missionActive.camion_id) ?? 'camion'}`
              : `Pesées — ${camionMap.get(missionActive.camion_id) ?? 'camion'}`
            : 'Pesées'
        }
        size="lg"
      >
        {missionActive && ajoutType && (
          <PeseeForm
            type={ajoutType}
            poidsVide={peseeVide?.poids_kg}
            onSubmit={handleCreate}
            loading={creer.isPending}
            error={mutationError}
            onCancel={() => { setAjoutType(null); setMutationError(null); }}
          />
        )}

        {missionActive && !ajoutType && (
          <div className="space-y-5">
            {/* Infos mission */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Chauffeur</p>
                <p className="font-medium text-foreground">
                  {missionActive.chauffeur_id ? chauffeurMap.get(missionActive.chauffeur_id) ?? '—' : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Campagne</p>
                <p className="font-medium text-foreground">
                  {saisonMap.get(missionActive.saison_id) ?? '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Usine</p>
                <p className="font-medium text-foreground">
                  {missionActive.usine_id ? usineMap.get(missionActive.usine_id) ?? '—' : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Statut de la mission</p>
                <Badge variant={varianteStatutMission(missionActive.statut)}>
                  {labelStatutMission(missionActive.statut)}
                </Badge>
              </div>
            </div>

            {mutationError && <ErrorMessage message={mutationError} />}

            {/* Actions */}
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-foreground">Pesées de la mission</h3>
              <div className="flex gap-2">
                {!peseesLoading && !peseeCharge && (
                  <Button
                    size="sm"
                    icon={<Plus size={14} />}
                    onClick={() => { setMutationError(null); setAjoutType('charge'); }}
                  >
                    Pesée chargée
                  </Button>
                )}
              </div>
            </div>

            {/* Tare camion (capacité) */}
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Tare du camion (capacité enregistrée)
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-foreground">
                    {tareCamionKg != null
                      ? `${formatKg(tareCamionKg)} (${camionMission?.capacite_tonnes ?? 0} t)`
                      : '— Camion sans capacité enregistrée —'}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Cette valeur est utilisée automatiquement comme poids à vide lors de la validation du bordereau.
                  </p>
                </div>
              </div>
            </div>

            {/* Tableau des pesées */}
            {peseesLoading ? (
              <Spinner />
            ) : pesees.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                Aucune pesée enregistrée pour cette mission.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Type</th>
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Date</th>
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Heure</th>
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Poids</th>
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Ticket</th>
                      <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {pesees.map((p) => (
                      <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-2.5">
                          <Badge variant={p.type_pesee === 'vide' ? 'muted' : 'default'}>
                            {TYPE_LABELS[p.type_pesee]}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">{formatDate(p.date_pesee)}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{p.heure_pesee || '—'}</td>
                        <td className="px-4 py-2.5 font-medium text-foreground">{formatKg(p.poids_kg)}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{p.ticket_pesee || '—'}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={<Trash2 size={13} />}
                              title="Supprimer"
                              aria-label="Supprimer la pesée"
                              onClick={() => { setMutationError(null); setPeseeASupprimer(p); }}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Synthèse des poids */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Poids à vide</p>
                <p className="mt-0.5 text-sm font-medium text-foreground">
                  {peseeVide ? formatKg(peseeVide.poids_kg) : '—'}
                </p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Poids chargé</p>
                <p className="mt-0.5 text-sm font-medium text-foreground">
                  {peseeCharge ? formatKg(peseeCharge.poids_kg) : '—'}
                </p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Poids net coton</p>
                <p className="mt-0.5 text-sm font-medium text-foreground">
                  {poidsNet !== null ? formatKg(poidsNet) : '—'}
                </p>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Confirmation de suppression ────────────────────────────────────── */}
      <ConfirmDialog
        open={!!peseeASupprimer}
        onClose={() => setPeseeASupprimer(null)}
        onConfirm={handleSupprimer}
        title="Supprimer la pesée"
        message={
          peseeASupprimer
            ? `Supprimer la pesée ${TYPE_LABELS[peseeASupprimer.type_pesee].toLowerCase()} du ${formatDate(peseeASupprimer.date_pesee)} ? Cette action est irréversible.`
            : ''
        }
        confirmLabel="Supprimer"
        loading={supprimer.isPending}
      />
    </div>
  );
}
