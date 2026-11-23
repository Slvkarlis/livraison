import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import type { Position, Zone } from '../../../mobile/packages/shared/src/sprint2';
import { pointValide, type PointCarte, type ZonageCarte } from '../suivi';
import { formatMontant } from '../format';

const CarteMission = lazy(() => import('./CarteMission'));

export default function CarteZones({ zones, points, edition, onPoints }: { zones: Zone[]; points: Position[]; edition: boolean; onPoints: (p: Position[]) => void }) {
  const [selection, setSelection] = useState<number>();
  useEffect(() => {
    if (!edition && !zones.some(z => z.id === selection)) setSelection(zones[0]?.id);
  }, [zones, selection, edition]);
  const zonage = useMemo<ZonageCarte>(() => ({
    zones: zones.map(z => ({ id: z.id, nom: z.nom, contour: z.polygone.filter(p => pointValide(p.longitude, p.latitude)).map(p => [p.longitude, p.latitude]) })),
    sommets: points.filter(p => pointValide(p.longitude, p.latitude)).map(p => [p.longitude, p.latitude]),
    edition, selection: edition ? undefined : selection, onSelection: setSelection,
    onPoint: ([longitude, latitude]: PointCarte) => onPoints([...points, { latitude, longitude }]),
  }), [zones, points, edition, selection, onPoints]);
  return <section className="zones-geographie" aria-label={edition ? 'Tracer le contour de la zone' : 'Couverture des zones en 3D'}>
    <div className="mission mission-zones">
      <Suspense fallback={<p className="mission-message" role="status">Chargement de la carte 3D des zones…</p>}><CarteMission zonage={zonage} /></Suspense>
    </div>
    {!edition && !!zones.length && <ul className="zones-selection" aria-label="Sélectionner une zone sur la carte">{zones.map(z => <li key={z.id}><button type="button" className="bouton secondaire" aria-pressed={selection === z.id} onClick={() => setSelection(z.id)}><strong>{z.nom}</strong><span>{formatMontant(z.fraisLivraison)}</span></button></li>)}</ul>}
    {edition && <p className="discret">Vue 3D ou 2D : cliquez pour ajouter un sommet. Vous pouvez aussi saisir les coordonnées ci-dessous, annuler le dernier point ou effacer le tracé.</p>}
  </section>;
}
