import React, { useCallback, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { listerIntervenants, creerIntervenant, type IntervenantLocal } from '../../src/db/repos/referentiels';
import { Field } from '../../src/components/Field';
import { SyncBadge } from '../../src/components/SyncBadge';
import { EmptyState } from '../../src/components/EmptyState';
import { LIBELLES_ROLE_INTERVENANT, ROLES_INTERVENANT } from '../../src/types/api';
import { couleurs } from '../../src/theme';
import type { EtatSyncLocal } from '../../src/db/repos/depenses';

export default function EcranIntervenants() {
  const [lignes, setLignes] = useState<IntervenantLocal[]>([]);
  const [ajouter, setAjouter] = useState(false);
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [role, setRole] = useState<string>('mecanicien');

  const charger = useCallback(async () => setLignes(await listerIntervenants()), []);
  useFocusEffect(useCallback(() => void charger(), [charger]));

  async function creer() {
    if (!nom.trim()) return;
    await creerIntervenant({ nom, prenom, telephone, role });
    setNom(''); setPrenom(''); setTelephone(''); setAjouter(false);
    await charger();
  }

  return (
    <View style={styles.racine}>
      <FlatList
        contentContainerStyle={styles.contenu}
        data={lignes}
        keyExtractor={(i) => i.uuid}
        renderItem={({ item }) => (
          <View style={styles.carte}>
            <View style={styles.ligneHaut}>
              <Text style={styles.nom}>{item.nom}{item.prenom ? ` ${item.prenom}` : ''}</Text>
              <SyncBadge etat={item.sync_state as EtatSyncLocal} />
            </View>
            <Text style={styles.meta}>{LIBELLES_ROLE_INTERVENANT[item.role] ?? item.role}{item.telephone ? ` · ${item.telephone}` : ''}</Text>
          </View>
        )}
        ListEmptyComponent={<EmptyState titre="Aucun intervenant" texte="Ajoutez mécaniciens, chefs de parc et apprentis." />}
      />
      <Pressable style={styles.fab} onPress={() => setAjouter(true)}>
        <Text style={styles.fabTexte}>＋ Intervenant</Text>
      </Pressable>

      <Modal visible={ajouter} animationType="slide" transparent onRequestClose={() => setAjouter(false)}>
        <View style={styles.voile}>
          <View style={styles.feuille}>
            <Text style={styles.feuilleTitre}>Nouvel intervenant</Text>
            <View style={styles.roles}>
              {ROLES_INTERVENANT.map((r) => (
                <Pressable key={r} style={[styles.puceRole, role === r && styles.puceRoleActif]} onPress={() => setRole(r)}>
                  <Text style={[styles.puceRoleTexte, role === r && styles.puceRoleTexteActif]}>{LIBELLES_ROLE_INTERVENANT[r]}</Text>
                </Pressable>
              ))}
            </View>
            <Field label="Nom *" value={nom} onChangeText={setNom} autoFocus />
            <Field label="Prénom" value={prenom} onChangeText={setPrenom} />
            <Field label="Téléphone" value={telephone} onChangeText={setTelephone} keyboardType="phone-pad" />
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
  contenu: { padding: 16, paddingBottom: 90 },
  carte: { backgroundColor: couleurs.carte, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: couleurs.bordure },
  ligneHaut: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nom: { fontSize: 17, fontWeight: '700', color: couleurs.texte, flex: 1 },
  meta: { fontSize: 14, color: couleurs.texteDoux, marginTop: 4 },
  fab: { position: 'absolute', bottom: 20, left: 16, right: 16, backgroundColor: couleurs.primaire, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  fabTexte: { color: '#fff', fontSize: 17, fontWeight: '700' },
  voile: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  feuille: { backgroundColor: couleurs.carte, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, paddingBottom: 34 },
  feuilleTitre: { fontSize: 20, fontWeight: '800', color: couleurs.texte, marginBottom: 14 },
  roles: { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  puceRole: { borderWidth: 1, borderColor: couleurs.bordure, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  puceRoleActif: { backgroundColor: couleurs.primaire, borderColor: couleurs.primaire },
  puceRoleTexte: { color: couleurs.texte, fontSize: 14 },
  puceRoleTexteActif: { color: '#fff', fontWeight: '700' },
  boutonValider: { backgroundColor: couleurs.primaire, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  boutonValiderTexte: { color: '#fff', fontSize: 17, fontWeight: '700' },
  boutonAnnuler: { paddingVertical: 14, alignItems: 'center' },
  boutonAnnulerTexte: { color: couleurs.texteDoux, fontSize: 15 },
});
