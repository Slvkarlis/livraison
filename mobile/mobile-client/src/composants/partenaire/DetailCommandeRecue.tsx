import {
  Carte,
  Chargement,
  Ligne,
  MessageErreur,
  PastilleStatut,
  ROLES_ACTEUR,
  STATUTS,
  api,
  formatHeure,
  formatJour,
  formatMontant,
  libelleEtapePartenaire,
  libelleStatutPartenaire,
  type CommandeDetail,
} from '@fleetpulse/shared';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { theme } from '../../theme';

// US-2B1 : detail d'une commande recue (articles, notes, montants, historique des statuts)
export default function DetailCommandeRecue() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [commande, setCommande] = useState<CommandeDetail | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
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

  async function rafraichir() {
    setRafraichissement(true);
    await charger();
    setRafraichissement(false);
  }

  if (!commande) return erreur ? <View style={styles.erreur}><MessageErreur message={erreur} /></View> : <Chargement />;

  const recue = new Date(commande.dateCreation);
  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.contenu}
      refreshControl={<RefreshControl refreshing={rafraichissement} onRefresh={rafraichir} tintColor={theme.accent} />}
    >
      <MessageErreur message={erreur} />
      <PastilleStatut statut={commande.statut} libelle={libelleStatutPartenaire(commande.statut)} />
      <Text style={styles.client}>{commande.clientPrenom}</Text>
      <Text style={styles.meta}>
        Commande {commande.codeSuivi} · reçue {formatJour(recue).toLowerCase()} à {formatHeure(recue)}
      </Text>
      {commande.zoneNom ? <Text style={styles.meta}>Zone : {commande.zoneNom}</Text> : null}

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

      <Text style={styles.section}>Historique</Text>
      <Carte>
        {commande.historique.map((h, index) => {
          const date = new Date(h.date);
          const dernier = index === commande.historique.length - 1;
          return (
            <View key={`${h.date}-${index}`} style={styles.etape}>
              <View style={styles.repere}>
                <View style={[styles.point, { backgroundColor: STATUTS[h.nouveau].couleur }]} />
                {!dernier ? <View style={styles.trait} /> : null}
              </View>
              <View style={styles.etapeCorps}>
                <Text style={styles.etapeTitre}>{libelleEtapePartenaire(h)}</Text>
                <Text style={styles.etapeMeta}>
                  {formatJour(date)} à {formatHeure(date)} · {ROLES_ACTEUR[h.acteurRole]}
                </Text>
                {h.motif ? <Text style={styles.etapeMotif}>{h.motif}</Text> : null}
              </View>
            </View>
          );
        })}
      </Carte>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.fond },
  contenu: { padding: 20, paddingBottom: 48 },
  erreur: { flex: 1, padding: 20, backgroundColor: theme.fond },
  client: { fontSize: 24, fontWeight: '800', color: theme.texte, letterSpacing: -0.4, marginTop: 12 },
  meta: { fontSize: 14, color: theme.secondaire, marginTop: 4 },
  section: { fontSize: 17, fontWeight: '700', color: theme.texte, marginTop: 24, marginBottom: 8 },
  notes: { marginTop: 10, padding: 12, borderRadius: 14, backgroundColor: theme.fond },
  notesTitre: { fontSize: 13, fontWeight: '700', color: theme.secondaire },
  notesTexte: { fontSize: 15, color: theme.texte, marginTop: 4 },
  separateur: { height: 1, backgroundColor: theme.bordure, marginVertical: 6 },
  etape: { flexDirection: 'row', gap: 12 },
  repere: { alignItems: 'center', width: 14 },
  point: { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
  trait: { flex: 1, width: 2, backgroundColor: theme.bordure, marginVertical: 2 },
  etapeCorps: { flex: 1, paddingBottom: 14 },
  etapeTitre: { fontSize: 15, fontWeight: '600', color: theme.texte },
  etapeMeta: { fontSize: 13, color: theme.secondaire, marginTop: 2 },
  etapeMotif: { fontSize: 14, color: theme.texte, marginTop: 4 },
});
