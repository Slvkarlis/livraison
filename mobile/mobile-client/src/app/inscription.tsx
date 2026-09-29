import { Bouton, Champ, MessageErreur, Titre, api, useAuth } from '@fleetpulse/shared';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { theme } from '../theme';

type Formulaire = { prenom: string; nom: string; email: string; telephone: string; motDePasse: string };

// US-04 : inscription publique, cree toujours un compte client
export default function Inscription() {
  const { login } = useAuth();
  const [form, setForm] = useState<Formulaire>({ prenom: '', nom: '', email: '', telephone: '', motDePasse: '' });
  const [erreurs, setErreurs] = useState<Partial<Formulaire>>({});
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const modifier = (champ: keyof Formulaire) => (valeur: string) => setForm((f) => ({ ...f, [champ]: valeur }));

  function valider(): boolean {
    const e: Partial<Formulaire> = {};
    if (!form.prenom.trim()) e.prenom = 'Prénom requis';
    if (!form.nom.trim()) e.nom = 'Nom requis';
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) e.email = 'Email invalide';
    if (form.motDePasse.length < 8) e.motDePasse = '8 caractères minimum';
    setErreurs(e);
    return Object.keys(e).length === 0;
  }

  async function creerCompte() {
    if (!valider()) return;
    setErreur(null);
    setEnvoi(true);
    try {
      await api.signup({
        prenom: form.prenom.trim(),
        nom: form.nom.trim(),
        email: form.email.trim().toLowerCase(),
        telephone: form.telephone.trim() || undefined,
        motDePasse: form.motDePasse,
      });
      await login(form.email, form.motDePasse);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Inscription impossible.');
      setEnvoi(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.contenu} keyboardShouldPersistTaps="handled">
        <Titre sousTitre="Quelques informations pour vos livraisons.">Créer un compte</Titre>
        <MessageErreur message={erreur} />
        <Champ libelle="Prénom" value={form.prenom} onChangeText={modifier('prenom')} erreur={erreurs.prenom}
          autoComplete="given-name" />
        <Champ libelle="Nom" value={form.nom} onChangeText={modifier('nom')} erreur={erreurs.nom}
          autoComplete="family-name" />
        <Champ libelle="Email" value={form.email} onChangeText={modifier('email')} erreur={erreurs.email}
          autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
        <Champ libelle="Téléphone (facultatif)" value={form.telephone} onChangeText={modifier('telephone')}
          keyboardType="phone-pad" autoComplete="tel" />
        <Champ libelle="Mot de passe" value={form.motDePasse} onChangeText={modifier('motDePasse')}
          erreur={erreurs.motDePasse} secureTextEntry autoComplete="new-password" />
        <Bouton titre="Créer mon compte" onPress={creerCompte} chargement={envoi} style={styles.bouton} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.surface },
  contenu: { padding: 24, paddingTop: 8 },
  bouton: { marginTop: 8 },
});
