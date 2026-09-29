import Ionicons from '@expo/vector-icons/Ionicons';
import { Bouton, Carte, Ligne, apiBaseUrl, useAuth } from '@fleetpulse/shared';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../../theme';

export default function Profil() {
  const { profil, logout } = useAuth();
  if (!profil) return null;
  const initiales = `${profil.prenom[0] ?? ''}${profil.nom[0] ?? ''}`.toUpperCase();

  return (
    <SafeAreaView style={styles.page} edges={['top']}>
      <ScrollView contentContainerStyle={styles.contenu}>
        <View style={styles.entete}>
          <View style={styles.avatar}>
            <Text style={styles.initiales}>{initiales}</Text>
          </View>
          <Text style={styles.nom}>{profil.prenom} {profil.nom}</Text>
          <Text style={styles.email}>{profil.email}</Text>
        </View>

        <Carte>
          <Ligne libelle="Téléphone" valeur={profil.telephone || '—'} />
          <Ligne libelle="Paiement" valeur="À la livraison" />
        </Carte>
        <Carte style={styles.bloc}>
          <Ligne libelle="Serveur" valeur={apiBaseUrl()} />
        </Carte>
        <Bouton
          titre="Se déconnecter"
          variante="danger"
          onPress={logout}
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
  initiales: { fontSize: 30, fontWeight: '700', color: theme.accent },
  nom: { fontSize: 22, fontWeight: '700', color: theme.texte },
  email: { fontSize: 15, color: theme.secondaire, marginTop: 4 },
  bloc: { marginTop: 16 },
});
