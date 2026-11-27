import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { pageNavigation, type MessageNavigation } from './carteNavigationPage';
import { BoutonsCarte, VoileCarte, styles, type CarteNavigationProps } from './commun';

/**
 * Carte GPS du livreur (MapLibre + rues OpenStreetMap) dans une WebView : fonctionne dans Expo Go,
 * sans cle API. Version navigateur : CarteNavigation.web.tsx (meme page dans une iframe).
 */
export function CarteNavigation({ etat, style }: CarteNavigationProps) {
  const vue = useRef<WebView>(null);
  const [statut, setStatut] = useState<'chargement' | 'pret' | 'erreur'>('chargement');
  const [libre, setLibre] = useState(false);
  const html = useMemo(() => pageNavigation(), []);
  const executer = (code: string) => vue.current?.injectJavaScript(`${code}; true;`);

  useEffect(() => {
    if (statut === 'pret' && etat) executer(`window.majNavigation(${JSON.stringify(etat)})`);
  }, [etat, statut]);

  function surMessage(event: WebViewMessageEvent) {
    let message: MessageNavigation;
    try { message = JSON.parse(event.nativeEvent.data) as MessageNavigation; } catch { return; }
    if (message.type === 'pret') setStatut('pret');
    else if (message.type === 'erreur') setStatut('erreur');
    else setLibre(message.type === 'libre');
  }

  return (
    <View style={[styles.conteneur, style]}>
      <WebView
        ref={vue}
        // baseUrl : donne une origine aux requetes de tuiles (certains serveurs refusent sans Referer).
        source={{ html, baseUrl: 'https://fleetpulse.app/' }}
        originWhitelist={['*']}
        onMessage={surMessage}
        onError={() => setStatut('erreur')}
        javaScriptEnabled
        scrollEnabled={false}
        overScrollMode="never"
        bounces={false}
        setSupportMultipleWindows={false}
        style={styles.carte}
      />
      <BoutonsCarte libre={libre} onRecentrer={() => executer('window.recentrer()')} onEnsemble={() => executer('window.vueEnsemble()')} />
      <VoileCarte statut={statut} />
    </View>
  );
}
