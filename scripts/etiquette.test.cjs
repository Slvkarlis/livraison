const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('../mobile/node_modules/typescript');

// etiquetteHtml.ts n'importe que des types : transpile et charge directement.
const code = ts.transpileModule(fs.readFileSync(path.join(__dirname,
  '../mobile/mobile-client/src/composants/partenaire/etiquette/etiquetteHtml.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const m = { exports: {} };
new Function('module', 'exports', 'require', code)(m, m.exports, require);
const { etiquetteHtml, echapperHtml } = m.exports;

const etiquette = {
  commandeId: 4, codeSuivi: 'FP-E333B76A-B90', codeCollecte: 'K7Q2MX', contenuQr: 'FLEETPULSE|FP-E333B76A-B90|K7Q2MX',
  clientPrenom: 'Amina', zoneNom: 'Tunis', nomCommerce: 'Chez Amira', nbArticles: 2, preteLe: null,
};

test('L’étiquette contient le QR, le code de collecte, le client et la commande', () => {
  const html = etiquetteHtml(etiquette, '<svg id="qr"></svg>');
  assert.match(html, /<svg id="qr"><\/svg>/);
  assert.match(html, /K7Q2MX/);
  assert.match(html, /Amina · 2 articles/);
  assert.match(html, /Commande FP-E333B76A-B90/);
  assert.match(html, /Chez Amira/);
});
test('Le texte libre est échappé avant impression', () => {
  assert.equal(echapperHtml(`<b>"O'Brien" & co</b>`), '&lt;b&gt;&quot;O&#39;Brien&quot; &amp; co&lt;/b&gt;');
  const html = etiquetteHtml({ ...etiquette, clientPrenom: '<script>alert(1)</script>', nbArticles: 1 }, '');
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.match(html, /1 article</);
});
