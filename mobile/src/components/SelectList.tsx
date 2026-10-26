import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { couleurs } from '../theme';

export interface Option<T extends string> {
  value: T;
  label: string;
  sousTexte?: string;
}

interface Props<T extends string> {
  label: string;
  options: Option<T>[];
  value: T | null;
  onChange: (valeur: T | null) => void;
  placeholder?: string;
  recherche?: boolean;
  videAutorise?: boolean;
}

/** Sélecteur modal adossé au catalogue SQLite local (fonctionne hors ligne). */
export function SelectList<T extends string>({
  label,
  options,
  value,
  onChange,
  placeholder = 'Choisir…',
  recherche = true,
  videAutorise = true,
}: Props<T>) {
  const [ouvert, setOuvert] = useState(false);
  const [texte, setTexte] = useState('');

  const choix = useMemo(() => options.find((o) => o.value === value) ?? null, [options, value]);
  const filtrees = useMemo(() => {
    if (!texte.trim()) return options;
    const mot = texte.trim().toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(mot) || (o.sousTexte ?? '').toLowerCase().includes(mot));
  }, [options, texte]);

  const fermer = () => {
    setOuvert(false);
    setTexte('');
  };

  return (
    <View style={styles.conteneur}>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.declencheur} onPress={() => setOuvert(true)}>
        <Text style={choix ? styles.valeur : styles.discret}>{choix?.label ?? placeholder}</Text>
        <Text style={styles.chevron}>▾</Text>
      </Pressable>

      <Modal visible={ouvert} animationType="slide" onRequestClose={fermer} transparent>
        <Pressable style={styles.voile} onPress={fermer}>
          <View style={styles.feuille} onStartShouldSetResponder={() => true}>
            <Text style={styles.titreFeuille}>{label}</Text>
            {recherche ? (
              <TextInput
                style={styles.recherche}
                value={texte}
                onChangeText={setTexte}
                placeholder="Rechercher…"
                placeholderTextColor={couleurs.texteDoux}
                autoFocus
              />
            ) : null}
            <FlatList
              data={filtrees}
              keyExtractor={(o) => o.value}
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.ligne, item.value === value && styles.ligneActive]}
                  onPress={() => {
                    onChange(item.value);
                    fermer();
                  }}
                >
                  <View style={styles.flex}>
                    <Text style={styles.ligneLabel}>{item.label}</Text>
                    {item.sousTexte ? <Text style={styles.ligneSous}>{item.sousTexte}</Text> : null}
                  </View>
                  {item.value === value ? <Text style={styles.coche}>✓</Text> : null}
                </Pressable>
              )}
              ListEmptyComponent={<Text style={styles.vide}>Aucune correspondance</Text>}
            />
            {videAutorise ? (
              <Pressable
                style={styles.effacer}
                onPress={() => {
                  onChange(null);
                  fermer();
                }}
              >
                <Text style={styles.effacerTexte}>Effacer le choix</Text>
              </Pressable>
            ) : null}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  conteneur: { marginBottom: 14 },
  label: { fontSize: 14, fontWeight: '600', color: couleurs.texte, marginBottom: 6 },
  declencheur: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: couleurs.bordure,
    borderRadius: 10,
    backgroundColor: couleurs.carte,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  valeur: { flex: 1, fontSize: 17, color: couleurs.texte },
  discret: { flex: 1, fontSize: 17, color: couleurs.texteDoux },
  chevron: { color: couleurs.texteDoux, fontSize: 16 },
  voile: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  feuille: { backgroundColor: couleurs.carte, borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '80%', padding: 16, paddingBottom: 30 },
  titreFeuille: { fontSize: 18, fontWeight: '700', color: couleurs.texte, marginBottom: 10 },
  recherche: { borderWidth: 1, borderColor: couleurs.bordure, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, marginBottom: 8, color: couleurs.texte },
  ligne: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: couleurs.fond },
  ligneActive: { backgroundColor: couleurs.succesFond },
  flex: { flex: 1 },
  ligneLabel: { fontSize: 17, color: couleurs.texte },
  ligneSous: { fontSize: 13, color: couleurs.texteDoux, marginTop: 2 },
  coche: { color: couleurs.primaire, fontSize: 18, fontWeight: '700' },
  vide: { textAlign: 'center', color: couleurs.texteDoux, paddingVertical: 24 },
  effacer: { alignItems: 'center', paddingVertical: 14, marginTop: 6 },
  effacerTexte: { color: couleurs.danger, fontSize: 16, fontWeight: '600' },
});
