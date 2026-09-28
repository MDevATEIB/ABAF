import type { Parametres, Recapitulatif } from '@/types';
import {
  formatDate,
  formatFCFA,
  formatNumeroFacture,
  formatNumeroReleve,
  montantFCFAEnLettres,
} from '@/utils';
import { EnteteAbaf } from './enteteAbaf';

interface LigneFactureReleve {
  ordre: number;
  numero_facture: string;
  date: string;
  usine?: string;
  montant: number;
}

function grouperParFacture(recap: Recapitulatif): { lignes: LigneFactureReleve[]; total: number } {
  const parFacture = new Map<
    string,
    { numero_facture: string; date: string; usine?: string; montant: number }
  >();

  for (const l of recap.lignes) {
    const cle = l.numero_facture?.trim();
    if (!cle) continue;
    const existant = parFacture.get(cle);
    const montant = l.montant_net ?? 0;
    if (!existant) {
      parFacture.set(cle, {
        numero_facture: cle,
        date: l.date_bordereau,
        usine: l.usine,
        montant,
      });
    } else {
      existant.montant += montant;
      if (l.date_bordereau < existant.date) {
        existant.date = l.date_bordereau;
      }
      if (!existant.usine && l.usine) {
        existant.usine = l.usine;
      }
    }
  }

  const entrees = [...parFacture.values()].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.numero_facture.localeCompare(b.numero_facture);
  });

  const lignes = entrees.map((e, i) => ({ ordre: i + 1, ...e }));
  const total = lignes.reduce((s, l) => s + l.montant, 0);
  return { lignes, total };
}

interface ReleveDocumentProps {
  recap: Recapitulatif;
  entreprise?: Parametres;
}

export function ReleveDocument({ recap, entreprise }: ReleveDocumentProps) {
  const { saison_libelle, date_debut, date_fin } = recap;

  const { lignes: lignesFactures, total: totalFactures } = grouperParFacture(recap);

  const nbFactures = lignesFactures.length;
  const dateEdition = date_fin || date_debut;
  const numeroReleve = formatNumeroReleve(recap, nbFactures);

  return (
    <div className="feuille-document flex flex-col text-xs leading-snug">
      <EnteteAbaf entreprise={entreprise} />

      <div className="mt-3 text-right">
        <p className="text-[11px]">
          Date : <span className="font-medium">{formatDate(dateEdition)}</span>
        </p>
      </div>

      <div className="mt-4 text-center">
        <p className="text-sm font-bold uppercase tracking-wide underline decoration-1 underline-offset-4">
          {numeroReleve}
        </p>
      </div>

      <p className="mt-4 text-[11px] leading-relaxed">
        Vous trouverez ci-joint {nbFactures} ({nbFactures > 0 ? nbFactures : '00'}) factures
        {nbFactures > 0 ? ' de coton graine' : ''} avec les originaux de bordereau et les
        afférentes{totalFactures > 0 ? ` d'une valeur de (${new Intl.NumberFormat('fr-FR').format(totalFactures)} Frs)` : ''}.
      </p>

      <table className="mt-5 w-full border-collapse text-[11px]">
        <thead>
          <tr className="bg-neutral-50">
            <th className="border border-black px-2 py-1.5 text-left font-semibold">
              N° ordre
            </th>
            <th className="border border-black px-2 py-1.5 text-left font-semibold">Date</th>
            <th className="border border-black px-2 py-1.5 text-left font-semibold">
              Libellés
            </th>
            <th className="border border-black px-2 py-1.5 text-right font-semibold">Débit</th>
            <th className="border border-black px-2 py-1.5 text-right font-semibold">Crédit</th>
          </tr>
        </thead>
        <tbody>
          {lignesFactures.length === 0 ? (
            <tr>
              <td colSpan={5} className="border border-black px-2 py-4 text-center text-neutral-500">
                Aucune facture associée pour cette campagne.
              </td>
            </tr>
          ) : (
            lignesFactures.map((ligne) => (
              <tr key={ligne.numero_facture}>
                <td className="border border-black px-2 py-1.5">
                  {String(ligne.ordre).padStart(4, '0')}
                </td>
                <td className="border border-black px-2 py-1.5">{formatDate(ligne.date)}</td>
                <td className="border border-black px-2 py-1.5 font-medium">
                  {formatNumeroFacture(
                    { numero: ligne.numero_facture, date_facture: ligne.date },
                    ligne.usine,
                  )}
                </td>
                <td className="border border-black px-2 py-1.5 text-right text-neutral-500">—</td>
                <td className="border border-black px-2 py-1.5 text-right font-medium">
                  {new Intl.NumberFormat('fr-FR').format(ligne.montant)}
                </td>
              </tr>
            ))
          )}
        </tbody>
        <tfoot>
          <tr>
            <td
              colSpan={4}
              className="border border-black bg-neutral-50 px-2 py-1.5 text-right align-top text-[10px] leading-snug"
            >
              <span className="font-semibold">
                Arrêté le présent relevé des factures à la somme de :
              </span>{' '}
              {totalFactures > 0
                ? montantFCFAEnLettres(totalFactures).replace(/ francs? CFA$/i, '')
                : 'Zéro'}
              {' francs CFA.'}
            </td>
            <td className="border border-black bg-neutral-50 px-2 py-1.5 text-right font-bold">
              {totalFactures > 0
                ? new Intl.NumberFormat('fr-FR').format(totalFactures)
                : '0'}
            </td>
          </tr>
        </tfoot>
      </table>

      <div className="mt-16 grid grid-cols-2 gap-10">
        <div />
        <div className="text-center">
          <p className="text-[11px] font-semibold underline decoration-1 underline-offset-2">
            Le Gestionnaire
          </p>
          <p className="mt-16 border-t border-black pt-2 text-[10px] text-neutral-400">
            Cachet et signature
          </p>
        </div>
      </div>

      <p className="mt-auto pt-6 text-center text-[9px] text-neutral-400">
        Relevé campagne {saison_libelle} · {formatFCFA(totalFactures)} · Document généré par ABAF
      </p>
    </div>
  );
}
