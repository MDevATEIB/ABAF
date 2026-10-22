import { useState } from 'react';
import { FileText } from 'lucide-react';

import { Badge, Select, PageHeader, EmptyState, Spinner, ErrorMessage, Pagination } from '@/components/ui';
import { useRapportAnnuel, useSaisons, usePagination } from '@/hooks';
import type { LigneRapport } from '@/types';
import { formatDate, formatDistance, formatFCFA, formatKg, formatLitres } from '@/utils';


// ─── Statuts affichés ─────────────────────────────────────────────────────────
const STATUTS_BSM: Record<string, { label: string; variant: 'success' | 'warning' | 'muted' }> = {
  ouvert:  { label: 'Ouvert',  variant: 'warning' },
  cloture: { label: 'Clôturé', variant: 'muted' },
  facture: { label: 'Facturé', variant: 'success' },
};

const STATUTS_PAIEMENT: Record<string, { label: string; variant: 'success' | 'warning' | 'muted' }> = {
  paye:   { label: 'Payé',     variant: 'success' },
  impaye: { label: 'Impayé',   variant: 'warning' },
  np:     { label: 'Non payé', variant: 'muted' },
};

// ─── Carte de total ───────────────────────────────────────────────────────────
function Carte({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold text-foreground">{valeur}</p>
    </div>
  );
}

// ─── Tableau des opérations (colonnes du rapport annuel, AGENT.md §7.2) ───────
function TableauOperations({ lignes }: { lignes: LigneRapport[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">N° Bordereau</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">Date</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">N° Fac</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">N° Camion</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">USINE</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">CGI</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">AV</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground whitespace-nowrap">Poids Coton</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground whitespace-nowrap">Poids INT</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground whitespace-nowrap">Distance</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground whitespace-nowrap">Gasoil</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground whitespace-nowrap">Montant</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">OBSER</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">BMS</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {lignes.map((l) => (
            <tr key={l.bordereau_id} className="hover:bg-muted/30 transition-colors">
              <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">{l.numero_bordereau}</td>
              <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatDate(l.date_bordereau)}</td>
              <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{l.numero_facture ?? '—'}</td>
              <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{l.numero_camion ?? '—'}</td>
              <td className="px-4 py-3 text-muted-foreground">{l.usine ?? '—'}</td>
              <td className="px-4 py-3 text-muted-foreground">{l.cgi ?? '—'}</td>
              <td className="px-4 py-3 text-muted-foreground">{l.av ?? '—'}</td>
              <td className="px-4 py-3 text-right text-foreground">
                {l.poids_coton_kg != null ? formatKg(l.poids_coton_kg) : '—'}
              </td>
              <td className="px-4 py-3 text-right text-muted-foreground">
                {l.poids_intrants_kg > 0 ? formatKg(l.poids_intrants_kg) : '—'}
              </td>
              <td className="px-4 py-3 text-right text-muted-foreground">
                {l.distance_km != null ? formatDistance(l.distance_km) : '—'}
              </td>
              <td className="px-4 py-3 text-right text-muted-foreground">
                {l.gasoil_litres > 0 ? formatLitres(l.gasoil_litres) : '—'}
              </td>
              <td className="px-4 py-3 text-right font-medium text-foreground">
                {l.montant_net != null ? formatFCFA(l.montant_net) : '—'}
              </td>
              <td className="px-4 py-3 text-muted-foreground">{l.observations || '—'}</td>
              <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{l.numeros_bms ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function RapportAnnuelPage() {
  const [filtreSaisonId, setFiltreSaisonId] = useState<number | undefined>(undefined);

  const { data: saisons = [] } = useSaisons();
  const { data, isLoading, error } = useRapportAnnuel(filtreSaisonId);

  const lignes    = data?.lignes    ?? [];
  const bsms      = data?.bsms      ?? [];
  const paiements = data?.paiements ?? [];

  const pagLignes    = usePagination(lignes);
  const pagBsm       = usePagination(bsms);
  const pagPaiements = usePagination(paiements);

  const resetAllPagination = () => {
    pagLignes.reset();
    pagBsm.reset();
    pagPaiements.reset();
  };

  const messageErreur = error ? (error instanceof Error ? error.message : String(error)) : null;

  return (
    <div>
      <PageHeader
        title="Rapport Annuel"
        description="Rapport généré automatiquement depuis les opérations enregistrées : tableau des opérations, totaux, données de gasoil et BMS, règlements et comparaison avec les campagnes."
      />

      {/* ── Filtres ─────────────────────────────────────────────────────────── */}
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
          onChange={(e) => { setFiltreSaisonId(Number(e.target.value) || undefined); resetAllPagination(); }}
          className="w-64"
        />
      </div>

      {isLoading ? (
        <Spinner className="mt-16" />
      ) : messageErreur ? (
        <ErrorMessage message={messageErreur} className="mt-4" />
      ) : data ? (
        lignes.length === 0 ? (
          <EmptyState
            icon={<FileText size={40} />}
            title="Aucune opération pour cette campagne"
            description="Le rapport annuel se construit automatiquement dès que des opérations sont enregistrées dans le logiciel."
          />
        ) : (
          <>
            {/* ── En-tête du document ─────────────────────────────────────── */}
            <div className="mb-4 rounded-lg border border-border p-4">
              <h2 className="text-lg font-semibold text-foreground">
                Rapport annuel — {data.saison_libelle}
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Campagne du {formatDate(data.date_debut)}
                {data.date_fin ? ` au ${formatDate(data.date_fin)}` : ' — en cours'}
              </p>
            </div>

            {/* ── Totaux ──────────────────────────────────────────────────── */}
            <div className="mb-6 grid grid-cols-4 gap-3">
              <Carte label="Tonnage coton" valeur={formatKg(data.totaux.tonnage_coton_kg)} />
              <Carte label="Distance totale" valeur={formatDistance(data.totaux.distance_totale_km)} />
              <Carte label="Gasoil" valeur={formatLitres(data.totaux.gasoil_litres)} />
              <Carte label="Montant gasoil" valeur={formatFCFA(data.totaux.gasoil_montant)} />
              <Carte label="Montant brut" valeur={formatFCFA(data.totaux.montant_brut)} />
              <Carte label="Montant net" valeur={formatFCFA(data.totaux.montant_net)} />
              <Carte label="Montant payé" valeur={formatFCFA(data.totaux.montant_paye)} />
              <Carte label="Montant impayé" valeur={formatFCFA(data.totaux.montant_impaye)} />
            </div>

            {/* ── Tableau des opérations ──────────────────────────────────── */}
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">Tableau des opérations</h3>
            <div className="mb-6">
              <TableauOperations lignes={pagLignes.items} />
              <Pagination
                page={pagLignes.page}
                totalPages={pagLignes.totalPages}
                totalItems={pagLignes.totalItems}
                pageSize={pagLignes.pageSize}
                onPageChange={pagLignes.goToPage}
                onPageSizeChange={pagLignes.setPageSize}
                className="mt-2"
              />
            </div>

            {/* ── Données de gasoil et BMS ────────────────────────────────── */}
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">Données de gasoil</h3>
            <div className="mb-3 grid grid-cols-3 gap-3">
              <Carte label="Bons BSM" valeur={String(data.totaux.nb_bsm)} />
              <Carte label="Quantité de gasoil" valeur={formatLitres(data.totaux.gasoil_litres)} />
              <Carte label="Montant gasoil" valeur={formatFCFA(data.totaux.gasoil_montant)} />
            </div>
            {bsms.length === 0 ? (
              <p className="mb-6 text-sm text-muted-foreground">Aucun BSM pour cette campagne.</p>
            ) : (
              <div className="mb-6">
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">N° BSM</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Camion</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Bénéficiaire</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">Litres</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">Montant</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Statut</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {pagBsm.items.map((b) => {
                        const statut = STATUTS_BSM[b.statut] ?? { label: b.statut, variant: 'muted' as const };
                        return (
                          <tr key={b.numero} className="hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3 font-medium text-foreground">{b.numero}</td>
                            <td className="px-4 py-3 text-muted-foreground">{formatDate(b.date_bsm)}</td>
                            <td className="px-4 py-3 text-muted-foreground">{b.camion ?? '—'}</td>
                            <td className="px-4 py-3 text-muted-foreground">{b.beneficiaire || '—'}</td>
                            <td className="px-4 py-3 text-right text-foreground">{formatLitres(b.quantite_litres)}</td>
                            <td className="px-4 py-3 text-right font-medium text-foreground">{formatFCFA(b.montant)}</td>
                            <td className="px-4 py-3">
                              <Badge variant={statut.variant}>{statut.label}</Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  page={pagBsm.page}
                  totalPages={pagBsm.totalPages}
                  totalItems={pagBsm.totalItems}
                  pageSize={pagBsm.pageSize}
                  onPageChange={pagBsm.goToPage}
                  onPageSizeChange={pagBsm.setPageSize}
                  className="mt-2"
                />
              </div>
            )}

            {/* ── Règlements ──────────────────────────────────────────────── */}
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">Règlements</h3>
            {paiements.length === 0 ? (
              <p className="mb-6 text-sm text-muted-foreground">Aucun règlement enregistré pour cette campagne.</p>
            ) : (
              <div className="mb-6">
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">N° Facture</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">Montant</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Mode</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Statut</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {pagPaiements.items.map((p, index) => {
                        const statut = STATUTS_PAIEMENT[p.statut] ?? { label: p.statut, variant: 'muted' as const };
                        return (
                          <tr key={`${p.date_paiement}-${index}`} className="hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3 text-muted-foreground">{formatDate(p.date_paiement)}</td>
                            <td className="px-4 py-3 font-medium text-foreground">{p.numero_facture ?? '—'}</td>
                            <td className="px-4 py-3 text-right font-medium text-foreground">{formatFCFA(p.montant)}</td>
                            <td className="px-4 py-3 text-muted-foreground">{p.mode_paiement || '—'}</td>
                            <td className="px-4 py-3">
                              <Badge variant={statut.variant}>{statut.label}</Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  page={pagPaiements.page}
                  totalPages={pagPaiements.totalPages}
                  totalItems={pagPaiements.totalItems}
                  pageSize={pagPaiements.pageSize}
                  onPageChange={pagPaiements.goToPage}
                  onPageSizeChange={pagPaiements.setPageSize}
                  className="mt-2"
                />
              </div>
            )}

            {/* ── Comparaison avec les campagnes ──────────────────────────── */}
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">
              Comparaison avec les campagnes
            </h3>
            {data.comparaison.length <= 1 ? (
              <p className="mb-6 text-sm text-muted-foreground">
                Une seule campagne enregistrée : la comparaison apparaîtra dès que d'autres campagnes auront des opérations.
              </p>
            ) : (
              <div className="mb-6 overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Campagne</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">Bordereaux</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">Tonnage coton</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">Distance</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">Gasoil</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">Montant net</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.comparaison.map((c) => {
                      const courante = c.saison_id === data.saison_id;
                      return (
                        <tr
                          key={c.saison_id}
                          className={courante ? 'bg-muted/40' : 'hover:bg-muted/30 transition-colors'}
                        >
                          <td className="px-4 py-3 font-medium text-foreground">
                            {c.libelle}
                            {courante && (
                              <Badge variant="default" className="ml-2">
                                Campagne affichée
                              </Badge>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right text-muted-foreground">{c.nb_bordereaux}</td>
                          <td className="px-4 py-3 text-right text-foreground">{formatKg(c.tonnage_coton_kg)}</td>
                          <td className="px-4 py-3 text-right text-muted-foreground">
                            {formatDistance(c.distance_totale_km)}
                          </td>
                          <td className="px-4 py-3 text-right text-muted-foreground">
                            {formatLitres(c.gasoil_litres)}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-foreground">
                            {formatFCFA(c.montant_net)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── Observations ────────────────────────────────────────────── */}
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">Observations</h3>
            {data.lignes.every((l) => !l.observations || l.observations.trim() === '') ? (
              <p className="text-sm text-muted-foreground">Aucune observation relevée pour cette campagne.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {data.lignes
                  .filter((l) => l.observations && l.observations.trim() !== '')
                  .map((l) => (
                    <li key={l.bordereau_id} className="text-muted-foreground">
                      <span className="font-medium text-foreground">{l.numero_bordereau}</span> — {l.observations}
                    </li>
                  ))}
              </ul>
            )}
          </>
        )
      ) : null}
    </div>
  );
}
