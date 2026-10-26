import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { getDb } from '../src/db/client';
import { useSession } from '../src/store/session.store';
import { useCatalogue } from '../src/store/catalogue.store';
import { demarrerPlanificateur } from '../src/sync/engine';
import { couleurs } from '../src/theme';

/**
 * Racine : ouvre et migre SQLite, restaure la session (jeton depuis le
 * trousseau), charge le catalogue local, puis branche le planificateur de
 * synchro (à froid, au retour au premier plan, au recouvrement réseau).
 * Rien d'écran n'apparaît tant que la base n'est pas prête.
 */
export default function LayoutRacine() {
  const [pret, setPret] = useState(false);
  const [echec, setEchec] = useState<string | null>(null);
  const restaurer = useSession((s) => s.restaurer);
  const chargerCatalogue = useCatalogue((s) => s.charger);

  useEffect(() => {
    let annule = false;
    let arreterPlanificateur: (() => void) | null = null;

    (async () => {
      try {
        await getDb();
        await restaurer();
        await chargerCatalogue();
        if (!annule) {
          setPret(true);
          arreterPlanificateur = demarrerPlanificateur();
        }
      } catch (e) {
        if (!annule) setEchec(e instanceof Error ? e.message : String(e));
      }
    })();

    return () => {
      annule = true;
      arreterPlanificateur?.();
    };
  }, [restaurer, chargerCatalogue]);

  if (echec) {
    return (
      <View style={styles.central}>
        <Text style={styles.titreEchec}>Base inaccessible</Text>
        <Text style={styles.texteEchec}>{echec}</Text>
      </View>
    );
  }

  if (!pret) {
    return (
      <View style={styles.central}>
        <ActivityIndicator size="large" color={couleurs.primaire} />
        <Text style={styles.texteChargement}>Ouverture de la base terrain…</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerBackTitle: 'Retour' }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="depense/nouvelle" options={{ title: 'Nouvelle dépense' }} />
        <Stack.Screen name="depense/[uuid]" options={{ title: 'Dépense' }} />
        <Stack.Screen name="referentiels/intervenants" options={{ title: 'Intervenants' }} />
        <Stack.Screen name="referentiels/pieces" options={{ title: 'Pièces de rechange' }} />
      </Stack>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  central: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: couleurs.fond, padding: 24 },
  texteChargement: { marginTop: 12, fontSize: 15, color: couleurs.texteDoux },
  titreEchec: { fontSize: 18, fontWeight: '700', color: couleurs.danger, marginBottom: 8 },
  texteEchec: { fontSize: 14, color: couleurs.texte, textAlign: 'center' },
});
