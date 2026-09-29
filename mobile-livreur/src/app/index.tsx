import Ionicons from '@expo/vector-icons/Ionicons';
import { Bouton, Carte, Ligne, MessageErreur, Titre, couleurs, useAuth } from '@fleetpulse/shared';
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ACCENT } from '../theme';

// US-03 : le livreur consulte le vehicule que le responsable lui a affecte
export default function Accueil() {
  const { profil, rafraichir, logout } = useAuth();
  const [rafraichissement, setRafraichissement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  if (!profil) return null;
  const { vehicule } = profil;

  async function actualiser() {
    setRafraichissement(true);
    try {
      await rafraichir();
      setErreur(null);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Actualisation impossible.');
    } finally {
      setRafraichissement(false);
    }
  }

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView
        contentContainerStyle={styles.contenu}
        refreshControl={<RefreshControl refreshing={rafraichissement} onRefresh={actualiser} tintColor={ACCENT} />}
      >
        <Titre sousTitre="Espace livreur">{`Bonjour ${profil.prenom}`}</Titre>
        <MessageErreur message={erreur} />

        <Text style={styles.section}>Mon véhicule</Text>
        {vehicule ? (
          <Carte>
            <View style={styles.vehiculeEntete}>
              <View style={[styles.icone, { backgroundColor: '#ECFDF5' }]}>
                <Ionicons name="car-outline" size={24} color={ACCENT} />
              </View>
              <View style={styles.vehiculeTitre}>
                <Text style={styles.immatriculation}>{vehicule.immatriculation}</Text>
                <Text style={styles.type}>{vehicule.type || 'Type non renseigné'}</Text>
              </View>
              {!vehicule.actif ? <Text style={styles.inactif}>Inactif</Text> : null}
            </View>
            <Ligne libelle="Capacité" valeur={vehicule.capaciteKg != null ? `${vehicule.capaciteKg} kg` : '—'} />
            <Ligne libelle="Consommation" valeur={`${vehicule.consommationLitres100Km} L/100 km`} />
          </Carte>
        ) : (
          <Carte>
            <Text style={styles.videTitre}>Aucun véhicule affecté</Text>
            <Text style={styles.videTexte}>
              Votre responsable vous attribuera un véhicule. Tirez vers le bas pour actualiser.
            </Text>
          </Carte>
        )}

        <Text style={styles.section}>Mes informations</Text>
        <Carte>
          <Ligne libelle="Nom" valeur={`${profil.prenom} ${profil.nom}`} />
          <Ligne libelle="Email" valeur={profil.email} />
          <Ligne libelle="Téléphone" valeur={profil.telephone || '—'} />
        </Carte>

        <Bouton titre="Se déconnecter" variante="secondaire" onPress={logout} style={styles.deconnexion} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: couleurs.fond },
  contenu: { padding: 20 },
  section: { fontSize: 17, fontWeight: '600', color: couleurs.texte, marginBottom: 12, marginTop: 8 },
  vehiculeEntete: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  icone: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  vehiculeTitre: { flex: 1 },
  immatriculation: { fontSize: 18, fontWeight: '700', color: couleurs.texte },
  type: { fontSize: 14, color: couleurs.secondaire, textTransform: 'capitalize' },
  inactif: { fontSize: 13, fontWeight: '600', color: couleurs.erreur },
  videTitre: { fontSize: 16, fontWeight: '600', color: couleurs.texte },
  videTexte: { fontSize: 14, color: couleurs.secondaire, marginTop: 4 },
  deconnexion: { marginTop: 24 },
});
