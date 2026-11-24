/* Vérification de l'interface Finance avec réponses API simulées.
 * Aucun POST n'est envoyé au backend : aucune clôture financière réelle n'est validée.
 * Prérequis : build puis preview sur 127.0.0.1:4174, Chrome CDP sur 127.0.0.1:9235.
 * node web-responsable/screenshots/verifier-reversements-manuels.cjs
 */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

function installerScenario() {
  const base = {
    id: null, semaine: '2026-11-16', debut: '2026-11-15T23:00:00Z', fin: '2026-11-22T23:00:00Z', valideLe: null, validePar: null,
    totalReversements: 290.44, totalRemunerations: 30, nbCommandesPartenaires: 7, nbMissions: 7, commandesNonRapprochees: 1, cashNonRapproche: 25,
    partenaires: [{ partenaireId: 7, nomCommerce: 'Chez Amira', nbCommandes: 3, ventes: 125.5, commission: 15.06, net: 110.44 }, { partenaireId: 8, nomCommerce: 'Épicerie du centre', nbCommandes: 4, ventes: 200, commission: 20, net: 180 }],
    coursiers: [{ livreurId: 9, prenom: 'Karim', nom: 'Démo', nbMissions: 7, distanceKm: 18.5, remuneration: 30 }],
  };
  const ancien = { ...base, id: 40, semaine: '2026-11-09', debut: '2026-11-08T23:00:00Z', fin: '2026-11-15T23:00:00Z', valideLe: '2026-11-16T10:00:00Z', validePar: 'finance@verification.test', totalReversements: 88, partenaires: [{ partenaireId: 10, nomCommerce: 'Commerce de la semaine précédente', nbCommandes: 1, ventes: 100, commission: 12, net: 88 }] };
  const scenario = window.__verificationReversements = { valide: false, echecPost: false, echecLectures: false, delai: 0, requetes: [], base, ancien };
  const vraiFetch = window.fetch.bind(window);
  window.fetch = async (entree, options = {}) => {
    const url = new URL(typeof entree === 'string' ? entree : entree.url, location.href);
    if (!url.pathname.startsWith('/api/')) return vraiFetch(entree, options);
    const methode = options.method || 'GET', route = url.pathname;
    scenario.requetes.push({ route, methode });
    const reponse = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
    if (route === '/api/auth/config') return reponse({ demonstration: false, delaiRenvoiSecondes: 60 });
    if (route === '/api/auth/login') return reponse({ token: 'fixture', refreshToken: 'fixture' });
    if (route === '/api/me') return reponse({ id: 1, prenom: 'Finance', nom: 'Vérification', email: 'finance@verification.test', role: 'RESPONSABLE', statut: 'ACTIF', sousRole: null });
    if (route === '/api/admin/finance/caisses') return reponse({ cashEnCirculation: 0, coursiers: [] });
    if (route === '/api/admin/finance/closings' && methode === 'POST') {
      if (scenario.echecPost) return reponse({ message: 'Clôture indisponible. Réessayez.' }, 503);
      await new Promise(r => setTimeout(r, 150));
      scenario.valide = true;
      return reponse({ ...base, id: 41, valideLe: '2026-11-24T10:00:00Z', validePar: 'finance@verification.test', commandesNonRapprochees: 0, cashNonRapproche: 0 }, 201);
    }
    if (route.includes('/closings')) {
      if (scenario.valide && scenario.echecLectures) return reponse({ message: 'Lecture interrompue après validation.' }, 503);
      if (scenario.delai) await new Promise(r => setTimeout(r, scenario.delai));
      const resultat = { ...base, id: 41, valideLe: '2026-11-24T10:00:00Z', validePar: 'finance@verification.test' };
      if (route.endsWith('/apercu')) {
        const semaine = url.searchParams.get('semaine');
        if (semaine === '2026-11-09') return reponse(ancien);
        if (semaine === '2026-11-02') return reponse({ ...base, semaine, partenaires: [], coursiers: [], totalReversements: 0, totalRemunerations: 0, commandesNonRapprochees: 0 });
        return reponse(scenario.valide ? resultat : base);
      }
      return reponse(scenario.valide ? [resultat, ancien] : [ancien]);
    }
    return reponse([]);
  };
}

async function main() {
  const cible = await fetch('http://127.0.0.1:9235/json/new?about:blank', { method: 'PUT' }).then(r => r.json());
  const ws = new WebSocket(cible.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let numero = 0;
  const attentes = new Map(), exceptions = [], controles = [], reseau = [];
  ws.onmessage = evenement => {
    const message = JSON.parse(evenement.data);
    if (message.id) {
      const attente = attentes.get(message.id); attentes.delete(message.id);
      if (message.error) attente.reject(new Error(message.error.message)); else attente.resolve(message.result);
    } else if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text);
    else if (message.method === 'Network.responseReceived' && message.params.response.status >= 400) reseau.push({ url: message.params.response.url, statut: message.params.response.status });
  };
  const cdp = (method, params = {}) => new Promise((resolve, reject) => { const id = ++numero; attentes.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
  const evaluer = async expression => { const r = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description); return r.result.value; };
  const attendre = async expression => { for (let i = 0; i < 80; i++) { if (await evaluer('Boolean(' + expression + ')')) return; await new Promise(r => setTimeout(r, 250)); } throw new Error('Attente dépassée : ' + expression + '\n' + await evaluer('document.body.innerText')); };
  const contient = texte => attendre('document.body.innerText.includes(' + JSON.stringify(texte) + ')');
  const cliquer = texte => evaluer("(()=>{const e=[...document.querySelectorAll('button,a')].find(e=>e.innerText.trim()===" + JSON.stringify(texte) + "||e.getAttribute('aria-label')===" + JSON.stringify(texte) + ");if(!e)throw Error('Contrôle absent');e.click()})()");
  const remplir = (selecteur, valeur) => evaluer("(()=>{const e=document.querySelector(" + JSON.stringify(selecteur) + ");Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e," + JSON.stringify(valeur) + ");e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))})()");
  const capturer = async nom => { await new Promise(r => setTimeout(r, 450)); const r = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); fs.writeFileSync(path.join(__dirname, nom + '.png'), Buffer.from(r.data, 'base64')); };
  const verifier = (message, valeur) => { assert.ok(valeur, message); controles.push(message); };
  try {
    await cdp('Page.enable'); await cdp('Runtime.enable'); await cdp('Network.enable');
    await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1080, deviceScaleFactor: 1, mobile: false });
    await cdp('Page.addScriptToEvaluateOnNewDocument', { source: '(' + installerScenario.toString() + ')()' });
    await cdp('Page.navigate', { url: 'http://127.0.0.1:4174/connexion' });
    await attendre("document.querySelector('input[type=password]')");
    await remplir('input[autocomplete=username]', 'finance@verification.test'); await remplir('input[type=password]', 'fixture-password');
    await evaluer("document.querySelector('form').requestSubmit()"); await contient('Espace responsable');
    await evaluer("document.querySelector('a[href=\"/finance\"]').click()"); await cliquer('Closing hebdomadaire');
    await remplir('input[type=date]', '2026-11-16'); await contient('Montants prévisionnels avant clôture');
    verifier('Aperçu : 110,440 DT pour Chez Amira et 180,000 DT pour l’épicerie', await evaluer("document.body.innerText.includes('110,440')&&document.body.innerText.includes('180,000')"));
    await capturer('reversements-avant-cloture-1440');
    await evaluer('window.__verificationReversements.echecPost=true'); await cliquer('Valider le closing'); await contient('Clôture indisponible');
    verifier('Un échec de validation ne produit aucun message de clôture réussie', !await evaluer("document.body.innerText.includes('Montants à virer manuellement')"));
    await evaluer('window.__verificationReversements.echecPost=false');
    await evaluer("(()=>{const b=[...document.querySelectorAll('button')].find(e=>e.innerText==='Valider le closing');b.click();b.click()})()");
    await contient('Montants à virer manuellement');
    verifier('Une validation réussie supplémentaire malgré un double clic', await evaluer("window.__verificationReversements.requetes.filter(r=>r.methode==='POST'&&r.route.endsWith('/closings')).length===2"));
    verifier('Total net 290,440 DT et mention de virement manuel', await evaluer("document.querySelector('.closing-montants').innerText.includes('290,440')&&document.body.innerText.includes('Aucun virement bancaire')"));
    await capturer('reversements-apres-cloture-1440');
    await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: false });
    await evaluer("window.scrollBy(0,document.querySelector('.closing-reglement').getBoundingClientRect().top-145)");
    await capturer('reversements-apres-cloture-390');
    verifier('Vue 390 px sans débordement horizontal de la page', await evaluer('document.documentElement.scrollWidth <= window.innerWidth'));
    verifier('Le montant individuel est immédiatement après le nom du partenaire', await evaluer("[...document.querySelectorAll('table')].find(t=>t.textContent.includes('Net à virer')).querySelector('tbody tr td:nth-child(2)').innerText.includes('110,440')"));
    await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1080, deviceScaleFactor: 1, mobile: false });
    await evaluer('window.__verificationReversements.delai=1000');
    await cliquer('Consulter la clôture du 2026-11-09');
    verifier('Changement de semaine : les anciens montants ne sont pas affichés pendant la lecture', !await evaluer("Boolean(document.querySelector('.closing-reglement'))"));
    await contient('Commerce de la semaine précédente');
    verifier('La clôture historique affiche son propre montant 88,000 DT', await evaluer("document.querySelector('.closing-montants').innerText.includes('88,000')"));
    await remplir('input[type=date]', '2026-11-02'); await contient('Aucun montant à virer aux partenaires pour cette clôture');
    controles.push('État vide explicite pour une clôture sans partenaire à régler');
    // Une nouvelle session vérifie le POST réussi suivi de lectures en erreur.
    await cdp('Page.reload'); await attendre("document.querySelector('input[type=password]')");
    await remplir('input[autocomplete=username]', 'finance@verification.test'); await remplir('input[type=password]', 'fixture-password');
    await evaluer("document.querySelector('form').requestSubmit()"); await contient('Espace responsable');
    await evaluer("document.querySelector('a[href=\"/finance\"]').click()"); await cliquer('Closing hebdomadaire');
    await remplir('input[type=date]', '2026-11-16'); await contient('Montants prévisionnels avant clôture');
    await evaluer('window.__verificationReversements.echecLectures=true'); await cliquer('Valider le closing');
    await contient('Lecture interrompue après validation');
    verifier('Le résultat du POST reste visible si le rafraîchissement échoue', await evaluer("document.body.innerText.includes('Montants à virer manuellement')&&document.querySelector('.closing-montants').innerText.includes('290,440')"));
    verifier('Aucune requête de paiement ni d’intégration bancaire', await evaluer("window.__verificationReversements.requetes.filter(r=>r.methode!=='GET').every(r=>r.route==='/api/auth/login'||r.route==='/api/admin/finance/closings')"));
    assert.deepEqual(exceptions, []);
    fs.writeFileSync(path.join(__dirname, 'rapport-reversements-manuels.json'), JSON.stringify({ mode: 'Interface avec réponses API simulées ; aucune clôture réelle ni virement effectué', controles, exceptions, largeurs: [1440, 390] }, null, 2));
    console.log(controles.map(c => 'OK : ' + c).join('\n'));
  } catch (e) { console.error(JSON.stringify({ exceptions, reseau })); throw e; }
  finally { await cdp('Page.close').catch(() => {}); ws.close(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
