import type { BSM, Bordereau, Client, Facture, LigneBordereau, LigneFacture, Parametres, Tarif } from '@/types';
import { formatDate, formatNumeroFacture, montantFCFAEnLettres } from '@/utils';
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
  lignesBordereauParBordereauId: Map<number, LigneBordereau[]>;
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

function labelDistance(t: Tarif): string {
  if (t.distance_max == null || t.distance_max >= 9000) return `SUP à ${t.distance_min}`;
  return `DE ${t.distance_min} à ${t.distance_max}`;
}

function fmtTarif(t: Tarif): string {
  return numFr(t.tarif, t.tarif % 1 === 0 ? 0 : 1);
}

type TarifRow = {
  key: string;
  label: string;
  direct?: Tarif;
  retour?: Tarif;
  evacuation?: Tarif;
  intrant?: Tarif;
};

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
  lignesBordereauParBordereauId,
}: FeuilletFactureProps) {
  const lignesTransport = lignes.filter((l) => l.bordereau_id != null);

  const totalBrut = facture.montant_brut;
  const totalGasoil = facture.montant_gasoil;
  const totalNet = facture.montant_net;

  const totalQteGasoil = lignesTransport.reduce((t, l) => {
    const bsm = l.bsm_id != null ? bsmParId.get(l.bsm_id) : undefined;
    return t + (bsm?.quantite_litres ?? 0);
  }, 0);

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

  // Build tarif pivot rows (DISTANCE | FRET DIRECT | FRET RETOUR)
  const tarifRows: TarifRow[] = [];
  const tarifMap = new Map<string, TarifRow>();
  for (const t of (tarifs ?? [])) {
    if (t.type_fret === 'evacuation' || t.type_fret === 'transfert') {
      tarifRows.push({ key: `evac-${t.id}`, label: 'EVACUATION GRAINE', evacuation: t });
      continue;
    }
    if (
      t.type_fret === 'intrant_direct' ||
      t.type_fret === 'intrant_retour' ||
      t.type_fret === 'intrant_evacuation' ||
      t.type_fret === 'intrant_transfert'
    ) {
      const key = `intrant-${t.distance_min}-${t.distance_max ?? 'max'}`;
      tarifRows.push({ key, label: labelDistance(t), intrant: t });
      continue;
    }
    const key = `${t.distance_min}-${t.distance_max ?? 'max'}`;
    if (!tarifMap.has(key)) {
      const row: TarifRow = { key, label: labelDistance(t) };
      tarifMap.set(key, row);
      tarifRows.push(row);
    }
    const row = tarifMap.get(key)!;
    if (t.type_fret === 'direct') row.direct = t;
    else if (t.type_fret === 'retour') row.retour = t;
  }

  return (
    <div className="feuille-document feuillet-document flex flex-col text-xs leading-snug">
      <EnteteAbaf entreprise={entreprise} />

      <div className="mt-3 flex items-start justify-between gap-6">
        <div className="text-left">
          <p className="text-sm font-bold uppercase tracking-wide">
            DOIT : {client?.nom ?? '—'}
          </p>
          <p className="text-[11px] font-semibold">NIF : 9000022G</p>
          <p className="text-[11px] font-semibold">RCCMTC/NDJ 12B37</p>
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
            Moundou : {formatDate(facture.date_facture)}
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

      {/* ── Table principale : 12 colonnes ── */}
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
              colSpan={2}
              className="border border-black px-1 py-1 text-center font-semibold"
            >
              Montant Brut
            </th>
            <th
              colSpan={2}
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
            {/* Tonnage sub-columns (3) */}
            <th className="border border-black px-1 py-1 text-center font-semibold">
              Coton Graine
            </th>
            <th className="border border-black px-1 py-1 text-center font-semibold">
              Intrant
            </th>
            <th className="border border-black px-1 py-1 text-center font-semibold">
              Dist
            </th>
            {/* Montant Brut sub-columns (2) */}
            <th className="border border-black px-1 py-1 text-center font-semibold">
              Tarif
            </th>
            <th className="border border-black px-1 py-1 text-center font-semibold">
              Coton Graine
            </th>
            {/* Total sub-columns (2) */}
            <th className="border border-black px-1 py-1 text-center font-semibold">
              Intrant
            </th>
            <th className="border border-black px-1 py-1 text-center font-semibold">
              Total
            </th>
            {/* Gazoil sub-columns (3) */}
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
          {lignesTransport.map((lf) => {
            const bdr = bordereauParId.get(lf.bordereau_id!);
            const bsmLigne = lf.bsm_id != null ? bsmParId.get(lf.bsm_id) : undefined;
            const lignesBdr = lignesBordereauParBordereauId.get(lf.bordereau_id!) ?? [];

            // Fallback: if no LigneBordereau loaded, create synthetic row from LigneFacture
            if (lignesBdr.length === 0) {
              // Guard: treat 0 as "no distance" to avoid silently using wrong branch
              const distanceKm = lf.distance_km > 0 ? lf.distance_km : 0;
              const uniteTarif = bdr?.unite_tarif ?? (distanceKm > 90 ? 'fcfa_tkm' : 'fcfa_tonne');
              const montantBrutLf =
                uniteTarif === 'fcfa_tkm'
                  ? (lf.poids_net_kg / 1000) * distanceKm * lf.tarif_tonne
                  : (lf.poids_net_kg / 1000) * lf.tarif_tonne;
              const montantNetLf = montantBrutLf - lf.montant_gasoil;
              const estIntrant = bdr?.type_fret?.startsWith('intrant') ?? false;
              return (
                <tr key={lf.id}>
                  <td className="border border-black px-1 py-1 text-center">
                    <>
                      <div>Réf. ABAF : {bdr?.numero ?? '—'}</div>
                      {bdr?.numero_cotontchad && (
                        <div className="text-[9px] text-neutral-500">
                          Réf. Cotontchad : {bdr.numero_cotontchad}
                        </div>
                      )}
                    </>
                  </td>
                  {/* col 2: Coton Graine */}
                  <td className="border border-black px-1 py-1 text-right">
                    {estIntrant ? '\u00a0' : tonnes(lf.poids_net_kg)}
                  </td>
                  {/* col 3: Intrant */}
                  <td className="border border-black px-1 py-1 text-right">
                    {estIntrant ? tonnes(lf.poids_net_kg) : '\u00a0'}
                  </td>
                  <td className="border border-black px-1 py-1 text-right">
                    {numFr(distanceKm)}
                  </td>
                  <td className="border border-black px-1 py-1 text-right">
                    {numFr(lf.tarif_tonne)}
                  </td>
                  {/* col 6: Montant Brut Coton Graine */}
                  <td className="border border-black px-1 py-1 text-right">
                    {estIntrant ? '\u00a0' : numFr(Math.round(montantBrutLf))}
                  </td>
                  {/* col 7: Montant Brut Intrant */}
                  <td className="border border-black px-1 py-1 text-right">
                    {estIntrant ? numFr(Math.round(montantBrutLf)) : '0'}
                  </td>
                  {/* col 8: Total */}
                  <td className="border border-black px-1 py-1 text-right">
                    {numFr(Math.round(montantBrutLf))}
                  </td>
                  <td className="border border-black px-1 py-1 text-right">
                    {bsmLigne ? numFr(bsmLigne.quantite_litres) : ''}
                  </td>
                  <td className="border border-black px-1 py-1 text-right">
                    {bsmLigne ? numFr(bsmLigne.prix_litre) : ''}
                  </td>
                  <td className="border border-black px-1 py-1 text-right">
                    {lf.montant_gasoil > 0 ? numFr(lf.montant_gasoil) : ''}
                  </td>
                  <td className="border border-black px-1 py-1 text-right font-medium">
                    {numFr(Math.round(montantNetLf))}
                  </td>
                </tr>
              );
            }

            return lignesBdr.map((lb, idx) => {
              const isFirst = idx === 0;
              // Use lb.distance_km when present and > 0; fall back to lf.distance_km.
              const distanceKm = (lb.distance_km != null && lb.distance_km > 0)
                ? lb.distance_km
                : (lf.distance_km > 0 ? lf.distance_km : 0);
              const tonnesLb = lb.poids_kg / 1000;
              // Use unite_tarif stored on the bordereau to pick the right formula,
              // rather than hardcoding the 90 km threshold.
              const uniteTarif = bdr?.unite_tarif ?? (distanceKm > 90 ? 'fcfa_tkm' : 'fcfa_tonne');
              const montantBrutLigne =
                uniteTarif === 'fcfa_tkm'
                  ? tonnesLb * distanceKm * lf.tarif_tonne
                  : tonnesLb * lf.tarif_tonne;
              const gasoilMontant = isFirst ? lf.montant_gasoil : 0;
              const montantNetLigne = montantBrutLigne - gasoilMontant;
              const estIntrant = bdr?.type_fret?.startsWith('intrant') ?? false;

              return (
                <tr key={`${lf.id}-${lb.id}`}>
                  {/* col 1: N° Bdrs — first row only */}
                  <td className="border border-black px-1 py-1 text-center">
                    {isFirst ? (
                      <>
                        <div>Réf. ABAF : {bdr?.numero ?? '—'}</div>
                        {bdr?.numero_cotontchad && (
                          <div className="text-[9px] text-neutral-500">
                            Réf. Cotontchad : {bdr.numero_cotontchad}
                          </div>
                        )}
                      </>
                    ) : ''}
                  </td>
                  {/* col 2: Coton Graine */}
                  <td className="border border-black px-1 py-1 text-right">
                    {estIntrant ? '\u00a0' : tonnes(lb.poids_kg)}
                  </td>
                  {/* col 3: Intrant */}
                  <td className="border border-black px-1 py-1 text-right">
                    {estIntrant ? tonnes(lb.poids_kg) : '\u00a0'}
                  </td>
                  {/* col 4: Distance */}
                  <td className="border border-black px-1 py-1 text-right">
                    {numFr(distanceKm)}
                  </td>
                  {/* col 5: Tarif */}
                  <td className="border border-black px-1 py-1 text-right">
                    {numFr(lf.tarif_tonne)}
                  </td>
                  {/* col 6: Montant Brut Coton Graine */}
                  <td className="border border-black px-1 py-1 text-right">
                    {estIntrant ? '\u00a0' : numFr(Math.round(montantBrutLigne))}
                  </td>
                  {/* col 7: Montant Brut Intrant */}
                  <td className="border border-black px-1 py-1 text-right">
                    {estIntrant ? numFr(Math.round(montantBrutLigne)) : '0'}
                  </td>
                  {/* col 8: Total */}
                  <td className="border border-black px-1 py-1 text-right">
                    {numFr(Math.round(montantBrutLigne))}
                  </td>
                  {/* col 9: Gazoil Qte — first row only */}
                  <td className="border border-black px-1 py-1 text-right">
                    {isFirst && bsmLigne ? numFr(bsmLigne.quantite_litres) : ''}
                  </td>
                  {/* col 10: Gazoil P.U — first row only */}
                  <td className="border border-black px-1 py-1 text-right">
                    {isFirst && bsmLigne ? numFr(bsmLigne.prix_litre) : ''}
                  </td>
                  {/* col 11: Gazoil Montant — first row only */}
                  <td className="border border-black px-1 py-1 text-right">
                    {isFirst && lf.montant_gasoil > 0 ? numFr(lf.montant_gasoil) : ''}
                  </td>
                  {/* col 12: Montant Net */}
                  <td className="border border-black px-1 py-1 text-right font-medium">
                    {numFr(Math.round(montantNetLigne))}
                  </td>
                </tr>
              );
            });
          })}
        </tbody>
        <tfoot>
          <tr className="bg-neutral-100 font-semibold">
            <td className="border border-black px-1 py-1 text-center">TOTAL</td>
            {/* col 2: Total Coton Graine */}
            <td className="border border-black px-1 py-1 text-right">
              {tonnes(lignesTransport.reduce((sum, lf) => {
                const bdr = bordereauParId.get(lf.bordereau_id!);
                if (bdr?.type_fret?.startsWith('intrant')) return sum;
                const lbs = lignesBordereauParBordereauId.get(lf.bordereau_id!) ?? [];
                return sum + (lbs.length > 0 ? lbs.reduce((s, lb) => s + lb.poids_kg, 0) : lf.poids_net_kg);
              }, 0))}
            </td>
            {/* col 3: Total Intrant */}
            <td className="border border-black px-1 py-1 text-right">
              {tonnes(lignesTransport.reduce((sum, lf) => {
                const bdr = bordereauParId.get(lf.bordereau_id!);
                if (!bdr?.type_fret?.startsWith('intrant')) return sum;
                const lbs = lignesBordereauParBordereauId.get(lf.bordereau_id!) ?? [];
                return sum + (lbs.length > 0 ? lbs.reduce((s, lb) => s + lb.poids_kg, 0) : lf.poids_net_kg);
              }, 0))}
            </td>
            <td className="border border-black px-1 py-1">&nbsp;</td>
            <td className="border border-black px-1 py-1">&nbsp;</td>
            <td className="border border-black px-1 py-1 text-right">
              {numFr(totalBrut)}
            </td>
            <td className="border border-black px-1 py-1 text-right">0</td>
            <td className="border border-black px-1 py-1">&nbsp;</td>
            <td className="border border-black px-1 py-1 text-right">
              {totalQteGasoil > 0 ? numFr(totalQteGasoil) : ''}
            </td>
            <td className="border border-black px-1 py-1">&nbsp;</td>
            <td className="border border-black px-1 py-1 text-right">
              {totalGasoil > 0 ? numFr(totalGasoil) : ''}
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

      {/* ── NB : ARTICLE 9 TARIFICATION ── 3 colonnes : DISTANCE | FRET DIRECT | FRET RETOUR */}
      <div className="mt-4">
        <p className="text-[11px] font-bold uppercase">
          NB : ARTICLE 9 TARIFICATION
        </p>
        <table className="mt-1 w-[400px] border-collapse text-[10px]">
          <thead>
            <tr className="bg-neutral-50">
              <th className="border border-black px-1.5 py-1 text-left font-semibold">
                DISTANCE
              </th>
              <th className="border border-black px-1.5 py-1 text-center font-semibold">
                FRET DIRECT
              </th>
              <th className="border border-black px-1.5 py-1 text-center font-semibold">
                FRET RETOUR
              </th>
              <th className="border border-black px-1.5 py-1 text-center font-semibold">
                INTRANT
              </th>
            </tr>
          </thead>
          <tbody>
            {tarifRows.map((row) => (
              <tr key={row.key}>
                <td className="border border-black px-1.5 py-1">{row.label}</td>
                <td className="border border-black px-1.5 py-1 text-right">
                  {row.evacuation
                    ? fmtTarif(row.evacuation)
                    : row.direct
                    ? fmtTarif(row.direct)
                    : ''}
                </td>
                <td className="border border-black px-1.5 py-1 text-right">
                  {row.retour ? fmtTarif(row.retour) : ''}
                </td>
                <td className="border border-black px-1.5 py-1 text-right">
                  {row.intrant ? fmtTarif(row.intrant) : ''}
                </td>
              </tr>
            ))}
            {tarifRows.length === 0 && (
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
