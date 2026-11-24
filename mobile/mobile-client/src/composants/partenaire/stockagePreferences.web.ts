export const lirePreferences = async (cle: string) => window.localStorage.getItem(cle);
export const sauverPreferences = async (cle: string, valeur: string) => window.localStorage.setItem(cle, valeur);
