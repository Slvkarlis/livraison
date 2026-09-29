import { useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from './auth';
import { Bouton, Champ, MessageErreur, Titre, couleurs, useAccent } from './ui';

/** Ecran de connexion (US-01) commun aux applications client et livreur. */
export function EcranConnexion({ sousTitre, piedDePage }: { sousTitre: string; piedDePage?: ReactNode }) {
  const accent = useAccent();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  async function seConnecter() {
    if (!email.trim() || !motDePasse) {
      setErreur('Saisissez votre email et votre mot de passe.');
      return;
    }
    setErreur(null);
    setEnvoi(true);
    try {
      await login(email, motDePasse);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Connexion impossible.');
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <SafeAreaView style={styles.page}>
      <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.contenu} keyboardShouldPersistTaps="handled">
          <Text style={[styles.marque, { color: accent }]}>FleetPulse</Text>
          <Titre sousTitre={sousTitre}>Connexion</Titre>
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
          {piedDePage}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: couleurs.fond },
  contenu: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  marque: { fontSize: 16, fontWeight: '700', marginBottom: 24, letterSpacing: 0.5 },
  bouton: { marginTop: 8 },
});
