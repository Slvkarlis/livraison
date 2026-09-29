import Ionicons from '@expo/vector-icons/Ionicons';
import {
  Bouton,
  Ligne,
  MODES_PAIEMENT,
  MessageErreur,
  api,
  formatDistance,
  formatHeure,
  formatJour,
  formatMontant,
  type Devis,
  type TypeLivraison,
} from '@fleetpulse/shared';
import { router } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAdresseChoisie } from '../brouillon';
import { theme } from '../theme';

type Creneau = { debut: Date; fin: Date };

const DUREE_CRENEAU_H = 2;
const PREMIERE_HEURE = 8;
const DERNIERE_HEURE_DEBUT = 20;

/** Prochains creneaux de 2 h entre 8 h et 22 h, au plus tot a l'heure pleine suivante. */
function prochainsCreneaux(nombre = 6): Creneau[] {
  const creneaux: Creneau[] = [];
  const debut = new Date();
  debut.setMinutes(0, 0, 0);
  debut.setHours(debut.getHours() + 1);
  while (creneaux.length < nombre) {
    const heure = debut.getHours();
    if (heure >= PREMIERE_HEURE && heure <= DERNIERE_HEURE_DEBUT) {
      const fin = new Date(debut);
      fin.setHours(fin.getHours() + DUREE_CRENEAU_H);
      creneaux.push({ debut: new Date(debut), fin });
      debut.setHours(debut.getHours() + DUREE_CRENEAU_H);
    } else {
      debut.setHours(debut.getHours() + 1);
    }
  }
  return creneaux;
}

// US-05 (adresse + GPS) et US-06 (moment, paiement, prix calcule par le systeme)
export default function NouvelleCommande() {
  const insets = useSafeAreaInsets();
  const adresse = useAdresseChoisie();
  const creneaux = useMemo(() => prochainsCreneaux(), []);
  const [type, setType] = useState<TypeLivraison | null>(null);
  const [creneau, setCreneau] = useState<Creneau | null>(null);
  const [resultatDevis, setResultatDevis] =
    useState<{ cle: string; devis: Devis | null; erreur: string | null } | null>(null);
  const [confirmation, setConfirmation] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // Un seul devis "immediat" donne a la fois le tarif normal et le supplement.
  const cleDevis = adresse ? `${adresse.latitude},${adresse.longitude}` : null;
  useEffect(() => {
    if (!adresse || !cleDevis) return;
    let actif = true;
    api.devis({ latitude: adresse.latitude, longitude: adresse.longitude, typeLivraison: 'IMMEDIATE' })
      .then((d) => { if (actif) setResultatDevis({ cle: cleDevis, devis: d, erreur: null }); })
      .catch((e) => {
        if (actif) setResultatDevis({
          cle: cleDevis, devis: null, erreur: e instanceof Error ? e.message : 'Prix indisponible.',
        });
      });
    return () => { actif = false; };
  }, [adresse, cleDevis]);
  const devisAJour = resultatDevis !== null && resultatDevis.cle === cleDevis;
  const devis = devisAJour ? resultatDevis.devis : null;
  const erreurDevis = devisAJour ? resultatDevis.erreur : null;
  const calcul = cleDevis !== null && !devisAJour;

  const supplement = type === 'IMMEDIATE' && devis ? devis.supplementImmediat : 0;
  const total = devis ? devis.fraisLivraison + supplement : null;

  const verifications = [
    { libelle: 'Adresse de livraison', ok: adresse !== null },
    { libelle: 'Moment de livraison', ok: type === 'IMMEDIATE' || (type === 'PLANIFIEE' && creneau !== null) },
    { libelle: 'Prix calculé', ok: devis !== null },
  ];
  const pret = verifications.every((v) => v.ok);

  const libelleMoment = type === 'IMMEDIATE'
    ? `Maintenant · livreur sous ${devis?.delaiImmediatMinutes ?? 60} min`
    : creneau ? `${formatJour(creneau.debut)}, ${formatHeure(creneau.debut)} – ${formatHeure(creneau.fin)}` : '';

  async function commander() {
    if (!adresse || !type) return;
    setErreur(null);
    setEnvoi(true);
    try {
      const livraison = await api.creerLivraison({
        adresse: adresse.adresse,
        latitude: adresse.latitude,
        longitude: adresse.longitude,
        typeLivraison: type,
        creneauDebut: type === 'PLANIFIEE' ? creneau?.debut.toISOString() : undefined,
        creneauFin: type === 'PLANIFIEE' ? creneau?.fin.toISOString() : undefined,
        modePaiement: 'COD',
      });
      setConfirmation(false);
      router.replace(`/commande/${livraison.id}`);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Commande impossible.');
      setEnvoi(false);
    }
  }

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.contenu}>
        <Section numero={1} titre="Adresse de livraison">
          <Pressable onPress={() => router.push('/choisir-adresse')} style={styles.adresse}>
            <View style={styles.pastilleIcone}>
              <Ionicons name="location" size={20} color={theme.accent} />
            </View>
            <View style={styles.flex}>
              {adresse ? (
                <>
                  <Text style={styles.adresseTexte} numberOfLines={2}>{adresse.adresse}</Text>
                  <Text style={styles.adresseSous}>
                    {devis ? `${formatDistance(devis.distanceKm)} du dépôt · ` : ''}Modifier sur la carte
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.adresseTexte}>Choisir sur la carte</Text>
                  <Text style={styles.adresseSous}>Placez le repère sur votre porte</Text>
                </>
              )}
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.secondaire} />
          </Pressable>
        </Section>

        <Section numero={2} titre="Quand ?">
          <OptionMoment
            actif={type === 'IMMEDIATE'}
            icone="flash"
            couleurIcone="#B45309"
            fondIcone="#FEF3C7"
            titre="Maintenant"
            texte={`Un livreur part sous ${devis?.delaiImmediatMinutes ?? 60} min`}
            prix={devis ? `+${formatMontant(devis.supplementImmediat)}` : '+50 %'}
            onPress={() => setType('IMMEDIATE')}
          />
          <OptionMoment
            actif={type === 'PLANIFIEE'}
            icone="calendar"
            couleurIcone={theme.accent}
            fondIcone={theme.accentDoux}
            titre="Planifier un créneau"
            texte="Livreur garanti · tarif normal"
            prix="Sans supplément"
            onPress={() => setType('PLANIFIEE')}
          />
          {type === 'PLANIFIEE' ? (
            <>
              <View style={styles.info}>
                <Ionicons name="shield-checkmark" size={18} color={theme.succes} />
                <Text style={styles.infoTexte}>
                  Chaque créneau a toujours un livreur réservé : vous payez le tarif normal, sans supplément.
                </Text>
              </View>
              <View style={styles.creneaux}>
                {creneaux.map((c) => {
                  const choisi = creneau?.debut.getTime() === c.debut.getTime();
                  return (
                    <Pressable
                      key={c.debut.toISOString()}
                      onPress={() => setCreneau(c)}
                      style={[styles.creneau, choisi && styles.creneauChoisi]}
                    >
                      <Text style={[styles.creneauJour, choisi && styles.texteAccent]}>{formatJour(c.debut)}</Text>
                      <Text style={[styles.creneauHeure, choisi && styles.texteAccent]}>
                        {formatHeure(c.debut)} – {formatHeure(c.fin)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}
        </Section>

        <Section numero={3} titre="Paiement">
          <View style={[styles.option, styles.optionActive]}>
            <View style={styles.pastilleIcone}>
              <Ionicons name="cash" size={20} color={theme.accent} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.optionTitre}>{MODES_PAIEMENT.COD}</Text>
              <Text style={styles.optionTexte}>En espèces, remis au livreur</Text>
            </View>
            <Ionicons name="checkmark-circle" size={22} color={theme.accent} />
          </View>
        </Section>

        <Section numero={4} titre="Prix">
          <View style={styles.carte}>
            {!adresse ? (
              <Text style={styles.optionTexte}>Le prix est calculé automatiquement selon la distance depuis notre dépôt.</Text>
            ) : calcul ? (
              <ActivityIndicator color={theme.accent} />
            ) : erreurDevis ? (
              <MessageErreur message={erreurDevis} />
            ) : devis ? (
              <>
                <Ligne libelle={`Livraison (${formatDistance(devis.distanceKm)})`} valeur={formatMontant(devis.fraisLivraison)} />
                {type === 'IMMEDIATE' ? (
                  <Ligne libelle="Supplément immédiat" valeur={`+${formatMontant(devis.supplementImmediat)}`} />
                ) : null}
                <View style={styles.separateur} />
                <Ligne libelle="Total à payer" valeur={formatMontant(total ?? 0)} fort />
              </>
            ) : null}
          </View>
        </Section>

        <View style={styles.carte}>
          <Text style={styles.verifTitre}>Avant de commander</Text>
          {verifications.map((v) => (
            <View key={v.libelle} style={styles.verif}>
              <Ionicons
                name={v.ok ? 'checkmark-circle' : 'ellipse-outline'}
                size={22}
                color={v.ok ? theme.succes : theme.bordure}
              />
              <Text style={[styles.verifTexte, v.ok && styles.verifOk]}>{v.libelle}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={[styles.barre, { paddingBottom: insets.bottom + 12 }]}>
        <View>
          <Text style={styles.barreLibelle}>Total</Text>
          <Text style={styles.barreTotal}>{total != null ? formatMontant(total) : '—'}</Text>
        </View>
        <Bouton
          titre={pret ? 'Vérifier la commande' : 'Complétez les étapes'}
          onPress={() => setConfirmation(true)}
          desactive={!pret}
          style={styles.flex}
        />
      </View>

      <Modal visible={confirmation} transparent animationType="slide" onRequestClose={() => setConfirmation(false)}>
        <Pressable style={styles.voile} onPress={() => !envoi && setConfirmation(false)} />
        <View style={[styles.feuille, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.poignee} />
          <Text style={styles.feuilleTitre}>Tout est prêt ?</Text>
          <Text style={styles.optionTexte}>Vérifiez votre commande avant de la confirmer.</Text>
          <View style={styles.recap}>
            <Recap icone="location" texte={adresse?.adresse ?? ''} />
            <Recap icone={type === 'IMMEDIATE' ? 'flash' : 'calendar'} texte={libelleMoment} />
            <Recap icone="cash" texte={`${MODES_PAIEMENT.COD} · ${total != null ? formatMontant(total) : ''}`} />
          </View>
          <MessageErreur message={erreur} />
          <Bouton
            titre={`Confirmer · ${total != null ? formatMontant(total) : ''}`}
            onPress={commander}
            chargement={envoi}
          />
          <Bouton titre="Modifier" variante="discret" onPress={() => setConfirmation(false)} desactive={envoi} />
        </View>
      </Modal>
    </View>
  );
}

function Section({ numero, titre, children }: { numero: number; titre: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionEntete}>
        <Text style={styles.sectionNumero}>{numero}</Text>
        <Text style={styles.sectionTitre}>{titre}</Text>
      </View>
      {children}
    </View>
  );
}

function OptionMoment(props: {
  actif: boolean;
  icone: 'flash' | 'calendar';
  couleurIcone: string;
  fondIcone: string;
  titre: string;
  texte: string;
  prix: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: props.actif }}
      onPress={props.onPress}
      style={[styles.option, props.actif && styles.optionActive]}
    >
      <View style={[styles.pastilleIcone, { backgroundColor: props.fondIcone }]}>
        <Ionicons name={props.icone} size={20} color={props.couleurIcone} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.optionTitre}>{props.titre}</Text>
        <Text style={styles.optionTexte}>{props.texte}</Text>
      </View>
      <Text style={styles.optionPrix}>{props.prix}</Text>
    </Pressable>
  );
}

function Recap({ icone, texte }: { icone: 'location' | 'flash' | 'calendar' | 'cash'; texte: string }) {
  return (
    <View style={styles.recapLigne}>
      <Ionicons name={icone} size={18} color={theme.accent} />
      <Text style={styles.recapTexte}>{texte}</Text>
    </View>
  );
}

const ombre = {
  shadowColor: '#1E1B4B',
  shadowOpacity: 0.06,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 6 },
  elevation: 2,
} as const;

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.fond },
  contenu: { padding: 20, paddingBottom: 32 },
  flex: { flex: 1 },
  section: { marginBottom: 24 },
  sectionEntete: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  sectionNumero: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.accent,
    color: theme.surAccent,
    textAlign: 'center',
    lineHeight: 24,
    fontSize: 13,
    fontWeight: '700',
    overflow: 'hidden',
  },
  sectionTitre: { fontSize: 18, fontWeight: '700', color: theme.texte },
  carte: { backgroundColor: theme.surface, borderRadius: theme.rayon, padding: 16, ...ombre },
  adresse: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.surface,
    borderRadius: theme.rayon,
    padding: 16,
    ...ombre,
  },
  adresseTexte: { fontSize: 16, fontWeight: '600', color: theme.texte },
  adresseSous: { fontSize: 13, color: theme.accent, marginTop: 3, fontWeight: '500' },
  pastilleIcone: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: theme.accentDoux,
    alignItems: 'center',
    justifyContent: 'center',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.surface,
    borderRadius: theme.rayon,
    padding: 16,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
    ...ombre,
  },
  optionActive: { borderColor: theme.accent },
  optionTitre: { fontSize: 16, fontWeight: '600', color: theme.texte },
  optionTexte: { fontSize: 14, color: theme.secondaire, marginTop: 2, lineHeight: 20 },
  optionPrix: { fontSize: 14, fontWeight: '700', color: theme.texte },
  info: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#ECFDF3',
    borderRadius: 14,
    padding: 12,
    marginTop: 4,
    marginBottom: 12,
  },
  infoTexte: { flex: 1, fontSize: 14, color: '#166534', lineHeight: 20 },
  creneaux: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  creneau: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: theme.surface,
    borderWidth: 2,
    borderColor: 'transparent',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  creneauChoisi: { borderColor: theme.accent, backgroundColor: theme.accentDoux },
  creneauJour: { fontSize: 13, color: theme.secondaire },
  creneauHeure: { fontSize: 16, fontWeight: '700', color: theme.texte, marginTop: 2 },
  texteAccent: { color: theme.accent },
  separateur: { height: 1, backgroundColor: theme.bordure, marginVertical: 6 },
  verifTitre: { fontSize: 16, fontWeight: '700', color: theme.texte, marginBottom: 6 },
  verif: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  verifTexte: { fontSize: 15, color: theme.secondaire },
  verifOk: { color: theme.texte, fontWeight: '500' },
  barre: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: theme.surface,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.bordure,
  },
  barreLibelle: { fontSize: 13, color: theme.secondaire },
  barreTotal: { fontSize: 20, fontWeight: '800', color: theme.texte },
  voile: { flex: 1, backgroundColor: 'rgba(23,21,43,0.45)' },
  feuille: {
    backgroundColor: theme.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 12,
    gap: 4,
  },
  poignee: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: theme.bordure, marginBottom: 16 },
  feuilleTitre: { fontSize: 24, fontWeight: '800', color: theme.texte, letterSpacing: -0.5 },
  recap: { backgroundColor: theme.fond, borderRadius: 18, padding: 16, gap: 12, marginVertical: 16 },
  recapLigne: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  recapTexte: { flex: 1, fontSize: 15, color: theme.texte, lineHeight: 21 },
});
