import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { couleurs } from '../theme';

interface Props {
  label: string;
  valeur: string;
  onChange: (valeur: string) => void;
  erreur?: string;
  autoFocus?: boolean;
}

/** Saisie FCFA : chiffres uniquement, suffixe « FCFA », grand format. */
export function MoneyInput({ label, valeur, onChange, erreur, autoFocus }: Props) {
  return (
    <View style={styles.conteneur}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.ligne, erreur ? styles.ligneErreur : null]}>
        <TextInput
          style={styles.saisie}
          value={valeur}
          onChangeText={(texte) => onChange(texte.replace(/[^0-9]/g, ''))}
          keyboardType="number-pad"
          placeholder="0"
          placeholderTextColor={couleurs.texteDoux}
          autoFocus={autoFocus}
        />
        <Text style={styles.suffixe}>FCFA</Text>
      </View>
      {erreur ? <Text style={styles.erreur}>{erreur}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  conteneur: { marginBottom: 14 },
  label: { fontSize: 14, fontWeight: '600', color: couleurs.texte, marginBottom: 6 },
  ligne: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: couleurs.bordure,
    borderRadius: 10,
    backgroundColor: couleurs.carte,
    paddingRight: 12,
  },
  ligneErreur: { borderColor: couleurs.danger },
  saisie: { flex: 1, fontSize: 24, fontWeight: '700', color: couleurs.texte, paddingVertical: 12, paddingHorizontal: 12 },
  suffixe: { fontSize: 15, fontWeight: '600', color: couleurs.texteDoux },
  erreur: { color: couleurs.danger, fontSize: 13, marginTop: 4 },
});
