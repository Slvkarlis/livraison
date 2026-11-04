const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('../mobile/node_modules/typescript');

// Seules les fonctions pures de tempsReel.tsx sont testees : le module est transpile avec des dependances factices.
const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../mobile/packages/shared/src/tempsReel.tsx'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const factices = {
  '@stomp/stompjs': { Client: class {} },
  react: { createContext: () => ({}), useCallback: (f) => f, useContext: () => ({}), useEffect: () => {}, useRef: (v) => ({ current: v }), useState: (v) => [v, () => {}] },
  'react/jsx-runtime': { jsx: () => null },
  'react-native': { Platform: { OS: 'web' } },
  './api': { api: {}, http: {} },
  './config': { apiBaseUrl: () => '' },
};
const m = { exports: {} };
new Function('module', 'exports', 'require', code)(m, m.exports, (id) => factices[id] ?? require(id));
const r = m.exports;

test('URL du canal temps réel dérivée de l’URL de l’API', () => {
  assert.equal(r.urlTempsReel('http://192.168.18.5:8083'), 'ws://192.168.18.5:8083/ws');
  assert.equal(r.urlTempsReel('https://api.exemple.tn/'), 'wss://api.exemple.tn/ws');
});
test('Message temps réel : nouvelle commande, changement, message invalide ignoré', () => {
  assert.deepEqual(r.lireEvenement('{"commandeId":4,"ancien":null,"nouveau":"PENDING_PARTNER"}'), { commandeId: 4, ancien: null, nouveau: 'PENDING_PARTNER' });
  assert.deepEqual(r.lireEvenement('{"commandeId":4,"ancien":"PENDING_PARTNER","nouveau":"ACCEPTEE"}').ancien, 'PENDING_PARTNER');
  assert.equal(r.lireEvenement('pas du json'), null);
  assert.equal(r.lireEvenement('{"nouveau":"PRETE"}'), null);
  assert.equal(r.FILE_COMMANDES, '/user/queue/commandes');
});
