// Miroir des DTO du backend (package com.fleetpulse.livraison.Dto).

import type { SousRole, StatutCompte } from './sprint1';
export type Role = 'CLIENT' | 'PARTENAIRE' | 'LIVREUR' | 'RESPONSABLE';

export type StatutLivraison =
  | 'PENDING_PARTNER'
  | 'ACCEPTEE'
  | 'REFUSEE'
  | 'EN_PREPARATION'
  | 'PRETE'
  | 'AFFECTEE'
  | 'RECUPEREE'
  | 'ANNULEE'
  | 'EN_COURS'
  | 'A_PROXIMITE'
  | 'ARRIVEE'
  | 'LIVREE'
  | 'ECHEC'
  | 'RETOURNEE';

export type ModePaiement = 'COD' | 'CARTE';
export type StatutPaiement = 'A_LA_LIVRAISON' | 'ENCAISSE' | 'EN_ATTENTE' | 'PAYE' | 'ECHOUE';
export type TypeLivraison = 'IMMEDIATE' | 'PLANIFIEE';

export interface Profil {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  telephone: string | null;
  role: Role;
  statut: StatutCompte;
  sousRole: SousRole;
  motifStatut: string | null;
}

export interface Livreur {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  telephone: string | null;
  actif: boolean;
  vehiculeId: number | null;
  /** US-2B11 : nom de la zone principale, null si non affecte. */
  zonePrincipale: string | null;
}

/** US-2B11 : rattachement d'un livreur a une zone (miroir de AffectationZoneDto). */
export type TypeAffectation = 'PRINCIPALE' | 'SECONDAIRE' | 'TEMPORAIRE';

export interface AffectationZone {
  id: number;
  zoneId: number;
  zoneNom: string;
  type: TypeAffectation;
  /** Renfort temporaire uniquement. */
  debut: string | null;
  fin: string | null;
  /** false pour un renfort pas encore commence ou deja termine. */
  enVigueur: boolean;
}

export interface AffectationRequest {
  zoneId: number;
  type: TypeAffectation;
  debut?: string;
  fin?: string;
}

export interface LivreurRequest {
  nom: string;
  prenom: string;
  email: string;
  /** Obligatoire a la creation (8 caracteres min.), facultatif en modification. */
  motDePasse?: string;
  telephone?: string;
}

export interface Vehicule {
  id: number;
  immatriculation: string;
  type: string | null;
  capaciteKg: number | null;
  consommationLitres100Km: number;
  actif: boolean;
  livreurId: number | null;
}

export interface VehiculeRequest {
  immatriculation: string;
  type?: string;
  capaciteKg?: number;
  consommationLitres100Km?: number;
}

export interface Livraison {
  partenaireId: number | null;
  nomPartenaire: string | null;
  zoneNom: string | null;
  montantArticles: number | null;
  lignes: import('../../mobile/packages/shared/src/sprint2').LigneCommande[];
  notes: string | null;
  id: number;
  codeSuivi: string;
  clientEmail: string;
  adresse: string;
  latitude: number;
  longitude: number;
  creneauDebut: string | null;
  creneauFin: string | null;
  typeLivraison: TypeLivraison | null;
  modePaiement: ModePaiement;
  statutPaiement: StatutPaiement | null;
  distanceKm: number;
  fraisLivraison: number;
  supplementImmediat: number;
  montantTotal: number;
  montantACollecter: number;
  statut: StatutLivraison;
  dateCreation: string;
}

export interface LoginResponse {
  token: string;
  refreshToken: string;
  refreshExpiresInMs: number;
  type: string;
  expiresInMs: number;
}

// Sprint 3 (US-311) : interventions du responsable sur une commande, miroir de GestionCommandeDto.java
export type ActionResponsable = 'ANNULER' | 'VALIDER_COLLECTE' | 'VALIDER_REMISE';
export type ModeRemise = 'QR' | 'CODE' | 'MANUELLE';
export interface EtapeHistorique { ancien: StatutLivraison | null; nouveau: StatutLivraison; acteurRole: string | null; motif: string | null; date: string }
export interface SuiviResponsable {
  commandeId: number; codeSuivi: string; statut: StatutLivraison; livreurPrenom: string | null;
  recupereeLe: string | null; livreeLe: string | null; montantAttendu: number; montantEncaisse: number | null;
  ecartEncaissement: number | null; motifEcart: string | null; modeRemise: ModeRemise | null;
  annuleeLe: string | null; motifAnnulation: string | null;
  actions: ActionResponsable[]; historique: EtapeHistorique[];
}

// Sprint 4 (US-407) : supervision du dispatch, miroir de DispatchDto.java
export type StatutLot = 'PROPOSE' | 'ACCEPTE' | 'ANNULE';
export type StatutOffre = 'EN_ATTENTE' | 'ACCEPTEE' | 'REFUSEE' | 'EXPIREE' | 'ANNULEE';
export interface OffreEnCours { offreId: number; livreurPrenom: string; expireLe: string; horsZone: boolean }
export interface CommandeAttente {
  id: number; codeSuivi: string; nomCommerce: string | null; zoneNom: string | null; preteLe: string | null;
  minutesAttente: number; alerte: boolean; lotId: number | null; offre: OffreEnCours | null;
}
export interface OffreHistorique {
  id: number; livreurPrenom: string; statut: StatutOffre; proposeeLe: string; reponduLe: string | null;
  horsZone: boolean; score: number; motifRefus: string | null;
}
export interface LotSupervision {
  id: number; statut: StatutLot; source: string | null; livreurPrenom: string | null; creeLe: string; accepteLe: string | null;
  distanceKm: number; dureeMinutes: number; commandes: { id: number; codeSuivi: string; statut: StatutLivraison }[];
  offres: OffreHistorique[];
}
export interface LivreurSupervision {
  id: number; prenom: string; nom: string; missions: number; offreEnCours: boolean;
  latitude: number | null; longitude: number | null; dernierePositionLe: string | null;
}
export interface Supervision {
  maintenant: string; parLots: boolean; ia: boolean; delaiOffreSecondes: number; delaiRechercheMaxMinutes: number;
  enAttente: CommandeAttente[]; lots: LotSupervision[]; livreurs: LivreurSupervision[];
}

// Sprint 5 : chaine financiere, miroir de FinanceDto.java (montants en DT)
export type PorteeCommission = 'GLOBAL' | 'CATEGORIE' | 'PARTENAIRE';
export interface TauxCommission {
  id: number; portee: PorteeCommission; categorie: string | null; partenaireId: number | null; nomCommerce: string | null;
  taux: number; modifieLe: string | null; modifiePar: string | null;
}
export interface Commissions { tauxGlobal: number; taux: TauxCommission[] }
export interface Bareme { zoneId: number; zoneNom: string; base: number; parKm: number; parDefaut: boolean; modifieLe: string | null }
export interface Ecriture {
  id: number; type: string; montant: number; commandeId: number | null; partenaireId: number | null; livreurId: number | null;
  depotId: number | null; closingId: number | null; libelle: string | null; date: string;
}
export interface CommandeEncaissee { commandeId: number; codeSuivi: string; nomCommerce: string | null; livreeLe: string; montantEncaisse: number; ecartEncaissement: number }
export interface SoldeCoursier { livreurId: number; prenom: string; nom: string; solde: number; nbCommandes: number; plusAncienne: string | null }
export interface Caisses { cashEnCirculation: number; coursiers: SoldeCoursier[] }
export interface Recu {
  id: number; numeroRecu: string; livreurId: number; livreurNom: string; montantAttendu: number; montantRecu: number; ecart: number;
  motifEcart: string | null; statut: 'RAPPROCHE' | 'ECART'; nbCommandes: number; date: string; enregistrePar: string; commandes: CommandeEncaissee[];
}
export interface CaisseCoursier { livreurId: number; prenom: string; nom: string; solde: number; commandes: CommandeEncaissee[]; recus: Recu[] }
export interface ReleveReversement { partenaireId: number; nomCommerce: string; nbCommandes: number; ventes: number; commission: number; net: number }
export interface ReleveCoursier { livreurId: number; prenom: string; nom: string; nbMissions: number; distanceKm: number; remuneration: number }
export interface Closing {
  id: number | null; semaine: string; debut: string; fin: string; valideLe: string | null; validePar: string | null;
  totalReversements: number; totalRemunerations: number; nbCommandesPartenaires: number; nbMissions: number;
  commandesNonRapprochees: number; cashNonRapproche: number; partenaires: ReleveReversement[]; coursiers: ReleveCoursier[];
}
