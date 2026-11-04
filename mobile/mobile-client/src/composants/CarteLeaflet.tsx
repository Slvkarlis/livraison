import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { theme } from '../theme';
import { pageHtml, type CarteLeafletProps, type CarteLeafletRef, type MessageCarte } from './carteLeafletPage';

/**
 * Carte Leaflet + tuiles OpenStreetMap dans une WebView.
 * Pas de Google Maps : aucune cle API, fonctionne dans Expo Go et sur les telephones sans services Google.
 * Version navigateur : CarteLeaflet.web.tsx (meme page dans une iframe).
 */

export type { CarteLeafletRef, Point } from './carteLeafletPage';

export const CarteLeaflet = forwardRef<CarteLeafletRef, CarteLeafletProps>(function CarteLeaflet(
  { centre, zoom = 16, interactive = true, marqueur = false, onDeplacementDebut, onDeplacementFin, onPret, style },
  ref,
) {
  const vue = useRef<WebView>(null);
  const [etat, setEtat] = useState<'chargement' | 'pret' | 'erreur'>('chargement');

  // La page n'est construite qu'une fois : ensuite la carte est pilotee par injectJavaScript.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const html = useMemo(() => pageHtml(centre, zoom, interactive, marqueur), []);

  useImperativeHandle(ref, () => ({
    allerA: ({ latitude, longitude }, niveau) =>
      vue.current?.injectJavaScript(`window.allerA && window.allerA(${latitude}, ${longitude}, ${niveau ?? 'null'}); true;`),
    afficherMaPosition: ({ latitude, longitude }) =>
      vue.current?.injectJavaScript(
        `window.afficherMaPosition && window.afficherMaPosition(${latitude}, ${longitude}); true;`),
  }), []);

  function surMessage(event: WebViewMessageEvent) {
    let message: MessageCarte;
    try {
      message = JSON.parse(event.nativeEvent.data) as MessageCarte;
    } catch {
      return;
    }
    if (message.type === 'pret') {
      setEtat('pret');
      onPret?.();
    } else if (message.type === 'erreur') {
      setEtat('erreur');
    } else if (message.type === 'debut') {
      onDeplacementDebut?.();
    } else {
      onDeplacementFin?.({ latitude: message.latitude, longitude: message.longitude });
    }
  }

  return (
    <View style={[styles.conteneur, style]}>
      <WebView
        ref={vue}
        // baseUrl : donne un "Referer" aux requetes de tuiles ; sans lui OpenStreetMap refuse les tuiles.
        source={{ html, baseUrl: 'https://fleetpulse.app/' }}
        originWhitelist={['*']}
        onMessage={surMessage}
        onError={() => setEtat('erreur')}
        javaScriptEnabled
        scrollEnabled={false}
        overScrollMode="never"
        bounces={false}
        setSupportMultipleWindows={false}
        style={styles.webview}
      />
      {etat !== 'pret' ? (
        <View pointerEvents="none" style={styles.voile}>
          <Text style={styles.voileTexte}>
            {etat === 'erreur' ? 'Carte indisponible : vérifiez la connexion internet du téléphone.' : 'Chargement de la carte…'}
          </Text>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  conteneur: { overflow: 'hidden', backgroundColor: '#ECEAF4' },
  webview: { flex: 1, backgroundColor: '#ECEAF4' },
  voile: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECEAF4',
    padding: 24,
  },
  voileTexte: { fontSize: 14, color: theme.secondaire, textAlign: 'center' },
});
