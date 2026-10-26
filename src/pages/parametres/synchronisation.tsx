import { useEffect, useState } from 'react';
import {
  FolderOpen,
  KeyRound,
  ShieldCheck,
  Smartphone,
  SquarePower,
  Trash2,
  Unplug,
} from 'lucide-react';
import { revealItemInDir } from '@tauri-apps/plugin-opener';

import {
  Badge,
  Button,
  ConfirmDialog,
  ErrorMessage,
  Input,
} from '@/components/ui';
import {
  useAnnulerCodeAppairage,
  useAppareilsSync,
  useArreterServeurSync,
  useConfigurerPareFeu,
  useDemarrerServeurSync,
  useEtatSync,
  useGenererCodeAppairage,
  useOuvrirDossierJustificatifs,
  useRevoquerAppareil,
  useSupprimerAppareil,
  useTesterPortDisponible,
} from '@/hooks';
import type { Appareil } from '@/types';

/**
 * Carte « Synchronisation mobile » de la page Paramètres (plan §4) : pilotage
 * du serveur axum intégré, adresses à communiquer au terrain, règle pare-feu,
 * génération du code d'appairage à dix minutes et liste des téléphones.
 */

/** Le poste horodate le journal en UTC (`datetime('now')`) : même conversion ici. */
function secondesRestantes(expireA?: string | null): number {
  if (!expireA) return 0;
  const fin = Date.parse(expireA.replace(' ', 'T') + 'Z');
  if (Number.isNaN(fin)) return 0;
  return Math.max(0, Math.round((fin - Date.now()) / 1000));
}

function formatDuree(secondes: number): string {
  const m = Math.floor(secondes / 60);
  const s = secondes % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatTaille(octets: number): string {
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`;
  return `${(octets / (1024 * 1024)).toFixed(1)} Mo`;
}

export default function CarteSynchronisation() {
  const { data: etat } = useEtatSync();
  const { data: appareils = [] } = useAppareilsSync();

  const demarrer = useDemarrerServeurSync();
  const arreter = useArreterServeurSync();
  const genererCode = useGenererCodeAppairage();
  const annulerCode = useAnnulerCodeAppairage();
  const revoquer = useRevoquerAppareil();
  const supprimer = useSupprimerAppareil();
  const ouvrirDossier = useOuvrirDossierJustificatifs();
  const pareFeu = useConfigurerPareFeu();
  const testerPort = useTesterPortDisponible();

  const [portSaisi, setPortSaisi] = useState('9470');
  const [nomAppareil, setNomAppareil] = useState('');
  const [codeVisible, setCodeVisible] = useState<string | null>(null);
  const [reste, setReste] = useState(0);
  const [efface, setEfface] = useState<Appareil | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Le compte à rebours suit l'expiration serveure, même après un rechargement.
  useEffect(() => {
    const intervalle = setInterval(() => {
      setReste(secondesRestantes(etat?.appairage_en_cours ? etat.appairage_expire_a : null));
    }, 1000);
    return () => clearInterval(intervalle);
  }, [etat?.appairage_en_cours, etat?.appairage_expire_a]);

  const actif = etat?.actif ?? false;
  const erreur =
    demarrer.error ?? arreter.error ?? genererCode.error ?? pareFeu.error ?? testerPort.error ?? null;

  function basculerServeur() {
    setMessage(null);
    if (actif) {
      arreter.mutate(undefined, { onSuccess: () => setCodeVisible(null) });
    } else {
      const port = Number(portSaisi) || undefined;
      demarrer.mutate(port, {
        onSuccess: (nouvelEtat) => setPortSaisi(String(nouvelEtat.port)),
      });
    }
  }

  function lancerCode() {
    setMessage(null);
    genererCode.mutate(nomAppareil.trim() || undefined, {
      onSuccess: (reponse) => {
        setCodeVisible(reponse.code);
        setReste(reponse.duree_secondes);
      },
    });
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="mb-5 flex items-center gap-3">
        <span className="rounded-md bg-primary/10 p-2 text-primary">
          <Smartphone size={18} />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-foreground">Synchronisation mobile</h2>
          <p className="text-xs text-muted-foreground">
            Serveur local pour les téléphones de terrain (module Exploitation). Aucune donnée ne
            sort du réseau ; le poste reste la source de vérité.
          </p>
        </div>
        <Badge variant={actif ? 'success' : 'muted'} className="ml-auto">
          {actif ? `Serveur actif · port ${etat?.port}` : 'Serveur arrêté'}
        </Badge>
      </div>

      {/* ── Serveur + pare-feu ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-3">
        <Input
          label="Port HTTP"
          type="number"
          value={portSaisi}
          onChange={(e) => setPortSaisi(e.target.value)}
          disabled={actif}
          className="w-32"
        />
        <Button
          variant={actif ? 'destructive' : 'primary'}
          loading={demarrer.isPending || arreter.isPending}
          icon={<SquarePower size={14} />}
          onClick={basculerServeur}
        >
          {actif ? 'Arrêter le serveur' : 'Démarrer le serveur'}
        </Button>
        {!actif && (
          <Button
            variant="outline"
            loading={testerPort.isPending}
            onClick={() =>
              testerPort.mutate(Number(portSaisi) || 9470, {
                onSuccess: (libre) =>
                  setMessage(libre ? 'Le port est libre.' : 'Le port est déjà occupé sur ce poste.'),
              })
            }
          >
            Tester le port
          </Button>
        )}
        <Button
          variant="outline"
          loading={pareFeu.isPending}
          icon={<ShieldCheck size={14} />}
          onClick={() =>
            pareFeu.mutate(undefined, {
              onSuccess: () =>
                setMessage(
                  "Règles pare-feu envoyées : acceptez l'élévation Windows si elle est demandée.",
                ),
            })
          }
        >
          Configurer le pare-feu
        </Button>
      </div>

      {actif && etat && (
        <div className="mt-4 rounded-md border border-border bg-muted/40 p-3">
          <p className="text-xs font-medium text-muted-foreground">
            Adresses à donner au terrain (port {etat.port}) :
          </p>
          <ul className="mt-1 space-y-0.5">
            {etat.adresses.length === 0 && (
              <li className="text-sm text-muted-foreground">Aucune IPv4 détectée sur ce poste.</li>
            )}
            {etat.adresses.map((adresse) => (
              <li key={adresse} className="font-mono text-sm text-foreground">
                http://{adresse}:{etat.port}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            Le téléphone cherche aussi le poste en diffusion UDP {etat.port_decouverte} et sur les
            passerelles de partage de connexion.
          </p>
        </div>
      )}

      {erreur && <ErrorMessage message={String(erreur)} className="mt-3" />}
      {message && <p className="mt-3 text-sm text-muted-foreground">{message}</p>}

      {/* ── Appairage ──────────────────────────────────────────────────── */}
      <div className="mt-6 border-t border-border pt-5">
        <div className="flex flex-wrap items-end gap-3">
          <Input
            label="Nom du téléphone (facultatif)"
            placeholder="Ex : Téléphone d'Abakar"
            value={nomAppareil}
            onChange={(e) => setNomAppareil(e.target.value)}
            className="w-64"
          />
          <Button
            variant="outline"
            icon={<KeyRound size={14} />}
            loading={genererCode.isPending}
            disabled={!actif}
            onClick={lancerCode}
          >
            Générer un code d'appairage
          </Button>
          {codeVisible && (
            <Button
              variant="ghost"
              loading={annulerCode.isPending}
              onClick={() =>
                annulerCode.mutate(undefined, {
                  onSuccess: () => setCodeVisible(null),
                })
              }
            >
              Annuler le code
            </Button>
          )}
        </div>

        {(codeVisible || etat?.appairage_en_cours) && (
          <div className="mt-3 flex flex-wrap items-center gap-4 rounded-md border border-primary/30 bg-primary/5 p-4">
            {codeVisible ? (
              <span className="font-mono text-3xl font-bold tracking-[0.3em] text-primary">
                {codeVisible}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">
                Un code est déjà en cours de validité (il ne s'affiche qu'une fois).
              </span>
            )}
            <span className="text-sm text-muted-foreground">
              expire dans <span className="font-medium text-foreground">{formatDuree(reste)}</span>
            </span>
          </div>
        )}
      </div>

      {/* ── Appareils appairés ─────────────────────────────────────────── */}
      <div className="mt-6 border-t border-border pt-5">
        <p className="mb-2 text-sm font-medium text-foreground">
          Téléphones appairés
          {etat && etat.nb_appareils_revoques > 0 && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              ({etat.nb_appareils_revoques} révoqué{etat.nb_appareils_revoques > 1 ? 's' : ''})
            </span>
          )}
        </p>
        {appareils.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun téléphone appairé. Démarrez le serveur et générez un code pour en ajouter un.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Appareil</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Agent</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Dernière synchro</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Lignes envoyées</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Retard</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">À valider</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">État</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {appareils.map((a) => (
                  <tr key={a.uuid} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium text-foreground">{a.nom}</td>
                    <td className="px-4 py-3 text-muted-foreground">{a.agent}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {a.last_seen_at ? a.last_seen_at.slice(0, 16) : 'jamais'}
                    </td>
                    <td className="px-4 py-3 text-right">{a.nb_lignes_sync}</td>
                    <td className="px-4 py-3 text-right">{a.nb_changes_en_attente}</td>
                    <td className="px-4 py-3 text-right">{a.nb_depenses_a_valider}</td>
                    <td className="px-4 py-3">
                      {a.statut === 'actif' ? (
                        <Badge variant="success">Actif</Badge>
                      ) : (
                        <Badge variant="destructive">Révoqué</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {a.statut === 'actif' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<Unplug size={13} />}
                            title="Révoquer"
                            onClick={() => revoquer.mutate(a.uuid)}
                          >
                            Révoquer
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Trash2 size={13} />}
                          title="Oublier"
                          onClick={() => setEfface(a)}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Justificatifs ──────────────────────────────────────────────── */}
      {etat && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
          <p className="text-xs text-muted-foreground">
            {etat.nb_justificatifs} justificatif{etat.nb_justificatifs > 1 ? 's' : ''} photo sur
            disque ({formatTaille(etat.taille_justificatifs_octets)}) ·{' '}
            {etat.dernier_lvn > 0
              ? `journal de synchro : ${etat.dernier_lvn} changement(s)`
              : 'journal de synchro vide'}
          </p>
          <Button
            variant="outline"
            size="sm"
            icon={<FolderOpen size={14} />}
            onClick={() =>
              ouvrirDossier.mutate(undefined, {
                onSuccess: (chemin) => revealItemInDir(chemin).catch(() => undefined),
              })
            }
          >
            Ouvrir le dossier des justificatifs
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={!!efface}
        onClose={() => setEfface(null)}
        onConfirm={() => {
          if (efface) supprimer.mutate(efface.uuid, { onSuccess: () => setEfface(null) });
        }}
        title="Oublier cet appareil"
        message={`Oublier « ${efface?.nom} » ? Le téléphone devra être reappairé avec un nouveau code pour resynchroniser. Ses dépenses déjà reçues restent au bureau.`}
        confirmLabel="Oublier"
        loading={supprimer.isPending}
      />
    </div>
  );
}
