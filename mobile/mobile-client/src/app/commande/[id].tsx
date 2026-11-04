import Ionicons from '@expo/vector-icons/Ionicons';
import {
  Chargement,
  Ligne,
  MessageErreur,
  PastilleStatut,
  STATUTS_PAIEMENT,
  api,
  formatCreneau,
  formatDistance,
  formatHeure,
  formatJour,
  formatMontant,
  libelleEtapeClient,
  messageDecisionClient,
  type HistoriqueEntree,
  type Livraison,
} from '@fleetpulse/shared';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CarteLeaflet } from '../../composants/CarteLeaflet';
import { FriseHistorique } from '../../composants/FriseHistorique';
import { theme } from '../../theme';

export default function DetailCommande() {
  const { id, message } = useLocalSearchParams<{ id: string; message?: string }>();
  const [livraison, setLivraison] = useState<Livraison | null>(null);
  const [etapes, setEtapes] = useState<HistoriqueEntree[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [rafraichissement, setRafraichissement] = useState(false);
  const avis = message ?? null;

  // Rechargee a chaque retour sur l'ecran et en tirant vers le bas (le temps reel arrive a l'etape 5)
  const charger = useCallback(async () => {
    try {
      const trouvee = (await api.mesLivraisons()).find((l) => String(l.id) === id);
      if (!trouvee) { setErreur('Commande introuvable.'); return; }
      setLivraison(trouvee);
      setEtapes(trouvee.partenaireId ? await api.historiqueCommande(trouvee.id) : []);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Chargement impossible.');
    }
  }, [id]);

  useFocusEffect(useCallback(() => { void charger(); }, [charger]));

  async function rafraichir() {
    setRafraichissement(true);
    await charger();
    setRafraichissement(false);
  }

  if (erreur) return <View style={styles.erreur}><MessageErreur message={erreur} /></View>;
  if (!livraison) return <Chargement />;

  const position = { latitude: livraison.latitude, longitude: livraison.longitude };
  const creee = new Date(livraison.dateCreation);
  const immediate = livraison.typeLivraison === 'IMMEDIATE';
  const statutPaiement = STATUTS_PAIEMENT[livraison.statutPaiement ?? 'A_LA_LIVRAISON'];

  return (
    <ScrollView
      style={styles.page}
      refreshControl={<RefreshControl refreshing={rafraichissement} onRefresh={rafraichir} tintColor={theme.accent} />}
    >
      {/* Apercu fige : les gestes vont au defilement de la page, pas a la carte. */}
      <View pointerEvents="none">
        <CarteLeaflet style={styles.carteGeo} centre={position} zoom={16} interactive={false} marqueur />
      </View>

      <View style={styles.feuille}>
        <PastilleStatut statut={livraison.statut} />
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
  carteGeo: { height: 300 },
  feuille: {
    backgroundColor: theme.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -28,
    padding: 24,
    gap: 6,
  },
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
