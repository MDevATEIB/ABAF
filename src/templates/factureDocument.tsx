import type { BSM, Bordereau, Client, Facture, LigneFacture, Parametres, Tarif } from '@/types';
import { formatDate, formatNumeroFacture, labelTypeFret, montantFCFAEnLettres } from '@/utils';
import { buildLignesFactureTableData } from './factureDocument.helpers.js';
import { EnteteAbaf } from './enteteAbaf';

interface FactureDocumentProps {
  facture: Facture;
  lignes: LigneFacture[];
  client?: Client;
  saisonLibelle?: string;
  bordereauParId: Map<number, Bordereau>;
  bsmParId: Map<number, BSM>;
  camionNom: Map<number, string>;
  usineNom: Map<number, string>;
  entreprise?: Parametres;
  tarifs?: Tarif[];
}

const EXEMPLAIRES = ['Original', 'Copie 1', 'Copie 2', 'Copie 3'] as const;

interface FeuilletFactureProps extends FactureDocumentProps {
  exemplaire: string;
}

function tonnes(kg: number): string {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(kg / 1000);
}

function numFr(n: number, digits = 0): string {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);
}

function FeuilletFacture({
  facture,
  lignes,
  client,
  bordereauParId,
  bsmParId,
  camionNom,
  usineNom,
  entreprise,
  tarifs,
  exemplaire,
}: FeuilletFactureProps) {
  const lignesTransport = lignes.filter((l) => l.bordereau_id != null);
  const lignesTransportAffichage = buildLignesFactureTableData(lignesTransport, bordereauParId);
  const lignesGasoil = lignes.filter((l) => l.bsm_id != null);

  const totalPoidsKg = lignesTransport.reduce((t, l) => t + l.poids_net_kg, 0);
  const totalBrut = facture.montant_brut;
  const totalGasoil = facture.montant_gasoil;
  const totalQteGasoil = lignesGasoil.reduce((t, l) => {
    const bsm = l.bsm_id != null ? bsmParId.get(l.bsm_id) : undefined;
    return t + (bsm?.quantite_litres ?? 0);
  }, 0);
  const totalNet = facture.montant_net;

  const premierBordereau =
    lignesTransport.length > 0
      ? bordereauParId.get(lignesTransport[0].bordereau_id!)
      : undefined;
  const usine =
    premierBordereau?.usine_id != null
      ? usineNom.get(premierBordereau.usine_id)
      : undefined;
  const camionImmat =
    premierBordereau?.camion_id != null
      ? camionNom.get(premierBordereau.camion_id)
      : undefined;

  const estOriginal = exemplaire === EXEMPLAIRES[0];
  const avecMention = estOriginal && facture.mention_original_payable;

  return (
    <div className="feuille-document feuillet-document flex flex-col text-xs leading-snug">
      <EnteteAbaf entreprise={entreprise} />

      <div className="mt-3 flex items-start justify-between gap-6">
        <div className="text-left">
          <p className="text-sm font-bold uppercase tracking-wide">
            DOIT {client?.nom ?? '—'}
          </p>
          {client?.adresse && (
            <p className="mt-0.5 text-[11px]">{client.adresse}</p>
          )}
          {client?.telephone && (
            <p className="text-[11px]">Tél. : {client.telephone}</p>
          )}
          {usine && (
            <p className="mt-1 text-[11px]">
              <span className="font-semibold uppercase">USINE DE :</span> {usine}
            </p>
          )}
          {camionImmat && (
            <p className="text-[11px]">
              <span className="font-semibold uppercase">N° DE CAMION :</span>{' '}
              {camionImmat}
            </p>
          )}
        </div>

        <div className="flex-1 text-center">
          <p className="text-sm font-bold uppercase underline decoration-1 underline-offset-4">
            {formatNumeroFacture(facture, usine)}
          </p>
        </div>

        <div className="text-right">
          <p className="text-[12px] font-semibold">
            {usine ?? 'Moundou'} : {formatDate(facture.date_facture)}
          </p>
          <p
            className={`mt-1.5 inline-block px-1.5 py-0.5 text-[10px] uppercase ${
              avecMention
                ? 'border-2 border-black font-bold tracking-wide'
                : 'border border-neutral-400 font-semibold text-neutral-600'
            }`}
          >
            {avecMention ? 'Original payable' : exemplaire}
          </p>
        </div>
      </div>

      <table className="mt-4 w-full border-collapse text-[10px]">
        <thead>
          <tr className="bg-neutral-50">
            <th
              rowSpan={2}
              className="border border-black px-1 py-1 text-center align-middle font-semibold"
            >
              N° Bdrs
              <br />
              de transp
            </th>
            <th
              colSpan={3}
              className="border border-black px-1 py-1 text-center font-semibold"
            >
              Tonnage
            </th>
            <th
              colSpan={3}
              className="border border-black px-1 py-1 text-center font-semibold"
            >
              Montant Brut
            </th>
            <th
              colSpan={1}
              className="border border-black px-1 py-1 text-center font-semibold"
            >
              Total
            </th>
            <th
              colSpan={3}
              className="border border-black px-1 py-1 text-center font-semibold"
            >
              Gazoil
            </th>
            <th
              rowSpan={2}
              className="border border-black px-1 py-1 text-center align-middle font-semibold"
            >
              Montant Net
            </th>
          </tr>
          <tr className="bg-neutral-50">
            <th className="border border-black px-1 py-1 text-center font-semibold">
              Coton Graine
            </th>
            <th className="border border-black px-1 py-1 text-center font-semibold">
              Intrant
            </th>
            <th className="border border-black px-1 py-1 text-center font-semibold">
              Distance
            </th>
            <th className="border border-black px-1 py-1 text-center font-semibold">
              Tarif
            </th>
            <th className="border border-black px-1 py-1 text-center font-semibold">
              Coton Graine
            </th>
            <th className="border border-black px-1 py-1 text-center font-semibold">
              Intrant
            </th>
            <th className="border border-black px-1 py-1 text-center font-semibold">
              Total
            </th>
            <th className="border border-black px-1 py-1 text-center font-semibold">
              Qte
            </th>
            <th className="border border-black px-1 py-1 text-center font-semibold">
              P.U
            </th>
            <th className="border border-black px-1 py-1 text-center font-semibold">
              Montant
            </th>
          </tr>
        </thead>
        <tbody>
          {lignesTransport.map((ligne, index) => {
            const bdr = bordereauParId.get(ligne.bordereau_id!);
            const ligneAffichage = lignesTransportAffichage[index];
            return (
              <tr key={ligne.id}>
                <td className="border border-black px-1 py-1 text-center">
                  {bdr?.numero ?? '—'}
                </td>
                <td className="border border-black px-1 py-1 text-right">
                  {tonnes(ligneAffichage.cotonGraineKg)}
                </td>
                <td className="border border-black px-1 py-1 text-right">&nbsp;</td>
                <td className="border border-black px-1 py-1 text-right">
                  {numFr(ligneAffichage.distanceKm)}
                </td>
                <td className="border border-black px-1 py-1 text-right">
                  {numFr(ligneAffichage.tarifTonne)}
                </td>
                <td className="border border-black px-1 py-1 text-right">
                  {numFr(ligneAffichage.montantBrut)}
                </td>
                <td className="border border-black px-1 py-1 text-right">&nbsp;</td>
                <td className="border border-black px-1 py-1 text-right">&nbsp;</td>
                <td className="border border-black px-1 py-1 text-right font-medium">
                  {numFr(ligneAffichage.montantBrut)}
                </td>
                <td className="border border-black px-1 py-1 text-right">&nbsp;</td>
                <td className="border border-black px-1 py-1 text-right">&nbsp;</td>
                <td className="border border-black px-1 py-1 text-right">&nbsp;</td>
                <td className="border border-black px-1 py-1 text-right font-medium">
                  {numFr(ligne.montant_brut)}
                </td>
              </tr>
            );
          })}
          {lignesGasoil.map((ligne) => {
            const bsm = ligne.bsm_id != null ? bsmParId.get(ligne.bsm_id) : undefined;
            return (
              <tr key={ligne.id}>
                <td className="border border-black px-1 py-1 text-center">
                  {bsm?.numero ?? ligne.description ?? 'BSM'}
                </td>
                <td className="border border-black px-1 py-1">&nbsp;</td>
                <td className="border border-black px-1 py-1">&nbsp;</td>
                <td className="border border-black px-1 py-1">&nbsp;</td>
                <td className="border border-black px-1 py-1">&nbsp;</td>
                <td className="border border-black px-1 py-1">&nbsp;</td>
                <td className="border border-black px-1 py-1">&nbsp;</td>
                <td className="border border-black px-1 py-1">&nbsp;</td>
                <td className="border border-black px-1 py-1">&nbsp;</td>
                <td className="border border-black px-1 py-1 text-right">&nbsp;</td>
                <td className="border border-black px-1 py-1 text-right">&nbsp;</td>
                <td className="border border-black px-1 py-1 text-right font-medium">&nbsp;</td>
                <td className="border border-black px-1 py-1 text-right">
                  {bsm ? numFr(bsm.quantite_litres) : ''}
                </td>
                <td className="border border-black px-1 py-1 text-right">
                  {bsm ? numFr(bsm.prix_litre) : ''}
                </td>
                <td className="border border-black px-1 py-1 text-right">
                  {numFr(ligne.montant_gasoil)}
                </td>
                <td className="border border-black px-1 py-1 text-right font-medium">
                  − {numFr(ligne.montant_gasoil)}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-neutral-100 font-semibold">
            <td className="border border-black px-1 py-1 text-center">TOTAL</td>
            <td className="border border-black px-1 py-1 text-right">
              {tonnes(totalPoidsKg)}
            </td>
            <td className="border border-black px-1 py-1">&nbsp;</td>
            <td className="border border-black px-1 py-1">&nbsp;</td>
            <td className="border border-black px-1 py-1">&nbsp;</td>
            <td className="border border-black px-1 py-1 text-right">
              {numFr(totalBrut)}
            </td>
            <td className="border border-black px-1 py-1">&nbsp;</td>
            <td className="border border-black px-1 py-1">&nbsp;</td>
            <td className="border border-black px-1 py-1 text-right">
              {numFr(totalBrut)}
            </td>
            <td className="border border-black px-1 py-1 text-right">
              {totalQteGasoil > 0 ? numFr(totalQteGasoil) : ''}
            </td>
            <td className="border border-black px-1 py-1">&nbsp;</td>
            <td className="border border-black px-1 py-1 text-right">
              {totalGasoil > 0 ? `− ${numFr(totalGasoil)}` : ''}
            </td>
            <td className="border border-black px-1 py-1 text-right font-bold">
              {numFr(totalNet)}
            </td>
          </tr>
        </tfoot>
      </table>

      <p className="mt-4 text-[11px]">
        <span className="font-semibold">
          Arrêtée la présente facture à la somme de :
        </span>{' '}
        <span className="italic">
          {montantFCFAEnLettres(totalNet)}
        </span>
      </p>

      <div className="mt-4">
        <p className="text-[11px] font-bold uppercase">
          NB : ARTICLE 9 TARIFICATION
        </p>
        <table className="mt-1 w-[480px] border-collapse text-[10px]">
          <thead>
            <tr className="bg-neutral-50">
              <th className="border border-black px-1.5 py-1 text-left font-semibold">
                DISTANCE
              </th>
              <th className="border border-black px-1.5 py-1 text-center font-semibold">
                TYPE DE FRET
              </th>
              <th className="border border-black px-1.5 py-1 text-center font-semibold">
                TARIF
              </th>
              <th className="border border-black px-1.5 py-1 text-center font-semibold">
                UNITÉ
              </th>
            </tr>
          </thead>
          <tbody>
            {(tarifs ?? []).map((tarif) => (
              <tr key={tarif.id}>
                <td className="border border-black px-1.5 py-1">
                  {tarif.distance_max == null
                    ? `${numFr(tarif.distance_min)} km et plus`
                    : `${numFr(tarif.distance_min)} à ${numFr(tarif.distance_max)} km`}
                </td>
                <td className="border border-black px-1.5 py-1">
                  {labelTypeFret(tarif.type_fret)}
                </td>
                <td className="border border-black px-1.5 py-1 text-right">
                  {numFr(tarif.tarif, tarif.tarif % 1 === 0 ? 0 : 2)}
                </td>
                <td className="border border-black px-1.5 py-1 text-center">
                  {tarif.unite_tarif === 'fcfa_tkm' ? 'FCFA/TKM' : 'FCFA/tonne'}
                </td>
              </tr>
            ))}
            {(!tarifs || tarifs.length === 0) && (
              <tr>
                <td colSpan={4} className="border border-black px-1.5 py-1 text-center">
                  Aucun tarif enregistré pour cette campagne
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-8 flex justify-end pr-8">
        <p className="w-60 border-b border-black pb-1 text-center text-sm font-bold uppercase">
          LE GESTIONNAIRE
        </p>
      </div>

      <p className="mt-auto pt-6 text-center text-[9px] text-neutral-400">
        Facture {facture.numero} · {avecMention ? 'Original payable' : exemplaire} ·
        Document généré par ABAF
      </p>
    </div>
  );
}

export function FactureDocument(props: FactureDocumentProps) {
  return (
    <div>
      {EXEMPLAIRES.map((exemplaire) => (
        <FeuilletFacture key={exemplaire} {...props} exemplaire={exemplaire} />
      ))}
    </div>
  );
}
