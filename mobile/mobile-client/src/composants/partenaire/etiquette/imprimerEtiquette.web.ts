/**
 * Navigateur : expo-print imprime la page courante, pas le HTML fourni.
 * L'etiquette est donc chargee dans une iframe invisible, imprimee, puis retiree.
 */
export function imprimerEtiquette(html: string): Promise<void> {
  return new Promise((resolve) => {
    const cadre = document.createElement('iframe');
    cadre.style.position = 'fixed';
    cadre.style.width = '0';
    cadre.style.height = '0';
    cadre.style.border = '0';
    cadre.srcdoc = html;
    cadre.onload = () => {
      cadre.contentWindow?.focus();
      cadre.contentWindow?.print();
      // print() bloque jusqu'a la fermeture de la boite d'impression dans la plupart des navigateurs
      setTimeout(() => { cadre.remove(); resolve(); }, 500);
    };
    document.body.appendChild(cadre);
  });
}
