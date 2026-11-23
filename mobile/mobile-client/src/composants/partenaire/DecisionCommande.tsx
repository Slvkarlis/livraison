import {
  Bouton,
  COMMENTAIRE_REFUS_MAX,
  Carte,
  Champ,
  MOTIFS_REFUS,
  MessageErreur,
  TEMPS_PREPARATION_PROPOSES,
  api,
  verifierRefus,
  verifierTempsPreparation,
  type CommandeDetail,
  type MotifRefus,
} from '@fleetpulse/shared';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../../theme';
import { EnteteCarte, heureDans } from './EnteteCarte';
import { Puce } from './Puce';

// US-2B2 : le partenaire accepte (avec temps de preparation) ou refuse (avec motif) une commande en attente
export function DecisionCommande({ commande, onDecision }: {
  commande: CommandeDetail;
  onDecision: (maj: CommandeDetail, message: string) => void;
}) {
  const [mode, setMode] = useState<'accepter' | 'refuser'>('accepter');
  const [temps, setTemps] = useState<number | 'autre'>(15);
  const [tempsSaisi, setTempsSaisi] = useState('');
  const [motif, setMotif] = useState<MotifRefus | null>(null);
  const [commentaire, setCommentaire] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const minutes = temps === 'autre' ? Number(tempsSaisi.trim()) : temps;

  async function accepter() {
    const invalide = temps === 'autre' ? verifierTempsPreparation(tempsSaisi) : null;
    if (invalide) { setErreur(invalide); return; }
    setEnvoi(true);
    setErreur(null);
    try {
      onDecision(await api.accepterCommande(commande.id, minutes), `Commande acceptée : préparation annoncée ${minutes} min.`);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Acceptation impossible.');
    } finally {
      setEnvoi(false);
    }
  }

  async function refuser() {
    const invalide = verifierRefus(motif, commentaire);
    if (invalide || !motif) { setErreur(invalide); return; }
    setEnvoi(true);
    setErreur(null);
    try {
      onDecision(await api.refuserCommande(commande.id, motif, commentaire), 'Commande refusée. Le client est informé du motif.');
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Refus impossible.');
    } finally {
      setEnvoi(false);
    }
  }

  if (mode === 'refuser') {
    return (
      <Carte>
        <EnteteCarte icone="close-circle-outline" ton="danger" titre="Refuser la commande" aide="Le client verra le motif choisi." />
        <View style={styles.motifs}>
          {MOTIFS_REFUS.map((m) => (
            <Puce key={m.id} libelle={m.libelle} actif={motif === m.id} desactive={envoi} onPress={() => setMotif(m.id)} />
          ))}
        </View>
        <Champ
          libelle={motif === 'AUTRE' ? 'Précisez le motif (obligatoire)' : 'Commentaire pour le client (facultatif)'}
          value={commentaire}
          onChangeText={setCommentaire}
          maxLength={COMMENTAIRE_REFUS_MAX}
          multiline
          editable={!envoi}
        />
        <MessageErreur message={erreur} />
        <Bouton titre="Confirmer le refus" variante="danger" chargement={envoi} onPress={() => void refuser()} style={styles.bouton} />
        <Bouton titre="Revenir" variante="discret" desactive={envoi} onPress={() => { setMode('accepter'); setErreur(null); }} />
      </Carte>
    );
  }

  return (
    <Carte>
      <EnteteCarte icone="timer-outline" titre="Votre décision" aide="Temps de préparation annoncé au client" />
      <View style={styles.temps}>
        {TEMPS_PREPARATION_PROPOSES.map((t) => (
          <Puce key={t} libelle={`${t} min`} actif={temps === t} desactive={envoi} onPress={() => setTemps(t)} />
        ))}
        <Puce libelle="Autre" actif={temps === 'autre'} desactive={envoi} onPress={() => setTemps('autre')} />
      </View>
      {temps === 'autre' ? (
        <Champ libelle="Minutes (1 à 180)" value={tempsSaisi} onChangeText={setTempsSaisi} keyboardType="number-pad" maxLength={3} editable={!envoi} />
      ) : null}
      <View style={styles.apercu}>
        <Text style={styles.apercuLibelle}>PRÊTE VERS</Text>
        <Text style={styles.apercuHeure}>{heureDans(minutes)}</Text>
      </View>
      <MessageErreur message={erreur} />
      <Bouton
        titre={temps === 'autre' && !tempsSaisi.trim() ? 'Accepter la commande' : `Accepter · prête dans ${minutes} min`}
        chargement={envoi}
        onPress={() => void accepter()}
        style={styles.bouton}
      />
      <Bouton titre="Refuser la commande" variante="danger" desactive={envoi} onPress={() => { setMode('refuser'); setErreur(null); }} />
    </Carte>
  );
}

const styles = StyleSheet.create({
  apercu: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1B1C1F', borderRadius: 20, paddingVertical: 12, paddingHorizontal: 18, marginBottom: 6 },
  apercuLibelle: { color: '#9A9EA6', fontSize: 12, fontWeight: '700', letterSpacing: 1.4 },
  apercuHeure: { color: theme.accent, fontSize: 30, fontWeight: '800', letterSpacing: -0.8, fontVariant: ['tabular-nums'] },
  temps: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  motifs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  bouton: { marginTop: 8 },
});
