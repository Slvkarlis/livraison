import Ionicons from '@expo/vector-icons/Ionicons';
import { Bouton, Champ, MessageErreur, useConnexion } from '@fleetpulse/shared';
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
        <View style={[styles.hero, { paddingTop: insets.top + 40 }]}>
          <View style={styles.logo}>
            <Ionicons name="cube" size={26} color={theme.accent} />
          </View>
          <Text style={styles.marque}>FleetPulse</Text>
          <Text style={styles.slogan}>Vos livraisons, au bon moment.</Text>
        </View>

        <View style={styles.formulaire}>
          <Text style={styles.titre}>Bon retour</Text>
          <Text style={styles.sousTitre}>Connectez-vous pour commander et suivre vos livraisons.</Text>
          <MessageErreur message={erreur} />
          <Champ
            libelle="Email"
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
  page: { flex: 1, backgroundColor: theme.accent },
  defilement: { flexGrow: 1 },
  hero: { paddingHorizontal: 28, paddingBottom: 56 },
  logo: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  marque: { fontSize: 34, fontWeight: '800', color: '#FFFFFF', letterSpacing: -1 },
  slogan: { fontSize: 17, color: '#DAD6FF', marginTop: 6 },
  formulaire: {
    flexGrow: 1,
    backgroundColor: theme.surface,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 28,
    paddingBottom: 40,
  },
  titre: { fontSize: 26, fontWeight: '700', color: theme.texte, letterSpacing: -0.5 },
  sousTitre: { fontSize: 15, color: theme.secondaire, marginTop: 4, marginBottom: 24, lineHeight: 21 },
  bouton: { marginTop: 8 },
  inscription: { alignItems: 'center', marginTop: 20 },
  inscriptionTexte: { fontSize: 14, color: theme.secondaire },
});
