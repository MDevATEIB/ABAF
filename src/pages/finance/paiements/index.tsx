import { useMemo, useState } from 'react';
import { Plus, Pencil, Coins } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import {
  Button, Input, Select, Badge, Modal,
  PageHeader, EmptyState, Spinner, ErrorMessage,
} from '@/components/ui';
import {
  usePaiements, useCreerPaiement, useModifierPaiement,
  useFactures, useSaisons, useClients,
} from '@/hooks';
import type { Facture, Paiement, StatutPaiement } from '@/types';
import { formatDate, formatFCFA } from '@/utils';

// ─── Statuts d'un paiement ────────────────────────────────────────────────────
const STATUTS_PAIEMENT: { value: StatutPaiement; label: string }[] = [
  { value: 'paye',   label: 'Payé' },
  { value: 'impaye', label: 'Impayé' },
  { value: 'np',     label: 'Non payé' },
];

function labelStatutPaiement(statut: StatutPaiement) {
  return STATUTS_PAIEMENT.find((s) => s.value === statut)?.label ?? statut;
}

function varianteStatutPaiement(statut: StatutPaiement): 'success' | 'warning' | 'muted' {
  if (statut === 'paye') return 'success';
  if (statut === 'impaye') return 'warning';
  return 'muted';
}

/** Total réglé ('paye') sur une facture, en excluant éventuellement un paiement. */
function totalRegle(factureId: number, paiements: Paiement[], excluId?: number): number {
  return paiements
    .filter((p) => p.facture_id === factureId && p.statut === 'paye' && p.id !== excluId)
    .reduce((somme, p) => somme + p.montant, 0);
}

// ─── Schéma de validation ─────────────────────────────────────────────────────
const schema = z.object({
  facture_id:    z.coerce.number({ invalid_type_error: 'La facture est requise' }).min(1, 'La facture est requise'),
  date_paiement: z.string().min(1, 'La date est requise'),
  montant:       z.coerce
    .number({ invalid_type_error: 'Le montant est requis' })
    .positive('Le montant doit être supérieur à 0'),
  mode_paiement: z.string().optional(),
  reference:     z.string().optional(),
  statut:        z.enum(['paye', 'impaye', 'np']),
  observations:  z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

// ─── Formulaire (création + modification) ─────────────────────────────────────
interface PaiementFormProps {
  defaultValues: Partial<FormValues>;
  onSubmit: (values: FormValues) => Promise<void>;
  loading: boolean;
  error?: string | null;
  onCancel: () => void;
  factures: Facture[];
  paiements: Paiement[];
  isEdit?: boolean;
  paiementId?: number;
}

function PaiementForm({
  defaultValues, onSubmit, loading, error, onCancel,
  factures, paiements, isEdit = false, paiementId,
}: PaiementFormProps) {
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const factureId = Number(watch('facture_id')) || 0;
  const facture   = factures.find((f) => f.id === factureId);
  const dejaRegle = factureId ? totalRegle(factureId, paiements, paiementId) : 0;
  const resteDu   = facture ? facture.montant_net - dejaRegle : 0;

  // Seules les factures validées ou payées peuvent recevoir un paiement
  const factureOptions = [
    { value: 0, label: '— Sélectionner —' },
    ...factures
      .filter((f) => f.statut !== 'brouillon')
      .map((f) => ({ value: f.id, label: `${f.numero} — ${formatFCFA(f.montant_net)}` })),
  ];

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Facture"
          options={factureOptions}
          error={errors.facture_id?.message}
          disabled={isEdit}
          {...register('facture_id', {
            onChange: (e) => {
              if (isEdit) return;
              const factureChoisie = factures.find((f) => f.id === Number(e.target.value));
              if (!factureChoisie) return;
              // Pré-remplir le montant avec le reste dû de la facture
              const reste = factureChoisie.montant_net - totalRegle(factureChoisie.id, paiements);
              if (reste > 0) setValue('montant', reste);
            },
          })}
        />
        <Input
          type="date"
          label="Date du paiement"
          error={errors.date_paiement?.message}
          {...register('date_paiement')}
        />
        <Input
          type="number"
          step="1"
          label="Montant (FCFA)"
          placeholder="Ex. : 1250000"
          error={errors.montant?.message}
          {...register('montant')}
        />
        <Input
          label="Mode de paiement"
          placeholder="Ex. : Espèces, chèque, virement…"
          {...register('mode_paiement')}
        />
        <Input
          label="Référence"
          placeholder="Ex. : n° de chèque, bordereau de virement…"
          {...register('reference')}
        />
        <Select
          label="Statut"
          options={STATUTS_PAIEMENT}
          error={errors.statut?.message}
          {...register('statut')}
        />
        <Input
          label="Observations"
          placeholder="Remarques éventuelles…"
          {...register('observations')}
        />
      </div>

      {facture && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground">Montant net de la facture</p>
            <p className="mt-0.5 text-sm font-medium text-foreground">
              {formatFCFA(facture.montant_net)}
            </p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground">Déjà réglé</p>
            <p className="mt-0.5 text-sm font-medium text-foreground">{formatFCFA(dejaRegle)}</p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground">Reste dû</p>
            <p className="mt-0.5 text-sm font-medium text-foreground">
              {formatFCFA(Math.max(resteDu, 0))}
            </p>
          </div>
        </div>
      )}

      {error && <ErrorMessage message={error} />}

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" type="button" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit" loading={loading}>
          {isEdit ? 'Enregistrer' : 'Enregistrer le paiement'}
        </Button>
      </div>
    </form>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function PaiementsPage() {
  const [filtreSaisonId, setFiltreSaisonId] = useState<number | undefined>(undefined);
  const [filtreStatut, setFiltreStatut]     = useState<StatutPaiement | undefined>(undefined);

  // Tous les paiements sont chargés pour calculer les restes dus par facture ;
  // les filtres de la page sont appliqués localement.
  const { data: paiements = [], isLoading, error } = usePaiements();
  const { data: factures = [] } = useFactures();
  const { data: saisons = [] }  = useSaisons();
  const { data: clients = [] }  = useClients();

  const creer   = useCreerPaiement();
  const modifier = useModifierPaiement();

  const [showCreate, setShowCreate]       = useState(false);
  const [editing, setEditing]             = useState<Paiement | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);

  // Correspondances id → entité pour l'affichage
  const factureMap = useMemo(() => new Map(factures.map((f) => [f.id, f])), [factures]);
  const saisonMap  = useMemo(() => new Map(saisons.map((s) => [s.id, s.libelle])), [saisons]);
  const clientMap  = useMemo(() => new Map(clients.map((c) => [c.id, c.nom])), [clients]);

  const paiementsFiltres = useMemo(() => {
    return paiements.filter((p) => {
      const facture = factureMap.get(p.facture_id);
      if (filtreSaisonId && facture?.saison_id !== filtreSaisonId) return false;
      if (filtreStatut && p.statut !== filtreStatut) return false;
      return true;
    });
  }, [paiements, factureMap, filtreSaisonId, filtreStatut]);

  // ── Création ──────────────────────────────────────────────────────────────
  async function handleCreate(values: FormValues) {
    setMutationError(null);
    try {
      await creer.mutateAsync({
        facture_id:    values.facture_id,
        date_paiement: values.date_paiement,
        montant:       values.montant,
        mode_paiement: values.mode_paiement || undefined,
        reference:     values.reference || undefined,
        statut:        values.statut,
        observations:  values.observations || undefined,
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
          date_paiement: values.date_paiement,
          montant:       values.montant,
          mode_paiement: values.mode_paiement || undefined,
          reference:     values.reference || undefined,
          statut:        values.statut,
          observations:  values.observations || undefined,
        },
      });
      setEditing(null);
    } catch (e: unknown) {
      setMutationError(e as string);
    }
  }

  if (isLoading) return <Spinner className="mt-16" />;
  if (error)     return <ErrorMessage message="Impossible de charger les paiements." className="mt-4" />;

  return (
    <div>
      <PageHeader
        title="Paiements"
        description="Enregistrez les règlements des factures validées ; une facture soldée passe à « payée » et les missions à « payé »."
        actions={
          <Button icon={<Plus size={15} />} onClick={() => { setMutationError(null); setShowCreate(true); }}>
            Nouveau paiement
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
          options={[{ value: '', label: 'Tous les statuts' }, ...STATUTS_PAIEMENT]}
          value={filtreStatut ?? ''}
          onChange={(e) => setFiltreStatut((e.target.value || undefined) as StatutPaiement | undefined)}
          className="w-56"
        />
      </div>

      {/* ── Tableau ─────────────────────────────────────────────────────────── */}
      {paiementsFiltres.length === 0 ? (
        <EmptyState
          icon={<Coins size={40} />}
          title="Aucun paiement enregistré"
          description="Enregistrez le premier règlement d'une facture validée pour suivre les encaissements."
          action={
            <Button size="sm" icon={<Plus size={14} />} onClick={() => setShowCreate(true)}>
              Nouveau paiement
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
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Montant</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Mode</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Référence</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Statut</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paiementsFiltres.map((p) => {
                const facture = factureMap.get(p.facture_id);
                return (
                  <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(p.date_paiement)}</td>
                    <td className="px-4 py-3 font-medium text-foreground">
                      {facture?.numero ?? `#${p.facture_id}`}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {facture ? clientMap.get(facture.client_id) ?? '—' : '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {facture ? saisonMap.get(facture.saison_id) ?? '—' : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-foreground">
                      {formatFCFA(p.montant)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{p.mode_paiement || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.reference || '—'}</td>
                    <td className="px-4 py-3">
                      <Badge variant={varianteStatutPaiement(p.statut)}>
                        {labelStatutPaiement(p.statut)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Pencil size={13} />}
                          title="Modifier le paiement"
                          aria-label="Modifier le paiement"
                          onClick={() => { setMutationError(null); setEditing(p); }}
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
        title="Nouveau paiement"
        size="lg"
      >
        <PaiementForm
          defaultValues={{
            facture_id:    0,
            date_paiement: new Date().toISOString().slice(0, 10),
            montant:       undefined as unknown as number,
            mode_paiement: '',
            reference:     '',
            statut:        'paye',
            observations:  '',
          }}
          onSubmit={handleCreate}
          loading={creer.isPending}
          error={mutationError}
          onCancel={() => { setShowCreate(false); setMutationError(null); }}
          factures={factures}
          paiements={paiements}
        />
      </Modal>

      {/* ── Modal modification ─────────────────────────────────────────────── */}
      <Modal
        open={!!editing}
        onClose={() => { setEditing(null); setMutationError(null); }}
        title="Modifier le paiement"
        size="lg"
      >
        {editing && (
          <PaiementForm
            key={editing.id}
            isEdit
            paiementId={editing.id}
            defaultValues={{
              facture_id:    editing.facture_id,
              date_paiement: editing.date_paiement,
              montant:       editing.montant,
              mode_paiement: editing.mode_paiement ?? '',
              reference:     editing.reference ?? '',
              statut:        editing.statut as StatutPaiement,
              observations:  editing.observations ?? '',
            }}
            onSubmit={handleEdit}
            loading={modifier.isPending}
            error={mutationError}
            onCancel={() => { setEditing(null); setMutationError(null); }}
            factures={factures}
            paiements={paiements}
          />
        )}
      </Modal>
    </div>
  );
}
