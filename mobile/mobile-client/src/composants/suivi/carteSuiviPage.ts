import type { Coord } from '@fleetpulse/shared';

/**
 * Carte de suivi du client (MapLibre + rues OpenStreetMap, meme style que l'app livreur), partagee par
 * CarteSuivi (WebView) et CarteSuivi.web (iframe). Affiche le commerce, la maison, le livreur anime,
 * le chemin deja parcouru (gris) et l'itineraire restant (ambre, trait anime).
 */

export type PhaseSuivi = 'preparation' | 'collecte' | 'livraison' | 'livree';

export interface EtatSuivi {
  phase: PhaseSuivi;
  initiale: string;
  livreur: Coord | null;
  commerce: Coord | null;
  client: Coord;
  /** Chemin deja parcouru par le livreur. */
  fait: Coord[];
  /** Itineraire restant jusqu'au client (ou jusqu'au commerce puis au client avant la collecte). */
  restant: Coord[];
}

export type MessageSuivi = { type: 'pret' } | { type: 'erreur' } | { type: 'libre' } | { type: 'auto' };

export const SOURCE_SUIVI = 'fleetpulse-suivi';

// Icones au trait (pas d'emoji) : commerce, maison, livreur.
const ICONES = { commerce: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l1.5-5h15L21 9"/><path d="M4 9v11h16V9"/><path d="M3 9a3 3 0 0 0 6 0a3 3 0 0 0 6 0a3 3 0 0 0 6 0"/><path d="M10 20v-5h4v5"/></svg>', maison: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/></svg>', livreur: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/></svg>' };

const MAPLIBRE = 'https://cdn.jsdelivr.net/npm/maplibre-gl@5/dist';
const STYLE = 'https://tiles.openfreemap.org/styles/liberty';

export function pageSuivi(accent: string): string {
  return `<!doctype html>
<html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<link rel="stylesheet" href="${MAPLIBRE}/maplibre-gl.css">
<style>
  html, body, #carte { margin: 0; padding: 0; height: 100%; width: 100%; background: #ECEAE4; overflow: hidden; }
  .maplibregl-ctrl-attrib { font-size: 9px; }
  .repere { display: flex; align-items: center; justify-content: center; width: 38px; height: 38px; border-radius: 50%;
    border: 3px solid #fff; box-shadow: 0 4px 12px rgba(0,0,0,.3); font: 700 17px/1 sans-serif; }
  .commerce { background: ${accent}; color: #15171A; border-radius: 12px; }
  .maison { background: #15171A; color: #fff; }
  .livreur { position: relative; width: 46px; height: 46px; }
  .livreur .halo { position: absolute; inset: -14px; border-radius: 50%; background: ${accent}; opacity: .35;
    animation: halo 1.8s ease-out infinite; }
  .livreur .pastille { position: absolute; inset: 0; border-radius: 50%; background: #15171A; border: 3px solid ${accent};
    display: flex; align-items: center; justify-content: center; box-shadow: 0 6px 16px rgba(0,0,0,.35); color: ${accent}; }
  .livreur .nom { position: absolute; top: -26px; left: 50%; transform: translateX(-50%); background: #15171A; color: #fff;
    font: 700 11px sans-serif; padding: 3px 8px; border-radius: 999px; white-space: nowrap; }
  @keyframes halo { 0% { transform: scale(.6); opacity: .5; } 100% { transform: scale(1.6); opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { .livreur .halo { animation: none; } }
</style>
<script src="${MAPLIBRE}/maplibre-gl.js"></script>
</head><body><div id="carte"></div>
<script>
(function () {
  function poster(m) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(m));
    else if (window.parent !== window) window.parent.postMessage(Object.assign({ source: '${SOURCE_SUIVI}' }, m), '*');
  }
  if (!window.maplibregl) { poster({ type: 'erreur' }); return; }
  var carte;
  try {
    carte = new maplibregl.Map({ container: 'carte', style: '${STYLE}', center: [10.18, 36.805], zoom: 14.5,
      pitch: 45, bearing: -12, attributionControl: { compact: true }, maxPitch: 60 });
  } catch (e) { poster({ type: 'erreur' }); return; }
  var reduit = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var etat = null, pret = false, auto = true, reperes = {}, affiche = null, anim = 0;
  var vide = { type: 'FeatureCollection', features: [] };
  function ligne(c) { return c && c.length > 1 ? { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: c } } : vide; }

  function repere(cle, classe, html, lngLat, anchor) {
    if (!lngLat) { if (reperes[cle]) { reperes[cle].remove(); delete reperes[cle]; } return null; }
    if (!reperes[cle]) {
      var conteneur = document.createElement('div');
      conteneur.innerHTML = '<div class="' + classe + '">' + html + '</div>';
      reperes[cle] = new maplibregl.Marker({ element: conteneur, anchor: anchor || 'center' }).setLngLat(lngLat).addTo(carte);
    }
    return reperes[cle];
  }

  // Deplacement fluide du livreur entre deux positions GPS (au lieu d'un saut).
  function animerLivreur(m, cible) {
    var depart = affiche || cible, debut = performance.now(), duree = reduit ? 0 : 1600;
    cancelAnimationFrame(anim);
    function pas(t) {
      var k = duree ? Math.min(1, (t - debut) / duree) : 1, e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      affiche = [depart[0] + (cible[0] - depart[0]) * e, depart[1] + (cible[1] - depart[1]) * e];
      m.setLngLat(affiche);
      if (k < 1) anim = requestAnimationFrame(pas);
    }
    anim = requestAnimationFrame(pas);
  }

  function cadrer(duree) {
    if (!etat || !pret || !auto) return;
    var b = new maplibregl.LngLatBounds(), pts = [etat.client];
    if (etat.livreur) pts.push(etat.livreur);
    if (etat.phase !== 'livraison' && etat.commerce) pts.push(etat.commerce);
    if (pts.length === 1) pts = pts.concat(etat.restant);
    pts.forEach(function (p) { b.extend(p); });
    carte.fitBounds(b, { padding: { top: 90, bottom: 60, left: 50, right: 50 }, maxZoom: 16.5, pitch: 45, bearing: -12, duration: duree });
  }

  function dessiner(premier) {
    if (!pret || !etat) return;
    carte.getSource('fait').setData(ligne(etat.fait));
    carte.getSource('restant').setData(ligne(etat.restant));
    repere('commerce', 'repere commerce', '${ICONES.commerce}', etat.commerce);
    repere('maison', 'repere maison', '${ICONES.maison}', etat.client);
    var m = repere('livreur', 'livreur', '<div class="halo"></div><div class="pastille">${ICONES.livreur}</div><div class="nom">' + etat.initiale + '</div>', etat.livreur);
    if (m) { if (premier || !affiche) { affiche = etat.livreur; m.setLngLat(affiche); } else animerLivreur(m, etat.livreur); }
    else affiche = null;
  }

  carte.on('load', function () {
    carte.addSource('fait', { type: 'geojson', data: vide });
    carte.addSource('restant', { type: 'geojson', data: vide });
    carte.addLayer({ id: 'fait', type: 'line', source: 'fait', layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#7C828C', 'line-width': 6, 'line-opacity': .75 } });
    carte.addLayer({ id: 'restant-halo', type: 'line', source: 'restant', layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '${accent}', 'line-width': 16, 'line-opacity': .25, 'line-blur': 4 } });
    carte.addLayer({ id: 'restant-bord', type: 'line', source: 'restant', layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#15171A', 'line-width': 9 } });
    carte.addLayer({ id: 'restant', type: 'line', source: 'restant', layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '${accent}', 'line-width': 5 } });
    carte.addLayer({ id: 'restant-flux', type: 'line', source: 'restant', layout: { 'line-cap': 'butt', 'line-join': 'round' },
      paint: { 'line-color': '#FFFFFF', 'line-width': 2.5, 'line-opacity': .9, 'line-dasharray': [0, 4, 3] } });
    pret = true; poster({ type: 'pret' }); dessiner(true); cadrer(0);
    // Trait blanc qui « coule » vers la maison : le sens du trajet se lit d'un coup d'oeil.
    if (!reduit) {
      var motifs = [[0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5], [2, 4, 1], [2.5, 4, .5], [3, 4, 0], [0, .5, 3, 3.5], [0, 1, 3, 3], [0, 1.5, 3, 2.5], [0, 2, 3, 2], [0, 2.5, 3, 1.5], [0, 3, 3, 1], [0, 3.5, 3, .5]];
      var i = 0;
      setInterval(function () { if (!document.hidden) { i = (i + 1) % motifs.length; carte.setPaintProperty('restant-flux', 'line-dasharray', motifs[i]); } }, 70);
    }
  });
  carte.on('error', function () { if (!pret) poster({ type: 'erreur' }); });
  function geste(e) { if (e.originalEvent && auto) { auto = false; poster({ type: 'libre' }); } }
  carte.on('dragstart', geste); carte.on('rotatestart', geste); carte.on('zoomstart', geste);

  window.majSuivi = function (data) { var premier = !etat; etat = data; dessiner(premier); cadrer(premier ? 0 : 1200); };
  window.recentrer = function () { auto = true; poster({ type: 'auto' }); cadrer(800); };
})();
</script></body></html>`;
}
