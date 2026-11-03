import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { api, ApiError, Bouton, Carte, Champ, Ligne, MessageErreur, Titre, ajouterProduit, quantitePanier,
  verifierPanier, verifierPosition, nombreSaisi, nouvelleCle, panierVide, formatMontant, useTheme,
  type Adresse, type Commerce, type Produit, type DevisCommande, type PanierEnvoi, type Livraison } from '@fleetpulse/shared';
import { definirAdresse, useAdresseChoisie } from '../brouillon';
import { useMarche } from '../marche-session';

export default function MarcheClient() {
  const t = useTheme();
  const { panier, changer, attente, confirmer } = useMarche();
  const [adresses, setAdresses] = useState<Adresse[]>([]), [adresseId, choisir] = useState<number | null>(null);
  const [edition, setEdition] = useState<number | null>(null);
  const [libelle, setLibelle] = useState('Maison'), [adresse, setAdresse] = useState('');
  const [latitude, setLatitude] = useState(''), [longitude, setLongitude] = useState('');
  const position = useAdresseChoisie();
  const [commerces, setCommerces] = useState<Commerce[]>([]), [selection, setSelection] = useState<Commerce | null>(null);
  const [produits, setProduits] = useState<Produit[]>([]), [connus, setConnus] = useState<Record<number, Produit>>({});
  const [recherche, setRecherche] = useState(''), [categorie, setCategorie] = useState('');
  const [devisCalcule, setDevis] = useState<DevisCommande | null>(null), [remplacement, remplacer] = useState<Produit | null>(null);
  const [devisPour, setDevisPour] = useState('');
  const empreintePanier = JSON.stringify({ panier, adresseId, adresses });
  const devis = devisPour === empreintePanier ? devisCalcule : null;
  const [positionRecue, setPositionRecue] = useState(position);
  if (position !== positionRecue) {
    setPositionRecue(position);
    if (position) { setAdresse(position.adresse); setLatitude(String(position.latitude)); setLongitude(String(position.longitude)); }
  }
  const [erreur, setErreur] = useState<string | null>(null), [succes, setSucces] = useState('');
  const [chargement, setChargement] = useState(false), [envoi, setEnvoi] = useState(false), [adressesChargees, setAdressesChargees] = useState(false);
  const verrou = useRef(false), generation = useRef(0);
  const chargerAdresses = useCallback(async () => {
    try { const a = await api.adresses(); setAdresses(a); choisir(id => a.some(x => x.id === id) ? id : a[0]?.id ?? null); setAdressesChargees(true); }
    catch (e) { setErreur((e as Error).message); }
  }, []);
  useFocusEffect(useCallback(() => { void chargerAdresses(); }, [chargerAdresses]));
  const chargerCommerces = useCallback(async () => {
    if (!adresseId) { setCommerces([]); return; }
    const version = ++generation.current;
    setChargement(true); setErreur(null); setSelection(null); setProduits([]);
    try { const liste = await api.partenaires(adresseId, recherche, categorie); if (version === generation.current) setCommerces(liste); }
    catch (e) { if (version === generation.current) { setCommerces([]); setErreur((e as Error).message); } }
    finally { if (version === generation.current) setChargement(false); }
  }, [adresseId, recherche, categorie]);
  const invaliderChargement = useCallback(() => { generation.current++; }, []);
  useEffect(() => { const timer = setTimeout(() => void chargerCommerces(), 250); return () => { clearTimeout(timer); invaliderChargement(); }; }, [chargerCommerces, invaliderChargement]);
  function saisir(a: Adresse) { setEdition(a.id); setLibelle(a.libelle); setAdresse(a.adresse); setLatitude(String(a.latitude)); setLongitude(String(a.longitude)); }
  async function sauverAdresse() {
    const invalide = verifierPosition(latitude, longitude);
    if (invalide || !libelle.trim() || libelle.trim().length > 80 || !adresse.trim() || adresse.trim().length > 250) { setErreur(invalide ?? 'Libellé et adresse obligatoires (80 / 250 caractères maximum).'); return; }
    setEnvoi(true); setErreur(null);
    try { const a = await api.sauverAdresse(edition, { libelle, adresse, latitude: nombreSaisi(latitude), longitude: nombreSaisi(longitude) }); await chargerAdresses(); choisir(a.id); setEdition(null); setSucces('Adresse enregistrée.'); }
    catch (e) { setErreur((e as Error).message); } finally { setEnvoi(false); }
  }
  async function catalogue(p: Commerce) {
    if (!adresseId) return;
    const version = ++generation.current; setSelection(p); setProduits([]); setChargement(true); setErreur(null);
    try { const liste = await api.produits(p.id, adresseId); if (version !== generation.current) return; setProduits(liste); setConnus(v => ({ ...v, ...Object.fromEntries(liste.map(x => [x.id, x])) })); }
    catch (e) { if (version === generation.current) setErreur((e as Error).message); }
    finally { if (version === generation.current) setChargement(false); }
  }
  function ajouter(produit: Produit, confirme = false) {
    try { const r = ajouterProduit(panier, produit, confirme); if (r.confirmation) remplacer(produit); else { changer(r.panier); remplacer(null); setSucces('Produit ajouté au panier.'); } }
    catch (e) { setErreur((e as Error).message); }
  }
  function corps(): PanierEnvoi { return { partenaireId: panier.partenaireId!, adresseId: adresseId!, lignes: panier.lignes, notes: panier.notes }; }
  async function calculer() {
    const invalide = verifierPanier(panier);
    if (invalide || !adresseId) { setErreur(invalide ?? 'Choisissez une adresse.'); return; }
    setEnvoi(true); setErreur(null); setDevis(null);
    try { setDevis(await api.devisCommande(corps())); setDevisPour(empreintePanier); } catch (e) { setErreur((e as Error).message); } finally { setEnvoi(false); }
  }
  async function commander() {
    if (verrou.current || (!attente && !devis)) return;
    verrou.current = true; setEnvoi(true); setErreur(null);
    const requete = attente ?? { ...corps(), cleIdempotence: nouvelleCle(), devisEmpreinte: devis!.empreinte };
    confirmer(requete);
    try {
      const commande = await api.commander<Livraison>(requete); confirmer(null); changer(panierVide()); setDevis(null);
      router.replace({ pathname: '/commande/[id]', params: { id: String(commande.id), message: 'Commande COD enregistrée. En attente du partenaire.' } });
    } catch (e) {
      setErreur((e as Error).message);
      if (e instanceof ApiError && e.status >= 400 && e.status < 500 && e.status !== 401) { confirmer(null); setDevis(null); }
    } finally { verrou.current = false; setEnvoi(false); }
  }
  const bloque = envoi || attente !== null;
  const texte = { color: t.texte, fontSize: 16 } as const;
  return <ScrollView style={{ flex: 1, backgroundColor: t.fond }} contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 50 }} keyboardShouldPersistTaps="handled">
    <Titre sousTitre="Articles et livraison, à régler en espèces à l’arrivée.">Commander</Titre>
    <MessageErreur message={erreur} />
    {succes ? <Text accessibilityLiveRegion="polite" style={{ color: t.succes }}>{succes}</Text> : null}
    {attente ? <Carte><Text style={texte}>La confirmation attend une réponse certaine. Réessayez avec la même clé pour retrouver la commande sans doublon.</Text><Bouton titre="Réessayer la confirmation" onPress={() => void commander()} chargement={envoi} /></Carte> : null}
    <Carte><Titre>1. Adresse de livraison</Titre>
      {!adressesChargees ? <Bouton titre="Charger les adresses" onPress={() => void chargerAdresses()} /> : !adresses.length ? <Text style={texte}>Aucune adresse enregistrée.</Text> : null}
      {adresses.map(a => <View key={a.id} style={{ gap: 6, marginBottom: 12 }}>
        <Bouton titre={(adresseId === a.id ? '✓ ' : '') + a.libelle + ' — ' + a.adresse} variante={adresseId === a.id ? 'primaire' : 'secondaire'} desactive={bloque} onPress={() => choisir(a.id)} />
        <Bouton titre={'Modifier ' + a.libelle} variante="discret" desactive={bloque} onPress={() => saisir(a)} />
      </View>)}
      <Champ libelle="Libellé" value={libelle} onChangeText={setLibelle} maxLength={80} editable={!bloque} />
      <Champ libelle="Adresse complète" value={adresse} onChangeText={setAdresse} maxLength={250} editable={!bloque} />
      <View style={{ flexDirection: 'row', gap: 10 }}><View style={{ flex: 1 }}><Champ libelle="Latitude" value={latitude} onChangeText={setLatitude} keyboardType="numbers-and-punctuation" editable={!bloque} /></View><View style={{ flex: 1 }}><Champ libelle="Longitude" value={longitude} onChangeText={setLongitude} keyboardType="numbers-and-punctuation" editable={!bloque} /></View></View>
      <Bouton titre="Placer sur la carte / ma position" variante="secondaire" desactive={bloque} onPress={() => { definirAdresse(null); router.push('/choisir-adresse'); }} />
      <Bouton titre={edition ? 'Enregistrer les corrections' : 'Enregistrer une adresse'} desactive={bloque} onPress={() => void sauverAdresse()} />
      {edition ? <><Bouton titre="Annuler la modification" variante="discret" desactive={bloque} onPress={() => setEdition(null)} /><Bouton titre="Supprimer cette adresse" variante="danger" desactive={bloque} onPress={() => { setEnvoi(true); api.supprimerAdresse(edition).then(async () => { setEdition(null); setSucces('Adresse supprimée.'); await chargerAdresses(); }).catch(e => setErreur(e.message)).finally(() => setEnvoi(false)); }} /></> : null}
    </Carte>
    <Carte><Titre>2. Partenaires ouverts</Titre>
      <Champ libelle="Rechercher un commerce" value={recherche} onChangeText={setRecherche} editable={!bloque} />
      <Champ libelle="Catégorie (vide = toutes)" placeholder="Restaurant, Épicerie…" value={categorie} onChangeText={setCategorie} editable={!bloque} />
      <Bouton titre="Actualiser les partenaires" variante="discret" chargement={chargement} desactive={bloque} onPress={() => void chargerCommerces()} />
      {!chargement && !commerces.length ? <Text style={texte}>{adresseId ? 'Aucun partenaire ouvert pour cette adresse et ces filtres.' : 'Choisissez une adresse.'}</Text> : null}
      {commerces.map(p => <View key={p.id} style={{ marginTop: 10 }}><Bouton titre={p.nomCommerce + ' · ' + p.categorie} variante="secondaire" desactive={bloque} onPress={() => void catalogue(p)} /></View>)}
    </Carte>
    {selection ? <Carte><Titre sousTitre={selection.zoneNom ?? ''}>{selection.nomCommerce}</Titre>
      {chargement ? <Text style={texte}>Chargement du catalogue…</Text> : !produits.length ? <Text style={texte}>Aucun produit publié.</Text> : null}
      {produits.map(p => <View key={p.id} style={{ marginBottom: 14, gap: 6 }}><Ligne libelle={p.nom} valeur={formatMontant(p.prix)} /><Bouton titre={p.disponible ? 'Ajouter ' + p.nom : 'Indisponible'} desactive={bloque || !p.disponible} onPress={() => ajouter(p)} /></View>)}
    </Carte> : null}
    {remplacement ? <Carte><Text accessibilityRole="alert" style={texte}>Ce produit appartient à un autre partenaire. Vider le panier et le remplacer ?</Text><Bouton titre="Vider et ajouter" desactive={bloque} onPress={() => ajouter(remplacement, true)} /><Bouton titre="Garder mon panier" variante="secondaire" onPress={() => remplacer(null)} /></Carte> : null}
    <Carte><Titre>3. Mon panier</Titre>
      {!panier.lignes.length ? <Text style={texte}>Votre panier est vide.</Text> : null}
      {panier.lignes.map(l => <View key={l.produitId} style={{ marginBottom: 12 }}><Text style={texte}>{connus[l.produitId]?.nom ?? devis?.lignes.find(x => x.produitId === l.produitId)?.nomProduit ?? 'Produit #' + l.produitId} · {l.quantite}</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}><Bouton titre="−" desactive={bloque} variante="secondaire" onPress={() => changer(quantitePanier(panier, l.produitId, l.quantite - 1))} /><Bouton titre="+" desactive={bloque || l.quantite >= 99} variante="secondaire" onPress={() => changer(quantitePanier(panier, l.produitId, l.quantite + 1))} /><Bouton titre="Retirer" desactive={bloque} variante="discret" onPress={() => changer(quantitePanier(panier, l.produitId, 0))} /></View>
      </View>)}
      <Champ libelle="Notes pour la commande (500 caractères)" value={panier.notes} maxLength={500} multiline editable={!bloque} onChangeText={notes => changer({ ...panier, notes })} />
      <Bouton titre="Calculer les frais et le total" desactive={bloque || !panier.lignes.length || !adresseId} onPress={() => void calculer()} />
    </Carte>
    {devis ? <Carte><Titre>4. Vérifier et confirmer</Titre><Text style={texte}>{devis.nomPartenaire} · {devis.zoneNom}</Text>
      <Text style={texte}>{adresses.find(a => a.id === adresseId)?.adresse}</Text>
      {devis.lignes.map(l => <Ligne key={l.produitId} libelle={l.quantite + ' × ' + l.nomProduit} valeur={formatMontant(l.sousTotal)} />)}
      <Ligne libelle="Articles" valeur={formatMontant(devis.montantArticles)} /><Ligne libelle="Livraison" valeur={formatMontant(devis.fraisLivraison)} /><Ligne libelle="Total à payer à la livraison" valeur={formatMontant(devis.total)} fort />
      <Bouton titre="Confirmer la commande COD" desactive={bloque} onPress={() => void commander()} />
    </Carte> : null}
  </ScrollView>;
}
