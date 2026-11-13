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
const suivi = charger('suivi');
const livreur = charger('espaceLivreur');

test('Distance identique au backend (Distances.java)', () => {
  assert.ok(Math.abs(suivi.distanceKm({ latitude: 0, longitude: 0 }, { latitude: 1, longitude: 0 }) - 111.19) < 0.05);
  assert.ok(Math.abs(suivi.distanceKm({ latitude: 36.81, longitude: 10.18 }, { latitude: 36.88, longitude: 10.18 }) - 7.78) < 0.05);
});

test('Trajet simulé : pas de 50 m au plus, arrivée incluse, départ exclu', () => {
  const depart = { latitude: 36.8, longitude: 10.18 };
  const arrivee = { latitude: 36.81, longitude: 10.18 };   // ~1,1 km
  const points = suivi.pointsTrajet(depart, arrivee);
  assert.equal(points.length, 23);
  assert.deepEqual(points.at(-1), arrivee);
  let precedent = depart;
  for (const p of points) {
    assert.ok(suivi.distanceKm(precedent, p) * 1000 <= 50.0001);
    precedent = p;
  }
  assert.equal(suivi.pointsTrajet(depart, depart).length, 1, 'meme point : un seul envoi');
});

test('La position est transmise seulement pendant une mission', () => {
  assert.equal(suivi.enMission(['LIVREE', 'ANNULEE']), false);
  assert.equal(suivi.enMission(['LIVREE', 'AFFECTEE']), true);
  assert.equal(suivi.enMission(['A_PROXIMITE']), true);
});

test('Envoi de la position : route et précision', async () => {
  const appels = [];
  const api = livreur.creerApiLivreur(async (method, route, body) => { appels.push([method + ' ' + route, body]); return null; });
  await api.envoyerPosition({ latitude: 36.8, longitude: 10.18 }, 12.5);
  await api.envoyerPosition({ latitude: 36.8, longitude: 10.18 });
  assert.deepEqual(appels, [
    ['PUT /api/livreur/position', { latitude: 36.8, longitude: 10.18, precision: 12.5 }],
    ['PUT /api/livreur/position', { latitude: 36.8, longitude: 10.18, precision: null }],
  ]);
});
