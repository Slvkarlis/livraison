const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('../mobile/node_modules/typescript');
const code = ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname, '../mobile/packages/shared/src/notation.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const m = { exports: {} }; new Function('module', 'exports', code)(m, m.exports);
const { verifierNotation, ciblesRestantes, creerApiNotation } = m.exports;

test('Notation : entier 1 à 5 et commentaire de 500 caractères maximum', () => {
  for (const n of [0, 6, 2.5, NaN, Infinity]) assert.ok(verifierNotation(n, ''));
  for (const n of [1, 2, 3, 4, 5]) assert.equal(verifierNotation(n, 'x'.repeat(500)), null);
  assert.ok(verifierNotation(4, 'x'.repeat(501)));
});
test('Aucun formulaire avant livraison ni après un avis sur la même cible', () => {
  const v = { ouverte: false, cibles: ['LIVREUR', 'PARTENAIRE'], notes: [] };
  assert.deepEqual(ciblesRestantes(v), []);
  assert.deepEqual(ciblesRestantes({ ...v, ouverte: true, notes: [{ cible: 'LIVREUR' }] }), ['PARTENAIRE']);
});
test('Le serveur reçoit un rôle cible, jamais un identifiant fourni par le client', async () => {
  const appels = [];
  const api = creerApiNotation(async (...args) => { appels.push(args); });
  await api.notations(7); await api.noter(7, 'PARTENAIRE', 5, 'Bien');
  assert.deepEqual(appels, [['GET', '/api/commandes/7/notations'], ['POST', '/api/commandes/7/notations', { cible: 'PARTENAIRE', note: 5, commentaire: 'Bien' }]]);
});
