// Sprint 2 bis : commandes recues par le partenaire (miroir de CommandePartenaireDto).
import type { Livraison, MotifRefus, Role, StatutLivraison } from './types';
import type { LigneCommande } from './sprint2';
import { STATUTS, formatHeure } from './format';

/** Libelles du point de vue du commerce ; STATUTS (format.ts) reste la formulation client. */
const LIBELLES_PARTENAIRE: Partial<Record<StatutLivraison, string>> = {
  PENDING_PARTNER: 'Nouvelle — à traiter',
  PRETE: 'Prête — en attente du livreur',
  RECUPEREE: 'Récupérée par le livreur',
};
export function libelleStatutPartenaire(statut: StatutLivraison): string {
  return LIBELLES_PARTENAIRE[statut] ?? STATUTS[statut].libelle;
}
type Etape = { ancien: StatutLivraison | null; nouveau: StatutLivraison };
/** Entree d'historique vue par le partenaire : creation « Commande passée », ancien = nouveau « Délai ajusté ». */
export function libelleEtapePartenaire(entree: Etape): string {
  if (entree.ancien === null) return 'Commande passée';
  if (entree.ancien === entree.nouveau) return 'Délai ajusté';
  return libelleStatutPartenaire(entree.nouveau);
}
/** Libelles du point de vue du client pour sa frise de suivi. */
const ETAPES_CLIENT: Partial<Record<StatutLivraison, string>> = {
  ACCEPTEE: 'Acceptée par le commerce',
  REFUSEE: 'Refusée par le commerce',
  PRETE: 'Prête, en attente du livreur',
  ANNULEE: 'Annulée',
};
export function libelleEtapeClient(entree: Etape): string {
  if (entree.ancien === null) return 'Commande passée';
  if (entree.ancien === entree.nouveau) return 'Délai ajusté';
  return ETAPES_CLIENT[entree.nouveau] ?? STATUTS[entree.nouveau].libelle;
}

export interface CommandeResume {
  id: number; codeSuivi: string; statut: StatutLivraison; dateCreation: string;
  clientPrenom: string; nbArticles: number; total: number;
}
export interface HistoriqueEntree { ancien: StatutLivraison | null; nouveau: StatutLivraison; acteurRole: Role; motif: string | null; date: string }
export interface CommandeDetail extends CommandeResume {
  zoneNom: string | null; lignes: LigneCommande[]; notes: string | null;
  montantArticles: number; fraisLivraison: number;
  tempsPreparationMinutes: number | null; accepteeLe: string | null; motifRefus: MotifRefus | null; commentaireRefus: string | null;
  pretePrevueLe: string | null; nbAjustementsPreparation: number; preparationDebutLe: string | null; preteLe: string | null;
  annuleeLe: string | null; motifAnnulation: string | null;
  historique: HistoriqueEntree[];
}

/** US-2B10 : etiquette du colis (miroir de EtiquetteColis.java). contenuQr est encode tel quel dans le QR. */
export interface EtiquetteColis {
  commandeId: number; codeSuivi: string; codeCollecte: string; contenuQr: string;
  clientPrenom: string; zoneNom: string | null; nomCommerce: string | null; nbArticles: number; preteLe: string | null;
}

// US-2B12 : annulation par le client, sans frais, tant que la preparation n'a pas commence (miroir de CommandeService)
export const MOTIF_ANNULATION_MAX = 300;
export function peutAnnuler(statut: StatutLivraison): boolean {
  return statut === 'PENDING_PARTNER' || statut === 'ACCEPTEE';
}

// US-2B2 : decision du partenaire (bornes identiques a CommandePartenaireService)
export const MOTIFS_REFUS: { id: MotifRefus; libelle: string }[] = [
  { id: 'RUPTURE', libelle: 'Rupture de stock' },
  { id: 'FERMETURE', libelle: 'Commerce sur le point de fermer' },
  { id: 'TROP_DE_COMMANDES', libelle: 'Trop de commandes en cours' },
  { id: 'AUTRE', libelle: 'Autre' },
];
export const TEMPS_PREPARATION_PROPOSES = [5, 10, 15, 20, 30];
export const PREPARATION_MAX_MINUTES = 180;
export const COMMENTAIRE_REFUS_MAX = 300;
/** US-2B4 : le delai annonce peut etre ajuste au plus 2 fois. */
export const AJUSTEMENTS_PREPARATION_MAX = 2;

export function verifierTempsPreparation(saisie: string): string | null {
  const minutes = Number(saisie.trim());
  if (!/^\d+$/.test(saisie.trim()) || minutes < 1 || minutes > PREPARATION_MAX_MINUTES)
    return `Temps de préparation : nombre entier de 1 à ${PREPARATION_MAX_MINUTES} minutes.`;
  return null;
}
export function verifierRefus(motif: MotifRefus | null, commentaire: string): string | null {
  if (!motif) return 'Choisissez un motif de refus.';
  if (motif === 'AUTRE' && !commentaire.trim()) return 'Précisez le motif du refus.';
  if (commentaire.trim().length > COMMENTAIRE_REFUS_MAX) return `Commentaire : ${COMMENTAIRE_REFUS_MAX} caractères maximum.`;
  return null;
}
export function libelleMotifRefus(motif: MotifRefus): string {
  return MOTIFS_REFUS.find(m => m.id === motif)?.libelle ?? motif;
}
/** Phrase affichee au client sous le statut de sa commande, selon la decision et la preparation du commerce. */
export function messageDecisionClient(c: {
  statut: StatutLivraison; nomPartenaire: string | null; pretePrevueLe: string | null;
  motifRefus: MotifRefus | null; commentaireRefus: string | null;
}): string | null {
  const commerce = c.nomPartenaire ?? 'Le commerce';
  const prete = c.pretePrevueLe ? formatHeure(new Date(c.pretePrevueLe)) : null;
  if (c.statut === 'PENDING_PARTNER') return `${commerce} n'a pas encore répondu. Vous pouvez suivre la commande ici.`;
  if (c.statut === 'ACCEPTEE') return prete ? `${commerce} a accepté : prête vers ${prete}.` : `${commerce} a accepté votre commande.`;
  if (c.statut === 'EN_PREPARATION') return prete ? `${commerce} prépare votre commande : prête vers ${prete}.` : `${commerce} prépare votre commande.`;
  if (c.statut === 'PRETE') return `${commerce} : votre commande est prête. Un livreur va la récupérer.`;
  if (c.statut === 'ANNULEE') return 'Vous avez annulé cette commande. Aucun montant ne vous sera demandé.';
  if (c.statut === 'REFUSEE') {
    const motif = c.motifRefus ? libelleMotifRefus(c.motifRefus) : 'sans motif';
    return `${commerce} a refusé : ${motif}${c.commentaireRefus ? ` — ${c.commentaireRefus}` : ''}. Aucun montant ne vous sera demandé.`;
  }
  return null;
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
    accepterCommande: (id: number, tempsPreparationMinutes: number) =>
      request<CommandeDetail>('PUT', '/api/partenaire/commandes/' + id + '/accepter', { tempsPreparationMinutes }),
    refuserCommande: (id: number, motif: MotifRefus, commentaire: string) =>
      request<CommandeDetail>('PUT', '/api/partenaire/commandes/' + id + '/refuser', { motif, commentaire: commentaire.trim() || null }),
    commencerPreparation: (id: number) => request<CommandeDetail>('PUT', '/api/partenaire/commandes/' + id + '/preparation/debut'),
    ajusterPreparation: (id: number, tempsPreparationMinutes: number) =>
      request<CommandeDetail>('PUT', '/api/partenaire/commandes/' + id + '/preparation/temps', { tempsPreparationMinutes }),
    marquerPrete: (id: number) => request<CommandeDetail>('PUT', '/api/partenaire/commandes/' + id + '/prete'),
    etiquetteColis: (id: number) => request<EtiquetteColis>('GET', '/api/partenaire/commandes/' + id + '/etiquette'),
  };
}

/** Suivi par le client de sa propre commande. */
export function creerApiSuiviClient(request: <T>(method: string, path: string, body?: unknown) => Promise<T>) {
  return {
    historiqueCommande: (id: number) => request<HistoriqueEntree[]>('GET', '/api/commandes/' + id + '/historique'),
    annulerCommande: (id: number, motif: string) =>
      request<Livraison>('PUT', '/api/commandes/' + id + '/annuler', { motif: motif.trim() || null }),
  };
}
