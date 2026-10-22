import { useMemo, useState } from 'react';
import { Plus, Eye, Wallet, Banknote } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import {
  Button, Input, Select, Modal, Pagination,
  PageHeader, EmptyState, Spinner, ErrorMessage,
} from '@/components/ui';
import {
  useAvances, useCreerAvance, useEnregistrerUtilisationAvance, useUtilisationsAvance,
  useFactures, useSaisons, usePagination,
} from '@/hooks';
import type { Avance, Facture, Saison } from '@/types';
import { calculSoldeAvance, formatDate, formatFCFA } from '@/utils';

// ─── Schémas de validation ────────────────────────────────────────────────────
const schemaAvance = z.object({
  saison_id:       z.coerce.number({ invalid_type_error: 'La campagne est requise' }).min(1, 'La campagne est requise'),
  date_avance:     z.string().min(1, 'La date est requise'),
  montant_initial: z.coerce
    .number({ invalid_type_error: 'Le montant est requis' })
    .positive('Le montant doit être supérieur à 0'),
  reference:       z.string().optional(),
  observations:    z.string().optional(),
});
type AvanceFormValues = z.infer<typeof schemaAvance>;

const schemaUtilisation = z.object({
  date_utilisation: z.string().min(1, 'La date est requise'),
  montant:          z.coerce
    .number({ invalid_type_error: 'Le montant est requis' })
    .positive('Le montant doit être supérieur à 0'),
  facture_id:       z.coerce.number().optional(),
  observations:     z.string().optional(),
});
type UtilisationFormValues = z.infer<typeof schemaUtilisation>;

// ─── Formulaire de création d'avance ──────────────────────────────────────────
interface AvanceFormProps {
  saisons: Saison[];
  defaultValues: Partial<AvanceFormValues>;
  onSubmit: (values: AvanceFormValues) => Promise<void>;
  loading: boolean;
  error?: string | null;
  onCancel: () => void;
}

function AvanceForm({ saisons, defaultValues, onSubmit, loading, error, onCancel }: AvanceFormProps) {
  const { register, handleSubmit, formState: { errors } } = useForm<AvanceFormValues>({
    resolver: zodResolver(schemaAvance),
    defaultValues,
  });

  const saisonOptions = saisons.map((s) => ({
    value: s.id,
    label: `${s.libelle} (${s.statut === 'ouverte' ? 'ouverte' : 'clôturée'})`,
  }));

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Campagne"
          options={saisonOptions}
          error={errors.saison_id?.message}
          {...register('saison_id')}
        />
        <Input
          type="date"
          label="Date de l'avance"
          error={errors.date_avance?.message}
          {...register('date_avance')}
        />
        <Input
          type="number"
          step="1"
          label="Montant initial (FCFA)"
          placeholder="Ex. : 5000000"
          error={errors.montant_initial?.message}
          {...register('montant_initial')}
        />
        <Input
          label="Référence"
          placeholder="Ex. : n° de reçu, convention…"
          {...register('reference')}
        />
        <Input
          label="Observations"
          placeholder="Remarques éventuelles…"
          {...register('observations')}
        />
      </div>

      {error && <ErrorMessage message={error} />}

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" type="button" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit" loading={loading}>
          Créer l'avance
        </Button>
      </div>
    </form>
  );
}

// ─── Formulaire d'utilisation d'une avance ────────────────────────────────────
interface UtilisationFormProps {
  avance: Avance;
  factures: Facture[];
  defaultValues: Partial<UtilisationFormValues>;
  onSubmit: (values: UtilisationFormValues) => Promise<void>;
  loading: boolean;
  error?: string | null;
  onCancel: () => void;
}

function UtilisationForm({
  avance, factures, defaultValues, onSubmit, loading, error, onCancel,
}: UtilisationFormProps) {
  const [erreurLocale, setErreurLocale] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors } } = useForm<UtilisationFormValues>({
    resolver: zodResolver(schemaUtilisation),
    defaultValues,
  });

  const solde = calculSoldeAvance(avance.montant_initial, avance.montant_utilise);

  const factureOptions = [
    { value: 0, label: '— Aucune —' },
    ...factures
      .filter((f) => f.statut !== 'brouillon')
      .map((f) => ({ value: f.id, label: `${f.numero} — ${formatFCFA(f.montant_net)}` })),
  ];

  const soumettre = handleSubmit((values) => {
    // Vérification locale du solde (le backend applique la même règle)
    if (values.montant > solde) {
      setErreurLocale(`Le montant dépasse le solde disponible de l'avance (${formatFCFA(solde)}).`);
      return;
    }
    setErreurLocale(null);
    return onSubmit(values);
  });

  return (
    <form onSubmit={soumettre} className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">Montant initial</p>
          <p className="mt-0.5 text-sm font-medium text-foreground">
            {formatFCFA(avance.montant_initial)}
          </p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">Déjà utilisé</p>
          <p className="mt-0.5 text-sm font-medium text-foreground">
            {formatFCFA(avance.montant_utilise)}
          </p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">Solde disponible</p>
          <p className="mt-0.5 text-sm font-medium text-foreground">{formatFCFA(solde)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input
          type="date"
          label="Date de l'utilisation"
          error={errors.date_utilisation?.message}
          {...register('date_utilisation')}
        />
        <Input
          type="number"
          step="1"
          label="Montant (FCFA)"
          error={errors.montant?.message}
          {...register('montant')}
        />
        <Select
          label="Facture réglée (facultatif)"
          options={factureOptions}
          error={errors.facture_id?.message}
          {...register('facture_id')}
        />
        <Input
          label="Observations"
          placeholder="Remarques éventuelles…"
          {...register('observations')}
        />
      </div>

      {erreurLocale && <ErrorMessage message={erreurLocale} />}
      {error && <ErrorMessage message={error} />}

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" type="button" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit" loading={loading}>
          Enregistrer l'utilisation
        </Button>
      </div>
    </form>
  );
}

// ─── Détail des utilisations (consultation) ───────────────────────────────────
function UtilisationsDetail({
  avanceId, factureMap,
}: {
  avanceId: number;
  factureMap: Map<number, Facture>;
}) {
  const { data: utilisations = [], isLoading, error } = useUtilisationsAvance(avanceId);

  if (isLoading) return <Spinner className="py-8" />;
  if (error)     return <ErrorMessage message="Impossible de charger les utilisations." />;
  if (utilisations.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aucune utilisation enregistrée pour cette avance.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Date</th>
            <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Facture réglée</th>
            <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Montant</th>
            <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Observations</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {utilisations.map((u) => (
            <tr key={u.id}>
              <td className="px-4 py-2.5 text-muted-foreground">{formatDate(u.date_utilisation)}</td>
              <td className="px-4 py-2.5 text-muted-foreground">
                {u.facture_id ? factureMap.get(u.facture_id)?.numero ?? `#${u.facture_id}` : '—'}
              </td>
              <td className="px-4 py-2.5 text-right font-medium text-foreground">
                {formatFCFA(u.montant)}
              </td>
              <td className="px-4 py-2.5 text-muted-foreground">{u.observations || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function AvancesPage() {
  const [filtreSaisonId, setFiltreSaisonId] = useState<number | undefined>(undefined);

  const { data: avances = [], isLoading, error } = useAvances(filtreSaisonId);
  const { data: saisons = [] }  = useSaisons();
  const { data: factures = [] } = useFactures();

  const creer   = useCreerAvance();
  const utiliser = useEnregistrerUtilisationAvance();

  const [showCreate, setShowCreate]       = useState(false);
  const [utilisant, setUtilisant]         = useState<Avance | null>(null);
  const [consulting, setConsulting]       = useState<Avance | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);

  // Correspondances id → entité pour l'affichage
  const factureMap = useMemo(() => new Map(factures.map((f) => [f.id, f])), [factures]);
  const saisonMap  = useMemo(() => new Map(saisons.map((s) => [s.id, s.libelle])), [saisons]);

  const saisonOuverte = saisons.find((s) => s.statut === 'ouverte');

  const pagination = usePagination(avances);

  const totaux = useMemo(
    () =>
      avances.reduce(
        (acc, a) => ({
          initial: acc.initial + a.montant_initial,
          utilise: acc.utilise + a.montant_utilise,
        }),
        { initial: 0, utilise: 0 },
      ),
    [avances],
  );

  // ── Création ──────────────────────────────────────────────────────────────
  async function handleCreate(values: AvanceFormValues) {
    setMutationError(null);
    try {
      await creer.mutateAsync({
        saison_id:       values.saison_id,
        date_avance:     values.date_avance,
        montant_initial: values.montant_initial,
        reference:       values.reference || undefined,
        observations:    values.observations || undefined,
      });
      setShowCreate(false);
    } catch (e: unknown) {
      setMutationError(e as string);
    }
  }

  // ── Utilisation ───────────────────────────────────────────────────────────
  async function handleUtilisation(values: UtilisationFormValues) {
    if (!utilisant) return;
    setMutationError(null);
    try {
      await utiliser.mutateAsync({
        avance_id:        utilisant.id,
        facture_id:       values.facture_id || undefined,
        date_utilisation: values.date_utilisation,
        montant:          values.montant,
        observations:     values.observations || undefined,
      });
      setUtilisant(null);
    } catch (e: unknown) {
      setMutationError(e as string);
    }
  }

  if (isLoading) return <Spinner className="mt-16" />;
  if (error)     return <ErrorMessage message="Impossible de charger les avances." className="mt-4" />;

  return (
    <div>
      <PageHeader
        title="Avances"
        description="Suivez les avances de campagne accordées par le client : montants reçus, utilisations éventuellement rattachées aux factures, et solde restant."
        actions={
          <Button icon={<Plus size={15} />} onClick={() => { setMutationError(null); setShowCreate(true); }}>
            Nouvelle avance
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
          onChange={(e) => { setFiltreSaisonId(Number(e.target.value) || undefined); pagination.reset(); }}
          className="w-56"
        />
      </div>

      {avances.length === 0 ? (
        <EmptyState
          icon={<Banknote size={40} />}
          title="Aucune avance enregistrée"
          description="Enregistrez la première avance de campagne pour suivre les fonds reçus et leur utilisation."
          action={
            <Button size="sm" icon={<Plus size={14} />} onClick={() => setShowCreate(true)}>
              Nouvelle avance
            </Button>
          }
        />
      ) : (
        <>
          {/* ── Totaux ──────────────────────────────────────────────────────── */}
          <div className="mb-4 grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-border p-4">
              <p className="text-xs text-muted-foreground">Total avancé</p>
              <p className="mt-1 text-lg font-semibold text-foreground">
                {formatFCFA(totaux.initial)}
              </p>
            </div>
            <div className="rounded-lg border border-border p-4">
              <p className="text-xs text-muted-foreground">Total utilisé</p>
              <p className="mt-1 text-lg font-semibold text-foreground">
                {formatFCFA(totaux.utilise)}
              </p>
            </div>
            <div className="rounded-lg border border-border p-4">
              <p className="text-xs text-muted-foreground">Solde global</p>
              <p className="mt-1 text-lg font-semibold text-foreground">
                {formatFCFA(totaux.initial - totaux.utilise)}
              </p>
            </div>
          </div>

          {/* ── Tableau ─────────────────────────────────────────────────────── */}
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Campagne</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Montant initial</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Utilisé</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Solde</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Référence</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pagination.items.map((a) => {
                  const solde = calculSoldeAvance(a.montant_initial, a.montant_utilise);
                  return (
                    <tr key={a.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(a.date_avance)}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {saisonMap.get(a.saison_id) ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-foreground">
                        {formatFCFA(a.montant_initial)}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {formatFCFA(a.montant_utilise)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-foreground">
                        {formatFCFA(solde)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{a.reference || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<Eye size={13} />}
                            title="Consulter le détail"
                            aria-label="Consulter le détail"
                            onClick={() => setConsulting(a)}
                          >
                            Consulter
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<Wallet size={13} />}
                            title={solde > 0 ? "Enregistrer une utilisation" : 'Le solde de cette avance est épuisé.'}
                            aria-label="Enregistrer une utilisation"
                            disabled={solde <= 0}
                            onClick={() => { setMutationError(null); setUtilisant(a); }}
                          >
                            Utiliser
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
            className="mt-2"
          />
        </>
      )}

      {/* ── Modal création ─────────────────────────────────────────────────── */}
      <Modal
        open={showCreate}
        onClose={() => { setShowCreate(false); setMutationError(null); }}
        title="Nouvelle avance"
        size="lg"
      >
        <AvanceForm
          saisons={saisons}
          defaultValues={{
            saison_id:       saisonOuverte?.id ?? 0,
            date_avance:     new Date().toISOString().slice(0, 10),
            montant_initial: undefined as unknown as number,
            reference:       '',
            observations:    '',
          }}
          onSubmit={handleCreate}
          loading={creer.isPending}
          error={mutationError}
          onCancel={() => { setShowCreate(false); setMutationError(null); }}
        />
      </Modal>

      {/* ── Modal utilisation ──────────────────────────────────────────────── */}
      <Modal
        open={!!utilisant}
        onClose={() => { setUtilisant(null); setMutationError(null); }}
        title="Utiliser l'avance"
        size="lg"
      >
        {utilisant && (
          <UtilisationForm
            key={utilisant.id}
            avance={utilisant}
            factures={factures}
            defaultValues={{
              date_utilisation: new Date().toISOString().slice(0, 10),
              montant:          Math.max(calculSoldeAvance(utilisant.montant_initial, utilisant.montant_utilise), 0),
              facture_id:       0,
              observations:     '',
            }}
            onSubmit={handleUtilisation}
            loading={utiliser.isPending}
            error={mutationError}
            onCancel={() => { setUtilisant(null); setMutationError(null); }}
          />
        )}
      </Modal>

      {/* ── Modal consultation ─────────────────────────────────────────────── */}
      <Modal
        open={!!consulting}
        onClose={() => setConsulting(null)}
        title="Détail de l'avance"
        size="lg"
      >
        {consulting && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Montant initial</p>
                <p className="mt-0.5 text-sm font-medium text-foreground">
                  {formatFCFA(consulting.montant_initial)}
                </p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Déjà utilisé</p>
                <p className="mt-0.5 text-sm font-medium text-foreground">
                  {formatFCFA(consulting.montant_utilise)}
                </p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Solde disponible</p>
                <p className="mt-0.5 text-sm font-medium text-foreground">
                  {formatFCFA(calculSoldeAvance(consulting.montant_initial, consulting.montant_utilise))}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Date : </span>
                <span className="text-foreground">{formatDate(consulting.date_avance)}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Campagne : </span>
                <span className="text-foreground">{saisonMap.get(consulting.saison_id) ?? '—'}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Référence : </span>
                <span className="text-foreground">{consulting.reference || '—'}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Observations : </span>
                <span className="text-foreground">{consulting.observations || '—'}</span>
              </p>
            </div>

            <div>
              <h4 className="mb-2 text-sm font-medium text-foreground">Utilisations</h4>
              <UtilisationsDetail avanceId={consulting.id} factureMap={factureMap} />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
