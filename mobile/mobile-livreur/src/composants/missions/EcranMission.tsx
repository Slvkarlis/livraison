import Ionicons from '@expo/vector-icons/Ionicons';
import { Chargement, EntreeAnimee, FriseTrajet, MessageErreur, PanneauNotation, Pilule, Pressionnable, Ville3D, api, formatHeure, formatMontant, useEvenementsCommandes, type Mission } from '@fleetpulse/shared';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../theme';
import { PanneauCollecte } from './PanneauCollecte';
import { PanneauRemise } from './PanneauRemise';
import { DeclarerEchec } from './DeclarerEchec';

/** Itineraire dans l'application de cartes du telephone (ou Google Maps dans le navigateur). */
function lienItineraire(latitude: number | null, longitude: number | null): string | null {
  if (latitude == null || longitude == null) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
}

// US-2B8 : detail d'une mission ; US-2B9 : collecte par scan du QR ; US-306 : encaissement et remise au client
export default function EcranMission() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [mission, setMission] = useState<Mission | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const { height } = useWindowDimensions();
  const { top: haut } = useSafeAreaInsets();
  const hauteurCarte = Math.round(height * 0.5);

  const charger = useCallback(async () => {
    try {
      setMission(await api.mission(Number(id)));
      setErreur(null);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Mission introuvable.');
    }
  }, [id]);

  useFocusEffect(useCallback(() => { void charger(); }, [charger]));
  useEvenementsCommandes((e) => { if (e.commandeId === Number(id)) void charger(); });

  if (!mission) {
    if (!erreur) return <Chargement />;
    return (
      <View style={[styles.page, { paddingTop: haut + 12, paddingHorizontal: 16, gap: 16 }]}>
        <Pressionnable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} accessibilityRole="button"
          accessibilityLabel="Retour aux missions" style={styles.rond}>
          <Ionicons name="chevron-back" size={22} color="#F4F3EF" />
        </Pressionnable>
        <MessageErreur message={erreur} />
      </View>
    );
  }

  const itineraire = lienItineraire(mission.latitudeCommerce, mission.longitudeCommerce);
  const itineraireClient = lienItineraire(mission.latitudeLivraison, mission.longitudeLivraison);
  const enRoute = mission.statut === 'RECUPEREE' || mission.statut === 'A_PROXIMITE';
  const livree = mission.statut === 'LIVREE';
  const phase = livree ? 'Livrée' : enRoute ? 'Livraison' : 'Collecte';
  const cible = enRoute ? itineraireClient : itineraire;
  const avance = livree ? 1 : mission.statut === 'A_PROXIMITE' ? 0.85 : enRoute ? 0.55 : 0.15;
  const heureDe = (iso: string | null) => (iso ? formatHeure(new Date(iso)) : '—');
  return (
    <View style={styles.page}>
      {/* Carte plein ecran fixe ; la feuille blanche defile par-dessus (conception Doop « Direction 3 ») */}
      <Ville3D ton="nuit" progression={avance} style={[styles.carte, { height: hauteurCarte + 60 }]} />
      <View style={[styles.barre, { paddingTop: haut + 8 }]} pointerEvents="box-none">
        <Pressionnable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} accessibilityRole="button"
          accessibilityLabel="Retour aux missions" style={styles.rond}>
          <Ionicons name="chevron-back" size={22} color="#F4F3EF" />
        </Pressionnable>
        <Pilule texte={`${phase} · ${mission.codeSuivi}`} ton="verre" pulse={!livree} />
        <View style={styles.rondVide} />
      </View>

      <ScrollView style={StyleSheet.absoluteFill} contentContainerStyle={[styles.contenu, { paddingTop: hauteurCarte - 70 }]}
        showsVerticalScrollIndicator={false}>
        {cible && !livree ? (
          <EntreeAnimee rang={0}>
            <Pressionnable onPress={() => void Linking.openURL(cible)} accessibilityRole="link"
              accessibilityLabel={enRoute ? 'Itinéraire vers le client' : 'Itinéraire vers le commerce'} style={styles.guidage}>
              <View style={styles.guidageIcone}><Ionicons name="navigate" size={15} color={theme.surAccent} /></View>
              <Text style={styles.guidageTexte}>{enRoute ? 'Itinéraire vers le client' : 'Itinéraire vers le commerce'}</Text>
            </Pressionnable>
          </EntreeAnimee>
        ) : null}

        <EntreeAnimee rang={1}>
          <View style={styles.feuille}>
            <View style={styles.encoche}><View style={styles.poignee} /></View>
            <View style={styles.feuilleTete}>
              <Text style={styles.feuilleTitre} numberOfLines={2}>{mission.nomCommerce}</Text>
              <Pilule texte={phase} ton={livree ? 'succes' : 'accent'} pulse={!livree} />
            </View>
            <Text style={styles.feuilleAdresse}>{enRoute && mission.adresseLivraison ? mission.adresseLivraison : mission.adresseCommerce}</Text>
            <View style={styles.faits}>
              <Fait libelle="Articles" valeur={String(mission.nbArticles)} />
              <Fait libelle="Client" valeur={mission.clientPrenom} />
              <Fait libelle="À encaisser" valeur={formatMontant(mission.montantACollecter)} fort />
            </View>

            <View style={styles.nuit}>
              <FriseTrajet depart={heureDe(mission.recupereeLe ?? mission.preteLe)} arrivee={heureDe(mission.livreeLe)}
                duree={livree ? 'Remise faite' : enRoute ? 'En route' : 'À collecter'} de={mission.nomCommerce}
                vers={mission.zoneNom ?? 'Client'} distance={mission.codeSuivi} progression={avance}
                icone={<Ionicons name="bicycle" size={16} color="#15171A" />} />
            </View>

            {/* Les panneaux d'action gardent leur theme sombre : ils forment un bloc « tableau de bord » dans la feuille */}
            <View style={styles.actions}>
              {mission.statut === 'AFFECTEE' ? <PanneauCollecte missionId={mission.id} onCollectee={setMission} /> : null}
              {enRoute && mission.recupereeLe ? (
                <View style={styles.collectee}>
                  <Ionicons name="checkmark-circle" size={22} color={theme.accent} />
                  <Text style={styles.collecteeTexte}>Colis récupéré à {formatHeure(new Date(mission.recupereeLe))}</Text>
                </View>
              ) : null}
              {mission.statut === 'A_PROXIMITE' ? <Text style={styles.discret}>Vous êtes à moins de 300 m du client.</Text> : null}
              {enRoute ? <PanneauRemise mission={mission} onLivree={setMission} /> : null}
              {enRoute ? <DeclarerEchec missionId={mission.id} onDeclare={() => void charger()} /> : null}
              {livree && mission.livreeLe ? (
                <View style={styles.collectee}>
                  <Ionicons name="checkmark-done-circle" size={22} color={theme.accent} />
                  <Text style={styles.collecteeTexte}>
                    Livrée à {formatHeure(new Date(mission.livreeLe))}
                    {mission.montantEncaisse != null ? ` · ${formatMontant(mission.montantEncaisse)} encaissés` : ''}
                  </Text>
                </View>
              ) : null}
              {livree ? <PanneauNotation commandeId={mission.id} /> : null}
            </View>
          </View>
        </EntreeAnimee>
      </ScrollView>
    </View>
  );
}

function Fait({ libelle, valeur, fort }: { libelle: string; valeur: string; fort?: boolean }) {
  return (
    <View style={styles.fait}>
      <Text style={styles.faitLibelle}>{libelle}</Text>
      <Text style={[styles.faitValeur, fort && styles.faitFort]} numberOfLines={1}>{valeur}</Text>
    </View>
  );
}

const CLAIR = { surface: '#FFFFFF', texte: '#15171A', discret: '#6B6F76', fond: '#ECEBE7' };

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#1B1C1F' },
  carte: { position: 'absolute', top: 0, left: 0, right: 0 },
  barre: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 10, backgroundColor: '#1B1C1F', borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  rond: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(27,28,31,0.72)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  rondVide: { width: 44 },
  contenu: { paddingBottom: 40 },
  guidage: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'center', marginBottom: 28, paddingVertical: 8, paddingLeft: 8, paddingRight: 14, borderRadius: 999, backgroundColor: 'rgba(27,28,31,0.78)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  guidageIcone: { width: 26, height: 26, borderRadius: 13, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center' },
  guidageTexte: { color: '#F4F3EF', fontSize: 13, fontWeight: '700' },
  feuille: { minHeight: 520, backgroundColor: CLAIR.surface, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 20, paddingTop: 26, gap: 6 },
  encoche: { position: 'absolute', top: -18, alignSelf: 'center', width: 150, height: 38, borderTopLeftRadius: 75, borderTopRightRadius: 75, backgroundColor: CLAIR.surface, alignItems: 'center', paddingTop: 10 },
  poignee: { width: 40, height: 5, borderRadius: 3, backgroundColor: '#DADAD5' },
  feuilleTete: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  feuilleTitre: { flex: 1, fontSize: 24, fontWeight: '800', color: CLAIR.texte, letterSpacing: -0.5 },
  feuilleAdresse: { fontSize: 14, color: CLAIR.discret },
  faits: { flexDirection: 'row', gap: 8, marginTop: 12 },
  fait: { flex: 1, backgroundColor: CLAIR.fond, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 12 },
  faitLibelle: { fontSize: 11.5, color: CLAIR.discret },
  faitValeur: { fontSize: 15, fontWeight: '700', color: CLAIR.texte, marginTop: 2 },
  faitFort: { color: '#7A4D00' },
  nuit: { backgroundColor: '#1B1C1F', borderRadius: 24, padding: 18, marginTop: 14 },
  actions: { gap: 12, marginTop: 14 },
  discret: { fontSize: 14, color: CLAIR.discret },
  collectee: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, borderRadius: 20, backgroundColor: '#FDF3DC' },
  collecteeTexte: { flex: 1, fontSize: 16, fontWeight: '700', color: CLAIR.texte },
});
