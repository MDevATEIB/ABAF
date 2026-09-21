import type { Bordereau, LigneBordereau } from '@/types';
import { formatDate, formatDistance, formatKg } from '@/utils';

// ─── Champ libellé / valeur ───────────────────────────────────────────────────
function Champ({ label, valeur }: { label: string; valeur?: string }) {
  return (
    <p>
      <span className="text-neutral-500">{label} : </span>
      <span className="font-medium">{valeur ? valeur : '—'}</span>
    </p>
  );
}

// ─── Carte d'information de chargement ────────────────────────────────────────
function CarteChargement({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div className="border border-neutral-400 p-2">
      <p className="text-[10px] text-neutral-500">{label}</p>
      <p className="mt-0.5 font-semibold">{valeur}</p>
    </div>
  );
}

// ─── Document bordereau de transport (AGENT.md §20.2) ─────────────────────────
interface BordereauDocumentProps {
  bordereau: Bordereau;
  lignes: LigneBordereau[];
  camionNom?: string;
  chauffeurNom?: string;
  usineNom?: string;
  cgiNom?: string;
  missionRef?: string;
  saisonLibelle?: string;
  /** Correspondance id d'AV → nom, pour libeller les lots. */
  avNom: Map<number, string>;
}

/**
 * Document imprimable d'un bordereau de transport et de livraison
 * (AGENT.md §20.2) : en-tête COTONTCHAD SN, numéro, usine, date, camion,
 * chauffeur, CGI, AV, poids, code, observations, total poids, informations de
 * chargement, mention automatique « ORIGINAL PAYABLE » (CDC v1.1 §11.2) et
 * signatures.
 */
export function BordereauDocument({
  bordereau,
  lignes,
  camionNom,
  chauffeurNom,
  usineNom,
  cgiNom,
  missionRef,
  saisonLibelle,
  avNom,
}: BordereauDocumentProps) {
  const totalPoids = lignes.reduce((total, ligne) => total + ligne.poids_kg, 0);

  return (
    <div className="feuille-document flex flex-col text-xs leading-snug">
      {/* ── En-tête COTONTCHAD SN ── */}
      <div className="flex items-start justify-between gap-6 border-b-2 border-black pb-3">
        <div className="flex items-center gap-3">
          <div className="shrink-0 border-2 border-black px-3 py-2 text-center text-[10px] font-bold uppercase leading-tight">
            Cotontchad
            <br />
            SN
          </div>
          <div>
            <p className="text-base font-bold uppercase tracking-wide">Cotontchad SN</p>
            <p className="text-[10px] text-neutral-600">Société Cotonnière du Tchad</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold uppercase">Bordereau de transport et de livraison</p>
          <p className="mt-1 font-semibold">N° {bordereau.numero}</p>
          <p className="text-[11px] text-neutral-600">Date : {formatDate(bordereau.date_bordereau)}</p>
          {/* CDC v1.1 §11.2 : mention ajoutée automatiquement sur les bordereaux imprimés. */}
          <p className="mt-1.5 inline-block border-2 border-black px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide">
            Original payable
          </p>
        </div>
      </div>

      {/* ── Informations ── */}
      <div className="mt-4 grid grid-cols-3 gap-x-6 gap-y-1.5">
        <Champ label="Usine" valeur={usineNom} />
        <Champ label="Camion" valeur={camionNom} />
        <Champ label="Chauffeur" valeur={chauffeurNom} />
        <Champ label="CGI" valeur={cgiNom} />
        <Champ label="Campagne" valeur={saisonLibelle} />
        <Champ label="Mission" valeur={missionRef} />
      </div>

      {/* ── Lots d'AV ── */}
      <table className="mt-5 w-full border-collapse">
        <thead>
          <tr className="bg-neutral-100">
            <th className="border border-neutral-400 px-2 py-1.5 text-left font-semibold">AV</th>
            <th className="border border-neutral-400 px-2 py-1.5 text-left font-semibold">Localité</th>
            <th className="border border-neutral-400 px-2 py-1.5 text-right font-semibold">Poids (kg)</th>
            <th className="border border-neutral-400 px-2 py-1.5 text-left font-semibold">Code</th>
            <th className="border border-neutral-400 px-2 py-1.5 text-left font-semibold">Observations</th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((ligne) => (
            <tr key={ligne.id}>
              <td className="border border-neutral-400 px-2 py-1.5">
                {ligne.av_id ? avNom.get(ligne.av_id) ?? '—' : '—'}
              </td>
              <td className="border border-neutral-400 px-2 py-1.5">{ligne.localite || '—'}</td>
              <td className="border border-neutral-400 px-2 py-1.5 text-right">{formatKg(ligne.poids_kg)}</td>
              <td className="border border-neutral-400 px-2 py-1.5">{ligne.code || '—'}</td>
              <td className="border border-neutral-400 px-2 py-1.5">{ligne.observations || '—'}</td>
            </tr>
          ))}
          {lignes.length === 0 && (
            <tr>
              <td colSpan={5} className="border border-neutral-400 px-2 py-2 text-center text-neutral-500">
                Aucun lot enregistré.
              </td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr className="bg-neutral-100">
            <td colSpan={2} className="border border-neutral-400 px-2 py-1.5 font-semibold">
              Total poids
            </td>
            <td className="border border-neutral-400 px-2 py-1.5 text-right font-bold">
              {formatKg(totalPoids)}
            </td>
            <td colSpan={2} className="border border-neutral-400 px-2 py-1.5" />
          </tr>
        </tfoot>
      </table>

      {/* ── Informations de chargement ── */}
      <div className="mt-4 grid grid-cols-4 gap-3">
        <CarteChargement
          label="Poids à vide"
          valeur={bordereau.poids_vide_kg != null ? formatKg(bordereau.poids_vide_kg) : '—'}
        />
        <CarteChargement
          label="Poids chargé"
          valeur={bordereau.poids_charge_kg != null ? formatKg(bordereau.poids_charge_kg) : '—'}
        />
        <CarteChargement
          label="Poids net coton"
          valeur={bordereau.poids_net_kg != null ? formatKg(bordereau.poids_net_kg) : '—'}
        />
        <CarteChargement
          label="Distance"
          valeur={bordereau.distance_km != null ? formatDistance(bordereau.distance_km) : '—'}
        />
      </div>

      {/* ── Observations ── */}
      {bordereau.observations && (
        <p className="mt-3">
          <span className="text-neutral-500">Observations : </span>
          <span>{bordereau.observations}</span>
        </p>
      )}

      {/* ── Signatures ── */}
      <div className="mt-14 grid grid-cols-3 gap-10 text-center">
        <div className="border-t border-black pt-1.5">Le Chauffeur</div>
        <div className="border-t border-black pt-1.5">Le Responsable (Usine)</div>
        <div className="border-t border-black pt-1.5">La Direction ABAF</div>
      </div>

      {/* ── Pied de page ── */}
      <p className="mt-auto pt-8 text-center text-[9px] text-neutral-400">
        Bordereau {bordereau.numero} · Campagne {saisonLibelle ?? '—'} · Document généré par ABAF
      </p>
    </div>
  );
}
