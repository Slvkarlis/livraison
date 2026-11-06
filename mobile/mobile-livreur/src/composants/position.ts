import type { Position } from '@fleetpulse/shared';
import * as Location from 'expo-location';

const DELAI_MAX_MS = 15000;

/** Position GPS actuelle du coursier (le backend verifie qu'elle se trouve dans l'une de ses zones). */
export async function positionActuelle(): Promise<Position> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') throw new Error('Autorisez la localisation pour vous déclarer disponible.');
  // getCurrentPositionAsync n'a pas de delai maximal : on en impose un pour ne pas bloquer le bouton
  const { coords } = await avecDelaiMax(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
  return { latitude: coords.latitude, longitude: coords.longitude };
}

function avecDelaiMax<T>(promesse: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const minuterie = setTimeout(() => reject(new Error('Position introuvable : vérifiez que la localisation est activée.')), DELAI_MAX_MS);
    promesse.then(resolve, reject).finally(() => clearTimeout(minuterie));
  });
}

/**
 * Positions fixes proposees en mode demonstration uniquement (apercu navigateur, tests sans se deplacer).
 * Elles correspondent aux zones de demo « Tunis centre démo » et « Ariana démo ».
 */
export const POSITIONS_DEMO: { libelle: string; position: Position }[] = [
  { libelle: 'Tunis centre', position: { latitude: 36.81, longitude: 10.18 } },
  { libelle: 'Ariana', position: { latitude: 36.88, longitude: 10.18 } },
  { libelle: 'Hors zone', position: { latitude: 36.7, longitude: 10.4 } },
];
