import Ionicons from '@expo/vector-icons/Ionicons';
import {
  Bouton,
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
  type Livraison,
} from '@fleetpulse/shared';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { CarteLeaflet } from '../../composants/CarteLeaflet';
import { payerCommande } from '../../paiement';
import { theme } from '../../theme';

export default function DetailCommande() {
  const { id, message } = useLocalSearchParams<{ id: string; message?: string }>();
  const [livraison, setLivraison] = useState<Livraison | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [avis, setAvis] = useState<string | null>(message ?? null);
  const [paiement, setPaiement] = useState(false);

  useEffect(() => {
    api.mesLivraisons()
      .then((liste) => {
        const trouvee = liste.find((l) => String(l.id) === id);
        if (trouvee) setLivraison(trouvee);
        else setErreur('Commande introuvable.');
      })
      .catch((e) => setErreur(e instanceof Error ? e.message : 'Chargement impossible.'));
  }, [id]);

  if (erreur) return <View style={styles.erreur}><MessageErreur message={erreur} /></View>;
  if (!livraison) return <Chargement />;

  const position = { latitude: livraison.latitude, longitude: livraison.longitude };
  const creee = new Date(livraison.dateCreation);
  const immediate = livraison.typeLivraison === 'IMMEDIATE';
  const carte = livraison.modePaiement === 'CARTE';
  const statutPaiement = STATUTS_PAIEMENT[livraison.statutPaiement ?? 'A_LA_LIVRAISON'];
  const aPayer = carte && livraison.statutPaiement !== 'PAYE';

  async function payer() {
    if (!livraison) return;
    setPaiement(true);
    setAvis(null);
    const resultat = await payerCommande(livraison);
    if (resultat.etat === 'paye') setLivraison(resultat.livraison);
    else if (resultat.etat === 'erreur') setAvis(resultat.message);
    setPaiement(false);
  }

  return (
    <ScrollView style={styles.page} bounces={false}>
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
        </View> : <Text style={styles.momentTexte}>La commande attend la décision du partenaire. Aucun délai de livraison annoncé.</Text>}

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
              name={carte ? 'card' : 'cash'}
              size={16}
              color={statutPaiement.couleur}
            />
            <Text style={[styles.statutPaiementTexte, { color: statutPaiement.couleur }]}>
              {statutPaiement.libelle}
            </Text>
          </View>
        </View>

        {avis ? <View style={styles.avis}><MessageErreur message={avis} /></View> : null}
        {aPayer ? (
          <Bouton
            titre={`Payer maintenant · ${formatMontant(livraison.montantTotal)}`}
            onPress={payer}
            chargement={paiement}
            icone={<Ionicons name="card" size={18} color={theme.surAccent} />}
            style={styles.payer}
          />
        ) : null}

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
  payer: { marginTop: 14 },
  creee: { fontSize: 13, color: theme.secondaire, textAlign: 'center', marginTop: 20 },
});
