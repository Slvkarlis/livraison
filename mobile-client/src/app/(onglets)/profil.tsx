import { Bouton, Carte, Ligne, Titre, apiBaseUrl, couleurs, useAuth } from '@fleetpulse/shared';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Profil() {
  const { profil, logout } = useAuth();
  if (!profil) return null;

  return (
    <SafeAreaView style={styles.page} edges={['top']}>
      <ScrollView contentContainerStyle={styles.contenu}>
        <Titre sousTitre="Compte client">{`${profil.prenom} ${profil.nom}`}</Titre>
        <Carte>
          <Ligne libelle="Email" valeur={profil.email} />
          <Ligne libelle="Téléphone" valeur={profil.telephone || '—'} />
        </Carte>
        <Carte style={styles.carte}>
          <Ligne libelle="Serveur" valeur={apiBaseUrl()} />
        </Carte>
        <Bouton titre="Se déconnecter" variante="secondaire" onPress={logout} style={styles.carte} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: couleurs.fond },
  contenu: { padding: 20 },
  carte: { marginTop: 16 },
});
