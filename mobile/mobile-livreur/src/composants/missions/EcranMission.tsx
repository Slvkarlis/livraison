import Ionicons from '@expo/vector-icons/Ionicons';
import { Chargement, EntreeAnimee, FriseTrajet, MessageErreur, PanneauNotation, Pilule, Pressionnable, Ville3D, api, formatHeure, formatMontant, useEvenementsCommandes, type Mission } from '@fleetpulse/shared';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
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

  if (!mission) return erreur ? <View style={styles.page}><View style={styles.contenu}><MessageErreur message={erreur} /></View></View> : <Chargement />;

  const itineraire = lienItineraire(mission.latitudeCommerce, mission.longitudeCommerce);
  const itineraireClient = lienItineraire(mission.latitudeLivraison, mission.longitudeLivraison);
  const enRoute = mission.statut === 'RECUPEREE' || mission.statut === 'A_PROXIMITE';
  const livree = mission.statut === 'LIVREE';
  const phase = livree ? 'Livrée' : enRoute ? 'Livraison' : 'Collecte';
  const cible = enRoute ? itineraireClient : itineraire;
  const avance = livree ? 1 : mission.statut === 'A_PROXIMITE' ? 0.85 : enRoute ? 0.55 : 0.15;
  const heureDe = (iso: string | null) => (iso ? formatHeure(new Date(iso)) : '—');
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.contenu}>
      <EntreeAnimee rang={0}>
        <View style={styles.scene}>
          <Ville3D ton="nuit" progression={avance} style={StyleSheet.absoluteFill} />
          <View style={styles.sceneHaut}>
            <Pilule texte={`${phase} · ${mission.codeSuivi}`} ton="verre" pulse={!livree} />
          </View>
          {cible && !livree ? (
            <Pressionnable onPress={() => void Linking.openURL(cible)} accessibilityRole="link"
              accessibilityLabel={enRoute ? 'Itinéraire vers le client' : 'Itinéraire vers le commerce'} style={styles.guidage}>
              <View style={styles.guidageIcone}><Ionicons name="navigate" size={15} color={theme.surAccent} /></View>
              <Text style={styles.guidageTexte}>{enRoute ? 'Itinéraire vers le client' : 'Itinéraire vers le commerce'}</Text>
            </Pressionnable>
          ) : null}
        </View>
      </EntreeAnimee>

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
        </View>
      </EntreeAnimee>

      <EntreeAnimee rang={2}>
        <View style={styles.nuit}>
          <FriseTrajet depart={heureDe(mission.recupereeLe ?? mission.preteLe)} arrivee={heureDe(mission.livreeLe)}
            duree={livree ? 'Remise faite' : enRoute ? 'En route' : 'À collecter'} de={mission.nomCommerce}
            vers={mission.zoneNom ?? 'Client'} distance={mission.codeSuivi} progression={avance}
            icone={<Ionicons name="bicycle" size={16} color="#15171A" />} />
        </View>
      </EntreeAnimee>

      {mission.statut === 'AFFECTEE' ? <EntreeAnimee rang={3}><PanneauCollecte missionId={mission.id} onCollectee={setMission} /></EntreeAnimee> : null}
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
    </ScrollView>
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
  page: { flex: 1, backgroundColor: theme.fond },
  contenu: { padding: 14, paddingBottom: 56, gap: 14 },
  scene: { height: 330, borderRadius: 28, overflow: 'hidden', backgroundColor: '#1B1C1F', justifyContent: 'space-between', padding: 16 },
  sceneHaut: { flexDirection: 'row', justifyContent: 'center' },
  guidage: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'center', marginBottom: 34, paddingVertical: 8, paddingLeft: 8, paddingRight: 14, borderRadius: 999, backgroundColor: 'rgba(27,28,31,0.72)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  guidageIcone: { width: 26, height: 26, borderRadius: 13, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center' },
  guidageTexte: { color: '#F4F3EF', fontSize: 13, fontWeight: '700' },
  feuille: { marginTop: -46, backgroundColor: CLAIR.surface, borderRadius: 28, padding: 20, paddingTop: 22, gap: 6 },
  encoche: { position: 'absolute', top: -16, alignSelf: 'center', width: 140, height: 34, borderTopLeftRadius: 70, borderTopRightRadius: 70, backgroundColor: CLAIR.surface, alignItems: 'center', paddingTop: 10 },
  poignee: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#DADAD5' },
  feuilleTete: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  feuilleTitre: { flex: 1, fontSize: 21, fontWeight: '800', color: CLAIR.texte, letterSpacing: -0.3 },
  feuilleAdresse: { fontSize: 14, color: CLAIR.discret },
  faits: { flexDirection: 'row', gap: 8, marginTop: 12 },
  fait: { flex: 1, backgroundColor: CLAIR.fond, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 12 },
  faitLibelle: { fontSize: 11.5, color: CLAIR.discret },
  faitValeur: { fontSize: 15, fontWeight: '700', color: CLAIR.texte, marginTop: 2 },
  faitFort: { color: '#7A4D00' },
  nuit: { backgroundColor: '#1F2126', borderRadius: 24, padding: 18, borderWidth: 1, borderColor: theme.bordure },
  discret: { fontSize: 14, color: theme.secondaire },
  collectee: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, borderRadius: 20, backgroundColor: theme.accentDoux },
  collecteeTexte: { flex: 1, fontSize: 16, fontWeight: '700', color: theme.texte },
});
