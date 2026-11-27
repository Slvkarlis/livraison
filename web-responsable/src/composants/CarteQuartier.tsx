import { lazy, Suspense, useMemo } from 'react';
import type { GroupeQuartierAdmin } from '../quartierApi';
import { pointValide, type CercleCarte } from '../suivi';

// Meme moteur et meme style que le suivi en direct (MapLibre, fond sombre 3D) : rayon de chaque groupe en metres.
const CarteMission = lazy(() => import('./CarteMission'));

export function CarteQuartier({ groupes }: { groupes: GroupeQuartierAdmin[] }) {
  const cercles = useMemo<CercleCarte[]>(() => groupes.filter(g => pointValide(g.longitude, g.latitude)).map(g => ({
    id: `g${g.id}`, centre: [g.longitude, g.latitude], rayonMetres: g.rayonMetres, actif: g.statut === 'OUVERT',
    titre: g.commerce, lignes: [`${g.nbMembres}/3 membres · ${g.statut.toLowerCase()}`, `Rayon : ${g.rayonMetres} m`],
  })), [groupes]);
  return <div className="mission mission-lots">
    <Suspense fallback={<p className="mission-message" role="status">Chargement de la carte…</p>}>
      <CarteMission cercles={cercles} legende={`${cercles.length} groupe(s) · ambre : ouvert · gris : fermé · rayon en mètres`} />
    </Suspense>
  </div>;
}
