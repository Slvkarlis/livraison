import { Carte, MessageErreur, useTheme } from '@fleetpulse/shared';
import { Text, View } from 'react-native';
import { InterrupteurPartenaire } from './InterrupteurPartenaire';
import { usePreferencesPartenaire } from './PreferencesPartenaire';

export function ReglagesAlertes() {
  const t = useTheme(), { preferences, pret, enregistrement, erreur, modifier } = usePreferencesPartenaire();
  return <Carte style={{ gap: 16 }}><Text accessibilityRole="header" style={{ color: t.texte, fontSize: 20, fontWeight: '800' }}>Confort de travail</Text>
    {([{ cle: 'son', titre: 'Son des nouvelles commandes', aide: 'Respecte le mode silencieux du téléphone.' }, { cle: 'mouvementReduit', titre: 'Animations réduites', aide: 'Le réglage du système reste prioritaire.' }] as const).map(reglage => <View key={reglage.cle} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 56, gap: 12 }}><View style={{ flex: 1 }}><Text style={{ color: t.texte, fontSize: 16, fontWeight: '600' }}>{reglage.titre}</Text><Text style={{ color: t.texte, fontSize: 13, lineHeight: 19, marginTop: 4 }}>{reglage.aide}</Text></View><InterrupteurPartenaire libelle={reglage.titre} valeur={preferences[reglage.cle]} desactive={!pret || enregistrement} onChanger={valeur => void modifier({ [reglage.cle]: valeur })} /></View>)}
    <MessageErreur message={erreur} />
  </Carte>;
}
