import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Eye, Trash2, Check, Receipt, Printer } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import {
  Button, Input, Select, Badge, Modal, ConfirmDialog,
  PageHeader, EmptyState, Spinner, ErrorMessage,
} from '@/components/ui';
import {
  useFactures, useLignesFacture, useCreerFacture, useValiderFacture, useSupprimerFacture,
  useOperationsDisponibles, useClients, useSaisons, useTarifs, useCamions,
} from '@/hooks';
import type {
  BSM, Bordereau, Camion, Client, Facture, Saison, StatutFacture, Tarif, TypeFret,
} from '@/types';
import { formatDate, formatFCFA, formatKg, formatLitres, formatTKM, tkmLigne, calculMontantBrut } from '@/utils';

// ─── Cycle de vie d'une facture (AGENT.md §13) ────────────────────────────────
const STATUTS_FACTURE: { value: StatutFacture; label: string }[] = [
  { value: 'brouillon', label: 'Brouillon' },
  { value: 'validee',   label: 'Validée' },
  { value: 'payee',     label: 'Payée' },
];

function labelStatutFacture(statut: StatutFacture) {
  return STATUTS_FACTURE.find((s) => s.value === statut)?.label ?? statut;
}

function varianteStatutFacture(statut: StatutFacture): 'muted' | 'default' | 'success' {
  if (statut === 'brouillon') return 'muted';
  if (statut === 'payee') return 'success';
  return 'default';
}

/** Barème de la campagne : tranche qui couvre la distance du bordereau. */
function trouverTarifApplicable(
  tarifs: Tarif[],
  distanceKm: number,
  typeFret: TypeFret,
): Tarif | undefined {
  return tarifs
    .filter(
      (t) =>
        t.type_fret === typeFret &&
        distanceKm >= t.distance_min &&
        (t.distance_max == null || distanceKm <= t.distance_max),
    )
    .sort((a, b) => b.distance_min - a.distance_min)[0];
}

interface MontantBordereau {
  tarifTonne: number;
  montantBrut: number;
}

/**
 * Montants prévisionnels d'un bordereau : le tarif et le montant sont ceux
 * figés à la validation (CDC v1.1) ; pour les bordereaux antérieurs, repli
 * sur le barème de la campagne (mêmes règles qu'à la validation).
 */
function calculerMontantBordereau(b: Bordereau, tarifs: Tarif[]): MontantBordereau | null {
  if (b.tarif_applique != null && b.unite_tarif != null && b.montant_brut != null) {
    const tarifTonne = b.unite_tarif === 'fcfa_tonne'
      ? b.tarif_applique
      : (b.distance_km ?? 0) * b.tarif_applique;
    return { tarifTonne, montantBrut: b.montant_brut };
  }
  if (b.distance_km == null || b.poids_net_kg == null) return null;
  const tarif = trouverTarifApplicable(tarifs, b.distance_km, b.type_fret ?? 'direct');
  if (!tarif) return null;
  const tarifTonne = tarif.unite_tarif === 'fcfa_tonne'
    ? tarif.tarif
    : b.distance_km * tarif.tarif;
  return { tarifTonne, montantBrut: calculMontantBrut(b.poids_net_kg, tarifTonne) };
}

/** Raison pour laquelle un bordereau n'est pas facturable (null : éligible). */
function raisonNonSelectionnable(b: Bordereau, tarifs: Tarif[]): string | null {
  if (b.distance_km == null) return 'Renseignez la distance du bordereau avant de le facturer.';
  if (b.poids_net_kg == null) return 'Le poids net du bordereau est manquant.';
  // Montant déjà figé à la validation du bordereau : rien à vérifier.
  if (b.montant_brut != null) return null;
  if (!trouverTarifApplicable(tarifs, b.distance_km, b.type_fret ?? 'direct')) {
    return 'Aucun tarif applicable pour cette distance.';
  }
  return null;
}

// ─── Schéma de validation ─────────────────────────────────────────────────────
const schema = z.object({
  numero:       z.string().min(1, 'Le numéro est requis'),
  saison_id:    z.coerce.number({ invalid_type_error: 'La campagne est requise' }).min(1, 'La campagne est requise'),
  client_id:    z.coerce.number({ invalid_type_error: 'Le client est requis' }).min(1, 'Le client est requis'),
  date_facture: z.string().min(1, 'La date est requise'),
  observations: z.string().optional(),
  /** Mention « ORIGINAL PAYABLE » imprimée sur l'exemplaire original (CDC v1.1). */
  mention_original_payable: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

// ─── Formulaire de création (sélection des opérations) ────────────────────────
interface FactureFormProps {
  defaultValues: Partial<FormValues>;
  onSubmit: (values: FormValues, bordereauIds: number[], bsmIds: number[]) => Promise<void>;
  loading: boolean;
  error?: string | null;
  onCancel: () => void;
  saisons: Saison[];
  clients: Client[];
  camions: Camion[];
}

function FactureForm({
  defaultValues, onSubmit, loading, error, onCancel, saisons, clients, camions,
}: FactureFormProps) {
  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const saisonId = Number(watch('saison_id')) || 0;

  const { data: operations, isLoading: operationsLoading } = useOperationsDisponibles(
    saisonId || undefined,
  );
  const { data: tarifs = [] } = useTarifs(saisonId || undefined);

  const [bordereauxSel, setBordereauxSel] = useState<Set<number>>(new Set());
  const [bsmsSel, setBsmsSel]           = useState<Set<number>>(new Set());
  const [erreurSelection, setErreurSelection] = useState<string | null>(null);

  // Changer de campagne vide la sélection (les opérations listées changent)
  useEffect(() => {
    setBordereauxSel(new Set());
    setBsmsSel(new Set());
    setErreurSelection(null);
  }, [saisonId]);

  const bordereaux = operations?.bordereaux ?? [];
  const bsms       = operations?.bsms ?? [];

  const camionMap = useMemo(
    () => new Map(camions.map((c) => [c.id, c.immatriculation])),
    [camions],
  );

  /** Coche/décoche un bordereau ; les BSM de sa mission suivent le mouvement. */
  function handleToggleBordereau(b: Bordereau, coche: boolean) {
    const bsmIds = b.mission_id
      ? bsms.filter((x) => x.mission_id === b.mission_id).map((x) => x.id)
      : [];

    setBordereauxSel((prev) => {
      const suivant = new Set(prev);
      if (coche) suivant.add(b.id);
      else suivant.delete(b.id);
      return suivant;
    });
    setBsmsSel((prev) => {
      const suivant = new Set(prev);
      bsmIds.forEach((id) => (coche ? suivant.add(id) : suivant.delete(id)));
      return suivant;
    });
  }

  /** Coche/décoche un BSM ; le bordereau de sa mission est associé à la coche. */
  function handleToggleBsm(bsm: BSM, coche: boolean) {
    setBsmsSel((prev) => {
      const suivant = new Set(prev);
      if (coche) suivant.add(bsm.id);
      else suivant.delete(bsm.id);
      return suivant;
    });
    if (coche && bsm.mission_id) {
      const bordereau = bordereaux.find(
        (b) => b.mission_id === bsm.mission_id && !raisonNonSelectionnable(b, tarifs),
      );
      if (bordereau) {
        setBordereauxSel((prev) => new Set(prev).add(bordereau.id));
      }
    }
  }

  const totalBrut = bordereaux
    .filter((b) => bordereauxSel.has(b.id))
    .reduce((somme, b) => somme + (calculerMontantBordereau(b, tarifs)?.montantBrut ?? 0), 0);
  const totalGasoil = bsms
    .filter((b) => bsmsSel.has(b.id))
    .reduce((somme, b) => somme + b.montant, 0);

  const saisonOptions = [
    { value: 0, label: '— Sélectionner —' },
    ...saisons.map((s) => ({ value: s.id, label: s.libelle })),
  ];
  const clientOptions = [
    { value: 0, label: '— Sélectionner —' },
    ...clients.map((c) => ({ value: c.id, label: c.nom })),
  ];

  const soumettre = handleSubmit((values) => {
    if (bordereauxSel.size === 0 && bsmsSel.size === 0) {
      setErreurSelection('Sélectionnez au moins un bordereau ou un BSM.');
      return;
    }
    setErreurSelection(null);
    return onSubmit(values, [...bordereauxSel], [...bsmsSel]);
  });

  return (
    <form onSubmit={soumettre} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Campagne"
          options={saisonOptions}
          error={errors.saison_id?.message}
          {...register('saison_id')}
        />
        <Select
          label="Client"
          options={clientOptions}
          error={errors.client_id?.message}
          {...register('client_id')}
        />
        <Input
          label="Numéro de la facture"
          placeholder="Ex. : F-2026-001"
          error={errors.numero?.message}
          {...register('numero')}
        />
        <Input
          type="date"
          label="Date de la facture"
          error={errors.date_facture?.message}
          {...register('date_facture')}
        />
        <Input
          label="Observations"
          placeholder="Remarques éventuelles…"
          {...register('observations')}
        />
      </div>

      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 accent-primary"
          {...register('mention_original_payable')}
        />
        <span className="text-sm">
          Imprimer la mention « ORIGINAL PAYABLE » sur l'exemplaire original de la facture
          (CDC v1.1)
        </span>
      </label>

      {!saisonId ? (
        <p className="text-sm text-muted-foreground">
          Choisissez une campagne pour afficher les bordereaux validés et les BSM à facturer.
        </p>
      ) : operationsLoading ? (
        <Spinner />
      ) : (
        <>
          {/* ── Bordereaux à facturer (transport) ─────────────────────────── */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">
              Bordereaux à facturer (transport)
            </p>
            <div className="max-h-56 overflow-y-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/50">
                  <tr>
                    <th className="px-2 py-2" />
                    <th className="px-2 py-2 text-left font-medium text-muted-foreground">Date</th>
                    <th className="px-2 py-2 text-left font-medium text-muted-foreground">N°</th>
                    <th className="px-2 py-2 text-left font-medium text-muted-foreground">Camion</th>
                    <th className="px-2 py-2 text-right font-medium text-muted-foreground">Dist.</th>
                    <th className="px-2 py-2 text-right font-medium text-muted-foreground">Poids net</th>
                    <th className="px-2 py-2 text-right font-medium text-muted-foreground">Tarif/t</th>
                    <th className="px-2 py-2 text-right font-medium text-muted-foreground">Brut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {bordereaux.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-2 py-3 text-center text-muted-foreground">
                        Aucun bordereau validé à facturer pour cette campagne.
                      </td>
                    </tr>
                  ) : (
                    bordereaux.map((b) => {
                      const raison = raisonNonSelectionnable(b, tarifs);
                      const montant = calculerMontantBordereau(b, tarifs);
                      return (
                        <tr key={b.id}>
                          <td className="px-2 py-1.5">
                            <input
                              type="checkbox"
                              className="h-4 w-4 accent-primary"
                              checked={bordereauxSel.has(b.id)}
                              disabled={!!raison}
                              title={raison ?? undefined}
                              onChange={(e) => handleToggleBordereau(b, e.target.checked)}
                              aria-label={`Sélectionner le bordereau ${b.numero}`}
                            />
                          </td>
                          <td className="px-2 py-1.5 text-muted-foreground">{formatDate(b.date_bordereau)}</td>
                          <td className="px-2 py-1.5 font-medium text-foreground">{b.numero}</td>
                          <td className="px-2 py-1.5 text-muted-foreground">
                            {camionMap.get(b.camion_id) ?? '—'}
                          </td>
                          <td className="px-2 py-1.5 text-right text-muted-foreground">
                            {b.distance_km != null ? `${b.distance_km} km` : '—'}
                          </td>
                          <td className="px-2 py-1.5 text-right text-muted-foreground">
                            {b.poids_net_kg != null ? formatKg(b.poids_net_kg) : '—'}
                          </td>
                          <td className="px-2 py-1.5 text-right text-muted-foreground">
                            {montant ? formatFCFA(montant.tarifTonne) : '—'}
                          </td>
                          <td className="px-2 py-1.5 text-right font-medium text-foreground">
                            {montant ? formatFCFA(montant.montantBrut) : '—'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── BSM à déduire (gasoil) ────────────────────────────────────── */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">BSM à déduire (gasoil)</p>
            <div className="max-h-56 overflow-y-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/50">
                  <tr>
                    <th className="px-2 py-2" />
                    <th className="px-2 py-2 text-left font-medium text-muted-foreground">Date</th>
                    <th className="px-2 py-2 text-left font-medium text-muted-foreground">N°</th>
                    <th className="px-2 py-2 text-left font-medium text-muted-foreground">Camion</th>
                    <th className="px-2 py-2 text-right font-medium text-muted-foreground">Quantité</th>
                    <th className="px-2 py-2 text-right font-medium text-muted-foreground">Montant</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {bsms.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-2 py-3 text-center text-muted-foreground">
                        Aucun BSM à facturer pour cette campagne.
                      </td>
                    </tr>
                  ) : (
                    bsms.map((b) => (
                      <tr key={b.id}>
                        <td className="px-2 py-1.5">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-primary"
                            checked={bsmsSel.has(b.id)}
                            onChange={(e) => handleToggleBsm(b, e.target.checked)}
                            aria-label={`Sélectionner le BSM ${b.numero}`}
                          />
                        </td>
                        <td className="px-2 py-1.5 text-muted-foreground">{formatDate(b.date_bsm)}</td>
                        <td className="px-2 py-1.5 font-medium text-foreground">{b.numero}</td>
                        <td className="px-2 py-1.5 text-muted-foreground">
                          {camionMap.get(b.camion_id) ?? '—'}
                        </td>
                        <td className="px-2 py-1.5 text-right text-muted-foreground">
                          {formatLitres(b.quantite_litres)}
                        </td>
                        <td className="px-2 py-1.5 text-right font-medium text-foreground">
                          {formatFCFA(b.montant)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">
              Les BSM des missions concernées sont associés automatiquement à la sélection d'un
              bordereau.
            </p>
          </div>

          {/* ── Totaux ────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Montant brut</p>
              <p className="mt-0.5 text-sm font-medium text-foreground">{formatFCFA(totalBrut)}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Gasoil (déduit)</p>
              <p className="mt-0.5 text-sm font-medium text-destructive">
                − {formatFCFA(totalGasoil)}
              </p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Montant net</p>
              <p className="mt-0.5 text-sm font-medium text-foreground">
                {formatFCFA(totalBrut - totalGasoil)}
              </p>
            </div>
          </div>
        </>
      )}

      {erreurSelection && <ErrorMessage message={erreurSelection} />}
      {error && <ErrorMessage message={error} />}

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" type="button" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit" loading={loading}>
          Créer la facture
        </Button>
      </div>
    </form>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function FacturesPage() {
  const navigate = useNavigate();
  const [filtreSaisonId, setFiltreSaisonId] = useState<number | undefined>(undefined);
  const [filtreStatut, setFiltreStatut]     = useState<StatutFacture | undefined>(undefined);

  const { data: factures = [], isLoading, error } = useFactures(filtreSaisonId, filtreStatut);
  const { data: saisons = [] } = useSaisons();
  const { data: clients = [] } = useClients();
  const { data: camions = [] } = useCamions();

  const creer     = useCreerFacture();
  const valider   = useValiderFacture();
  const supprimer = useSupprimerFacture();

  const [showCreate, setShowCreate]           = useState(false);
  const [viewing, setViewing]                 = useState<Facture | null>(null);
  const [aValider, setAValider]               = useState<Facture | null>(null);
  const [aSupprimer, setASupprimer]           = useState<Facture | null>(null);
  const [mutationError, setMutationError]     = useState<string | null>(null);
  const [actionError, setActionError]         = useState<string | null>(null);

  const { data: lignesLecture, isLoading: lignesLectureLoading } = useLignesFacture(viewing?.id);

  // Correspondances id → libellé pour l'affichage
  const saisonMap = useMemo(() => new Map(saisons.map((s) => [s.id, s.libelle])), [saisons]);
  const clientMap = useMemo(() => new Map(clients.map((c) => [c.id, c.nom])), [clients]);

  const saisonOuverte = saisons.find((s) => s.statut === 'ouverte');

  // ── Création ──────────────────────────────────────────────────────────────
  async function handleCreate(
    values: FormValues,
    bordereauIds: number[],
    bsmIds: number[],
  ) {
    setMutationError(null);
    try {
      await creer.mutateAsync({
        numero:        values.numero,
        saison_id:     values.saison_id,
        client_id:     values.client_id,
        date_facture:  values.date_facture,
        observations:  values.observations || undefined,
        mention_original_payable: values.mention_original_payable,
        bordereau_ids: bordereauIds,
        bsm_ids:       bsmIds,
      });
      setShowCreate(false);
    } catch (e: unknown) {
      setMutationError(e as string);
    }
  }

  // ── Validation / suppression ──────────────────────────────────────────────
  async function handleValider() {
    if (!aValider) return;
    setActionError(null);
    try {
      await valider.mutateAsync(aValider.id);
      setAValider(null);
    } catch (e: unknown) {
      setActionError(e as string);
      setAValider(null);
    }
  }

  async function handleSupprimer() {
    if (!aSupprimer) return;
    setActionError(null);
    try {
      await supprimer.mutateAsync(aSupprimer.id);
      setASupprimer(null);
    } catch (e: unknown) {
      setActionError(e as string);
      setASupprimer(null);
    }
  }

  // TKM affichés dans le détail : valeur générée à la facturation, repli sur
  // le calcul des lignes pour les factures antérieures à la Phase 7.
  const totalTkmLecture = (lignesLecture ?? []).reduce(
    (total, l) => total + (tkmLigne(l.poids_net_kg, l.distance_km) ?? 0),
    0,
  );
  const tkmVue = viewing?.tkm ?? (totalTkmLecture > 0 ? totalTkmLecture : null);

  if (isLoading) return <Spinner className="mt-16" />;
  if (error)     return <ErrorMessage message="Impossible de charger les factures." className="mt-4" />;

  return (
    <div>
      <PageHeader
        title="Factures"
        description="Facturez les bordereaux validés (transport) et déduisez le gasoil des BSM rattachés à leurs missions."
        actions={
          <Button icon={<Plus size={15} />} onClick={() => { setMutationError(null); setShowCreate(true); }}>
            Nouvelle facture
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
          options={[{ value: '', label: 'Tous les statuts' }, ...STATUTS_FACTURE]}
          value={filtreStatut ?? ''}
          onChange={(e) => setFiltreStatut((e.target.value || undefined) as StatutFacture | undefined)}
          className="w-56"
        />
      </div>

      {actionError && <ErrorMessage message={actionError} className="mb-4" />}

      {/* ── Tableau ─────────────────────────────────────────────────────────── */}
      {factures.length === 0 ? (
        <EmptyState
          icon={<Receipt size={40} />}
          title="Aucune facture enregistrée"
          description="Créez la première facture à partir des bordereaux validés et des BSM de gasoil."
          action={
            <Button size="sm" icon={<Plus size={14} />} onClick={() => setShowCreate(true)}>
              Nouvelle facture
            </Button>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">N° Facture</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Client</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Campagne</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Montant brut</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Gasoil</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Montant net</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Statut</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {factures.map((f) => (
                <tr key={f.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(f.date_facture)}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{f.numero}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {clientMap.get(f.client_id) ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{saisonMap.get(f.saison_id) ?? '—'}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    {formatFCFA(f.montant_brut)}
                  </td>
                  <td className="px-4 py-3 text-right text-destructive">
                    − {formatFCFA(f.montant_gasoil)}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-foreground">
                    {formatFCFA(f.montant_net)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={varianteStatutFacture(f.statut)}>
                      {labelStatutFacture(f.statut)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Eye size={13} />}
                        title="Consulter"
                        aria-label="Consulter la facture"
                        onClick={() => setViewing(f)}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Printer size={13} />}
                        title="Imprimer la facture"
                        aria-label="Imprimer la facture"
                        onClick={() => navigate(`/impression/facture/${f.id}`)}
                      />
                      {f.statut === 'brouillon' && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<Check size={13} />}
                            title="Valider la facture"
                            aria-label="Valider la facture"
                            disabled={valider.isPending}
                            onClick={() => setAValider(f)}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<Trash2 size={13} />}
                            title="Supprimer le brouillon"
                            aria-label="Supprimer la facture"
                            disabled={supprimer.isPending}
                            onClick={() => setASupprimer(f)}
                          />
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

      {/* ── Modal création ─────────────────────────────────────────────────── */}
      <Modal
        open={showCreate}
        onClose={() => { setShowCreate(false); setMutationError(null); }}
        title="Nouvelle facture"
        size="lg"
      >
        <FactureForm
          defaultValues={{
            saison_id:    saisonOuverte?.id ?? 0,
            client_id:    clients[0]?.id ?? 0,
            numero:       '',
            date_facture: new Date().toISOString().slice(0, 10),
            mention_original_payable: true,
          }}
          onSubmit={handleCreate}
          loading={creer.isPending}
          error={mutationError}
          onCancel={() => { setShowCreate(false); setMutationError(null); }}
          saisons={saisons}
          clients={clients}
          camions={camions}
        />
      </Modal>

      {/* ── Modal consultation ─────────────────────────────────────────────── */}
      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title="Détail de la facture"
        size="lg"
      >
        {viewing && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">Numéro</p>
                <p className="font-medium text-foreground">{viewing.numero}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Date</p>
                <p className="font-medium text-foreground">{formatDate(viewing.date_facture)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Client</p>
                <p className="font-medium text-foreground">{clientMap.get(viewing.client_id) ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Campagne</p>
                <p className="font-medium text-foreground">{saisonMap.get(viewing.saison_id) ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Statut</p>
                <Badge variant={varianteStatutFacture(viewing.statut)}>
                  {labelStatutFacture(viewing.statut)}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Mention « Original payable »</p>
                <p className="font-medium text-foreground">
                  {viewing.mention_original_payable ? 'Oui (original imprimé)' : 'Non'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Montant brut</p>
                <p className="mt-0.5 text-sm font-medium text-foreground">
                  {formatFCFA(viewing.montant_brut)}
                </p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Gasoil (déduit)</p>
                <p className="mt-0.5 text-sm font-medium text-destructive">
                  − {formatFCFA(viewing.montant_gasoil)}
                </p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Montant net</p>
                <p className="mt-0.5 text-sm font-medium text-foreground">
                  {formatFCFA(viewing.montant_net)}
                </p>
              </div>
            </div>

            {/* ── TKM et trajets générés (CDC v1.1 §11.1) ─────────────────── */}
            {(tkmVue != null || viewing.detail_trajet) && (
              <div className="grid grid-cols-2 gap-3">
                {tkmVue != null && (
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground">TKM total (trajets &gt; 90 km)</p>
                    <p className="mt-0.5 text-sm font-medium text-foreground">
                      {formatTKM(tkmVue)}
                    </p>
                  </div>
                )}
                {viewing.detail_trajet && (
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground">Détail du trajet</p>
                    <p className="mt-0.5 text-sm text-foreground">{viewing.detail_trajet}</p>
                  </div>
                )}
              </div>
            )}

            {lignesLectureLoading ? (
              <Spinner />
            ) : (
              <>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Description</th>
                        <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">Poids net</th>
                        <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">Dist.</th>
                        <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">Tarif/t</th>
                        <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">Brut</th>
                        <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">Gasoil</th>
                        <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">Net</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {(lignesLecture ?? []).map((l) => (
                        <tr key={l.id}>
                          <td className="px-3 py-2.5 text-foreground">{l.description || '—'}</td>
                          <td className="px-3 py-2.5 text-right text-muted-foreground">
                            {l.bordereau_id ? formatKg(l.poids_net_kg) : '—'}
                          </td>
                          <td className="px-3 py-2.5 text-right text-muted-foreground">
                            {l.bordereau_id ? `${l.distance_km} km` : '—'}
                          </td>
                          <td className="px-3 py-2.5 text-right text-muted-foreground">
                            {l.bordereau_id ? formatFCFA(l.tarif_tonne) : '—'}
                          </td>
                          <td className="px-3 py-2.5 text-right text-muted-foreground">
                            {l.bordereau_id ? formatFCFA(l.montant_brut) : '—'}
                          </td>
                          <td className="px-3 py-2.5 text-right text-destructive">
                            {l.bsm_id ? `− ${formatFCFA(l.montant_gasoil)}` : '—'}
                          </td>
                          <td className="px-3 py-2.5 text-right font-medium text-foreground">
                            {formatFCFA(l.montant_net)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {viewing.observations && (
                  <p className="text-sm text-muted-foreground">Observations : {viewing.observations}</p>
                )}
              </>
            )}
          </div>
        )}
      </Modal>

      {/* ── Confirmation de validation ─────────────────────────────────────── */}
      <ConfirmDialog
        open={!!aValider}
        onClose={() => setAValider(null)}
        onConfirm={handleValider}
        title="Valider la facture"
        message={
          aValider
            ? `La facture « ${aValider.numero} » deviendra définitive : les bordereaux et BSM rattachés passeront au statut « facturé » et les missions associées seront marquées comme facturées.`
            : ''
        }
        confirmLabel="Valider"
        variant="primary"
        loading={valider.isPending}
      />

      {/* ── Confirmation de suppression ────────────────────────────────────── */}
      <ConfirmDialog
        open={!!aSupprimer}
        onClose={() => setASupprimer(null)}
        onConfirm={handleSupprimer}
        title="Supprimer la facture"
        message={
          aSupprimer
            ? `La facture en brouillon « ${aSupprimer.numero} » et ses lignes seront définitivement supprimées. Les bordereaux et BSM redeviennent disponibles pour une autre facture.`
            : ''
        }
        confirmLabel="Supprimer"
        loading={supprimer.isPending}
      />
    </div>
  );
}
