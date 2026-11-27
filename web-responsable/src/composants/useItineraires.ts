import { useEffect, useRef, useState } from 'react';
import { calculerItineraire, doitRecalculer, memesArrets, type ItineraireRoutier } from '../../../mobile/packages/shared/src/itineraireRoutier';
import { arretsRestants, type CoursierCarte } from '../suivi';

export interface ItineraireSuivi { itineraire: ItineraireRoutier; recalculs: number }

/**
 * Itineraire routier de chaque coursier vers ses arrets restants (commerce puis client), comme un GPS :
 * recalcule quand l'objectif change (colis collecte) ou quand le coursier sort du trace.
 */
export function useItineraires(coursiers: CoursierCarte[]): Map<number, ItineraireSuivi> {
  const [itineraires, setItineraires] = useState(() => new Map<number, ItineraireSuivi>());
  const courant = useRef(itineraires), enCours = useRef(new Set<number>()), annulation = useRef(new AbortController());
  courant.current = itineraires;
  // Recree a chaque montage : en StrictMode le premier demontage simule annulerait sinon tous les calculs suivants.
  useEffect(() => {
    annulation.current = new AbortController();
    return () => { annulation.current.abort(); enCours.current.clear(); };
  }, []);
  useEffect(() => {
    const actifs = new Set(coursiers.map(c => c.id));
    if ([...courant.current.keys()].some(id => !actifs.has(id) || !coursiers.find(c => c.id === id)?.commande)) {
      setItineraires(m => new Map([...m].filter(([id]) => coursiers.find(c => c.id === id)?.commande)));
    }
    for (const c of coursiers) {
      const arrets = arretsRestants(c), precedent = courant.current.get(c.id);
      if (!arrets.length || enCours.current.has(c.id) || !doitRecalculer(precedent?.itineraire, c.position, arrets)) continue;
      enCours.current.add(c.id);
      void calculerItineraire(c.position, arrets, annulation.current.signal).then(itineraire => {
        setItineraires(m => {
          const avant = m.get(c.id), suite = new Map(m);
          // Meme objectif : c'est une deviation. Nouvel objectif (collecte faite) : nouveau trajet, pas un recalcul.
          const deviation = memesArrets(avant?.itineraire, itineraire.arrets);
          suite.set(c.id, { itineraire, recalculs: avant ? avant.recalculs + (deviation ? 1 : 0) : 0 });
          return suite;
        });
      }).catch(() => {}).finally(() => enCours.current.delete(c.id));
    }
  }, [coursiers]);
  return itineraires;
}
