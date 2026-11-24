import Ionicons from '@expo/vector-icons/Ionicons';
import { Bouton, EntreeAnimee, Ville3D, api, formatHeure, formatMontant, jourTunis, libelleStatutPartenaire, useAuth, useEvenementsCommandes, useStyles, useTempsReelConnecte, useTheme, type CommandeDetail, type CommandeResume, type Theme } from '@fleetpulse/shared';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DecisionCommande } from './DecisionCommande';
import { ErreurPartenaire, EtatPartenaire, MinuteurCommande, PointDirect, POLICE_MONO, SquelettePartenaire, useMaintenant, useRessourcePartenaire } from './InterfacePartenaire';
import { PanneauBoutique } from './PanneauBoutique';
import { Puce } from './Puce';
import { AnimationEtat } from './AnimationEtat';

const SEGMENTS = [
  { id: 'nouvelles', titre: 'Nouvelles', statuts: ['PENDING_PARTNER'] },
  { id: 'preparation', titre: 'En préparation', statuts: ['ACCEPTEE', 'EN_PREPARATION'] },
  { id: 'pretes', titre: 'Prêtes', statuts: ['PRETE', 'AFFECTEE'] },
  { id: 'recuperees', titre: 'Récupérées', statuts: ['RECUPEREE', 'EN_COURS', 'A_PROXIMITE', 'ARRIVEE', 'LIVREE', 'ECHEC', 'RETOURNEE'] },
  { id: 'archivees', titre: 'Refusées / annulées', statuts: ['REFUSEE', 'ANNULEE'] },
] as const;

export default function CommandesRecues() {
  const t = useTheme(), s = useStyles(styles), { profil } = useAuth(), maintenant = useMaintenant();
  const lire = useCallback(() => api.commandesRecues(), []), r = useRessourcePartenaire(lire);
  const [segment, setSegment] = useState(0), [annonce, setAnnonce] = useState('');
  const [chiffres, setChiffres] = useState<{ jour: string; chiffreAffaires: number } | null>(null);
  const [erreurVentes, setErreurVentes] = useState(false);
  const jour = jourTunis(new Date(maintenant));
  const chargerVentes = useCallback(async () => {
    try { const ventes = await api.ventesPartenaire(jour, jour); setChiffres({ jour, chiffreAffaires: ventes.chiffreAffaires }); setErreurVentes(false); }
    catch { setErreurVentes(true); }
  }, [jour]);
  useFocusEffect(useCallback(() => { void chargerVentes(); }, [chargerVentes]));
  useEvenementsCommandes(() => { void r.charger(); void chargerVentes(); });
  const direct = useTempsReelConnecte(), commandes = r.donnees ?? [];
  const nouvelles = commandes.filter(c => c.statut === 'PENDING_PARTNER').sort((a, b) => Date.parse(a.dateCreation) - Date.parse(b.dateCreation));
  const prioritaire = nouvelles[0];
  const actives = commandes.filter(c => ['ACCEPTEE', 'EN_PREPARATION', 'PRETE', 'AFFECTEE'].includes(c.statut)).length;
  const visibles = commandes.filter(c => (SEGMENTS[segment].statuts as readonly string[]).includes(c.statut)).sort((a, b) => segment === 0 ? Date.parse(a.dateCreation) - Date.parse(b.dateCreation) : Date.parse(b.dateCreation) - Date.parse(a.dateCreation));
  function decision(maj: CommandeDetail, message: string) { r.setDonnees(avant => avant?.map(c => c.id === maj.id ? maj : c) ?? [maj]); setAnnonce(message); void r.charger(); void chargerVentes(); }
  return <SafeAreaView style={s.page} edges={['top']}>
    <FlatList data={visibles} keyExtractor={c => String(c.id)} contentContainerStyle={s.liste}
      refreshControl={<RefreshControl refreshing={r.chargement && !!r.donnees} onRefresh={() => { void r.charger(); void chargerVentes(); }} tintColor={t.texte} />}
      ListHeaderComponent={<View style={{ gap: 16 }}>
        <View style={s.hero}>
          <Ville3D statique pointsActifs={actives} ton="nuit" fondu={t.texte} style={s.ville} />
          <View style={s.ligne}><Text style={s.surtitre}>FLEETPULSE · PARTENAIRE</Text><PointDirect actif={direct} /></View>
          <View><Text style={s.bonjour}>Bonjour {profil?.prenom}</Text><Text accessibilityRole="header" style={s.titre}>Aux commandes.</Text></View>
          <View style={s.chiffres}><View style={{ flex: 1 }}><Text style={s.valeur}>{r.donnees ? commandes.filter(c => jourTunis(new Date(c.dateCreation)) === jour).length : '—'}</Text><Text style={s.legende}>commandes du jour</Text></View><View style={{ flex: 1 }}><Text style={[s.valeur, { color: t.accent }]}>{chiffres?.jour === jour ? formatMontant(chiffres.chiffreAffaires) : '—'}</Text><Text style={s.legende}>ventes livrées · hors frais</Text></View></View>
        </View>
        <PanneauBoutique />
        {!direct ? <Text accessibilityLiveRegion="polite" style={s.aide}>Temps réel interrompu · actualisation toutes les 30 s.</Text> : null}
        {erreurVentes ? <Bouton titre="Réessayer les chiffres du jour" variante="secondaire" onPress={() => void chargerVentes()} /> : null}
        <ErreurPartenaire message={r.erreur} horsConnexion={r.horsConnexion} reessayer={() => void r.charger()} />
        {annonce ? <Text accessibilityLiveRegion="polite" style={s.annonce}>{annonce}</Text> : null}
        {prioritaire ? <NouvellePrioritaire key={prioritaire.id} resume={prioritaire} maintenant={maintenant} onDecision={decision} /> : null}
        <View style={s.ligne}><Text accessibilityRole="header" style={s.section}>Votre service</Text><Text style={s.aide}>{actives} en cours</Text></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>{SEGMENTS.map((g, i) => <Puce key={g.id} libelle={g.titre} actif={segment === i} compteur={commandes.filter(c => (g.statuts as readonly string[]).includes(c.statut)).length} onPress={() => setSegment(i)} />)}</ScrollView>
      </View>}
      ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      renderItem={({ item, index }) => <EntreeAnimee rang={index}><Pressable accessibilityRole="button" accessibilityLabel={`Commande ${item.codeSuivi} de ${item.clientPrenom}, ${libelleStatutPartenaire(item.statut)}`} onPress={() => router.push(`/partenaire/commande/${item.id}`)} style={({ pressed }) => [s.carte, { opacity: pressed ? 0.8 : 1 }]}>
        <View style={s.ligne}><Text style={s.code}>{item.codeSuivi}</Text><Text style={s.aide}>{formatHeure(new Date(item.dateCreation))}</Text></View><Text style={s.client}>{item.clientPrenom}</Text>
        <View style={s.ligne}><Text style={s.aide}>{item.nbArticles} article{item.nbArticles > 1 ? 's' : ''}</Text><Text style={s.montant}>{formatMontant(item.total)}</Text></View>
        <View style={[s.ligne, s.pied]}>{segment < 3 ? <MinuteurCommande depuis={item.dateCreation} maintenant={maintenant} /> : <Text style={s.aide}>{libelleStatutPartenaire(item.statut)}</Text>}<Ionicons name="arrow-forward" size={20} color={t.texte} /></View>
        {segment < 3 ? <Text style={s.aide}>{libelleStatutPartenaire(item.statut)}</Text> : null}
      </Pressable></EntreeAnimee>}
      ListEmptyComponent={!r.donnees && r.chargement ? <SquelettePartenaire /> : !r.erreur ? <EtatPartenaire titre="Tout est à jour" texte={`Aucune commande dans « ${SEGMENTS[segment].titre} ». Les nouvelles commandes apparaîtront ici.`} action={<Bouton titre="Actualiser les commandes" variante="secondaire" onPress={() => void r.charger()} />} /> : undefined} />
  </SafeAreaView>;
}

function NouvellePrioritaire({ resume, maintenant, onDecision }: { resume: CommandeResume; maintenant: number; onDecision: (maj: CommandeDetail, message: string) => void }) {
  const t = useTheme(), lire = useCallback(() => api.commandeRecue(resume.id), [resume.id]), r = useRessourcePartenaire(lire);
  return <View style={{ borderWidth: 2, borderColor: t.accent, backgroundColor: t.accentDoux, borderRadius: 24, padding: 12, gap: 10 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 4 }}><AnimationEtat etat="nouvelle" /><View style={{ flex: 1 }}><Text accessibilityRole="header" style={{ color: t.texte, fontSize: 21, fontWeight: '800' }}>Nouvelle commande</Text><Text style={{ color: t.texte, fontFamily: POLICE_MONO, marginTop: 4 }}>{resume.codeSuivi} · {formatMontant(resume.total)}</Text></View></View>
    <View style={{ paddingHorizontal: 4 }}><MinuteurCommande depuis={resume.dateCreation} maintenant={maintenant} /><Text style={{ color: t.texte, fontSize: 13, marginTop: 4 }}>Répondez dès que possible.</Text></View>
    <ErreurPartenaire message={r.erreur} horsConnexion={r.horsConnexion} reessayer={() => void r.charger()} />
    {r.donnees?.statut === 'PENDING_PARTNER' ? <DecisionCommande commande={r.donnees} onDecision={onDecision} /> : r.chargement ? <SquelettePartenaire /> : <Bouton titre="Actualiser la commande" onPress={() => void r.charger()} />}
    <Bouton titre="Voir les articles et les notes" variante="secondaire" onPress={() => router.push(`/partenaire/commande/${resume.id}`)} />
  </View>;
}

function styles(t: Theme) { return {
  page: { flex: 1, backgroundColor: t.fond }, liste: { padding: 16, paddingBottom: 32, flexGrow: 1 }, hero: { borderRadius: 26, padding: 20, minHeight: 180, backgroundColor: t.texte, overflow: 'hidden', justifyContent: 'space-between', gap: 14 }, ville: { position: 'absolute', top: 26, right: -20, width: 170, height: 110, opacity: 0.65 },
  ligne: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, surtitre: { color: t.fond, fontSize: 10, letterSpacing: 1, fontWeight: '800', flexShrink: 1 }, bonjour: { fontSize: 14, color: t.fond, marginBottom: 4 }, titre: { fontSize: 30, lineHeight: 36, letterSpacing: -1, fontWeight: '800', color: t.surface },
  chiffres: { flexDirection: 'row', gap: 14, borderTopWidth: 1, borderTopColor: t.secondaire, paddingTop: 16 }, valeur: { color: t.surface, fontSize: 21, fontWeight: '800', fontVariant: ['tabular-nums'], flexShrink: 1 }, legende: { color: t.fond, fontSize: 11, lineHeight: 17, marginTop: 4 }, aide: { color: t.texte, fontSize: 13, lineHeight: 19 }, section: { color: t.texte, fontSize: 22, fontWeight: '800' }, annonce: { color: t.succes, fontSize: 15, fontWeight: '700' },
  carte: { backgroundColor: t.surface, borderRadius: 22, padding: 18, gap: 10 }, code: { color: t.texte, fontFamily: POLICE_MONO, fontSize: 16, fontWeight: '700', flexShrink: 1 }, client: { color: t.texte, fontSize: 20, fontWeight: '800' }, montant: { fontSize: 18, color: t.texte, fontFamily: POLICE_MONO, fontWeight: '700' }, pied: { borderTopWidth: 1, borderTopColor: t.bordure, paddingTop: 12 },
} as const; }

