import Ionicons from '@expo/vector-icons/Ionicons';
import {
  Bouton,
  Carte,
  Chargement,
  Ligne,
  MessageErreur,
  BandeauVille,
  EntreeAnimee,
  Pilule,
  PanneauNotation,
  ROLES_ACTEUR,
  api,
  formatHeure,
  formatJour,
  formatMontant,
  libelleEtapePartenaire,
  libelleMotifRefus,
  libelleStatutPartenaire,
  useEvenementsCommandes,
  type CommandeDetail,
} from '@fleetpulse/shared';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { theme } from '../../theme';
import { FriseHistorique } from '../FriseHistorique';
import { DecisionCommande } from './DecisionCommande';
import { SuiviPreparation } from './SuiviPreparation';

// US-2B1 a US-2B5, US-2B10 : detail d'une commande recue (articles, montants, decision, preparation, etiquette, historique)
export default function DetailCommandeRecue() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [commande, setCommande] = useState<CommandeDetail | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState('');
  const [rafraichissement, setRafraichissement] = useState(false);

  const charger = useCallback(async () => {
    try {
      setCommande(await api.commandeRecue(Number(id)));
      setErreur(null);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Chargement impossible.');
    }
  }, [id]);

  useFocusEffect(useCallback(() => { void charger(); }, [charger]));
  // Temps reel : ex. annulation par le client pendant que le partenaire regarde la commande
  useEvenementsCommandes((e) => { if (e.commandeId === Number(id)) void charger(); });

  async function rafraichir() {
    setRafraichissement(true);
    await charger();
    setRafraichissement(false);
  }

  if (!commande) return erreur ? <View style={styles.erreur}><MessageErreur message={erreur} /></View> : <Chargement />;

  const recue = new Date(commande.dateCreation);
  const prevue = commande.pretePrevueLe ? new Date(commande.pretePrevueLe) : null;
  const enCours = commande.statut === 'ACCEPTEE' || commande.statut === 'EN_PREPARATION';
  const annulation = [...commande.historique].reverse().find((h) => h.nouveau === 'ANNULEE');
  // Etiquette disponible de « prete » jusqu'a la collecte par le livreur (meme regle que le backend)
  const attendCollecte = commande.statut === 'PRETE' || commande.statut === 'AFFECTEE';
  const majAction = (maj: CommandeDetail, message: string) => { setCommande(maj); setSucces(message); };
  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.contenu}
      refreshControl={<RefreshControl refreshing={rafraichissement} onRefresh={rafraichir} tintColor={theme.accent} />}
    >
      <MessageErreur message={erreur} />
      <EntreeAnimee rang={0}>
        <BandeauVille surtitre={`Commande ${commande.codeSuivi}`} titre={commande.clientPrenom}
          progression={({ PENDING_PARTNER: 0.05, ACCEPTEE: 0.2, EN_PREPARATION: 0.3, PRETE: 0.4, AFFECTEE: 0.5, RECUPEREE: 0.7, LIVREE: 1 } as Record<string, number>)[commande.statut] ?? 0.1}
          note={`Reçue ${formatJour(recue).toLowerCase()} à ${formatHeure(recue)}${commande.zoneNom ? ` · ${commande.zoneNom}` : ''}`}
          pastille={<Pilule texte={libelleStatutPartenaire(commande.statut)} ton={['ANNULEE', 'REFUSEE'].includes(commande.statut) ? 'danger' : 'verre'} pulse={enCours} />} />
      </EntreeAnimee>
      {succes ? <Text accessibilityLiveRegion="polite" style={styles.succes}>{succes}</Text> : null}
      {enCours && prevue ? (
        <View style={[styles.bandeau, styles.bandeauAccepte]}>
          <Text style={styles.bandeauTitre}>À préparer pour {formatHeure(prevue)}</Text>
          <Text style={styles.bandeauTexte}>
            Heure annoncée au client{commande.nbAjustementsPreparation > 0 ? ` · délai ajusté ${commande.nbAjustementsPreparation} fois` : ''}
          </Text>
        </View>
      ) : null}
      {commande.statut === 'ANNULEE' ? (
        <View style={[styles.bandeau, styles.bandeauRefuse]}>
          <Text style={styles.bandeauTitre}>
            Annulée{annulation ? ` par ${annulation.acteurRole === 'CLIENT' ? 'le client' : ROLES_ACTEUR[annulation.acteurRole].toLowerCase()}` : ''}
            {commande.annuleeLe ? ` à ${formatHeure(new Date(commande.annuleeLe))}` : ''}
          </Text>
          <Text style={styles.bandeauTexte}>{commande.motifAnnulation ?? 'Aucun motif donné'} · ne pas préparer</Text>
        </View>
      ) : null}
      {commande.statut === 'PRETE' && commande.preteLe ? (
        <View style={[styles.bandeau, styles.bandeauPrete]}>
          <Text style={styles.bandeauTitre}>Prête depuis {formatHeure(new Date(commande.preteLe))}</Text>
          <Text style={styles.bandeauTexte}>En attente du livreur</Text>
        </View>
      ) : null}
      {commande.statut === 'AFFECTEE' && commande.livreurPrenom ? (
        <View style={[styles.bandeau, styles.bandeauPrete]}>
          <Text style={styles.bandeauTitre}>Livreur assigné : {commande.livreurPrenom}</Text>
          <Text style={styles.bandeauTexte}>Il vient récupérer le colis : préparez l’étiquette</Text>
        </View>
      ) : null}
      {commande.statut === 'RECUPEREE' ? (
        <View style={[styles.bandeau, styles.bandeauPrete]}>
          <Text style={styles.bandeauTitre}>
            Récupérée par {commande.livreurPrenom ?? 'le livreur'}
            {commande.recupereeLe ? ` à ${formatHeure(new Date(commande.recupereeLe))}` : ''}
          </Text>
          <Text style={styles.bandeauTexte}>Le colis a quitté la boutique</Text>
        </View>
      ) : null}
      {attendCollecte ? (
        <Bouton
          titre="Étiquette du colis (QR)"
          onPress={() => router.push(`/partenaire/etiquette/${commande.id}`)}
          icone={<Ionicons name="qr-code-outline" size={20} color={theme.surAccent} />}
          style={styles.etiquette}
        />
      ) : null}
      {commande.statut === 'REFUSEE' && commande.motifRefus ? (
        <View style={[styles.bandeau, styles.bandeauRefuse]}>
          <Text style={styles.bandeauTitre}>Refusée : {libelleMotifRefus(commande.motifRefus)}</Text>
          {commande.commentaireRefus ? <Text style={styles.bandeauTexte}>{commande.commentaireRefus}</Text> : null}
        </View>
      ) : null}

      <Text style={styles.section}>Articles</Text>
      <Carte>
        {commande.lignes.map((l) => (
          <Ligne key={l.produitId} libelle={`${l.quantite} × ${l.nomProduit}`} valeur={formatMontant(l.sousTotal)} />
        ))}
        {commande.notes ? (
          <View style={styles.notes}>
            <Text style={styles.notesTitre}>Notes du client</Text>
            <Text style={styles.notesTexte}>{commande.notes}</Text>
          </View>
        ) : null}
      </Carte>

      <Text style={styles.section}>Montants</Text>
      <Carte>
        <Ligne libelle="Articles" valeur={formatMontant(commande.montantArticles)} />
        <Ligne libelle="Livraison" valeur={formatMontant(commande.fraisLivraison)} />
        <View style={styles.separateur} />
        <Ligne libelle="Total encaissé par le livreur" valeur={formatMontant(commande.total)} fort />
      </Carte>

      {commande.statut === 'PENDING_PARTNER' ? (
        <View style={styles.decision}>
          <DecisionCommande commande={commande} onDecision={majAction} />
        </View>
      ) : null}
      {enCours ? (
        <View style={styles.decision}>
          <SuiviPreparation commande={commande} onMaj={majAction} />
        </View>
      ) : null}

      {commande.statut === 'LIVREE' ? <PanneauNotation commandeId={commande.id} /> : null}
      <Text style={styles.section}>Historique</Text>
      <FriseHistorique etapes={commande.historique} libelle={libelleEtapePartenaire} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.fond },
  contenu: { padding: 20, paddingBottom: 48 },
  erreur: { flex: 1, padding: 20, backgroundColor: theme.fond },
  client: { fontSize: 24, fontWeight: '800', color: theme.texte, letterSpacing: -0.4, marginTop: 12 },
  meta: { fontSize: 14, color: theme.secondaire, marginTop: 4 },
  section: { fontSize: 20, fontWeight: '800', color: theme.texte, letterSpacing: -0.4, marginTop: 26, marginBottom: 10 },
  succes: { color: theme.succes, fontWeight: '600', marginTop: 12 },
  bandeau: { marginTop: 14, padding: 16, paddingLeft: 18, borderRadius: 20, borderLeftWidth: 4 },
  bandeauAccepte: { backgroundColor: '#FDF3DC', borderLeftColor: '#F2B233' },
  bandeauRefuse: { backgroundColor: '#FBE9E7', borderLeftColor: '#C8312B' },
  bandeauPrete: { backgroundColor: '#E3F4EC', borderLeftColor: '#1F6F43' },
  bandeauTitre: { fontSize: 16, fontWeight: '700', color: theme.texte },
  bandeauTexte: { fontSize: 14, color: theme.secondaire, marginTop: 2 },
  decision: { marginTop: 24 },
  etiquette: { marginTop: 14 },
  notes: { marginTop: 10, padding: 12, borderRadius: 14, backgroundColor: theme.fond },
  notesTitre: { fontSize: 13, fontWeight: '700', color: theme.secondaire },
  notesTexte: { fontSize: 15, color: theme.texte, marginTop: 4 },
  separateur: { height: 1, backgroundColor: theme.bordure, marginVertical: 6 },
});
