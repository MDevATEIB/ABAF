import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CATEGORIES_DEPENSE, libelleCategorieDepense } from '../types/api';
import { couleurs } from '../theme';

interface Props {
  valeur: string;
  onChange: (categorie: string) => void;
}

/** Puces de catégorie : la sélection rapide fait gagner du temps au poste. */
export function CategoryChips({ valeur, onChange }: Props) {
  return (
    <View style={styles.conteneur}>
      <Text style={styles.label}>Catégorie</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rangee}>
        {CATEGORIES_DEPENSE.map((cat) => {
          const actif = cat === valeur;
          return (
            <Pressable
              key={cat}
              onPress={() => onChange(cat)}
              style={[styles.puce, actif && styles.puceActive]}
            >
              <Text style={[styles.texte, actif && styles.texteActif]}>{libelleCategorieDepense(cat)}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  conteneur: { marginBottom: 14 },
  label: { fontSize: 14, fontWeight: '600', color: couleurs.texte, marginBottom: 6 },
  rangee: { gap: 8, paddingVertical: 2, paddingRight: 12 },
  puce: {
    borderWidth: 1,
    borderColor: couleurs.bordure,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: couleurs.carte,
  },
  puceActive: { backgroundColor: couleurs.primaire, borderColor: couleurs.primaire },
  texte: { fontSize: 15, color: couleurs.texte },
  texteActif: { color: '#fff', fontWeight: '600' },
});
