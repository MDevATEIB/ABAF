import React, { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSession } from '../store/session.store';
import { useCatalogue } from '../store/catalogue.store';
import { creerDepense, modifierDepense, type ChampsDepense, type DepenseLocale } from '../db/repos/depenses';
import { creerIntervenant, creerPiece } from '../db/repos/referentiels';
import { enregistrerPhoto } from '../sync/photos';
import { Field } from './Field';
import { MoneyInput } from './MoneyInput';
import { SelectList, type Option } from './SelectList';
import { CategoryChips } from './CategoryChips';
import { PhotoPicker } from './PhotoPicker';
import { couleurs } from '../theme';
import { todayDate } from '../utils/time';

interface Props {
  /** Ligne à éditer ; absent = création. */
  initiale?: DepenseLocale | null;
  onTermine: (uuid: string) => void;
}

/**
 * Formulaire de saisie terrain. Seul le montant et la catégorie sont
 * obligatoires ; tout le reste vient du catalogue local et reste optionnel.
 * Écriture locale avant tout réseau.
 */
export function DepenseForm({ initiale, onTermine }: Props) {
  const saisonUuid = useSession((s) => s.saisonActiveUuid);
  const catalogue = useCatalogue();

  const [categorie, setCategorie] = useState(initiale?.categorie ?? '');
  const [designation, setDesignation] = useState(initiale?.designation ?? '');
  const [montant, setMontant] = useState(initiale ? String(initiale.montant) : '');
  const [date, setDate] = useState(initiale?.date_depense ?? todayDate());
  const [camionUuid, setCamionUuid] = useState<string | null>(initiale?.camion_uuid ?? null);
  const [chauffeurUuid, setChauffeurUuid] = useState<string | null>(initiale?.chauffeur_uuid ?? null);
  const [apprentiUuid, setApprentiUuid] = useState<string | null>(initiale?.apprenti_uuid ?? null);
  const [mecanicienUuid, setMecanicienUuid] = useState<string | null>(initiale?.mecanicien_uuid ?? null);
  const [pieceUuid, setPieceUuid] = useState<string | null>(initiale?.piece_uuid ?? null);
  const [quantite, setQuantite] = useState(initiale?.quantite != null ? String(initiale.quantite) : '');
  const [unite, setUnite] = useState(initiale?.unite ?? '');
  const [lieu, setLieu] = useState(initiale?.lieu ?? '');
  const [observations, setObservations] = useState(initiale?.observations ?? '');
  const [photoUri, setPhotoUri] = useState<string | null>(initiale?.photo ?? null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);

  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    // Le catalogue peut s'être rechargé (pull) pendant la saisie : on rafraîchit
    // uniquement s'il est vide, sans écraser le choix en cours.
    if (!catalogue.charge) void catalogue.charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const optionsCamion: Option<string>[] = useMemo(
    () => catalogue.camions.map((c) => ({ value: c.uuid, label: c.immatriculation, sousTexte: [c.marque, c.modele].filter(Boolean).join(' ') })),
    [catalogue.camions],
  );
  const optionsChauffeur: Option<string>[] = useMemo(
    () => catalogue.chauffeurs.map((c) => ({ value: c.uuid, label: `${c.nom}${c.prenom ? ' ' + c.prenom : ''}` })),
    [catalogue.chauffeurs],
  );
  const optionsApprenti: Option<string>[] = useMemo(
    () => catalogue.apprentis.map((i) => ({ value: i.uuid, label: `${i.nom}${i.prenom ? ' ' + i.prenom : ''}` })),
    [catalogue.apprentis],
  );
  const optionsMecanicien: Option<string>[] = useMemo(
    () => catalogue.mecaniciens.map((i) => ({ value: i.uuid, label: `${i.nom}${i.prenom ? ' ' + i.prenom : ''}` })),
    [catalogue.mecaniciens],
  );
  const optionsPiece: Option<string>[] = useMemo(
    () => catalogue.pieces.map((p) => ({ value: p.uuid, label: p.nom, sousTexte: p.categorie ?? undefined })),
    [catalogue.pieces],
  );

  function choixVide(options: Option<string>[], uuid: string | null): string | null {
    return uuid && options.some((o) => o.value === uuid) ? uuid : uuid; // garde la valeur même hors liste (alias)
  }

  async function soumettre() {
    setErreur(null);
    const montantNum = Number(montant);
    if (!categorie) return setErreur('Catégorie obligatoire.');
    if (!designation.trim()) return setErreur('Désignation obligatoire.');
    if (!montant || Number.isNaN(montantNum) || montantNum < 0) return setErreur('Montant invalide.');
    if (!saisonUuid) return setErreur('Aucune campagne active : synchronisez avec le poste.');

    setEnCours(true);
    try {
      const champs: ChampsDepense = {
        saison_uuid: saisonUuid,
        camion_uuid: camionUuid,
        chauffeur_uuid: chauffeurUuid,
        apprenti_uuid: apprentiUuid,
        mecanicien_uuid: mecanicienUuid,
        piece_uuid: pieceUuid,
        categorie,
        designation,
        quantite: quantite.trim() ? Number(quantite) : null,
        unite: unite.trim() || null,
        montant: montantNum,
        date_depense: date,
        lieu,
        observations,
      };

      const uuid = initiale ? (await modifierDepenseLocal(initiale.uuid, champs), initiale.uuid) : await creerDepense(champs);

      if (photoBase64) {
        await enregistrerPhoto(uuid, photoUri ?? '', photoBase64);
      }
      await useCatalogue.getState().charger();
      setEnCours(false);
      onTermine(uuid);
    } catch (e) {
      setEnCours(false);
      setErreur(e instanceof Error ? e.message : String(e));
    }
  }

  async function modifierDepenseLocal(uuid: string, champs: ChampsDepense) {
    await modifierDepense(uuid, champs);
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.racine}>
      <ScrollView contentContainerStyle={styles.contenu} keyboardShouldPersistTaps="handled">
        {!saisonUuid ? (
          <Text style={styles.alerte}>Aucune campagne active. Synchronisez l’appareil avec le poste avant de saisir.</Text>
        ) : null}

        <CategoryChips valeur={categorie} onChange={setCategorie} />

        <Field label="Désignation *" value={designation} onChangeText={setDesignation} placeholder="Ex. Réparation pneu arrière" autoFocus />
        <MoneyInput label="Montant *" valeur={montant} onChange={setMontant} />

        <SelectList label="Camion" options={optionsCamion} value={choixVide(optionsCamion, camionUuid)} onChange={setCamionUuid} />
        <SelectList label="Chauffeur" options={optionsChauffeur} value={choixVide(optionsChauffeur, chauffeurUuid)} onChange={setChauffeurUuid} />

        {categorie === 'piece_rechange' ? (
          <>
            <SelectList label="Pièce de rechange" options={optionsPiece} value={choixVide(optionsPiece, pieceUuid)} onChange={setPieceUuid} />
            <PieceCreerRapide onCreee={setPieceUuid} />
            <View style={styles.ligne2}>
              <View style={styles.demi}>
                <Field label="Quantité" value={quantite} onChangeText={(t) => setQuantite(t.replace(/[^0-9.,]/g, ''))} keyboardType="decimal-pad" />
              </View>
              <View style={styles.demi}>
                <Field label="Unité" value={unite} onChangeText={setUnite} placeholder="u, L, kg…" />
              </View>
            </View>
          </>
        ) : null}

        {categorie === 'main_oeuvre' || categorie === 'chef_parc' || categorie === 'perdiem' ? (
          <>
            <SelectList label="Apprenti" options={optionsApprenti} value={choixVide(optionsApprenti, apprentiUuid)} onChange={setApprentiUuid} />
            <SelectList label="Mécanicien" options={optionsMecanicien} value={choixVide(optionsMecanicien, mecanicienUuid)} onChange={setMecanicienUuid} />
            <IntervenantCreerRapide onCreee={setMecanicienUuid} />
          </>
        ) : null}

        <Field label="Date (YYYY-MM-DD)" value={date} onChangeText={setDate} keyboardType="numbers-and-punctuation" placeholder="2025-01-15" />
        <Field label="Lieu" value={lieu} onChangeText={setLieu} placeholder="Village, atelier…" />
        <Field label="Observations" value={observations} onChangeText={setObservations} multiline placeholder="Précisions utiles au bureau" />

        <PhotoPicker
          uri={photoUri}
          onChange={(uri, base64) => {
            setPhotoUri(uri);
            setPhotoBase64(base64);
          }}
          onRetirer={() => {
            setPhotoUri(null);
            setPhotoBase64(null);
          }}
        />
        {initiale?.photo && !photoUri ? <Text style={styles.note}>Une photo est déjà jointe au poste pour cette ligne.</Text> : null}

        {erreur ? <Text style={styles.erreur}>{erreur}</Text> : null}

        <Pressable style={[styles.enregistrer, enCours && styles.boutonInactif]} onPress={() => void soumettre()} disabled={enCours || !saisonUuid}>
          <Text style={styles.enregistrerTexte}>{initiale ? 'Enregistrer les modifications' : 'Enregistrer la dépense'}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Création d'une pièce à la volée, sans quitter le formulaire. */
function PieceCreerRapide({ onCreee }: { onCreee: (uuid: string) => void }) {
  const [nom, setNom] = useState('');
  return (
    <View style={styles.rapide}>
      <View style={styles.rapideChamp}>
        <Field label="Nouvelle pièce (optionnel)" value={nom} onChangeText={setNom} placeholder="Nom de la pièce" />
      </View>
      <Pressable
        style={styles.rapideBouton}
        onPress={async () => {
          if (!nom.trim()) return;
          const uuid = await creerPiece({ nom });
          await useCatalogue.getState().charger();
          setNom('');
          onCreee(uuid);
        }}
      >
        <Text style={styles.rapideBoutonTexte}>Ajouter</Text>
      </Pressable>
    </View>
  );
}

/** Création d'un intervenant (mécanicien) à la volée. */
function IntervenantCreerRapide({ onCreee }: { onCreee: (uuid: string) => void }) {
  const [nom, setNom] = useState('');
  return (
    <View style={styles.rapide}>
      <View style={styles.rapideChamp}>
        <Field label="Nouveau mécanicien (optionnel)" value={nom} onChangeText={setNom} placeholder="Nom" />
      </View>
      <Pressable
        style={styles.rapideBouton}
        onPress={async () => {
          if (!nom.trim()) return;
          const uuid = await creerIntervenant({ nom, role: 'mecanicien' });
          await useCatalogue.getState().charger();
          setNom('');
          onCreee(uuid);
        }}
      >
        <Text style={styles.rapideBoutonTexte}>Ajouter</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  racine: { flex: 1, backgroundColor: couleurs.fond },
  contenu: { padding: 16, paddingBottom: 40 },
  alerte: { backgroundColor: couleurs.avertissementFond, color: couleurs.avertissement, padding: 12, borderRadius: 10, marginBottom: 14, fontSize: 14 },
  ligne2: { flexDirection: 'row', gap: 12 },
  demi: { flex: 1 },
  note: { fontSize: 13, color: couleurs.texteDoux, marginTop: -6, marginBottom: 12 },
  rapide: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  rapideChamp: { flex: 1 },
  rapideBouton: { borderWidth: 1, borderColor: couleurs.primaire, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 14 },
  rapideBoutonTexte: { color: couleurs.primaire, fontWeight: '700', fontSize: 15 },
  enregistrer: { backgroundColor: couleurs.primaire, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  enregistrerTexte: { color: '#fff', fontSize: 18, fontWeight: '700' },
  boutonInactif: { opacity: 0.6 },
  erreur: { color: couleurs.danger, fontSize: 15, marginBottom: 12, textAlign: 'center' },
});
