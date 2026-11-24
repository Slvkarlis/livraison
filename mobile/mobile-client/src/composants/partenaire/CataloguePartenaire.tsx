import Ionicons from '@expo/vector-icons/Ionicons';
import { Bouton, Carte, Champ, EntreeAnimee, MessageErreur, api, formatMontant, nombreSaisi, useTheme, verifierProduit, type Produit } from '@fleetpulse/shared';
import * as Haptics from 'expo-haptics';
import { useCallback, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ErreurPartenaire, EtatPartenaire, POLICE_MONO, SquelettePartenaire, useRessourcePartenaire } from './InterfacePartenaire';
import { PanneauCoulissant } from './PanneauCoulissant';
import { Puce } from './Puce';
import { InterrupteurPartenaire } from './InterrupteurPartenaire';

type Filtre = 'tous' | 'disponibles' | 'rupture';
export default function CataloguePartenaire() {
  const t = useTheme(), [recherche, setRecherche] = useState(''), [filtre, setFiltre] = useState<Filtre>('tous');
  const [edition, setEdition] = useState<Produit | 'nouveau' | null>(null), [message, setMessage] = useState(''), [erreurAction, setErreurAction] = useState<string | null>(null);
  const [occupes, setOccupes] = useState<Set<number>>(new Set()), [annulable, setAnnulable] = useState<Produit | null>(null);
  const enCours = useRef(new Map<number, Produit>());
  const lire = useCallback(async () => (await api.mesProduits()).map(p => enCours.current.get(p.id) ?? p), []);
  const r = useRessourcePartenaire(lire), produits = r.donnees ?? [];
  const visibles = produits.filter(p => (filtre === 'tous' || p.disponible === (filtre === 'disponibles')) && p.nom.toLocaleLowerCase('fr').includes(recherche.trim().toLocaleLowerCase('fr')));
  async function disponibilite(produit: Produit, valeur: boolean, annulation = false) {
    if (enCours.current.has(produit.id)) return;
    const optimiste = { ...produit, disponible: valeur };
    enCours.current.set(produit.id, optimiste); setOccupes(new Set(enCours.current.keys())); setErreurAction(null); setMessage('');
    r.setDonnees(avant => avant?.map(p => p.id === produit.id ? optimiste : p) ?? null);
    void Haptics.selectionAsync().catch(() => {});
    try {
      const maj = await api.sauverProduit(produit.id, { nom: produit.nom, prix: produit.prix, disponible: valeur });
      r.setDonnees(avant => avant?.map(p => p.id === produit.id ? maj : p) ?? null);
      setAnnulable(annulation ? null : produit); setMessage(`${produit.nom} : ${valeur ? 'disponible' : 'rupture de stock'}.`);
    } catch (e) {
      r.setDonnees(avant => avant?.map(p => p.id === produit.id ? produit : p) ?? null);
      setErreurAction(`${e instanceof Error ? e.message : 'Modification impossible.'} La disponibilité précédente est rétablie.`);
    } finally { enCours.current.delete(produit.id); setOccupes(new Set(enCours.current.keys())); }
  }
  return <SafeAreaView style={{ flex: 1, backgroundColor: t.fond }} edges={['top']}>
    <FlatList data={visibles} keyExtractor={p => String(p.id)} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: 104, gap: 12 }}
      refreshControl={<RefreshControl refreshing={r.chargement && !!r.donnees} onRefresh={() => void r.charger()} tintColor={t.texte} />}
      ListHeaderComponent={<View style={{ gap: 16 }}>
        <View><Text style={{ color: t.texte, fontSize: 12, letterSpacing: 1, fontWeight: '700' }}>VOTRE VITRINE</Text><Text accessibilityRole="header" style={{ color: t.texte, fontSize: 32, fontWeight: '800', letterSpacing: -0.8, marginTop: 6 }}>Mon catalogue</Text><Text style={{ color: t.texte, fontSize: 15, marginTop: 8 }}>{r.donnees ? `${produits.filter(p => p.disponible).length} disponibles · ${produits.length} produits` : 'Chargement de vos produits…'}</Text></View>
        <Champ libelle="Rechercher un produit" value={recherche} onChangeText={setRecherche} placeholder="Nom du produit…" returnKeyType="search" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{([{ id: 'tous', titre: 'Tous' }, { id: 'disponibles', titre: 'Disponibles' }, { id: 'rupture', titre: 'En rupture' }] as const).map(f => <Puce key={f.id} libelle={f.titre} actif={filtre === f.id} onPress={() => setFiltre(f.id)} />)}</ScrollView>
        <ErreurPartenaire message={r.erreur} horsConnexion={r.horsConnexion} reessayer={() => void r.charger()} />
        <MessageErreur message={erreurAction} />
        {message ? <View style={{ gap: 8 }}><Text accessibilityLiveRegion="polite" style={{ color: t.texte, fontSize: 15 }}>{message}</Text>{annulable ? <Bouton titre="Annuler la modification" variante="secondaire" desactive={occupes.has(annulable.id)} onPress={() => { const actuel = produits.find(p => p.id === annulable.id); if (actuel) void disponibilite(actuel, annulable.disponible, true); }} /> : null}</View> : null}
      </View>}
      ListEmptyComponent={!r.donnees && r.chargement ? <SquelettePartenaire /> : !r.erreur ? <EtatPartenaire icone="search-outline" titre={produits.length ? 'Aucun résultat' : 'Votre première vitrine'} texte={produits.length ? 'Essayez un autre nom ou affichez tous vos produits.' : 'Ajoutez un produit pour commencer à recevoir des commandes.'} action={<Bouton titre={produits.length ? 'Effacer les filtres' : 'Ajouter mon premier produit'} onPress={() => { if (produits.length) { setRecherche(''); setFiltre('tous'); } else setEdition('nouveau'); }} />} /> : undefined}
      renderItem={({ item: p, index }) => <EntreeAnimee rang={index}><Carte style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><View style={{ width: 52, height: 52, borderRadius: 18, backgroundColor: t.accentDoux, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: t.texte, fontSize: 24, fontWeight: '800' }}>{p.nom.charAt(0).toLocaleUpperCase('fr')}</Text></View><View style={{ flex: 1 }}><Text style={{ color: t.texte, fontSize: 18, fontWeight: '700' }}>{p.nom}</Text><Text style={{ color: t.texte, fontFamily: POLICE_MONO, fontSize: 16, marginTop: 5 }}>{formatMontant(p.prix)}</Text></View></View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 }}><Ionicons name={p.disponible ? 'checkmark-circle-outline' : 'remove-circle-outline'} size={22} color={t.texte} /><Text style={{ flex: 1, color: t.texte, fontSize: 15 }}>{p.disponible ? 'Disponible' : 'Rupture de stock'}</Text><InterrupteurPartenaire libelle={`Disponible : ${p.nom}`} valeur={p.disponible} desactive={occupes.has(p.id)} onChanger={valeur => void disponibilite(p, valeur)} /></View>
        <View style={{ flexDirection: 'row', gap: 8 }}><View style={{ flex: 1 }}><Bouton titre="Modifier" variante="secondaire" desactive={occupes.has(p.id)} onPress={() => setEdition(p)} /></View>{p.disponible ? <View style={{ flex: 1 }}><Bouton titre="Rupture de stock" variante="secondaire" desactive={occupes.has(p.id)} onPress={() => void disponibilite(p, false)} /></View> : null}</View>
      </Carte></EntreeAnimee>} />
    <View style={{ position: 'absolute', bottom: 16, right: 16, left: 90 }}><Bouton titre="Nouveau produit" onPress={() => setEdition('nouveau')} icone={<Ionicons name="add" size={22} color={t.surAccent} />} style={{ minHeight: 60 }} /></View>
    {edition ? <FormulaireProduit produit={edition === 'nouveau' ? null : edition} fermer={() => setEdition(null)} enregistrer={produit => { r.setDonnees(avant => avant ? avant.some(p => p.id === produit.id) ? avant.map(p => p.id === produit.id ? produit : p) : [...avant, produit] : [produit]); setEdition(null); setAnnulable(null); setMessage('Produit enregistré.'); }} /> : null}
  </SafeAreaView>;
}

function FormulaireProduit({ produit, fermer, enregistrer }: { produit: Produit | null; fermer: () => void; enregistrer: (produit: Produit) => void }) {
  const t = useTheme(), marges = useSafeAreaInsets(), [nom, setNom] = useState(produit?.nom ?? ''), [prix, setPrix] = useState(produit ? String(produit.prix) : ''), [disponible, setDisponible] = useState(produit?.disponible ?? true);
  const [envoi, setEnvoi] = useState(false), [erreur, setErreur] = useState<string | null>(null), [validation, setValidation] = useState(false);
  const verrou = useRef(false);
  const erreurNom = (validation || nom.length > 0) && (!nom.trim() || nom.trim().length > 120) ? 'Saisissez un nom de 1 à 120 caractères.' : undefined;
  const erreurPrix = (validation || prix.length > 0) && verifierProduit(nom.trim() || 'Produit', prix) ? 'Prix positif, 3 décimales maximum, jusqu’à 100000 DT.' : undefined;
  async function sauver() {
    if (verrou.current) return;
    setValidation(true); const invalide = verifierProduit(nom, prix); if (invalide) { setErreur(invalide); return; }
    verrou.current = true; setEnvoi(true); setErreur(null);
    try { const maj = await api.sauverProduit(produit?.id ?? null, { nom: nom.trim(), prix: nombreSaisi(prix), disponible }); enregistrer(maj); void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); }
    catch (e) { setErreur(e instanceof Error ? e.message : 'Enregistrement impossible. Votre saisie est conservée.'); }
    finally { verrou.current = false; setEnvoi(false); }
  }
  return <Modal visible transparent animationType="none" onRequestClose={() => { if (!envoi) fermer(); }}>
    <KeyboardAvoidingView style={{ flex: 1, justifyContent: 'flex-end', paddingTop: marges.top + 12 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Pressable accessibilityRole="button" accessibilityLabel="Fermer le formulaire" disabled={envoi} onPress={fermer} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: t.texte, opacity: 0.5 }} />
      <View style={{ height: '94%', paddingBottom: marges.bottom, backgroundColor: t.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28 }} accessibilityViewIsModal onAccessibilityEscape={() => { if (!envoi) fermer(); }}>
        <PanneauCoulissant initial={2} libelles={['Replier', 'Formulaire', 'Tout voir']} resume={<Text accessibilityRole="header" style={{ color: t.texte, fontSize: 21, fontWeight: '800' }}>{produit ? 'Modifier le produit' : 'Nouveau produit'}</Text>}>
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 12 }} keyboardShouldPersistTaps="handled">
            <Champ libelle="Nom du produit" value={nom} onChangeText={texte => { setNom(texte); setErreur(null); }} erreur={erreurNom} maxLength={120} editable={!envoi} autoFocus returnKeyType="next" />
            <Champ libelle="Prix en DT" value={prix} onChangeText={texte => { setPrix(texte); setErreur(null); }} erreur={erreurPrix} keyboardType="decimal-pad" maxLength={12} editable={!envoi} placeholder="Ex. 12,500" />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 }}><Text style={{ color: t.texte, fontSize: 16 }}>Disponible à la commande</Text><InterrupteurPartenaire libelle="Disponible à la commande" valeur={disponible} onChanger={setDisponible} desactive={envoi} /></View>
            <MessageErreur message={erreur} /><Bouton titre="Enregistrer le produit" chargement={envoi} onPress={() => void sauver()} style={{ minHeight: 60 }} /><Bouton titre="Annuler" variante="secondaire" desactive={envoi} onPress={fermer} />
          </ScrollView>
        </PanneauCoulissant>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}
