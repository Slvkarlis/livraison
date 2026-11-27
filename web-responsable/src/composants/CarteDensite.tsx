import { lazy, Suspense, useMemo } from 'react';
import type { ZoneBi } from '../../../mobile/packages/shared/src/bi';
import { pointValide, type BulleCarte } from '../suivi';

// Meme moteur et meme style que le suivi en direct (MapLibre, fond sombre 3D).
const CarteMission = lazy(() => import('./CarteMission'));

export default function CarteDensite({ zones }: { zones: ZoneBi[] }) {
  const bulles = useMemo<BulleCarte[]>(() => {
    const max = Math.max(1, ...zones.map(z => z.commandes));
    return zones.filter(z => pointValide(z.longitude, z.latitude)).map(z => ({
      id: `z${z.id}`, position: [z.longitude, z.latitude], valeur: z.commandes, intensite: z.commandes / max, titre: z.nom,
      lignes: [`${z.commandes} commande(s) sur la période`, `${z.livrees} livrée(s)`, `${z.commandesActives} active(s) maintenant`,
        `${z.coursiersDisponibles} coursier(s) disponible(s)`, `Couverture : ${z.couverturePourcent == null ? 'non disponible' : `${z.couverturePourcent} %`}`],
    }));
  }, [zones]);
  return <section><h2>Carte thermique par zone</h2>
    <p className="bi-legende">Halo et badge au centre de chaque zone : taille et couleur proportionnelles aux commandes créées sur la période. Cliquez sur un badge pour le détail. Aucune adresse client affichée ; le tableau ci-dessous fournit les mêmes valeurs.</p>
    <div className="mission mission-lots">
      <Suspense fallback={<p className="mission-message" role="status">Chargement de la carte…</p>}>
        <CarteMission bulles={bulles} legende="Densité des commandes · chiffre = commandes de la période" />
      </Suspense>
    </div>
  </section>;
}
