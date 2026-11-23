import type { Theme } from '@fleetpulse/shared';

/** Application client : meme famille que le web (graphite et ambre), claire et arrondie. */
export const theme: Theme = {
  sombre: false,
  fond: '#ECEBE7',
  surface: '#FFFFFF',
  surfaceAlt: '#F6F5F2',
  texte: '#15171A',
  secondaire: '#6B6F76',
  bordure: '#DADAD5',
  accent: '#F2B233',
  surAccent: '#15171A',
  accentDoux: '#FDF3DC',
  erreur: '#C8312B',
  erreurFond: '#FBE9E7',
  succes: '#1F7A4D',
  rayon: 16,
  ombre: true,
};

/** Centre de Tunis (= depot), utilise tant que le client n'a pas place son adresse. */
export const TUNIS = { latitude: 36.8065, longitude: 10.1815 };
