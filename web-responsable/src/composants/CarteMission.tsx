import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource, Map as Carte, StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { CENTRE_TUNIS, type ArcCarte, type CoursierCarte, type PointCarte, type ZonageCarte } from '../suivi';

interface Props { coursiers?: CoursierCarte[]; selection?: number; onSelection?: (id: number) => void; arcs?: ArcCarte[]; zonage?: ZonageCarte }
maplibregl.setWorkerUrl(workerUrl);
maplibregl.setWorkerCount(2);
const AUCUN: CoursierCarte[] = [], AUCUN_ARC: ArcCarte[] = [];
const couleur = (nom: string) => getComputedStyle(document.documentElement).getPropertyValue(nom).trim();
function styleCarte(raster = false): StyleSpecification {
  return { version: 8, sources: raster ? { fond: { type: 'raster', tiles: ['https://basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png'], tileSize: 256, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/attributions">CARTO</a>' } } : { fond: { type: 'vector', url: 'https://tiles.openfreemap.org/planet', attribution: '© <a href="https://openfreemap.org">OpenFreeMap</a> © <a href="https://www.openmaptiles.org/">OpenMapTiles</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' } },
    layers: [{ id: 'sol', type: 'background', paint: { 'background-color': couleur('--carte-sol') } }, ...(raster ? [{ id: 'raster', type: 'raster' as const, source: 'fond' }] : [
      { id: 'eau', type: 'fill' as const, source: 'fond', 'source-layer': 'water', paint: { 'fill-color': couleur('--carte-eau') } },
      { id: 'routes', type: 'line' as const, source: 'fond', 'source-layer': 'transportation', paint: { 'line-color': couleur('--carte-route'), 'line-width': 2 } },
      { id: 'batiments', type: 'fill-extrusion' as const, source: 'fond', 'source-layer': 'building', minzoom: 14, paint: { 'fill-extrusion-color': couleur('--carte-batiment'), 'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 9], 'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0], 'fill-extrusion-opacity': .85 } } as maplibregl.FillExtrusionLayerSpecification,
    ])] };
}

function cadrerZones(map: Carte, zonage: ZonageCarte, reduit: boolean) {
  const choisie = zonage.zones.find(z => z.id === zonage.selection);
  const points = zonage.edition && zonage.sommets.length ? zonage.sommets : choisie ? choisie.contour : zonage.zones.flatMap(z => z.contour);
  if (!points.length) return;
  const bornes = new maplibregl.LngLatBounds(); points.forEach(p => bornes.extend(p));
  map.fitBounds(bornes, { padding: { top: 90, bottom: 65, left: 45, right: 45 }, maxZoom: 15.8, duration: reduit ? 0 : 650 });
}

export default function CarteMission({ coursiers = AUCUN, selection, onSelection, arcs = AUCUN_ARC, zonage }: Props) {
  const conteneur = useRef<HTMLDivElement>(null), carte = useRef<Carte | null>(null);
  const [prete, setPrete] = useState(false), [indisponible, setIndisponible] = useState(false);
  const [revisionStyle, setRevisionStyle] = useState(0);
  const [message, setMessage] = useState('Chargement du fond de carte…');
  const [raster, setRaster] = useState(false), [vue3d, setVue3d] = useState(true), [suivi, setSuivi] = useState(true);
  const [mouvementReduit, setMouvementReduit] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const donnees = useRef({ coursiers, selection, arcs, suivi, mouvementReduit, onSelection, zonage });
  donnees.current = { coursiers, selection, arcs, suivi, mouvementReduit, onSelection, zonage };
  const reperes = useRef(new Map<number, { marqueur: maplibregl.Marker; destination?: maplibregl.Marker; depart: PointCarte; cible: PointCarte; debut: number; trace: PointCarte[]; date: string }>());
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
      const z = donnees.current.zonage; if (!z) return;
      if (z.edition) { if (z.sommets.length < 200) z.onPoint([e.lngLat.lng, e.lngLat.lat]); return; }
      if (!map.getLayer('zones-fond')) return;
      const id = map.queryRenderedFeatures(e.point, { layers: ['zones-fond'] })[0]?.properties?.id;
      if (typeof id === 'number') z.onSelection?.(id);
    });
    map.on('mousemove', e => {
      const z = donnees.current.zonage; if (!z) return;
      map.getCanvas().style.cursor = z.edition ? 'crosshair' : map.getLayer('zones-fond') && map.queryRenderedFeatures(e.point, { layers: ['zones-fond'] }).length ? 'pointer' : '';
    });
    map.on('style.load', () => {
      if (detruit) return;
      for (const id of ['trajets', 'arcs']) map.addSource(id, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({ id: 'arcs', type: 'line', source: 'arcs', layout: { 'line-cap': 'round' }, paint: { 'line-color': ['get', 'couleur'], 'line-width': 3, 'line-opacity': .85 } });
      map.addLayer({ id: 'trajets-halo', type: 'line', source: 'trajets', filter: ['==', ['get', 'passe'], true], paint: { 'line-color': couleur('--accent'), 'line-width': 12, 'line-blur': 7, 'line-opacity': .24 } });
      map.addLayer({ id: 'trajets', type: 'line', source: 'trajets', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': couleur('--accent'), 'line-width': 3, 'line-opacity': ['case', ['get', 'passe'], .95, .24] } });
      if (donnees.current.zonage) {
        for (const id of ['zones', 'zone-edition', 'zone-sommets']) map.addSource(id, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addLayer({ id: 'zones-fond', type: 'fill', source: 'zones', paint: { 'fill-color': couleur('--accent'), 'fill-opacity': ['case', ['get', 'selectionnee'], .16, .04] } });
        map.addLayer({ id: 'zones-contours', type: 'line', source: 'zones', paint: { 'line-color': ['case', ['get', 'selectionnee'], couleur('--accent'), couleur('--sur-nuit-discret')], 'line-width': ['case', ['get', 'selectionnee'], 3, 1.5] } });
        map.addLayer({ id: 'zone-edition-fond', type: 'fill', source: 'zone-edition', filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': couleur('--accent'), 'fill-opacity': .18 } });
        map.addLayer({ id: 'zone-edition-contour', type: 'line', source: 'zone-edition', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': couleur('--accent'), 'line-width': 3 } });
        map.addLayer({ id: 'zone-sommets', type: 'circle', source: 'zone-sommets', paint: { 'circle-radius': 5, 'circle-color': couleur('--accent'), 'circle-stroke-color': couleur('--sur-nuit'), 'circle-stroke-width': 2 } });
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
      for (const c of actuels) {
        const repere = reperes.current.get(c.id); if (!repere) continue;
        const t = reduit ? 1 : Math.min(1, Math.max(0, (temps - repere.debut) / 2000));
        const position: PointCarte = [repere.depart[0] + (repere.cible[0] - repere.depart[0]) * t, repere.depart[1] + (repere.cible[1] - repere.depart[1]) * t];
        repere.marqueur.setLngLat(position);
        if (c.id === choisi && suivre && !map.isMoving() && !reduit) {
          const centre = map.getCenter(); map.jumpTo({ center: [centre.lng + (position[0] - centre.lng) * .08, centre.lat + (position[1] - centre.lat) * .08] });
        }
        if (repere.trace.length > 0) features.push({ type: 'Feature', properties: { passe: true }, geometry: { type: 'LineString', coordinates: [...repere.trace, position] } });
        if (c.commande) features.push({ type: 'Feature', properties: { passe: false }, geometry: { type: 'LineString', coordinates: [position, c.commande.destination] } });
      }
      if (actuels.length && temps - dernierRendu > 120 && map.getSource('trajets')) {
        (map.getSource('trajets') as GeoJSONSource).setData({ type: 'FeatureCollection', features }); dernierRendu = temps;
      }
    };
    animation = requestAnimationFrame(animer);
    return () => { detruit = true; cancelAnimationFrame(animation); clearTimeout(delai); observer.disconnect(); for (const r of reperes.current.values()) { r.marqueur.remove(); r.destination?.remove(); } reperes.current.clear(); map.remove(); carte.current = null; };
  }, []);
  useEffect(() => {
    const map = carte.current; if (!map || !prete || indisponible) return;
    if (!coursiers.length) (map.getSource('trajets') as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: [] });
    for (const [id, r] of reperes.current) if (!coursiers.some(c => c.id === id)) { r.marqueur.remove(); r.destination?.remove(); reperes.current.delete(id); }
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
    (map.getSource('zone-edition') as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: points.length < 2 ? [] : [{ type: 'Feature', properties: {}, geometry: points.length >= 3 ? { type: 'Polygon', coordinates: [fermer(points)] } : { type: 'LineString', coordinates: points } }] });
    (map.getSource('zone-sommets') as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: points.map((point, i) => ({ type: 'Feature', properties: { ordre: i + 1 }, geometry: { type: 'Point', coordinates: point } })) });
  }, [zonage, prete, revisionStyle]);
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
    <div className="mission-legende">{zonage ? <span>{zonage.edition ? `${zonage.sommets.length} / 200 sommets · ${indisponible ? 'saisissez les coordonnées ci-dessous' : 'cliquez pour tracer'}` : 'Contours de livraison · ambre : zone sélectionnée'}</span> : arcs.length && !coursiers.length ? <span>Arcs des lots · départ indicatif ou dépôt renseigné</span> : <><span>● Position</span><span>━ Trace observée</span><span>┄ Direction estimée</span></>}</div>
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
