const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('../mobile/node_modules/typescript');
// Charge un module TypeScript du package shared ; ses imports relatifs ('./format') sont charges de la meme facon.
function charger(nom) {
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../mobile/packages/shared/src', nom + '.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const m = { exports: {} };
  new Function('module', 'exports', 'require', code)(m, m.exports, (id) => (id.startsWith('./') ? charger(id.slice(2)) : require(id)));
  return m.exports;
}
const r = charger('sprint2bis');

// Miroir de StatutLivraison.java
const STATUTS = ['PENDING_PARTNER', 'ACCEPTEE', 'REFUSEE', 'EN_PREPARATION', 'PRETE', 'AFFECTEE', 'RECUPEREE', 'ANNULEE',
  'EN_COURS', 'A_PROXIMITE', 'ARRIVEE', 'LIVREE', 'ECHEC', 'RETOURNEE'];

test('Chaque statut appartient à exactement un groupe de filtre', () => {
  for (const s of STATUTS) {
    assert.equal(r.GROUPES_COMMANDES.filter(g => g.statuts.includes(s)).length, 1, s);
  }
  assert.deepEqual(r.GROUPES_COMMANDES.flatMap(g => g.statuts).sort(), [...STATUTS].sort());
});
test('Les nouvelles commandes sont celles en attente du partenaire', () => {
  assert.equal(r.groupeDe('PENDING_PARTNER'), 'nouvelles');
  assert.equal(r.groupeDe('EN_PREPARATION'), 'en-cours');
  assert.equal(r.groupeDe('AFFECTEE'), 'pretes');
  assert.equal(r.groupeDe('ANNULEE'), 'terminees');
});
test('Le compteur par groupe couvre toute la liste', () => {
  const compte = r.compterParGroupe([{ statut: 'PENDING_PARTNER' }, { statut: 'PENDING_PARTNER' }, { statut: 'PRETE' }, { statut: 'REFUSEE' }]);
  assert.deepEqual(compte, { nouvelles: 2, 'en-cours': 0, pretes: 1, terminees: 1 });
});
test('Le partenaire voit sa propre formulation, pas celle du client', () => {
  assert.equal(r.libelleStatutPartenaire('PENDING_PARTNER'), 'Nouvelle — à traiter');
  assert.equal(r.libelleStatutPartenaire('PRETE'), 'Prête — en attente du livreur');
  assert.equal(r.libelleStatutPartenaire('ACCEPTEE'), 'Acceptée', 'les autres statuts gardent le libellé commun');
  for (const s of STATUTS) assert.ok(r.libelleStatutPartenaire(s).length > 0, s);
  assert.equal(r.libelleEtapePartenaire({ ancien: null, nouveau: 'PENDING_PARTNER' }), 'Commande passée');
  assert.equal(r.libelleEtapePartenaire({ ancien: 'PENDING_PARTNER', nouveau: 'ACCEPTEE' }), 'Acceptée');
});
test('Les appels API visent les routes partenaire', async () => {
  const appels = [];
  const api = r.creerApiPartenaire(async (method, path) => { appels.push(method + ' ' + path); return null; });
  await api.commandesRecues(); await api.commandeRecue(42);
  assert.deepEqual(appels, ['GET /api/partenaire/commandes', 'GET /api/partenaire/commandes/42']);
});
