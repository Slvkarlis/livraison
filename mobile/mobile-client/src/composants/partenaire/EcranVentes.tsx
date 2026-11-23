import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, BandeauVille, Bouton, Carte, Champ, EntreeAnimee, MessageErreur, Pilule, formatMontant, periodeParDefaut, useEvenementsCommandes, verifierPeriodeBi, type VentesPartenaire } from '@fleetpulse/shared';
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
  return <SafeAreaView style={{ flex: 1, backgroundColor: theme.fond }} edges={['top']}>
    <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 48 }}>
      <EntreeAnimee rang={0}>
        <BandeauVille surtitre="Chiffre d’affaires articles" titre="Mes ventes" progression={0.9}
          valeur={ventes && !chargement ? formatMontant(ventes.chiffreAffaires) : '…'}
          note={ventes ? `${ventes.commandes} commande${ventes.commandes > 1 ? 's' : ''} livrée${ventes.commandes > 1 ? 's' : ''} · du ${ventes.periode.debut} au ${ventes.periode.fin}` : 'Articles livrés, hors frais et avant commission.'}
          pastille={<Pilule texte="Africa/Tunis" ton="verre" />} />
      </EntreeAnimee>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}><Champ libelle="Du (AAAA-MM-JJ)" accessibilityLabel="Début de période" value={debut} onChangeText={setDebut} maxLength={10} /></View>
        <View style={{ flex: 1 }}><Champ libelle="Au inclus" accessibilityLabel="Fin de période" value={fin} onChangeText={setFin} maxLength={10} /></View>
      </View>
      <View style={{ gap: 8 }}>
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
        {!ventes.commandes && <Text style={{ color: theme.secondaire }}>Aucune commande livrée sur cette période.</Text>}
        <Text accessibilityRole="header" style={{ fontSize: 20, fontWeight: '700', color: theme.texte }}>Produits les plus vendus</Text>
        <Text style={{ color: theme.secondaire }}>Les 20 premiers, par quantité puis chiffre d’affaires. Montants des lignes figés à la commande ; nom actuel du catalogue.</Text>
        {ventes.meilleursProduits.length ? <Carte style={{ gap: 14 }}>{ventes.meilleursProduits.map((p, i) => {
          const max = Math.max(...ventes.meilleursProduits.map(x => x.chiffreAffaires), 1);
          return <EntreeAnimee key={p.id} rang={i} style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: i === 0 ? theme.accent : theme.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontWeight: '800', color: '#15171A', fontSize: 13 }}>{i + 1}</Text>
              </View>
              <Text style={{ flex: 1, color: theme.texte, fontSize: 15, fontWeight: '700' }} numberOfLines={1}>{p.nom}</Text>
              <Text style={{ color: theme.texte, fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{formatMontant(p.chiffreAffaires)}</Text>
            </View>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: theme.surfaceAlt, overflow: 'hidden', marginLeft: 38 }}>
              <View style={{ width: `${Math.max(4, (p.chiffreAffaires / max) * 100)}%`, height: 8, borderRadius: 4, backgroundColor: i === 0 ? theme.accent : '#E2C27A' }} />
            </View>
            <Text style={{ color: theme.secondaire, fontSize: 12, marginLeft: 38 }}>{p.quantite} unités</Text>
          </EntreeAnimee>;
        })}</Carte> : null}
        {!ventes.meilleursProduits.length && <Text style={{ color: theme.secondaire }}>Aucun produit livré sur cette période.</Text>}
      </>}
    </ScrollView>
  </SafeAreaView>;
}
