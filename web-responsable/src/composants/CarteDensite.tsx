import { useEffect, useRef, useState } from 'react';
import type { ZoneBi } from '../../../mobile/packages/shared/src/bi';

export default function CarteDensite({ zones }: { zones: ZoneBi[] }) {
  const cadre = useRef<HTMLIFrameElement>(null);
  const [prete, setPrete] = useState(false), [erreur, setErreur] = useState(false);
  useEffect(() => {
    const recevoir = (e: MessageEvent) => {
      if (e.source !== cadre.current?.contentWindow) return;
      if (e.data?.type === 'densite-prete') setPrete(true);
      if (e.data?.type === 'densite-erreur') setErreur(true);
    };
    window.addEventListener('message', recevoir);
    const delai = window.setTimeout(() => setErreur(true), 15000);
    return () => { window.removeEventListener('message', recevoir); window.clearTimeout(delai); };
  }, []);
  useEffect(() => { if (prete) { setErreur(false); cadre.current?.contentWindow?.postMessage({ type: 'densite', zones }, window.location.origin); } }, [prete, zones]);
  return <section><h2>Carte thermique par zone</h2><p className="bi-legende">Une bulle au centre de chaque zone : rayon et couleur proportionnels aux commandes créées sur la période. Aucune adresse client affichée. Le tableau ci-dessous fournit les mêmes valeurs.</p>
    {erreur && <p role="alert">Carte indisponible. Consultez les valeurs dans le tableau des zones.</p>}
    <iframe ref={cadre} title="Densité des commandes par zone" src="/carte-bi.html" sandbox="allow-scripts allow-same-origin" style={{ width: '100%', height: 340, border: 0, borderRadius: 12 }} />
  </section>;
}
