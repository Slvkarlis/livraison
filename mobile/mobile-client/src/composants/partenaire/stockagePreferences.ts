import * as SecureStore from 'expo-secure-store';

export const lirePreferences = (cle: string) => SecureStore.getItemAsync(cle);
export const sauverPreferences = (cle: string, valeur: string) => SecureStore.setItemAsync(cle, valeur);
