import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertCircle,
  Banknote,
  Check,
  Coins,
  Droplet,
  FileBarChart,
  FileText,
  Fuel,
  MapPin,
  Package,
  Receipt,
  Route,
  Scale,
  Truck,
  Wallet,
} from 'lucide-react';

import { Select, PageHeader, EmptyState, Spinner, ErrorMessage } from '@/components/ui';
import { useDashboardStats, useSaisons } from '@/hooks';
import { useAppStore } from '@/stores/app.store';
import { cn } from '@/lib/utils';
import { formatDistance, formatFCFA, formatKg, formatLitres } from '@/utils';
import type { ComparaisonCampagne, TotauxRapport } from '@/types';

// ─── Graphiques : couleurs en hex (les attributs SVG n'acceptent pas les
// variables CSS du thème) ─────────────────────────────────────────────────────
const COULEUR_PRIMAIRE = '#0a50c3'; // --primary (bleu ABAF)
const COULEUR_GASOIL = '#f59e0b';
const COULEUR_NET = '#16a34a';
const COULEUR_PAYE = '#0ea5e9';
const COULEUR_IMPAYE = '#ef4444';
const COULEUR_GRILLE = '#e2e8f0';
const COULEUR_AXE = '#64748b';

/** Nombre arrondi avec séparateurs français (ex. 12 345,7). */
function formatNombre(valeur: number, decimales = 0): string {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: decimales }).format(valeur);
}

/** Tonnage pour les graphiques (ex. 24 200 kg → « 24,2 t »). */
function formatTonne(tonnage: number): string {
  return `${formatNombre(tonnage, 1)} t`;
}

/** Axe des montants : notation compacte française (ex. 1,2 M). */
function formatCompact(valeur: number): string {
  return new Intl.NumberFormat('fr-FR', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(valeur);
}

// ─── Carte KPI ────────────────────────────────────────────────────────────────
function CarteKpi({
  label,
  valeur,
  icone,
  valeurClassName,
}: {
  label: string;
  valeur: string;
  icone: React.ReactNode;
  valeurClassName?: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="rounded-md bg-primary/10 p-2 text-primary">{icone}</div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p
          className={cn(
            'mt-1 truncate text-lg font-semibold text-foreground',
            valeurClassName,
          )}
        >
          {valeur}
        </p>
      </div>
    </div>
  );
}

// ─── Groupe de cartes ─────────────────────────────────────────────────────────
function SectionCartes({
  titre,
  classeGrille = 'md:grid-cols-4',
  children,
}: {
  titre: string;
  classeGrille?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-2 text-sm font-medium text-muted-foreground">{titre}</h3>
      <div className={cn('grid grid-cols-2 gap-3', classeGrille)}>{children}</div>
    </section>
  );
}

// ─── Cadre de graphique ───────────────────────────────────────────────────────
function CarteGraphique({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <h3 className="mb-4 text-sm font-medium text-foreground">{titre}</h3>
      <div className="h-64">{children}</div>
    </div>
  );
}

/** Tonnage de coton par campagne, en tonnes (graphique de comparaison). */
function GraphiqueTonnage({ comparaison }: { comparaison: ComparaisonCampagne[] }) {
  const donnees = comparaison.map((c) => ({
    campagne: c.libelle,
    tonnage: c.tonnage_coton_kg / 1000,
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={donnees} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={COULEUR_GRILLE} vertical={false} />
        <XAxis
          dataKey="campagne"
          tick={{ fontSize: 12, fill: COULEUR_AXE }}
          tickLine={false}
          axisLine={{ stroke: COULEUR_GRILLE }}
        />
        <YAxis
          width={56}
          tick={{ fontSize: 12, fill: COULEUR_AXE }}
          tickLine={false}
          axisLine={false}
          tickFormatter={formatTonne}
        />
        <Tooltip formatter={(value) => [formatTonne(Number(value)), 'Tonnage coton']} />
        <Bar
          dataKey="tonnage"
          fill={COULEUR_PRIMAIRE}
          radius={[4, 4, 0, 0]}
          maxBarSize={56}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Cascade financière de la campagne : brut, gasoil, net, payé, impayé. */
function GraphiqueFinances({ totaux }: { totaux: TotauxRapport }) {
  const donnees = [
    { etape: 'Brut', montant: totaux.montant_brut, couleur: COULEUR_PRIMAIRE },
    { etape: 'Gasoil', montant: totaux.montant_gasoil, couleur: COULEUR_GASOIL },
    { etape: 'Net', montant: totaux.montant_net, couleur: COULEUR_NET },
    { etape: 'Payé', montant: totaux.montant_paye, couleur: COULEUR_PAYE },
    { etape: 'Impayé', montant: totaux.montant_impaye, couleur: COULEUR_IMPAYE },
  ];

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={donnees} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={COULEUR_GRILLE} vertical={false} />
        <XAxis
          dataKey="etape"
          tick={{ fontSize: 12, fill: COULEUR_AXE }}
          tickLine={false}
          axisLine={{ stroke: COULEUR_GRILLE }}
        />
        <YAxis
          width={64}
          tick={{ fontSize: 12, fill: COULEUR_AXE }}
          tickLine={false}
          axisLine={false}
          tickFormatter={formatCompact}
        />
        <Tooltip formatter={(value) => [formatFCFA(Number(value)), 'Montant']} />
        <Bar dataKey="montant" radius={[4, 4, 0, 0]} maxBarSize={56}>
          {donnees.map((d) => (
            <Cell key={d.etape} fill={d.couleur} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [filtreSaisonId, setFiltreSaisonId] = useState<number | undefined>(undefined);
  const setPageTitle = useAppStore((s) => s.setPageTitle);

  useEffect(() => {
    setPageTitle('Tableau de bord');
  }, [setPageTitle]);

  const { data: saisons = [] } = useSaisons();
  const { data, isLoading, error } = useDashboardStats(filtreSaisonId);

  const messageErreur = error ? (error instanceof Error ? error.message : String(error)) : null;

  // Les graphiques n'apparaissent que si l'historique ou la campagne
  // contient des opérations à représenter.
  const aTonnage = data ? data.comparaison.some((c) => c.nb_bordereaux > 0) : false;
  const aFinances = data ? data.totaux.montant_brut > 0 : false;

  return (
    <div>
      <PageHeader
        title="Tableau de bord"
        description="Vue d'ensemble de la campagne : opérations, transport, gasoil et situation financière."
      />

      {/* ── Filtre campagne ───────────────────────────────────────────────── */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Select
          label="Campagne"
          options={[
            { value: 0, label: 'Campagne ouverte' },
            ...saisons.map((s) => ({
              value: s.id,
              label: `${s.libelle} (${s.statut === 'ouverte' ? 'ouverte' : 'clôturée'})`,
            })),
          ]}
          value={filtreSaisonId ?? 0}
          onChange={(e) => setFiltreSaisonId(Number(e.target.value) || undefined)}
          className="w-64"
        />
      </div>

      {isLoading ? (
        <Spinner className="mt-16" />
      ) : messageErreur ? (
        <ErrorMessage message={messageErreur} className="mt-4" />
      ) : data ? (
        <div className="space-y-6">
          {/* ── Opérations ──────────────────────────────────────────────── */}
          <SectionCartes titre="Opérations">
            <CarteKpi
              label="Missions"
              valeur={formatNombre(data.totaux.nb_missions)}
              icone={<Route size={18} />}
            />
            <CarteKpi
              label="Camions actifs"
              valeur={formatNombre(data.nb_camions_actifs)}
              icone={<Truck size={18} />}
            />
            <CarteKpi
              label="Bordereaux"
              valeur={formatNombre(data.totaux.nb_bordereaux)}
              icone={<FileText size={18} />}
            />
            <CarteKpi
              label="BSM"
              valeur={formatNombre(data.totaux.nb_bsm)}
              icone={<Fuel size={18} />}
            />
          </SectionCartes>

          {/* ── Transport & gasoil ──────────────────────────────────────── */}
          <SectionCartes titre="Transport & gasoil">
            <CarteKpi
              label="Tonnage coton"
              valeur={formatKg(data.totaux.tonnage_coton_kg)}
              icone={<Scale size={18} />}
            />
            <CarteKpi
              label="Tonnage intrants"
              valeur={formatKg(data.totaux.tonnage_intrants_kg)}
              icone={<Package size={18} />}
            />
            <CarteKpi
              label="Distance totale"
              valeur={formatDistance(data.totaux.distance_totale_km)}
              icone={<MapPin size={18} />}
            />
            <CarteKpi
              label="Gasoil"
              valeur={formatLitres(data.totaux.gasoil_litres)}
              icone={<Droplet size={18} />}
            />
          </SectionCartes>

          {/* ── Finances ────────────────────────────────────────────────── */}
          <SectionCartes titre="Finances" classeGrille="md:grid-cols-3">
            <CarteKpi
              label="Montant brut"
              valeur={formatFCFA(data.totaux.montant_brut)}
              icone={<Receipt size={18} />}
            />
            <CarteKpi
              label="Montant gasoil"
              valeur={formatFCFA(data.totaux.montant_gasoil)}
              icone={<Coins size={18} />}
            />
            <CarteKpi
              label="Montant net"
              valeur={formatFCFA(data.totaux.montant_net)}
              icone={<Wallet size={18} />}
            />
            <CarteKpi
              label="Montant payé"
              valeur={formatFCFA(data.totaux.montant_paye)}
              icone={<Check size={18} />}
            />
            <CarteKpi
              label="Montant impayé"
              valeur={formatFCFA(data.totaux.montant_impaye)}
              icone={<AlertCircle size={18} />}
              valeurClassName={data.totaux.montant_impaye > 0 ? 'text-destructive' : undefined}
            />
            <CarteKpi
              label="Solde avances"
              valeur={formatFCFA(data.totaux.solde_avances)}
              icone={<Banknote size={18} />}
            />
          </SectionCartes>

          {/* ── Graphiques ──────────────────────────────────────────────── */}
          {aTonnage || aFinances ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {aTonnage && (
                <CarteGraphique titre="Tonnage de coton par campagne">
                  <GraphiqueTonnage comparaison={data.comparaison} />
                </CarteGraphique>
              )}
              {aFinances && (
                <CarteGraphique titre={`Situation financière — ${data.saison_libelle}`}>
                  <GraphiqueFinances totaux={data.totaux} />
                </CarteGraphique>
              )}
            </div>
          ) : (
            <EmptyState
              icon={<FileBarChart size={40} />}
              title="Aucune donnée à représenter"
              description="Le tableau de bord s'alimente automatiquement dès que des missions, BSM, bordereaux et factures sont enregistrés pour la campagne."
            />
          )}
        </div>
      ) : null}
    </div>
  );
}
