/** Contrats et validations sans dépendance native, communs au web et au mobile. */
export interface Position { latitude: number; longitude: number }
export interface Zone extends ZoneSaisie { id: number; partenaires: number }
export interface ZoneSaisie { nom: string; polygone: Position[]; fraisLivraison: number }
export interface Commerce { id: number; nomCommerce: string; categorie: string; adresse: string; ouvert: boolean; zoneId: number | null; zoneNom: string | null }
export interface Produit { id: number; partenaireId: number; nom: string; prix: number; disponible: boolean }
export interface Adresse extends Position { id: number; libelle: string; adresse: string }
export interface LignePanier { produitId: number; quantite: number }
export interface Panier { partenaireId: number | null; lignes: LignePanier[]; notes: string }
export interface LigneCommande { produitId: number; nomProduit: string; quantite: number; prixUnitaire: number; sousTotal: number }
export interface DevisCommande { partenaireId: number; nomPartenaire: string; zoneNom: string; lignes: LigneCommande[]; montantArticles: number; fraisLivraison: number; total: number; empreinte: string }
export interface PanierEnvoi { partenaireId: number; adresseId: number; lignes: LignePanier[]; notes: string; cleIdempotence?: string; devisEmpreinte?: string }
export const panierVide = (): Panier => ({ partenaireId: null, lignes: [], notes: '' });
/** Les claviers français peuvent fournir une virgule décimale. */
export const nombreSaisi = (valeur: string): number => Number(valeur.trim().replace(',', '.'));
export function verifierPosition(latitude: string, longitude: string): string | null {
  const lat = nombreSaisi(latitude), lng = nombreSaisi(longitude);
  return !latitude.trim() || !longitude.trim() || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180
    ? 'Latitude et longitude valides obligatoires.' : null;
}
export function verifierProduit(nom: string, prix: string): string | null {
  return !nom.trim() || nom.trim().length > 120 || !/^\d+([.,]\d{1,3})?$/.test(prix.trim()) || nombreSaisi(prix) <= 0 || nombreSaisi(prix) > 100000
    ? 'Nom obligatoire (120 caractères), prix positif jusqu’à 100000 DT avec 3 décimales maximum.' : null;
}
export function verifierPanier(p: Panier): string | null {
  if (!p.partenaireId || !p.lignes.length || p.lignes.length > 50) return 'Ajoutez de 1 à 50 produits du même partenaire.';
  if (p.notes.length > 500) return 'Notes : 500 caractères maximum.';
  const ids = new Set<number>();
  for (const l of p.lignes) {
    if (!Number.isInteger(l.produitId) || l.produitId <= 0 || ids.has(l.produitId) || !Number.isInteger(l.quantite) || l.quantite < 1 || l.quantite > 99)
      return 'Quantités de 1 à 99, sans produit en double.';
    ids.add(l.produitId);
  }
  return null;
}
export function ajouterProduit(p: Panier, produit: Produit, confirmerRemplacement = false): { panier: Panier; confirmation: boolean } {
  if (!produit.disponible) throw new Error('Ce produit est indisponible.');
  const autre = p.lignes.length > 0 && p.partenaireId !== produit.partenaireId;
  if (autre && !confirmerRemplacement) return { panier: p, confirmation: true };
  const base = autre ? panierVide() : p;
  const existant = base.lignes.find(l => l.produitId === produit.id);
  if (existant && existant.quantite >= 99) throw new Error('99 unités maximum par produit.');
  if (!existant && base.lignes.length >= 50) throw new Error('50 produits maximum.');
  return { confirmation: false, panier: { ...base, partenaireId: produit.partenaireId,
    lignes: existant ? base.lignes.map(l => l.produitId === produit.id ? { ...l, quantite: l.quantite + 1 } : l) : [...base.lignes, { produitId: produit.id, quantite: 1 }] } };
}
export function quantitePanier(p: Panier, id: number, quantite: number): Panier {
  if (!Number.isInteger(quantite) || quantite < 0 || quantite > 99) throw new Error('Quantité de 0 à 99.');
  const lignes = p.lignes.flatMap(l => l.produitId !== id ? [l] : quantite === 0 ? [] : [{ ...l, quantite }]);
  return lignes.length ? { ...p, lignes } : panierVide();
}
export function verifierZone(nom: string, frais: string, points: Position[]): string | null {
  if (!nom.trim() || nom.trim().length > 100 || !/^\d+(\.\d{1,3})?$/.test(frais) || Number(frais) > 100000) return 'Nom et frais valides obligatoires (3 décimales maximum).';
  if (points.length < 3 || points.length > 200) return 'Tracez de 3 à 200 sommets.';
  if (points.some(p => verifierPosition(String(p.latitude), String(p.longitude)))) return 'Sommet invalide.';
  return null;
}
/** La clé reste attachée au corps exact après un échec réseau. */
export function nouvelleCle(): string {
  return 'cod_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}
export function creerApiMarche(request: <T>(method: string, path: string, body?: unknown) => Promise<T>) {
  return {
    zones: () => request<Zone[]>('GET', '/api/admin/zones'),
    sauverZone: (id: number | null, data: ZoneSaisie) => request<Zone>(id ? 'PUT' : 'POST', '/api/admin/zones' + (id ? '/' + id : ''), data),
    supprimerZone: (id: number) => request<void>('DELETE', '/api/admin/zones/' + id),
    commerce: () => request<Commerce>('GET', '/api/partenaire/commerce'),
    ouverture: (ouvert: boolean) => request<Commerce>('PUT', '/api/partenaire/commerce', { ouvert }),
    mesProduits: () => request<Produit[]>('GET', '/api/partenaire/produits'),
    sauverProduit: (id: number | null, data: Pick<Produit, 'nom' | 'prix' | 'disponible'>) => request<Produit>(id ? 'PUT' : 'POST', '/api/partenaire/produits' + (id ? '/' + id : ''), data),
    adresses: () => request<Adresse[]>('GET', '/api/adresses'),
    sauverAdresse: (id: number | null, data: Omit<Adresse, 'id'>) => request<Adresse>(id ? 'PUT' : 'POST', '/api/adresses' + (id ? '/' + id : ''), data),
    supprimerAdresse: (id: number) => request<void>('DELETE', '/api/adresses/' + id),
    partenaires: (adresseId: number, recherche = '', categorie = '') => request<Commerce[]>('GET', '/api/partenaires?' + new URLSearchParams({ adresseId: String(adresseId), recherche, categorie })),
    produits: (id: number, adresseId: number) => request<Produit[]>('GET', '/api/partenaires/' + id + '/produits?adresseId=' + adresseId),
    devisCommande: (data: PanierEnvoi) => request<DevisCommande>('POST', '/api/commandes/devis', data),
    commander: <T>(data: PanierEnvoi) => request<T>('POST', '/api/commandes', data),
  };
}
