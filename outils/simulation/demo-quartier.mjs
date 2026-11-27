// Base de démonstration uniquement, préparée par Sprint9DemoInitializer.
// Crée trois commandes COD réelles sur cette base et les marque prêtes, puis accepte le lot.
import assert from 'node:assert/strict';
const base = process.env.API_URL ?? 'http://localhost:8083';
const motDePasse = process.env.SPRINT9_MOT_DE_PASSE_DEMO ?? 'demo-sprint9-password';
async function api(methode, route, corps, jeton) {
  const r = await fetch(base + '/api' + route, { method: methode, signal: AbortSignal.timeout(20000),
    headers: { 'Content-Type': 'application/json', ...(jeton ? { Authorization: 'Bearer ' + jeton } : {}) }, body: corps ? JSON.stringify(corps) : undefined });
  const texte = await r.text(); if (!r.ok) throw new Error(`${methode} ${route} : ${r.status} ${texte}`); return texte ? JSON.parse(texte) : null;
}
async function login(email) { return (await api('POST', '/auth/login', { email, motDePasse })).token; }
assert.equal((await api('GET', '/auth/config')).demonstration, true, 'Le backend doit être en mode démonstration.');
const partenaire = await login('commerce@sprint9.demo'), livreur = await login('coursier@sprint9.demo');
const produit = (await api('GET', '/partenaire/produits', null, partenaire))[0];
const commandes = [];
for (let i = 1; i <= 3; i++) {
  const jeton = await login(`voisin${i}@sprint9.demo`), adresse = (await api('GET', '/adresses', null, jeton))[0];
  const panier = { partenaireId: produit.partenaireId, adresseId: adresse.id, lignes: [{ produitId: produit.id, quantite: 1 }], cleIdempotence: crypto.randomUUID() };
  const devis = await api('POST', '/commandes/devis', panier, jeton);
  const c = await api('POST', '/commandes', { ...panier, devisEmpreinte: devis.empreinte }, jeton);
  await api('PUT', `/partenaire/commandes/${c.id}/accepter`, { tempsPreparationMinutes: 1 }, partenaire);
  await api('PUT', `/partenaire/commandes/${c.id}/prete`, null, partenaire); commandes.push(c);
}
assert.equal(new Set(commandes.map(c => c.groupeQuartierId)).size, 1);
const offre = (await api('GET', '/livreur/offres', null, livreur)).find(o => o.source === 'QUARTIER' && o.nbCommandes === 3);
assert.ok(offre, 'Un lot de trois commandes doit être proposé au coursier démo.');
const lot = await api('PUT', `/livreur/offres/${offre.id}/accepter`, null, livreur);
assert.equal(lot.commandes.length, 3);
console.log(JSON.stringify({ groupe: commandes[0].groupeQuartierId, lot: lot.id, commandes: lot.commandes, message: '3 voisins → 1 groupe → 1 lot → 1 coursier. Collecter puis remettre chaque colis avec les QR des applications.' }, null, 2));
