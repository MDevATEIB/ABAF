import { useMemo, useState } from 'react';
import { Eye } from 'lucide-react';

import {
  Button, Select, Badge, Modal,
  PageHeader, EmptyState, Spinner, ErrorMessage, Pagination,
} from '@/components/ui';
import {
  useBordereaux, useSaisons, useCamions, usePagination,
} from '@/hooks';

import type { Bordereau, Camion } from '@/types';
import {
  formatDate, formatKg, labelTypeFret, capaciteToPoidsVideKg,
} from '@/utils';

// ─── Page pesées (vue lecture) ────────────────────────────────────────────────
// Affiche pour chaque camion actif de la campagne sélectionnée :
//   • Poids à vide (tare = capacité camion)
//   • Poids chargé enregistré sur le bordereau
//   • Poids net coton/intrant (calculé à la validation du bordereau)
export default function PeseesPage() {
  const [saisonId, setSaisonId]     = useState<number | undefined>(undefined);
  const [viewing, setViewing]       = useState<{ camion: Camion; bordereaux: Bordereau[] } | null>(null);

  const { data: saisons = [], isLoading: loadingSaisons } = useSaisons();
  const { data: camions = [] }  = useCamions();
  const { data: bordereaux = [], isLoading: loadingBdx, error } = useBordereaux(saisonId);

  const saisonActive = saisons.find((s) => s.statut === 'ouverte');

  // Regroupe les bordereaux par camion_id
  const bdxParCamion = useMemo(() => {
    const map = new Map<number, Bordereau[]>();
    for (const b of bordereaux) {
      const liste = map.get(b.camion_id) ?? [];
      liste.push(b);
      map.set(b.camion_id, liste);
    }
    return map;
  }, [bordereaux]);

  // Liste des camions qui ont au moins un bordereau dans la campagne
  const camionsActifs = useMemo(() => {
    return camions.filter((c) => bdxParCamion.has(c.id));
  }, [camions, bdxParCamion]);

  const pagination = usePagination(camionsActifs);

  // Calculs agrégés pour un camion dans la campagne
  function stats(camion: Camion) {
    const bdx = bdxParCamion.get(camion.id) ?? [];
    const tare = capaciteToPoidsVideKg(camion.capacite_tonnes);
    // Dernier bordereau validé ou facturé (le plus récent)
    const valides = bdx.filter((b) => b.statut === 'valide' || b.statut === 'facture');
    const dernier = valides.length > 0 ? valides[0] : bdx[0];
    // Poids chargé = sur le dernier bordereau
    const poidsCharge = dernier?.poids_charge_kg ?? null;
    // Poids net coton/intrant = sur le dernier bordereau validé
    const poidsNet = dernier?.poids_net_kg ?? null;
    return { tare, poidsCharge, poidsNet, nbBordereaux: bdx.length, dernier };
  }

  if (loadingSaisons) return <Spinner className="mt-16" />;

  return (
    <div>
      <PageHeader
        title="Pesées"
        description="Vue de lecture des poids camion et coton/intrant pour chaque camion de la campagne."
      />

      {/* ── Sélecteur campagne ───────────────────────────────────────────── */}
      <div className="mb-6 max-w-xs">
        <Select
          label="Campagne"
          options={[
            { value: 0, label: '— Sélectionner —' },
            ...saisons.map((s) => ({
              value: s.id,
              label: `${s.libelle}${s.statut === 'ouverte' ? ' (active)' : ''}`,
            })),
          ]}
          value={saisonId ?? saisonActive?.id ?? 0}
          onChange={(e) => setSaisonId(Number(e.target.value) || undefined)}
        />
      </div>

      {/* ── Contenu ──────────────────────────────────────────────────────── */}
      {!saisonId && !saisonActive ? (
        <EmptyState
          icon={<Eye size={40} />}
          title="Sélectionnez une campagne"
          description="Choisissez une campagne pour voir les pesées."
        />
      ) : loadingBdx ? (
        <Spinner className="mt-8" />
      ) : error ? (
        <ErrorMessage message="Impossible de charger les bordereaux." />
      ) : camionsActifs.length === 0 ? (
        <EmptyState
          icon={<Eye size={40} />}
          title="Aucun camion actif"
          description="Aucun bordereau enregistré pour cette campagne."
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Camion</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Poids à vide (tare)</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Poids chargé</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Poids net coton/intrant</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">Bordereaux</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pagination.items.map((camion) => {
                  const { tare, poidsCharge, poidsNet, nbBordereaux } = stats(camion);
                  return (
                    <tr key={camion.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">
                        {camion.immatriculation}
                        {camion.capacite_tonnes && (
                          <span className="ml-1.5 text-xs text-muted-foreground">
                            ({camion.capacite_tonnes} t)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {tare != null ? formatKg(tare) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {poidsCharge != null ? formatKg(poidsCharge) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-foreground">
                        {poidsNet != null ? formatKg(poidsNet) : '—'}
                      </td>
                      <td className="px-4 py-3 text-center text-muted-foreground">
                        {nbBordereaux}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<Eye size={13} />}
                            onClick={() => setViewing({
                              camion,
                              bordereaux: bdxParCamion.get(camion.id) ?? [],
                            })}
                          >
                            Voir
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
          />
        </>
      )}

      {/* ── Modal détail camion ───────────────────────────────────────────── */}
      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing ? `Pesées — ${viewing.camion.immatriculation}` : 'Pesées'}
        size="lg"
      >
        {viewing && (() => {
          const tare = capaciteToPoidsVideKg(viewing.camion.capacite_tonnes);
          return (
            <div className="space-y-5">
              {/* Tare camion */}
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Tare du camion (capacité enregistrée)
                </p>
                <p className="mt-0.5 text-sm font-semibold text-foreground">
                  {tare != null
                    ? `${formatKg(tare)} (${viewing.camion.capacite_tonnes} t)`
                    : '— Capacité non renseignée —'}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Cette tare est utilisée comme poids à vide lors de la validation de chaque bordereau.
                </p>
              </div>

              {/* Tableau des bordereaux du camion */}
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">N° Bordereau</th>
                      <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Date</th>
                      <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Type fret</th>
                      <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">Poids à vide</th>
                      <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">Poids chargé</th>
                      <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">Poids net</th>
                      <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {viewing.bordereaux.map((b) => (
                      <tr key={b.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-3 py-2.5 font-medium text-foreground">
                          <div>Réf. ABAF : {b.numero}</div>
                          {b.numero_cotontchad && (
                            <div className="text-[11px] text-muted-foreground">
                              Réf. Cotontchad : {b.numero_cotontchad}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">
                          {formatDate(b.date_bordereau)}
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">
                          {b.type_fret ? labelTypeFret(b.type_fret) : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-right text-muted-foreground">
                          {b.poids_vide_kg != null
                            ? formatKg(b.poids_vide_kg)
                            : tare != null ? formatKg(tare) : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-right text-muted-foreground">
                          {b.poids_charge_kg != null ? formatKg(b.poids_charge_kg) : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-right font-medium text-foreground">
                          {b.poids_net_kg != null ? formatKg(b.poids_net_kg) : '—'}
                        </td>
                        <td className="px-3 py-2.5">
                          <Badge variant={
                            b.statut === 'brouillon' ? 'muted'
                            : b.statut === 'valide' ? 'success'
                            : 'default'
                          }>
                            {b.statut === 'brouillon' ? 'Brouillon'
                              : b.statut === 'valide' ? 'Validé'
                              : 'Facturé'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/50 font-semibold">
                      <td colSpan={3} className="px-3 py-2.5 text-muted-foreground">Total</td>
                      <td className="px-3 py-2.5 text-right text-muted-foreground">—</td>
                      <td className="px-3 py-2.5 text-right text-muted-foreground">
                        {(() => {
                          const total = viewing.bordereaux.reduce(
                            (s, b) => s + (b.poids_charge_kg ?? 0), 0
                          );
                          return total > 0 ? formatKg(total) : '—';
                        })()}
                      </td>
                      <td className="px-3 py-2.5 text-right text-foreground">
                        {(() => {
                          const total = viewing.bordereaux.reduce(
                            (s, b) => s + (b.poids_net_kg ?? 0), 0
                          );
                          return total > 0 ? formatKg(total) : '—';
                        })()}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
