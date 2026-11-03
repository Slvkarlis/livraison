// Navigateur Chrome/Edge via CDP natif, sans dépendance de test supplémentaire.
// Préparer : mvn test dependency:build-classpath -Dmdep.outputFile=../.tmp/backend-classpath.txt
// Puis : node scripts/verify-sprint1-browser.cjs (JAVA_HOME doit pointer sur Java 25).
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const temp = path.join(root, '.tmp');
const apiBase = 'http://127.0.0.1:18083';
const webBase = 'http://127.0.0.1:15173';
const suffix = Date.now();
const password = 'sprint1-browser-password';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const sorties = [];
function ok(message) { sorties.push(message); console.log('OK ' + message); }
async function attendre(condition, message, timeout = 12000) {
  const fin = Date.now() + timeout;
  while (Date.now() < fin) { if (await condition()) return; await sleep(80); }
  throw new Error(message);
}
async function api(method, route, body, token) {
  const r = await fetch(apiBase + route, { method, headers: { 'Content-Type': 'application/json',
    ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text(); return { status: r.status, data: text ? JSON.parse(text) : null };
}
async function main() {
  fs.mkdirSync(temp, { recursive: true });
  const javaHome = process.env.JAVA_HOME || path.join(temp, 'jdk25', fs.readdirSync(path.join(temp, 'jdk25'))[0]);
  const classpath = [path.join(root, 'backend/target/test-classes'), path.join(root, 'backend/target/classes'),
    fs.readFileSync(path.join(temp, 'backend-classpath.txt'), 'utf8').trim()].join(path.delimiter);
  const log = path.join(temp, 'browser-backend.log');
  const fd = fs.openSync(log, 'w');
  const backend = spawn(path.join(javaHome, 'bin/java.exe'), ['-cp', classpath, 'com.fleetpulse.livraison.LivraisonApplication',
    '--server.port=18083', '--spring.profiles.active=demo', '--app.demo.enabled=true', '--debug=false',
    '--logging.level.org.springframework=WARN', '--logging.level.org.hibernate=WARN', '--logging.level.com.fleetpulse=INFO',
    '--spring.jpa.show-sql=false'], { windowsHide: true, stdio: ['ignore', fd, fd] });
  const dist = path.join(root, 'web-responsable/dist');
  const serveur = http.createServer((req, res) => {
    if (req.url.startsWith('/api/')) {
      const proxy = http.request(apiBase + req.url, { method: req.method, headers: req.headers }, r => {
        res.writeHead(r.statusCode, r.headers); r.pipe(res);
      }); proxy.on('error', () => { res.writeHead(502); res.end(); }); req.pipe(proxy); return;
    }
    const requested = path.resolve(dist, '.' + req.url.split('?')[0]);
    const fichier = requested.startsWith(dist + path.sep) && fs.existsSync(requested) && fs.statSync(requested).isFile()
      ? requested : path.join(dist, 'index.html');
    const mime = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(fichier)] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime }); fs.createReadStream(fichier).pipe(res);
  });
  let chrome, ws;
  try {
    await attendre(async () => { try { return (await fetch(apiBase + '/api/auth/config')).ok; } catch { return false; } }, 'Backend de test indisponible', 45000);
    await new Promise(r => serveur.listen(15173, '127.0.0.1', r));
    const admin = (await api('POST', '/api/auth/login', { email: 'admin@sprint1.test', motDePasse: 'test-admin-password' })).data.token;
    const identite = role => ({ nom: 'Navigateur', prenom: role, email: role.toLowerCase() + suffix + '@sprint1.test',
      telephone: '+216' + String(20000000 + Number(String(suffix).slice(-7))), motDePasse: password });
    const partenaire = { ...identite('Partenaire'), nomCommerce: 'Commerce navigateur', categorie: 'Épicerie', adresse: 'Tunis',
      latitude: 36.8, longitude: 10.1, matriculeFiscal: 'MF-TEST' };
    const coursier = { ...identite('Coursier'), telephone: '+216' + String(30000000 + Number(String(suffix).slice(-7))), numeroIdentite: 'CIN-TEST', vehiculeDeclare: 'Scooter TU-123' };
    const dossierPartenaire = await api('POST', '/api/auth/inscription/partenaire', partenaire); assert.equal(dossierPartenaire.status, 201);
    const dossierCoursier = await api('POST', '/api/auth/inscription/livreur', coursier); assert.equal(dossierCoursier.status, 201);
    const finance = { ...identite('Finance'), telephone: undefined, sousRole: 'FINANCE' };
    assert.equal((await api('POST', '/api/admin/responsables', finance, admin)).status, 201);
    const executable = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
    if (!executable) throw new Error('Chrome ou Edge requis.');
    chrome = spawn(executable, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
      '--remote-debugging-port=19222', '--user-data-dir=' + path.join(temp, 'chrome-sprint1-' + suffix), 'about:blank'],
      { windowsHide: true, stdio: 'ignore' });
    let cible;
    await attendre(async () => { try { cible = (await (await fetch('http://127.0.0.1:19222/json/list')).json()).find(p => p.type === 'page'); return !!cible; } catch { return false; } }, 'Chrome indisponible');
    ws = new WebSocket(cible.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
    let sequence = 0; const attentes = new Map(); const erreurs = [];
    ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id) {
      const a = attentes.get(m.id); if (!a) return; attentes.delete(m.id); m.error ? a.reject(new Error(m.error.message)) : a.resolve(m.result);
    } else if (m.method === 'Runtime.exceptionThrown') erreurs.push(m.params.exceptionDetails.text); };
    const cdp = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; attentes.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
    const evaluer = async expression => { const r = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text); return r.result.value; };
    const texte = () => evaluer('document.body.innerText');
    const contient = s => attendre(async () => (await texte()).includes(s), 'Texte absent : ' + s);
    const naviguer = async route => { await cdp('Page.navigate', { url: webBase + route }); await sleep(250); };
    const remplir = async (libelle, valeur) => evaluer(
      '(' + ((label, value) => { const champ = [...document.querySelectorAll('label')].find(l => l.innerText.trim().startsWith(label))?.querySelector('input, textarea, select');
        if (!champ) throw new Error('Champ absent : ' + label);
        const proto = champ.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : champ.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, 'value').set.call(champ, value); champ.dispatchEvent(new Event(champ.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
      }).toString() + ')(' + JSON.stringify(libelle) + ',' + JSON.stringify(valeur) + ')');
    const cliquer = async label => {
      await attendre(() => evaluer('(' + (label => [...document.querySelectorAll('button,a')].some(b => b.innerText.trim() === label || b.getAttribute('aria-label') === label)).toString() + ')(' + JSON.stringify(label) + ')'), 'Bouton absent : ' + label);
      await evaluer('(' + (label => {
      const bouton = [...document.querySelectorAll('button,a')].find(b => b.innerText.trim() === label || b.getAttribute('aria-label') === label);
      if (!bouton) throw new Error('Bouton absent : ' + label); bouton.click();
    }).toString() + ')(' + JSON.stringify(label) + ')'); await sleep(100);
    };
    const connexion = async (email, passe) => { await remplir('Email ou téléphone', email); await remplir('Mot de passe', passe); await cliquer('Se connecter'); };
    await cdp('Runtime.enable'); await cdp('Page.enable');
    await naviguer('/comptes'); await contient('Connexion'); await contient('Mode démonstration'); ok('Route anonyme protégée et bandeau démo');
    await connexion('admin@sprint1.test', 'incorrect'); await contient('Identifiants ou session invalides.'); ok('Erreur de connexion lisible');
    await cliquer('Mot de passe oublié ?'); await contient('Mot de passe oublié');
    await remplir('Email ou téléphone', 'absent@sprint1.test'); await cliquer('Recevoir un code'); await contient('Si le compte existe');
    assert.ok(await evaluer("[...document.querySelectorAll('button')].some(b => b.disabled && b.innerText.includes('Renvoyer'))")); ok('Demande de reset et compte à rebours');
    await cliquer('Retour à la connexion'); await connexion('admin@sprint1.test', 'test-admin-password'); await contient('Dossiers de candidature');
    await cliquer('Voir le détail'); await contient('Détail du dossier'); await cliquer('Refuser le dossier');
    await remplir('Motif', '   '); await cliquer('Confirmer'); await contient('Le motif est obligatoire.');
    await remplir('Motif', 'Pièce à renouveler'); await cliquer('Confirmer'); await contient('Action enregistrée');
    assert.equal(await evaluer("document.querySelector('[role=dialog]').contains(document.activeElement)"), true);
    await cliquer('Fermer'); ok('Refus avec motif obligatoire, succès et focus dans la modale');
    await cliquer('Comptes'); await contient('Gestion des comptes'); await remplir('Rechercher', 'Partenaire');
    await remplir('Statut', '');
    // Active un des dossiers pour tester la suspension et la réactivation depuis l’interface.
    const aActiver = (await api('GET', '/api/admin/comptes', undefined, admin)).data.find(c => c.statut === 'EN_ATTENTE');
    assert.ok(aActiver); await api('PUT', '/api/admin/dossiers/' + aActiver.id + '/valider', undefined, admin);
    await remplir('Rechercher', aActiver.email); await cliquer('Actualiser'); await contient(aActiver.email); await cliquer('Voir le détail');
    await cliquer('Suspendre le compte'); await remplir('Motif', '  '); await cliquer('Confirmer'); await contient('Le motif est obligatoire.');
    await remplir('Motif', 'Vérification du dossier'); await cliquer('Confirmer'); await contient('Action enregistrée : Suspendu');
    assert.equal((await api('POST', '/api/auth/login', { email: aActiver.email, motDePasse: password })).status, 403);
    await cliquer('Réactiver le compte'); await remplir('Motif', 'Vérification terminée'); await cliquer('Confirmer'); await contient('Action enregistrée : Validé');
    assert.equal((await api('POST', '/api/auth/login', { email: aActiver.email, motDePasse: password })).status, 200);
    await cliquer('Fermer'); ok('Suspension, connexion refusée et réactivation réelles');
    await cliquer('Journal d’audit'); await contient('Journal d’audit'); await contient('Consulter');
    await remplir('Action', 'COMPTE_SUSPENDU'); await cliquer('Filtrer'); await contient('COMPTE SUSPENDU'); await cliquer('Consulter'); await contient('Vérification du dossier');
    await cliquer('Fermer'); ok('Audit filtré, paginé et détail');
    await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    assert.ok(await evaluer('document.documentElement.scrollWidth <= window.innerWidth')); ok('Back-office responsive à 390 px');
    await cdp('Page.captureScreenshot', { format: 'png' }).then(r => fs.writeFileSync(path.join(temp, 'sprint1-mobile-web.png'), Buffer.from(r.data, 'base64')));
    await cliquer('Se déconnecter'); await contient('Connexion');
    await connexion(finance.email, password); await contient('Journal d’audit');
    assert.equal(await evaluer("[...document.querySelectorAll('nav a')].some(a => a.textContent === 'Comptes')"), false);
    await evaluer("history.pushState({}, '', '/comptes'); window.dispatchEvent(new PopStateEvent('popstate'))"); await contient('Accès refusé');
    ok('Menu FINANCE limité et accès direct interdit aux comptes');
    assert.deepEqual(erreurs, []); ok('Aucune exception JavaScript non gérée');
    fs.writeFileSync(path.join(temp, 'sprint1-browser-results.json'), JSON.stringify(sorties, null, 2));
    await cdp('Browser.close').catch(() => {});
  } finally {
    ws?.close(); chrome?.kill(); backend.kill(); serveur.close(); fs.closeSync(fd);
  }
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
