import React, { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { getDepense, supprimerDepense, type DepenseLocale } from '../../src/db/repos/depenses';
import { DepenseForm } from '../../src/components/DepenseForm';
import { SyncBadge } from '../../src/components/SyncBadge';
import { formatFCFA, formatDateCourte, libelleCategorieDepenseLocal } from '../../src/utils/formatMobile';
import { couleurs } from '../../src/theme';

export default function EcranDepense() {
  const { uuid } = useLocalSearchParams<{ uuid: string }>();
  const [ligne, setLigne] = useState<DepenseLocale | null | undefined>(undefined);
  const [editer, setEditer] = useState(false);

  const charger = useCallback(async () => {
    if (uuid) setLigne(await getDepense(uuid));
  }, [uuid]);

  useFocusEffect(
    useCallback(() => {
      void charger();
    }, [charger]),
  );

  function confirmerSuppression() {
    Alert.alert('Supprimer la dépense ?', 'Cette ligne n’a pas encore été acceptée au poste. La suppression est définitive sur cet appareil.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          if (uuid) await supprimerDepense(uuid);
          router.back();
        },
      },
    ]);
  }

  if (ligne === undefined) {
    return (
      <View style={styles.central}>
        <Text style={styles.texteCentral}>Chargement…</Text>
      </View>
    );
  }

  if (ligne === null) {
    return (
      <View style={styles.central}>
        <Text style={styles.texteCentral}>Cette dépense n’existe plus sur cet appareil.</Text>
      </View>
    );
  }

  // Ligne auditée au bureau : verrouillée, lecture seule.
  const auditee = ligne.statut === 'validee' || ligne.statut === 'rejete';
  const supprimable = ligne.sync_state !== 'synced';

  if (editer && !auditee) {
    return <DepenseForm initiale={ligne} onTermine={() => { setEditer(false); void charger(); }} />;
  }

  return (
    <ScrollView contentContainerStyle={styles.contenu}>
      <View style={styles.entete}>
        <Text style={styles.categorie}>{libelleCategorieDepenseLocal(ligne.categorie)}</Text>
        <SyncBadge etat={ligne.sync_state} />
      </View>
      <Text style={styles.montant}>{formatFCFA(ligne.montant)}</Text>
      <Text style={styles.designation}>{ligne.designation}</Text>

      <Vue label="Date" valeur={formatDateCourte(ligne.date_depense)} />
      <Vue label="Campagne" valeur={ligne.saison_uuid ? 'Active' : '—'} />
      <Vue label="Camion" valeur={ligne.camion_immat ?? '—'} />
      <Vue label="Chauffeur" valeur={ligne.chauffeur_nom || '—'} />
      {ligne.quantite != null ? <Vue label="Quantité" valeur={`${ligne.quantite}${ligne.unite ? ' ' + ligne.unite : ''}`} /> : null}
      {ligne.lieu ? <Vue label="Lieu" valeur={ligne.lieu} /> : null}
      {ligne.observations ? <Vue label="Observations" valeur={ligne.observations} /> : null}
      {ligne.photo ? <Vue label="Justificatif" valeur="Photo jointe" /> : null}

      {auditee ? (
        <View style={styles.bandeauVerrou}>
          <Text style={styles.bandeauTexte}>
            {ligne.statut === 'validee' ? 'Validée au bureau — lecture seule.' : `Rejetée au bureau${ligne.motif_rejet ? ' : ' + ligne.motif_rejet : ''}. Lecture seule.`}
          </Text>
        </View>
      ) : (
        <View style={styles.actions}>
          <Pressable style={styles.modifier} onPress={() => setEditer(true)}>
            <Text style={styles.modifierTexte}>Modifier</Text>
          </Pressable>
          {supprimable ? (
            <Pressable style={styles.supprimer} onPress={confirmerSuppression}>
              <Text style={styles.supprimerTexte}>Supprimer</Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </ScrollView>
  );
}

function Vue({ label, valeur }: { label: string; valeur: string }) {
  return (
    <View style={styles.vue}>
      <Text style={styles.vueLabel}>{label}</Text>
      <Text style={styles.vueValeur}>{valeur}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  contenu: { padding: 16, paddingBottom: 40 },
  central: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: couleurs.fond },
  texteCentral: { color: couleurs.texteDoux, fontSize: 15 },
  entete: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  categorie: { fontSize: 15, fontWeight: '700', color: couleurs.primaireFonce },
  montant: { fontSize: 34, fontWeight: '800', color: couleurs.texte },
  designation: { fontSize: 18, color: couleurs.texte, marginTop: 4, marginBottom: 20 },
  vue: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: couleurs.bordure },
  vueLabel: { fontSize: 15, color: couleurs.texteDoux },
  vueValeur: { fontSize: 15, color: couleurs.texte, fontWeight: '600', flexShrink: 1, marginLeft: 16, textAlign: 'right' },
  bandeauVerrou: { backgroundColor: couleurs.fond, borderRadius: 10, padding: 14, marginTop: 20 },
  bandeauTexte: { color: couleurs.texteDoux, fontSize: 14, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  modifier: { flex: 1, backgroundColor: couleurs.primaire, borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  modifierTexte: { color: '#fff', fontSize: 16, fontWeight: '700' },
  supprimer: { flex: 1, backgroundColor: couleurs.dangerFond, borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  supprimerTexte: { color: couleurs.danger, fontSize: 16, fontWeight: '700' },
});
