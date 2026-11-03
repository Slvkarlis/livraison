import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Bouton, Champ, MessageErreur, useConnexion } from '@fleetpulse/shared';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../theme';

// US-01 : les comptes livreurs sont crees par le responsable (US-02)
export default function Connexion() {
  const { email, setEmail, motDePasse, setMotDePasse, erreur, envoi, seConnecter } = useConnexion();

  return (
    <SafeAreaView style={styles.page}>
      <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.contenu} keyboardShouldPersistTaps="handled">
          <View style={styles.marque}>
            <View style={styles.logo}>
              <Ionicons name="speedometer" size={18} color={theme.surAccent} />
            </View>
            <Text style={styles.marqueTexte}>FLEETPULSE</Text>
            <Text style={styles.badge}>LIVREUR</Text>
          </View>

          <Text style={styles.titre}>Prêt pour{'\n'}la route ?</Text>
          <Text style={styles.sousTitre}>Connectez-vous ou déposez votre candidature.</Text>

          <MessageErreur message={erreur} />
          <Champ
            libelle="EMAIL OU TÉLÉPHONE"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder="prenom.nom@fleetpulse.tn"
          />
          <Champ
            libelle="MOT DE PASSE"
            value={motDePasse}
            onChangeText={setMotDePasse}
            secureTextEntry
            autoComplete="password"
            onSubmitEditing={seConnecter}
          />
          <Bouton
            titre="Commencer"
            onPress={seConnecter}
            chargement={envoi}
            icone={<Ionicons name="arrow-forward" size={20} color={theme.surAccent} />}
            style={styles.bouton}
          />
          <Bouton titre="Mot de passe oublié" variante="discret" onPress={() => router.push('/mot-de-passe-oublie')} />
          <Bouton titre="Devenir coursier" variante="discret" onPress={() => router.push('/candidature')} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.fond },
  contenu: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  marque: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 48 },
  logo: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  marqueTexte: { fontSize: 14, fontWeight: '800', color: theme.texte, letterSpacing: 2 },
  badge: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.accent,
    letterSpacing: 1.5,
    borderWidth: 1,
    borderColor: theme.accent,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  titre: { fontSize: 40, fontWeight: '800', color: theme.texte, letterSpacing: -1.2, lineHeight: 44 },
  sousTitre: { fontSize: 15, color: theme.secondaire, marginTop: 10, marginBottom: 32, lineHeight: 21 },
  bouton: { marginTop: 8 },
  pied: { fontSize: 13, color: theme.secondaire, textAlign: 'center', marginTop: 24 },
});
