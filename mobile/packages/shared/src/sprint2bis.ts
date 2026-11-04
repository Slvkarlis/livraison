// Sprint 2 bis : commandes recues par le partenaire (miroir de CommandePartenaireDto).
import type { Role, StatutLivraison } from './types';
import type { LigneCommande } from './sprint2';
import { STATUTS } from './format';

/** Libelles du point de vue du commerce ; STATUTS (format.ts) reste la formulation client. */
const LIBELLES_PARTENAIRE: Partial<Record<StatutLivraison, string>> = {
  PENDING_PARTNER: 'Nouvelle — à traiter',
  PRETE: 'Prête — en attente du livreur',
  RECUPEREE: 'Récupérée par le livreur',
};
export function libelleStatutPartenaire(statut: StatutLivraison): string {
  return LIBELLES_PARTENAIRE[statut] ?? STATUTS[statut].libelle;
}
/** Entree d'historique vue par le partenaire : la creation s'affiche « Commande passée ». */
export function libelleEtapePartenaire(entree: { ancien: StatutLivraison | null; nouveau: StatutLivraison }): string {
  return entree.ancien === null ? 'Commande passée' : libelleStatutPartenaire(entree.nouveau);
}

export interface CommandeResume {
  id: number; codeSuivi: string; statut: StatutLivraison; dateCreation: string;
  clientPrenom: string; nbArticles: number; total: number;
}
export interface HistoriqueEntree { ancien: StatutLivraison | null; nouveau: StatutLivraison; acteurRole: Role; motif: string | null; date: string }
export interface CommandeDetail extends CommandeResume {
  zoneNom: string | null; lignes: LigneCommande[]; notes: string | null;
  montantArticles: number; fraisLivraison: number; historique: HistoriqueEntree[];
}

export type GroupeCommandes = 'nouvelles' | 'en-cours' | 'pretes' | 'terminees';
/** Onglets de filtre du partenaire ; chaque statut appartient a un seul groupe. */
export const GROUPES_COMMANDES: { id: GroupeCommandes; libelle: string; statuts: StatutLivraison[] }[] = [
  { id: 'nouvelles', libelle: 'Nouvelles', statuts: ['PENDING_PARTNER'] },
  { id: 'en-cours', libelle: 'En cours', statuts: ['ACCEPTEE', 'EN_PREPARATION'] },
  { id: 'pretes', libelle: 'Prêtes', statuts: ['PRETE', 'AFFECTEE'] },
  { id: 'terminees', libelle: 'Terminées', statuts: ['RECUPEREE', 'REFUSEE', 'ANNULEE', 'EN_COURS', 'A_PROXIMITE', 'ARRIVEE', 'LIVREE', 'ECHEC', 'RETOURNEE'] },
];
export function groupeDe(statut: StatutLivraison): GroupeCommandes {
  return GROUPES_COMMANDES.find(g => g.statuts.includes(statut))?.id ?? 'terminees';
}
export function compterParGroupe(commandes: { statut: StatutLivraison }[]): Record<GroupeCommandes, number> {
  const compte: Record<GroupeCommandes, number> = { nouvelles: 0, 'en-cours': 0, pretes: 0, terminees: 0 };
  for (const c of commandes) compte[groupeDe(c.statut)] += 1;
  return compte;
}
export const ROLES_ACTEUR: Record<Role, string> = { CLIENT: 'Client', PARTENAIRE: 'Commerce', LIVREUR: 'Livreur', RESPONSABLE: 'Responsable' };

export function creerApiPartenaire(request: <T>(method: string, path: string, body?: unknown) => Promise<T>) {
  return {
    commandesRecues: () => request<CommandeResume[]>('GET', '/api/partenaire/commandes'),
    commandeRecue: (id: number) => request<CommandeDetail>('GET', '/api/partenaire/commandes/' + id),
  };
}
