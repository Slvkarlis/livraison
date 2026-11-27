import {
  calculerItineraire, doitRecalculer, memesArrets, progression,
  type Coord, type ItineraireRoutier, type Livraison, type SuiviCommande,
} from '@fleetpulse/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { EtatSuivi, PhaseSuivi } from './carteSuiviPage';

const EN_LIVRAISON = ['RECUPEREE', 'EN_COURS', 'A_PROXIMITE', 'ARRIVEE'];

function phaseDe(statut: Livraison['statut']): PhaseSuivi {
  if (statut === 'LIVREE') return 'livree';
  if (EN_LIVRAISON.includes(statut)) return 'livraison';
  return statut === 'AFFECTEE' ? 'collecte' : 'preparation';
}

/**
 * Etat de la carte de suivi du client, comme un GPS vu de l'exterieur :
 * - en preparation : trajet prevu commerce -> maison ;
 * - colis a bord : chemin deja parcouru par le livreur (gris) et itineraire restant (ambre) ;
 *   si le livreur s'ecarte du trace, l'itineraire restant est recalcule depuis sa position.
 */
export function useCarteSuivi(livraison: Livraison | null, suivi: SuiviCommande | null) {
  const phase = livraison ? phaseDe(livraison.statut) : 'preparation';
  const client = useMemo<Coord | null>(() => (livraison ? [livraison.longitude, livraison.latitude] : null), [livraison?.longitude, livraison?.latitude]); // eslint-disable-line react-hooks/exhaustive-deps
  const commerce = useMemo<Coord | null>(() => (suivi?.commerce ? [suivi.commerce.longitude, suivi.commerce.latitude] : null),
    [suivi?.commerce?.longitude, suivi?.commerce?.latitude]); // eslint-disable-line react-hooks/exhaustive-deps
  const livreur = useMemo<Coord | null>(() => (suivi?.livreur ? [suivi.livreur.longitude, suivi.livreur.latitude] : null),
    [suivi?.livreur?.longitude, suivi?.livreur?.latitude]); // eslint-disable-line react-hooks/exhaustive-deps

  const [itineraire, setItineraire] = useState<ItineraireRoutier>();
  /** Chemin parcouru avant le dernier recalcul (le nouvel itineraire part de la position du livreur). */
  const [faitAvant, setFaitAvant] = useState<Coord[]>([]);
  const enCours = useRef(false);

  // Arrets restants selon l'etape ; depart = livreur s'il est connu, sinon le commerce.
  const arrets = useMemo<Coord[]>(() => {
    if (!client) return [];
    if (phase === 'collecte' && livreur && commerce) return [commerce, client];
    return [client];
  }, [client, commerce, livreur, phase]);
  const depart = phase === 'livraison' || phase === 'collecte' ? livreur ?? commerce : commerce;

  useEffect(() => {
    if (!depart || !arrets.length || phase === 'livree' || enCours.current) return;
    // Premier calcul en livraison : on part du commerce pour pouvoir montrer le chemin deja fait.
    const premier = !itineraire || !memesArrets(itineraire, arrets);
    const origine = premier && phase === 'livraison' && commerce ? commerce : depart;
    if (!premier && !(livreur && doitRecalculer(itineraire, livreur, arrets))) return;
    enCours.current = true;
    const avant = !premier && itineraire && livreur ? cheminFait(itineraire, livreur) : [];
    void calculerItineraire(origine, arrets).then((it) => {
      setFaitAvant((f) => (premier ? [] : [...f, ...avant]));
      setItineraire(it);
    }).finally(() => { enCours.current = false; });
  }, [depart, arrets, phase, commerce, livreur, itineraire]);

  return useMemo(() => {
    if (!client || !livraison) return { etat: null as EtatSuivi | null, resteKm: null as number | null, resteMin: null as number | null, totalKm: null as number | null };
    const initiale = (suivi?.livreurPrenom ?? 'Livreur').split(' ')[0];
    const base = { phase, initiale, commerce, client, livreur: phase === 'livree' ? null : livreur };
    if (!itineraire || !memesArrets(itineraire, arrets)) {
      return { etat: { ...base, fait: [], restant: [] }, resteKm: null, resteMin: null, totalKm: null };
    }
    if (!livreur || phase === 'preparation') {
      return { etat: { ...base, fait: [], restant: itineraire.points }, resteKm: null, resteMin: null, totalKm: itineraire.distanceKm };
    }
    const p = progression(itineraire, livreur);
    return {
      etat: { ...base, fait: [...faitAvant, ...cheminFait(itineraire, livreur)], restant: p.restant },
      resteKm: p.resteKm, resteMin: p.resteMin, totalKm: itineraire.distanceKm,
    };
  }, [client, livraison, suivi?.livreurPrenom, phase, commerce, livreur, itineraire, arrets, faitAvant]);
}

/** Partie du trace deja parcourue, jusqu'a la position du livreur projetee sur la route. */
function cheminFait(it: ItineraireRoutier, livreur: Coord): Coord[] {
  const p = progression(it, livreur);
  return [...it.points.slice(0, p.segment + 1), p.point];
}
