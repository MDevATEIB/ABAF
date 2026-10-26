import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { DepenseForm } from '../../src/components/DepenseForm';
import { couleurs } from '../../src/theme';

/**
 * L'onglet ＋ héberge directement le formulaire de saisie : pas de fenêtre
 * intermédiaire, on écrit la ligne dès que le pouce est prêt. Une clé changeante
 * réinitialise proprement le formulaire après chaque enregistrement.
 */
export default function EcranNouvelle() {
  const [cle, setCle] = useState(0);

  return (
    <View style={styles.racine} key={cle}>
      <DepenseForm onTermine={() => setCle((c) => c + 1)} />
    </View>
  );
}

const styles = StyleSheet.create({
  racine: { flex: 1, backgroundColor: couleurs.fond },
});
