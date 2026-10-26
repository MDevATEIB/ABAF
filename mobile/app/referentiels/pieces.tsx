import React, { useCallback, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { listerPieces, creerPiece, type PieceLocale } from '../../src/db/repos/referentiels';
import { Field } from '../../src/components/Field';
import { SyncBadge } from '../../src/components/SyncBadge';
import { EmptyState } from '../../src/components/EmptyState';
import { couleurs } from '../../src/theme';
import type { EtatSyncLocal } from '../../src/db/repos/depenses';

export default function EcranPieces() {
  const [lignes, setLignes] = useState<PieceLocale[]>([]);
  const [recherche, setRecherche] = useState('');
  const [ajouter, setAjouter] = useState(false);
  const [nom, setNom] = useState('');
  const [categorie, setCategorie] = useState('');
  const [unite, setUnite] = useState('u');

  const charger = useCallback(async () => setLignes(await listerPieces(recherche.trim() || undefined)), [recherche]);
  useFocusEffect(useCallback(() => void charger(), [charger]));

  async function creer() {
    if (!nom.trim()) return;
    await creerPiece({ nom, categorie, unite });
    setNom(''); setCategorie(''); setUnite('u'); setAjouter(false);
    await charger();
  }

  return (
    <View style={styles.racine}>
      <TextInput
        style={styles.recherche}
        value={recherche}
        onChangeText={setRecherche}
        placeholder="Rechercher une pièce…"
        placeholderTextColor={couleurs.texteDoux}
      />
      <FlatList
        contentContainerStyle={styles.contenu}
        data={lignes}
        keyExtractor={(p) => p.uuid}
        renderItem={({ item }) => (
          <View style={styles.carte}>
            <View style={styles.ligneHaut}>
              <Text style={styles.nom}>{item.nom}</Text>
              <SyncBadge etat={item.sync_state as EtatSyncLocal} />
            </View>
            <Text style={styles.meta}>
              {item.categorie ? `${item.categorie} · ` : ''}unité {item.unite}
            </Text>
          </View>
        )}
        ListEmptyComponent={<EmptyState titre="Aucune pièce" texte="Le catalogue s’enrichit au fil des synchronisations." />}
      />
      <Pressable style={styles.fab} onPress={() => setAjouter(true)}>
        <Text style={styles.fabTexte}>＋ Pièce</Text>
      </Pressable>

      <Modal visible={ajouter} animationType="slide" transparent onRequestClose={() => setAjouter(false)}>
        <View style={styles.voile}>
          <View style={styles.feuille}>
            <Text style={styles.feuilleTitre}>Nouvelle pièce</Text>
            <Field label="Nom *" value={nom} onChangeText={setNom} autoFocus />
            <Field label="Catégorie" value={categorie} onChangeText={setCategorie} placeholder="Freinage, moteur…" />
            <Field label="Unité" value={unite} onChangeText={setUnite} placeholder="u" />
            <Pressable style={styles.boutonValider} disabled={!nom.trim()} onPress={() => void creer()}>
              <Text style={styles.boutonValiderTexte}>Enregistrer</Text>
            </Pressable>
            <Pressable style={styles.boutonAnnuler} onPress={() => setAjouter(false)}>
              <Text style={styles.boutonAnnulerTexte}>Annuler</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  racine: { flex: 1, backgroundColor: couleurs.fond },
  recherche: { margin: 16, marginBottom: 8, borderWidth: 1, borderColor: couleurs.bordure, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: couleurs.texte, backgroundColor: couleurs.carte },
  contenu: { padding: 16, paddingTop: 8, paddingBottom: 90 },
  carte: { backgroundColor: couleurs.carte, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: couleurs.bordure },
  ligneHaut: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nom: { fontSize: 17, fontWeight: '700', color: couleurs.texte, flex: 1 },
  meta: { fontSize: 14, color: couleurs.texteDoux, marginTop: 4 },
  fab: { position: 'absolute', bottom: 20, left: 16, right: 16, backgroundColor: couleurs.primaire, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  fabTexte: { color: '#fff', fontSize: 17, fontWeight: '700' },
  voile: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  feuille: { backgroundColor: couleurs.carte, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, paddingBottom: 34 },
  feuilleTitre: { fontSize: 20, fontWeight: '800', color: couleurs.texte, marginBottom: 14 },
  boutonValider: { backgroundColor: couleurs.primaire, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  boutonValiderTexte: { color: '#fff', fontSize: 17, fontWeight: '700' },
  boutonAnnuler: { paddingVertical: 14, alignItems: 'center' },
  boutonAnnulerTexte: { color: couleurs.texteDoux, fontSize: 15 },
});
