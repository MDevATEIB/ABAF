import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { couleurs } from '../theme';

export function EmptyState({ titre, texte }: { titre: string; texte?: string }) {
  return (
    <View style={styles.conteneur}>
      <Text style={styles.titre}>{titre}</Text>
      {texte ? <Text style={styles.texte}>{texte}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  conteneur: { paddingVertical: 48, paddingHorizontal: 24, alignItems: 'center' },
  titre: { fontSize: 17, fontWeight: '700', color: couleurs.texte, textAlign: 'center' },
  texte: { fontSize: 15, color: couleurs.texteDoux, textAlign: 'center', marginTop: 6 },
});
