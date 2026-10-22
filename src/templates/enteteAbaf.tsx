import type { Parametres } from '@/types';
import logoAbaf from '@/assets/logo.png';

/**
 * Bloc d'en-tête ABAF officiel centré sur toute la largeur du document,
 * conforme à la maquette « En-tête ABAF.pdf » du dossier public/.
 *
 * Le composant est lui-même centré horizontalement et contient :
 * - À gauche : le logo ABAF (fichier `/logo.png`) dans une boîte de taille
 *   fixe ; le logo disparaît silencieusement s'il ne peut pas être chargé.
 * - À droite : la liste des activités, les mentions légales (RCCM, NIF),
 *   la boîte postale, les téléphones, le siège et les représentations,
 *   puis les comptes bancaires.
 * - En bas : un trait séparateur noir épais sur toute la largeur.
 *
 * Les valeurs de type `entreprise_*` (téléphone, email, adresse) peuvent
 * être surchargées via les paramètres ; le reste des informations
 * (activités, RCCM, comptes, etc.) correspond à ABAF.SARL.
 */
export function EnteteAbaf({ entreprise }: { entreprise?: Parametres }) {
  const telephone = entreprise?.entreprise_telephone?.trim();
  const telephoneParDefaut = '66 21 38 55 / 99 59 71 07';
  const telephoneAffiche = telephone || telephoneParDefaut;

  const email = entreprise?.entreprise_email?.trim();
  const adresse = entreprise?.entreprise_adresse?.trim();

  return (
    <div className="mx-auto flex w-full max-w-[184mm] flex-col gap-2">
      <div className="relative flex items-center">
        <div className="absolute inset-0 flex items-center justify-center text-center">
          <div className="w-full">
            <p className="text-[11px] font-semibold uppercase tracking-wide">
              TRANSPORT ET TRANSIT
            </p>
            <p className="text-[11px] font-semibold uppercase tracking-wide">
              COMMERCE GENERAL-IMPORT-EXPORT
            </p>
            <p className="text-[11px] font-semibold uppercase tracking-wide">
              COMMISSIONNAIRE ET TRANSPORT
            </p>
            <p className="text-[11px] font-semibold uppercase tracking-wide">
              CONSTRUCTION ET REFECTION-GENIE CIVIL
            </p>

            <p className="mt-1.5 text-[10px]">
              <span className="font-semibold">RCCMTC-MOU2016 E0152</span>{' '}
              <span className="font-semibold">NIF : 60008772</span>
            </p>
            <p className="text-[10px]">
              <span className="font-semibold">BP : 050</span>{' '}
              <span className="font-semibold">Tél : {telephoneAffiche}</span>
            </p>
            <p className="text-[10px] leading-snug">
              <span className="font-semibold">Siège social : Moundou</span>{' '}
              (Représentation N&apos;djaména, Abéché, Sarh, Koumra, Doba, Kélo, Pala et
              N&apos;gaoundéré)
            </p>

            <p className="mt-1 text-[10px]">
              <span className="font-semibold">N° compte bancaire : Ecobank</span>{' '}
              03213961801-16
            </p>
            <p className="text-[10px]">
              <span className="font-semibold">BAC</span> 37100746001-03 ;{' '}
              <span className="font-semibold">Orabank</span> 20654600201-70 ;{' '}
              <span className="font-semibold">CBT</span> 37140329301-66
            </p>

            {email && (
              <p className="mt-1 text-[10px] text-neutral-600">{email}</p>
            )}
            {adresse && (
              <p className="mt-0.5 text-[10px] text-neutral-600">{adresse}</p>
            )}
          </div>
        </div>

        <div className="relative mb-20 z-10 flex h-48 w-[200px] flex-shrink-0 items-center justify-center">
          <img
            src={logoAbaf}
            alt="ABAF Logo"
            className="block h-full w-full object-contain"
            loading="eager"
            onError={(e) => {
              const target = e.currentTarget;
              target.style.display = 'none';
            }}
          />
        </div>
      </div>

      <div className="border-b-2 border-black" />
    </div>
  );
}
