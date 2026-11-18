const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('../mobile/node_modules/typescript');
const code = ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname, '../mobile/packages/shared/src/bi.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const m = { exports: {} }; new Function('module', 'exports', code)(m, m.exports);
const bi = m.exports;

test('Périodes BI : dates réelles, ordre et maximum 366 jours', () => {
  for (const [debut, fin] of [['', '2026-11-18'], ['2026-02-30', '2026-03-01'], ['2026-02-29', '2026-03-01'], ['2026-11-19', '2026-11-18'], ['2025-01-01', '2026-01-02']])
    assert.ok(bi.verifierPeriodeBi(debut, fin));
  assert.equal(bi.verifierPeriodeBi('2024-02-29', '2024-02-29'), null);
  assert.equal(bi.verifierPeriodeBi('2025-01-01', '2026-01-01'), null);
});
test('Les dates de filtre suivent Tunis, indépendamment du fuseau du navigateur', () => {
  assert.equal(bi.jourTunis(new Date('2026-11-17T22:59:59Z')), '2026-11-17');
  assert.equal(bi.jourTunis(new Date('2026-11-17T23:00:00Z')), '2026-11-18');
});
test('Une mesure absente reste indisponible, une valeur zéro reste mesurée', () => {
  assert.equal(bi.valeurBi(null), 'Non disponible');
  assert.equal(bi.valeurBi(undefined), 'Non disponible');
  assert.notEqual(bi.valeurBi(0), 'Non disponible');
  assert.ok(bi.valeurBi(-1, ' DT').includes('-1'));
});
test('Les ventes ciblent le partenaire connecté sans identifiant de commerce fourni', async () => {
  const appels = [];
  const api = bi.creerApiVentes(async (...args) => { appels.push(args); });
  await api.ventesPartenaire('2026-11-01', '2026-11-18');
  assert.deepEqual(appels, [['GET', '/api/partenaire/ventes?debut=2026-11-01&fin=2026-11-18']]);
  assert.equal(bi.filtreBi('2026-11-01', '2026-11-18', '2'), 'debut=2026-11-01&fin=2026-11-18&zoneId=2');
});
