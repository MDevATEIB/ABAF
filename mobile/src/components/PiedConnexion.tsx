import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSession } from '../store/session.store';
import { useSync } from '../store/sync.store';
import { actualiserCompteurs } from '../sync/engine';
import { couleurs } from '../theme';

/**
 * Bandeau permanent « PC connecté / hors ligne » + file en attente, posé en
 * pied des écrans de saisie. C'est le repère de terrain : il dit si le poste
 * est joignable et ce qui reste à pousser.
 */
export function PiedConnexion() {
  const host = useSession((s) => s.host);
  const deviceUuid = useSession((s) => s.deviceUuid);
  const enAttente = useSync((s) => s.enAttente);
  const enCours = useSync((s) => s.enCours);

  useEffect(() => {
    void actualiserCompteurs();
  }, []);

  const appairé = Boolean(host && deviceUuid);
  const libelle = !appairé
    ? 'Non appairé'
    : enCours
      ? 'Synchronisation…'
      : host
        ? `Poste ${host}`
        : 'Hors ligne';

  return (
    <View style={[styles.bandeau, appairé ? styles.enLigne : styles.horsLigne]}>
      <View style={styles.point}>
        <View style={[styles.puce, appairé ? styles.puceActive : styles.puceInactive]} />
      </View>
      <Text style={styles.texte}>{libelle}</Text>
      {enAttente > 0 ? <Text style={styles.file}>· {enAttente} en attente</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bandeau: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: couleurs.carte, borderTopWidth: 1, borderTopColor: couleurs.bordure },
  enLigne: {},
  horsLigne: {},
  point: { marginRight: 8 },
  puce: { width: 10, height: 10, borderRadius: 5 },
  puceActive: { backgroundColor: couleurs.primaire },
  puceInactive: { backgroundColor: couleurs.texteDoux },
  texte: { fontSize: 13, color: couleurs.texte, fontWeight: '600' },
  file: { fontSize: 13, color: couleurs.avertissement, marginLeft: 6, fontWeight: '600' },
});
