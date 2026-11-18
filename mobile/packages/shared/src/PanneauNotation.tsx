import { useCallback, useEffect, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { api } from './api';
import { Bouton, Carte, MessageErreur, useTheme } from './ui';
import { ciblesRestantes, LIBELLES_CIBLES, verifierNotation, type CibleNotation, type NotesVue } from './notation';

export function PanneauNotation({ commandeId }: { commandeId: number }) {
  const [vue, setVue] = useState<NotesVue | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState('');
  const theme = useTheme();
  const charger = useCallback(async () => {
    try { const notes = await api.notations(commandeId); setVue(notes); setErreur(null); }
    catch (e) { setErreur((e as Error).message); }
  }, [commandeId]);
  useEffect(() => {
    let actif = true;
    api.notations(commandeId).then(notes => { if (actif) { setVue(notes); setErreur(null); } })
      .catch(e => { if (actif) setErreur((e as Error).message); });
    return () => { actif = false; };
  }, [commandeId]);
  return <View style={{ gap: 12, marginVertical: 16 }}>
    <Text accessibilityRole="header" style={{ color: theme.texte, fontSize: 18, fontWeight: '700' }}>Votre avis après livraison</Text>
    <Text style={{ color: theme.secondaire }}>De 1 à 5. Chaque avis est définitif, avec un commentaire facultatif de 500 caractères maximum.</Text>
    <MessageErreur message={erreur} />
    {erreur && <Bouton titre="Réessayer de charger les avis" onPress={() => void charger()} />}
    {!vue && !erreur && <Text accessibilityLiveRegion="polite">Chargement des avis…</Text>}
    {succes ? <Text accessibilityLiveRegion="polite" style={{ color: theme.succes }}>{succes}</Text> : null}
    {vue?.notes.map(n => <Text key={n.cible} style={{ color: theme.texte }}>{LIBELLES_CIBLES[n.cible]} : {n.note}/5 · avis enregistré{n.commentaire ? ` — ${n.commentaire}` : ''}</Text>)}
    {vue && !vue.ouverte && <Text>La notation sera disponible après livraison.</Text>}
    {vue && ciblesRestantes(vue).map(cible => <Formulaire key={cible} cible={cible} commandeId={commandeId} onNote={v => { setVue(v); setSucces('Votre avis a été enregistré. Merci.'); }} />)}
    {vue?.ouverte && !vue.cibles.length && <Text>Aucune cible disponible pour cette commande.</Text>}
  </View>;
}

function Formulaire({ cible, commandeId, onNote }: { cible: CibleNotation; commandeId: number; onNote: (v: NotesVue) => void }) {
  const [note, setNote] = useState(0), [commentaire, setCommentaire] = useState('');
  const [erreur, setErreur] = useState<string | null>(null), [envoi, setEnvoi] = useState(false);
  const theme = useTheme();
  async function envoyer() {
    const invalide = verifierNotation(note, commentaire);
    if (invalide) { setErreur(invalide); return; }
    setEnvoi(true); setErreur(null);
    try { onNote(await api.noter(commandeId, cible, note, commentaire)); }
    catch (e) { setErreur((e as Error).message); }
    finally { setEnvoi(false); }
  }
  return <Carte>
    <Text style={{ color: theme.texte, fontWeight: '700' }}>{LIBELLES_CIBLES[cible]}</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 8 }}>
      {[1, 2, 3, 4, 5].map(n => <Bouton key={n} titre={`${n} ${note === n ? '★' : '☆'}`} variante={note === n ? 'primaire' : 'secondaire'} desactive={envoi} onPress={() => setNote(n)} />)}
    </View>
    <TextInput accessibilityLabel={`Commentaire pour ${LIBELLES_CIBLES[cible]}`} placeholder="Commentaire facultatif" multiline maxLength={500} editable={!envoi}
      value={commentaire} onChangeText={setCommentaire} style={{ color: theme.texte, borderColor: theme.bordure, borderWidth: 1, borderRadius: 8, padding: 12, minHeight: 80 }} />
    <Text style={{ color: theme.secondaire }}>{commentaire.length}/500 caractères</Text>
    <MessageErreur message={erreur} />
    <Bouton titre="Enregistrer cet avis définitivement" chargement={envoi} onPress={() => void envoyer()} />
  </Carte>;
}
