import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Building2, DatabaseBackup, FolderOpen, RotateCcw, Save } from 'lucide-react';
import { revealItemInDir } from '@tauri-apps/plugin-opener';

import {
  Badge,
  Button,
  ConfirmDialog,
  ErrorMessage,
  Input,
  PageHeader,
  Spinner,
} from '@/components/ui';
import { useParametres, useRestaurerBase, useSauvegarderBase, useSetParametres } from '@/hooks';
import { choisirFichierSauvegarde } from '@/services';
import { useAppStore } from '@/stores/app.store';

const schema = z.object({
  entreprise_nom: z.string().trim().min(1, "Le nom de l'entreprise est obligatoire"),
  entreprise_adresse: z.string().trim(),
  entreprise_telephone: z.string().trim(),
  entreprise_email: z
    .string()
    .trim()
    .email('Adresse email invalide')
    .or(z.literal('')),
  sauvegarde_auto: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

/**
 * Page Paramètres (Phase 6, étapes 31-33) : configuration générale de
 * l'application. Les informations de l'entreprise sont reprises dans les
 * en-têtes des documents imprimés (BSM §20.1, facture §20.3) ; la sauvegarde
 * et la restauration de la base sont également pilotées ici (§24.3).
 */
export default function ParametresPage() {
  const setPageTitle = useAppStore((s) => s.setPageTitle);

  const { data, isLoading, error } = useParametres();
  const enregistrer = useSetParametres();
  const sauvegarder = useSauvegarderBase();
  const restaurer = useRestaurerBase();

  const [saved, setSaved] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [cheminSauvegarde, setCheminSauvegarde] = useState<string | null>(null);
  const [fichierRestauration, setFichierRestauration] = useState<string | null>(null);
  const [confirmationRestauration, setConfirmationRestauration] = useState(false);
  const [copieSecurite, setCopieSecurite] = useState<string | null>(null);
  const [erreurFichier, setErreurFichier] = useState<string | null>(null);

  const erreurSauvegarde = sauvegarder.error
    ? sauvegarder.error instanceof Error
      ? sauvegarder.error.message
      : String(sauvegarder.error)
    : null;

  const erreurRestauration = restaurer.error
    ? restaurer.error instanceof Error
      ? restaurer.error.message
      : String(restaurer.error)
    : null;

  const nomFichierRestauration = fichierRestauration
    ? fichierRestauration.split(/[\\/]/).pop() ?? fichierRestauration
    : '';

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      entreprise_nom: '',
      entreprise_adresse: '',
      entreprise_telephone: '',
      entreprise_email: '',
      sauvegarde_auto: false,
    },
  });

  useEffect(() => {
    setPageTitle('Paramètres');
  }, [setPageTitle]);

  // Pré-remplir le formulaire quand les paramètres sont chargés
  useEffect(() => {
    if (data) reset(data);
  }, [data, reset]);

  async function onSubmit(values: FormValues) {
    setMutationError(null);
    setSaved(false);
    try {
      const enregistres = await enregistrer.mutateAsync(values);
      reset(enregistres);
      setSaved(true);
    } catch (e: unknown) {
      setMutationError(e as string);
    }
  }

  /** Sauvegarde immédiate de la base, indépendante de l'enregistrement du formulaire. */
  function lancerSauvegarde() {
    setCheminSauvegarde(null);
    sauvegarder.mutate(undefined, {
      onSuccess: (chemin) => setCheminSauvegarde(chemin),
    });
  }

  /** Ouvre le dialogue de choix d'une sauvegarde puis demande confirmation. */
  async function choisirSauvegarde() {
    setCopieSecurite(null);
    setErreurFichier(null);
    restaurer.reset();
    try {
      const selection = await choisirFichierSauvegarde();
      if (selection) {
        setFichierRestauration(selection);
        setConfirmationRestauration(true);
      }
    } catch (e: unknown) {
      setErreurFichier(e instanceof Error ? e.message : String(e));
    }
  }

  /** Remplace la base par la sauvegarde choisie (copie de sécurité préalable). */
  function confirmerRestauration() {
    if (!fichierRestauration) return;
    restaurer.mutate(fichierRestauration, {
      onSuccess: (chemin) => {
        setCopieSecurite(chemin);
        setFichierRestauration(null);
      },
      onSettled: () => setConfirmationRestauration(false),
    });
  }

  return (
    <div>
      <PageHeader
        title="Paramètres"
        description="Configuration générale de l'application : informations de l'entreprise reprises dans les en-têtes des documents imprimés (BSM, factures), sauvegarde et restauration de la base de données."
      />

      {isLoading ? (
        <Spinner className="mt-8" />
      ) : error ? (
        <ErrorMessage message={error instanceof Error ? error.message : String(error)} />
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-6">
          {/* ── Informations de l'entreprise ── */}
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="mb-5 flex items-center gap-3">
              <span className="rounded-md bg-primary/10 p-2 text-primary">
                <Building2 size={18} />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  Informations de l'entreprise
                </h2>
                <p className="text-xs text-muted-foreground">
                  Ces coordonnées figurent sur les documents imprimés.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <Input
                label="Nom de l'entreprise"
                required
                error={errors.entreprise_nom?.message}
                {...register('entreprise_nom')}
              />
              <Input
                label="Adresse"
                hint="Ex. : Moundou, Tchad"
                error={errors.entreprise_adresse?.message}
                {...register('entreprise_adresse')}
              />
              <Input
                label="Téléphone"
                error={errors.entreprise_telephone?.message}
                {...register('entreprise_telephone')}
              />
              <Input
                label="Email"
                type="email"
                error={errors.entreprise_email?.message}
                {...register('entreprise_email')}
              />
            </div>
          </div>

          {/* ── Sauvegarde ── */}
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="mb-5 flex items-center gap-3">
              <span className="rounded-md bg-primary/10 p-2 text-primary">
                <DatabaseBackup size={18} />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Sauvegarde</h2>
                <p className="text-xs text-muted-foreground">
                  Copie de sécurité de la base de données (AGENT.md §24.3).
                </p>
              </div>
            </div>

            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-primary"
                {...register('sauvegarde_auto')}
              />
              <span className="text-sm">
                <span className="font-medium text-foreground">
                  Sauvegarde automatique au démarrage
                </span>
                <span className="block text-xs text-muted-foreground">
                  Une copie horodatée de la base est créée à chaque lancement de l'application
                  (les 10 plus récentes sont conservées).
                </span>
              </span>
            </label>

            <div className="mt-5 border-t border-border pt-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  Crée immédiatement une copie horodatée dans « Documents/ABAF ».
                </p>
                <Button
                  type="button"
                  variant="outline"
                  loading={sauvegarder.isPending}
                  icon={<DatabaseBackup size={14} />}
                  onClick={lancerSauvegarde}
                >
                  Sauvegarder maintenant
                </Button>
              </div>

              {erreurSauvegarde && <ErrorMessage message={erreurSauvegarde} className="mt-3" />}

              {cheminSauvegarde && (
                <div className="mt-3 rounded-md border border-border bg-muted/40 p-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="success">Base sauvegardée</Badge>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      icon={<FolderOpen size={14} />}
                      onClick={() => revealItemInDir(cheminSauvegarde).catch(() => undefined)}
                    >
                      Ouvrir le dossier
                    </Button>
                  </div>
                  <p className="mt-2 break-all font-mono text-xs text-muted-foreground">
                    {cheminSauvegarde}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ── Restauration ── */}
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="mb-5 flex items-center gap-3">
              <span className="rounded-md bg-primary/10 p-2 text-primary">
                <RotateCcw size={18} />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Restauration</h2>
                <p className="text-xs text-muted-foreground">
                  Remplace le contenu de la base par celui d'une sauvegarde (AGENT.md §24.3).
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Une copie de sécurité de la base actuelle est créée automatiquement avant le
                remplacement.
              </p>
              <Button
                type="button"
                variant="outline"
                loading={restaurer.isPending}
                icon={<RotateCcw size={14} />}
                onClick={choisirSauvegarde}
              >
                Restaurer une sauvegarde…
              </Button>
            </div>

            {erreurFichier && <ErrorMessage message={erreurFichier} className="mt-3" />}
            {erreurRestauration && <ErrorMessage message={erreurRestauration} className="mt-3" />}

            {copieSecurite && (
              <div className="mt-3 rounded-md border border-border bg-muted/40 p-3">
                <div className="flex items-center gap-2">
                  <Badge variant="success">Base restaurée</Badge>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    icon={<FolderOpen size={14} />}
                    onClick={() => revealItemInDir(copieSecurite).catch(() => undefined)}
                  >
                    Ouvrir le dossier
                  </Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Copie de sécurité de la base précédente :
                </p>
                <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
                  {copieSecurite}
                </p>
              </div>
            )}
          </div>

          {mutationError && <ErrorMessage message={mutationError} />}

          {saved && (
            <p className="text-sm font-medium text-green-600">
              Paramètres enregistrés avec succès.
            </p>
          )}

          <Button
            type="submit"
            loading={enregistrer.isPending}
            disabled={!isDirty}
            icon={<Save size={14} />}
          >
            Enregistrer
          </Button>
        </form>
      )}

      <ConfirmDialog
        open={confirmationRestauration}
        onClose={() => {
          setConfirmationRestauration(false);
          setFichierRestauration(null);
        }}
        onConfirm={confirmerRestauration}
        title="Restaurer cette sauvegarde ?"
        message={`La base actuelle sera entièrement remplacée par « ${nomFichierRestauration} ». Une copie de sécurité de la base actuelle sera créée automatiquement avant l'opération.`}
        confirmLabel="Restaurer"
        loading={restaurer.isPending}
      />
    </div>
  );
}
