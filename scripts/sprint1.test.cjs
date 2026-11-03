// Tests sans nouvelle dépendance : compilation en mémoire avec TypeScript déjà installé.
const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('../mobile/node_modules/typescript');
function charger(nom) {
  const fichier = path.join(__dirname, '../mobile/packages/shared/src/', nom + '.ts');
  const code = ts.transpileModule(fs.readFileSync(fichier, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function('module', 'exports', 'require', code)(module, module.exports, require);
  return module.exports;
}
const { creerClientHttp, ApiError } = charger('http');
const regles = charger('sprint1');
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });
const reponse = (status, data) => new Response(data ? JSON.stringify(data) : null, { status });
const ancien = { token: 'acces-test-ancien', refreshToken: 'refresh-test-ancien' };
const nouveau = { token: 'acces-test-nouveau', refreshToken: 'refresh-test-nouveau' };
const client = () => creerClientHttp(() => '', () => 'Réseau indisponible.');
test('401 simultanés : un seul refresh, rotation persistée et rejeu des requêtes', async () => {
  const http = client(); await http.setJetons(ancien);
  let refresh = 0; let rejeux = 0; let sauvegarde;
  http.onSauvegarde(async v => { sauvegarde = v; });
  global.fetch = async (url, init) => {
    if (url === '/api/auth/refresh') { refresh++; await new Promise(r => setTimeout(r, 15)); return reponse(200, nouveau); }
    if (init.headers.Authorization === 'Bearer ' + nouveau.token) { rejeux++; return reponse(200, { ok: true }); }
    return reponse(401);
  };
  const resultats = await Promise.all(Array.from({ length: 8 }, () => http.request('GET', '/api/me')));
  assert.equal(refresh, 1); assert.equal(rejeux, 8); assert.deepEqual(sauvegarde, nouveau);
  assert.ok(resultats.every(r => r.ok));
});
test('401 tardif sur ancien JWT : réutilise le JWT déjà renouvelé', async () => {
  const http = client(); await http.setJetons(ancien); let refresh = 0;
  global.fetch = async (url, init) => {
    if (url === '/api/auth/refresh') { refresh++; return reponse(200, nouveau); }
    if (url === '/api/lent' && init.headers.Authorization === 'Bearer ' + ancien.token) await new Promise(r => setTimeout(r, 30));
    return init.headers.Authorization === 'Bearer ' + ancien.token ? reponse(401) : reponse(200, { ok: true });
  };
  await Promise.all([http.request('GET', '/api/me'), http.request('GET', '/api/lent')]); assert.equal(refresh, 1);
});
for (const status of [401, 403, 503]) test('Échec refresh ' + status + ' : ferme la session sans boucle', async () => {
  const http = client(); await http.setJetons(ancien); let fermetures = 0; let refresh = 0;
  http.onExpire(() => fermetures++);
  global.fetch = async url => { if (url === '/api/auth/refresh') { refresh++; return reponse(status); } return reponse(401); };
  const resultats = await Promise.allSettled([http.request('GET', '/api/me'), http.request('GET', '/api/me')]);
  assert.ok(resultats.every(r => r.status === 'rejected')); assert.equal(http.getJetons(), null);
  assert.equal(refresh, 1); assert.equal(fermetures, 1);
});
test('Second 401 après refresh : un seul rejeu puis déconnexion', async () => {
  const http = client(); await http.setJetons(ancien); let appels = 0; let fermetures = 0;
  http.onExpire(() => fermetures++);
  global.fetch = async url => { appels++; return url === '/api/auth/refresh' ? reponse(200, nouveau) : reponse(401); };
  await assert.rejects(http.request('GET', '/api/me'), e => e.status === 401);
  assert.equal(appels, 3); assert.equal(fermetures, 1); assert.equal(http.getJetons(), null);
});
test('403 de rôle : ne renouvelle pas la session', async () => {
  const http = client(); await http.setJetons(ancien); let appels = 0;
  global.fetch = async () => { appels++; return reponse(403, { code: 'ACCES_REFUSE', message: 'Accès refusé.' }); };
  await assert.rejects(http.request('GET', '/api/admin/comptes'), e => e.code === 'ACCES_REFUSE');
  assert.equal(appels, 1); assert.deepEqual(http.getJetons(), ancien);
});
test('Mauvais login : aucun refresh ni jeton dans la requête publique', async () => {
  const http = client(); await http.setJetons(ancien);
  global.fetch = async (url, init) => { assert.equal(url, '/api/auth/login'); assert.equal(init.headers.Authorization, undefined); return reponse(401); };
  await assert.rejects(http.request('POST', '/api/auth/login', {}), ApiError); assert.deepEqual(http.getJetons(), ancien);
});
test('Logout : révoque le refresh côté serveur et efface les jetons', async () => {
  const http = client(); await http.setJetons(ancien); let sauvegarde;
  http.onSauvegarde(async v => { sauvegarde = v; });
  global.fetch = async (url, init) => { assert.equal(url, '/api/auth/logout'); assert.equal(JSON.parse(init.body).refreshToken, ancien.refreshToken); return reponse(204); };
  await http.logout(); assert.equal(http.getJetons(), null); assert.equal(sauvegarde, null);
});
test('Logout pendant refresh : aucune restauration tardive, nouveau refresh révoqué', async () => {
  const http = client(); await http.setJetons(ancien); let terminer; let demarrer; const depart = new Promise(r => { demarrer = r; });
  const revoques = [];
  global.fetch = async (url, init) => {
    if (url === '/api/auth/refresh') { demarrer(); return new Promise(r => { terminer = () => r(reponse(200, nouveau)); }); }
    if (url === '/api/auth/logout') { revoques.push(JSON.parse(init.body).refreshToken); return reponse(204); }
    return reponse(401);
  };
  const requete = http.request('GET', '/api/me'); const rejet = assert.rejects(requete);
  await depart; await http.logout(); terminer(); await rejet;
  assert.equal(http.getJetons(), null); assert.deepEqual(revoques, [ancien.refreshToken, nouveau.refreshToken]);
});
test('Réseau en échec : message français et code 0', async () => {
  global.fetch = async () => { throw new Error('offline'); };
  await assert.rejects(client().request('GET', '/api/me'), e => e.status === 0 && e.message === 'Réseau indisponible.');
});
test('Guards : opérations, finance et administrateur principal', () => {
  const p = { role: 'RESPONSABLE', statut: 'ACTIF', sousRole: null };
  assert.ok(regles.peutOperations(p)); assert.ok(regles.peutAudit(p)); assert.equal(regles.destination(p), '/dossiers');
  assert.ok(regles.peutOperations({ ...p, sousRole: 'OPERATIONS' }));
  const finance = { ...p, sousRole: 'FINANCE' };
  assert.equal(regles.peutOperations(finance), false); assert.ok(regles.peutAudit(finance)); assert.equal(regles.destination(finance), '/audit');
});
test('Guards : aucun accès admin aux clients, partenaires et coursiers', () => {
  for (const role of ['CLIENT', 'PARTENAIRE', 'LIVREUR']) {
    const p = { role, statut: 'ACTIF', sousRole: null };
    assert.equal(regles.peutOperations(p), false); assert.equal(regles.peutAudit(p), false);
    assert.ok(regles.peutRole(p, role));
  }
  assert.equal(regles.peutOperations(null), false);
});
test('Guards : statut inactif bloque tous les espaces de rôle', () => {
  for (const statut of ['EN_ATTENTE', 'COMPLEMENT_DEMANDE', 'REFUSE', 'SUSPENDU']) {
    const p = { role: 'RESPONSABLE', statut, sousRole: null };
    assert.equal(regles.peutOperations(p), false); assert.equal(regles.peutAudit(p), false);
    assert.equal(regles.peutRole(p, 'RESPONSABLE'), false); assert.equal(regles.destination(p), '/dossier');
  }
});
test('OTP : téléphone international et code de six chiffres obligatoires', () => {
  for (const tel of ['', '20123456', '+012345678', '+216abc', '+1234567890123456']) assert.equal(regles.telephoneValide(tel), false);
  assert.ok(regles.telephoneValide('+21620123456'));
  for (const code of ['', '12345', '1234567', '12a456']) assert.equal(regles.codeValide(code), false);
  assert.ok(regles.codeValide('012345'));
  assert.equal(regles.motDePasseValide('court'), false);
});
for (const action of ['refus', 'complément', 'suspension', 'réactivation']) test(action + ' : motif obligatoire, espaces refusés, longueur contrôlée', () => {
  assert.ok(regles.verifierMotif('')); assert.ok(regles.verifierMotif('  \n  '));
  assert.ok(regles.verifierMotif('a'.repeat(501))); assert.equal(regles.verifierMotif(' Pièce expirée '), null);
});
test('Candidatures : pièces et position valides, zéro accepté, champ vide refusé', () => {
  const f = { ...regles.candidatureVide, nom: 'Test', prenom: 'Compte', email: 'test@example.tn',
    telephone: '+21620123456', motDePasse: 'password-test', nomCommerce: 'Commerce', categorie: 'Épicerie',
    adresse: 'Tunis', latitude: '0', longitude: '0', matriculeFiscal: 'MF-123' };
  assert.equal(regles.verifierCandidature(f, true), null);
  assert.ok(regles.verifierCandidature({ ...f, latitude: '' }, true));
  assert.ok(regles.verifierCandidature({ ...f, latitude: '91' }, true));
  assert.ok(regles.verifierCandidature({ ...f, longitude: 'NaN' }, true));
  assert.ok(regles.verifierCandidature(f, false));
  assert.equal(regles.verifierCandidature({ ...f, numeroIdentite: 'CIN-1', vehiculeDeclare: 'Scooter' }, false), null);
  assert.equal('motDePasse' in regles.payloadCandidature(f, true, true), false);
});
