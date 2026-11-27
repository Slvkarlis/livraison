import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource, Map as Carte, StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { CENTRE_TUNIS, contourSeCroise, polygoneCercle, type ArcCarte, type BulleCarte, type CercleCarte, type CoursierCarte, type PoiCarte, type PointCarte, type ZonageCarte } from '../suivi';
import { progression } from '../../../mobile/packages/shared/src/itineraireRoutier';
import type { ItineraireSuivi } from './useItineraires';
import { Icone, svgIcone } from './icones';

interface Props { coursiers?: CoursierCarte[]; selection?: number; onSelection?: (id: number) => void; arcs?: ArcCarte[]; zonage?: ZonageCarte; itineraires?: Map<number, ItineraireSuivi>;
  /** Commerces et clients ; un clic ouvre leur fiche. */
  poi?: PoiCarte[];
  /** Cadrage demande (nouvelle cle = nouveau cadrage), ex. trajet complet du livreur choisi. */
  cadrage?: { cle: string; points: PointCarte[] };
  /** Densite par zone (BI). */
  bulles?: BulleCarte[];
  /** Rayons en metres (groupes de quartier). */
  cercles?: CercleCarte[];
  legende?: string }
maplibregl.setWorkerUrl(workerUrl);
maplibregl.setWorkerCount(2);
const AUCUN_POI: PoiCarte[] = [], AUCUNE_BULLE: BulleCarte[] = [], AUCUN_CERCLE: CercleCarte[] = [];
const AUCUN: CoursierCarte[] = [], AUCUN_ARC: ArcCarte[] = [], AUCUN_ITINERAIRE = new Map<number, ItineraireSuivi>();
const couleur = (nom: string) => getComputedStyle(document.documentElement).getPropertyValue(nom).trim();
function styleCarte(raster = false): StyleSpecification {
  return { version: 8, sources: raster ? { fond: { type: 'raster', tiles: ['https://basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png'], tileSize: 256, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/attributions">CARTO</a>' } } : { fond: { type: 'vector', url: 'https://tiles.openfreemap.org/planet', attribution: '© <a href="https://openfreemap.org">OpenFreeMap</a> © <a href="https://www.openmaptiles.org/">OpenMapTiles</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' } },
    layers: [{ id: 'sol', type: 'background', paint: { 'background-color': couleur('--carte-sol') } }, ...(raster ? [{ id: 'raster', type: 'raster' as const, source: 'fond' }] : [
      { id: 'eau', type: 'fill' as const, source: 'fond', 'source-layer': 'water', paint: { 'fill-color': couleur('--carte-eau') } },
      { id: 'routes', type: 'line' as const, source: 'fond', 'source-layer': 'transportation', paint: { 'line-color': couleur('--carte-route'), 'line-width': 2 } },
      { id: 'batiments', type: 'fill-extrusion' as const, source: 'fond', 'source-layer': 'building', minzoom: 14, paint: { 'fill-extrusion-color': couleur('--carte-batiment'), 'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 9], 'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0], 'fill-extrusion-opacity': .85 } } as maplibregl.FillExtrusionLayerSpecification,
    ])] };
}

/** Trace en cours d'edition (contour ferme des 3 sommets), en rouge s'il se croise. */
function dessinerTrace(map: Carte, points: PointCarte[]) {
  const croise = contourSeCroise(points);
  (map.getSource('zone-edition') as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: points.length < 2 ? [] : [{ type: 'Feature', properties: { croise },
    geometry: points.length >= 3 ? { type: 'Polygon', coordinates: [[...points, points[0]]] } : { type: 'LineString', coordinates: points } }] });
}

let ficheOuverte: maplibregl.Popup | null = null;
/** Fiche (titre + lignes) dans une bulle MapLibre ; contenu pose par textContent. */
function ouvrirFiche(map: Carte, position: PointCarte, titre: string, lignes: string[]) {
  ficheOuverte?.remove();
  const contenu = document.createElement('div'); contenu.className = 'mission-bulle';
  const t = document.createElement('strong'); t.textContent = titre; contenu.append(t);
  for (const l of lignes) { const ligne = document.createElement('span'); ligne.textContent = l; contenu.append(ligne); }
  ficheOuverte = new maplibregl.Popup({ offset: 18, closeButton: true, maxWidth: '260px' }).setLngLat(position).setDOMContent(contenu).addTo(map);
}

function cadrerZones(map: Carte, zonage: ZonageCarte, reduit: boolean) {
  const choisie = zonage.zones.find(z => z.id === zonage.selection);
  const points = zonage.edition && zonage.sommets.length ? zonage.sommets : choisie ? choisie.contour : zonage.zones.flatMap(z => z.contour);
  if (!points.length) return;
  const bornes = new maplibregl.LngLatBounds(); points.forEach(p => bornes.extend(p));
  map.fitBounds(bornes, { padding: { top: 90, bottom: 65, left: 45, right: 45 }, maxZoom: 15.8, duration: reduit ? 0 : 650 });
}

export default function CarteMission({ coursiers = AUCUN, selection, onSelection, arcs = AUCUN_ARC, zonage, itineraires = AUCUN_ITINERAIRE, poi = AUCUN_POI, cadrage, bulles = AUCUNE_BULLE, cercles = AUCUN_CERCLE, legende }: Props) {
  const conteneur = useRef<HTMLDivElement>(null), carte = useRef<Carte | null>(null);
  const [prete, setPrete] = useState(false), [indisponible, setIndisponible] = useState(false);
  const [revisionStyle, setRevisionStyle] = useState(0);
  const [message, setMessage] = useState('Chargement du fond de carte…');
  const [raster, setRaster] = useState(false), [vue3d, setVue3d] = useState(true), [suivi, setSuivi] = useState(true);
  const [mouvementReduit, setMouvementReduit] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const donnees = useRef({ coursiers, selection, arcs, suivi, mouvementReduit, onSelection, zonage, itineraires, cercles });
  donnees.current = { coursiers, selection, arcs, suivi, mouvementReduit, onSelection, zonage, itineraires, cercles };
  const reperesSommets = useRef<maplibregl.Marker[]>([]), reperesMilieux = useRef<maplibregl.Marker[]>([]), dernierGeste = useRef(0);
  const reperes = useRef(new Map<number, { marqueur: maplibregl.Marker; destination?: maplibregl.Marker; commerce?: maplibregl.Marker; depart: PointCarte; cible: PointCarte; debut: number; trace: PointCarte[]; date: string }>());
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)'), changer = () => setMouvementReduit(media.matches);
    media.addEventListener('change', changer); return () => media.removeEventListener('change', changer);
  }, []);
  useEffect(() => {
    if (!conteneur.current) return;
    let map: Carte;
    try {
      map = new maplibregl.Map({ container: conteneur.current, style: styleCarte(), center: CENTRE_TUNIS, zoom: 15.5, pitch: 58, bearing: -18, attributionControl: false, canvasContextAttributes: { antialias: false }, maxPitch: 60 });
    } catch { setIndisponible(true); setVue3d(false); setMessage(donnees.current.zonage ? 'WebGL indisponible : contours en vue 2D schématique. Utilisez le formulaire pour saisir les sommets.' : 'WebGL indisponible : vue 2D schématique. La liste fournit toutes les informations.'); return; }
    carte.current = map;
    map.addControl(new maplibregl.AttributionControl({ compact: false }), 'bottom-right');
    map.getCanvas().setAttribute('aria-label', donnees.current.zonage ? 'Carte 3D des zones. Les coordonnées des sommets peuvent aussi être saisies dans le formulaire.' : 'Carte des livraisons à Tunis. La liste des coursiers fournit une alternative textuelle.');
    let detruit = false, repli = false, erreurs = 0, animation = 0, dernierRendu = 0, debutMesure = performance.now(), images = 0, lent = 0;
    const replier = () => {
      if (detruit || repli) return; repli = true; setRaster(true); setVue3d(false);
      setMessage('Fond vectoriel indisponible : fond raster 2D.'); map.setStyle(styleCarte(true)); map.jumpTo({ pitch: 0, bearing: 0 });
    };
    const delai = window.setTimeout(() => { if (!map.isSourceLoaded('fond')) replier(); }, 14000);
    map.on('error', () => { if (!repli) replier(); else if (++erreurs >= 3) setMessage('Fond de carte indisponible. Les positions et la liste restent consultables.'); });
    map.on('webglcontextlost', () => { setIndisponible(true); setVue3d(false); setMessage('Rendu graphique interrompu : vue 2D schématique.'); });
    map.on('movestart', e => { if (e.originalEvent) setSuivi(false); });
    map.on('click', e => {
      if (map.getLayer('cercles-fond')) {
        const id = map.queryRenderedFeatures(e.point, { layers: ['cercles-fond'] })[0]?.properties?.id;
        const c = donnees.current.cercles.find(x => x.id === id);
        if (c) { ouvrirFiche(map, c.centre, c.titre, c.lignes); return; }
      }
      const z = donnees.current.zonage; if (!z) return;
      if (z.edition) {
        // Un clic sur un sommet ou une poignee ne doit pas aussi ajouter un point sous la souris.
        if (performance.now() - dernierGeste.current < 350) return;
        if (z.sommets.length < 200) { z.onPoint([e.lngLat.lng, e.lngLat.lat]); z.onChoisir?.(z.sommets.length); }
        return;
      }
      if (!map.getLayer('zones-fond')) return;
      const id = map.queryRenderedFeatures(e.point, { layers: ['zones-fond'] })[0]?.properties?.id;
      if (typeof id === 'number') z.onSelection?.(id);
    });
    map.on('mouseout', () => (map.getSource('zone-apercu') as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: [] }));
    map.on('mousemove', e => {
      const z = donnees.current.zonage;
      if (!z && map.getLayer('cercles-fond')) { map.getCanvas().style.cursor = map.queryRenderedFeatures(e.point, { layers: ['cercles-fond'] }).length ? 'pointer' : ''; return; }
      if (!z) return;
      // Apercu du prochain cote : dernier sommet -> souris -> premier sommet.
      if (z.edition && z.sommets.length) {
        const curseur: PointCarte = [e.lngLat.lng, e.lngLat.lat], dernier = z.sommets[z.sommets.length - 1];
        (map.getSource('zone-apercu') as GeoJSONSource | undefined)?.setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: z.sommets.length >= 2 ? [dernier, curseur, z.sommets[0]] : [dernier, curseur] } });
      }
      map.getCanvas().style.cursor = z.edition ? 'crosshair' : map.getLayer('zones-fond') && map.queryRenderedFeatures(e.point, { layers: ['zones-fond'] }).length ? 'pointer' : '';
    });
    map.on('style.load', () => {
      if (detruit) return;
      // Densite (BI) : halo de chaleur sous les badges ; groupes de quartier : cercles en metres.
      for (const id of ['chaleur', 'cercles']) map.addSource(id, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({ id: 'chaleur', type: 'heatmap', source: 'chaleur', paint: {
        'heatmap-weight': ['get', 'poids'], 'heatmap-intensity': 1.1, 'heatmap-opacity': .8,
        'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 10, 45, 13, 90, 16, 180],
        'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(0,0,0,0)', .25, 'rgba(242,178,51,.25)', .55, 'rgba(242,178,51,.6)', .85, 'rgba(234,88,12,.75)', 1, 'rgba(220,38,38,.85)'] } } as maplibregl.HeatmapLayerSpecification);
      map.addLayer({ id: 'cercles-fond', type: 'fill', source: 'cercles', paint: { 'fill-color': ['case', ['get', 'actif'], couleur('--accent'), '#94A3B8'], 'fill-opacity': ['case', ['get', 'actif'], .16, .08] } });
      map.addLayer({ id: 'cercles-contour', type: 'line', source: 'cercles', paint: { 'line-color': ['case', ['get', 'actif'], couleur('--accent'), '#94A3B8'], 'line-width': 2, 'line-dasharray': [2, 1.5] } });
      for (const id of ['trajets', 'arcs', 'itineraires']) map.addSource(id, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({ id: 'arcs', type: 'line', source: 'arcs', layout: { 'line-cap': 'round' }, paint: { 'line-color': ['get', 'couleur'], 'line-width': 3, 'line-opacity': .85 } });
      // Itineraire routier restant (rues reelles) : bordure sombre + trait ambre, plus marque pour le coursier choisi.
      map.addLayer({ id: 'itineraires-bord', type: 'line', source: 'itineraires', filter: ['!', ['get', 'direct']], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': couleur('--nuit'), 'line-width': ['case', ['get', 'choisi'], 9, 6], 'line-opacity': ['case', ['get', 'choisi'], .9, .5] } });
      map.addLayer({ id: 'itineraires', type: 'line', source: 'itineraires', filter: ['!', ['get', 'direct']], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': couleur('--accent'), 'line-width': ['case', ['get', 'choisi'], 5, 3], 'line-opacity': ['case', ['get', 'choisi'], .95, .45] } });
      map.addLayer({ id: 'itineraires-direct', type: 'line', source: 'itineraires', filter: ['get', 'direct'], paint: { 'line-color': couleur('--accent'), 'line-width': 2, 'line-dasharray': [2, 2], 'line-opacity': .5 } });
      map.addLayer({ id: 'trajets-halo', type: 'line', source: 'trajets', filter: ['==', ['get', 'passe'], true], paint: { 'line-color': couleur('--accent'), 'line-width': 12, 'line-blur': 7, 'line-opacity': .24 } });
      map.addLayer({ id: 'trajets', type: 'line', source: 'trajets', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': couleur('--accent'), 'line-width': 3, 'line-opacity': ['case', ['get', 'passe'], .95, .24] } });
      if (donnees.current.zonage) {
        for (const id of ['zones', 'zone-edition', 'zone-sommets', 'zone-apercu']) map.addSource(id, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addLayer({ id: 'zones-fond', type: 'fill', source: 'zones', paint: { 'fill-color': couleur('--accent'), 'fill-opacity': ['case', ['get', 'selectionnee'], .16, .04] } });
        map.addLayer({ id: 'zones-contours', type: 'line', source: 'zones', paint: { 'line-color': ['case', ['get', 'selectionnee'], couleur('--accent'), couleur('--sur-nuit-discret')], 'line-width': ['case', ['get', 'selectionnee'], 3, 1.5] } });
        map.addLayer({ id: 'zone-edition-fond', type: 'fill', source: 'zone-edition', filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': couleur('--accent'), 'fill-opacity': .18 } });
        map.addLayer({ id: 'zone-apercu', type: 'line', source: 'zone-apercu', paint: { 'line-color': couleur('--sur-nuit'), 'line-width': 1.5, 'line-dasharray': [2, 2], 'line-opacity': .7 } });
        // Contour rouge si le trace se croise (enregistrement refuse par le serveur).
        map.addLayer({ id: 'zone-edition-contour', type: 'line', source: 'zone-edition', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ['case', ['get', 'croise'], '#EF4444', couleur('--accent')], 'line-width': 3 } });
      }
      setPrete(true); setRevisionStyle(v => v + 1); if (!repli) setMessage('');
    });
    map.on('sourcedata', e => { if (e.sourceId === 'fond' && e.isSourceLoaded) window.clearTimeout(delai); });
    const observer = new ResizeObserver(() => { map.resize(); const z = donnees.current.zonage; if (z && map.isStyleLoaded()) cadrerZones(map, z, true); }); observer.observe(conteneur.current);
    const animer = (temps: number) => {
      if (detruit) return;
      animation = requestAnimationFrame(animer);
      if (document.hidden) { debutMesure = temps; images = 0; return; }
      images++;
      if (temps - debutMesure >= 5000) {
        if (images * 1000 / (temps - debutMesure) < 22) lent++; else lent = 0;
        if (lent === 2) { setVue3d(false); setMessage('Vue 2D activée pour préserver la fluidité.'); }
        images = 0; debutMesure = temps;
      }
      const { coursiers: actuels, selection: choisi, suivi: suivre, mouvementReduit: reduit } = donnees.current;
      const features: { type: 'Feature'; properties: { passe: boolean }; geometry: { type: 'LineString'; coordinates: PointCarte[] } }[] = [];
      const routes: { type: 'Feature'; properties: { choisi: boolean; direct: boolean }; geometry: { type: 'LineString'; coordinates: PointCarte[] } }[] = [];
      const majTraces = temps - dernierRendu > 120;
      for (const c of actuels) {
        const repere = reperes.current.get(c.id); if (!repere) continue;
        const t = reduit ? 1 : Math.min(1, Math.max(0, (temps - repere.debut) / 2000));
        const position: PointCarte = [repere.depart[0] + (repere.cible[0] - repere.depart[0]) * t, repere.depart[1] + (repere.cible[1] - repere.depart[1]) * t];
        repere.marqueur.setLngLat(position);
        if (c.id === choisi && suivre && !map.isMoving() && !reduit) {
          const centre = map.getCenter(); map.jumpTo({ center: [centre.lng + (position[0] - centre.lng) * .08, centre.lat + (position[1] - centre.lat) * .08] });
        }
        if (repere.trace.length > 0) features.push({ type: 'Feature', properties: { passe: true }, geometry: { type: 'LineString', coordinates: [...repere.trace, position] } });
        const suiviRoute = donnees.current.itineraires.get(c.id);
        if (c.commande && majTraces) {
          // Sans itineraire (calcul en cours) : simple indication de direction, comme avant.
          if (suiviRoute) routes.push({ type: 'Feature', properties: { choisi: c.id === choisi, direct: suiviRoute.itineraire.source === 'direct' }, geometry: { type: 'LineString', coordinates: progression(suiviRoute.itineraire, position).restant } });
          else features.push({ type: 'Feature', properties: { passe: false }, geometry: { type: 'LineString', coordinates: [position, c.commande.destination] } });
        }
      }
      if (actuels.length && majTraces && map.getSource('trajets')) {
        (map.getSource('trajets') as GeoJSONSource).setData({ type: 'FeatureCollection', features }); dernierRendu = temps;
        (map.getSource('itineraires') as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: routes });
      }
    };
    animation = requestAnimationFrame(animer);
    return () => { detruit = true; cancelAnimationFrame(animation); clearTimeout(delai); observer.disconnect(); for (const r of reperes.current.values()) { r.marqueur.remove(); r.destination?.remove(); r.commerce?.remove(); } reperes.current.clear(); map.remove(); carte.current = null; };
  }, []);
  useEffect(() => {
    const map = carte.current; if (!map || !prete || indisponible) return;
    if (!coursiers.length) for (const id of ['trajets', 'itineraires']) (map.getSource(id) as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: [] });
    for (const [id, r] of reperes.current) if (!coursiers.some(c => c.id === id)) { r.marqueur.remove(); r.destination?.remove(); r.commerce?.remove(); reperes.current.delete(id); }
    for (const c of coursiers) {
      let r = reperes.current.get(c.id);
      if (!r) {
        const bouton = document.createElement('button'); bouton.className = 'mission-repere'; bouton.type = 'button'; bouton.textContent = c.nom.split(' ').map(p => p[0]).slice(0, 2).join(''); bouton.setAttribute('aria-label', `Sélectionner ${c.nom}`);
        bouton.onclick = () => donnees.current.onSelection?.(c.id);
        r = { marqueur: new maplibregl.Marker({ element: bouton }).setLngLat(c.position).addTo(map), depart: c.position, cible: c.position, debut: performance.now(), trace: [c.position], date: c.date };
        reperes.current.set(c.id, r);
      } else if (r.date !== c.date && (r.cible[0] !== c.position[0] || r.cible[1] !== c.position[1])) {
        const actuel = r.marqueur.getLngLat();
        r.trace.push([actuel.lng, actuel.lat]); r.trace = r.trace.slice(-300);
        r.depart = [actuel.lng, actuel.lat]; r.cible = c.position; r.debut = performance.now(); r.date = c.date;
      }
      r.marqueur.getElement().setAttribute('aria-pressed', String(c.id === selection));
      if (mouvementReduit && suivi && c.id === selection) map.jumpTo({ center: c.position });
      if (c.historique) r.trace = c.historique.slice(-300);
      if (c.commande) {
        if (!r.destination) { const element = document.createElement('span'); element.className = 'mission-destination'; element.setAttribute('aria-hidden', 'true'); r.destination = new maplibregl.Marker({ element }).setLngLat(c.commande.destination).addTo(map); }
        r.destination.setLngLat(c.commande.destination);
      } else { r.destination?.remove(); r.destination = undefined; }
      // Commerce affiche tant que le colis n'est pas collecte : premier arret de l'itineraire.
      const commerce = c.commande?.statut === 'AFFECTEE' ? c.commande.commerce : undefined;
      if (commerce) {
        if (!r.commerce) { const element = document.createElement('span'); element.className = 'mission-commerce'; element.title = c.commande?.nomCommerce ?? 'Commerce'; element.setAttribute('aria-hidden', 'true'); r.commerce = new maplibregl.Marker({ element }).setLngLat(commerce).addTo(map); }
        r.commerce.setLngLat(commerce);
      } else { r.commerce?.remove(); r.commerce = undefined; }
    }
  }, [coursiers, selection, prete, indisponible, mouvementReduit, suivi]);
  useEffect(() => {
    const map = carte.current; if (!map || !prete) return;
    (map.getSource('arcs') as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: arcs.map(a => ({ type: 'Feature', properties: { couleur: couleur(`--lot-${a.couleur % 5}`) }, geometry: { type: 'LineString', coordinates: a.points } })) });
    if (arcs.length && !coursiers.length) { const bornes = new maplibregl.LngLatBounds(); arcs.forEach(a => a.points.forEach(p => bornes.extend(p))); map.fitBounds(bornes, { padding: 70, maxZoom: 15, duration: mouvementReduit ? 0 : 600 }); }
  }, [arcs, coursiers.length, prete, raster, mouvementReduit, revisionStyle]);
  useEffect(() => {
    const map = carte.current; if (!map || !prete || !zonage) return;
    const fermer = (points: PointCarte[]) => {
      const premier = points[0], dernier = points[points.length - 1];
      return premier[0] === dernier[0] && premier[1] === dernier[1] ? points : [...points, premier];
    };
    (map.getSource('zones') as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: zonage.zones.filter(z => z.contour.length >= 3).map(z => ({ type: 'Feature', properties: { id: z.id, selectionnee: z.id === zonage.selection }, geometry: { type: 'Polygon', coordinates: [fermer(z.contour)] } })) });
    const points = zonage.sommets;
    dessinerTrace(map, points);
    if (!points.length) (map.getSource('zone-apercu') as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: [] });
    // Sommets : reperes HTML deplacables (glisser), clic = selection, clic droit / double-clic = suppression.
    // Poignees au milieu de chaque cote : clic = nouveau sommet insere a cet endroit.
    const sommets = reperesSommets.current, milieux = reperesMilieux.current;
    const editable = zonage.edition && !!zonage.onSommets;
    while (sommets.length > (editable ? points.length : 0)) sommets.pop()!.remove();
    const geste = () => { dernierGeste.current = performance.now(); };
    points.forEach((p, i) => {
      if (!editable) return;
      let m = sommets[i];
      if (!m) {
        const el = document.createElement('button'); el.type = 'button'; el.className = 'zone-sommet';
        const indexDe = () => sommets.indexOf(m!);
        el.addEventListener('mousedown', geste);
        el.addEventListener('click', ev => { ev.stopPropagation(); geste(); donnees.current.zonage?.onChoisir?.(indexDe()); });
        const supprimer = (ev: Event) => { ev.preventDefault(); ev.stopPropagation(); geste(); const z = donnees.current.zonage; if (!z?.onSommets) return; const i2 = indexDe(); z.onSommets(z.sommets.filter((_, k) => k !== i2)); z.onChoisir?.(undefined); };
        el.addEventListener('contextmenu', supprimer); el.addEventListener('dblclick', supprimer);
        m = new maplibregl.Marker({ element: el, draggable: true }).setLngLat(p).addTo(map);
        m.on('dragstart', () => { geste(); donnees.current.zonage?.onChoisir?.(indexDe()); });
        m.on('drag', () => { geste(); const z = donnees.current.zonage; if (!z) return; const ll = m!.getLngLat(), i2 = indexDe(); dessinerTrace(map, z.sommets.map((q, k) => k === i2 ? [ll.lng, ll.lat] as PointCarte : q)); });
        m.on('dragend', () => { geste(); const z = donnees.current.zonage; if (!z?.onSommets) return; const ll = m!.getLngLat(), i2 = indexDe(); z.onSommets(z.sommets.map((q, k) => k === i2 ? [ll.lng, ll.lat] as PointCarte : q)); });
        sommets[i] = m;
      }
      const el = m.getElement();
      el.textContent = String(i + 1); el.setAttribute('aria-label', `Sommet ${i + 1} : glisser pour déplacer, clic droit pour supprimer`);
      el.dataset.choisi = String(zonage.sommetChoisi === i);
      m.setLngLat(p);
    });
    const nbMilieux = editable && points.length >= 2 ? (points.length >= 3 ? points.length : 1) : 0;
    while (milieux.length > nbMilieux) milieux.pop()!.remove();
    for (let i = 0; i < nbMilieux; i++) {
      const a = points[i], b = points[(i + 1) % points.length], milieu: PointCarte = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      let m = milieux[i];
      if (!m) {
        const el = document.createElement('button'); el.type = 'button'; el.className = 'zone-milieu'; el.setAttribute('aria-label', 'Ajouter un sommet ici');
        el.addEventListener('mousedown', geste);
        el.addEventListener('click', ev => {
          ev.stopPropagation(); geste();
          const z = donnees.current.zonage; if (!z?.onSommets || z.sommets.length >= 200) return;
          const k = milieux.indexOf(m!), ll = m!.getLngLat();
          z.onSommets([...z.sommets.slice(0, k + 1), [ll.lng, ll.lat], ...z.sommets.slice(k + 1)]); z.onChoisir?.(k + 1);
        });
        m = new maplibregl.Marker({ element: el }).setLngLat(milieu).addTo(map); milieux[i] = m;
      }
      m.setLngLat(milieu);
    }
  }, [zonage, prete, revisionStyle]);
  useEffect(() => () => { for (const m of [...reperesSommets.current, ...reperesMilieux.current]) m.remove(); reperesSommets.current = []; reperesMilieux.current = []; }, []);
  // Pendant le trace : vue 2D du dessus, plus precise pour poser les points (la vue 3D reste disponible).
  useEffect(() => { if (zonage?.edition) setVue3d(false); }, [zonage?.edition]);
  useEffect(() => {
    const map = carte.current, z = donnees.current.zonage;
    if (map && prete && z) cadrerZones(map, z, mouvementReduit);
  }, [zonage?.selection, prete, revisionStyle, mouvementReduit]);
  useEffect(() => {
    const map = carte.current, c = donnees.current.coursiers.find(c => c.id === selection);
    if (!map || !prete || !c) return;
    map.flyTo({ center: c.position, zoom: 15.8, duration: mouvementReduit ? 0 : 900 });
    // Une mise à jour GPS ne doit pas relancer un vol de sélection.
  }, [selection, prete, mouvementReduit]);
  useEffect(() => { const map = carte.current; if (map && prete) map.easeTo({ pitch: vue3d && !raster ? 58 : 0, bearing: vue3d && !raster ? -18 : 0, duration: mouvementReduit ? 0 : 450 }); }, [vue3d, raster, prete, mouvementReduit]);
  // Commerces et clients : reperes HTML (quelques dizaines), fiche dans une bulle au clic.
  const reperesPoi = useRef(new Map<string, maplibregl.Marker>()), bulle = useRef<maplibregl.Popup | null>(null);
  useEffect(() => {
    const map = carte.current; if (!map || !prete || indisponible) return;
    const vus = new Set<string>();
    for (const p of poi) {
      vus.add(p.id);
      let m = reperesPoi.current.get(p.id);
      if (!m) {
        const el = document.createElement('button'); el.type = 'button'; el.className = 'mission-poi';
        el.addEventListener('click', ev => {
          ev.stopPropagation();
          const actuel = (el as HTMLButtonElement & { poi?: PoiCarte }).poi; if (!actuel) return;
          bulle.current?.remove();
          const contenu = document.createElement('div'); contenu.className = 'mission-bulle';
          const titre = document.createElement('strong'); titre.textContent = actuel.titre; contenu.append(titre);
          for (const l of actuel.lignes) { const ligne = document.createElement('span'); ligne.textContent = l; contenu.append(ligne); }
          bulle.current = new maplibregl.Popup({ offset: 18, closeButton: true, maxWidth: '260px' }).setLngLat(actuel.position).setDOMContent(contenu).addTo(map);
          if (actuel.livreurId != null) donnees.current.onSelection?.(actuel.livreurId);
        });
        m = new maplibregl.Marker({ element: el }).setLngLat(p.position).addTo(map);
        reperesPoi.current.set(p.id, m);
      }
      const el = m.getElement() as HTMLButtonElement & { poi?: PoiCarte };
      el.poi = p; el.dataset.type = p.type; el.dataset.lie = String(!!p.lie); el.dataset.actif = String(p.actif !== false);
      el.innerHTML = svgIcone(p.type, 15);
      el.setAttribute('aria-label', `${p.type === 'commerce' ? 'Commerce' : 'Client'} : ${p.titre}`);
      m.setLngLat(p.position);
    }
    for (const [id, m] of reperesPoi.current) if (!vus.has(id)) { m.remove(); reperesPoi.current.delete(id); }
  }, [poi, prete, indisponible, revisionStyle]);
  useEffect(() => () => { for (const m of reperesPoi.current.values()) m.remove(); reperesPoi.current.clear(); bulle.current?.remove(); }, []);
  // Bulles de densite : halo (heatmap) + badge chiffre cliquable ; cercles de quartier en metres.
  const reperesBulles = useRef(new Map<string, maplibregl.Marker>()), cadreDonnees = useRef('');
  useEffect(() => {
    const map = carte.current; if (!map || !prete || indisponible) return;
    (map.getSource('chaleur') as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: bulles.map(b => ({ type: 'Feature', properties: { poids: Math.max(.08, b.intensite) }, geometry: { type: 'Point', coordinates: b.position } })) });
    (map.getSource('cercles') as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: cercles.map(c => ({ type: 'Feature', properties: { id: c.id, actif: c.actif }, geometry: { type: 'Polygon', coordinates: [polygoneCercle(c.centre, c.rayonMetres)] } })) });
    const vus = new Set<string>();
    for (const b of bulles) {
      vus.add(b.id);
      let m = reperesBulles.current.get(b.id);
      if (!m) {
        const el = document.createElement('button'); el.type = 'button'; el.className = 'mission-densite';
        el.addEventListener('click', ev => { ev.stopPropagation(); const d = (el as HTMLButtonElement & { bulle?: BulleCarte }).bulle; if (d) ouvrirFiche(map, d.position, d.titre, d.lignes); });
        m = new maplibregl.Marker({ element: el }).setLngLat(b.position).addTo(map); reperesBulles.current.set(b.id, m);
      }
      const el = m.getElement() as HTMLButtonElement & { bulle?: BulleCarte };
      el.bulle = b; el.textContent = String(b.valeur); el.dataset.vide = String(b.valeur === 0); el.setAttribute('aria-label', `${b.titre} : ${b.valeur} commande(s)`);
      el.style.setProperty('--intensite', String(Math.round(b.intensite * 100)));
      el.style.setProperty('--taille', `${b.valeur === 0 ? 24 : Math.round(30 + b.intensite * 26)}px`);
      m.setLngLat(b.position);
    }
    for (const [id, m] of reperesBulles.current) if (!vus.has(id)) { m.remove(); reperesBulles.current.delete(id); }
    // Premier affichage des donnees : cadrage sur toutes les bulles / tous les cercles.
    const points = [...bulles.map(b => b.position), ...cercles.flatMap(c => polygoneCercle(c.centre, c.rayonMetres).filter((_, i) => i % 16 === 0))];
    const cle = [...bulles.map(b => b.id), ...cercles.map(c => c.id)].join(',');
    if (points.length && !coursiers.length && cle !== cadreDonnees.current) {
      cadreDonnees.current = cle;
      const bornes = new maplibregl.LngLatBounds(); points.forEach(p => bornes.extend(p));
      const camera = map.cameraForBounds(bornes, { padding: 60, maxZoom: 15.5 });
      if (camera?.center) map.jumpTo({ center: camera.center, zoom: Math.max(3, (camera.zoom ?? 13) - (map.getPitch() > 10 ? .5 : 0)) });
    }
  }, [bulles, cercles, prete, indisponible, revisionStyle, coursiers.length]);
  useEffect(() => () => { for (const m of reperesBulles.current.values()) m.remove(); reperesBulles.current.clear(); }, []);
  useEffect(() => {
    const map = carte.current; if (!map || !prete || !cadrage || cadrage.points.length < 1) return;
    setSuivi(false);
    const bornes = new maplibregl.LngLatBounds(); cadrage.points.forEach(p => bornes.extend(p));
    // Ecran large : les panneaux flottent sur la carte, on laisse leur place ; ecran etroit : ils sont sous la carte.
    const large = map.getContainer().clientWidth >= 1100;
    // fitBounds cadre mal une carte inclinee : camera calculee a plat, puis appliquee en gardant l'inclinaison 3D.
    const camera = map.cameraForBounds(bornes, { padding: large ? { top: 90, bottom: 70, left: 300, right: 330 } : 60, maxZoom: 16, bearing: map.getBearing() });
    if (camera?.center) map.easeTo({ center: camera.center, zoom: Math.max(3, (camera.zoom ?? 14) - (map.getPitch() > 10 ? .6 : 0)), duration: mouvementReduit ? 0 : 900 });
  }, [cadrage?.cle, prete]);
  const choisi = coursiers.find(c => c.id === selection);
  return <div className="mission-carte" data-testid="carte-mission">
    <div ref={conteneur} className="mission-fond" hidden={indisponible} />
    {indisponible && <Schema2D coursiers={coursiers} arcs={arcs} selection={selection} zonage={zonage} />}
    <div className="mission-outils" role="group" aria-label="Affichage de la carte">
      <button type="button" aria-pressed={!vue3d} onClick={() => setVue3d(false)}>Vue 2D</button>
      <button type="button" disabled={indisponible || raster} aria-pressed={vue3d} onClick={() => setVue3d(true)}>Vue 3D</button>
      {zonage && <button type="button" disabled={indisponible} onClick={() => { if (carte.current) cadrerZones(carte.current, zonage, mouvementReduit); }}>Recentrer</button>}
      {zonage && <><button type="button" aria-label="Zoomer sur les bâtiments" disabled={indisponible} onClick={() => carte.current?.zoomIn({ duration: mouvementReduit ? 0 : 200 })}>+</button><button type="button" aria-label="Dézoomer" disabled={indisponible} onClick={() => carte.current?.zoomOut({ duration: mouvementReduit ? 0 : 200 })}>−</button></>}
      {!!coursiers.length && <button type="button" aria-pressed={suivi} onClick={() => { setSuivi(!suivi); if (!suivi && choisi) carte.current?.easeTo({ center: choisi.position, duration: mouvementReduit ? 0 : 600 }); }}>{suivi ? 'Suivi' : 'Libre'}</button>}
    </div>
    {message && <p className="mission-message" role="status">{message}</p>}
    <div className="mission-legende">{legende ? <span>{legende}</span> : zonage ? <span>{zonage.edition ? `${zonage.sommets.length} / 200 sommets · ${indisponible ? 'saisissez les coordonnées ci-dessous' : 'cliquez pour tracer'}` : 'Contours de livraison · ambre : zone sélectionnée'}</span> : arcs.length && !coursiers.length ? <span>Arcs des lots · départ indicatif ou dépôt renseigné</span> : <><span>● Livreur</span><span><Icone nom="commerce" taille={12} /> Commerce</span><span><Icone nom="client" taille={12} /> Client</span><span>━ Itinéraire routier</span></>}</div>
  </div>;
}

function Schema2D({ coursiers, arcs, selection, zonage }: { coursiers: CoursierCarte[]; arcs: ArcCarte[]; selection?: number; zonage?: ZonageCarte }) {
  const points = [...coursiers.flatMap(c => [c.position, ...(c.commande ? [c.commande.destination] : [])]), ...arcs.flatMap(a => a.points), ...(zonage?.zones.flatMap(z => z.contour) ?? []), ...(zonage?.sommets ?? [])];
  const ouest = Math.min(...points.map(p => p[0]), CENTRE_TUNIS[0]) - .003, est = Math.max(...points.map(p => p[0]), CENTRE_TUNIS[0]) + .003;
  const sud = Math.min(...points.map(p => p[1]), CENTRE_TUNIS[1]) - .002, nord = Math.max(...points.map(p => p[1]), CENTRE_TUNIS[1]) + .002;
  const xy = (p: PointCarte) => `${40 + (p[0] - ouest) / (est - ouest) * 720},${460 - (p[1] - sud) / (nord - sud) * 420}`;
  return <svg className="mission-schema" viewBox="0 0 800 500" role="img" aria-label={zonage ? 'Contours des zones en vue schématique 2D. Saisie des sommets disponible dans le formulaire.' : 'Positions en vue schématique 2D, sans fond géographique'}>
    {zonage?.zones.map(z => <polygon key={z.id} className="zone-schema" data-selectionnee={z.id === zonage.selection} points={z.contour.map(xy).join(' ')} />)}
    {zonage && (zonage.sommets.length >= 3 ? <polygon className="zone-schema" data-selectionnee="true" points={zonage.sommets.map(xy).join(' ')} /> : <polyline points={zonage.sommets.map(xy).join(' ')} />)}
    {zonage?.sommets.map((p, i) => <circle key={i} cx={xy(p).split(',')[0]} cy={xy(p).split(',')[1]} r="5" />)}
    {arcs.map((a, i) => <polyline key={i} points={a.points.map(xy).join(' ')} style={{ stroke: `var(--lot-${a.couleur % 5})` }} />)}
    {coursiers.map(c => { const [x, y] = xy(c.position).split(','); return <g key={c.id}>
      {c.commande && <><polyline className="mission-direction" points={`${xy(c.position)} ${xy(c.commande.destination)}`} /><circle cx={xy(c.commande.destination).split(',')[0]} cy={xy(c.commande.destination).split(',')[1]} r="6" /></>}
      <circle cx={x} cy={y} r={c.id === selection ? 12 : 8} /><text x={x} y={Number(y) - 22} textAnchor="middle">{c.nom.split(' ')[0]}</text>
    </g>; })}
  </svg>;
}
