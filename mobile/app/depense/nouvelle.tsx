import React from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { DepenseForm } from '../../src/components/DepenseForm';
import { couleurs } from '../../src/theme';

/** Version « plein écran » de la saisie, ouverte hors onglet ＋ (raccourcis). */
export default function EcranNouvelleDepense() {
  return (
    <View style={styles.racine}>
      <DepenseForm onTermine={() => router.back()} />
    </View>
  );
}

const styles = StyleSheet.create({
  racine: { flex: 1, backgroundColor: couleurs.fond },
});
