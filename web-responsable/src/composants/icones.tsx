// Icones vectorielles au trait (24 px, currentColor) pour la carte et le suivi : pas d'emoji dans l'interface.
const TRAITS = {
  commerce: '<path d="M3 9l1.5-5h15L21 9"/><path d="M4 9v11h16V9"/><path d="M3 9a3 3 0 0 0 6 0a3 3 0 0 0 6 0a3 3 0 0 0 6 0"/><path d="M10 20v-5h4v5"/>',
  client: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  livreur: '<circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/>',
} as const;
export type NomIcone = keyof typeof TRAITS;

/** Version texte, pour les reperes HTML crees hors React (marqueurs MapLibre). */
export function svgIcone(nom: NomIcone, taille = 16): string {
  return `<svg width="${taille}" height="${taille}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${TRAITS[nom]}</svg>`;
}

export function Icone({ nom, taille = 16 }: { nom: NomIcone; taille?: number }) {
  return <span className="icone-trait" aria-hidden="true" dangerouslySetInnerHTML={{ __html: svgIcone(nom, taille) }} />;
}
