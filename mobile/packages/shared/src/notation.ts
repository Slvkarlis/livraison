type Requete = <T>(method: string, path: string, body?: unknown) => Promise<T>;

export type CibleNotation = 'PARTENAIRE' | 'LIVREUR' | 'CLIENT';
export interface NoteVue { cible: CibleNotation; note: number; commentaire: string | null; date: string }
export interface NotesVue { ouverte: boolean; cibles: CibleNotation[]; notes: NoteVue[] }
export const LIBELLES_CIBLES: Record<CibleNotation, string> = { PARTENAIRE: 'Le commerce', LIVREUR: 'Le coursier', CLIENT: 'Le client' };
export function verifierNotation(note: number, commentaire: string): string | null {
  if (!Number.isInteger(note) || note < 1 || note > 5) return 'Choisissez une note entière de 1 à 5.';
  if (commentaire.length > 500) return 'Commentaire : 500 caractères maximum.';
  return null;
}
export function ciblesRestantes(vue: NotesVue): CibleNotation[] {
  return vue.ouverte ? vue.cibles.filter(c => !vue.notes.some(n => n.cible === c)) : [];
}
export function creerApiNotation(request: Requete) {
  return {
    notations: (id: number) => request<NotesVue>('GET', `/api/commandes/${id}/notations`),
    noter: (id: number, cible: CibleNotation, note: number, commentaire: string) =>
      request<NotesVue>('POST', `/api/commandes/${id}/notations`, { cible, note, commentaire }),
  };
}
