import type { Parametres } from '@/types';

/**
 * Bloc d'en-tête ABAF (logo, raison sociale, coordonnées) partagé par les
 * documents imprimés à en-tête ABAF (BSM §20.1, facture §20.3). Les
 * coordonnées proviennent des paramètres de l'application (étape 31).
 */
export function EnteteAbaf({ entreprise }: { entreprise?: Parametres }) {
  const telephone = entreprise?.entreprise_telephone;
  const email = entreprise?.entreprise_email;
  const coordonnees = [telephone ? `Tél. : ${telephone}` : '', email ?? '']
    .filter((valeur) => valeur !== '')
    .join(' · ');

  return (
    <div className="flex items-center gap-3">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center border-2 border-black text-sm font-bold tracking-tight">
        ABAF
      </div>
      <div>
        <p className="text-base font-bold uppercase tracking-wide">
          {entreprise?.entreprise_nom || 'ABAF SARL'}
        </p>
        <p className="text-[10px] text-neutral-600">Commerce général · Import / Export · Transport</p>
        {entreprise?.entreprise_adresse && (
          <p className="text-[10px] text-neutral-600">{entreprise.entreprise_adresse}</p>
        )}
        {coordonnees && <p className="text-[10px] text-neutral-600">{coordonnees}</p>}
      </div>
    </div>
  );
}
