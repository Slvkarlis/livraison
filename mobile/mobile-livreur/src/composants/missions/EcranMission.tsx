import Ionicons from '@expo/vector-icons/Ionicons';
import { Chargement, EntreeAnimee, FriseTrajet, MessageErreur, PanneauNotation, Pilule, Pressionnable, Ville3D, api, formatHeure, formatMontant, useEvenementsCommandes, type Mission } from '@fleetpulse/shared';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../theme';
import { PanneauCollecte } from './PanneauCollecte';
import { PanneauRemise } from './PanneauRemise';
import { DeclarerEchec } from './DeclarerEchec';
import { BandeauConsigne, GuidageItineraire, useGuidage } from './GuidageItineraire';
import { CarteNavigation } from '../navigation/CarteNavigation';

// US-2B8 : detail d'une mission ; US-2B9 : collecte par scan du QR ; US-306 : encaissement et remise au client
export default function EcranMission() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [mission, setMission] = useState<Mission | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const { height } = useWindowDimensions();
  const { top: haut } = useSafeAreaInsets();
  const hauteurCarte = Math.round(height * 0.5);
  const guidage = useGuidage(mission);

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

  const enRoute = mission.statut === 'RECUPEREE' || mission.statut === 'A_PROXIMITE';
  const livree = mission.statut === 'LIVREE';
  const phase = livree ? 'Livrée' : enRoute ? 'Livraison' : 'Collecte';
  // Mission en cours avec une destination connue : vraie carte GPS (rues, itineraire, suivi du livreur).
  const navigation = !livree && !!guidage.carte;
  const hauteurNavigation = Math.round(height * 0.58);
  const avance = livree ? 1 : mission.statut === 'A_PROXIMITE' ? 0.85 : enRoute ? 0.55 : 0.15;
  const heureDe = (iso: string | null) => (iso ? formatHeure(new Date(iso)) : '--:--');
  return (
    <View style={styles.page}>
      {/* Carte plein ecran fixe ; la feuille blanche defile par-dessus (conception Doop « Direction 3 ») */}
      {navigation ? (
        <CarteNavigation etat={guidage.carte} style={[styles.carte, { top: haut + 60, height: hauteurNavigation - haut - 40 }]} />
      ) : (
        <Ville3D ton="nuit" progression={avance} style={[styles.carte, { height: hauteurCarte + 60 }]} />
      )}
      {navigation ? (
        <View style={[styles.consigne, { top: haut + 70 }]} pointerEvents="none"><BandeauConsigne guidage={guidage} /></View>
      ) : null}
      <View style={[styles.barre, { paddingTop: haut + 8 }]} pointerEvents="box-none">
        <Pressionnable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} accessibilityRole="button"
          accessibilityLabel="Retour aux missions" style={styles.rond}>
          <Ionicons name="chevron-back" size={22} color="#F4F3EF" />
        </Pressionnable>
        <Pilule texte={`${phase} · ${mission.codeSuivi}`} ton="verre" pulse={!livree} />
        <View style={styles.rondVide} />
      </View>

      {/* En navigation, la feuille commence sous la carte : la carte reste manipulable (zoom, deplacement). */}
      <ScrollView style={navigation ? [styles.feuilleNavigation, { top: hauteurNavigation }] : StyleSheet.absoluteFill}
        contentContainerStyle={[styles.contenu, { paddingTop: navigation ? 20 : hauteurCarte - 70 }]}
        showsVerticalScrollIndicator={false}>

        <EntreeAnimee rang={1} style={{ flexGrow: 1 }}>
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

            {!livree ? <GuidageItineraire mission={mission} guidage={guidage} /> : null}

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
              {/* La notation suit le theme sombre du livreur : on la pose dans un bloc nuit */}
              {livree ? <View style={styles.nuit}><PanneauNotation commandeId={mission.id} /></View> : null}
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
  contenu: { flexGrow: 1 },
  consigne: { position: 'absolute', left: 12, right: 12, zIndex: 3 },
  feuilleNavigation: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  feuille: { minHeight: 520, backgroundColor: CLAIR.surface, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 20, paddingTop: 26, paddingBottom: 48, gap: 6, flexGrow: 1 },
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
