import type { Coord } from '@fleetpulse/shared';

/**
 * Page MapLibre (rues OpenStreetMap, sans cle API) partagee par CarteNavigation (WebView, telephone)
 * et CarteNavigation.web (iframe, navigateur). Mode GPS : la carte suit le livreur, inclinee et orientee
 * dans le sens de la route ; un geste du livreur passe en mode libre jusqu'a « Recentrer ».
 */

export interface EtatNavigation {
  position: Coord | null;
  /** Trace restant a parcourir (depuis la position projetee). */
  restant: Coord[];
  /** Trace complet de l'itineraire courant. */
  complet: Coord[];
  cible: Coord;
  typeCible: 'commerce' | 'client';
}

export type MessageNavigation = { type: 'pret' } | { type: 'erreur' } | { type: 'libre' } | { type: 'suivi' };

/** Marqueur des messages postes par l'iframe (version navigateur). */
export const SOURCE_NAVIGATION = 'fleetpulse-navigation';

const MAPLIBRE = 'https://cdn.jsdelivr.net/npm/maplibre-gl@5/dist';
const STYLE = 'https://tiles.openfreemap.org/styles/liberty';

export function pageNavigation(): string {
  return `<!doctype html>
<html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<link rel="stylesheet" href="${MAPLIBRE}/maplibre-gl.css">
<style>
  html, body, #carte { margin: 0; padding: 0; height: 100%; width: 100%; background: #E8E6E1; overflow: hidden; }
  .maplibregl-ctrl-attrib { font-size: 9px; }
  .livreur { width: 30px; height: 30px; border-radius: 50%; background: #1A73E8; border: 4px solid #fff;
    box-shadow: 0 0 0 10px rgba(26,115,232,.18), 0 2px 8px rgba(0,0,0,.35); box-sizing: border-box; position: relative; }
  .livreur::after { content: ''; position: absolute; left: 50%; top: -15px; transform: translateX(-50%);
    border: 7px solid transparent; border-bottom: 11px solid #1A73E8; }
  .cible { width: 34px; height: 34px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); background: #EA4335;
    border: 3px solid #fff; box-shadow: 0 2px 8px rgba(0,0,0,.35); display: flex; align-items: center; justify-content: center; }
  .cible span { transform: rotate(45deg); font: 700 15px sans-serif; color: #fff; }
  .cible.commerce { background: #F2B233; }
</style>
<script src="${MAPLIBRE}/maplibre-gl.js"></script>
</head><body><div id="carte"></div>
<script>
(function () {
  function poster(m) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(m));
    else if (window.parent !== window) window.parent.postMessage(Object.assign({ source: '${SOURCE_NAVIGATION}' }, m), '*');
  }
  if (!window.maplibregl) { poster({ type: 'erreur' }); return; }
  var carte;
  try {
    carte = new maplibregl.Map({ container: 'carte', style: '${STYLE}', center: [10.18, 36.805], zoom: 15, pitch: 0,
      attributionControl: { compact: true }, maxPitch: 65 });
  } catch (e) { poster({ type: 'erreur' }); return; }
  var ZOOM_GPS = 17.2, zoomSuivi = ZOOM_GPS, etat = null, suivre = true, pret = false, livreur = null, cible = null, cap = 0, vueEnsemble = false;
  var vide = { type: 'FeatureCollection', features: [] };
  function ligne(c) { return { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: c } }; }

  // Cap (degres) d'un point a un autre, pour orienter la carte dans le sens de la route.
  function capEntre(a, b) {
    var r = Math.PI / 180, y = Math.sin((b[0] - a[0]) * r) * Math.cos(b[1] * r);
    var x = Math.cos(a[1] * r) * Math.sin(b[1] * r) - Math.sin(a[1] * r) * Math.cos(b[1] * r) * Math.cos((b[0] - a[0]) * r);
    return (Math.atan2(y, x) / r + 360) % 360;
  }
  function distance(a, b) { var kx = Math.cos(a[1] * Math.PI / 180); return Math.hypot((b[0] - a[0]) * kx, b[1] - a[1]) * 111320; }
  // Point du trace situe ~35 m devant : le cap ne tremble pas sur les petits segments.
  function capDevant(r) {
    if (!r || r.length < 2) return cap;
    var d = 0;
    for (var i = 1; i < r.length; i++) { d += distance(r[i - 1], r[i]); if (d > 35) return capEntre(r[0], r[i]); }
    return capEntre(r[0], r[r.length - 1]);
  }

  function cadrer(duree) {
    if (!etat || !pret) return;
    if (vueEnsemble || !etat.position) {
      var b = new maplibregl.LngLatBounds();
      (etat.complet.length ? etat.complet : [etat.cible]).forEach(function (p) { b.extend(p); });
      if (etat.position) b.extend(etat.position);
      b.extend(etat.cible);
      carte.fitBounds(b, { padding: 50, maxZoom: 17, pitch: 0, bearing: 0, duration: duree });
      return;
    }
    if (!suivre) return;
    cap = capDevant(etat.restant);
    carte.easeTo({ center: etat.position, zoom: zoomSuivi, pitch: 58, bearing: cap, duration: duree,
      padding: { top: Math.round(carte.getContainer().clientHeight * 0.35), bottom: 0, left: 0, right: 0 } });
  }

  function dessiner() {
    if (!pret || !etat) return;
    carte.getSource('fait').setData(etat.complet.length > 1 ? ligne(etat.complet) : vide);
    carte.getSource('restant').setData(etat.restant.length > 1 ? ligne(etat.restant) : vide);
    if (etat.position) {
      // Le conteneur appartient a MapLibre (position absolue + transform) : le style est sur un enfant,
      // sinon le repere glisse au zoom.
      if (!livreur) { var el = document.createElement('div'); el.innerHTML = '<div class="livreur"></div>';
        livreur = new maplibregl.Marker({ element: el, rotationAlignment: 'map', pitchAlignment: 'map' }).setLngLat(etat.position).addTo(carte); }
      livreur.setLngLat(etat.position).setRotation(capDevant(etat.restant));
    }
    if (!cible) { var c = document.createElement('div'); c.innerHTML = '<div class="cible"><span></span></div>';
      cible = new maplibregl.Marker({ element: c, anchor: 'bottom', offset: [0, -4] }).setLngLat(etat.cible).addTo(carte); }
    var e = cible.getElement().firstChild;
    e.className = 'cible ' + etat.typeCible; e.firstChild.textContent = etat.typeCible === 'commerce' ? 'R' : 'C';
    cible.setLngLat(etat.cible);
  }

  carte.on('load', function () {
    carte.addSource('fait', { type: 'geojson', data: vide });
    carte.addSource('restant', { type: 'geojson', data: vide });
    carte.addLayer({ id: 'fait', type: 'line', source: 'fait', layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#9AA0A6', 'line-width': 7, 'line-opacity': .7 } });
    carte.addLayer({ id: 'restant-bord', type: 'line', source: 'restant', layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#0B57D0', 'line-width': 12 } });
    carte.addLayer({ id: 'restant', type: 'line', source: 'restant', layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#4C8DF6', 'line-width': 8 } });
    pret = true; poster({ type: 'pret' }); dessiner(); cadrer(0);
  });
  carte.on('error', function (e) { if (!pret) poster({ type: 'erreur' }); });
  // Geste du livreur : on arrete de suivre, comme un GPS, jusqu'a « Recentrer ».
  carte.on('dragstart', function (e) { if (e.originalEvent && suivre) { suivre = false; poster({ type: 'libre' }); } });
  carte.on('rotatestart', function (e) { if (e.originalEvent && suivre) { suivre = false; poster({ type: 'libre' }); } });

  // Zoom au doigt / a la molette : le suivi continue, au niveau de zoom choisi par le livreur.
  carte.on('zoomend', function (e) { if (e.originalEvent) zoomSuivi = carte.getZoom(); });

  window.majNavigation = function (data) { var premier = !etat; etat = data; dessiner(); cadrer(premier ? 0 : 900); };
  window.recentrer = function () { suivre = true; zoomSuivi = ZOOM_GPS; vueEnsemble = false; poster({ type: 'suivi' }); cadrer(700); };
  window.vueEnsemble = function () { vueEnsemble = true; suivre = false; poster({ type: 'libre' }); cadrer(700); };
})();
</script></body></html>`;
}
