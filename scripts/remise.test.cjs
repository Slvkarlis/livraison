const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('../mobile/node_modules/typescript');

// Charge un module TypeScript du package shared ; ses imports relatifs sont charges de la meme facon.
function charger(nom) {
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../mobile/packages/shared/src', nom + '.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const m = { exports: {} };
  new Function('module', 'exports', 'require', code)(m, m.exports, (id) => (id.startsWith('./') ? charger(id.slice(2)) : require(id)));
  return m.exports;
}
const remise = charger('remise');

test('La remise se valide seulement colis à bord', () => {
  assert.equal(remise.peutValiderRemise('RECUPEREE'), true);
  assert.equal(remise.peutValiderRemise('A_PROXIMITE'), true);
  for (const s of ['AFFECTEE', 'LIVREE', 'ANNULEE']) assert.equal(remise.peutValiderRemise(s), false, s);
});

test('Le QR est renouvelé 20 s avant son expiration, jamais en boucle', () => {
  const maintenant = new Date('2026-11-13T12:00:00Z');
  assert.equal(remise.delaiRenouvellementQr('2026-11-13T12:02:00Z', maintenant), 100_000);
  assert.equal(remise.delaiRenouvellementQr('2026-11-13T12:00:10Z', maintenant), 5_000);
  assert.equal(remise.delaiRenouvellementQr('2026-11-13T11:00:00Z', maintenant), 5_000, 'horloge decalee : au moins 5 s');
});

test('Routes de la remise côté client', async () => {
  const appels = [];
  const api = remise.creerApiRemiseClient(async (m, r) => { appels.push(m + ' ' + r); });
  await api.qrRemise(4);
  await api.demanderCodeRemise(4);
  assert.deepEqual(appels, ['GET /api/commandes/4/qr-remise', 'POST /api/commandes/4/code-remise']);
});

test('Montant encaissé : saisie tolérante, 3 décimales au plus', () => {
  assert.equal(remise.lireMontant('15'), 15);
  assert.equal(remise.lireMontant(' 14,5 '), 14.5);
  assert.equal(remise.lireMontant('14.125'), 14.125);
  for (const s of ['', '-1', '14.1234', 'abc', '1,2,3']) assert.equal(remise.lireMontant(s), null, s);
});

test('Écart d\'encaissement calculé en millimes', () => {
  assert.equal(remise.ecartEncaissement(15, 15), 0);
  assert.equal(remise.ecartEncaissement(14.5, 15), -0.5);
  assert.equal(remise.ecartEncaissement(0.3, 0.1 + 0.2), 0, 'pas d\'écart fantôme dû aux flottants');
});

test('Route de la remise côté coursier', async () => {
  const appels = [];
  const espace = charger('espaceLivreur').creerApiLivreur(async (m, r, b) => { appels.push([m, r, b]); });
  await espace.validerRemise(7, 14.5, 'Pas de monnaie', '123456');
  assert.deepEqual(appels, [['POST', '/api/livreur/missions/7/remise', { montantEncaisse: 14.5, motifEcart: 'Pas de monnaie', preuve: '123456' }]]);
});
