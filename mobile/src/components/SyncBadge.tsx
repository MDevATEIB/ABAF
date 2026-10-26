import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { couleurs } from '../theme';
import type { EtatSyncLocal } from '../db/repos/depenses';

const LIBELLES: Record<EtatSyncLocal, string> = {
  pending: 'À pousser',
  synced: 'Synchro',
  conflit: 'Conflit',
};

/** Pastille d'état de synchronisation d'une ligne. */
export function SyncBadge({ etat }: { etat: EtatSyncLocal }) {
  return (
    <View style={[styles.badge, styles[etat]]}>
      <Text style={[styles.texte, styles[`${etat}Texte`]]}>{LIBELLES[etat]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start' },
  texte: { fontSize: 12, fontWeight: '700' },
  pending: { backgroundColor: couleurs.avertissementFond },
  pendingTexte: { color: couleurs.avertissement },
  synced: { backgroundColor: couleurs.succesFond },
  syncedTexte: { color: couleurs.succes },
  conflit: { backgroundColor: couleurs.dangerFond },
  conflitTexte: { color: couleurs.danger },
});
