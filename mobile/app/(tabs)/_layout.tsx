import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Tabs } from 'expo-router';
import { useSync } from '../../src/store/sync.store';
import { couleurs } from '../../src/theme';

function Glyphe({ symbole, actif, badge }: { symbole: string; actif: boolean; badge?: number }) {
  return (
    <View>
      <Text style={[styles.glyphe, actif ? styles.glypheActif : null]}>{symbole}</Text>
      {badge && badge > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeTexte}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default function LayoutOnglets() {
  const enAttente = useSync((s) => s.enAttente);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: couleurs.primaire,
        tabBarInactiveTintColor: couleurs.texteDoux,
        tabBarStyle: { backgroundColor: couleurs.carte, borderTopColor: couleurs.bordure },
        headerStyle: { backgroundColor: couleurs.primaireFonce },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Aujourd’hui',
          tabBarIcon: ({ focused }) => <Glyphe symbole="🏠" actif={focused} />,
        }}
      />
      <Tabs.Screen
        name="depenses"
        options={{
          title: 'Dépenses',
          tabBarIcon: ({ focused }) => <Glyphe symbole="≡" actif={focused} />,
        }}
      />
      <Tabs.Screen
        name="nouvelle"
        options={{
          title: 'Ajouter',
          tabBarIcon: ({ focused }) => <Glyphe symbole="＋" actif={focused} />,
        }}
      />
      <Tabs.Screen
        name="sync"
        options={{
          title: 'Synchro',
          tabBarIcon: ({ focused }) => <Glyphe symbole="⇄" actif={focused} badge={enAttente} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  glyphe: { fontSize: 20, color: couleurs.texteDoux },
  glypheActif: { color: couleurs.primaire },
  badge: { position: 'absolute', top: -4, right: -8, backgroundColor: couleurs.danger, borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeTexte: { color: '#fff', fontSize: 10, fontWeight: '800' },
});
