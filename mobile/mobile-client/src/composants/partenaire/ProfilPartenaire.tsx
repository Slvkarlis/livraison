import Ionicons from '@expo/vector-icons/Ionicons';
import { Bouton, Carte, Ligne, MessageErreur, api, useAuth, type Commerce } from '@fleetpulse/shared';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../../theme';

// Commerce du partenaire : informations, ouverture / fermeture (US-203), deconnexion
export default function ProfilPartenaire() {
  const { profil, logout } = useAuth();
  const [commerce, setCommerce] = useState<Commerce | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState('');
  const [envoi, setEnvoi] = useState(false);

  const charger = useCallback(async () => {
    try {
      setCommerce(await api.commerce());
      setErreur(null);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Chargement impossible.');
    }
  }, []);

  useFocusEffect(useCallback(() => { void charger(); }, [charger]));

  async function basculerOuverture() {
    if (!commerce) return;
    setEnvoi(true);
    setErreur(null);
    setSucces('');
    try {
      const maj = await api.ouverture(!commerce.ouvert);
      setCommerce(maj);
      setSucces(maj.ouvert ? 'Commerce ouvert : vous recevez des commandes.' : 'Commerce fermé : plus de nouvelles commandes.');
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Modification impossible.');
    } finally {
      setEnvoi(false);
    }
  }

  if (!profil) return null;
  return (
    <SafeAreaView style={styles.page} edges={['top']}>
      <ScrollView contentContainerStyle={styles.contenu}>
        <View style={styles.entete}>
          <View style={styles.avatar}>
            <Ionicons name="storefront" size={34} color={theme.accent} />
          </View>
          <Text style={styles.nom}>{commerce?.nomCommerce ?? 'Mon commerce'}</Text>
          <Text style={styles.email}>{profil.prenom} {profil.nom} · {profil.email}</Text>
        </View>

        <MessageErreur message={erreur} />
        {succes ? <Text accessibilityLiveRegion="polite" style={styles.succes}>{succes}</Text> : null}

        {commerce ? (
          <>
            <Carte>
              <Ligne libelle="Catégorie" valeur={commerce.categorie} />
              <Ligne libelle="Adresse" valeur={commerce.adresse} />
              <Ligne libelle="Zone" valeur={commerce.zoneNom ?? 'Aucune : contactez le responsable'} />
              <Ligne libelle="État" valeur={commerce.ouvert ? 'Ouvert' : 'Fermé'} fort />
            </Carte>
            <Bouton
              titre={commerce.ouvert ? 'Fermer le commerce' : 'Ouvrir le commerce'}
              variante={commerce.ouvert ? 'secondaire' : 'primaire'}
              chargement={envoi}
              desactive={!commerce.zoneId && !commerce.ouvert}
              onPress={() => void basculerOuverture()}
              style={styles.bloc}
            />
          </>
        ) : null}

        <Bouton
          titre="Se déconnecter"
          variante="danger"
          onPress={() => void logout()}
          icone={<Ionicons name="log-out-outline" size={20} color={theme.erreur} />}
          style={styles.bloc}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.fond },
  contenu: { padding: 20 },
  entete: { alignItems: 'center', paddingVertical: 24 },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: theme.accentDoux,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  nom: { fontSize: 22, fontWeight: '700', color: theme.texte, textAlign: 'center' },
  email: { fontSize: 14, color: theme.secondaire, marginTop: 4, textAlign: 'center' },
  succes: { color: theme.succes, marginBottom: 12 },
  bloc: { marginTop: 16 },
});
