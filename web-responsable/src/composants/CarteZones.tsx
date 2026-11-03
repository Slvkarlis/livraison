import { useEffect, useRef, useState } from 'react';
import type { Position, Zone } from '../../../mobile/packages/shared/src/sprint2';

// Même Leaflet/OpenStreetMap que la carte mobile existante, sans nouveau paquet d'interface.
const page = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css">
<style>html,body,#map{height:100%;margin:0}#aide{position:absolute;z-index:1000;background:white;bottom:0;left:0;padding:6px;font:13px sans-serif}</style></head><body>
<div id="map" aria-label="Carte des zones de livraison"></div><div id="aide">Cliquez pour ajouter les sommets. Les zones existantes sont en gris.</div>
<script src="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js" onerror="parent.postMessage({type:'carte-erreur'},'*')"></script>
<script>if(window.L){
const map=L.map('map').setView([36.8065,10.1815],12);L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© contributeurs OpenStreetMap'}).addTo(map);
const fond=L.layerGroup().addTo(map), trace=L.layerGroup().addTo(map);let points=[],edition=false,centre=false;
function dessiner(){trace.clearLayers();if(points.length>1)L.polygon(points,{color:'#4F46E5'}).addTo(trace);points.forEach((p,i)=>L.circleMarker(p,{radius:5}).bindTooltip(String(i+1)).addTo(trace));}
map.on('click',e=>{if(!edition)return;points.push([e.latlng.lat,e.latlng.lng]);dessiner();parent.postMessage({type:'sommets',points:points.map(p=>({latitude:p[0],longitude:p[1]}))},'*');});
window.addEventListener('message',e=>{if(e.source!==parent||e.data?.type!=='zones')return;const d=e.data;edition=d.edition;points=d.points.map(p=>[p.latitude,p.longitude]);fond.clearLayers();d.zones.forEach(z=>L.polygon(z.polygone.map(p=>[p.latitude,p.longitude]),{color:'#64748B',weight:2,fillOpacity:.12}).bindTooltip(document.createTextNode(z.nom+' · '+z.fraisLivraison+' DT')).addTo(fond));dessiner();document.getElementById('aide').textContent=edition?'Cliquez pour ajouter les sommets. Les zones existantes sont en gris.':'Couverture des zones existantes. Ouvrez une zone pour la modifier.';if(!centre){const b=L.featureGroup([...fond.getLayers(),...trace.getLayers()]).getBounds();if(b.isValid()){map.fitBounds(b,{padding:[20,20],maxZoom:14});centre=true;}}parent.postMessage({type:'carte-configuree'},'*');});
parent.postMessage({type:'carte-prete'},'*');} </script></body></html>`;
export default function CarteZones({ zones, points, edition, onPoints }: { zones: Zone[]; points: Position[]; edition: boolean; onPoints: (p: Position[]) => void }) {
  const cadre = useRef<HTMLIFrameElement>(null);
  const [erreur, setErreur] = useState(false), [prete, setPrete] = useState(false);
  const [configuree, setConfiguree] = useState(false);
  useEffect(() => {
    const message = (e: MessageEvent) => {
      if (e.source !== cadre.current?.contentWindow) return;
      if (e.data?.type === 'carte-erreur') setErreur(true);
      if (e.data?.type === 'carte-prete') setPrete(true);
      if (e.data?.type === 'carte-configuree') setConfiguree(true);
      if (edition && e.data?.type === 'sommets' && Array.isArray(e.data.points) && e.data.points.length <= 200) onPoints(e.data.points);
    };
    window.addEventListener('message', message); return () => window.removeEventListener('message', message);
  }, [edition, onPoints]);
  useEffect(() => { if (prete) cadre.current?.contentWindow?.postMessage({ type: 'zones', zones, points, edition }, '*'); }, [zones, points, edition, prete]);
  return <>{erreur && <p role="alert">Carte indisponible. Saisissez les coordonnées des sommets ci-dessous.</p>}<iframe ref={cadre} title="Tracer une zone sur OpenStreetMap" aria-busy={!configuree && !erreur} sandbox="allow-scripts" srcDoc={page} style={{ width: '100%', height: 340, border: '1px solid #E5E7EB', borderRadius: 12 }} /></>;
}
