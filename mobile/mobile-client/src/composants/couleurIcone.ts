/** Ionicons n'accepte qu'une string : conversion securisee de la couleur fournie par la barre d'onglets. */
export function couleurIcone(color: unknown): string | undefined {
  if (typeof color === 'string') return color;
  if (typeof color === 'number') return `#${color.toString(16).padStart(8, '0')}`;
  return undefined;
}
