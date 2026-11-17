import Ionicons from '@expo/vector-icons/Ionicons';
import {
  Bouton,
  MessageErreur,
  api,
  formatMontant,
  libelleEtape,
  resumeOffre,
  secondesRestantes,
  type OffreLot,
} from '@fleetpulse/shared';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../../theme';

// US-405 : offre de lot a accepter ou refuser avant la fin du compte a rebours ; US-404 : itineraire propose
export function CarteOffre({ offre, onTraitee }: { offre: OffreLot; onTraitee: () => void }) {
  const [restant, setRestant] = useState(() => secondesRestantes(offre.expireLe));
  const [envoi, setEnvoi] = useState<'accepter' | 'refuser' | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    const minuterie = setInterval(() => setRestant(secondesRestantes(offre.expireLe)), 1000);
    return () => clearInterval(minuterie);
  }, [offre.expireLe]);

  // Offre expiree : le serveur la propose a un autre livreur, la liste est rechargee
  useEffect(() => {
    if (restant === 0) onTraitee();
  }, [restant, onTraitee]);

  async function repondre(action: 'accepter' | 'refuser') {
    setEnvoi(action);
    setErreur(null);
    try {
      if (action === 'accepter') await api.accepterOffre(offre.id);
      else await api.refuserOffre(offre.id, null);
      onTraitee();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Réponse impossible.');
      setEnvoi(null);
    }
  }

  return (
    <View style={styles.carte} accessibilityLabel={`Nouvelle offre : ${resumeOffre(offre)}`}>
      <View style={styles.entete}>
        <Ionicons name="flash" size={18} color={theme.accent} />
        <Text style={styles.titre}>Nouvelle offre</Text>
        <Text style={[styles.compteur, restant <= 10 && { color: theme.erreur }]}>{restant} s</Text>
      </View>
      <Text style={styles.resume}>{resumeOffre(offre)} · {formatMontant(offre.montantACollecter)} à encaisser</Text>
      {offre.horsZone ? (
        <Text style={styles.horsZone}>Hors de vos zones : renfort d’une zone voisine.</Text>
      ) : null}
      <View style={styles.etapes}>
        {offre.etapes.map((e) => (
          <Text key={e.ordre} style={styles.etape} numberOfLines={1}>
            {libelleEtape(e)}{e.minutesDepuisDepart ? ` (+${e.minutesDepuisDepart} min)` : ''}
          </Text>
        ))}
      </View>
      <MessageErreur message={erreur} />
      <View style={styles.boutons}>
        <Bouton titre="Refuser" variante="secondaire" style={styles.bouton} chargement={envoi === 'refuser'}
          desactive={envoi !== null || restant === 0} onPress={() => void repondre('refuser')} />
        <Bouton titre="Accepter" style={styles.bouton} chargement={envoi === 'accepter'}
          desactive={envoi !== null || restant === 0} onPress={() => void repondre('accepter')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  carte: { gap: 10, padding: 16, borderRadius: theme.rayon, backgroundColor: theme.surface, borderWidth: 2, borderColor: theme.accent },
  entete: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titre: { flex: 1, fontSize: 16, fontWeight: '800', color: theme.texte },
  compteur: { fontSize: 16, fontWeight: '800', color: theme.accent, fontVariant: ['tabular-nums'] },
  resume: { fontSize: 14, color: theme.texte },
  horsZone: { fontSize: 13, fontWeight: '700', color: theme.erreur },
  etapes: { gap: 4 },
  etape: { fontSize: 13, color: theme.secondaire },
  boutons: { flexDirection: 'row', gap: 10 },
  bouton: { flex: 1 },
});
