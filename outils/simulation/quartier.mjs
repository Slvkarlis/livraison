// node outils/simulation/quartier.mjs : comparaison 10/25/40 %, mêmes 60 demandes.
// API_URL et API_TOKEN (responsable opérations) sont obligatoires ; aucune donnée réelle modifiée.
import assert from 'node:assert/strict';
const base = process.env.API_URL ?? 'http://localhost:8083';
const jeton = process.env.API_TOKEN;
if (!jeton) throw new Error('Définissez API_TOKEN avec un jeton responsable opérations.');
const commandes = Array.from({ length: 60 }, (_, i) => ({ id: i + 1, commerceId: 1, zoneId: 1,
  commerce: { latitude: 36.80, longitude: 10.18 }, client: { latitude: 36.82 + (i % 3) * .0003, longitude: 10.18 + (i % 5) * .0002 },
  creationSecondes: i * 90, preparationSecondes: 900, promesseSecondes: i * 90 + 3600, frais: 3 }));
const resultats = [];
for (const tauxAdhesion of [.1, .25, .4]) {
  const reponse = await fetch(base + '/api/admin/simulateur/quartier', { method: 'POST', signal: AbortSignal.timeout(30000),
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jeton}` },
    body: JSON.stringify({ depart: { latitude: 36.80, longitude: 10.18 }, vitesseKmh: 20, commandes, tauxAdhesion, fenetreSecondes: 480, rayonMetres: 400 }) });
  if (!reponse.ok) throw new Error(`Simulation HTTP ${reponse.status} : ${await reponse.text()}`);
  const comparaison = await reponse.json();
  for (const s of comparaison.scenarios) { assert.equal(s.commandes, commandes.length); resultats.push({ adhesion: tauxAdhesion, ...s }); }
}
console.table(resultats);
