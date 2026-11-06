import * as Print from 'expo-print';

/** Telephone / tablette : ouvre la boite d'impression du systeme (ou enregistrement PDF) avec le HTML de l'etiquette. */
export async function imprimerEtiquette(html: string): Promise<void> {
  await Print.printAsync({ html });
}
