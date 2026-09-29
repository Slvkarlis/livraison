import Constants from 'expo-constants';

const PORT_BACKEND = 8083;

/**
 * URL du backend Spring Boot.
 * Priorite : EXPO_PUBLIC_API_URL, sinon la machine qui sert le bundle Expo (meme IP, port 8083),
 * ce qui marche tel quel avec Expo Go sur un telephone connecte au meme Wi-Fi.
 */
export function apiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return `http://${host ?? 'localhost'}:${PORT_BACKEND}`;
}
