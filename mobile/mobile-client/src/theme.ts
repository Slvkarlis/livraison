import type { Theme } from '@fleetpulse/shared';

/** Application client : claire, douce et arrondie. */
export const theme: Theme = {
  sombre: false,
  fond: '#F4F3FA',
  surface: '#FFFFFF',
  surfaceAlt: '#F4F3FA',
  texte: '#17152B',
  secondaire: '#6E6B85',
  bordure: '#E4E2F0',
  accent: '#5B4FE9',
  surAccent: '#FFFFFF',
  accentDoux: '#ECEAFD',
  erreur: '#C2410C',
  erreurFond: '#FFF1EB',
  succes: '#16A34A',
  rayon: 20,
  ombre: true,
};

/** Centre de Tunis (= depot), utilise tant que le client n'a pas place son adresse. */
export const TUNIS = { latitude: 36.8065, longitude: 10.1815 };
