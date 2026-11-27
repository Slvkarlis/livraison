// Backend H2 isolé et Edge/Chrome headless. Préparer npm run build dans web-responsable
// et mvn dependency:build-classpath -Dmdep.outputFile=../.tmp/backend-classpath-sprint9.txt -DincludeScope=test.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const racine = path.resolve(__dirname, '..'), temp = path.join(racine, '.tmp'), suffixe = Date.now();
const base = 'http://127.0.0.1:18099', web = 'http://127.0.0.1:15179';
const pause = ms => new Promise(r => setTimeout(r, ms));
async function attendre(fn, titre, delai = 20000) {
  const fin = Date.now() + delai; while (Date.now() < fin) { if (await fn()) return; await pause(100); } throw new Error(titre);
}
async function main() {
  fs.mkdirSync(temp, { recursive: true });
  const java = process.env.JAVA_HOME || path.join(temp, 'jdk25', fs.readdirSync(path.join(temp, 'jdk25'))[0]);
  const cp = [path.join(racine, 'backend/target/test-classes'), path.join(racine, 'backend/target/classes'), fs.readFileSync(path.join(temp, 'backend-classpath-sprint9.txt'), 'utf8').trim()].join(path.delimiter);
  const sortie = fs.openSync(path.join(temp, 'sprint9-navigateur-backend.log'), 'w');
  const backend = spawn(path.join(java, 'bin/java.exe'), ['-Dspring.devtools.restart.enabled=false', '-cp', cp, 'com.fleetpulse.livraison.LivraisonApplication',
    '--server.port=18099', '--spring.datasource.url=jdbc:h2:mem:s9navigateur;MODE=MySQL;DB_CLOSE_DELAY=-1', '--spring.profiles.active=demo',
    '--app.demo.enabled=true', '--app.sprint9.donnees-demo=true', '--app.commandes.intervalle-secondes=0', '--app.dispatch.par-lots=true',
    '--app.dispatch.planificateur=false', '--app.bi.planificateur=false', '--app.stripe.secret-key=', '--debug=false', '--logging.level.root=WARN'],
    { windowsHide: true, stdio: ['ignore', sortie, sortie] });
  const dist = path.join(racine, 'web-responsable/dist');
  const serveur = http.createServer((req, res) => {
    if (req.url.startsWith('/api/')) { const p = http.request(base + req.url, { method: req.method, headers: req.headers }, r => { res.writeHead(r.statusCode, r.headers); r.pipe(res); }); p.on('error', () => { res.writeHead(502); res.end(); }); req.pipe(p); return; }
    const candidat = path.resolve(dist, '.' + req.url.split('?')[0]);
    const fichier = candidat.startsWith(dist + path.sep) && fs.existsSync(candidat) && fs.statSync(candidat).isFile() ? candidat : path.join(dist, 'index.html');
    res.writeHead(200, { 'Content-Type': ({ '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' })[path.extname(fichier)] || 'application/octet-stream' }); fs.createReadStream(fichier).pipe(res);
  });
  let navigateur, ws;
  try {
    await attendre(async () => { try { return (await fetch(base + '/api/auth/config')).ok; } catch { return false; } }, 'Backend H2 indisponible', 60000);
    // Tomcat accepte des requêtes avant la fin d'ApplicationReadyEvent : attendre le commit des comptes démo.
    await attendre(async () => {
      const r = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'commerce@sprint9.demo', motDePasse: process.env.SPRINT9_MOT_DE_PASSE_DEMO ?? 'demo-sprint9-password' }) });
      return r.ok;
    }, 'Comptes Sprint 9 non initialisés');
    const demo = spawn(process.execPath, [path.join(racine, 'outils/simulation/demo-quartier.mjs')], { env: { ...process.env, API_URL: base }, windowsHide: true, stdio: 'inherit' });
    assert.equal(await new Promise(r => demo.on('exit', r)), 0, 'Démo HTTP');
    await new Promise(r => serveur.listen(15179, '127.0.0.1', r));
    const executable = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
    if (!executable) throw new Error('Edge ou Chrome requis.');
    const profil = path.join(temp, 'sprint9-chrome-' + suffixe);
    navigateur = spawn(executable, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', '--user-data-dir=' + profil, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
    let cible;
    await attendre(async () => { try { const port = fs.readFileSync(path.join(profil, 'DevToolsActivePort'), 'utf8').split('\n')[0]; cible = (await (await fetch('http://127.0.0.1:' + port + '/json/list')).json()).find(c => c.type === 'page'); return !!cible; } catch { return false; } }, 'Navigateur indisponible');
    ws = new WebSocket(cible.webSocketDebuggerUrl); await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
    let sequence = 0; const requetes = new Map(), erreurs = [];
    ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id) { const a = requetes.get(m.id); if (!a) return; requetes.delete(m.id); m.error ? a.reject(new Error(m.error.message)) : a.resolve(m.result); } else if (m.method === 'Runtime.exceptionThrown') erreurs.push(m.params.exceptionDetails.text); };
    const cdp = (method, params = {}, sessionId) => new Promise((resolve, reject) => { const id = ++sequence; requetes.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); });
    const evaluer = async expression => { const r = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text); return r.result.value; };
    const contient = t => attendre(async () => (await evaluer('document.body.innerText')).includes(t), 'Texte absent : ' + t);
    const cliquer = t => evaluer(`Array.from(document.querySelectorAll('button,a')).find(b => b.innerText.trim().startsWith(${JSON.stringify(t)})).click()`);
    const remplir = (libelle, valeur) => evaluer(`(() => { const c=Array.from(document.querySelectorAll('label')).find(l=>l.innerText.trim().startsWith(${JSON.stringify(libelle)})).querySelector('input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(c,${JSON.stringify(valeur)}); c.dispatchEvent(new Event('input',{bubbles:true})); })()`);
    await cdp('Runtime.enable'); await cdp('Page.enable');
    await cdp('Emulation.setDeviceMetricsOverride', { width: 1365, height: 1000, deviceScaleFactor: 1, mobile: false });
    await cdp('Page.navigate', { url: web + '/quartier' }); await contient('Connexion');
    await remplir('Email ou téléphone', 'admin@sprint1.test'); await remplir('Mot de passe', 'test-admin-password'); await cliquer('Se connecter');
    await contient('Quartier'); await cliquer('Quartier'); await contient('La Table du quartier'); await contient('FERME');
    await attendre(() => evaluer("document.querySelectorAll('iframe').length === 1"), 'Carte absente');
    // La carte est isolée par sandbox : inspection via son contexte CDP, sans retirer la protection.
    let frame, cibleIframe;
    await attendre(async () => {
      cibleIframe = (await cdp('Target.getTargets')).targetInfos.find(t => t.type === 'iframe');
      frame = (await cdp('Page.getFrameTree')).frameTree.childFrames?.[0]?.frame.id;
      return !!(frame || cibleIframe);
    }, 'Frame Leaflet absente');
    let sessionIframe, contexte;
    if (cibleIframe) sessionIframe = (await cdp('Target.attachToTarget', { targetId: cibleIframe.targetId, flatten: true })).sessionId;
    else contexte = (await cdp('Page.createIsolatedWorld', { frameId: frame })).executionContextId;
    await attendre(async () => { const r = await cdp('Runtime.evaluate', { ...(contexte ? { contextId: contexte } : {}), expression: "document.querySelectorAll('path.leaflet-interactive').length", returnByValue: true }, sessionIframe); return r.result?.value > 0; }, 'Cercle Leaflet non rendu');
    await attendre(async () => { const r = await cdp('Runtime.evaluate', { ...(contexte ? { contextId: contexte } : {}), expression: "(() => { const images=Array.from(document.querySelectorAll('img.leaflet-tile')); return (images.length > 0 && images.every(i=>i.complete && i.naturalWidth > 0)) || document.body.innerText.includes('Fond de carte indisponible'); })()", returnByValue: true }, sessionIframe); return r.result?.value; }, 'Chargement du fond de carte non terminé');
    await pause(1000); // Fin de l'animation de navigation avant la capture visuelle.
    await cdp('Page.captureScreenshot', { format: 'png' }).then(r => fs.writeFileSync(path.join(temp, 'sprint9-quartier-web.png'), Buffer.from(r.data, 'base64')));
    await cliquer('Simulateur de lots'); await contient('Charger 60 demandes de quartier'); await cliquer('Charger 60 demandes de quartier'); await cliquer('Simuler'); await contient('Lots + quartier');
    assert.ok((await evaluer('document.body.innerText')).includes('2.420'));
    await evaluer("Array.from(document.querySelectorAll('h2')).find(h=>h.innerText.startsWith('Comparaison à demandes constantes')).scrollIntoView({block:'start'})");
    await evaluer('window.scrollBy(0,-100)'); await pause(1000);
    await cdp('Page.captureScreenshot', { format: 'png' }).then(r => fs.writeFileSync(path.join(temp, 'sprint9-simulateur-web.png'), Buffer.from(r.data, 'base64')));
    assert.deepEqual(erreurs, []); console.log('OK Quartier, cercle Leaflet, démo HTTP, simulateur et absence d’exception JavaScript.');
    await cdp('Browser.close').catch(() => {});
  } finally { ws?.close(); navigateur?.kill(); backend.kill(); serveur.close(); fs.closeSync(sortie); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
