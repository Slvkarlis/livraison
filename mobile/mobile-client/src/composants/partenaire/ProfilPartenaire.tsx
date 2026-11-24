import Ionicons from '@expo/vector-icons/Ionicons';
import { Bouton, Carte, Ligne, api, useAuth, useTheme } from '@fleetpulse/shared';
import { useCallback } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ErreurPartenaire, EtatPartenaire, SquelettePartenaire, useRessourcePartenaire } from './InterfacePartenaire';
import { PanneauBoutique } from './PanneauBoutique';
import { LANGUES_PARTENAIRE } from './PreferencesPartenaire';
import { ReglagesAlertes } from './ReglagesAlertes';

const JOURS: Record<number, string> = { 1: 'Lundi', 2: 'Mardi', 3: 'Mercredi', 4: 'Jeudi', 5: 'Vendredi', 6: 'Samedi', 7: 'Dimanche' };
export default function ProfilPartenaire() {
  const t = useTheme(), { profil, logout } = useAuth();
  const lire = useCallback(async () => ({ commerce: await api.commerce(), boutique: await api.boutique() }), []), r = useRessourcePartenaire(lire);
  const commerce = r.donnees?.commerce, horaires = r.donnees?.boutique.horaires;
  return <SafeAreaView style={{ flex: 1, backgroundColor: t.fond }} edges={['top']}><ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 18 }} refreshControl={<RefreshControl refreshing={r.chargement && !!r.donnees} onRefresh={() => void r.charger()} tintColor={t.texte} />}>
    <View><Text style={{ color: t.texte, fontSize: 12, fontWeight: '700', letterSpacing: 1 }}>VOTRE ESPACE</Text><Text accessibilityRole="header" style={{ color: t.texte, fontSize: 32, fontWeight: '800', marginTop: 6, letterSpacing: -0.8 }}>Mon commerce</Text></View>
    <ErreurPartenaire message={r.erreur} horsConnexion={r.horsConnexion} reessayer={() => void r.charger()} />
    {!commerce && r.chargement ? <SquelettePartenaire /> : commerce ? <Carte style={{ gap: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}><View style={{ width: 60, height: 60, borderRadius: 20, backgroundColor: t.accentDoux, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="storefront-outline" size={30} color={t.texte} /></View><View style={{ flex: 1 }}><Text style={{ color: t.texte, fontSize: 22, fontWeight: '800' }}>{commerce.nomCommerce}</Text><Text style={{ color: t.texte, fontSize: 14, marginTop: 4 }}>{commerce.categorie}</Text></View></View>
      <Ligne libelle="Adresse" valeur={commerce.adresse} /><Ligne libelle="Zone" valeur={commerce.zoneNom ?? 'Contactez votre responsable'} />
      <View style={{ borderTopWidth: 1, borderTopColor: t.bordure, paddingTop: 14, gap: 4 }}><Text style={{ color: t.texte, fontSize: 16, fontWeight: '700' }}>{profil?.prenom} {profil?.nom}</Text><Text style={{ color: t.texte, fontSize: 14 }}>{profil?.email}</Text>{profil?.telephone ? <Text style={{ color: t.texte, fontSize: 14 }}>{profil.telephone}</Text> : null}</View>
    </Carte> : null}
    <PanneauBoutique />
    <Carte style={{ gap: 12 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Ionicons name="time-outline" size={24} color={t.texte} /><Text accessibilityRole="header" style={{ color: t.texte, fontSize: 20, fontWeight: '800' }}>Horaires de service</Text></View>
      {horaires?.ouverture && horaires.fermeture && horaires.jours.length ? <><Text style={{ color: t.texte, fontSize: 24, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{horaires.ouverture.slice(0, 5)} – {horaires.fermeture.slice(0, 5)}</Text><Text style={{ color: t.texte, fontSize: 15, lineHeight: 23 }}>{horaires.jours.map(j => JOURS[j] ?? `Jour ${j}`).join(' · ')}</Text><Text style={{ color: t.texte, fontSize: 13 }}>Heure de Tunis. Pour modifier vos horaires, contactez votre responsable.</Text></> : <EtatPartenaire icone="time-outline" titre="Horaires non renseignés" texte="Votre responsable peut renseigner vos horaires de service." action={<Bouton titre="Actualiser les horaires" variante="secondaire" onPress={() => void r.charger()} />} />}
    </Carte>
    <ReglagesAlertes />
    <Carte style={{ gap: 12 }}><Text accessibilityRole="header" style={{ color: t.texte, fontSize: 20, fontWeight: '800' }}>Langue</Text><Ligne libelle="Langue de l’interface" valeur={LANGUES_PARTENAIRE.fr.libelle} /><Text style={{ color: t.texte, fontSize: 14 }}>Arabe · bientôt disponible</Text></Carte>
    <Bouton titre="Se déconnecter" variante="danger" onPress={() => void logout()} icone={<Ionicons name="log-out-outline" size={22} color={t.erreur} />} style={{ backgroundColor: t.surface }} />
  </ScrollView></SafeAreaView>;
}
