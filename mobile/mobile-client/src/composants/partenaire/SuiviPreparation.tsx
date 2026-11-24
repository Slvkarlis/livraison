import {
  AJUSTEMENTS_PREPARATION_MAX,
  Bouton,
  Carte,
  GlisserPourConfirmer,
  Champ,
  MessageErreur,
  TEMPS_PREPARATION_PROPOSES,
  api,
  verifierTempsPreparation,
  useMouvementReduit,
  useStyles,
  useTheme,
  type Theme,
  type CommandeDetail,
} from '@fleetpulse/shared';
import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { EnteteCarte } from './EnteteCarte';
import { Puce } from './Puce';

const ETAPES = ['Acceptée', 'En préparation', 'Prête'];

// US-2B4 / US-2B5 : debut de preparation, nouveau delai (au plus 2 fois), commande prete
export function SuiviPreparation({ commande, onMaj }: {
  commande: CommandeDetail;
  onMaj: (maj: CommandeDetail, message: string) => void;
}) {
  const theme = useTheme(), styles = useStyles(fabriqueStyles);
  const [panneau, setPanneau] = useState<'actions' | 'ajuster' | 'prete'>('actions');
  const [temps, setTemps] = useState<number | 'autre'>(10);
  const [tempsSaisi, setTempsSaisi] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [confirmationTactile, setConfirmationTactile] = useState(false);
  const verrou = useRef(false);

  const restants = Math.max(0, AJUSTEMENTS_PREPARATION_MAX - commande.nbAjustementsPreparation);
  const enPreparation = commande.statut === 'EN_PREPARATION';

  async function executer(action: () => Promise<CommandeDetail>, message: string) {
    if (verrou.current) return;
    verrou.current = true;
    setEnvoi(true);
    setErreur(null);
    try {
      onMaj(await action(), message);
      setPanneau('actions');
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Action impossible.');
    } finally {
      verrou.current = false;
      setEnvoi(false);
    }
  }

  function ajuster() {
    const invalide = temps === 'autre' ? verifierTempsPreparation(tempsSaisi) : null;
    if (invalide) { setErreur(invalide); return; }
    const minutes = temps === 'autre' ? Number(tempsSaisi.trim()) : temps;
    void executer(() => api.ajusterPreparation(commande.id, minutes), `Nouveau délai annoncé au client : encore ${minutes} min.`);
  }

  if (panneau === 'ajuster') {
    return (
      <Carte>
        <EnteteCarte icone="hourglass-outline" titre="Nouveau délai"
          aide={`Temps restant à partir de maintenant · ${restants} ajustement${restants > 1 ? 's' : ''} possible${restants > 1 ? 's' : ''}`} />
        <View style={styles.choix}>
          {TEMPS_PREPARATION_PROPOSES.map((t) => (
            <Puce key={t} libelle={`encore ${t} min`} actif={temps === t} desactive={envoi} onPress={() => setTemps(t)} />
          ))}
          <Puce libelle="Autre" actif={temps === 'autre'} desactive={envoi} onPress={() => setTemps('autre')} />
        </View>
        {temps === 'autre' ? (
          <Champ libelle="Minutes restantes (1 à 180)" value={tempsSaisi} onChangeText={setTempsSaisi} keyboardType="number-pad" maxLength={3} editable={!envoi} />
        ) : null}
        <MessageErreur message={erreur} />
        <Bouton titre="Annoncer ce nouveau délai" chargement={envoi} onPress={ajuster} style={styles.bouton} />
        <Bouton titre="Annuler" variante="discret" desactive={envoi} onPress={() => { setPanneau('actions'); setErreur(null); }} />
      </Carte>
    );
  }

  if (panneau === 'prete') {
    return (
      <Carte>
        <EnteteCarte icone="bag-check-outline" titre="Commande prête ?" aide="Confirmez quand la commande est emballée et prête à être récupérée par le livreur." />
        <MessageErreur message={erreur} />
        <GlisserPourConfirmer
          libelle="Glisser : commande prête"
          chargement={envoi}
          icone={<Ionicons name="bag-check" size={22} color={theme.surAccent} />}
          onConfirmer={() => void executer(() => api.marquerPrete(commande.id), 'Commande prête : le livreur peut venir la récupérer.')}
        />
        <Bouton titre={confirmationTactile ? 'Oui, confirmer la commande prête' : 'Confirmer sans glisser'} variante="secondaire" desactive={envoi} onPress={() => {
          if (!confirmationTactile) { setConfirmationTactile(true); return; }
          void executer(() => api.marquerPrete(commande.id), 'Commande prête : le livreur peut venir la récupérer.');
        }} style={styles.bouton} />
        <Bouton titre="Pas encore" variante="discret" desactive={envoi} onPress={() => { setPanneau('actions'); setErreur(null); }} />
      </Carte>
    );
  }

  return (
    <Carte>
      <EnteteCarte icone="restaurant-outline" ton="nuit" titre="Préparation"
        aide={enPreparation ? 'En cours de préparation.' : 'Commande acceptée, préparation pas encore commencée.'} />
      <View style={styles.etapes} accessibilityLiveRegion="polite" accessibilityLabel={`Étape ${enPreparation ? 2 : 1} sur 3`}>
        {ETAPES.map((e, i) => {
          const fait = i < (enPreparation ? 2 : 1);
          return (
            <View key={e} style={styles.etape}>
              <BarreEtape fait={fait} />
              <Text style={[styles.etapeTexte, fait && styles.etapeFaite]}>{e}</Text>
            </View>
          );
        })}
      </View>
      <MessageErreur message={erreur} />
      {!enPreparation ? (
        <Bouton
          titre="Commencer la préparation"
          chargement={envoi}
          onPress={() => void executer(() => api.commencerPreparation(commande.id), 'Préparation commencée.')}
          style={styles.bouton}
        />
      ) : null}
      <Bouton
        titre="Commande prête"
        variante={enPreparation ? 'primaire' : 'secondaire'}
        desactive={envoi}
        onPress={() => { setPanneau('prete'); setErreur(null); }}
        style={styles.bouton}
      />
      <Bouton
        titre={restants > 0 ? `Ajuster le délai (${restants} restant${restants > 1 ? 's' : ''})` : 'Délai déjà ajusté 2 fois'}
        variante="discret"
        desactive={envoi || restants === 0}
        onPress={() => { setPanneau('ajuster'); setErreur(null); }}
      />
    </Carte>
  );
}

function BarreEtape({ fait }: { fait: boolean }) {
  const t = useTheme(), reduit = useMouvementReduit(), progression = useSharedValue(fait ? 1 : 0);
  useEffect(() => { progression.value = withTiming(fait ? 1 : 0, { duration: reduit ? 0 : 250 }); }, [fait, progression, reduit]);
  const style = useAnimatedStyle(() => ({ opacity: progression.value }));
  return <View style={{ height: 6, borderRadius: 3, backgroundColor: t.bordure }}><Animated.View style={[{ height: 6, borderRadius: 3, backgroundColor: t.texte }, style]} /></View>;
}

function fabriqueStyles(theme: Theme) { return {
  etapes: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  etape: { flex: 1, gap: 6 },
  barre: { height: 5, borderRadius: 3, backgroundColor: theme.bordure },
  barreFaite: { backgroundColor: theme.accent },
  etapeTexte: { fontSize: 12, fontWeight: '700', color: theme.secondaire },
  etapeFaite: { color: theme.texte },
  choix: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  bouton: { marginTop: 8 },
} as const; }
