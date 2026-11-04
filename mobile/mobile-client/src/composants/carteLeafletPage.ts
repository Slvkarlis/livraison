import type { StyleProp, ViewStyle } from 'react-native';
import { theme } from '../theme';

/**
 * Page Leaflet + tuiles OpenStreetMap partagee par CarteLeaflet (WebView, mobile) et CarteLeaflet.web (iframe, navigateur).
 * Toutes les coordonnees restent dans l'ordre [latitude, longitude] (convention Leaflet et backend).
 */

export type Point = { latitude: number; longitude: number };

export type CarteLeafletRef = {
  allerA: (point: Point, zoom?: number) => void;
  afficherMaPosition: (point: Point) => void;
};

export type CarteLeafletProps = {
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

export type MessageCarte =
  | { type: 'pret' }
  | { type: 'erreur' }
  | { type: 'debut' }
  | { type: 'fin'; latitude: number; longitude: number };

/** Marqueur ajoute aux messages postes par l'iframe, pour ignorer les autres messages de la fenetre. */
export const SOURCE_CARTE = 'fleetpulse-carte';

const LEAFLET = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist';

export function pageHtml(centre: Point, zoom: number, interactive: boolean, marqueur: boolean) {
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
  // WebView (mobile) ou iframe (navigateur)
  function envoyer(message) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(message));
    else if (window.parent !== window) window.parent.postMessage(Object.assign({ source: '${SOURCE_CARTE}' }, message), '*');
  }
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
    // Politique d'usage OSM : attribution visible et en-tete Referer (baseUrl de la WebView, origine de la page en web).
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
