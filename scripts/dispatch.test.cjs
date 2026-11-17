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
const dispatch = charger('dispatch');

test('Compte a rebours d’une offre : arrondi superieur, jamais negatif', () => {
  const maintenant = new Date('2026-11-17T12:00:00Z');
  assert.equal(dispatch.secondesRestantes('2026-11-17T12:00:59.200Z', maintenant), 60);
  assert.equal(dispatch.secondesRestantes('2026-11-17T11:59:00Z', maintenant), 0);
});

test('Seules les offres non expirees restent affichees', () => {
  const maintenant = new Date('2026-11-17T12:00:00Z');
  const offres = [{ id: 1, expireLe: '2026-11-17T12:00:30Z' }, { id: 2, expireLe: '2026-11-17T11:59:59Z' }];
  assert.deepEqual(dispatch.offresActives(offres, maintenant).map((o) => o.id), [1]);
});

test('Resume et libelles des arrets', () => {
  assert.equal(dispatch.resumeOffre({ nbCommandes: 1, distanceKm: 2, dureeMinutes: 12 }), '1 collecte · 2,0 km · 12 min');
  assert.equal(dispatch.resumeOffre({ nbCommandes: 3, distanceKm: 4.04, dureeMinutes: 31 }), '3 collectes · 4,0 km · 31 min');
  assert.equal(dispatch.libelleEtape({ ordre: 2, type: 'LIVRAISON', libelle: 'Amal — zone Tunis' }), '2. Livraison · Amal — zone Tunis');
});

test('L’itineraire n’est affiche que pour un lot de plusieurs commandes', () => {
  assert.equal(dispatch.itineraireUtile([{ id: 1, commandes: [8] }]), null);
  assert.equal(dispatch.itineraireUtile([{ id: 1, commandes: [8] }, { id: 2, commandes: [9, 10] }]).id, 2);
});

test('Promesse de livraison affichee a l’heure locale, rien sans promesse (US-406)', () => {
  const suivi = charger('suivi');
  const promesse = new Date('2026-11-17T11:45:00Z');
  const heure = `${String(promesse.getHours()).padStart(2, '0')}:${String(promesse.getMinutes()).padStart(2, '0')}`;
  assert.equal(suivi.messagePromesse(promesse.toISOString()), `Livraison promise avant ${heure}`);
  assert.equal(suivi.messagePromesse(null), null);
});
