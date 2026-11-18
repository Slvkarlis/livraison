import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, Bouton, Carte, Ligne, MessageErreur, formatMontant, periodeParDefaut, useEvenementsCommandes, verifierPeriodeBi, type VentesPartenaire } from '@fleetpulse/shared';
import { theme } from '../../theme';

export default function EcranVentes() {
  const initial = periodeParDefaut();
  const [debut, setDebut] = useState(initial.debut), [fin, setFin] = useState(initial.fin);
  const [periode, setPeriode] = useState(initial), [ventes, setVentes] = useState<VentesPartenaire | null>(null);
  const [chargement, setChargement] = useState(false), [erreur, setErreur] = useState<string | null>(null);
  const charger = useCallback(async () => {
    setChargement(true); setErreur(null);
    try { setVentes(await api.ventesPartenaire(periode.debut, periode.fin)); }
    catch (e) { setErreur((e as Error).message); } finally { setChargement(false); }
  }, [periode]);
  useFocusEffect(useCallback(() => { void charger(); }, [charger]));
  useEvenementsCommandes(() => { void charger(); });
  const champ = { color: theme.texte, backgroundColor: theme.surface, borderColor: theme.bordure, borderWidth: 1, borderRadius: 10, padding: 12 };
  return <SafeAreaView style={{ flex: 1, backgroundColor: theme.fond }} edges={['top']}>
    <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 48 }}>
      <Text accessibilityRole="header" style={{ fontSize: 28, fontWeight: '800', color: theme.texte }}>Mes ventes</Text>
      <Text style={{ color: theme.secondaire }}>Articles livrés uniquement, hors frais et avant commission. Dates incluses en Africa/Tunis.</Text>
      <View style={{ gap: 8 }}>
        <Text style={{ color: theme.texte }}>Du (AAAA-MM-JJ)</Text><TextInput accessibilityLabel="Début de période" value={debut} onChangeText={setDebut} maxLength={10} style={champ} />
        <Text style={{ color: theme.texte }}>Au inclus (AAAA-MM-JJ)</Text><TextInput accessibilityLabel="Fin de période" value={fin} onChangeText={setFin} maxLength={10} style={champ} />
        <Bouton titre="Appliquer / actualiser" chargement={chargement} onPress={() => {
          const invalide = verifierPeriodeBi(debut, fin); if (invalide) { setErreur(invalide); return; }
          if (periode.debut === debut && periode.fin === fin) void charger(); else setPeriode({ debut, fin });
        }} />
      </View>
      <MessageErreur message={erreur} />
      {erreur && <Bouton titre="Réessayer le chargement" onPress={() => void charger()} />}
      {chargement && <ActivityIndicator accessibilityLabel="Chargement des ventes" color={theme.accent} />}
      {ventes && !chargement && !erreur && <>
        <Text accessibilityLiveRegion="polite" style={{ color: theme.secondaire }}>Résultats du {ventes.periode.debut} au {ventes.periode.fin}</Text>
        <Carte><Ligne libelle="Chiffre d’affaires articles" valeur={formatMontant(ventes.chiffreAffaires)} fort /><Ligne libelle="Commandes livrées" valeur={ventes.commandes} /></Carte>
        {!ventes.commandes && <Text style={{ color: theme.secondaire }}>Aucune commande livrée sur cette période.</Text>}
        <Text accessibilityRole="header" style={{ fontSize: 20, fontWeight: '700', color: theme.texte }}>Produits les plus vendus</Text>
        <Text style={{ color: theme.secondaire }}>Les 20 premiers, par quantité puis chiffre d’affaires. Montants des lignes figés à la commande ; nom actuel du catalogue.</Text>
        {ventes.meilleursProduits.map((p, i) => <Carte key={p.id}><Ligne libelle={`${i + 1}. ${p.nom} · ${p.quantite} unités`} valeur={formatMontant(p.chiffreAffaires)} /></Carte>)}
        {!ventes.meilleursProduits.length && <Text style={{ color: theme.secondaire }}>Aucun produit livré sur cette période.</Text>}
      </>}
    </ScrollView>
  </SafeAreaView>;
}
