import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { theme } from '../../theme';
import { pageSuivi, type MessageSuivi } from './carteSuiviPage';
import { BoutonRecentrer, VoileSuivi, styles, type CarteSuiviProps } from './carteSuiviCommun';

/** Suivi du livreur par le client : MapLibre dans une WebView (Expo Go, sans cle API). Navigateur : CarteSuivi.web.tsx. */
export function CarteSuivi({ etat, style }: CarteSuiviProps) {
  const vue = useRef<WebView>(null);
  const [statut, setStatut] = useState<'chargement' | 'pret' | 'erreur'>('chargement');
  const [libre, setLibre] = useState(false);
  const html = useMemo(() => pageSuivi(theme.accent), []);
  const executer = (code: string) => vue.current?.injectJavaScript(`${code}; true;`);

  useEffect(() => {
    if (statut === 'pret' && etat) executer(`window.majSuivi(${JSON.stringify(etat)})`);
  }, [etat, statut]);

  function surMessage(event: WebViewMessageEvent) {
    let message: MessageSuivi;
    try { message = JSON.parse(event.nativeEvent.data) as MessageSuivi; } catch { return; }
    if (message.type === 'pret') setStatut('pret');
    else if (message.type === 'erreur') setStatut('erreur');
    else setLibre(message.type === 'libre');
  }

  return (
    <View style={[styles.conteneur, style]}>
      <WebView ref={vue} source={{ html, baseUrl: 'https://fleetpulse.app/' }} originWhitelist={['*']} onMessage={surMessage}
        onError={() => setStatut('erreur')} javaScriptEnabled scrollEnabled={false} overScrollMode="never" bounces={false}
        setSupportMultipleWindows={false} nestedScrollEnabled style={styles.carte} />
      <BoutonRecentrer visible={libre} onPress={() => executer('window.recentrer()')} />
      <VoileSuivi statut={statut} />
    </View>
  );
}
