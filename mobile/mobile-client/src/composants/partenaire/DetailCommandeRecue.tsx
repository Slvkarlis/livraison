import { Bouton, Carte, Ligne, PanneauNotation, ROLES_ACTEUR, api, formatHeure, formatMontant, libelleEtapePartenaire, libelleMotifRefus, libelleStatutPartenaire, useEvenementsCommandes, useStyles, useTheme, type CommandeDetail, type Theme } from '@fleetpulse/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FriseHistorique } from '../FriseHistorique';
import { DecisionCommande } from './DecisionCommande';
import { SuiviPreparation } from './SuiviPreparation';
import { ErreurPartenaire, EtatPartenaire, MinuteurCommande, POLICE_MONO, SquelettePartenaire, useMaintenant, useRessourcePartenaire } from './InterfacePartenaire';
import { PanneauCoulissant } from './PanneauCoulissant';
import { AnimationEtat } from './AnimationEtat';

export default function DetailCommandeRecue() {
  const { id } = useLocalSearchParams<{ id: string }>(), t = useTheme(), s = useStyles(styles), maintenant = useMaintenant(), marges = useSafeAreaInsets();
  const lire = useCallback(() => {
    if (!/^\d+$/.test(id) || Number(id) <= 0) return Promise.reject(new Error('Référence de commande invalide.'));
    return api.commandeRecue(Number(id));
  }, [id]);
  const r = useRessourcePartenaire(lire), commande = r.donnees;
  const [succes, setSucces] = useState('');
  useEvenementsCommandes(e => { if (e.commandeId === Number(id)) void r.charger(); });
  if (!commande) return <ScrollView style={s.page} contentContainerStyle={{ padding: 20 }}><ErreurPartenaire message={r.erreur} horsConnexion={r.horsConnexion} reessayer={() => void r.charger()} />{r.chargement ? <SquelettePartenaire /> : <EtatPartenaire titre="Commande indisponible" texte="Actualisez la commande ou revenez à la liste." action={<Bouton titre="Revenir aux commandes" onPress={() => router.replace('/partenaire')} />} />}</ScrollView>;
  const enCours = ['ACCEPTEE', 'EN_PREPARATION'].includes(commande.statut), collecte = ['PRETE', 'AFFECTEE'].includes(commande.statut);
  const annulation = [...commande.historique].reverse().find(h => h.nouveau === 'ANNULEE');
  function majAction(maj: CommandeDetail, message: string) { r.setDonnees(maj); setSucces(message); }
  return <View style={[s.page, { paddingBottom: marges.bottom }]}>
    <View style={s.entete}><Text style={s.code}>{commande.codeSuivi}</Text><Text style={s.client}>{commande.clientPrenom}</Text><Text style={s.meta}>Reçue à {formatHeure(new Date(commande.dateCreation))}{commande.zoneNom ? ` · ${commande.zoneNom}` : ''}</Text></View>
    <PanneauCoulissant key={id} initial={2} resume={<View accessibilityLiveRegion="polite" style={{ gap: 6 }}><Text style={s.statut}>{libelleStatutPartenaire(commande.statut)}</Text>{['PENDING_PARTNER', 'ACCEPTEE', 'EN_PREPARATION', 'PRETE', 'AFFECTEE'].includes(commande.statut) ? <MinuteurCommande depuis={commande.dateCreation} echeance={enCours ? commande.pretePrevueLe : null} maintenant={maintenant} /> : null}</View>}>
      <ScrollView contentContainerStyle={s.contenu} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={r.chargement} onRefresh={() => void r.charger()} tintColor={t.texte} />}>
        <ErreurPartenaire message={r.erreur} horsConnexion={r.horsConnexion} reessayer={() => void r.charger()} />
        {succes ? <Text accessibilityLiveRegion="polite" style={s.succes}>{succes}</Text> : null}
        <Text accessibilityRole="header" style={s.section}>Articles · {commande.nbArticles}</Text>
        <Carte>{commande.lignes.map(l => <Ligne key={l.produitId} libelle={`${l.quantite} × ${l.nomProduit}`} valeur={formatMontant(l.sousTotal)} />)}{commande.notes ? <View style={s.notes}><Text style={s.statut}>Notes du client</Text><Text style={s.texte}>{commande.notes}</Text></View> : null}</Carte>
        {commande.statut === 'PENDING_PARTNER' ? <DecisionCommande commande={commande} onDecision={majAction} /> : null}
        {enCours ? <SuiviPreparation commande={commande} onMaj={majAction} /> : null}
        {collecte ? <><Carte style={{ gap: 12 }}><AnimationEtat etat="prete" /><Text style={s.statut}>{commande.livreurPrenom ? `Livreur : ${commande.livreurPrenom}` : 'En attente du livreur'}</Text><Text style={s.texte}>{commande.preteLe ? `Prête depuis ${formatHeure(new Date(commande.preteLe))}. ` : ''}Gardez le colis et son étiquette à portée de main.</Text><CodeCollecte commandeId={commande.id} /></Carte><Bouton titre="Ouvrir et imprimer l’étiquette" onPress={() => router.push(`/partenaire/etiquette/${commande.id}`)} /></> : null}
        {commande.statut === 'REFUSEE' ? <View style={s.notes}><Text style={s.statut}>Refusée{commande.motifRefus ? ` · ${libelleMotifRefus(commande.motifRefus)}` : ''}</Text>{commande.commentaireRefus ? <Text style={s.texte}>{commande.commentaireRefus}</Text> : null}</View> : null}
        {commande.statut === 'ANNULEE' ? <View style={s.notes}><Text style={s.statut}>Annulée{annulation ? ` par ${ROLES_ACTEUR[annulation.acteurRole]}` : ''} · ne pas préparer</Text><Text style={s.texte}>{commande.motifAnnulation ?? 'Aucun motif donné'}</Text></View> : null}
        {commande.recupereeLe ? <Text style={s.texte}>Récupérée par {commande.livreurPrenom ?? 'le livreur'} à {formatHeure(new Date(commande.recupereeLe))}</Text> : null}
        <Text accessibilityRole="header" style={s.section}>Récapitulatif</Text><Carte><Ligne libelle="Articles" valeur={formatMontant(commande.montantArticles)} /><Ligne libelle="Livraison" valeur={formatMontant(commande.fraisLivraison)} /><Ligne libelle="Total encaissé par le livreur" valeur={formatMontant(commande.total)} fort /></Carte>
        {commande.statut === 'LIVREE' ? <PanneauNotation commandeId={commande.id} /> : null}
        <Text accessibilityRole="header" style={s.section}>Historique</Text><FriseHistorique etapes={commande.historique} libelle={libelleEtapePartenaire} />
      </ScrollView>
    </PanneauCoulissant>
  </View>;
}

function CodeCollecte({ commandeId }: { commandeId: number }) {
  const t = useTheme(), lire = useCallback(() => api.etiquetteColis(commandeId), [commandeId]), r = useRessourcePartenaire(lire);
  return <><ErreurPartenaire message={r.erreur} horsConnexion={r.horsConnexion} reessayer={() => void r.charger()} />{r.donnees ? <View style={{ backgroundColor: t.accentDoux, borderRadius: 16, padding: 16, gap: 6 }}><Text style={{ color: t.texte, fontSize: 13 }}>CODE DE REMISE AU LIVREUR</Text><Text accessibilityLabel={`Code de remise ${r.donnees.codeCollecte.split('').join(' ')}`} style={{ fontFamily: POLICE_MONO, fontSize: 30, fontWeight: '800', color: t.texte, letterSpacing: 4 }}>{r.donnees.codeCollecte}</Text></View> : r.chargement ? <SquelettePartenaire /> : null}</>;
}
function styles(t: Theme) { return {
  page: { flex: 1, backgroundColor: t.fond }, entete: { padding: 20, gap: 5 }, code: { color: t.texte, fontFamily: POLICE_MONO, fontSize: 14, fontWeight: '700' }, client: { color: t.texte, fontSize: 29, fontWeight: '800', letterSpacing: -0.6 }, meta: { color: t.texte, fontSize: 14 }, statut: { color: t.texte, fontSize: 16, fontWeight: '800' }, contenu: { padding: 16, paddingBottom: 36, gap: 16, backgroundColor: t.surfaceAlt }, section: { color: t.texte, fontSize: 20, fontWeight: '800' }, succes: { color: t.succes, fontSize: 15, fontWeight: '700' }, notes: { padding: 16, borderRadius: 16, gap: 8, backgroundColor: t.accentDoux }, texte: { color: t.texte, fontSize: 16, lineHeight: 24 },
} as const; }
