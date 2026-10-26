import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Redirect } from 'expo-router';
import { useSession, sessionComplete } from '../src/store/session.store';
import { useCatalogue } from '../src/store/catalogue.store';
import { decouvrirPoste, PORT_DEFAUT, sonnerAdresse, type PosteTrouve } from '../src/sync/discover';
import { appairer } from '../src/sync/pair';
import { messageErreur } from '../src/sync/client';
import { Field } from '../src/components/Field';
import { couleurs } from '../src/theme';

type Etape = 'connexion' | 'appairage';

export default function EcranConnexion() {
  const session = useSession();
  const chargerCatalogue = useCatalogue((s) => s.charger);

  const [etape, setEtape] = useState<Etape>('connexion');
  const [poste, setPoste] = useState<PosteTrouve | null>(null);
  const [scan, setScan] = useState(false);
  const [manuel, setManuel] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);

  // Champs d'appairage.
  const [code, setCode] = useState('');
  const [nomAppareil, setNomAppareil] = useState('');
  const [agent, setAgent] = useState('');
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    if (!session.charge) return;
    if (sessionComplete(session)) return;
    // Première venue : on tente une découverte automatique des passerelles.
    void lancerScan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.charge]);

  const lancerScan = useCallback(async () => {
    setScan(true);
    setErreur(null);
    const trouve = await decouvrirPoste();
    setScan(false);
    if (trouve) {
      setPoste(trouve);
      setEtape('appairage');
    } else {
      setErreur('Aucun poste ABAF détecté sur le réseau. Vérifiez le serveur dans Paramètres, ou saisissez l’adresse.');
    }
  }, []);

  async function connecterManuel() {
    const brut = manuel.trim();
    if (!brut) return;
    const [h, p] = brut.includes(':') ? brut.split(':') : [brut, String(PORT_DEFAUT)];
    setScan(true);
    setErreur(null);
    const trouve = await sonnerAdresse(h.trim(), Number(p) || PORT_DEFAUT);
    setScan(false);
    if (trouve) {
      setPoste(trouve);
      setEtape('appairage');
    } else {
      setErreur('Aucun poste ABAF ne répond à cette adresse.');
    }
  }

  async function validerAppairage() {
    if (!poste || code.trim().length !== 6 || !nomAppareil.trim()) return;
    setEnCours(true);
    setErreur(null);
    try {
      await appairer(poste.host, poste.port, code.trim(), nomAppareil.trim(), agent.trim());
      await chargerCatalogue();
      setEnCours(false);
      // La session complète déclenche le Redirect.
    } catch (e) {
      setEnCours(false);
      setErreur(messageErreur(e));
    }
  }

  if (session.charge && sessionComplete(session)) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.racine}>
      <ScrollView contentContainerStyle={styles.contenu} keyboardShouldPersistTaps="handled">
        <Text style={styles.titre}>ABAF Terrain</Text>
        <Text style={styles.sousTitre}>
          Saisie des dépenses de terrain, même hors connexion. Rejoignez le poste de gestion pour vous appairer.
        </Text>

        {etape === 'connexion' ? (
          <View style={styles.carte}>
            <Text style={styles.labelSection}>1 · Trouver le poste</Text>
            <Pressable style={styles.boutonPrimaire} onPress={() => void lancerScan()} disabled={scan}>
              {scan ? <ActivityIndicator color="#fff" /> : <Text style={styles.boutonPrimaireTexte}>Rechercher le poste</Text>}
            </Pressable>

            <Text style={styles.astuce}>
              Activez le partage de connexion ou le Wi-Fi commun, et démarrez le serveur dans
              Paramètres › Synchronisation mobile du poste.
            </Text>

            <View style={styles.sep}>
              <Text style={styles.sepTexte}>ou saisir l’adresse</Text>
            </View>
            <Field
              label="Adresse du poste (IP ou IP:port)"
              value={manuel}
              onChangeText={setManuel}
              placeholder="192.168.43.1:9470"
              keyboardType="numbers-and-punctuation"
            />
            <Pressable style={styles.boutonSecondaire} onPress={() => void connecterManuel()} disabled={scan || !manuel.trim()}>
              <Text style={styles.boutonSecondaireTexte}>Connecter</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.carte}>
            <View style={styles.bandePoste}>
              <View style={styles.puceActive} />
              <Text style={styles.posteInfo}>Poste joint · {poste?.host}:{poste?.port}</Text>
            </View>
            <Text style={styles.labelSection}>2 · Appairage</Text>
            <Text style={styles.astuce}>Saisissez le code à 6 chiffres affiché sur le poste (valable 10 minutes).</Text>
            <Field label="Code d’appairage" value={code} onChangeText={(t) => setCode(t.replace(/[^0-9]/g, '').slice(0, 6))} placeholder="000000" keyboardType="number-pad" />
            <Field label="Nom de l’appareil" value={nomAppareil} onChangeText={setNomAppareil} placeholder="Téléphone de Moussa" />
            <Field label="Agent (porteur)" value={agent} onChangeText={setAgent} placeholder="Chauffeur / chef de parc…" />
            <Pressable
              style={[styles.boutonPrimaire, (!code || code.length !== 6 || !nomAppareil.trim()) && styles.boutonInactif]}
              onPress={() => void validerAppairage()}
              disabled={enCours || code.length !== 6 || !nomAppareil.trim()}
            >
              {enCours ? <ActivityIndicator color="#fff" /> : <Text style={styles.boutonPrimaireTexte}>S’appairer</Text>}
            </Pressable>
            <Pressable style={styles.lien} onPress={() => setEtape('connexion')}>
              <Text style={styles.lienTexte}>← Changer de poste</Text>
            </Pressable>
          </View>
        )}

        {erreur ? <Text style={styles.erreur}>{erreur}</Text> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  racine: { flex: 1, backgroundColor: couleurs.fond },
  contenu: { padding: 20, paddingBottom: 48 },
  titre: { fontSize: 30, fontWeight: '800', color: couleurs.primaireFonce, marginTop: 40 },
  sousTitre: { fontSize: 15, color: couleurs.texteDoux, marginTop: 8, marginBottom: 20, lineHeight: 21 },
  carte: { backgroundColor: couleurs.carte, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: couleurs.bordure },
  labelSection: { fontSize: 16, fontWeight: '700', color: couleurs.texte, marginBottom: 10 },
  astuce: { fontSize: 14, color: couleurs.texteDoux, lineHeight: 20, marginVertical: 10 },
  boutonPrimaire: { backgroundColor: couleurs.primaire, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 6 },
  boutonPrimaireTexte: { color: '#fff', fontSize: 17, fontWeight: '700' },
  boutonSecondaire: { borderWidth: 1, borderColor: couleurs.primaire, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 6 },
  boutonSecondaireTexte: { color: couleurs.primaire, fontSize: 16, fontWeight: '700' },
  boutonInactif: { opacity: 0.5 },
  sep: { alignItems: 'center', marginVertical: 16 },
  sepTexte: { color: couleurs.texteDoux, fontSize: 13 },
  bandePoste: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  puceActive: { width: 10, height: 10, borderRadius: 5, backgroundColor: couleurs.primaire, marginRight: 8 },
  posteInfo: { fontSize: 14, fontWeight: '600', color: couleurs.texte },
  lien: { marginTop: 14, alignItems: 'center' },
  lienTexte: { color: couleurs.primaire, fontSize: 15, fontWeight: '600' },
  erreur: { color: couleurs.danger, fontSize: 14, marginTop: 16, textAlign: 'center' },
});
