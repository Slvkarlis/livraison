import { Bouton, Carte, Champ, EntreeAnimee, api, formatMontant, jourTunis, useEvenementsCommandes, useMouvementReduit, useTheme, verifierPeriodeBi, type VentesPartenaire } from '@fleetpulse/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Line, Rect } from 'react-native-svg';
import { ErreurPartenaire, EtatPartenaire, POLICE_MONO, SquelettePartenaire, useRessourcePartenaire } from './InterfacePartenaire';
import { Puce } from './Puce';

type Selection = 1 | 7 | 30 | { debut: string; fin: string };
type JourVentes = { jour: string; montant: number };
function decaler(jour: string, jours: number) { const d = new Date(jour + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + jours); return d.toISOString().slice(0, 10); }
function periodeSelection(selection: Selection) { const fin = jourTunis(); return typeof selection === 'number' ? { debut: decaler(fin, 1 - selection), fin } : selection; }

/** Quatre lectures concurrentes au maximum ; le contrat fournit uniquement des agrégats par période. */
async function lireSerie(jours: string[]): Promise<JourVentes[]> {
  const resultats: JourVentes[] = [];
  for (let i = 0; i < jours.length; i += 4) {
    resultats.push(...await Promise.all(jours.slice(i, i + 4).map(async jour => ({ jour, montant: (await api.ventesPartenaire(jour, jour)).chiffreAffaires }))));
  }
  return resultats;
}
export default function EcranVentes() {
  const t = useTheme(), [selection, setSelection] = useState<Selection>(1), [dates, setDates] = useState(false);
  const [debut, setDebut] = useState(() => jourTunis()), [fin, setFin] = useState(() => jourTunis()), [erreurDates, setErreurDates] = useState<string | null>(null);
  const lire = useCallback(async () => {
    const periode = periodeSelection(selection), nombreJours = Math.round((Date.parse(periode.fin) - Date.parse(periode.debut)) / 86400000) + 1;
    const precedente = { debut: decaler(periode.debut, -nombreJours), fin: decaler(periode.debut, -1) };
    const jours = Math.min(30, nombreJours === 1 ? 7 : nombreJours);
    const [actuelles, precedentes, serie] = await Promise.all([api.ventesPartenaire(periode.debut, periode.fin), api.ventesPartenaire(precedente.debut, precedente.fin), lireSerie(Array.from({ length: jours }, (_, i) => decaler(periode.fin, i - jours + 1)))]);
    return { actuelles, precedentes, serie, periode, precedente };
  }, [selection]);
  const r = useRessourcePartenaire(lire, 120000), donnees = r.donnees;
  const rafraichir = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (rafraichir.current) clearTimeout(rafraichir.current); }, []);
  useEvenementsCommandes(() => { if (rafraichir.current) clearTimeout(rafraichir.current); rafraichir.current = setTimeout(() => { void r.charger(); }, 700); });
  return <SafeAreaView style={{ flex: 1, backgroundColor: t.fond }} edges={['top']}><ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 18 }} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={r.chargement && !!donnees} onRefresh={() => void r.charger()} tintColor={t.texte} />}>
    <View><Text style={{ color: t.texte, fontSize: 12, fontWeight: '700', letterSpacing: 1 }}>VOTRE ACTIVITÉ</Text><Text accessibilityRole="header" style={{ color: t.texte, fontSize: 32, fontWeight: '800', marginTop: 6, letterSpacing: -0.8 }}>Mes ventes</Text><Text style={{ color: t.texte, fontSize: 14, lineHeight: 20, marginTop: 8 }}>Articles livrés, hors frais et avant commission · heure de Tunis.</Text></View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{([1, 7, 30] as const).map(n => <Puce key={n} libelle={n === 1 ? 'Aujourd’hui' : `${n} jours`} actif={selection === n} onPress={() => { setSelection(n); setErreurDates(null); }} />)}</View>
    <ErreurPartenaire message={r.erreur ?? erreurDates} horsConnexion={r.horsConnexion} reessayer={() => { setErreurDates(null); void r.charger(); }} />
    {!donnees && r.chargement ? <SquelettePartenaire /> : donnees ? <>
      <Text accessibilityLiveRegion="polite" style={{ color: t.texte, fontSize: 13 }}>Du {donnees.periode.debut} au {donnees.periode.fin}{r.chargement ? ' · actualisation…' : ''}{r.erreur ? ' · derniers résultats conservés' : ''}</Text>
      <Carte style={{ backgroundColor: t.texte, gap: 10 }}><Text style={{ color: t.surface, fontSize: 14 }}>Chiffre d’affaires</Text><CompteurVentes valeur={donnees.actuelles.chiffreAffaires} /><Text style={{ color: t.surface, fontSize: 14 }}>{variation(donnees.actuelles.chiffreAffaires, donnees.precedentes.chiffreAffaires)} · {typeof selection === 'number' && selection === 1 ? 'par rapport à hier' : 'période précédente'}</Text></Carte>
      <View style={{ flexDirection: 'row', gap: 12 }}><Kpi titre="Commandes livrées" valeur={String(donnees.actuelles.commandes)} note={variation(donnees.actuelles.commandes, donnees.precedentes.commandes)} /><Kpi titre="Panier moyen" valeur={formatMontant(donnees.actuelles.commandes ? donnees.actuelles.chiffreAffaires / donnees.actuelles.commandes : 0)} note="hors livraison" /></View>
      {typeof selection === 'number' && selection === 1 ? <Text style={{ color: t.texte, fontSize: 13 }}>Aujourd’hui en cours ; hier sur la journée entière.</Text> : <Text style={{ color: t.texte, fontSize: 13 }}>Comparaison : du {donnees.precedente.debut} au {donnees.precedente.fin}.</Text>}
      <Carte style={{ gap: 14 }}><Text accessibilityRole="header" style={{ color: t.texte, fontSize: 20, fontWeight: '800' }}>Ventes par jour</Text><Text style={{ color: t.texte, fontSize: 13 }}>{donnees.serie.length} derniers jours{typeof selection === 'object' ? ' de la période' : ''} · montants en DT</Text><GraphiqueVentes serie={donnees.serie} /></Carte>
      {!donnees.actuelles.commandes ? <EtatPartenaire icone="bar-chart-outline" titre="Votre prochaine vente compte" texte="Aucune commande livrée sur cette période. Consultez votre catalogue pour préparer le prochain service." action={<Bouton titre="Afficher les 30 derniers jours" variante="secondaire" onPress={() => setSelection(30)} />} /> : null}
      <MeilleursProduits ventes={donnees.actuelles} />
    </> : null}
    <Bouton titre={dates ? 'Masquer les dates personnalisées' : 'Choisir des dates'} variante="secondaire" onPress={() => setDates(!dates)} />
    {dates ? <Carte style={{ gap: 12 }}><Champ libelle="Du (AAAA-MM-JJ)" value={debut} onChangeText={setDebut} maxLength={10} /><Champ libelle="Au inclus (AAAA-MM-JJ)" value={fin} onChangeText={setFin} maxLength={10} /><Bouton titre="Appliquer les dates" onPress={() => { const erreur = verifierPeriodeBi(debut, fin); setErreurDates(erreur); if (!erreur) setSelection({ debut, fin }); }} /></Carte> : null}
  </ScrollView></SafeAreaView>;
}
function variation(valeur: number, avant: number) { return avant === 0 ? valeur === 0 ? 'Aucune variation' : 'Premières ventes sur la période' : `${valeur >= avant ? '+' : '−'}${Math.abs((valeur - avant) / avant * 100).toLocaleString('fr-TN', { maximumFractionDigits: 1 })} %`; }
function Kpi({ titre, valeur, note }: { titre: string; valeur: string; note: string }) { const t = useTheme(); return <Carte style={{ flex: 1, gap: 10, padding: 14 }}><Text style={{ color: t.texte, fontSize: 13 }}>{titre}</Text><Text style={{ color: t.texte, fontSize: 20, fontFamily: POLICE_MONO, fontWeight: '800' }}>{valeur}</Text><Text style={{ color: t.texte, fontSize: 12 }}>{note}</Text></Carte>; }
function CompteurVentes({ valeur }: { valeur: number }) {
  const t = useTheme(), reduit = useMouvementReduit(), [nombre, setNombre] = useState(0), [compteur] = useState(() => new Animated.Value(0));
  useEffect(() => { if (reduit) return; const ecoute = compteur.addListener(e => setNombre(e.value)); compteur.setValue(0); const animation = Animated.timing(compteur, { toValue: valeur, duration: 420, useNativeDriver: false }); animation.start(); return () => { animation.stop(); compteur.removeListener(ecoute); }; }, [valeur, reduit, compteur]);
  return <Text accessibilityLabel={`Chiffre d’affaires ${formatMontant(valeur)}`} style={{ color: t.accent, fontSize: 34, fontWeight: '800', fontVariant: ['tabular-nums'], letterSpacing: -1 }}>{formatMontant(reduit ? valeur : nombre)}</Text>;
}
function GraphiqueVentes({ serie }: { serie: JourVentes[] }) {
  const t = useTheme(), largeur = 300, hauteur = 140, maximum = Math.max(1, ...serie.map(j => j.montant)), pas = largeur / serie.length;
  return <View style={{ gap: 10 }}><Text style={{ color: t.texte, fontSize: 12 }}>Maximum : {formatMontant(Math.max(...serie.map(j => j.montant), 0))}</Text><View accessible accessibilityLabel={serie.map(j => `${j.jour} : ${formatMontant(j.montant)}`).join('. ')}><Svg width="100%" height={hauteur} viewBox={`0 0 ${largeur} ${hauteur}`}><Line x1={0} x2={largeur} y1={hauteur - 1} y2={hauteur - 1} stroke={t.bordure} />{serie.map((j, i) => { const h = j.montant / maximum * (hauteur - 10); return <Rect key={j.jour} x={i * pas + 2} y={hauteur - h - 2} width={Math.max(2, pas - 4)} height={h} rx={Math.min(4, pas / 4)} fill={i === serie.length - 1 ? t.texte : t.accent} />; })}</Svg></View><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: t.texte, fontSize: 12 }}>{serie[0]?.jour.slice(5)}</Text><Text style={{ color: t.texte, fontSize: 12 }}>{serie.at(-1)?.jour.slice(5)}</Text></View><Text style={{ color: t.texte, fontSize: 12 }}>Dernière barre : dernier jour de la période.</Text></View>;
}
function MeilleursProduits({ ventes }: { ventes: VentesPartenaire }) {
  const t = useTheme();
  return <View style={{ gap: 12 }}><Text accessibilityRole="header" style={{ color: t.texte, fontSize: 22, fontWeight: '800' }}>Produits les plus vendus</Text>{ventes.meilleursProduits.length ? <Carte style={{ gap: 18 }}>{ventes.meilleursProduits.map((p, i) => <EntreeAnimee key={p.id} rang={i}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><Text style={{ color: t.texte, fontSize: 17, fontWeight: '800' }}>{String(i + 1).padStart(2, '0')}</Text><View style={{ flex: 1 }}><Text style={{ color: t.texte, fontSize: 16, fontWeight: '700' }}>{p.nom}</Text><Text style={{ color: t.texte, fontSize: 13, marginTop: 4 }}>{p.quantite} unités</Text></View><Text style={{ color: t.texte, fontFamily: POLICE_MONO, fontSize: 14 }}>{formatMontant(p.chiffreAffaires)}</Text></View></EntreeAnimee>)}</Carte> : <Text style={{ color: t.texte, fontSize: 15 }}>Aucun produit livré sur cette période.</Text>}</View>;
}
