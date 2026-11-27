import Ionicons from '@expo/vector-icons/Ionicons';
import {
  Bouton,
  Chargement,
  FriseTrajet,
  Ligne,
  MessageErreur,
  PastilleStatut,
  PanneauNotation,
  STATUTS_PAIEMENT,
  api,
  formatCreneau,
  formatDistance,
  formatHeure,
  formatJour,
  formatMontant,
  libelleEtapeClient,
  messageArrivee,
  messageDecisionClient,
  messagePromesse,
  peutAnnuler,
  peutValiderRemise,
  STATUTS_SUIVIS,
  useEvenementsCommandes,
  type HistoriqueEntree,
  type Livraison,
} from '@fleetpulse/shared';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AnnulationCommande } from './AnnulationCommande';
import { CarteSuivi } from './suivi/CarteSuivi';
import { useCarteSuivi } from './suivi/useCarteSuivi';
import { FriseHistorique } from './FriseHistorique';
import { ReclamationClient } from './ReclamationClient';
import { useSuiviLivraison } from './suivi/useSuiviLivraison';
import { theme } from '../theme';
import * as Linking from 'expo-linking';

/** Libelle de la frise selon l'etape reelle (plus de « En route » une fois le livreur arrive). */
function libelleFrise(statut: Livraison['statut'], arrive: boolean): string {
  if (statut === 'LIVREE') return 'Livrée';
  if (arrive) return 'Livreur arrivé';
  if (statut === 'A_PROXIMITE') return 'Arrive bientôt';
  if (statut === 'RECUPEREE' || statut === 'EN_COURS') return 'En route';
  if (statut === 'AFFECTEE') return 'Vers le commerce';
  if (statut === 'PRETE') return 'Prête';
  return 'En préparation';
}

/** Avance du livreur sur la frise : distance reelle parcourue une fois le colis a bord. */
function progressionFrise(statut: Livraison['statut'], arrive: boolean, resteKm: number | null, totalKm: number | null): number {
  if (statut === 'LIVREE' || arrive) return 1;
  if (resteKm != null && totalKm) return Math.min(0.97, 0.3 + 0.7 * (1 - resteKm / totalKm));
  return ({ PRETE: 0.08, AFFECTEE: 0.15, RECUPEREE: 0.3, EN_COURS: 0.55, A_PROXIMITE: 0.85, ARRIVEE: 1 } as Record<string, number>)[statut] ?? 0.05;
}

export default function DetailCommande() {
  const { id, message } = useLocalSearchParams<{ id: string; message?: string }>();
  const [livraison, setLivraison] = useState<Livraison | null>(null);
  const [etapes, setEtapes] = useState<HistoriqueEntree[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [rafraichissement, setRafraichissement] = useState(false);
  const avis = message ?? null;
  // US-302 / US-303 : coursier sur la carte (colis a bord) et heure d'arrivee estimee
  const { suivi, maintenant } = useSuiviLivraison(livraison?.id ?? null, livraison?.statut ?? null);
  // Carte de suivi type GPS : livreur anime, chemin parcouru et itineraire restant jusqu'a la maison
  const { etat: etatCarte, resteKm, resteMin, totalKm } = useCarteSuivi(livraison, suivi);
  // Livreur a moins de 50 m par la route : arrive, meme si le statut serveur dit encore « a proximite ».
  const arrive = livraison?.statut === 'ARRIVEE' || (!!etatCarte?.livreur && etatCarte.phase === 'livraison' && resteKm != null && resteKm < 0.05);

  // Rechargee a chaque retour sur l'ecran, en tirant vers le bas et a chaque evenement temps reel de cette commande
  const charger = useCallback(async () => {
    try {
      const trouvee = (await api.mesLivraisons()).find((l) => String(l.id) === id);
      if (!trouvee) { setErreur('Commande introuvable.'); return; }
      setLivraison(trouvee);
      if (trouvee.modePaiement === 'CARTE' && trouvee.statutPaiement === 'EN_ATTENTE') setLivraison(await api.confirmerCarteQuartier(trouvee.id));
      setEtapes(trouvee.partenaireId ? await api.historiqueCommande(trouvee.id) : []);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Chargement impossible.');
    }
  }, [id]);

  useFocusEffect(useCallback(() => { void charger(); }, [charger]));
  useEvenementsCommandes((e) => { if (String(e.commandeId) === id) void charger(); });

  async function rafraichir() {
    setRafraichissement(true);
    await charger();
    setRafraichissement(false);
  }

  if (erreur) return <View style={styles.erreur}><MessageErreur message={erreur} /></View>;
  if (!livraison) return <Chargement />;

  const creee = new Date(livraison.dateCreation);
  const immediate = livraison.typeLivraison === 'IMMEDIATE';
  const statutPaiement = STATUTS_PAIEMENT[livraison.statutPaiement ?? 'A_LA_LIVRAISON'];

  return (
    <ScrollView
      style={styles.page}
      refreshControl={<RefreshControl refreshing={rafraichissement} onRefresh={rafraichir} tintColor={theme.accent} />}
    >
      <View>
        <CarteSuivi etat={etatCarte} style={styles.carteGeo} />
        {etatCarte?.livreur && resteKm != null ? (
          <View style={styles.bulle} pointerEvents="none">
            <View style={styles.bulleIcone}><Ionicons name="bicycle" size={20} color="#15171A" /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.bulleTitre} numberOfLines={1}>
                {etatCarte.phase === 'collecte' ? `${etatCarte.initiale} va chercher votre commande` : arrive ? `${etatCarte.initiale} est arrivé` : `${etatCarte.initiale} arrive chez vous`}
              </Text>
              <Text style={styles.bulleTexte}>{resteKm < 0.05 ? 'Votre livreur est devant chez vous'
                : `${resteKm < 1 ? `${Math.round(resteKm * 100) * 10} m` : `${resteKm.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km`} par la route · ≈ ${resteMin} min`}</Text>
            </View>
          </View>
        ) : etatCarte && etatCarte.phase === 'preparation' && livraison.statut !== 'LIVREE' ? (
          <View style={styles.bulle} pointerEvents="none">
            <View style={styles.bulleIcone}><Ionicons name="storefront-outline" size={18} color="#15171A" /></View>
            <Text style={[styles.bulleTitre, { flex: 1 }]}>Trajet prévu du commerce jusqu’à chez vous</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.feuille}>
        <View style={styles.encoche}><View style={styles.poignee} /></View>
        <PastilleStatut statut={livraison.statut} />
        {livraison.modePaiement === 'CARTE' && livraison.statutPaiement === 'EN_ATTENTE' && livraison.urlPaiementCarte ? <View style={{ gap: 8 }}>
          <Text style={{ color: '#5B21B6' }}>Autorisation carte en attente. Le débit attend le prix final du groupe.</Text>
          <Bouton titre="Ouvrir le paiement carte" onPress={() => { void Linking.openURL(livraison.urlPaiementCarte!).catch(e => setErreur(e.message)); }} />
          <Bouton titre="Vérifier mon paiement" variante="secondaire" onPress={() => void charger()} />
        </View> : null}
        {livraison.groupeQuartierId ? <View style={{ backgroundColor: '#EDE9FE', padding: 14, borderRadius: 16, gap: 5 }}>
          <Text style={{ color: '#5B21B6', fontWeight: '800' }}>Livraison de quartier</Text>
          <Text style={{ color: '#5B21B6' }}>{(livraison.voisinsQuartier ?? 0) > 0
            ? `${livraison.statut === 'LIVREE' ? 'Livré' : 'Livraison prévue'} avec ${livraison.voisinsQuartier} voisin${livraison.voisinsQuartier === 1 ? '' : 's'}`
            : livraison.expirationQuartier && Date.parse(livraison.expirationQuartier) <= maintenant.getTime()
              ? 'La fenêtre est terminée. Votre commande part individuellement.' : 'Vos voisins peuvent rejoindre la commande pendant la fenêtre de quartier.'}</Text>
          <Text style={{ color: '#5B21B6' }}>Livraison : {formatMontant(livraison.fraisLivraison)} · prix garanti au maximum {formatMontant(livraison.fraisAnnoncesQuartier ?? livraison.fraisLivraison)}</Text>
        </View> : null}
        {STATUTS_SUIVIS.includes(livraison.statut) || livraison.statut === 'LIVREE' ? (
          <View style={styles.trajet}>
            <FriseTrajet depart={formatHeure(new Date(livraison.creneauDebut))} arrivee={formatHeure(new Date(livraison.creneauFin))}
              duree={libelleFrise(livraison.statut, arrive)} de={livraison.nomPartenaire ?? 'Départ'}
              vers="Chez vous" distance={livraison.distanceKm ? formatDistance(livraison.distanceKm) : livraison.codeSuivi}
              progression={progressionFrise(livraison.statut, arrive, etatCarte?.phase === 'livraison' ? resteKm : null, totalKm)}
              icone={<Ionicons name="bicycle" size={16} color="#15171A" />} />
          </View>
        ) : null}
        {suivi?.arriveeEstimee ? (
          <View style={styles.eta}>
            <Ionicons name="time-outline" size={18} color={theme.accent} />
            <Text style={styles.etaTexte}>{arrive ? 'Votre livreur est arrivé' : messageArrivee(suivi.arriveeEstimee, maintenant)}</Text>
          </View>
        ) : null}
        {suivi?.promesseLivraison && STATUTS_SUIVIS.includes(livraison.statut) ? (
          <Text style={styles.promesse}>{messagePromesse(suivi.promesseLivraison)}</Text>
        ) : null}
        <Text style={styles.adresse}>{livraison.adresse}</Text>
        <Text style={styles.code}>Commande {livraison.codeSuivi}</Text>
        {livraison.nomPartenaire ? <View style={styles.bloc}>
          <Text style={styles.section}>{livraison.nomPartenaire}</Text>
          {livraison.lignes.map(l => <Ligne key={l.produitId} libelle={l.quantite + ' × ' + l.nomProduit + ' · ' + formatMontant(l.prixUnitaire)} valeur={formatMontant(l.sousTotal)} />)}
          <Ligne libelle="Articles" valeur={formatMontant(livraison.montantArticles ?? 0)} />
          {livraison.notes ? <Text style={styles.momentTexte}>{livraison.notes}</Text> : null}
        </View> : null}

        {!livraison.partenaireId ? <View style={styles.moment}>
          <View style={[styles.icone, immediate && { backgroundColor: '#FEF3C7' }]}>
            <Ionicons name={immediate ? 'flash' : 'calendar'} size={20} color={immediate ? '#B45309' : theme.accent} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.momentTitre}>{immediate ? 'Livraison immédiate' : 'Créneau planifié'}</Text>
            <Text style={styles.momentTexte}>{formatCreneau(livraison.creneauDebut, livraison.creneauFin)}</Text>
          </View>
        </View> : messageDecisionClient(livraison) ? <Text style={styles.momentTexte}>{messageDecisionClient(livraison)}</Text> : null}
        {livraison.statut === 'ANNULEE' && livraison.motifAnnulation ? (
          <Text style={styles.momentTexte}>Motif : {livraison.motifAnnulation}</Text>
        ) : null}
        {peutValiderRemise(livraison.statut) ? (
          <View style={styles.remise}>
            <Bouton titre="Afficher mon QR de remise" onPress={() => router.push(`/commande/remise/${livraison.id}`)}
              icone={<Ionicons name="qr-code-outline" size={20} color={theme.surAccent} />} />
          </View>
        ) : null}
        {livraison.partenaireId && peutAnnuler(livraison.statut) ? (
          <AnnulationCommande key={livraison.statut} commandeId={livraison.id} onAnnulee={() => void charger()} />
        ) : null}

        {livraison.statut === 'LIVREE' ? <PanneauNotation commandeId={livraison.id} /> : null}
        {livraison.statut === 'LIVREE' ? <ReclamationClient commandeId={livraison.id} totalDt={livraison.montantTotal} onEnvoyee={() => {}} /> : null}
        {etapes.length ? (
          <>
            <Text style={styles.section}>Suivi</Text>
            <FriseHistorique etapes={etapes} libelle={libelleEtapeClient} auteurs={false} />
          </>
        ) : null}

        <Text style={styles.section}>Paiement</Text>
        <View style={styles.bloc}>
          <Ligne
            libelle={`Livraison${livraison.distanceKm ? ` (${formatDistance(livraison.distanceKm)})` : ''}`}
            valeur={formatMontant(livraison.partenaireId ? livraison.fraisLivraison : livraison.fraisLivraison || livraison.montantTotal)}
          />
          {livraison.supplementImmediat > 0 ? (
            <Ligne libelle="Supplément immédiat" valeur={`+${formatMontant(livraison.supplementImmediat)}`} />
          ) : null}
          <View style={styles.separateur} />
          <Ligne libelle="Total" valeur={formatMontant(livraison.montantTotal)} fort />
          <View style={styles.statutPaiement}>
            <Ionicons
              name="cash"
              size={16}
              color={statutPaiement.couleur}
            />
            <Text style={[styles.statutPaiementTexte, { color: statutPaiement.couleur }]}>
              {statutPaiement.libelle}
            </Text>
          </View>
        </View>

        {avis ? <View style={styles.avis}><MessageErreur message={avis} /></View> : null}

        <Text style={styles.creee}>Commandée {formatJour(creee).toLowerCase()} à {formatHeure(creee)}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.surface },
  erreur: { flex: 1, padding: 20, paddingTop: 120, backgroundColor: theme.fond },
  carteGeo: { height: 380 },
  bulle: { position: 'absolute', bottom: 46, left: 14, right: 70, flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, paddingHorizontal: 14, borderRadius: 18, backgroundColor: 'rgba(21,23,26,0.92)',
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  bulleIcone: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center' },
  bulleTitre: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  bulleTexte: { color: '#F2C66D', fontSize: 13, fontWeight: '700', marginTop: 2 },
  feuille: {
    backgroundColor: theme.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -28,
    padding: 24,
    paddingTop: 26,
    gap: 6,
  },
  encoche: { position: 'absolute', top: -16, alignSelf: 'center', width: 140, height: 34, borderTopLeftRadius: 70, borderTopRightRadius: 70, backgroundColor: theme.surface, alignItems: 'center', paddingTop: 10 },
  poignee: { width: 36, height: 4, borderRadius: 2, backgroundColor: theme.bordure },
  trajet: { backgroundColor: '#1B1C1F', borderRadius: 24, padding: 18, marginVertical: 10 },
  remise: { marginTop: 14 },
  eta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  etaTexte: { fontSize: 15, fontWeight: '700', color: theme.texte },
  promesse: { fontSize: 13, color: theme.secondaire, marginTop: 4 },
  adresse: { fontSize: 22, fontWeight: '800', color: theme.texte, letterSpacing: -0.4, marginTop: 10 },
  code: { fontSize: 13, color: theme.secondaire },
  moment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.fond,
    borderRadius: 18,
    padding: 14,
    marginTop: 18,
  },
  icone: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: theme.accentDoux,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1 },
  momentTitre: { fontSize: 15, fontWeight: '600', color: theme.texte },
  momentTexte: { fontSize: 14, color: theme.secondaire, marginTop: 2 },
  section: { fontSize: 17, fontWeight: '700', color: theme.texte, marginTop: 22, marginBottom: 4 },
  bloc: { backgroundColor: theme.fond, borderRadius: 18, padding: 14 },
  separateur: { height: 1, backgroundColor: theme.bordure, marginVertical: 6 },
  statutPaiement: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  statutPaiementTexte: { fontSize: 14, fontWeight: '600' },
  avis: { marginTop: 14 },
  creee: { fontSize: 13, color: theme.secondaire, textAlign: 'center', marginTop: 20 },
});
