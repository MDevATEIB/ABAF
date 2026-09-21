import { useState } from 'react';
import { FileBarChart } from 'lucide-react';

import { Select, PageHeader, EmptyState, Spinner, ErrorMessage } from '@/components/ui';
import { useRecapitulatif, useSaisons } from '@/hooks';
import type { LigneRapport } from '@/types';
import { formatDate, formatDistance, formatFCFA, formatKg, formatLitres } from '@/utils';

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
export default function RecapitulatifPage() {
  const [filtreSaisonId, setFiltreSaisonId] = useState<number | undefined>(undefined);

  const { data: saisons = [] } = useSaisons();
  const { data, isLoading, error } = useRecapitulatif(filtreSaisonId);

  const messageErreur = error ? (error instanceof Error ? error.message : String(error)) : null;

  return (
    <div>
      <PageHeader
        title="Récapitulatif"
        description="Synthèse automatique des mouvements de la campagne (missions, pesées, BSM, bordereaux, factures, paiements) : opérations, tonnages, gasoil et finances."
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
          onChange={(e) => setFiltreSaisonId(Number(e.target.value) || undefined)}
          className="w-64"
        />
      </div>

      {isLoading ? (
        <Spinner className="mt-16" />
      ) : messageErreur ? (
        <ErrorMessage message={messageErreur} className="mt-4" />
      ) : data ? (
        data.lignes.length === 0 ? (
          <EmptyState
            icon={<FileBarChart size={40} />}
            title="Aucune opération pour cette campagne"
            description="Le récapitulatif se construit automatiquement dès que des missions, pesées, BSM, bordereaux, factures et paiements sont enregistrés."
          />
        ) : (
          <>
            {/* ── Totaux ──────────────────────────────────────────────────── */}
            <div className="mb-6 space-y-4">
              <section>
                <h3 className="mb-2 text-sm font-medium text-muted-foreground">Opérations</h3>
                <div className="grid grid-cols-5 gap-3">
                  <Carte label="Missions" valeur={String(data.totaux.nb_missions)} />
                  <Carte label="Bordereaux" valeur={String(data.totaux.nb_bordereaux)} />
                  <Carte label="BSM" valeur={String(data.totaux.nb_bsm)} />
                  <Carte label="Factures" valeur={String(data.totaux.nb_factures)} />
                  <Carte label="Paiements" valeur={String(data.totaux.nb_paiements)} />
                </div>
              </section>
              <section>
                <h3 className="mb-2 text-sm font-medium text-muted-foreground">Transport</h3>
                <div className="grid grid-cols-5 gap-3">
                  <Carte label="Tonnage coton" valeur={formatKg(data.totaux.tonnage_coton_kg)} />
                  <Carte label="Tonnage intrants" valeur={formatKg(data.totaux.tonnage_intrants_kg)} />
                  <Carte label="Distance totale" valeur={formatDistance(data.totaux.distance_totale_km)} />
                  <Carte label="Gasoil" valeur={formatLitres(data.totaux.gasoil_litres)} />
                  <Carte label="Montant gasoil" valeur={formatFCFA(data.totaux.gasoil_montant)} />
                </div>
              </section>
              <section>
                <h3 className="mb-2 text-sm font-medium text-muted-foreground">Finances</h3>
                <div className="grid grid-cols-5 gap-3">
                  <Carte label="Montant brut" valeur={formatFCFA(data.totaux.montant_brut)} />
                  <Carte label="Montant net" valeur={formatFCFA(data.totaux.montant_net)} />
                  <Carte label="Montant payé" valeur={formatFCFA(data.totaux.montant_paye)} />
                  <Carte label="Montant impayé" valeur={formatFCFA(data.totaux.montant_impaye)} />
                  <Carte label="Solde avances" valeur={formatFCFA(data.totaux.solde_avances)} />
                </div>
              </section>
            </div>

            {/* ── Tableau des opérations ──────────────────────────────────── */}
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">
              Tableau des opérations — {data.saison_libelle}
            </h3>
            <TableauOperations lignes={data.lignes} />
          </>
        )
      ) : null}
    </div>
  );
}
