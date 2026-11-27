import Ionicons from '@expo/vector-icons/Ionicons';
import { Bouton, Carte, EntreeAnimee, Ligne, Pilule, Ville3D, apiBaseUrl, useAuth } from '@fleetpulse/shared';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../../theme';
import { PreferenceQuartier } from '../../composants/PreferenceQuartier';

export default function Profil() {
  const { profil, logout } = useAuth();
  if (!profil) return null;
  const initiales = `${profil.prenom[0] ?? ''}${profil.nom[0] ?? ''}`.toUpperCase();

  return (
    <SafeAreaView style={styles.page} edges={['top']}>
      <ScrollView contentContainerStyle={styles.contenu}>
        <EntreeAnimee rang={0}>
          <View style={styles.entete}>
            <Ville3D ton="nuit" fondu="#1B1C1F" progression={0.8} style={styles.ville} />
            <Pilule texte="Client" ton="verre" />
            <View style={styles.identite}>
              <View style={styles.avatar}>
                <Text style={styles.initiales}>{initiales}</Text>
              </View>
              <View style={styles.flex}>
                <Text style={styles.nom} numberOfLines={2}>{profil.prenom} {profil.nom}</Text>
                <Text style={styles.email} numberOfLines={1}>{profil.email}</Text>
              </View>
            </View>
          </View>
        </EntreeAnimee>

        <Carte>
          <Ligne libelle="Téléphone" valeur={profil.telephone || '—'} />
          <Ligne libelle="Paiement" valeur="À la livraison" />
          <PreferenceQuartier />
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
  contenu: { padding: 20, paddingBottom: 120 },
  entete: { minHeight: 210, borderRadius: 28, backgroundColor: '#1B1C1F', overflow: 'hidden', padding: 20, justifyContent: 'space-between', marginTop: 8, marginBottom: 18 },
  ville: { position: 'absolute', top: 0, bottom: 0, left: '28%', right: 0 },
  identite: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  flex: { flex: 1 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: 'rgba(242,178,51,0.3)',
  },
  initiales: { fontSize: 22, fontWeight: '800', color: '#15171A' },
  nom: { fontSize: 24, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5 },
  email: { fontSize: 14, color: '#C9CCD2', marginTop: 2 },
  bloc: { marginTop: 16 },
});
