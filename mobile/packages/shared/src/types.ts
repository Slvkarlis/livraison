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

export type StatutPaiement = 'A_LA_LIVRAISON' | 'EN_ATTENTE' | 'PAYE' | 'ECHOUE';

export type TypeLivraison = 'IMMEDIATE' | 'PLANIFIEE';

export interface Vehicule {
  id: number;
  immatriculation: string;
  type: string | null;
  capaciteKg: number | null;
  consommationLitres100Km: number;
  actif: boolean;
  livreurId: number | null;
}

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
  vehicule: Vehicule | null;
}

export interface Livraison {
  partenaireId: number | null;
  nomPartenaire: string | null;
  zoneNom: string | null;
  montantArticles: number | null;
  lignes: import('./sprint2').LigneCommande[];
  notes: string | null;
  id: number;
  codeSuivi: string;
  clientEmail: string;
  adresse: string;
  latitude: number;
  longitude: number;
  creneauDebut: string;
  creneauFin: string;
  typeLivraison: TypeLivraison;
  modePaiement: ModePaiement;
  statutPaiement: StatutPaiement | null;
  distanceKm: number;
  fraisLivraison: number;
  supplementImmediat: number;
  /** Total figé articles + frais ; frais seuls pour les anciennes commandes. */
  montantTotal: number;
  /** A remettre au livreur : 0 si deja paye par carte. */
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

export interface SignupRequest {
  nom: string;
  prenom: string;
  email: string;
  motDePasse: string;
  telephone?: string;
}
