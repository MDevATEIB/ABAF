import { useMemo, useState } from 'react';
import { Truck } from 'lucide-react';

import {
  Select, Badge, PageHeader, EmptyState, Spinner, ErrorMessage, Pagination,
} from '@/components/ui';
import {
  useBordereaux, useSyntheseLivraisons, useSaisons, useCamions, useUsines, useAvs,
  usePagination,
} from '@/hooks';
import type { StatutBordereau } from '@/types';
import { formatDate, formatKg } from '@/utils';

// ─── Une livraison = un bordereau validé ou facturé (AGENT.md §4 étape 9) ─────
function labelStatutLivraison(statut: StatutBordereau) {
  return statut === 'valide' ? 'Validé' : 'Facturé';
}

interface KpiCardProps {
  label: string;
  value: string;
}

function KpiCard({ label, value }: KpiCardProps) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function LivraisonsPage() {
  const [filtreSaisonId, setFiltreSaisonId] = useState<number | undefined>(undefined);

  const { data: saisons = [] } = useSaisons();
  const { data: camions = [] } = useCamions();
  const { data: usines = [] }  = useUsines();
  const { data: avs = [] }     = useAvs();

  const { data: bordereaux = [], isLoading, error } = useBordereaux(filtreSaisonId);
  const { data: synthese, isLoading: syntheseLoading } = useSyntheseLivraisons(filtreSaisonId);

  const camionMap = useMemo(() => new Map(camions.map((c) => [c.id, c.immatriculation])), [camions]);
  const usineMap  = useMemo(() => new Map(usines.map((u) => [u.id, u.nom])), [usines]);
  const avMap     = useMemo(() => new Map(avs.map((a) => [a.id, a.nom])), [avs]);

  // Livraisons = bordereaux validés ou facturés (jamais les brouillons)
  const livraisons = bordereaux.filter((b) => b.statut !== 'brouillon');
  const pagination = usePagination(livraisons);

  if (isLoading || syntheseLoading) return <Spinner className="mt-16" />;
  if (error) return <ErrorMessage message="Impossible de charger les livraisons." className="mt-4" />;

  return (
    <div>
      <PageHeader
        title="Livraisons"
        description="Synthèse en lecture seule des livraisons : chaque bordereau validé correspond à un chargement livré. Les données proviennent des missions, pesées et bordereaux (saisie unique)."
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

      {livraisons.length === 0 ? (
        <EmptyState
          icon={<Truck size={40} />}
          title="Aucune livraison enregistrée"
          description="Les livraisons apparaissent ici dès qu'un bordereau est validé dans le module Bordereaux."
        />
      ) : (
        <>
          {/* ── Indicateurs ─────────────────────────────────────────────────── */}
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard label="Livraisons" value={String(synthese?.nb_livraisons ?? 0)} />
            <KpiCard
              label="Poids net total livré"
              value={formatKg(synthese?.poids_net_total_kg ?? 0)}
            />
            <KpiCard label="Camions concernés" value={String(synthese?.par_camion.length ?? 0)} />
            <KpiCard label="AV concernés" value={String(synthese?.par_av.length ?? 0)} />
          </div>

          {/* ── Détail des livraisons ───────────────────────────────────────── */}
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">N° Bordereau</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Camion</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Destination</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Distance</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Poids net livré</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pagination.items.map((b) => (
                  <tr key={b.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(b.date_bordereau)}</td>
                    <td className="px-4 py-3 font-medium text-foreground">{b.numero}</td>
                    <td className="px-4 py-3 text-muted-foreground">{camionMap.get(b.camion_id) ?? '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {b.usine_id ? usineMap.get(b.usine_id) ?? '—' : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {b.distance_km != null ? `${b.distance_km} km` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-foreground">
                      {b.poids_net_kg != null ? formatKg(b.poids_net_kg) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={b.statut === 'valide' ? 'success' : 'default'}>
                        {labelStatutLivraison(b.statut)}
                      </Badge>
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
            className="mt-2"
          />

          {/* ── Totaux par camion et par AV ─────────────────────────────────── */}
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div>
              <h2 className="mb-2 text-sm font-medium text-foreground">Totaux par camion</h2>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Camion</th>
                      <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Livraisons</th>
                      <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Poids net livré</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(synthese?.par_camion ?? []).map((c) => (
                      <tr key={c.camion_id}>
                        <td className="px-4 py-2.5 font-medium text-foreground">
                          {camionMap.get(c.camion_id) ?? `Camion #${c.camion_id}`}
                        </td>
                        <td className="px-4 py-2.5 text-right text-muted-foreground">{c.nb_livraisons}</td>
                        <td className="px-4 py-2.5 text-right text-muted-foreground">{formatKg(c.poids_net_kg)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h2 className="mb-2 text-sm font-medium text-foreground">Totaux par AV (lots déclarés)</h2>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">AV</th>
                      <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Lots</th>
                      <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Poids des lots</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(synthese?.par_av ?? []).map((a) => (
                      <tr key={a.av_id}>
                        <td className="px-4 py-2.5 font-medium text-foreground">
                          {avMap.get(a.av_id) ?? `AV #${a.av_id}`}
                        </td>
                        <td className="px-4 py-2.5 text-right text-muted-foreground">{a.nb_lots}</td>
                        <td className="px-4 py-2.5 text-right text-muted-foreground">{formatKg(a.poids_lots_kg)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Les poids des lots proviennent des lignes de chargement ; le poids net officiel reste celui des pesées.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
