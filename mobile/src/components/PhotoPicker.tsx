import React, { useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { couleurs } from '../theme';

interface Props {
  /** URI local (cache) affichée avant envoi. */
  uri: string | null;
  /** Called with the compressed uri + its base64 (JPEG 1280 px / q0.6). */
  onChange: (uri: string, base64: string) => void;
  onRetirer?: () => void;
}

const LARGEUR_MAX = 1280;
const QUALITE = 0.6;

/**
 * Capturer / choisir un justificatif et le compresser immédiatement : le
 * base64 prêt à pousser (~200–400 Ko) est produit hors ligne, au moment du
 * choix, pour ne pas bloquer la synchro plus tard.
 */
export function PhotoPicker({ uri, onChange, onRetirer }: Props) {
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function traiter(selection: ImagePicker.ImagePickerAsset) {
    setEnCours(true);
    setErreur(null);
    try {
      const result = await manipulateAsync(
        selection.uri,
        [{ resize: { width: LARGEUR_MAX } }],
        { compress: QUALITE, format: SaveFormat.JPEG, base64: true },
      );
      if (result.base64) onChange(result.uri, result.base64);
    } catch (e) {
      setErreur(`Compression impossible : ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setEnCours(false);
    }
  }

  async function depuisCamera() {
    const permis = await ImagePicker.requestCameraPermissionsAsync();
    if (!permis.granted) {
      setErreur('Accès à la caméra refusé.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: false });
    if (!res.canceled && res.assets[0]) await traiter(res.assets[0]);
  }

  async function depuisGalerie() {
    const permis = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permis.granted) {
      setErreur('Accès aux photos refusé.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.8, allowsMultipleSelection: false });
    if (!res.canceled && res.assets[0]) await traiter(res.assets[0]);
  }

  return (
    <View style={styles.conteneur}>
      <Text style={styles.label}>Justificatif photo</Text>
      {uri ? (
        <View>
          <Image source={{ uri }} style={styles.apercu} resizeMode="cover" />
          <Pressable onPress={onRetirer} style={styles.retirer}>
            <Text style={styles.retirerTexte}>Retirer la photo</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.boutons}>
          <Pressable onPress={depuisCamera} style={styles.bouton} disabled={enCours}>
            {enCours ? <ActivityIndicator color={couleurs.primaire} /> : <Text style={styles.boutonTexte}>📷 Appareil photo</Text>}
          </Pressable>
          <Pressable onPress={depuisGalerie} style={styles.bouton} disabled={enCours}>
            <Text style={styles.boutonTexte}>🖼️ Galerie</Text>
          </Pressable>
        </View>
      )}
      {erreur ? <Text style={styles.erreur}>{erreur}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  conteneur: { marginBottom: 14 },
  label: { fontSize: 14, fontWeight: '600', color: couleurs.texte, marginBottom: 6 },
  boutons: { flexDirection: 'row', gap: 10 },
  bouton: {
    flex: 1,
    borderWidth: 1,
    borderColor: couleurs.bordure,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: couleurs.carte,
  },
  boutonTexte: { fontSize: 16, color: couleurs.texte, fontWeight: '600' },
  apercu: { width: '100%', height: 200, borderRadius: 10, backgroundColor: couleurs.fond },
  retirer: { marginTop: 8 },
  retirerTexte: { color: couleurs.danger, fontSize: 15, fontWeight: '600' },
  erreur: { color: couleurs.danger, fontSize: 13, marginTop: 6 },
});
