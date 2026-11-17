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
const finance = charger('finance');
const maintenant = new Date('2026-11-17T12:00:00Z');

test('Anciennete du cash en heures entieres', () => {
  assert.equal(finance.heuresDepuis('2026-11-17T09:30:00Z', maintenant), 2);
  assert.equal(finance.heuresDepuis('2026-11-17T13:00:00Z', maintenant), 0, 'horloge decalee : jamais negatif');
});

test('Conseil de depot selon le solde et l’anciennete (US-504)', () => {
  assert.equal(finance.conseilDepot({ solde: 0, commandes: [] }, maintenant), 'Aucun cash à déposer.');
  assert.equal(finance.conseilDepot({ solde: 15, commandes: [{ livreeLe: '2026-11-17T10:00:00Z' }] }, maintenant),
    'Déposez l’intégralité de ce montant auprès du responsable.');
  assert.equal(finance.conseilDepot({ solde: 15, commandes: [{ livreeLe: '2026-11-16T10:00:00Z' }] }, maintenant),
    'Cash détenu depuis 26 h : déposez-le auprès du responsable.');
});

test('Libelle de semaine sans dependance au fuseau', () => {
  assert.equal(finance.libelleSemaine('2026-11-16'), 'Semaine du 16/11');
});
