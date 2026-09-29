// Miroir des DTO du backend (package com.fleetpulse.livraison.Dto).

export type Role = 'CLIENT' | 'LIVREUR' | 'RESPONSABLE';

export type StatutLivraison =
  | 'EN_PREPARATION'
  | 'AFFECTEE'
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
}

export interface Livreur {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  telephone: string | null;
  actif: boolean;
  vehiculeId: number | null;
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
  type: string;
  expiresInMs: number;
}
