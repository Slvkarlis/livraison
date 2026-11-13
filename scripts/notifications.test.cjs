const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('../mobile/node_modules/typescript');

const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../mobile/packages/shared/src/notifications.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const m = { exports: {} };
new Function('module', 'exports', 'require', code)(m, m.exports, require);
const n = m.exports;

test('Notification temps réel : lecture tolérante', () => {
  assert.deepEqual(n.lireNotification('{"id":1,"commandeId":4,"statut":"RECUPEREE","titre":"T","message":"M","creeLe":"d","lue":false}'),
    { id: 1, commandeId: 4, statut: 'RECUPEREE', titre: 'T', message: 'M', creeLe: 'd', lue: false });
  assert.equal(n.lireNotification('{"id":1,"titre":"T"}'), null);
  assert.equal(n.lireNotification('{oups'), null);
  assert.equal(n.lireNotification('{"id":2,"titre":"T","message":"M"}').commandeId, null);
});

test('Commande ouverte depuis une notification push touchée', () => {
  assert.equal(n.commandeDuPush({ commandeId: 12 }), 12);
  assert.equal(n.commandeDuPush({ commandeId: '12' }), 12, 'certaines plateformes renvoient du texte');
  for (const d of [null, undefined, {}, { commandeId: 'x' }, { commandeId: -3 }, { commandeId: 1.5 }]) assert.equal(n.commandeDuPush(d), null);
});

test('Routes des notifications', async () => {
  const appels = [];
  const api = n.creerApiNotifications(async (methode, route, corps) => { appels.push([methode, route, corps]); });
  await api.notifications();
  await api.marquerNotificationsLues();
  await api.enregistrerAppareil('ExponentPushToken[x]');
  await api.retirerAppareil('ExponentPushToken[x]');
  assert.deepEqual(appels, [
    ['GET', '/api/notifications', undefined],
    ['PUT', '/api/notifications/lues', undefined],
    ['PUT', '/api/notifications/appareil', { jeton: 'ExponentPushToken[x]' }],
    ['DELETE', '/api/notifications/appareil', { jeton: 'ExponentPushToken[x]' }],
  ]);
});
