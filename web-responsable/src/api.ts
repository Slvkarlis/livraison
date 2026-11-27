import type {
  PartenaireCarte,
  AffectationRequest, AffectationZone, Bareme, CaisseCoursier, Caisses, Closing, Commissions, Ecriture, Livraison, SuiviResponsable,
  Livreur, LivreurRequest, LoginResponse, PorteeCommission, Profil, Recu, Supervision, TauxCommission, Vehicule, VehiculeRequest,
} from './types';

import { creerClientHttp } from '../../mobile/packages/shared/src/http';
import { creerApiMarche } from '../../mobile/packages/shared/src/sprint2';
export { ApiError } from '../../mobile/packages/shared/src/http';
import type { Compte } from './sprint1';

export type EchecVue = { id: number; codeSuivi: string; statut: string; nomCommerce: string; nomZone: string; motif: string; commentaire: string | null; echecLe: string; decision: string | null; commentaireDecision: string | null; decisionLe: string | null };
export type ReclamationVue = { id: number; commandeId: number; codeSuivi: string; type: string; description: string; montantDemande: number; statut: string; creeeLe: string; montantRembourse: number | null; imputation: string | null; commentaireDecision: string | null; decideeLe: string | null };
export type ZonePilote = { id: number; nom: string; pilote: boolean };
export type KpiPilote = { zone: string; commandes: number; livrees: number; echecs: number; expirees: number; delaiMoyenMinutes: number | null; respectEtaPct: number | null };
export type AlerteCouverture = { zoneId: number; zone: string; date: string; heure: number; commandesPrevues: number; coursiersDisponibles: number; capaciteCommandes: number; renfortRecommande: number };
export type ResultatSimulation = { unitaire: { tournees: number; km: number; minutes: number }; combinaisons: { rayonKm: number; fenetreMin: number; lots: { tournees: number; km: number; minutes: number }; economieKmPct: number; economieMinPct: number }[]; recommandee: { rayonKm: number; fenetreMin: number; economieMinPct: number } | null };
export type ProspectVue = { id: number; nom: string; categorie: string; adresse: string; zone: string | null; source: string; statut: string; score: number | null; scoreModele: string | null; statutLe: string; commentaire: string | null };
export const http = creerClientHttp(() => '', () => 'Serveur injoignable. Vérifiez le backend sur le port 8083.');
const request = http.request;

export const api = {
  tracesJour: (depuis: string) => request<{ traces: { livreurId: number; latitude: number; longitude: number; date: string }[] }>('GET', '/api/admin/entrepot/export?' + new URLSearchParams({ depuis })),
  // Sprint 7 : echecs, reclamations, pilote ; Sprint 8 : previsions et prospection
  echecs: () => request<EchecVue[]>('GET', '/api/admin/echecs'),
  decisionEchec: (id: number, decision: string, commentaire: string) => request<EchecVue>('POST', '/api/admin/echecs/' + id + '/decision', { decision, commentaire }),
  reclamations: () => request<ReclamationVue[]>('GET', '/api/admin/finance/reclamations'),
  decisionReclamation: (id: number, montantRembourse: number, imputation: string | null, commentaire: string) =>
    request<ReclamationVue>('POST', '/api/admin/finance/reclamations/' + id + '/decision', { montantRembourse, imputation, commentaire }),
  zonesPilote: () => request<ZonePilote[]>('GET', '/api/admin/pilote/zones'),
  definirPilote: (id: number, pilote: boolean) => request<ZonePilote>('PUT', '/api/admin/pilote/zones/' + id, { pilote }),
  kpiPilote: () => request<KpiPilote[]>('GET', '/api/admin/pilote/kpi'),
  alertesCouverture: () => request<AlerteCouverture[]>('GET', '/api/admin/previsions/alertes'),
  prospects: () => request<ProspectVue[]>('GET', '/api/admin/prospects'),
  importerProspects: (source: string, lignes: unknown[]) => request<{ crees: number; erreurs: string[] }>('POST', '/api/admin/prospects/import', { source, lignes }),
  scorerProspects: () => request<number>('POST', '/api/admin/prospects/scoring'),
  simulerLots: (scenario: unknown) => request<ResultatSimulation>('POST', '/api/admin/simulateur/lots', scenario),
  statutProspect: (id: number, statut: string, commentaire: string) => request<ProspectVue>('PUT', '/api/admin/prospects/' + id + '/statut', { statut, commentaire }),
  ...creerApiMarche(request),
  comptes: () => request<Compte[]>('GET', '/api/admin/comptes'),
  decision: (id: number, action: string, motif: string) => request<Compte>('PUT', '/api/admin/dossiers/' + id + '/' + action, { motif }),
  statutCompte: (id: number, action: string, motif: string) => request<Compte>('PUT', '/api/admin/comptes/' + id + '/' + action, { motif }),
  audit: (query: string) => request<PageAudit>('GET', '/api/admin/audit/page?' + query),

  demo: () => request<{ demonstration: boolean; delaiRenvoiSecondes: number }>('GET', '/api/auth/config'),
  logout: () => http.logout(),
  demanderOtp: (telephone: string) => request<void>('POST', '/api/auth/otp/demande', { telephone }),
  inscrireOtp: (data: unknown) => request<LoginResponse>('POST', '/api/auth/otp/inscription', data),
  oubli: (identifiant: string) => request<void>('POST', '/api/auth/mot-de-passe/oubli', { identifiant }),
  reinitialiser: (identifiant: string, code: string, nouveauMotDePasse: string) =>
    request<void>('POST', '/api/auth/mot-de-passe/reinitialiser', { identifiant, code, nouveauMotDePasse }),
  candidater: (partenaire: boolean, data: unknown) => request<Compte>('POST',
    '/api/auth/inscription/' + (partenaire ? 'partenaire' : 'livreur'), data),
  dossier: () => request<Compte>('GET', '/api/dossier'),
  corrigerDossier: (data: unknown) => request<Compte>('PUT', '/api/dossier', data),

  // US-01
  login: (email: string, motDePasse: string) =>
    request<LoginResponse>('POST', '/api/auth/login', { email, motDePasse },
      { 401: 'Email, téléphone ou mot de passe incorrect.' }),
  me: () => request<Profil>('GET', '/api/me'),

  // US-02
  livreurs: () => request<Livreur[]>('GET', '/api/admin/livreurs'),
  creerLivreur: (data: LivreurRequest) =>
    request<Livreur>('POST', '/api/admin/livreurs', data, {
      400: 'Nom, prénom, email et mot de passe (8 caractères min.) sont obligatoires.',
      409: 'Un compte existe déjà avec cet email.',
    }),
  modifierLivreur: (id: number, data: LivreurRequest) =>
    request<Livreur>('PUT', `/api/admin/livreurs/${id}`, data),
  desactiverLivreur: (id: number) => request<void>('DELETE', `/api/admin/livreurs/${id}`),
  activerLivreur: (id: number) => request<void>('PUT', `/api/admin/livreurs/${id}/activer`),

  // US-03
  vehicules: () => request<Vehicule[]>('GET', '/api/admin/vehicules'),
  creerVehicule: (data: VehiculeRequest) =>
    request<Vehicule>('POST', '/api/admin/vehicules', data, {
      400: 'Immatriculation obligatoire, consommation entre 2 et 30 L/100 km.',
      409: 'Un véhicule existe déjà avec cette immatriculation.',
    }),
  modifierVehicule: (id: number, data: VehiculeRequest) =>
    request<Vehicule>('PUT', `/api/admin/vehicules/${id}`, data, {
      400: 'La consommation doit être comprise entre 2 et 30 L/100 km.',
    }),
  desactiverVehicule: (id: number) => request<void>('DELETE', `/api/admin/vehicules/${id}`),
  activerVehicule: (id: number) => request<void>('PUT', `/api/admin/vehicules/${id}/activer`),
  affecterVehicule: (livreurId: number, vehiculeId: number) =>
    request<Livreur>('PUT', `/api/admin/livreurs/${livreurId}/vehicule`, { vehiculeId },
      { 404: 'Véhicule inactif ou introuvable.' }),
  retirerVehicule: (livreurId: number) => request<void>('DELETE', `/api/admin/livreurs/${livreurId}/vehicule`),

  // US-2B11 : zones de travail d'un livreur
  zonesLivreur: (livreurId: number) => request<AffectationZone[]>('GET', `/api/admin/livreurs/${livreurId}/zones`),
  affecterZone: (livreurId: number, data: AffectationRequest) =>
    request<AffectationZone>('POST', `/api/admin/livreurs/${livreurId}/zones`, data),
  retirerAffectation: (livreurId: number, affectationId: number) =>
    request<void>('DELETE', `/api/admin/livreurs/${livreurId}/zones/${affectationId}`),

  // US-07
  livraisons: () => request<Livraison[]>('GET', '/api/livraisons'),

  // US-311 : interventions du responsable (motif obligatoire, auditees)
  suiviCommande: (id: number) => request<SuiviResponsable>('GET', `/api/admin/commandes/${id}/suivi`),
  annulerCommande: (id: number, motif: string) => request<SuiviResponsable>('PUT', `/api/admin/commandes/${id}/annuler`, { motif }),
  validerCollecte: (id: number, motif: string) => request<SuiviResponsable>('PUT', `/api/admin/commandes/${id}/collecte`, { motif }),
  validerRemise: (id: number, motif: string, montantEncaisse: number, motifEcart: string | null) =>
    request<SuiviResponsable>('PUT', `/api/admin/commandes/${id}/remise`, { motif, montantEncaisse, motifEcart }),

  // Sprint 4 (US-407) : supervision du dispatch par lots et affectation forcee (motif obligatoire, auditee)
  supervision: () => request<Supervision>('GET', '/api/admin/dispatch'),
  /** Commerces geolocalises pour la carte de suivi en direct. */
  partenairesCarte: () => request<PartenaireCarte[]>('GET', '/api/admin/dispatch/partenaires'),
  forcerAffectation: (commandeId: number, livreurId: number, motif: string) =>
    request<Supervision>('PUT', `/api/admin/dispatch/commandes/${commandeId}/forcer`, { livreurId, motif }),
  cycleDispatch: () => request<{ offresExpirees: number; offresProposees: number }>('POST', '/api/admin/dispatch/cycle'),

  // Sprint 5 : chaine financiere (sous-role FINANCE)
  commissions: () => request<Commissions>('GET', '/api/admin/finance/commissions'),
  definirCommission: (portee: PorteeCommission, cible: { categorie?: string; partenaireId?: number }, taux: number) =>
    request<TauxCommission>('PUT', '/api/admin/finance/commissions', { portee, ...cible, taux }),
  supprimerCommission: (id: number) => request<void>('DELETE', `/api/admin/finance/commissions/${id}`),
  baremes: () => request<Bareme[]>('GET', '/api/admin/finance/baremes'),
  definirBareme: (zoneId: number, base: number, parKm: number) =>
    request<Bareme>('PUT', `/api/admin/finance/baremes/${zoneId}`, { base, parKm }),
  ledger: (query: string) => request<Ecriture[]>('GET', '/api/admin/finance/ledger?' + query),
  caisses: () => request<Caisses>('GET', '/api/admin/finance/caisses'),
  caisse: (livreurId: number) => request<CaisseCoursier>('GET', `/api/admin/finance/caisses/${livreurId}`),
  deposer: (livreurId: number, montantRecu: number, motifEcart: string | null, cleIdempotence: string) =>
    request<Recu>('POST', '/api/admin/finance/depots', { livreurId, montantRecu, motifEcart, cleIdempotence }),
  recus: () => request<Recu[]>('GET', '/api/admin/finance/depots'),
  apercuClosing: (semaine: string) => request<Closing>('GET', '/api/admin/finance/closings/apercu?semaine=' + semaine),
  validerClosing: (semaine: string) => request<Closing>('POST', '/api/admin/finance/closings', { semaine }),
  closings: () => request<Closing[]>('GET', '/api/admin/finance/closings'),
};

export interface Audit { id: number; date: string; acteur: string; action: string; cibleType: string; cibleId: number | null; details: string | null }
export interface PageAudit { content: Audit[]; number: number; totalPages: number; totalElements: number }
