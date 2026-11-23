import { useCallback, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { api, BandeauVille, Bouton, Carte, Champ, EntreeAnimee, MessageErreur, Pilule, Pressionnable, Titre, useTheme, verifierProduit, nombreSaisi, formatMontant, type Commerce, type Produit } from '@fleetpulse/shared';

// US-203 : onglet Catalogue de l'espace partenaire (ouverture du commerce et deconnexion : onglet Commerce)
export default function CataloguePartenaire() {
  const t = useTheme();
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
  return <SafeAreaView style={{ flex: 1, backgroundColor: t.fond }} edges={['top']}><ScrollView style={{ backgroundColor: t.fond }} contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
    <EntreeAnimee rang={0}>
      <BandeauVille surtitre={commerce?.nomCommerce ?? 'Catalogue'} titre="Mon catalogue" progression={0.3}
        valeur={`${produits.filter(p => p.disponible).length} / ${produits.length}`} note="produits disponibles à la commande"
        pastille={commerce ? <Pilule texte={commerce.ouvert ? 'Ouvert' : 'Fermé'} ton={commerce.ouvert ? 'succes' : 'verre'} pulse={commerce.ouvert} /> : null} />
    </EntreeAnimee>
    <MessageErreur message={erreur} />
    {succes ? <Text accessibilityLiveRegion="polite" style={{ color: t.succes }}>{succes}</Text> : null}
    <Bouton titre="Actualiser" chargement={chargement} desactive={envoi} variante="secondaire" onPress={() => void charger()} />
    <Carte><Titre>{id ? 'Modifier le produit' : 'Publier un produit'}</Titre>
      <Champ libelle="Nom du produit" value={nom} maxLength={120} onChangeText={setNom} editable={!envoi} /><Champ libelle="Prix en DT (3 décimales maximum)" value={prix} keyboardType="decimal-pad" onChangeText={setPrix} editable={!envoi} />
      <Bouton titre={disponible ? 'Disponible — rendre indisponible' : 'Indisponible — rendre disponible'} variante="secondaire" desactive={envoi} onPress={() => setDisponible(!disponible)} />
      <Bouton titre="Enregistrer le produit" chargement={envoi} onPress={() => void sauver()} />{id ? <Bouton titre="Annuler" variante="discret" onPress={nouveau} desactive={envoi} /> : null}
    </Carte>
    {!chargement && !produits.length ? <Text style={{ color: t.texte }}>Aucun produit. Publiez votre premier article.</Text> : null}
    {produits.map((p, i) => <EntreeAnimee key={p.id} rang={i + 1}><Carte style={id === p.id ? { borderWidth: 1.5, borderColor: t.accent } : undefined}>
      <View style={styles.produit}>
        <View style={[styles.initiale, { backgroundColor: p.disponible ? t.accentDoux : t.surfaceAlt }]}><Text style={[styles.initialeTexte, { color: p.disponible ? '#7A4D00' : t.secondaire }]}>{p.nom.charAt(0).toUpperCase()}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.nom, { color: t.texte }]} numberOfLines={2}>{p.nom}</Text>
          <Text style={[styles.prix, { color: t.texte }]}>{formatMontant(p.prix)}</Text>
        </View>
        <Pilule texte={p.disponible ? 'Disponible' : 'Indisponible'} ton={p.disponible ? 'succes' : 'neutre'} />
      </View>
      <View style={styles.actions}>
        <Pressionnable onPress={() => { setId(p.id); setNom(p.nom); setPrix(String(p.prix)); setDisponible(p.disponible); }} disabled={envoi}
          accessibilityRole="button" accessibilityLabel={'Modifier ' + p.nom} style={[styles.action, { backgroundColor: t.surfaceAlt, borderColor: t.bordure }]}>
          <Ionicons name="create-outline" size={16} color={t.texte} /><Text style={[styles.actionTexte, { color: t.texte }]}>Modifier</Text>
        </Pressionnable>
        <Pressionnable onPress={() => { setEnvoi(true); api.sauverProduit(p.id, { ...p, disponible: !p.disponible }).then(async () => { await charger(); setSucces('Disponibilité mise à jour.'); }).catch(e => setErreur(e.message)).finally(() => setEnvoi(false)); }}
          disabled={envoi} accessibilityRole="button" accessibilityLabel={(p.disponible ? 'Rendre indisponible ' : 'Rendre disponible ') + p.nom}
          style={[styles.action, { backgroundColor: t.surfaceAlt, borderColor: t.bordure }]}>
          <Ionicons name={p.disponible ? 'eye-off-outline' : 'eye-outline'} size={16} color={t.texte} /><Text style={[styles.actionTexte, { color: t.texte }]}>{p.disponible ? 'Rendre indisponible' : 'Rendre disponible'}</Text>
        </Pressionnable>
      </View>
    </Carte></EntreeAnimee>)}
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  produit: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  initiale: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  initialeTexte: { fontSize: 18, fontWeight: '800' },
  nom: { fontSize: 17, fontWeight: '700' },
  prix: { fontSize: 15, fontWeight: '600', marginTop: 2, fontVariant: ['tabular-nums'] },
  actions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 9, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1 },
  actionTexte: { fontSize: 13, fontWeight: '700' },
});
