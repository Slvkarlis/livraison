import { useCallback, useEffect, useRef, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { api, ApiError, Bouton, Carte, Champ, EntreeAnimee, GlisserPourConfirmer, MessageErreur, Pilule, Pressionnable, Ville3D, ajouterProduit, quantitePanier,
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
  const etape = devis ? 4 : panier.lignes.length ? 3 : selection ? 2 : adresseId ? 2 : 1;
  const nbArticles = panier.lignes.reduce((n, l) => n + l.quantite, 0);
  return <ScrollView style={{ flex: 1, backgroundColor: t.fond }} contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
    <EntreeAnimee rang={0}>
      <View style={styles.hero}>
        <Ville3D ton="nuit" fondu="#1B1C1F" progression={etape / 4} style={styles.heroVille} />
        <Pilule texte={nbArticles ? `${nbArticles} article${nbArticles > 1 ? 's' : ''} au panier` : 'Paiement à la livraison'} ton="verre" pulse={nbArticles > 0} />
        <View>
          <Text style={styles.heroTitre}>Commander</Text>
          <Text style={styles.heroSous}>Articles et livraison, à régler en espèces à l’arrivée.</Text>
          <View style={styles.progression}>
            {['Adresse', 'Commerce', 'Panier', 'Confirmer'].map((nom, i) => (
              <View key={nom} style={styles.progressionEtape}>
                <View style={[styles.progressionBarre, i < etape && styles.progressionFaite]} />
                <Text style={[styles.progressionTexte, i < etape && styles.progressionTexteFait]}>{nom}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </EntreeAnimee>
    <MessageErreur message={erreur} />
    {succes ? <Text accessibilityLiveRegion="polite" style={[styles.succes, { color: t.succes }]}>{succes}</Text> : null}
    {attente ? <Carte><Text style={texte}>La confirmation attend une réponse certaine. Réessayez avec la même clé pour retrouver la commande sans doublon.</Text><Bouton titre="Réessayer la confirmation" onPress={() => void commander()} chargement={envoi} /></Carte> : null}

    <EntreeAnimee rang={1}><Carte style={styles.carte}><Etape n={1} titre="Adresse de livraison" fait={!!adresseId} />
      {!adressesChargees ? <Bouton titre="Charger les adresses" onPress={() => void chargerAdresses()} /> : !adresses.length ? <Text style={texte}>Aucune adresse enregistrée.</Text> : null}
      {adresses.map(a => <View key={a.id} style={styles.choixBloc}>
        <Choix titre={a.libelle} detail={a.adresse} icone="home" actif={adresseId === a.id} desactive={bloque} onPress={() => choisir(a.id)} />
        <Bouton titre={'Modifier ' + a.libelle} variante="discret" desactive={bloque} onPress={() => saisir(a)} />
      </View>)}
      <Champ libelle="Libellé" value={libelle} onChangeText={setLibelle} maxLength={80} editable={!bloque} />
      <Champ libelle="Adresse complète" value={adresse} onChangeText={setAdresse} maxLength={250} editable={!bloque} />
      <View style={{ flexDirection: 'row', gap: 10 }}><View style={{ flex: 1 }}><Champ libelle="Latitude" value={latitude} onChangeText={setLatitude} keyboardType="numbers-and-punctuation" editable={!bloque} /></View><View style={{ flex: 1 }}><Champ libelle="Longitude" value={longitude} onChangeText={setLongitude} keyboardType="numbers-and-punctuation" editable={!bloque} /></View></View>
      <Bouton titre="Placer sur la carte / ma position" variante="secondaire" desactive={bloque} onPress={() => { definirAdresse(null); router.push('/choisir-adresse'); }}
        icone={<Ionicons name="map" size={18} color={t.texte} />} />
      <Bouton titre={edition ? 'Enregistrer les corrections' : 'Enregistrer une adresse'} desactive={bloque} onPress={() => void sauverAdresse()} />
      {edition ? <><Bouton titre="Annuler la modification" variante="discret" desactive={bloque} onPress={() => setEdition(null)} /><Bouton titre="Supprimer cette adresse" variante="danger" desactive={bloque} onPress={() => { setEnvoi(true); api.supprimerAdresse(edition).then(async () => { setEdition(null); setSucces('Adresse supprimée.'); await chargerAdresses(); }).catch(e => setErreur(e.message)).finally(() => setEnvoi(false)); }} /></> : null}
    </Carte></EntreeAnimee>

    <EntreeAnimee rang={2}><Carte style={styles.carte}><Etape n={2} titre="Partenaires ouverts" fait={!!selection} />
      <Champ libelle="Rechercher un commerce" value={recherche} onChangeText={setRecherche} editable={!bloque} />
      <Champ libelle="Catégorie (vide = toutes)" placeholder="Restaurant, Épicerie…" value={categorie} onChangeText={setCategorie} editable={!bloque} />
      <Bouton titre="Actualiser les partenaires" variante="discret" chargement={chargement} desactive={bloque} onPress={() => void chargerCommerces()} />
      {!chargement && !commerces.length ? <Text style={texte}>{adresseId ? 'Aucun partenaire ouvert pour cette adresse et ces filtres.' : 'Choisissez une adresse.'}</Text> : null}
      {commerces.map(p => <Choix key={p.id} titre={p.nomCommerce} detail={p.categorie} initiale={p.nomCommerce} actif={selection?.id === p.id} desactive={bloque} onPress={() => void catalogue(p)} />)}
    </Carte></EntreeAnimee>

    {selection ? <Carte style={styles.carte}>
      <Text style={styles.commerceNom}>{selection.nomCommerce}</Text>
      {selection.zoneNom ? <Text style={[styles.commerceZone, { color: t.secondaire }]}>{selection.zoneNom}</Text> : null}
      {chargement ? <Text style={texte}>Chargement du catalogue…</Text> : !produits.length ? <Text style={texte}>Aucun produit publié.</Text> : null}
      {produits.map(p => <View key={p.id} style={[styles.produit, { borderColor: t.bordure }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.produitNom, { color: t.texte }]}>{p.nom}</Text>
          <Text style={[styles.produitPrix, { color: t.secondaire }]}>{formatMontant(p.prix)}</Text>
        </View>
        <Pressionnable onPress={() => ajouter(p)} disabled={bloque || !p.disponible} accessibilityRole="button"
          accessibilityLabel={p.disponible ? 'Ajouter ' + p.nom : p.nom + ' indisponible'} style={[styles.ajout, (!p.disponible || bloque) && styles.ajoutInactif]}>
          {p.disponible ? <Ionicons name="add" size={22} color="#15171A" /> : <Text style={styles.ajoutTexte}>Indisponible</Text>}
        </Pressionnable>
      </View>)}
    </Carte> : null}
    {remplacement ? <Carte><Text accessibilityRole="alert" style={texte}>Ce produit appartient à un autre partenaire. Vider le panier et le remplacer ?</Text><Bouton titre="Vider et ajouter" desactive={bloque} onPress={() => ajouter(remplacement, true)} /><Bouton titre="Garder mon panier" variante="secondaire" onPress={() => remplacer(null)} /></Carte> : null}

    <EntreeAnimee rang={3}><Carte style={styles.carte}><Etape n={3} titre="Mon panier" fait={!!panier.lignes.length} />
      {!panier.lignes.length ? <Text style={texte}>Votre panier est vide.</Text> : null}
      {panier.lignes.map(l => <View key={l.produitId} style={[styles.ligne, { borderColor: t.bordure }]}>
        <Text style={[texte, { flex: 1 }]} numberOfLines={2}>{connus[l.produitId]?.nom ?? devis?.lignes.find(x => x.produitId === l.produitId)?.nomProduit ?? 'Produit #' + l.produitId}</Text>
        <View style={[styles.quantite, { backgroundColor: t.surfaceAlt, borderColor: t.bordure }]}>
          <Pressionnable onPress={() => changer(quantitePanier(panier, l.produitId, l.quantite - 1))} disabled={bloque} accessibilityRole="button" accessibilityLabel="Retirer un" style={styles.quantiteBouton}><Ionicons name="remove" size={18} color={t.texte} /></Pressionnable>
          <Text style={[styles.quantiteValeur, { color: t.texte }]}>{l.quantite}</Text>
          <Pressionnable onPress={() => changer(quantitePanier(panier, l.produitId, l.quantite + 1))} disabled={bloque || l.quantite >= 99} accessibilityRole="button" accessibilityLabel="Ajouter un" style={styles.quantiteBouton}><Ionicons name="add" size={18} color={t.texte} /></Pressionnable>
        </View>
        <Pressionnable onPress={() => changer(quantitePanier(panier, l.produitId, 0))} disabled={bloque} accessibilityRole="button" accessibilityLabel="Retirer du panier" style={styles.retirer}><Ionicons name="trash-outline" size={18} color={t.erreur} /></Pressionnable>
      </View>)}
      <Champ libelle="Notes pour la commande (500 caractères)" value={panier.notes} maxLength={500} multiline editable={!bloque} onChangeText={notes => changer({ ...panier, notes })} />
      <Bouton titre="Calculer les frais et le total" desactive={bloque || !panier.lignes.length || !adresseId} onPress={() => void calculer()} />
    </Carte></EntreeAnimee>

    {devis ? <EntreeAnimee rang={0}><View style={styles.recap}>
      <Etape n={4} titre="Vérifier et confirmer" fait={false} sombre />
      <Text style={styles.recapCommerce}>{devis.nomPartenaire} · {devis.zoneNom}</Text>
      <Text style={styles.recapAdresse}>{adresses.find(a => a.id === adresseId)?.adresse}</Text>
      <View style={styles.recapLignes}>
        {devis.lignes.map(l => <View key={l.produitId} style={styles.recapLigne}><Text style={styles.recapLibelle}>{l.quantite} × {l.nomProduit}</Text><Text style={styles.recapValeur}>{formatMontant(l.sousTotal)}</Text></View>)}
        <View style={styles.recapLigne}><Text style={styles.recapLibelle}>Articles</Text><Text style={styles.recapValeur}>{formatMontant(devis.montantArticles)}</Text></View>
        <View style={styles.recapLigne}><Text style={styles.recapLibelle}>Livraison</Text><Text style={styles.recapValeur}>{formatMontant(devis.fraisLivraison)}</Text></View>
      </View>
      <Text style={styles.recapTotalLibelle}>Total à payer à la livraison</Text>
      <Text style={styles.recapTotal}>{formatMontant(devis.total)}</Text>
      <GlisserPourConfirmer libelle="Glisser pour commander" chargement={envoi} desactive={bloque} onConfirmer={() => void commander()}
        icone={<Ionicons name="bag-check" size={22} color="#15171A" />} />
    </View></EntreeAnimee> : null}
  </ScrollView>;
}

/** Titre d'etape numerote : disque ambre plein une fois l'etape faite. */
function Etape({ n, titre, fait, sombre }: { n: number; titre: string; fait: boolean; sombre?: boolean }) {
  const t = useTheme();
  return <View style={styles.etape} accessibilityRole="header">
    <View style={[styles.etapeDisque, fait ? styles.etapeFaite : { borderColor: sombre ? '#F2B233' : t.bordure }]}>
      {fait ? <Ionicons name="checkmark" size={16} color="#15171A" /> : <Text style={[styles.etapeNumero, { color: sombre ? '#F2B233' : t.texte }]}>{n}</Text>}
    </View>
    <Text style={[styles.etapeTitre, { color: sombre ? '#FFFFFF' : t.texte }]}>{titre}</Text>
  </View>;
}

/** Choix selectionnable (adresse, commerce) : carte avec pastille, bord ambre quand il est choisi. */
function Choix({ titre, detail, icone, initiale, actif, desactive, onPress }: {
  titre: string; detail?: string; icone?: keyof typeof Ionicons.glyphMap; initiale?: string; actif: boolean; desactive?: boolean; onPress: () => void;
}) {
  const t = useTheme();
  return <Pressionnable onPress={onPress} disabled={desactive} accessibilityRole="button" accessibilityLabel={titre + (detail ? ', ' + detail : '')}
    style={[styles.choix, { backgroundColor: actif ? t.accentDoux : t.surfaceAlt, borderColor: actif ? t.accent : t.bordure }]}>
    <View style={[styles.choixPastille, { backgroundColor: actif ? t.accent : t.surface }]}>
      {icone ? <Ionicons name={icone} size={18} color="#15171A" /> : <Text style={styles.choixInitiale}>{(initiale ?? titre).charAt(0).toUpperCase()}</Text>}
    </View>
    <View style={{ flex: 1 }}>
      <Text style={[styles.choixTitre, { color: t.texte }]} numberOfLines={1}>{titre}</Text>
      {detail ? <Text style={[styles.choixDetail, { color: t.secondaire }]} numberOfLines={1}>{detail}</Text> : null}
    </View>
    {actif ? <Ionicons name="checkmark-circle" size={22} color={t.accent} /> : <Ionicons name="chevron-forward" size={18} color={t.secondaire} />}
  </Pressionnable>;
}

const styles = StyleSheet.create({
  hero: { minHeight: 240, borderRadius: 28, backgroundColor: '#1B1C1F', overflow: 'hidden', padding: 20, justifyContent: 'space-between' },
  // La ville occupe le haut du bandeau : la route passe au-dessus du titre, jamais a travers
  heroVille: { position: 'absolute', top: -10, bottom: '42%', left: '34%', right: 0 },
  heroTitre: { color: '#FFFFFF', fontSize: 36, fontWeight: '800', letterSpacing: -1.2 },
  heroSous: { color: '#C9CCD2', fontSize: 14, marginTop: 4, maxWidth: '80%' },
  progression: { flexDirection: 'row', gap: 6, marginTop: 16 },
  progressionEtape: { flex: 1, gap: 6 },
  progressionBarre: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.14)' },
  progressionFaite: { backgroundColor: '#F2B233' },
  progressionTexte: { color: '#9A9EA6', fontSize: 11, fontWeight: '700' },
  progressionTexteFait: { color: '#F4F3EF' },
  succes: { fontWeight: '600' },
  carte: { gap: 10 },
  etape: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
  etapeDisque: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  etapeFaite: { backgroundColor: '#F2B233', borderColor: '#F2B233' },
  etapeNumero: { fontSize: 14, fontWeight: '800' },
  etapeTitre: { fontSize: 20, fontWeight: '800', letterSpacing: -0.4, flex: 1 },
  choixBloc: { gap: 2 },
  choix: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 20, borderWidth: 1.5 },
  choixPastille: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  choixInitiale: { fontSize: 17, fontWeight: '800', color: '#15171A' },
  choixTitre: { fontSize: 16, fontWeight: '700' },
  choixDetail: { fontSize: 13, marginTop: 1 },
  commerceNom: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  commerceZone: { fontSize: 13, marginBottom: 4 },
  produit: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1 },
  produitNom: { fontSize: 16, fontWeight: '700' },
  produitPrix: { fontSize: 14, marginTop: 2, fontVariant: ['tabular-nums'] },
  ajout: { minWidth: 44, height: 44, borderRadius: 22, paddingHorizontal: 12, backgroundColor: '#F2B233', alignItems: 'center', justifyContent: 'center' },
  ajoutInactif: { backgroundColor: '#E5E3DD' },
  ajoutTexte: { fontSize: 12, fontWeight: '700', color: '#6B6F76' },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1 },
  quantite: { flexDirection: 'row', alignItems: 'center', borderRadius: 999, borderWidth: 1 },
  quantiteBouton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  quantiteValeur: { minWidth: 22, textAlign: 'center', fontSize: 15, fontWeight: '800' },
  retirer: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  recap: { backgroundColor: '#1B1C1F', borderRadius: 28, padding: 20, gap: 6 },
  recapCommerce: { color: '#F4F3EF', fontSize: 16, fontWeight: '700' },
  recapAdresse: { color: '#9A9EA6', fontSize: 13 },
  recapLignes: { marginVertical: 10, paddingVertical: 8, borderTopWidth: 1, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.1)', gap: 6 },
  recapLigne: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  recapLibelle: { color: '#C9CCD2', fontSize: 14, flex: 1 },
  recapValeur: { color: '#F4F3EF', fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] },
  recapTotalLibelle: { color: '#9A9EA6', fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  recapTotal: { color: '#F2B233', fontSize: 38, fontWeight: '800', letterSpacing: -1.2, marginBottom: 12, fontVariant: ['tabular-nums'] },
});
