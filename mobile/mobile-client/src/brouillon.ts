import { useSyncExternalStore } from 'react';

/** Adresse choisie sur l'ecran carte, relue par le formulaire de commande. */
export type AdresseChoisie = { adresse: string; latitude: number; longitude: number };

let adresseCourante: AdresseChoisie | null = null;
const abonnes = new Set<() => void>();

export function definirAdresse(adresse: AdresseChoisie | null) {
  adresseCourante = adresse;
  abonnes.forEach((notifier) => notifier());
}

export function useAdresseChoisie(): AdresseChoisie | null {
  return useSyncExternalStore(
    (notifier) => {
      abonnes.add(notifier);
      return () => abonnes.delete(notifier);
    },
    () => adresseCourante,
  );
}
