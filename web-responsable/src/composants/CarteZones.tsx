import { useEffect, useRef, useState } from 'react';
import type { Position, Zone } from '../../../mobile/packages/shared/src/sprint2';

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
  // La page locale est de confiance ; son origine permet au navigateur d'envoyer le Referer requis par OSM.
  return <>{erreur && <p role="alert">Carte indisponible. Saisissez les coordonnées des sommets ci-dessous.</p>}<iframe ref={cadre} title="Tracer une zone sur OpenStreetMap" aria-busy={!configuree && !erreur} sandbox="allow-scripts allow-same-origin" src="/carte-zones.html" style={{ width: '100%', height: 340, border: '1px solid #E5E7EB', borderRadius: 12 }} /></>;
}
