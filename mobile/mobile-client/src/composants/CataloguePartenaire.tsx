import { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { api, Bouton, Carte, Champ, MessageErreur, Titre, useAuth, useTheme, verifierProduit, nombreSaisi, formatMontant, type Commerce, type Produit } from '@fleetpulse/shared';

export default function CataloguePartenaire() {
  const t = useTheme(), { logout } = useAuth();
  const [commerce, setCommerce] = useState<Commerce | null>(null), [produits, setProduits] = useState<Produit[]>([]);
  const [id, setId] = useState<number | null>(null), [nom, setNom] = useState(''), [prix, setPrix] = useState(''), [disponible, setDisponible] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null), [succes, setSucces] = useState(''), [envoi, setEnvoi] = useState(false), [chargement, setChargement] = useState(true);
  const charger = useCallback(async () => {
    setChargement(true); setErreur(null);
    try { const [c, p] = await Promise.all([api.commerce(), api.mesProduits()]); setCommerce(c); setProduits(p); }
    catch (e) { setErreur((e as Error).message); } finally { setChargement(false); }
  }, []);
  useFocusEffect(useCallback(() => { void charger(); }, [charger]));
  function nouveau() { setId(null); setNom(''); setPrix(''); setDisponible(true); }
  async function sauver() {
    const invalide = verifierProduit(nom, prix); if (invalide) { setErreur(invalide); return; }
    setEnvoi(true); setErreur(null);
    try { await api.sauverProduit(id, { nom, prix: nombreSaisi(prix), disponible }); nouveau(); await charger(); setSucces('Produit enregistré.'); }
    catch (e) { setErreur((e as Error).message); } finally { setEnvoi(false); }
  }
  return <ScrollView style={{ backgroundColor: t.fond }} contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 50 }} keyboardShouldPersistTaps="handled">
    <Titre sousTitre="Gérez votre commerce et vos produits.">{commerce?.nomCommerce ?? 'Mon catalogue'}</Titre><MessageErreur message={erreur} />
    {succes ? <Text accessibilityLiveRegion="polite" style={{ color: t.succes }}>{succes}</Text> : null}
    <Bouton titre="Actualiser" chargement={chargement} desactive={envoi} variante="secondaire" onPress={() => void charger()} />
    {commerce ? <Carte><Text style={{ color: t.texte }}>{commerce.zoneNom ? 'Zone : ' + commerce.zoneNom : 'Aucune zone : contactez le responsable.'}</Text>
      <Bouton titre={commerce.ouvert ? 'Commerce ouvert — fermer' : 'Commerce fermé — ouvrir'} desactive={envoi || (!commerce.zoneId && !commerce.ouvert)} onPress={() => {
        setEnvoi(true); api.ouverture(!commerce.ouvert).then(c => { setCommerce(c); setSucces(c.ouvert ? 'Commerce ouvert.' : 'Commerce fermé.'); }).catch(e => setErreur(e.message)).finally(() => setEnvoi(false));
      }} /></Carte> : null}
    <Carte><Titre>{id ? 'Modifier le produit' : 'Publier un produit'}</Titre>
      <Champ libelle="Nom du produit" value={nom} maxLength={120} onChangeText={setNom} editable={!envoi} /><Champ libelle="Prix en DT (3 décimales maximum)" value={prix} keyboardType="decimal-pad" onChangeText={setPrix} editable={!envoi} />
      <Bouton titre={disponible ? 'Disponible — rendre indisponible' : 'Indisponible — rendre disponible'} variante="secondaire" desactive={envoi} onPress={() => setDisponible(!disponible)} />
      <Bouton titre="Enregistrer le produit" chargement={envoi} onPress={() => void sauver()} />{id ? <Bouton titre="Annuler" variante="discret" onPress={nouveau} desactive={envoi} /> : null}
    </Carte>
    {!chargement && !produits.length ? <Text style={{ color: t.texte }}>Aucun produit. Publiez votre premier article.</Text> : null}
    {produits.map(p => <Carte key={p.id}><View style={{ gap: 8 }}><Text style={{ color: t.texte, fontSize: 18 }}>{p.nom} · {formatMontant(p.prix)}</Text><Text style={{ color: t.secondaire }}>{p.disponible ? 'Disponible' : 'Indisponible'}</Text>
      <Bouton titre={'Modifier ' + p.nom} variante="secondaire" desactive={envoi} onPress={() => { setId(p.id); setNom(p.nom); setPrix(String(p.prix)); setDisponible(p.disponible); }} />
      <Bouton titre={p.disponible ? 'Rendre indisponible' : 'Rendre disponible'} variante="discret" desactive={envoi} onPress={() => { setEnvoi(true); api.sauverProduit(p.id, { ...p, disponible: !p.disponible }).then(async () => { await charger(); setSucces('Disponibilité mise à jour.'); }).catch(e => setErreur(e.message)).finally(() => setEnvoi(false)); }} />
    </View></Carte>)}
    <Bouton titre="Se déconnecter" variante="discret" onPress={() => void logout()} />
  </ScrollView>;
}
