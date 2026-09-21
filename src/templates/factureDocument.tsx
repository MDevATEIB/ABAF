import type { BSM, Bordereau, Client, Facture, LigneFacture, Parametres } from '@/types';
import { formatDate, formatDistance, formatFCFA, formatKg, formatTKM, tkmLigne } from '@/utils';
import { EnteteAbaf } from './enteteAbaf';

// ─── Document facture (AGENT.md §20.3) ────────────────────────────────────────
interface FactureDocumentProps {
  facture: Facture;
  lignes: LigneFacture[];
  client?: Client;
  saisonLibelle?: string;
  /** Bordereaux et BSM d'origine des lignes, pour résoudre camion et usine. */
  bordereauParId: Map<number, Bordereau>;
  bsmParId: Map<number, BSM>;
  camionNom: Map<number, string>;
  usineNom: Map<number, string>;
  entreprise?: Parametres;
}

/** Les quatre exemplaires d'une facture (CDC v1.1 §7.1) : original + 3 copies. */
const EXEMPLAIRES = ['Original', 'Copie 1', 'Copie 2', 'Copie 3'] as const;

interface FeuilletFactureProps extends FactureDocumentProps {
  /** Libellé de l'exemplaire : « Original », « Copie 1 », « Copie 2 », « Copie 3 ». */
  exemplaire: string;
}

/**
 * Feuillet imprimable d'un exemplaire de la facture récapitulative
 * (AGENT.md §20.3 et CDC v1.1) : en-tête ABAF, numéro, date, client,
 * campagne, détail des opérations (bordereaux et BSM avec camion, usine,
 * tonnage et tarification), colonne TKM pour les trajets > 90 km, détail du
 * trajet, récapitulatif brut / gasoil / net, mention « ORIGINAL PAYABLE »
 * sur l'original et signature.
 */
function FeuilletFacture({
  facture,
  lignes,
  client,
  saisonLibelle,
  bordereauParId,
  bsmParId,
  camionNom,
  usineNom,
  entreprise,
  exemplaire,
}: FeuilletFactureProps) {
  const totalPoids = lignes.reduce((total, ligne) => total + ligne.poids_net_kg, 0);
  const totalBrut = lignes.reduce((total, ligne) => total + ligne.montant_brut, 0);
  const totalGasoil = lignes.reduce((total, ligne) => total + ligne.montant_gasoil, 0);
  const totalNet = lignes.reduce((total, ligne) => total + ligne.montant_net, 0);

  // TKM générés à la création de la facture (CDC v1.1) ; repli sur le calcul
  // des lignes pour les factures antérieures à la Phase 7.
  const totalTkm =
    facture.tkm ??
    lignes.reduce(
      (total, ligne) => total + (tkmLigne(ligne.poids_net_kg, ligne.distance_km) ?? 0),
      0,
    );
  const afficherTkm = totalTkm > 0;

  // La mention « ORIGINAL PAYABLE » n'apparaît que sur l'exemplaire original,
  // lorsqu'elle est activée sur la facture (CDC v1.1 §7.1).
  const estOriginal = exemplaire === EXEMPLAIRES[0];
  const avecMention = estOriginal && facture.mention_original_payable;

  return (
    <div className="feuille-document feuillet-document flex flex-col text-xs leading-snug">
      {/* ── En-tête ABAF ── */}
      <div className="flex items-start justify-between gap-6 border-b-2 border-black pb-3">
        <EnteteAbaf entreprise={entreprise} />
        <div className="text-right">
          <p className="text-sm font-bold uppercase">Facture</p>
          <p className="mt-1 font-semibold">N° {facture.numero}</p>
          <p className="text-[11px] text-neutral-600">Date : {formatDate(facture.date_facture)}</p>
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

      {/* ── Client et campagne ── */}
      <div className="mt-4 flex items-start justify-between gap-6">
        <div>
          <p className="text-[10px] font-semibold uppercase text-neutral-500">Client</p>
          <p className="mt-0.5 font-bold">{client?.nom ?? '—'}</p>
          {client?.adresse && <p className="text-[10px] text-neutral-600">{client.adresse}</p>}
          {client?.telephone && <p className="text-[10px] text-neutral-600">Tél. : {client.telephone}</p>}
        </div>
        <div className="text-right">
          <p className="text-[10px] font-semibold uppercase text-neutral-500">Campagne</p>
          <p className="mt-0.5 font-medium">{saisonLibelle ?? '—'}</p>
        </div>
      </div>

      {/* ── Détail des opérations facturées ── */}
      <table className="mt-4 w-full border-collapse text-[10px]">
        <thead>
          <tr className="bg-neutral-100">
            <th className="border border-neutral-400 px-1.5 py-1 text-left font-semibold">Bordereau / BSM</th>
            <th className="border border-neutral-400 px-1.5 py-1 text-left font-semibold">Camion</th>
            <th className="border border-neutral-400 px-1.5 py-1 text-left font-semibold">Usine</th>
            <th className="border border-neutral-400 px-1.5 py-1 text-right font-semibold">Poids net (kg)</th>
            <th className="border border-neutral-400 px-1.5 py-1 text-right font-semibold">Distance</th>
            {afficherTkm && (
              <th className="border border-neutral-400 px-1.5 py-1 text-right font-semibold">TKM</th>
            )}
            <th className="border border-neutral-400 px-1.5 py-1 text-right font-semibold">Tarif (FCFA/t)</th>
            <th className="border border-neutral-400 px-1.5 py-1 text-right font-semibold">Brut (FCFA)</th>
            <th className="border border-neutral-400 px-1.5 py-1 text-right font-semibold">Gasoil (FCFA)</th>
            <th className="border border-neutral-400 px-1.5 py-1 text-right font-semibold">Net (FCFA)</th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((ligne) => {
            const bordereau = ligne.bordereau_id != null ? bordereauParId.get(ligne.bordereau_id) : undefined;
            const bsm = ligne.bsm_id != null ? bsmParId.get(ligne.bsm_id) : undefined;
            const camionId = bordereau?.camion_id ?? bsm?.camion_id;
            const designation = bordereau?.numero ?? (bsm ? `BSM ${bsm.numero}` : ligne.description ?? '—');
            const tkm = tkmLigne(ligne.poids_net_kg, ligne.distance_km);

            return (
              <tr key={ligne.id}>
                <td className="border border-neutral-400 px-1.5 py-1">{designation}</td>
                <td className="border border-neutral-400 px-1.5 py-1">
                  {camionId != null ? camionNom.get(camionId) ?? '—' : '—'}
                </td>
                <td className="border border-neutral-400 px-1.5 py-1">
                  {bordereau?.usine_id != null ? usineNom.get(bordereau.usine_id) ?? '—' : '—'}
                </td>
                <td className="border border-neutral-400 px-1.5 py-1 text-right">
                  {bordereau ? formatKg(ligne.poids_net_kg) : '—'}
                </td>
                <td className="border border-neutral-400 px-1.5 py-1 text-right">
                  {bordereau ? formatDistance(ligne.distance_km) : '—'}
                </td>
                {afficherTkm && (
                  <td className="border border-neutral-400 px-1.5 py-1 text-right">
                    {tkm != null ? formatTKM(tkm) : '—'}
                  </td>
                )}
                <td className="border border-neutral-400 px-1.5 py-1 text-right">
                  {bordereau ? formatFCFA(ligne.tarif_tonne) : '—'}
                </td>
                <td className="border border-neutral-400 px-1.5 py-1 text-right">
                  {formatFCFA(ligne.montant_brut)}
                </td>
                <td className="border border-neutral-400 px-1.5 py-1 text-right">
                  {ligne.montant_gasoil !== 0 ? `− ${formatFCFA(ligne.montant_gasoil)}` : '—'}
                </td>
                <td className="border border-neutral-400 px-1.5 py-1 text-right font-medium">
                  {formatFCFA(ligne.montant_net)}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-neutral-100 font-semibold">
            <td colSpan={3} className="border border-neutral-400 px-1.5 py-1">
              Totaux
            </td>
            <td className="border border-neutral-400 px-1.5 py-1 text-right">{formatKg(totalPoids)}</td>
            <td className="border border-neutral-400 px-1.5 py-1" />
            {afficherTkm && (
              <td className="border border-neutral-400 px-1.5 py-1 text-right">
                {formatTKM(totalTkm)}
              </td>
            )}
            <td className="border border-neutral-400 px-1.5 py-1" />
            <td className="border border-neutral-400 px-1.5 py-1 text-right">{formatFCFA(totalBrut)}</td>
            <td className="border border-neutral-400 px-1.5 py-1 text-right">− {formatFCFA(totalGasoil)}</td>
            <td className="border border-neutral-400 px-1.5 py-1 text-right font-bold">
              {formatFCFA(totalNet)}
            </td>
          </tr>
        </tfoot>
      </table>

      {/* ── Récapitulatif ── */}
      <div className="mt-4 flex justify-end">
        <table className="w-80 border-collapse">
          <tbody>
            <tr>
              <td className="border border-neutral-400 px-2 py-1.5">Montant brut</td>
              <td className="border border-neutral-400 px-2 py-1.5 text-right">
                {formatFCFA(facture.montant_brut)}
              </td>
            </tr>
            {afficherTkm && (
              <tr>
                <td className="border border-neutral-400 px-2 py-1.5">TKM facturés (trajets &gt; 90 km)</td>
                <td className="border border-neutral-400 px-2 py-1.5 text-right">
                  {formatTKM(totalTkm)}
                </td>
              </tr>
            )}
            <tr>
              <td className="border border-neutral-400 px-2 py-1.5">Gasoil (déduit)</td>
              <td className="border border-neutral-400 px-2 py-1.5 text-right">
                − {formatFCFA(facture.montant_gasoil)}
              </td>
            </tr>
            <tr className="bg-neutral-100 font-bold">
              <td className="border border-neutral-400 px-2 py-1.5">Total à payer (net)</td>
              <td className="border border-neutral-400 px-2 py-1.5 text-right">
                {formatFCFA(facture.montant_net)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Détail du trajet (généré, CDC v1.1 §7.1) ── */}
      {facture.detail_trajet && (
        <p className="mt-2 text-[10px]">
          <span className="font-semibold">Trajets : </span>
          <span>{facture.detail_trajet}</span>
        </p>
      )}

      {/* ── Tarification ── */}
      <p className="mt-3 text-[10px] text-neutral-600">
        Facture hors TVA (CDC v1.1). Tarification : barème de la campagne — jusqu'à 90 km, montant
        brut = poids net × tarif à la tonne ; au-delà, poids net × distance × tarif à la tonne-km
        (TKM) ; montant net = montant brut − montant gasoil.
      </p>

      {/* ── Signature ── */}
      <div className="mt-12 grid grid-cols-2 gap-16 text-center">
        <div className="border-t border-black pt-1.5">Le Client</div>
        <div className="border-t border-black pt-1.5">La Direction ABAF</div>
      </div>

      {/* ── Pied de page ── */}
      <p className="mt-auto pt-6 text-center text-[9px] text-neutral-400">
        Facture {facture.numero} · Campagne {saisonLibelle ?? '—'} · {avecMention ? 'Original payable' : exemplaire} ·
        Document généré par ABAF
      </p>
    </div>
  );
}

/**
 * Document imprimable d'une facture récapitulative (AGENT.md §20.3) en quatre
 * exemplaires dans un même document (CDC v1.1 §7.1) : l'original et trois
 * copies, chaque exemplaire sur sa propre page.
 */
export function FactureDocument(props: FactureDocumentProps) {
  return (
    <div>
      {EXEMPLAIRES.map((exemplaire) => (
        <FeuilletFacture key={exemplaire} {...props} exemplaire={exemplaire} />
      ))}
    </div>
  );
}
