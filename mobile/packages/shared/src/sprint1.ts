export type StatutCompte = 'ACTIF' | 'EN_ATTENTE' | 'COMPLEMENT_DEMANDE' | 'REFUSE' | 'SUSPENDU';
export type SousRole = 'OPERATIONS' | 'FINANCE' | null;
export type RoleCompte = 'CLIENT' | 'PARTENAIRE' | 'LIVREUR' | 'RESPONSABLE';
export interface Droits { role: RoleCompte; statut: StatutCompte; sousRole: SousRole }
export interface Jetons { token: string; refreshToken: string }
export interface Compte extends Droits {
  id: number; nom: string; prenom: string; email: string; telephone: string | null;
  motifStatut: string | null; telephoneVerifie: boolean; dateCreation: string;
  nomCommerce: string | null; categorie: string | null; adresse: string | null;
  latitude: number | null; longitude: number | null; matriculeFiscal: string | null;
  numeroIdentite: string | null; vehiculeDeclare: string | null;
}
export const STATUTS_COMPTE: Record<StatutCompte, string> = {
  ACTIF: 'Validé / actif', EN_ATTENTE: 'En attente', COMPLEMENT_DEMANDE: 'Complément demandé',
  REFUSE: 'Refusé', SUSPENDU: 'Suspendu',
};
export const ROLES_COMPTE: Record<RoleCompte, string> = {
  CLIENT: 'Client', PARTENAIRE: 'Partenaire', LIVREUR: 'Coursier', RESPONSABLE: 'Responsable',
};
export function peutOperations(p: Droits | null): boolean {
  return p?.statut === 'ACTIF' && p.role === 'RESPONSABLE' && p.sousRole !== 'FINANCE';
}
export function peutAudit(p: Droits | null): boolean {
  return p?.statut === 'ACTIF' && p.role === 'RESPONSABLE';
}
export function peutRole(p: Droits | null, role: RoleCompte): boolean {
  return p?.statut === 'ACTIF' && p.role === role;
}
export function destination(p: Droits): string {
  if (p.statut !== 'ACTIF' || p.role === 'PARTENAIRE') return '/dossier';
  if (p.role === 'RESPONSABLE') return peutOperations(p) ? '/dossiers' : '/audit';
  return p.role === 'CLIENT' ? '/(onglets)' : '/';
}
export const telephoneValide = (v: string) => /^\+[1-9]\d{7,14}$/.test(v.trim());
export const codeValide = (v: string) => /^\d{6}$/.test(v.trim());
export const motDePasseValide = (v: string) => v.length >= 8;
export function verifierMotif(v: string): string | null {
  return !v.trim() ? 'Le motif est obligatoire.' : v.trim().length > 500 ? '500 caractères maximum.' : null;
}
export type FormCandidature = Record<'nom' | 'prenom' | 'email' | 'telephone' | 'motDePasse' |
  'nomCommerce' | 'categorie' | 'adresse' | 'latitude' | 'longitude' | 'matriculeFiscal' |
  'numeroIdentite' | 'vehiculeDeclare', string>;
export const candidatureVide: FormCandidature = {
  nom: '', prenom: '', email: '', telephone: '', motDePasse: '', nomCommerce: '', categorie: '',
  adresse: '', latitude: '', longitude: '', matriculeFiscal: '', numeroIdentite: '', vehiculeDeclare: '',
};
export function verifierIdentite(f: Pick<FormCandidature, 'nom' | 'prenom' | 'email' | 'telephone' | 'motDePasse'>): string | null {
  if (!f.nom.trim() || !f.prenom.trim()) return 'Nom et prénom obligatoires.';
  if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) return 'Adresse email invalide.';
  if (!telephoneValide(f.telephone)) return 'Téléphone international requis, par exemple +21620123456.';
  if (!motDePasseValide(f.motDePasse)) return 'Le mot de passe doit contenir au moins 8 caractères.';
  return null;
}
export function verifierCandidature(f: FormCandidature, partenaire: boolean, correction = false): string | null {
  const identite = verifierIdentite({ ...f, motDePasse: correction ? '********' : f.motDePasse });
  if (identite) return identite;
  if (!partenaire) return !f.numeroIdentite.trim() || !f.vehiculeDeclare.trim()
    ? "Indiquez votre numéro d'identité et votre véhicule." : null;
  if (![f.nomCommerce, f.categorie, f.adresse, f.matriculeFiscal].every(v => v.trim()))
    return 'Commerce, catégorie, adresse et matricule fiscal obligatoires.';
  if (!f.latitude.trim() || !f.longitude.trim() || !Number.isFinite(Number(f.latitude)) || !Number.isFinite(Number(f.longitude)) ||
    Math.abs(Number(f.latitude)) > 90 || Math.abs(Number(f.longitude)) > 180) return 'Position du commerce invalide.';
  return null;
}
export function payloadCandidature(f: FormCandidature, partenaire: boolean, correction = false) {
  return {
    nom: f.nom.trim(), prenom: f.prenom.trim(), telephone: f.telephone.trim(),
    ...(!correction ? { email: f.email.trim().toLowerCase(), motDePasse: f.motDePasse } : {}),
    ...(partenaire ? { nomCommerce: f.nomCommerce.trim(), categorie: f.categorie.trim(), adresse: f.adresse.trim(),
      latitude: Number(f.latitude), longitude: Number(f.longitude), matriculeFiscal: f.matriculeFiscal.trim() }
      : { numeroIdentite: f.numeroIdentite.trim(), vehiculeDeclare: f.vehiculeDeclare.trim() }),
  };
}
