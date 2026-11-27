import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Position, Zone } from '../../../mobile/packages/shared/src/sprint2';
import { contourSeCroise, pointValide, type PointCarte, type ZonageCarte } from '../suivi';
import { formatMontant } from '../format';

const CarteMission = lazy(() => import('./CarteMission'));

const versPosition = ([longitude, latitude]: PointCarte): Position => ({ latitude, longitude });

export default function CarteZones({ zones, points, edition, onPoints }: { zones: Zone[]; points: Position[]; edition: boolean; onPoints: (p: Position[]) => void }) {
  const [selection, setSelection] = useState<number>();
  const [choisi, setChoisi] = useState<number>();
  // Historique du trace : chaque modification faite sur la carte peut etre annulee puis retablie.
  const passe = useRef<Position[][]>([]), futur = useRef<Position[][]>([]), [, setRevision] = useState(0);
  const actuel = useRef(points); actuel.current = points;
  useEffect(() => {
    if (!edition && !zones.some(z => z.id === selection)) setSelection(zones[0]?.id);
  }, [zones, selection, edition]);

  const changer = useCallback((nouveaux: Position[]) => {
    passe.current.push(actuel.current); if (passe.current.length > 100) passe.current.shift();
    futur.current = []; setRevision(r => r + 1); onPoints(nouveaux);
  }, [onPoints]);
  const annuler = useCallback(() => {
    const precedent = passe.current.pop(); if (!precedent) return;
    futur.current.push(actuel.current); setRevision(r => r + 1); setChoisi(undefined); onPoints(precedent);
  }, [onPoints]);
  const retablir = useCallback(() => {
    const suivant = futur.current.pop(); if (!suivant) return;
    passe.current.push(actuel.current); setRevision(r => r + 1); setChoisi(undefined); onPoints(suivant);
  }, [onPoints]);
  const supprimerChoisi = useCallback(() => {
    if (choisi == null || choisi >= actuel.current.length) return;
    changer(actuel.current.filter((_, i) => i !== choisi)); setChoisi(undefined);
  }, [choisi, changer]);

  // Raccourcis pendant le trace (hors champs de saisie) : Ctrl+Z, Ctrl+Y / Ctrl+Maj+Z, Suppr.
  useEffect(() => {
    if (!edition) return;
    const touche = (e: KeyboardEvent) => {
      const cible = e.target as HTMLElement | null;
      if (cible && ['INPUT', 'TEXTAREA', 'SELECT'].includes(cible.tagName)) return;
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); annuler(); }
      else if (ctrl && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); retablir(); }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && choisi != null) { e.preventDefault(); supprimerChoisi(); }
      else if (e.key === 'Escape') setChoisi(undefined);
    };
    window.addEventListener('keydown', touche);
    return () => window.removeEventListener('keydown', touche);
  }, [edition, annuler, retablir, supprimerChoisi, choisi]);

  const sommets = useMemo(() => points.filter(p => pointValide(p.longitude, p.latitude)).map(p => [p.longitude, p.latitude] as PointCarte), [points]);
  const croise = contourSeCroise(sommets);
  const zonage = useMemo<ZonageCarte>(() => ({
    zones: zones.map(z => ({ id: z.id, nom: z.nom, contour: z.polygone.filter(p => pointValide(p.longitude, p.latitude)).map(p => [p.longitude, p.latitude]) })),
    sommets, edition, selection: edition ? undefined : selection, onSelection: setSelection,
    onPoint: (p: PointCarte) => changer([...actuel.current, versPosition(p)]),
    onSommets: (s: PointCarte[]) => changer(s.map(versPosition)),
    sommetChoisi: choisi, onChoisir: setChoisi,
  }), [zones, sommets, edition, selection, changer, choisi]);

  return <section className="zones-geographie" aria-label={edition ? 'Tracer le contour de la zone' : 'Couverture des zones en 3D'}>
    {edition && <div className="zones-outils" role="toolbar" aria-label="Outils de tracé">
      <button type="button" className="bouton secondaire" disabled={!passe.current.length} onClick={annuler} title="Ctrl+Z">Annuler</button>
      <button type="button" className="bouton secondaire" disabled={!futur.current.length} onClick={retablir} title="Ctrl+Y">Rétablir</button>
      <button type="button" className="bouton secondaire" disabled={choisi == null} onClick={supprimerChoisi} title="Suppr">
        {choisi == null ? 'Supprimer le point choisi' : `Supprimer le point ${choisi + 1}`}</button>
      <button type="button" className="bouton secondaire" disabled={!points.length} onClick={() => { changer([]); setChoisi(undefined); }}>Tout effacer</button>
      {croise && <span className="zones-alerte" role="alert">Le contour se croise : déplacez un point (en rouge sur la carte).</span>}
    </div>}
    <div className="mission mission-zones">
      <Suspense fallback={<p className="mission-message" role="status">Chargement de la carte 3D des zones…</p>}><CarteMission zonage={zonage} /></Suspense>
    </div>
    {!edition && !!zones.length && <ul className="zones-selection" aria-label="Sélectionner une zone sur la carte">{zones.map(z => <li key={z.id}><button type="button" className="bouton secondaire" aria-pressed={selection === z.id} onClick={() => setSelection(z.id)}><strong>{z.nom}</strong><span>{formatMontant(z.fraisLivraison)}</span></button></li>)}</ul>}
    {edition && <p className="discret">Clic sur la carte : ajouter un sommet · glisser un sommet : le déplacer · petit rond au milieu d’un côté : insérer un sommet · clic droit ou double-clic sur un sommet : le supprimer · Ctrl+Z / Ctrl+Y : annuler / rétablir. Les coordonnées restent modifiables ci-dessous.</p>}
  </section>;
}
