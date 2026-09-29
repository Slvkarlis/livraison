import Ionicons from '@expo/vector-icons/Ionicons';
import { Bouton, MessageErreur, useAuth } from '@fleetpulse/shared';
import { useState, type ComponentProps } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../theme';

// US-03 : le livreur consulte le vehicule que le responsable lui a affecte
export default function Accueil() {
  const { profil, rafraichir, logout } = useAuth();
  const [rafraichissement, setRafraichissement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  if (!profil) return null;
  const { vehicule } = profil;
  const initiales = `${profil.prenom[0] ?? ''}${profil.nom[0] ?? ''}`.toUpperCase();

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
        refreshControl={
          <RefreshControl
            refreshing={rafraichissement}
            onRefresh={actualiser}
            tintColor={theme.accent}
            colors={[theme.accent]}
            progressBackgroundColor={theme.surface}
          />
        }
      >
        <View style={styles.entete}>
          <View style={styles.avatar}>
            <Text style={styles.initiales}>{initiales}</Text>
          </View>
          <View style={styles.flex}>
            <Text style={styles.etiquette}>LIVREUR</Text>
            <Text style={styles.nom}>{profil.prenom} {profil.nom}</Text>
          </View>
          <View style={[styles.etat, !vehicule && styles.etatAttente]}>
            <View style={[styles.point, !vehicule && styles.pointAttente]} />
            <Text style={[styles.etatTexte, !vehicule && styles.etatTexteAttente]}>
              {vehicule ? 'Équipé' : 'En attente'}
            </Text>
          </View>
        </View>

        <MessageErreur message={erreur} />

        <Text style={styles.etiquette}>MON VÉHICULE</Text>
        {vehicule ? (
          <View style={styles.bloc}>
            <View style={styles.plaque}>
              <Text style={styles.plaqueTexte}>{vehicule.immatriculation}</Text>
            </View>
            <View style={styles.vehiculeType}>
              <Ionicons name={vehicule.type?.toLowerCase().includes('moto') ? 'bicycle' : 'car-sport'} size={18}
                color={theme.secondaire} />
              <Text style={styles.vehiculeTypeTexte}>{vehicule.type || 'Type non renseigné'}</Text>
              {!vehicule.actif ? <Text style={styles.inactif}>INACTIF</Text> : null}
            </View>
            <View style={styles.mesures}>
              <Mesure icone="cube-outline" valeur={vehicule.capaciteKg != null ? `${vehicule.capaciteKg}` : '—'}
                unite="kg" libelle="Capacité" />
              <View style={styles.mesureSeparateur} />
              <Mesure icone="water-outline" valeur={`${vehicule.consommationLitres100Km}`} unite="L/100"
                libelle="Consommation" />
            </View>
          </View>
        ) : (
          <View style={[styles.bloc, styles.vide]}>
            <Ionicons name="car-outline" size={32} color={theme.secondaire} />
            <Text style={styles.videTitre}>Aucun véhicule affecté</Text>
            <Text style={styles.videTexte}>Votre responsable vous attribuera un véhicule. Tirez pour actualiser.</Text>
          </View>
        )}

        <Text style={styles.etiquette}>CONTACT</Text>
        <View style={styles.bloc}>
          <Info icone="mail-outline" texte={profil.email} />
          <View style={styles.infoSeparateur} />
          <Info icone="call-outline" texte={profil.telephone || 'Non renseigné'} />
        </View>

        <Bouton
          titre="Se déconnecter"
          variante="danger"
          onPress={logout}
          icone={<Ionicons name="power" size={18} color={theme.erreur} />}
          style={styles.deconnexion}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

type NomIcone = ComponentProps<typeof Ionicons>['name'];

function Mesure({ icone, valeur, unite, libelle }: { icone: NomIcone; valeur: string; unite: string; libelle: string }) {
  return (
    <View style={styles.mesure}>
      <Ionicons name={icone} size={18} color={theme.accent} />
      <Text style={styles.mesureValeur}>
        {valeur} <Text style={styles.mesureUnite}>{unite}</Text>
      </Text>
      <Text style={styles.mesureLibelle}>{libelle}</Text>
    </View>
  );
}

function Info({ icone, texte }: { icone: NomIcone; texte: string }) {
  return (
    <View style={styles.info}>
      <Ionicons name={icone} size={18} color={theme.secondaire} />
      <Text style={styles.infoTexte}>{texte}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.fond },
  contenu: { padding: 20 },
  flex: { flex: 1 },
  entete: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 28, marginTop: 8 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: theme.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.bordure,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initiales: { fontSize: 18, fontWeight: '800', color: theme.texte },
  etiquette: { fontSize: 12, fontWeight: '700', color: theme.secondaire, letterSpacing: 1.5, marginBottom: 10 },
  nom: { fontSize: 20, fontWeight: '700', color: theme.texte, marginTop: -6 },
  etat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.accentDoux,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  etatAttente: { backgroundColor: 'rgba(251,191,36,0.12)' },
  point: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.accent },
  pointAttente: { backgroundColor: '#FBBF24' },
  etatTexte: { fontSize: 13, fontWeight: '700', color: theme.accent },
  etatTexteAttente: { color: '#FBBF24' },
  bloc: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.bordure,
    borderRadius: theme.rayon,
    padding: 16,
    marginBottom: 24,
  },
  plaque: {
    alignSelf: 'flex-start',
    backgroundColor: '#000000',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  plaqueTexte: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 2,
    fontVariant: ['tabular-nums'],
  },
  vehiculeType: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  vehiculeTypeTexte: { fontSize: 15, color: theme.texte, textTransform: 'capitalize', flex: 1 },
  inactif: { fontSize: 11, fontWeight: '800', color: theme.erreur, letterSpacing: 1 },
  mesures: {
    flexDirection: 'row',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme.bordure,
  },
  mesure: { flex: 1, gap: 4 },
  mesureSeparateur: { width: 1, backgroundColor: theme.bordure, marginHorizontal: 16 },
  mesureValeur: { fontSize: 22, fontWeight: '800', color: theme.texte, fontVariant: ['tabular-nums'] },
  mesureUnite: { fontSize: 13, fontWeight: '600', color: theme.secondaire },
  mesureLibelle: { fontSize: 12, color: theme.secondaire },
  vide: { alignItems: 'center', paddingVertical: 28, gap: 6 },
  videTitre: { fontSize: 16, fontWeight: '700', color: theme.texte, marginTop: 6 },
  videTexte: { fontSize: 14, color: theme.secondaire, textAlign: 'center', lineHeight: 20 },
  info: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  infoTexte: { fontSize: 15, color: theme.texte, flex: 1 },
  infoSeparateur: { height: 1, backgroundColor: theme.bordure, marginVertical: 10 },
  deconnexion: { borderWidth: 1, borderColor: theme.bordure },
});
