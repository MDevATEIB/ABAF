import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Eye, Trash2, Check, Undo2, FileText, Printer } from 'lucide-react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';

import {
  Button, Input, Select, Badge, Modal,
  PageHeader, EmptyState, Spinner, ErrorMessage, Pagination,
} from '@/components/ui';
import {
  useBordereaux, useLignesBordereau, useCreerBordereau, useModifierBordereau,
  useValiderBordereau, useDevaliderBordereau,
  useSaisons, useCamions, useChauffeurs, useUsines, useCgis, useAvs, useMissions,
  useCreerCgi, useCreerAv, useCreerCamion, useCreerChauffeur, useCreerUsine,
  usePagination, useProchainNumero, usePrixGasoil,
} from '@/hooks';
import type {
  AV, BSM, Bordereau, CGI, Camion, Chauffeur, Saison, StatutBordereau, Usine,
} from '@/types';
import {
  TYPES_FRET, formatDate, formatFCFA, formatKg, labelCourtTypeFret, labelTypeFret,
  capaciteToPoidsVideKg,
} from '@/utils';

// ─── Cycle de vie d'un bordereau (AGENT.md §12) ───────────────────────────────
const STATUTS_BORDEREAU: { value: StatutBordereau; label: string }[] = [
  { value: 'brouillon', label: 'Brouillon' },
  { value: 'valide',    label: 'Validé' },
  { value: 'facture',   label: 'Facturé' },
];

function labelStatutBordereau(statut: StatutBordereau) {
  return STATUTS_BORDEREAU.find((s) => s.value === statut)?.label ?? statut;
}

function varianteStatutBordereau(statut: StatutBordereau): 'muted' | 'default' | 'success' {
  if (statut === 'brouillon') return 'muted';
  if (statut === 'valide') return 'success';
  return 'default';
}

// ─── Schéma de validation ─────────────────────────────────────────────────────
const ligneSchema = z.object({
  av_id:        z.coerce.number({ invalid_type_error: "L'AV est requis" }).min(1, "L'AV est requis"),
  localite:     z.string().optional(),
  poids_kg:     z.coerce
    .number({ invalid_type_error: 'Le poids est requis' })
    .positive('Le poids doit être supérieur à 0'),
  distance_km:  z.coerce
    .number()
    .optional()
    .transform((v) => (v === 0 || v == null || Number.isNaN(v) ? undefined : v)),
  code:         z.string().optional(),
  observations: z.string().optional(),
});

type FormValues = {
  numero: string;
  saison_id: number;
  mission_id?: number;
  camion_id: number;
  chauffeur_id?: number;
  usine_id?: number;
  cgi_id?: number;
  date_bordereau: string;
  distance_km?: number;
  type_fret: 'direct' | 'retour' | 'evacuation' | 'transfert';
  observations?: string;
  lignes: {
    av_id: number;
    localite?: string;
    poids_kg: number;
    distance_km?: number;
    code?: string;
    observations?: string;
  }[];
  // ── Section Gasoil (BSM) optionnelle ──
  gasoil_enabled: boolean;
  quantite_litres_gasoil?: number;
  prix_litre_gasoil?: number;
  beneficiaire_gasoil?: string;
  imputation_gasoil?: string;
  reference_gasoil?: string;
};
const schema = z.object({
  /** Numéro du bordereau. Laisser vide pour génération automatique
   *  par année (format `2026-0138`, backend). */
  numero:         z.string().default(''),
  saison_id:      z.coerce.number({ invalid_type_error: 'La campagne est requise' }).min(1, 'La campagne est requise'),
  mission_id:     z.coerce.number().optional().transform((v) => (v ? v : undefined)),
  camion_id:      z.coerce.number({ invalid_type_error: 'Le camion est requis' }).min(1, 'Le camion est requis'),
  chauffeur_id:   z.coerce.number().optional().transform((v) => (v ? v : undefined)),
  usine_id:       z.coerce.number().optional().transform((v) => (v ? v : undefined)),
  cgi_id:         z.coerce.number().optional().transform((v) => (v ? v : undefined)),
  date_bordereau: z.string().min(1, 'La date est requise'),
  distance_km:    z.coerce.number().optional().transform((v) => (v ? v : undefined)),
  type_fret:      z.enum(['direct', 'retour', 'evacuation', 'transfert']),
  observations:   z.string().optional(),
  lignes:         z.array(ligneSchema).min(1, 'Ajoutez au moins une ligne.'),
  // Section Gasoil
  gasoil_enabled: z.boolean().default(false),
  quantite_litres_gasoil: z.coerce
    .number()
    .optional()
    .transform((v) => (v == null || Number.isNaN(v) ? undefined : v)),
  prix_litre_gasoil: z.coerce
    .number()
    .optional()
    .transform((v) => (v == null || Number.isNaN(v) ? undefined : v)),
  beneficiaire_gasoil: z.string().optional(),
  imputation_gasoil:   z.string().optional(),
  reference_gasoil:    z.string().optional(),
});

const LIGNE_VIDE = {
  av_id: 0,
  localite: '',
  poids_kg: undefined as unknown as number,
  distance_km: undefined,
  code: '',
  observations: '',
};

// ─── Formulaire (création + modification) ─────────────────────────────────────
interface BordereauFormProps {
  defaultValues: Partial<FormValues>;
  onSubmit: (values: FormValues) => Promise<void>;
  loading: boolean;
  error?: string | null;
  submitLabel: string;
  onCancel: () => void;
  isEdit?: boolean;
  saisons: Saison[];
  camions: Camion[];
  chauffeurs: Chauffeur[];
  usines: Usine[];
  cgis: CGI[];
  avs: AV[];
  bsms?: BSM[];
}

function BordereauForm({
  defaultValues, onSubmit, loading, error, submitLabel, onCancel, isEdit = false,
  saisons, camions, chauffeurs, usines, cgis, avs, bsms = [],
}: BordereauFormProps) {
  const { register, handleSubmit, watch, setValue, control, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues,
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'lignes' });

  const saisonId        = Number(watch('saison_id')) || 0;
  const usineId         = Number(watch('usine_id')) || 0;
  const cgiId           = Number(watch('cgi_id')) || 0;
  const camionActuel    = Number(watch('camion_id')) || 0;
  const lignesWatch     = watch('lignes') ?? [];
  const totalKg         = lignesWatch.reduce((somme, l) => somme + (Number(l?.poids_kg) || 0), 0);
  const totalKm         = lignesWatch.reduce((somme, l) => somme + (Number(l?.distance_km) || 0), 0);
  const avidsDesLignes  = lignesWatch.map((l) => Number(l?.av_id) || 0);
  const dateBordereau   = watch('date_bordereau') || new Date().toISOString().slice(0, 10);
  const numeroManuel    = watch('numero') ?? '';
  const gasoilEnabled   = watch('gasoil_enabled') ?? false;
  const quantiteGasoil  = Number(watch('quantite_litres_gasoil')) || 0;
  const prixGasoil      = Number(watch('prix_litre_gasoil')) || 0;

  const { data: prochainNumero } = useProchainNumero('bordereaux', dateBordereau, !isEdit);
  const numeroAuto = prochainNumero ?? '2026-0001';
  const { data: prochainBsm } = useProchainNumero('bsm', dateBordereau, gasoilEnabled && !isEdit);
  const { data: prixGasoilSaison } = usePrixGasoil(saisonId || undefined);

  useEffect(() => {
    if (!isEdit && !numeroManuel && prochainNumero) {
      setValue('numero', prochainNumero, { shouldDirty: false, shouldValidate: false });
    }
  }, [prochainNumero]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pré-remplir le prix du gasoil avec le prix de la saison (si non modifié manuellement)
  useEffect(() => {
    if (gasoilEnabled && saisonId && prixGasoilSaison?.prix_litre && !prixGasoil) {
      setValue('prix_litre_gasoil', prixGasoilSaison.prix_litre);
    }
  }, [gasoilEnabled, saisonId]); // eslint-disable-line react-hooks/exhaustive-deps

  const montantGasoilEstime = quantiteGasoil * prixGasoil;

  const camionSelectionne = camions.find((c) => c.id === camionActuel);
  const poidsVideCamionKg = capaciteToPoidsVideKg(camionSelectionne?.capacite_tonnes);
  const poidsBrutCalcule  = poidsVideCamionKg != null ? poidsVideCamionKg + totalKg : null;

  const creerCgi = useCreerCgi();
  const creerAv  = useCreerAv();
  const creerCamion    = useCreerCamion();
  const creerChauffeur = useCreerChauffeur();
  const creerUsine     = useCreerUsine();
  const qc = useQueryClient();

  const [showCgiModal, setShowCgiModal] = useState(false);
  const [showAvModal, setShowAvModal]  = useState<number | null>(null);
  const [showCamionModal, setShowCamionModal]   = useState(false);
  const [showChauffeurModal, setShowChauffeurModal] = useState(false);
  const [showUsineModal, setShowUsineModal]     = useState(false);
  const [cgiError, setCgiError] = useState<string | null>(null);
  const [avError, setAvError]   = useState<string | null>(null);
  const [camionError, setCamionError]     = useState<string | null>(null);
  const [chauffeurError, setChauffeurError] = useState<string | null>(null);
  const [usineError, setUsineError]       = useState<string | null>(null);

  const cgiMiniSchema = z.object({
    nom:      z.string().min(1, 'Le nom est requis'),
    usine_id: z.coerce.number({ invalid_type_error: "L'usine est requise" }).min(1, "L'usine est requise"),
    localite: z.string().optional(),
  });
  const avMiniSchema = z.object({
    nom:      z.string().min(1, 'Le nom est requis'),
    cgi_id:   z.coerce.number().optional().transform((v) => (v ? v : undefined)),
    localite: z.string().optional(),
  });
  const camionMiniSchema = z.object({
    immatriculation: z.string().min(1, "L'immatriculation est requise"),
    marque:          z.string().optional(),
    modele:          z.string().optional(),
    capacite_tonnes: z.coerce.number().optional().transform((v) => (v && v > 0 ? v : undefined)),
  });
  const chauffeurMiniSchema = z.object({
    nom:       z.string().min(1, 'Le nom est requis'),
    prenom:    z.string().optional(),
    telephone: z.string().optional(),
  });
  const usineMiniSchema = z.object({
    nom:      z.string().min(1, 'Le nom est requis'),
    localite: z.string().optional(),
  });

  const cgiMiniForm = useForm<z.infer<typeof cgiMiniSchema>>({
    resolver: zodResolver(cgiMiniSchema),
    defaultValues: { nom: '', usine_id: usineId || 0, localite: '' },
  });
  const avMiniForm = useForm<z.infer<typeof avMiniSchema>>({
    resolver: zodResolver(avMiniSchema),
    defaultValues: { nom: '', cgi_id: cgiId || 0, localite: '' },
  });
  const camionMiniForm = useForm<z.infer<typeof camionMiniSchema>>({
    resolver: zodResolver(camionMiniSchema),
    defaultValues: { immatriculation: '', marque: '', modele: '', capacite_tonnes: undefined },
  });
  const chauffeurMiniForm = useForm<z.infer<typeof chauffeurMiniSchema>>({
    resolver: zodResolver(chauffeurMiniSchema),
    defaultValues: { nom: '', prenom: '', telephone: '' },
  });
  const usineMiniForm = useForm<z.infer<typeof usineMiniSchema>>({
    resolver: zodResolver(usineMiniSchema),
    defaultValues: { nom: '', localite: '' },
  });

  async function submitCgiMini(vals: z.infer<typeof cgiMiniSchema>) {
    setCgiError(null);
    try {
      const nouveau = await creerCgi.mutateAsync({
        nom:      vals.nom,
        usine_id: vals.usine_id,
        localite: vals.localite || undefined,
      });
      await qc.invalidateQueries({ queryKey: ['cgis'] });
      setValue('cgi_id', nouveau.id);
      setShowCgiModal(false);
      cgiMiniForm.reset({ nom: '', usine_id: usineId || 0, localite: '' });
    } catch (e: unknown) {
      setCgiError(e as string);
    }
  }

  async function submitAvMini(vals: z.infer<typeof avMiniSchema>) {
    if (showAvModal == null) return;
    setAvError(null);
    try {
      const nouveau = await creerAv.mutateAsync({
        nom:      vals.nom,
        cgi_id:   vals.cgi_id,
        localite: vals.localite || undefined,
      });
      await qc.invalidateQueries({ queryKey: ['avs'] });
      setValue(`lignes.${showAvModal}.av_id`, nouveau.id, {
        shouldValidate: true,
        shouldDirty: true,
      });
      if (nouveau.localite) setValue(`lignes.${showAvModal}.localite`, nouveau.localite);
      setShowAvModal(null);
      avMiniForm.reset({ nom: '', cgi_id: cgiId || 0, localite: '' });
    } catch (e: unknown) {
      setAvError(e as string);
    }
  }

  async function submitCamionMini(vals: z.infer<typeof camionMiniSchema>) {
    setCamionError(null);
    try {
      const nouveau = await creerCamion.mutateAsync({
        immatriculation: vals.immatriculation,
        marque: vals.marque || undefined,
        modele: vals.modele || undefined,
        capacite_tonnes: vals.capacite_tonnes,
      });
      await qc.invalidateQueries({ queryKey: ['camions'] });
      setValue('camion_id', nouveau.id);
      setShowCamionModal(false);
      camionMiniForm.reset({ immatriculation: '', marque: '', modele: '', capacite_tonnes: undefined });
    } catch (e: unknown) {
      setCamionError(e as string);
    }
  }

  async function submitChauffeurMini(vals: z.infer<typeof chauffeurMiniSchema>) {
    setChauffeurError(null);
    try {
      const nouveau = await creerChauffeur.mutateAsync({
        nom:       vals.nom,
        prenom:    vals.prenom || undefined,
        telephone: vals.telephone || undefined,
      });
      await qc.invalidateQueries({ queryKey: ['chauffeurs'] });
      setValue('chauffeur_id', nouveau.id);
      setShowChauffeurModal(false);
      chauffeurMiniForm.reset({ nom: '', prenom: '', telephone: '' });
    } catch (e: unknown) {
      setChauffeurError(e as string);
    }
  }

  async function submitUsineMini(vals: z.infer<typeof usineMiniSchema>) {
    setUsineError(null);
    try {
      const nouveau = await creerUsine.mutateAsync({
        nom:      vals.nom,
        localite: vals.localite || undefined,
      });
      await qc.invalidateQueries({ queryKey: ['usines'] });
      setValue('usine_id', nouveau.id);
      setShowUsineModal(false);
      usineMiniForm.reset({ nom: '', localite: '' });
    } catch (e: unknown) {
      setUsineError(e as string);
    }
  }

  const saisonOptions = [
    { value: 0, label: '— Sélectionner —' },
    ...saisons.map((s) => ({ value: s.id, label: s.libelle })),
  ];

  const camionOptions = [
    { value: 0, label: '— Sélectionner —' },
    ...camions
      .filter((c) => c.actif === 1 || c.id === camionActuel)
      .map((c) => ({ value: c.id, label: c.immatriculation })),
  ];

  const chauffeurOptions = [
    { value: 0, label: '— Aucun —' },
    ...chauffeurs
      .filter((c) => c.actif === 1)
      .map((c) => ({ value: c.id, label: `${c.nom}${c.prenom ? ` ${c.prenom}` : ''}` })),
  ];

  const usineOptions = [
    { value: 0, label: '— Aucune —' },
    ...usines.map((u) => ({ value: u.id, label: u.nom })),
  ];

  const cgiOptions = [
    { value: 0, label: '— Aucun —' },
    ...cgis.map((c) => ({ value: c.id, label: c.nom })),
  ];

  // AV du CGI du bordereau (ou déjà référencés par une ligne)
  const avOptions = [
    { value: 0, label: '— Sélectionner —' },
    ...avs
      .filter((a) => !cgiId || a.cgi_id === cgiId || avidsDesLignes.includes(a.id))
      .map((a) => ({ value: a.id, label: a.nom })),
  ];

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Campagne"
          options={saisonOptions}
          error={errors.saison_id?.message}
          disabled={isEdit}
          {...register('saison_id')}
        />
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-sm font-medium text-foreground">Camion</label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-auto py-0.5 px-2 text-xs"
              icon={<Plus size={11} />}
              loading={creerCamion.isPending}
              onClick={() => {
                setCamionError(null);
                setShowCamionModal(true);
              }}
            >
              + Nouveau
            </Button>
          </div>
          <Select
            options={camionOptions}
            error={errors.camion_id?.message}
            {...register('camion_id')}
            label=""
            className="[&>label]:hidden"
          />
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-sm font-medium text-foreground">Chauffeur</label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-auto py-0.5 px-2 text-xs"
              icon={<Plus size={11} />}
              loading={creerChauffeur.isPending}
              onClick={() => {
                setChauffeurError(null);
                setShowChauffeurModal(true);
              }}
            >
              + Nouveau
            </Button>
          </div>
          <Select
            options={chauffeurOptions}
            error={errors.chauffeur_id?.message}
            {...register('chauffeur_id')}
            label=""
            className="[&>label]:hidden"
          />
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-sm font-medium text-foreground">Usine</label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-auto py-0.5 px-2 text-xs"
              icon={<Plus size={11} />}
              loading={creerUsine.isPending}
              onClick={() => {
                setUsineError(null);
                setShowUsineModal(true);
              }}
            >
              + Nouvelle
            </Button>
          </div>
          <Select
            options={usineOptions}
            error={errors.usine_id?.message}
            {...register('usine_id')}
            label=""
            className="[&>label]:hidden"
          />
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-sm font-medium text-foreground">CGI</label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-auto py-0.5 px-2 text-xs"
              icon={<Plus size={11} />}
              loading={creerCgi.isPending}
              onClick={() => {
                cgiMiniForm.setValue('usine_id', usineId || 0);
                setCgiError(null);
                setShowCgiModal(true);
              }}
            >
              + Nouveau
            </Button>
          </div>
          <Select
            options={cgiOptions}
            error={errors.cgi_id?.message}
            {...register('cgi_id')}
            label=""
            className="[&>label]:hidden"
          />
        </div>
        <Input
          type="date"
          label="Date du bordereau"
          error={errors.date_bordereau?.message}
          {...register('date_bordereau')}
        />
        <Input
          label="Numéro du bordereau"
          placeholder={numeroAuto}
          hint={isEdit ? undefined : `Laisser vide pour générer automatiquement (${numeroAuto}).`}
          error={errors.numero?.message}
          {...register('numero')}
        />
        <Select
          label="Type de fret"
          options={TYPES_FRET}
          error={errors.type_fret?.message}
          {...register('type_fret')}
        />
        <Input
          type="number"
          step="0.1"
          label="Distance globale (km, fallback)"
          placeholder="Ex. : 120"
          error={errors.distance_km?.message}
          {...register('distance_km')}
        />
        <Input
          label="Observations"
          placeholder="Remarques éventuelles…"
          {...register('observations')}
        />
      </div>

      {/* ── Section Gasoil (BSM) optionnelle ──────────────────────────── */}
      <div className="rounded-lg border border-border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-foreground">
            Gasoil (Bon de Sortie de Magasin — BSM)
          </label>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-border"
              checked={gasoilEnabled}
              onChange={(e) => setValue('gasoil_enabled', e.target.checked)}
            />
            <span className="text-sm text-muted-foreground">Inclure un bon de carburant</span>
          </label>
        </div>

        {gasoilEnabled && (
          <>
            {!isEdit && prochainBsm && (
              <p className="text-xs text-muted-foreground">
                Prochain numéro BSM suggéré : <span className="font-medium text-foreground">{prochainBsm}</span>
                {' · '}Laisser générer automatiquement à la validation.
              </p>
            )}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Input
                type="number"
                step="1"
                label="Quantité (L)"
                placeholder="Ex. : 150"
                error={errors.quantite_litres_gasoil?.message}
                {...register('quantite_litres_gasoil')}
              />
              <Input
                type="number"
                step="1"
                label="Prix au litre (FCFA)"
                placeholder={prixGasoilSaison?.prix_litre ? String(prixGasoilSaison.prix_litre) : 'Ex. : 650'}
                hint={prixGasoilSaison?.prix_litre ? `Prix saison : ${prixGasoilSaison.prix_litre} FCFA/L` : undefined}
                error={errors.prix_litre_gasoil?.message}
                {...register('prix_litre_gasoil')}
              />
              <div>
                <p className="text-xs text-muted-foreground mb-1">Montant estimé</p>
                <p className="text-sm font-semibold text-foreground">
                  {montantGasoilEstime > 0 ? formatFCFA(montantGasoilEstime) : '—'}
                </p>
              </div>
              <Input
                label="Bénéficiaire (facultatif)"
                placeholder="Ex. : Nom chauffeur"
                error={errors.beneficiaire_gasoil?.message}
                {...register('beneficiaire_gasoil')}
              />
              <Input
                label="Imputation (facultatif)"
                placeholder="Ex. : Mission transport"
                error={errors.imputation_gasoil?.message}
                {...register('imputation_gasoil')}
              />
              <Input
                label="Référence (facultatif)"
                placeholder="Ex. : BON-2026-0138"
                error={errors.reference_gasoil?.message}
                {...register('reference_gasoil')}
              />
            </div>
            {isEdit && bsms.length > 0 && (
              <div className="rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
                Un BSM est déjà lié à ce bordereau. Toute modification sera répercutée sur celui-ci.
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Prévisualisation poids calculés ───────────────────────────────── */}
      {(camionSelectionne || totalKg > 0) && (
        <div className="grid grid-cols-3 gap-3 rounded-lg border border-border p-3">
          <div>
            <p className="text-xs text-muted-foreground">Tare camion (capacité)</p>
            <p className="mt-0.5 text-sm font-medium text-foreground">
              {poidsVideCamionKg != null ? formatKg(poidsVideCamionKg) : '— Camion sans capacité —'}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total coton chargé (lignes)</p>
            <p className="mt-0.5 text-sm font-medium text-foreground">{formatKg(totalKg)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Poids brut calculé (tare + coton)</p>
            <p className="mt-0.5 text-sm font-medium text-foreground">
              {poidsBrutCalcule != null ? formatKg(poidsBrutCalcule) : '—'}
            </p>
          </div>
        </div>
      )}

      {/* ── Lignes du chargement (AV et poids) ──────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-foreground">Lignes du chargement (AV et poids)</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            icon={<Plus size={13} />}
            onClick={() => append({ ...LIGNE_VIDE })}
          >
            Ajouter une ligne
          </Button>
        </div>

        {errors.lignes?.root?.message && (
          <p className="text-xs text-destructive">{errors.lignes.root.message}</p>
        )}

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">AV</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Localité</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Poids (kg)</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Distance (km)</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Code</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Observations</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {fields.map((field, index) => (
                <tr key={field.id}>
                  <td className="px-3 py-2 align-middle">
                    <div className="flex items-center gap-1.5">
                      <div className="flex-1 min-w-0">
                        <Select
                          options={avOptions}
                          error={errors.lignes?.[index]?.av_id?.message}
                          {...register(`lignes.${index}.av_id`, {
                            onChange: (e) => {
                              const av = avs.find((a) => a.id === Number(e.target.value));
                              if (av?.localite) setValue(`lignes.${index}.localite`, av.localite);
                            },
                          })}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0 h-9 w-9 p-0"
                        icon={<Plus size={13} />}
                        title="Nouvel AV"
                        aria-label="Nouvel AV"
                        loading={creerAv.isPending && showAvModal === index}
                        onClick={() => {
                          avMiniForm.setValue('cgi_id', cgiId || 0);
                          setAvError(null);
                          setShowAvModal(index);
                        }}
                      />
                    </div>
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <Input
                      placeholder="Localité"
                      error={errors.lignes?.[index]?.localite?.message}
                      {...register(`lignes.${index}.localite`)}
                    />
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <Input
                      type="number"
                      step="1"
                      placeholder="Ex. : 2400"
                      error={errors.lignes?.[index]?.poids_kg?.message}
                      {...register(`lignes.${index}.poids_kg`)}
                    />
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <Input
                      type="number"
                      step="0.1"
                      placeholder="Ex. : 85"
                      error={errors.lignes?.[index]?.distance_km?.message}
                      {...register(`lignes.${index}.distance_km`)}
                    />
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <Input
                      placeholder="Code"
                      error={errors.lignes?.[index]?.code?.message}
                      {...register(`lignes.${index}.code`)}
                    />
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <Input
                      placeholder="Observation"
                      error={errors.lignes?.[index]?.observations?.message}
                      {...register(`lignes.${index}.observations`)}
                    />
                  </td>
                  <td className="px-3 py-2 align-middle text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      icon={<Trash2 size={13} />}
                      title="Supprimer la ligne"
                      aria-label="Supprimer la ligne"
                      disabled={fields.length === 1}
                      onClick={() => remove(index)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-sm text-muted-foreground">
          Total des lots : <span className="font-medium text-foreground">{formatKg(totalKg)}</span>
          {' · '} Distance cumulée : <span className="font-medium text-foreground">{totalKm.toFixed(1)} km</span>
        </p>
      </div>

      {error && <ErrorMessage message={error} />}

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" type="button" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit" loading={loading}>
          {submitLabel}
        </Button>
      </div>
    </form>

    {/* ── Sous-modal : Nouveau CGI ────────────────────────────────────────
         HORS de la balise <form> Bordereau : les formulaires imbriqués
         sont interdits en HTML et font planter le submit parent. */}
    <Modal
      open={showCgiModal}
      onClose={() => { setShowCgiModal(false); setCgiError(null); }}
      title="Nouveau CGI"
      size="sm"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          cgiMiniForm.handleSubmit(submitCgiMini)(e);
        }}
        className="space-y-4"
      >
        <Input
          label="Nom du CGI"
          placeholder="Ex. : CGI Kinkala"
          error={cgiMiniForm.formState.errors.nom?.message}
          {...cgiMiniForm.register('nom')}
        />
        <Select
          label="Usine"
          options={[
            { value: 0, label: '— Sélectionner —' },
            ...usines.map((u) => ({ value: u.id, label: u.nom })),
          ]}
          error={cgiMiniForm.formState.errors.usine_id?.message}
          {...cgiMiniForm.register('usine_id')}
        />
        <Input
          label="Localité (facultatif)"
          placeholder="Ex. : Kinkala"
          error={cgiMiniForm.formState.errors.localite?.message}
          {...cgiMiniForm.register('localite')}
        />
        {cgiError && <ErrorMessage message={cgiError} />}
        <div className="flex justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            onClick={() => { setShowCgiModal(false); setCgiError(null); }}
          >
            Annuler
          </Button>
          <Button type="submit" loading={creerCgi.isPending}>
            Créer
          </Button>
        </div>
      </form>
    </Modal>

    {/* ── Sous-modal : Nouvel AV ─────────────────────────────────────────
         HORS de la balise <form> Bordereau (même raison). */}
    <Modal
      open={showAvModal !== null}
      onClose={() => { setShowAvModal(null); setAvError(null); }}
      title="Nouvel AV (Aire de Vente)"
      size="sm"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          avMiniForm.handleSubmit(submitAvMini)(e);
        }}
        className="space-y-4"
      >
        <Input
          label="Nom de l'AV"
          placeholder="Ex. : AV Nkayi 12"
          error={avMiniForm.formState.errors.nom?.message}
          {...avMiniForm.register('nom')}
        />
        <Select
          label="CGI (défaut : celui du bordereau)"
          options={[
            { value: 0, label: '— Aucun —' },
            ...cgis.map((c) => ({ value: c.id, label: c.nom })),
          ]}
          error={avMiniForm.formState.errors.cgi_id?.message}
          {...avMiniForm.register('cgi_id')}
        />
        <Input
          label="Localité (facultatif)"
          placeholder="Ex. : Nkayi"
          error={avMiniForm.formState.errors.localite?.message}
          {...avMiniForm.register('localite')}
        />
        {avError && <ErrorMessage message={avError} />}
        <div className="flex justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            onClick={() => { setShowAvModal(null); setAvError(null); }}
          >
            Annuler
          </Button>
          <Button type="submit" loading={creerAv.isPending}>
            Créer
          </Button>
        </div>
      </form>
    </Modal>

    {/* ── Sous-modal : Nouveau Camion ──────────────────────────────────── */}
    <Modal
      open={showCamionModal}
      onClose={() => { setShowCamionModal(false); setCamionError(null); }}
      title="Nouveau camion"
      size="sm"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          camionMiniForm.handleSubmit(submitCamionMini)(e);
        }}
        className="space-y-4"
      >
        <Input
          label="Immatriculation *"
          placeholder="Ex. : AB-123-CD"
          error={camionMiniForm.formState.errors.immatriculation?.message}
          {...camionMiniForm.register('immatriculation')}
        />
        <Input
          label="Marque (facultatif)"
          placeholder="Ex. : Renault"
          error={camionMiniForm.formState.errors.marque?.message}
          {...camionMiniForm.register('marque')}
        />
        <Input
          label="Modèle (facultatif)"
          placeholder="Ex. : Kerax"
          error={camionMiniForm.formState.errors.modele?.message}
          {...camionMiniForm.register('modele')}
        />
        <Input
          type="number"
          step="0.1"
          label="Capacité (tonnes, facultatif)"
          placeholder="Ex. : 30"
          error={camionMiniForm.formState.errors.capacite_tonnes?.message}
          {...camionMiniForm.register('capacite_tonnes')}
        />
        {camionError && <ErrorMessage message={camionError} />}
        <div className="flex justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            onClick={() => { setShowCamionModal(false); setCamionError(null); }}
          >
            Annuler
          </Button>
          <Button type="submit" loading={creerCamion.isPending}>
            Créer
          </Button>
        </div>
      </form>
    </Modal>

    {/* ── Sous-modal : Nouveau Chauffeur ───────────────────────────────── */}
    <Modal
      open={showChauffeurModal}
      onClose={() => { setShowChauffeurModal(false); setChauffeurError(null); }}
      title="Nouveau chauffeur"
      size="sm"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          chauffeurMiniForm.handleSubmit(submitChauffeurMini)(e);
        }}
        className="space-y-4"
      >
        <Input
          label="Nom *"
          placeholder="Ex. : DUPONT"
          error={chauffeurMiniForm.formState.errors.nom?.message}
          {...chauffeurMiniForm.register('nom')}
        />
        <Input
          label="Prénom (facultatif)"
          placeholder="Ex. : Jean"
          error={chauffeurMiniForm.formState.errors.prenom?.message}
          {...chauffeurMiniForm.register('prenom')}
        />
        <Input
          label="Téléphone (facultatif)"
          placeholder="Ex. : +235 60 00 00 00"
          error={chauffeurMiniForm.formState.errors.telephone?.message}
          {...chauffeurMiniForm.register('telephone')}
        />
        {chauffeurError && <ErrorMessage message={chauffeurError} />}
        <div className="flex justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            onClick={() => { setShowChauffeurModal(false); setChauffeurError(null); }}
          >
            Annuler
          </Button>
          <Button type="submit" loading={creerChauffeur.isPending}>
            Créer
          </Button>
        </div>
      </form>
    </Modal>

    {/* ── Sous-modal : Nouvelle Usine ──────────────────────────────────── */}
    <Modal
      open={showUsineModal}
      onClose={() => { setShowUsineModal(false); setUsineError(null); }}
      title="Nouvelle usine"
      size="sm"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          usineMiniForm.handleSubmit(submitUsineMini)(e);
        }}
        className="space-y-4"
      >
        <Input
          label="Nom *"
          placeholder="Ex. : Usine de Moundou"
          error={usineMiniForm.formState.errors.nom?.message}
          {...usineMiniForm.register('nom')}
        />
        <Input
          label="Localité (facultatif)"
          placeholder="Ex. : Moundou"
          error={usineMiniForm.formState.errors.localite?.message}
          {...usineMiniForm.register('localite')}
        />
        {usineError && <ErrorMessage message={usineError} />}
        <div className="flex justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            onClick={() => { setShowUsineModal(false); setUsineError(null); }}
          >
            Annuler
          </Button>
          <Button type="submit" loading={creerUsine.isPending}>
            Créer
          </Button>
        </div>
      </form>
    </Modal>
    </>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function BordereauxPage() {
  const navigate = useNavigate();
  const [filtreSaisonId, setFiltreSaisonId] = useState<number | undefined>(undefined);
  const [filtreStatut, setFiltreStatut]     = useState<StatutBordereau | undefined>(undefined);

  const { data: bordereaux = [], isLoading, error } = useBordereaux(filtreSaisonId, filtreStatut);
  const { data: saisons = [] }    = useSaisons();
  const { data: camions = [] }    = useCamions();
  const { data: chauffeurs = [] } = useChauffeurs();
  const { data: usines = [] }     = useUsines();
  const { data: cgis = [] }       = useCgis();
  const { data: avs = [] }        = useAvs();
  const { data: missions = [] }   = useMissions();

  const creer     = useCreerBordereau();
  const modifier  = useModifierBordereau();
  const valider   = useValiderBordereau();
  const devalider = useDevaliderBordereau();

  const [showCreate, setShowCreate]       = useState(false);
  const [editing, setEditing]             = useState<Bordereau | null>(null);
  const [viewing, setViewing]             = useState<Bordereau | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [actionError, setActionError]     = useState<string | null>(null);

  const pagination = usePagination(bordereaux);

  // Lignes du bordereau édité / consulté
  const { data: lignesEdition, isLoading: lignesEditionLoading } = useLignesBordereau(editing?.id);
  const { data: lignesLecture, isLoading: lignesLectureLoading } = useLignesBordereau(viewing?.id);

  // Correspondances id → libellé pour l'affichage
  const saisonMap  = useMemo(() => new Map(saisons.map((s) => [s.id, s.libelle])), [saisons]);
  const camionMap  = useMemo(() => new Map(camions.map((c) => [c.id, c.immatriculation])), [camions]);
  const cgiMap     = useMemo(() => new Map(cgis.map((c) => [c.id, c.nom])), [cgis]);
  const avMap      = useMemo(() => new Map(avs.map((a) => [a.id, a.nom])), [avs]);
  const chauffeurMap = useMemo(
    () => new Map(chauffeurs.map((c) => [c.id, `${c.nom}${c.prenom ? ` ${c.prenom}` : ''}`])),
    [chauffeurs],
  );
  const missionMap = useMemo(
    () => new Map(missions.map((m) => [m.id, formatDate(m.date_mission)])),
    [missions],
  );
  const totalLignesLecture = (lignesLecture ?? []).reduce((somme, l) => somme + l.poids_kg, 0);
  const totalKmLignesLecture = (lignesLecture ?? []).reduce((somme, l) => somme + (l.distance_km ?? 0), 0);

  const saisonOuverte = saisons.find((s) => s.statut === 'ouverte');

  // ── Création ──────────────────────────────────────────────────────────────
  async function handleCreate(values: FormValues) {
    setMutationError(null);
    try {
      const numero = (values.numero ?? '').trim();
      const gasoil = values.gasoil_enabled;
      await creer.mutateAsync({
        numero:         numero ? numero : null,
        saison_id:      values.saison_id,
        camion_id:      values.camion_id,
        chauffeur_id:   values.chauffeur_id,
        usine_id:       values.usine_id,
        cgi_id:         values.cgi_id,
        date_bordereau: values.date_bordereau,
        distance_km:    values.distance_km,
        type_fret:      values.type_fret,
        observations:   values.observations || undefined,
        quantite_litres_gasoil: gasoil ? values.quantite_litres_gasoil ?? null : null,
        prix_litre_gasoil:     gasoil ? values.prix_litre_gasoil ?? null : null,
        beneficiaire_gasoil:   gasoil ? values.beneficiaire_gasoil ?? null : null,
        imputation_gasoil:     gasoil ? values.imputation_gasoil ?? null : null,
        reference_gasoil:      gasoil ? values.reference_gasoil ?? null : null,
        lignes: values.lignes.map((l) => ({
          av_id:        l.av_id,
          localite:     l.localite || undefined,
          poids_kg:     l.poids_kg,
          distance_km:  l.distance_km,
          code:         l.code || undefined,
          observations: l.observations || undefined,
        })),
      });
      setShowCreate(false);
    } catch (e: unknown) {
      setMutationError(e as string);
    }
  }

  // ── Modification ──────────────────────────────────────────────────────────
  async function handleEdit(values: FormValues) {
    if (!editing) return;
    setMutationError(null);
    try {
      const gasoil = values.gasoil_enabled;
      await modifier.mutateAsync({
        id: editing.id,
        payload: {
          numero:         (values.numero ?? '').trim(),
          camion_id:      values.camion_id,
          chauffeur_id:   values.chauffeur_id,
          usine_id:       values.usine_id,
          cgi_id:         values.cgi_id,
          date_bordereau: values.date_bordereau,
          distance_km:    values.distance_km,
          type_fret:      values.type_fret,
          observations:   values.observations || undefined,
          quantite_litres_gasoil: gasoil ? values.quantite_litres_gasoil ?? null : null,
          prix_litre_gasoil:     gasoil ? values.prix_litre_gasoil ?? null : null,
          beneficiaire_gasoil:   gasoil ? values.beneficiaire_gasoil ?? null : null,
          imputation_gasoil:     gasoil ? values.imputation_gasoil ?? null : null,
          reference_gasoil:      gasoil ? values.reference_gasoil ?? null : null,
          lignes: values.lignes.map((l) => ({
            av_id:        l.av_id,
            localite:     l.localite || undefined,
            poids_kg:     l.poids_kg,
            distance_km:  l.distance_km,
            code:         l.code || undefined,
            observations: l.observations || undefined,
          })),
        },
      });
      setEditing(null);
    } catch (e: unknown) {
      setMutationError(e as string);
    }
  }

  // ── Validation / dévalidation ─────────────────────────────────────────────
  async function handleValider(b: Bordereau) {
    setActionError(null);
    try {
      await valider.mutateAsync(b.id);
    } catch (e: unknown) {
      setActionError(e as string);
    }
  }

  async function handleDevalider(b: Bordereau) {
    setActionError(null);
    try {
      await devalider.mutateAsync(b.id);
    } catch (e: unknown) {
      setActionError(e as string);
    }
  }

  if (isLoading) return <Spinner className="mt-16" />;
  if (error)     return <ErrorMessage message="Impossible de charger les bordereaux." className="mt-4" />;

  return (
    <div>
      <PageHeader
        title="Bordereaux"
        description="Enregistrez les chargements de coton graine (AV et poids) et suivez le poids net calculé à partir des pesées."
        actions={
          <Button icon={<Plus size={15} />} onClick={() => { setMutationError(null); setShowCreate(true); }}>
            Nouveau bordereau
          </Button>
        }
      />

      {/* ── Filtres ─────────────────────────────────────────────────────────── */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Select
          label="Campagne"
          options={[
            { value: 0, label: 'Toutes les campagnes' },
            ...saisons.map((s) => ({ value: s.id, label: s.libelle })),
          ]}
          value={filtreSaisonId ?? 0}
          onChange={(e) => { setFiltreSaisonId(Number(e.target.value) || undefined); pagination.reset(); }}
          className="w-56"
        />
        <Select
          label="Statut"
          options={[{ value: '', label: 'Tous les statuts' }, ...STATUTS_BORDEREAU]}
          value={filtreStatut ?? ''}
          onChange={(e) => { setFiltreStatut((e.target.value || undefined) as StatutBordereau | undefined); pagination.reset(); }}
          className="w-56"
        />
      </div>

      {actionError && <ErrorMessage message={actionError} className="mb-4" />}

      {/* ── Tableau ─────────────────────────────────────────────────────────── */}
      {bordereaux.length === 0 ? (
        <EmptyState
          icon={<FileText size={40} />}
          title="Aucun bordereau enregistré"
          description="Créez le premier bordereau pour tracer les chargements de coton graine."
          action={
            <Button size="sm" icon={<Plus size={14} />} onClick={() => setShowCreate(true)}>
              Nouveau bordereau
            </Button>
          }
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">N° Bordereau</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Camion</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Mission</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Campagne</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">CGI</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Distance</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Fret</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Poids net</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Montant brut</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Statut</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pagination.items.map((b) => (
                <tr key={b.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(b.date_bordereau)}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{b.numero}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {camionMap.get(b.camion_id) ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {b.mission_id ? missionMap.get(b.mission_id) ?? `#${b.mission_id}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{saisonMap.get(b.saison_id) ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {b.cgi_id ? cgiMap.get(b.cgi_id) ?? '—' : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    {b.distance_km != null ? `${b.distance_km} km` : '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{labelCourtTypeFret(b.type_fret)}</td>
                  <td className="px-4 py-3 text-right font-medium text-foreground">
                    {b.poids_net_kg != null ? formatKg(b.poids_net_kg) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-foreground">
                    {b.montant_brut != null ? formatFCFA(b.montant_brut) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={varianteStatutBordereau(b.statut)}>
                      {labelStatutBordereau(b.statut)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Eye size={13} />}
                        title="Consulter"
                        aria-label="Consulter le bordereau"
                        onClick={() => setViewing(b)}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Printer size={13} />}
                        title="Imprimer le bordereau"
                        aria-label="Imprimer le bordereau"
                        onClick={() => navigate(`/impression/bordereau/${b.id}`)}
                      />
                      {b.statut === 'brouillon' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Check size={13} />}
                          title="Valider le bordereau"
                          aria-label="Valider le bordereau"
                          disabled={valider.isPending}
                          onClick={() => handleValider(b)}
                        />
                      )}
                      {b.statut === 'valide' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Undo2 size={13} />}
                          title="Remettre en brouillon"
                          aria-label="Remettre le bordereau en brouillon"
                          disabled={devalider.isPending}
                          onClick={() => handleDevalider(b)}
                        />
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Pencil size={13} />}
                        title={b.statut === 'brouillon' ? 'Modifier' : 'Seul un bordereau en brouillon peut être modifié.'}
                        disabled={b.statut !== 'brouillon'}
                        onClick={() => { setMutationError(null); setEditing(b); }}
                      >
                        Modifier
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          totalItems={pagination.totalItems}
          pageSize={pagination.pageSize}
          onPageChange={pagination.goToPage}
          onPageSizeChange={pagination.setPageSize}
        />
        </>
      )}

      {/* ── Modal création ─────────────────────────────────────────────────── */}
      <Modal
        open={showCreate}
        onClose={() => { setShowCreate(false); setMutationError(null); }}
        title="Nouveau bordereau"
        size="lg"
      >
        <BordereauForm
          defaultValues={{
            saison_id:      saisonOuverte?.id ?? 0,
            camion_id:      0,
            chauffeur_id:   0,
            usine_id:       0,
            cgi_id:         0,
            date_bordereau: new Date().toISOString().slice(0, 10),
            numero:         '',
            type_fret:      'direct',
            gasoil_enabled: false,
            lignes:         [{ ...LIGNE_VIDE }],
          }}
          onSubmit={handleCreate}
          loading={creer.isPending}
          error={mutationError}
          submitLabel="Créer le bordereau"
          onCancel={() => { setShowCreate(false); setMutationError(null); }}
          saisons={saisons}
          camions={camions}
          chauffeurs={chauffeurs}
          usines={usines}
          cgis={cgis}
          avs={avs}
        />
      </Modal>

      {/* ── Modal modification ─────────────────────────────────────────────── */}
      <Modal
        open={!!editing}
        onClose={() => { setEditing(null); setMutationError(null); }}
        title="Modifier le bordereau"
        size="lg"
      >
        {editing && (lignesEditionLoading ? (
          <Spinner />
        ) : (
          <BordereauForm
            key={editing.id}
            isEdit
            defaultValues={{
              numero:         editing.numero,
              saison_id:      editing.saison_id,
              camion_id:      editing.camion_id,
              chauffeur_id:   editing.chauffeur_id ?? 0,
              usine_id:       editing.usine_id ?? 0,
              cgi_id:         editing.cgi_id ?? 0,
              date_bordereau: editing.date_bordereau,
              distance_km:    editing.distance_km,
              type_fret:      editing.type_fret ?? 'direct',
              observations:   editing.observations,
              gasoil_enabled: !!editing.bsm_id,
              lignes: (lignesEdition ?? []).map((l) => ({
                av_id:        l.av_id ?? 0,
                localite:     l.localite ?? '',
                poids_kg:     l.poids_kg,
                distance_km:  l.distance_km,
                code:         l.code ?? '',
                observations: l.observations ?? '',
              })),
            }}
            onSubmit={handleEdit}
            loading={modifier.isPending}
            error={mutationError}
            submitLabel="Enregistrer"
            onCancel={() => { setEditing(null); setMutationError(null); }}
            saisons={saisons}
            camions={camions}
            chauffeurs={chauffeurs}
            usines={usines}
            cgis={cgis}
            avs={avs}
          />
        ))}
      </Modal>

      {/* ── Modal consultation ─────────────────────────────────────────────── */}
      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title="Détail du bordereau"
        size="lg"
      >
        {viewing && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Numéro</p>
                <p className="font-medium text-foreground">{viewing.numero}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Date</p>
                <p className="font-medium text-foreground">{formatDate(viewing.date_bordereau)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Camion</p>
                <p className="font-medium text-foreground">{camionMap.get(viewing.camion_id) ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Chauffeur</p>
                <p className="font-medium text-foreground">
                  {viewing.chauffeur_id ? chauffeurMap.get(viewing.chauffeur_id) ?? '—' : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Mission</p>
                <p className="font-medium text-foreground">
                  {viewing.mission_id ? missionMap.get(viewing.mission_id) ?? `#${viewing.mission_id}` : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Campagne</p>
                <p className="font-medium text-foreground">{saisonMap.get(viewing.saison_id) ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">CGI</p>
                <p className="font-medium text-foreground">
                  {viewing.cgi_id ? cgiMap.get(viewing.cgi_id) ?? '—' : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Statut</p>
                <Badge variant={varianteStatutBordereau(viewing.statut)}>
                  {labelStatutBordereau(viewing.statut)}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Poids à vide</p>
                <p className="mt-0.5 text-sm font-medium text-foreground">
                  {viewing.poids_vide_kg != null ? formatKg(viewing.poids_vide_kg) : '—'}
                </p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Poids chargé</p>
                <p className="mt-0.5 text-sm font-medium text-foreground">
                  {viewing.poids_charge_kg != null ? formatKg(viewing.poids_charge_kg) : '—'}
                </p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Poids net coton</p>
                <p className="mt-0.5 text-sm font-medium text-foreground">
                  {viewing.poids_net_kg != null ? formatKg(viewing.poids_net_kg) : '—'}
                </p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Type de fret</p>
                <p className="mt-0.5 text-sm font-medium text-foreground">
                  {viewing.type_fret ? labelTypeFret(viewing.type_fret) : '—'}
                </p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Tarif appliqué</p>
                <p className="mt-0.5 text-sm font-medium text-foreground">
                  {viewing.tarif_applique != null
                    ? `${formatFCFA(viewing.tarif_applique)} / ${viewing.unite_tarif === 'fcfa_tkm' ? 'TKM' : 't'}`
                    : '—'}
                </p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Montant brut transport</p>
                <p className="mt-0.5 text-sm font-medium text-foreground">
                  {viewing.montant_brut != null ? formatFCFA(viewing.montant_brut) : '—'}
                </p>
              </div>
            </div>

            {lignesLectureLoading ? (
              <Spinner />
            ) : (
              <>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">AV</th>
                        <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Localité</th>
                        <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Poids</th>
                        <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Distance</th>
                        <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Code</th>
                        <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Observations</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {(lignesLecture ?? []).map((l) => (
                        <tr key={l.id}>
                          <td className="px-4 py-2.5 font-medium text-foreground">
                            {l.av_id ? avMap.get(l.av_id) ?? '—' : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground">{l.localite || '—'}</td>
                          <td className="px-4 py-2.5 text-right text-muted-foreground">{formatKg(l.poids_kg)}</td>
                          <td className="px-4 py-2.5 text-right text-muted-foreground">
                            {l.distance_km != null ? `${l.distance_km} km` : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground">{l.code || '—'}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">{l.observations || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-sm text-muted-foreground">
                  Total des lots : <span className="font-medium text-foreground">{formatKg(totalLignesLecture)}</span>
                  {' · '} Distance lignes : <span className="font-medium text-foreground">{totalKmLignesLecture > 0 ? `${totalKmLignesLecture.toFixed(1)} km` : '—'}</span>
                  {' · '} Distance bordereau : <span className="font-medium text-foreground">{viewing.distance_km != null ? `${viewing.distance_km} km` : '—'}</span>
                </p>
                {viewing.observations && (
                  <p className="text-sm text-muted-foreground">Observations : {viewing.observations}</p>
                )}
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
