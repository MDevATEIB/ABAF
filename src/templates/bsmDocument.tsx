import type { BSM, Parametres } from '@/types';
import { formatDate, formatFCFA, formatLitres } from '@/utils';
import { EnteteAbaf } from './enteteAbaf';

// ─── Champ libellé / valeur ───────────────────────────────────────────────────
function Champ({ label, valeur }: { label: string; valeur?: string }) {
  return (
    <p>
      <span className="text-neutral-500">{label} : </span>
      <span className="font-medium">{valeur ? valeur : '—'}</span>
    </p>
  );
}

// ─── Document BSM (AGENT.md §20.1) ────────────────────────────────────────────
interface BsmDocumentProps {
  bsm: BSM;
  camionNom?: string;
  usineNom?: string;
  missionRef?: string;
  saisonLibelle?: string;
  entreprise?: Parametres;
}

/**
 * Document imprimable d'un BSM (AGENT.md §20.1) : en-tête ABAF avec logo et
 * coordonnées, titre, numéro, date, bénéficiaire, camion, quantité de gasoil,
 * désignation, imputation et signatures.
 */
export function BsmDocument({
  bsm,
  camionNom,
  usineNom,
  missionRef,
  saisonLibelle,
  entreprise,
}: BsmDocumentProps) {
  return (
    <div className="feuille-document flex flex-col text-xs leading-snug">
      {/* ── En-tête ABAF ── */}
      <div className="flex items-start justify-between gap-6 border-b-2 border-black pb-3">
        <EnteteAbaf entreprise={entreprise} />
        <div className="text-right">
          <p className="text-sm font-bold uppercase">Bon de sortie magasin</p>
          <p className="mt-1 font-semibold">N° {bsm.numero}</p>
          <p className="text-[11px] text-neutral-600">Date : {formatDate(bsm.date_bsm)}</p>
        </div>
      </div>

      {/* ── Informations ── */}
      <div className="mt-4 grid grid-cols-3 gap-x-6 gap-y-1.5">
        <Champ label="Bénéficiaire" valeur={bsm.beneficiaire} />
        <Champ label="Camion" valeur={camionNom} />
        <Champ label="Usine" valeur={usineNom} />
        <Champ label="Campagne" valeur={saisonLibelle} />
        <Champ label="Mission" valeur={missionRef} />
        <Champ label="Référence" valeur={bsm.reference} />
      </div>

      {/* ── Désignation du gasoil ── */}
      <table className="mt-5 w-full border-collapse">
        <thead>
          <tr className="bg-neutral-100">
            <th className="border border-neutral-400 px-2 py-1.5 text-left font-semibold">Désignation</th>
            <th className="border border-neutral-400 px-2 py-1.5 text-right font-semibold">Quantité (litres)</th>
            <th className="border border-neutral-400 px-2 py-1.5 text-right font-semibold">
              Prix unitaire (FCFA/L)
            </th>
            <th className="border border-neutral-400 px-2 py-1.5 text-right font-semibold">Montant (FCFA)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border border-neutral-400 px-2 py-2">Gasoil</td>
            <td className="border border-neutral-400 px-2 py-2 text-right">
              {formatLitres(bsm.quantite_litres)}
            </td>
            <td className="border border-neutral-400 px-2 py-2 text-right">{formatFCFA(bsm.prix_litre)}</td>
            <td className="border border-neutral-400 px-2 py-2 text-right font-medium">
              {formatFCFA(bsm.montant)}
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr className="bg-neutral-100">
            <td colSpan={3} className="border border-neutral-400 px-2 py-1.5 font-semibold">
              Montant total
            </td>
            <td className="border border-neutral-400 px-2 py-1.5 text-right font-bold">
              {formatFCFA(bsm.montant)}
            </td>
          </tr>
        </tfoot>
      </table>

      {/* ── Imputation ── */}
      <p className="mt-3">
        <span className="text-neutral-500">Imputation : </span>
        <span className="font-medium">{bsm.imputation || '—'}</span>
      </p>

      {/* ── Signatures ── */}
      <div className="mt-16 grid grid-cols-3 gap-10 text-center">
        <div className="border-t border-black pt-1.5">Le Bénéficiaire</div>
        <div className="border-t border-black pt-1.5">Le Magasinier</div>
        <div className="border-t border-black pt-1.5">La Direction ABAF</div>
      </div>

      {/* ── Pied de page ── */}
      <p className="mt-auto pt-8 text-center text-[9px] text-neutral-400">
        BSM {bsm.numero} · Campagne {saisonLibelle ?? '—'} · Document généré par ABAF
      </p>
    </div>
  );
}
