import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { depensesDuJour } from '../../src/db/repos/depenses';
import { compterEnAttente } from '../../src/db/repos/depenses';
import { useSession } from '../../src/store/session.store';
import { PiedConnexion } from '../../src/components/PiedConnexion';
import { EmptyState } from '../../src/components/EmptyState';
import { todayDate, formatFCFA, libelleCategorieDepenseLocal } from '../../src/utils/formatMobile';
import { couleurs } from '../../src/theme';

interface Resume {
  total: number;
  nb: number;
  parCategorie: { categorie: string; montant: number; nb: number }[];
}

export default function EcranAujourdhui() {
  const saisonLibelle = useSession((s) => s.saisonActiveLibelle);
  const [resume, setResume] = useState<Resume>({ total: 0, nb: 0, parCategorie: [] });
  const [attente, setAttente] = useState(0);
  const [refresh, setRefresh] = useState(false);

  const charger = useCallback(async () => {
    const [jour, att] = await Promise.all([depensesDuJour(todayDate()), compterEnAttente()]);
    setResume(jour);
    setAttente(att);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void charger();
    }, [charger]),
  );

  async function onRefresh() {
    setRefresh(true);
    await charger();
    setRefresh(false);
  }

  return (
    <View style={styles.racine}>
      <FlatList
        contentContainerStyle={styles.contenu}
        data={resume.parCategorie}
        keyExtractor={(i) => i.categorie}
        refreshControl={<RefreshControl refreshing={refresh} onRefresh={() => void onRefresh()} />}
        ListHeaderComponent={
          <View>
            <Text style={styles.campagne}>{saisonLibelle ? `Campagne ${saisonLibelle}` : 'Aucune campagne'}</Text>
            <View style={styles.totalCarte}>
              <Text style={styles.totalLabel}>Total du jour</Text>
              <Text style={styles.totalValeur}>{formatFCFA(resume.total)}</Text>
              <Text style={styles.totalNb}>{resume.nb} ligne{resume.nb > 1 ? 's' : ''}</Text>
            </View>

            {attente > 0 ? (
              <Pressable style={styles.file} onPress={() => router.push('/(tabs)/sync')}>
                <Text style={styles.fileTexte}>{attente} ligne{attente > 1 ? 's' : ''} en attente de synchronisation →</Text>
              </Pressable>
            ) : null}

            <View style={styles.raccourcis}>
              <Pressable style={styles.raccourci} onPress={() => router.push('/(tabs)/nouvelle')}>
                <Text style={styles.raccourciTexte}>＋ Nouvelle dépense</Text>
              </Pressable>
              <Pressable style={[styles.raccourci, styles.raccourciSecondaire]} onPress={() => router.push('/referentiels/intervenants')}>
                <Text style={[styles.raccourciTexte, styles.raccourciTexteSecondaire]}>Intervenants</Text>
              </Pressable>
              <Pressable style={[styles.raccourci, styles.raccourciSecondaire]} onPress={() => router.push('/referentiels/pieces')}>
                <Text style={[styles.raccourciTexte, styles.raccourciTexteSecondaire]}>Pièces</Text>
              </Pressable>
            </View>

            <Text style={styles.sectionTitre}>Répartition par catégorie</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.ligne}>
            <Text style={styles.ligneLabel}>{libelleCategorieDepenseLocal(item.categorie)}</Text>
            <Text style={styles.ligneNb}>{item.nb}</Text>
            <Text style={styles.ligneMontant}>{formatFCFA(item.montant)}</Text>
          </View>
        )}
        ListEmptyComponent={<EmptyState titre="Aucune dépense aujourd’hui" texte="Touchez ＋ pour saisir une première charge." />}
      />
      <PiedConnexion />
    </View>
  );
}

const styles = StyleSheet.create({
  racine: { flex: 1, backgroundColor: couleurs.fond },
  contenu: { padding: 16, paddingBottom: 32 },
  campagne: { fontSize: 15, color: couleurs.texteDoux, marginBottom: 10, fontWeight: '600' },
  totalCarte: { backgroundColor: couleurs.primaireFonce, borderRadius: 16, padding: 20, alignItems: 'center' },
  totalLabel: { color: '#c7f9cc', fontSize: 14 },
  totalValeur: { color: '#fff', fontSize: 32, fontWeight: '800', marginVertical: 4 },
  totalNb: { color: '#c7f9cc', fontSize: 13 },
  file: { backgroundColor: couleurs.avertissementFond, borderRadius: 10, padding: 14, marginTop: 12 },
  fileTexte: { color: couleurs.avertissement, fontWeight: '700', fontSize: 14 },
  raccourcis: { flexDirection: 'row', gap: 10, marginTop: 16 },
  raccourci: { flex: 1, backgroundColor: couleurs.primaire, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  raccourciSecondaire: { backgroundColor: couleurs.carte, borderWidth: 1, borderColor: couleurs.bordure },
  raccourciTexte: { color: '#fff', fontWeight: '700', fontSize: 15 },
  raccourciTexteSecondaire: { color: couleurs.primaire },
  sectionTitre: { fontSize: 16, fontWeight: '700', color: couleurs.texte, marginTop: 24, marginBottom: 8 },
  ligne: { flexDirection: 'row', alignItems: 'center', backgroundColor: couleurs.carte, borderRadius: 10, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: couleurs.bordure },
  ligneLabel: { flex: 1, fontSize: 16, color: couleurs.texte },
  ligneNb: { fontSize: 14, color: couleurs.texteDoux, marginRight: 12 },
  ligneMontant: { fontSize: 16, fontWeight: '700', color: couleurs.texte },
});
