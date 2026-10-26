import React from 'react';
import { StyleSheet, Text, TextInput, View, type KeyboardTypeOptions } from 'react-native';
import { couleurs } from '../theme';

interface Props {
  label: string;
  value: string;
  onChangeText: (valeur: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
  autoFocus?: boolean;
  editable?: boolean;
  erreur?: string;
}

/** Champ étiqueté, gros texte — ergonomique pour le terrain. */
export function Field({ label, value, onChangeText, placeholder, keyboardType, multiline, autoFocus, editable = true, erreur }: Props) {
  return (
    <View style={styles.conteneur}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.saisie, multiline && styles.saisieMultiline, !editable && styles.saisieLecture, erreur ? styles.saisieErreur : null]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={couleurs.texteDoux}
        keyboardType={keyboardType}
        multiline={multiline}
        autoFocus={autoFocus}
        editable={editable}
      />
      {erreur ? <Text style={styles.erreur}>{erreur}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  conteneur: { marginBottom: 14 },
  label: { fontSize: 14, fontWeight: '600', color: couleurs.texte, marginBottom: 6 },
  saisie: {
    borderWidth: 1,
    borderColor: couleurs.bordure,
    borderRadius: 10,
    backgroundColor: couleurs.carte,
    color: couleurs.texte,
    fontSize: 17,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 50,
  },
  saisieMultiline: { minHeight: 90, textAlignVertical: 'top' },
  saisieLecture: { backgroundColor: couleurs.fond, color: couleurs.texteDoux },
  saisieErreur: { borderColor: couleurs.danger },
  erreur: { color: couleurs.danger, fontSize: 13, marginTop: 4 },
});
