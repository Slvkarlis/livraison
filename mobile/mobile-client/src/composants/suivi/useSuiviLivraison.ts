import { STATUTS_SUIVIS, api, usePositionsLivreur, type StatutLivraison, type SuiviCommande } from '@fleetpulse/shared';
import { useEffect, useState } from 'react';

/** Rafraichit « dans N min » sans attendre une nouvelle position. */
const HORLOGE_MS = 30_000;

/**
 * US-302 / US-303 : suivi d'une commande par le client. Recharge a chaque changement de statut,
 * puis suit le coursier position par position (/user/queue/positions) avec l'ETA actualisee.
 */
export function useSuiviLivraison(commandeId: number | null, statut: StatutLivraison | null) {
  const [suivi, setSuivi] = useState<SuiviCommande | null>(null);
  const [maintenant, setMaintenant] = useState(() => new Date());
  const suivable = commandeId !== null && statut !== null && STATUTS_SUIVIS.includes(statut);

  useEffect(() => {
    if (!suivable || commandeId === null) return;
    let actuel = true;
    api.suiviCommande(commandeId).then((s) => { if (actuel) setSuivi(s); }).catch(() => {});
    return () => { actuel = false; };
  }, [commandeId, statut, suivable]);

  usePositionsLivreur((p) => {
    if (p.commandeId !== commandeId) return;
    setSuivi((s) => s && { ...s, livreur: { latitude: p.latitude, longitude: p.longitude, date: p.date }, arriveeEstimee: p.arriveeEstimee });
  });

  useEffect(() => {
    if (!suivable) return;
    const minuterie = setInterval(() => setMaintenant(new Date()), HORLOGE_MS);
    return () => clearInterval(minuterie);
  }, [suivable]);

  return { suivi: suivable ? suivi : null, maintenant };
}
