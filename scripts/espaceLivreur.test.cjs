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
const livreur = charger('espaceLivreur');
const sprint2bis = charger('sprint2bis');

test('Seules les zones en vigueur permettent de travailler (un renfort hors période est exclu)', () => {
  const disponibilite = { disponible: false, miseAJourLe: null, zones: [
    { nom: 'Tunis centre', type: 'PRINCIPALE', enVigueur: true },
    { nom: 'Ariana', type: 'TEMPORAIRE', enVigueur: false },
  ] };
  assert.deepEqual(livreur.zonesEnVigueur(disponibilite).map((z) => z.nom), ['Tunis centre']);
  assert.equal(livreur.LIBELLES_AFFECTATION.TEMPORAIRE, 'Renfort');
});

test('Les appels API visent les routes du coursier', async () => {
  const appels = [];
  const api = livreur.creerApiLivreur(async (method, route, body) => { appels.push([method + ' ' + route, body]); return null; });
  await api.disponibilite();
  await api.seDeclarerDisponible({ latitude: 36.81, longitude: 10.18 });
  await api.seDeclarerIndisponible();
  await api.missions();
  await api.mission(7);
  await api.confirmerCollecte(7, 'FLEETPULSE|FP-ABC|K7Q2MX');
  assert.deepEqual(appels, [
    ['GET /api/livreur/disponibilite', undefined],
    ['PUT /api/livreur/disponibilite', { disponible: true, latitude: 36.81, longitude: 10.18 }],
    ['PUT /api/livreur/disponibilite', { disponible: false }],
    ['GET /api/livreur/missions', undefined],
    ['GET /api/livreur/missions/7', undefined],
    ['POST /api/livreur/missions/7/collecte', { code: 'FLEETPULSE|FP-ABC|K7Q2MX' }],
  ]);
});

test('Le client voit qui vient récupérer sa commande', () => {
  const base = { nomPartenaire: 'Chez Amira', pretePrevueLe: null, motifRefus: null, commentaireRefus: null };
  assert.equal(sprint2bis.messageDecisionClient({ ...base, statut: 'AFFECTEE', livreurPrenom: 'Sami' }),
    'Chez Amira : Sami va récupérer votre commande.');
  assert.equal(sprint2bis.messageDecisionClient({ ...base, statut: 'AFFECTEE' }), 'Chez Amira : un livreur va récupérer votre commande.');
  assert.equal(sprint2bis.messageDecisionClient({ ...base, statut: 'RECUPEREE', livreurPrenom: 'Sami' }),
    'Sami a récupéré votre commande. Elle est en route vers vous.');
  assert.equal(sprint2bis.libelleEtapeClient({ ancien: 'AFFECTEE', nouveau: 'RECUPEREE' }), 'Récupérée par le livreur');
});
