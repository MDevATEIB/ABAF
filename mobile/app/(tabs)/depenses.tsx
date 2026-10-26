import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { listerDepenses, type DepenseLocale, type EtatSyncLocal, type FiltresLocaux } from '../../src/db/repos/depenses';
import { SyncBadge } from '../../src/components/SyncBadge';
import { EmptyState } from '../../src/components/EmptyState';
import { PiedConnexion } from '../../src/components/PiedConnexion';
import { formatFCFA, formatDateCourte, libelleCategorieDepenseLocal } from '../../src/utils/formatMobile';
import { couleurs } from '../../src/theme';

type FiltreEtat = EtatSyncLocal | 'tous';

const ONGLETS_ETAT: { cle: FiltreEtat; libelle: string }[] = [
  { cle: 'tous', libelle: 'Toutes' },
  { cle: 'pending', libelle: 'À pousser' },
  { cle: 'conflit', libelle: 'Conflits' },
  { cle: 'synced', libelle: 'Synchro' },
];

export default function EcranDepenses() {
  const [lignes, setLignes] = useState<DepenseLocale[]>([]);
  const [recherche, setRecherche] = useState('');
  const [etat, setEtat] = useState<FiltreEtat>('tous');
  const [categorie, setCategorie] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(false);

  const charger = useCallback(async () => {
    const filtres: FiltresLocaux = {
      recherche: recherche.trim() || undefined,
      etat: etat === 'tous' ? undefined : etat,
      categorie: categorie ?? undefined,
    };
    setLignes(await listerDepenses(filtres));
  }, [recherche, etat, categorie]);

  useFocusEffect(
    useCallback(() => {
      void charger();
    }, [charger]),
  );

  const total = useMemo(() => lignes.reduce((s, d) => s + d.montant, 0), [lignes]);

  return (
    <View style={styles.racine}>
      <View style={styles.filtres}>
        <TextInput
          style={styles.recherche}
          value={recherche}
          onChangeText={setRecherche}
          placeholder="Rechercher désignation, lieu, camion…"
          placeholderTextColor={couleurs.texteDoux}
        />
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={ONGLETS_ETAT}
          keyExtractor={(o) => o.cle}
          contentContainerStyle={styles.onglets}
          renderItem={({ item }) => (
            <Pressable style={[styles.onglet, etat === item.cle && styles.ongletActif]} onPress={() => setEtat(item.cle)}>
              <Text style={[styles.ongletTexte, etat === item.cle && styles.ongletTexteActif]}>{item.libelle}</Text>
            </Pressable>
          )}
        />
      </View>

      <FlatList
        contentContainerStyle={styles.contenu}
        data={lignes}
        keyExtractor={(d) => d.uuid}
        refreshControl={
          <RefreshControl
            refreshing={refresh}
            onRefresh={async () => {
              setRefresh(true);
              await charger();
              setRefresh(false);
            }}
          />
        }
        ListHeaderComponent={<Text style={styles.total}>{formatFCFA(total)} · {lignes.length} ligne{lignes.length > 1 ? 's' : ''}</Text>}
        renderItem={({ item }) => (
          <Pressable style={styles.carte} onPress={() => router.push(`/depense/${item.uuid}`)}>
            <View style={styles.ligneHaut}>
              <Text style={styles.categorie}>{libelleCategorieDepenseLocal(item.categorie)}</Text>
              <SyncBadge etat={item.sync_state} />
            </View>
            <Text style={styles.designation}>{item.designation}</Text>
            <View style={styles.ligneBas}>
              <Text style={styles.meta}>
                {formatDateCourte(item.date_depense)}
                {item.camion_immat ? ` · ${item.camion_immat}` : ''}
              </Text>
              <Text style={styles.montant}>{formatFCFA(item.montant)}</Text>
            </View>
            {item.statut === 'rejete' ? <Text style={styles.rejete}>Rejetée au bureau{item.motif_rejet ? ` : ${item.motif_rejet}` : ''}</Text> : null}
            {item.statut === 'validee' ? <Text style={styles.validee}>Validée au bureau</Text> : null}
          </Pressable>
        )}
        ListEmptyComponent={<EmptyState titre="Aucune dépense" texte="Ajustez la recherche ou saisissez une ligne via ＋." />}
      />
      <PiedConnexion />
    </View>
  );
}

const styles = StyleSheet.create({
  racine: { flex: 1, backgroundColor: couleurs.fond },
  filtres: { backgroundColor: couleurs.carte, borderBottomWidth: 1, borderBottomColor: couleurs.bordure, paddingVertical: 8 },
  recherche: { marginHorizontal: 12, borderWidth: 1, borderColor: couleurs.bordure, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: couleurs.texte, backgroundColor: couleurs.fond },
  onglets: { paddingHorizontal: 12, gap: 8, marginTop: 10 },
  onglet: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: couleurs.fond, borderWidth: 1, borderColor: couleurs.bordure },
  ongletActif: { backgroundColor: couleurs.primaire, borderColor: couleurs.primaire },
  ongletTexte: { color: couleurs.texte, fontSize: 14, fontWeight: '600' },
  ongletTexteActif: { color: '#fff' },
  contenu: { padding: 12, paddingBottom: 32 },
  total: { fontSize: 15, fontWeight: '700', color: couleurs.texte, marginBottom: 10 },
  carte: { backgroundColor: couleurs.carte, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: couleurs.bordure },
  ligneHaut: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  categorie: { fontSize: 13, fontWeight: '700', color: couleurs.primaireFonce },
  designation: { fontSize: 16, color: couleurs.texte, marginBottom: 8 },
  ligneBas: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  meta: { fontSize: 13, color: couleurs.texteDoux, flexShrink: 1 },
  montant: { fontSize: 16, fontWeight: '800', color: couleurs.texte },
  rejete: { marginTop: 8, fontSize: 13, color: couleurs.danger },
  validee: { marginTop: 8, fontSize: 13, color: couleurs.succes },
});
