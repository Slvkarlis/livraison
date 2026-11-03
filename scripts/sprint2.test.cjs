const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('../mobile/node_modules/typescript');
const code = ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname, '../mobile/packages/shared/src/sprint2.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleSprint2 = { exports: {} };
new Function('module', 'exports', 'require', code)(moduleSprint2, moduleSprint2.exports, require);
const r = moduleSprint2.exports;
const produit = { id: 1, partenaireId: 10, nom: 'Brik', prix: 4.125, disponible: true };
const panier = () => r.ajouterProduit(r.panierVide(), produit).panier;
test('Un autre partenaire demande confirmation et conserve le panier sans mutation', () => {
  const p = panier(); const resultat = r.ajouterProduit(p, { ...produit, id: 2, partenaireId: 20 });
  assert.equal(resultat.confirmation, true); assert.equal(resultat.panier, p); assert.equal(p.partenaireId, 10);
});
test('Confirmation vide les anciens articles et notes puis ajoute le nouveau produit', () => {
  const p = { ...panier(), notes: 'Anciennes notes' };
  const nouveau = r.ajouterProduit(p, { ...produit, id: 2, partenaireId: 20 }, true);
  assert.equal(nouveau.confirmation, false); assert.equal(nouveau.panier.partenaireId, 20);
  assert.deepEqual(nouveau.panier.lignes, [{ produitId: 2, quantite: 1 }]); assert.equal(nouveau.panier.notes, '');
});
test('Même produit : incrémente la quantité sans doubler les lignes', () => {
  const p = panier(); const n = r.ajouterProduit(p, produit).panier;
  assert.deepEqual(n.lignes, [{ produitId: 1, quantite: 2 }]); assert.equal(p.lignes[0].quantite, 1);
});
test('Produit indisponible refusé', () => assert.throws(() => r.ajouterProduit(r.panierVide(), { ...produit, disponible: false })));
test('Quantités bornées et retrait de la dernière ligne réinitialisent le partenaire', () => {
  for (const q of [-1, 100, 1.5, NaN]) assert.throws(() => r.quantitePanier(panier(), 1, q));
  assert.deepEqual(r.quantitePanier(panier(), 1, 0), r.panierVide());
  assert.throws(() => r.ajouterProduit(r.quantitePanier(panier(), 1, 99), produit));
});
test('Validation panier : vide, notes, doublons, quantités, maximum de lignes', () => {
  assert.ok(r.verifierPanier(r.panierVide())); assert.equal(r.verifierPanier(panier()), null);
  assert.ok(r.verifierPanier({ ...panier(), notes: 'a'.repeat(501) }));
  assert.ok(r.verifierPanier({ ...panier(), lignes: [{ produitId: 1, quantite: 1 }, { produitId: 1, quantite: 2 }] }));
  assert.ok(r.verifierPanier({ ...panier(), lignes: [{ produitId: 1, quantite: 100 }] }));
  assert.ok(r.verifierPanier({ ...panier(), lignes: Array.from({ length: 51 }, (_, i) => ({ produitId: i + 1, quantite: 1 })) }));
});
test('Maximum de 50 produits distincts', () => {
  let p = r.panierVide(); for (let id = 1; id <= 50; id++) p = r.ajouterProduit(p, { ...produit, id }).panier;
  assert.throws(() => r.ajouterProduit(p, { ...produit, id: 51 })); assert.equal(r.verifierPanier(p), null);
});
test('Position : zéro accepté, champs vides, hors limites et infinis refusés', () => {
  assert.equal(r.verifierPosition('0', '0'), null);
  assert.equal(r.verifierPosition('36,81', '10,18'), null); assert.equal(r.nombreSaisi('36,81'), 36.81);
  for (const p of [['', '0'], ['91', '0'], ['0', '-181'], ['NaN', '1'], ['Infinity', '0']]) assert.ok(r.verifierPosition(...p));
});
test('Prix : positif, maximum et trois décimales', () => {
  for (const prix of ['', '0', '-1', '1.0001', '100001', 'NaN']) assert.ok(r.verifierProduit('Brik', prix));
  assert.equal(r.verifierProduit('Brik', '4.125'), null); assert.ok(r.verifierProduit(' ', '4'));
  assert.equal(r.verifierProduit('Brik', '4,125'), null); assert.equal(r.nombreSaisi('4,125'), 4.125);
});
test('Zone : nom, frais, sommets et coordonnées contrôlés', () => {
  const points = [{ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 }, { latitude: 1, longitude: 0 }];
  assert.equal(r.verifierZone('Centre', '0', points), null);
  assert.ok(r.verifierZone('', '3', points)); assert.ok(r.verifierZone('Centre', '-1', points));
  assert.ok(r.verifierZone('Centre', '3', points.slice(0, 2))); assert.ok(r.verifierZone('Centre', '3', [...points, { latitude: 91, longitude: 0 }]));
});
test('Clés idempotentes valides et distinctes', () => {
  const cles = Array.from({ length: 100 }, () => r.nouvelleCle());
  assert.equal(new Set(cles).size, 100); assert.ok(cles.every(c => /^[a-zA-Z0-9_-]{16,100}$/.test(c)));
});
test('API : filtre encodé et confirmation transporte la clé sans monter des prix', async () => {
  const appels = []; const api = r.creerApiMarche(async (...args) => { appels.push(args); return {}; });
  await api.partenaires(1, 'Café & thé', 'Épicerie');
  const url = new URL('http://test' + appels[0][1]); assert.equal(url.searchParams.get('recherche'), 'Café & thé');
  const corps = { partenaireId: 10, adresseId: 1, lignes: panier().lignes, notes: '', cleIdempotence: 'cle-de-test-123456', devisEmpreinte: 'abc' };
  await api.commander(corps); assert.equal(appels[1][0], 'POST'); assert.equal(appels[1][1], '/api/commandes'); assert.equal(appels[1][2], corps);
  assert.equal('total' in appels[1][2], false);
});
