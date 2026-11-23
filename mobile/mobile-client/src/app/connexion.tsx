import Ionicons from '@expo/vector-icons/Ionicons';
import { Bouton, Champ, EntreeAnimee, FriseTrajet, MessageErreur, Ville3D, useConnexion } from '@fleetpulse/shared';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../theme';

// US-01
export default function Connexion() {
  const insets = useSafeAreaInsets();
  const { email, setEmail, motDePasse, setMotDePasse, erreur, envoi, seConnecter } = useConnexion();

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.defilement} keyboardShouldPersistTaps="handled" bounces={false}>
        <View style={[styles.hero, { paddingTop: insets.top + 28 }]}>
          <Ville3D ton="nuit" progression={0.6} style={styles.ville} />
          <View style={styles.voile} pointerEvents="none" />
          <EntreeAnimee rang={0}>
            <View style={styles.logo}>
              <Ionicons name="cube" size={24} color="#15171A" />
            </View>
            <Text style={styles.marque}>FleetPulse</Text>
            <Text style={styles.slogan}>Vos livraisons, au bon moment.</Text>
          </EntreeAnimee>
          <EntreeAnimee rang={1} style={styles.frise}>
            <FriseTrajet depart="12:10" arrivee="12:34" duree="24 min" de="Votre commerce" vers="Chez vous" distance="3,1 km" progression={0.62}
              icone={<Ionicons name="bicycle" size={16} color="#15171A" />} />
          </EntreeAnimee>
        </View>

        <View style={styles.formulaire}>
          <View style={styles.encoche}><View style={styles.poignee} /></View>
          <Text style={styles.titre}>Bon retour</Text>
          <Text style={styles.sousTitre}>Connectez-vous pour commander et suivre vos livraisons.</Text>
          <MessageErreur message={erreur} />
          <Champ
            libelle="Email ou téléphone"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder="vous@exemple.tn"
          />
          <Champ
            libelle="Mot de passe"
            value={motDePasse}
            onChangeText={setMotDePasse}
            secureTextEntry
            autoComplete="password"
            onSubmitEditing={seConnecter}
          />
          <Bouton titre="Se connecter" onPress={seConnecter} chargement={envoi} style={styles.bouton} />
          <Bouton titre="Mot de passe oublié" variante="discret" onPress={() => router.push('/mot-de-passe-oublie')} />
          <Bouton titre="Devenir partenaire" variante="discret" onPress={() => router.push('/candidature')} />
          <View style={styles.inscription}>
            <Text style={styles.inscriptionTexte}>Pas encore de compte ?</Text>
            <Bouton titre="Créer un compte" variante="discret" onPress={() => router.push('/inscription')} />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#1B1C1F' },
  defilement: { flexGrow: 1 },
  hero: { paddingHorizontal: 24, paddingBottom: 62, minHeight: 380, justifyContent: 'space-between', overflow: 'hidden' },
  // Ville decalee vers le bas : la route passe sous la frise, pas a travers le slogan
  ville: { position: 'absolute', top: 70, bottom: -50, left: 0, right: 0 },
  voile: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(27,28,31,0.35)' },
  frise: { marginTop: 24, padding: 16, borderRadius: 24, backgroundColor: 'rgba(27,28,31,0.82)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  encoche: { position: 'absolute', top: -18, alignSelf: 'center', width: 150, height: 38, borderTopLeftRadius: 75, borderTopRightRadius: 75, backgroundColor: theme.surface, alignItems: 'center', paddingTop: 10 },
  poignee: { width: 40, height: 5, borderRadius: 3, backgroundColor: theme.bordure },
  logo: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  marque: { fontSize: 40, fontWeight: '800', color: '#FFFFFF', letterSpacing: -1.4 },
  slogan: { fontSize: 17, color: '#E4E5E8', marginTop: 6, textShadowColor: '#1B1C1F', textShadowRadius: 10 },
  formulaire: {
    flexGrow: 1,
    backgroundColor: theme.surface,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    marginTop: -30,
    padding: 28,
    paddingTop: 30,
    paddingBottom: 40,
  },
  titre: { fontSize: 30, fontWeight: '800', color: theme.texte, letterSpacing: -0.8 },
  sousTitre: { fontSize: 15, color: theme.secondaire, marginTop: 4, marginBottom: 24, lineHeight: 21 },
  bouton: { marginTop: 8 },
  inscription: { alignItems: 'center', marginTop: 20 },
  inscriptionTexte: { fontSize: 14, color: theme.secondaire },
});
