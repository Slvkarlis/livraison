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
