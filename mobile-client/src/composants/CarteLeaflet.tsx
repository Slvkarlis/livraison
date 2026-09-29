import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { theme } from '../theme';

/**
 * Carte Leaflet + tuiles OpenStreetMap dans une WebView.
 * Pas de Google Maps : aucune cle API, fonctionne dans Expo Go et sur les telephones sans services Google.
 * Toutes les coordonnees restent dans l'ordre [latitude, longitude] (convention Leaflet et backend).
 */

export type Point = { latitude: number; longitude: number };

export type CarteLeafletRef = {
  allerA: (point: Point, zoom?: number) => void;
  afficherMaPosition: (point: Point) => void;
};

type Props = {
  centre: Point;
  zoom?: number;
  /** false : apercu fige (deplacement et zoom desactives). */
  interactive?: boolean;
  /** Repere dessine par la carte (apercu). En mode selection, le repere est une vue RN fixe au centre. */
  marqueur?: boolean;
  onDeplacementDebut?: () => void;
  onDeplacementFin?: (centre: Point) => void;
  onPret?: () => void;
  style?: StyleProp<ViewStyle>;
};

type Message =
  | { type: 'pret' }
  | { type: 'erreur' }
  | { type: 'debut' }
  | { type: 'fin'; latitude: number; longitude: number };

const LEAFLET = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist';

function pageHtml(centre: Point, zoom: number, interactive: boolean, marqueur: boolean) {
  const config = JSON.stringify({ ...centre, zoom, interactive, marqueur, accent: theme.accent });
  return `<!doctype html>
<html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<link rel="stylesheet" href="${LEAFLET}/leaflet.css">
<style>
  html, body, #carte { margin: 0; padding: 0; height: 100%; width: 100%; background: #ECEAF4; }
  .leaflet-control-attribution { font-size: 9px; background: rgba(255,255,255,0.7) !important; }
  .ma-position { width: 16px; height: 16px; border-radius: 50%; background: #2563EB;
    border: 3px solid #fff; box-shadow: 0 0 0 6px rgba(37,99,235,0.2); box-sizing: border-box; }
</style>
</head><body>
<div id="carte"></div>
<script>
  function envoyer(message) { window.ReactNativeWebView.postMessage(JSON.stringify(message)); }
</script>
<script src="${LEAFLET}/leaflet.js" onerror="envoyer({ type: 'erreur' })"></script>
<script>
  (function () {
    if (!window.L) return;
    var cfg = ${config};
    var carte = L.map('carte', {
      zoomControl: false,
      dragging: cfg.interactive, touchZoom: cfg.interactive, doubleClickZoom: cfg.interactive,
      scrollWheelZoom: false, boxZoom: false, keyboard: false, tap: false
    }).setView([cfg.latitude, cfg.longitude], cfg.zoom);
    carte.attributionControl.setPrefix(false);
    // Politique d'usage OSM : attribution visible et en-tete Referer (fourni par baseUrl cote WebView).
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; contributeurs OpenStreetMap'
    }).addTo(carte);

    if (cfg.marqueur) {
      var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="46" viewBox="0 0 36 46">'
        + '<path d="M18 0C8 0 0 8 0 18c0 13 18 28 18 28s18-15 18-28C36 8 28 0 18 0z" fill="' + cfg.accent + '"/>'
        + '<circle cx="18" cy="18" r="7" fill="#fff"/></svg>';
      L.marker([cfg.latitude, cfg.longitude], {
        icon: L.divIcon({ html: svg, className: '', iconSize: [36, 46], iconAnchor: [18, 46] }),
        interactive: false
      }).addTo(carte);
    }

    var maPosition = null;
    window.afficherMaPosition = function (lat, lng) {
      var icone = L.divIcon({ html: '<div class="ma-position"></div>', className: '', iconSize: [16, 16] });
      if (maPosition) maPosition.setLatLng([lat, lng]);
      else maPosition = L.marker([lat, lng], { icon: icone, interactive: false }).addTo(carte);
    };
    window.allerA = function (lat, lng, zoom) {
      carte.flyTo([lat, lng], zoom || carte.getZoom(), { duration: 0.6 });
    };

    carte.on('movestart', function () { envoyer({ type: 'debut' }); });
    carte.on('moveend', function () {
      var c = carte.getCenter();
      envoyer({ type: 'fin', latitude: c.lat, longitude: c.lng });
    });
    envoyer({ type: 'pret' });
  })();
</script>
</body></html>`;
}

export const CarteLeaflet = forwardRef<CarteLeafletRef, Props>(function CarteLeaflet(
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
    let message: Message;
    try {
      message = JSON.parse(event.nativeEvent.data) as Message;
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
