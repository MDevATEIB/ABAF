import { useState } from 'react';
import { FileSpreadsheet, FolderOpen } from 'lucide-react';
import { revealItemInDir } from '@tauri-apps/plugin-opener';

import { Badge, Button, EmptyState, ErrorMessage, PageHeader, Select, Spinner } from '@/components/ui';
import { useExporterRapportExcel, useRapportAnnuel, useSaisons } from '@/hooks';
import { formatFCFA, formatKg, formatLitres } from '@/utils';

// ─── Carte de récapitulatif ───────────────────────────────────────────────────
function Carte({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold text-foreground">{valeur}</p>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function ExportExcelPage() {
  const [filtreSaisonId, setFiltreSaisonId] = useState<number | undefined>(undefined);
  const [cheminExporte, setCheminExporte] = useState<string | null>(null);

  const { data: saisons = [] } = useSaisons();
  const { data, isLoading, error } = useRapportAnnuel(filtreSaisonId);
  const exporter = useExporterRapportExcel();

  const messageErreur = error ? (error instanceof Error ? error.message : String(error)) : null;
  const erreurExport = exporter.error
    ? exporter.error instanceof Error
      ? exporter.error.message
      : String(exporter.error)
    : null;

  const changerCampagne = (valeur: number | undefined) => {
    setFiltreSaisonId(valeur);
    setCheminExporte(null);
    exporter.reset();
  };

  const lancerExport = () => {
    setCheminExporte(null);
    exporter.mutate(
      { saisonId: filtreSaisonId },
      { onSuccess: (chemin) => setCheminExporte(chemin) },
    );
  };

  const ouvrirDossier = (chemin: string) => {
    revealItemInDir(chemin).catch(() => undefined);
  };

  return (
    <div>
      <PageHeader
        title="Export Excel"
        description="Génère le rapport annuel de la campagne dans un classeur Excel (AGENT.md §20.4) : feuilles « Opérations », « Gasoil & BSM », « Règlements » et « Comparaison ». Le fichier est créé dans le dossier « Documents/ABAF »."
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
          onChange={(e) => changerCampagne(Number(e.target.value) || undefined)}
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
            icon={<FileSpreadsheet size={40} />}
            title="Aucune opération pour cette campagne"
            description="L'export sera disponible dès que des missions, pesées, BSM, bordereaux, factures et paiements seront enregistrés."
          />
        ) : (
          <>
            {/* ── Aperçu du contenu du classeur ───────────────────────────── */}
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">
              Aperçu — {data.saison_libelle}
            </h3>
            <div className="mb-6 grid grid-cols-6 gap-3">
              <Carte label="Bordereaux" valeur={String(data.totaux.nb_bordereaux)} />
              <Carte label="BSM" valeur={String(data.totaux.nb_bsm)} />
              <Carte label="Tonnage coton" valeur={formatKg(data.totaux.tonnage_coton_kg)} />
              <Carte label="Gasoil" valeur={formatLitres(data.totaux.gasoil_litres)} />
              <Carte label="Montant net" valeur={formatFCFA(data.totaux.montant_net)} />
              <Carte label="Montant impayé" valeur={formatFCFA(data.totaux.montant_impaye)} />
            </div>

            {/* ── Export ──────────────────────────────────────────────────── */}
            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Rapport annuel — {data.saison_libelle}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {data.lignes.length} opération(s) · {data.bsms.length} BSM ·{' '}
                    {data.paiements.length} règlement(s) · {data.comparaison.length} campagne(s)
                    en comparaison
                  </p>
                </div>
                <Button
                  loading={exporter.isPending}
                  icon={<FileSpreadsheet size={14} />}
                  onClick={lancerExport}
                >
                  Exporter en Excel
                </Button>
              </div>

              {erreurExport ? <ErrorMessage message={erreurExport} className="mt-4" /> : null}

              {cheminExporte ? (
                <div className="mt-4 rounded-md border border-border bg-muted/40 p-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="success">Fichier généré</Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      icon={<FolderOpen size={14} />}
                      onClick={() => ouvrirDossier(cheminExporte)}
                    >
                      Ouvrir le dossier
                    </Button>
                  </div>
                  <p className="mt-2 break-all font-mono text-xs text-muted-foreground">
                    {cheminExporte}
                  </p>
                </div>
              ) : null}
            </div>
          </>
        )
      ) : null}
    </div>
  );
}
