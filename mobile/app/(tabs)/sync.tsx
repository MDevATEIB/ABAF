import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSession } from '../../src/store/session.store';
import { useSync } from '../../src/store/sync.store';
import { synchroniser } from '../../src/sync/engine';
import { getMeta, META_CLES, getMetaNumber } from '../../src/db/client';
import { listerJournal, rouvrirLigne, type EntreeJournal } from '../../src/db/repos/referentiels';
import { compterEnAttente } from '../../src/db/repos/depenses';
import { compterPhotosEnAttente } from '../../src/sync/photos';
import { EmptyState } from '../../src/components/EmptyState';
import { PiedConnexion } from '../../src/components/PiedConnexion';
import { couleurs } from '../../src/theme';

const LIBELLES_PHASE: Record<string, string> = {
  push: 'Envoi des lignes…',
  photos: 'Envoi des photos…',
  pull: 'Réception du poste…',
  repos: 'Prêt',
  erreur: 'Échec',
};

export default function EcranSynchro() {
  const host = useSession((s) => s.host);
  const port = useSession((s) => s.port);
  const deviceUuid = useSession((s) => s.deviceUuid);
  const deconnecter = useSession((s) => s.deconnecter);
  const sync = useSync();

  const [curseur, setCurseur] = useState(0);
  const [derniere, setDerniere] = useState<string | null>(null);
  const [attente, setAttente] = useState(0);
  const [photos, setPhotos] = useState(0);
  const [journal, setJournal] = useState<EntreeJournal[]>([]);

  const toutCharger = useCallback(async () => {
    const [c, d, a, p, j] = await Promise.all([
      getMetaNumber(META_CLES.curseurPull, 0),
      getMeta(META_CLES.derniereSynchro),
      compterEnAttente(),
      compterPhotosEnAttente(),
      listerJournal(),
    ]);
    setCurseur(c);
    setDerniere(d);
    setAttente(a);
    setPhotos(p);
    setJournal(j);
  }, []);

  useEffect(() => {
    void toutCharger();
  }, [toutCharger, sync.enCours, sync.phase, sync.progression]);

  function lancer() {
    void synchroniser().then(() => void toutCharger());
  }

  function corriger(entree: EntreeJournal) {
    Alert.alert('Reprendre cette ligne ?', 'Elle repart en file et sera renvoyée à la prochaine synchronisation.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Reprendre',
        onPress: async () => {
          await rouvrirLigne(entree.uuid_ligne);
          await toutCharger();
        },
      },
    ]);
  }

  async function deconnexion() {
    Alert.alert('Oublier cet appareil ?', 'Le jeton sera effacé. Les dépenses non synchronisées restent sur le téléphone.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Oublier',
        style: 'destructive',
        onPress: async () => {
          await deconnecter();
          router.replace('/');
        },
      },
    ]);
  }

  return (
    <ScrollView contentContainerStyle={styles.contenu}>
      <View style={styles.carte}>
        <Text style={styles.titreCarte}>Poste de gestion</Text>
        <Text style={styles.valeur}>{host ? `http://${host}:${port}` : 'Non connecté'}</Text>
        <Text style={styles.sub}>{deviceUuid ? `Appareil ${deviceUuid.slice(0, 8)}…` : 'Aucun appairage'}</Text>
        <Pressable style={styles.lienDanger} onPress={deconnexion}>
          <Text style={styles.lienDangerTexte}>Oublier cet appareil</Text>
        </Pressable>
      </View>

      <View style={styles.carte}>
        <Text style={styles.titreCarte}>File locale</Text>
        <LigneStat label="Lignes à pousser" valeur={attente} />
        <LigneStat label="Photos en attente" valeur={photos} />
        <LigneStat label="Curseur de tirage" valeur={curseur} />
        <Text style={styles.sub}>Dernière synchro : {derniere ?? 'jamais'}</Text>
      </View>

      <Pressable style={[styles.bouton, sync.enCours && styles.boutonInactif]} onPress={lancer} disabled={sync.enCours || !host}>
        <Text style={styles.boutonTexte}>{sync.enCours ? LIBELLES_PHASE[sync.phase] ?? 'Synchro…' : 'Synchroniser maintenant'}</Text>
      </Pressable>
      {sync.enCours ? (
        <View style={styles.progressionPiste}>
          <View style={[styles.progressionBarre, { width: `${Math.round(sync.progression * 100)}%` }]} />
        </View>
      ) : null}
      {sync.dernierError ? <Text style={styles.erreur}>{sync.dernierError}</Text> : null}
      {sync.avertissementHorloge !== null ? (
        <Text style={styles.avertissement}>
          Écart d’horloge avec le poste : {sync.avertissementHorloge} min. Réglez l’heure du téléphone pour éviter les faux conflits.
        </Text>
      ) : null}

      <Text style={styles.sectionTitre}>Journal des rejets et conflits</Text>
      {journal.length === 0 ? (
        <EmptyState titre="Aucun conflit" texte="Les lignes refusées par le poste s’afficheront ici." />
      ) : (
        journal.map((entree) => (
          <View key={entree.id} style={styles.journalCarte}>
            <Text style={styles.journalTable}>{entree.table_x} · {entree.at}</Text>
            <Text style={styles.journalMotif}>{entree.motif}</Text>
            {!entree.resolved ? (
              <Pressable style={styles.journalBouton} onPress={() => corriger(entree)}>
                <Text style={styles.journalBoutonTexte}>Corriger et revérifier</Text>
              </Pressable>
            ) : (
              <Text style={styles.journalResolu}>Résolu</Text>
            )}
          </View>
        ))
      )}

      <PiedConnexion />
    </ScrollView>
  );
}

function LigneStat({ label, valeur }: { label: string; valeur: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValeur}>{valeur}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  contenu: { padding: 16, paddingBottom: 40 },
  carte: { backgroundColor: couleurs.carte, borderRadius: 12, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: couleurs.bordure },
  titreCarte: { fontSize: 16, fontWeight: '700', color: couleurs.texte, marginBottom: 10 },
  valeur: { fontSize: 16, color: couleurs.texte, fontWeight: '600' },
  sub: { fontSize: 13, color: couleurs.texteDoux, marginTop: 4 },
  lienDanger: { marginTop: 12 },
  lienDangerTexte: { color: couleurs.danger, fontWeight: '600', fontSize: 14 },
  stat: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  statLabel: { fontSize: 15, color: couleurs.texte },
  statValeur: { fontSize: 15, fontWeight: '800', color: couleurs.texte },
  bouton: { backgroundColor: couleurs.primaire, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginBottom: 8 },
  boutonTexte: { color: '#fff', fontSize: 17, fontWeight: '700' },
  boutonInactif: { opacity: 0.6 },
  progressionPiste: { height: 6, backgroundColor: couleurs.fond, borderRadius: 3, overflow: 'hidden', marginBottom: 8 },
  progressionBarre: { height: '100%', backgroundColor: couleurs.primaire },
  erreur: { color: couleurs.danger, fontSize: 14, marginBottom: 8 },
  avertissement: { color: couleurs.avertissement, fontSize: 13, marginBottom: 8 },
  sectionTitre: { fontSize: 16, fontWeight: '700', color: couleurs.texte, marginTop: 16, marginBottom: 8 },
  journalCarte: { backgroundColor: couleurs.carte, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: couleurs.bordure, borderLeftWidth: 4, borderLeftColor: couleurs.danger },
  journalTable: { fontSize: 12, color: couleurs.texteDoux, marginBottom: 4 },
  journalMotif: { fontSize: 15, color: couleurs.texte, marginBottom: 10 },
  journalBouton: { borderWidth: 1, borderColor: couleurs.primaire, borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  journalBoutonTexte: { color: couleurs.primaire, fontWeight: '700', fontSize: 14 },
  journalResolu: { color: couleurs.succes, fontSize: 14, fontWeight: '600' },
});
