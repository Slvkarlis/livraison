import { Bouton, COMMENTAIRE_REFUS_MAX, Carte, Champ, MOTIFS_REFUS, MessageErreur, api, verifierRefus, verifierTempsPreparation, useTheme, type CommandeDetail, type MotifRefus } from '@fleetpulse/shared';
import * as Haptics from 'expo-haptics';
import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Puce } from './Puce';
import { heureDans } from './EnteteCarte';

export function DecisionCommande({ commande, onDecision }: { commande: CommandeDetail; onDecision: (maj: CommandeDetail, message: string) => void }) {
  const t = useTheme(), [refus, setRefus] = useState(false), [temps, setTemps] = useState(15);
  const [autre, setAutre] = useState(false), [saisie, setSaisie] = useState(''), [motif, setMotif] = useState<MotifRefus | null>(null), [commentaire, setCommentaire] = useState('');
  const [erreur, setErreur] = useState<string | null>(null), [envoi, setEnvoi] = useState(false);
  const verrou = useRef(false);
  const minutes = autre ? Number(saisie) : temps;
  async function executer(motifChoisi?: MotifRefus) {
    if (verrou.current) return;
    const invalide = refus ? verifierRefus(motifChoisi ?? motif, commentaire) : autre ? verifierTempsPreparation(saisie) : null;
    if (invalide) { setErreur(invalide); return; }
    verrou.current = true; setEnvoi(true); setErreur(null);
    try {
      const maj = refus ? await api.refuserCommande(commande.id, (motifChoisi ?? motif)!, commentaire) : await api.accepterCommande(commande.id, minutes);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onDecision(maj, refus ? 'Commande refusée. Le client est informé.' : `Commande acceptée · préparation ${minutes} min.`);
    } catch (e) { setErreur(e instanceof Error ? e.message : 'Action impossible. Réessayez.'); }
    finally { verrou.current = false; setEnvoi(false); }
  }
  return <Carte style={{ gap: 10 }}>
    <Text accessibilityRole="header" style={{ fontSize: 18, fontWeight: '800', color: t.texte }}>{refus ? 'Choisir le motif de refus' : 'Temps de préparation'}</Text>
    {refus ? <>
      <Text style={{ fontSize: 14, lineHeight: 20, color: t.texte }}>Une touche sur un motif confirme le refus et informe le client.</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{MOTIFS_REFUS.map(m => <Puce key={m.id} libelle={m.id === 'TROP_DE_COMMANDES' ? 'Trop occupé' : m.id === 'FERMETURE' ? 'Fermé' : m.libelle} actif={motif === m.id} desactive={envoi} onPress={() => { setMotif(m.id); if (m.id !== 'AUTRE') void executer(m.id); }} />)}</View>
      {motif === 'AUTRE' ? <><Champ libelle="Précisez le motif" value={commentaire} onChangeText={setCommentaire} multiline maxLength={COMMENTAIRE_REFUS_MAX} editable={!envoi} /><Bouton titre="Confirmer le refus" variante="danger" chargement={envoi} onPress={() => void executer()} /></> : null}
      <MessageErreur message={erreur} /><Bouton titre="Revenir à l’acceptation" variante="secondaire" desactive={envoi} onPress={() => { setRefus(false); setErreur(null); }} />
    </> : <>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{[10, 15, 20, 30].map(n => <Puce key={n} libelle={`${n} min`} actif={!autre && temps === n} desactive={envoi} onPress={() => { setTemps(n); setAutre(false); }} />)}</View>
      {autre ? <Champ libelle="Préparation en minutes (1 à 180)" keyboardType="number-pad" value={saisie} onChangeText={setSaisie} maxLength={3} editable={!envoi} erreur={saisie ? verifierTempsPreparation(saisie) ?? undefined : undefined} /> : <Text style={{ color: t.texte, fontSize: 14 }}>Prête vers {heureDans(minutes)}</Text>}
      <MessageErreur message={erreur} />
      <Bouton titre={`Accepter · ${Number.isFinite(minutes) && minutes > 0 ? `${minutes} min` : 'choisir un délai'}`} chargement={envoi} onPress={() => void executer()} style={{ minHeight: 60 }} />
      <Bouton titre="Refuser la commande" variante="secondaire" desactive={envoi} onPress={() => { setRefus(true); setErreur(null); }} style={{ minHeight: 56 }} />
      <Bouton titre="Délai personnalisé" variante="secondaire" desactive={envoi} onPress={() => setAutre(!autre)} />
    </>}
  </Carte>;
}
