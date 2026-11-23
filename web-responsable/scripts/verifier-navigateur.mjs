// Chrome lancé séparément sur le port 9229. Aucun paquet de test supplémentaire.
// Les réponses API simulées restent dans le navigateur, jamais dans l'application.
import { mkdir, writeFile } from 'node:fs/promises';
const cible = await fetch('http://127.0.0.1:9229/json/new?about:blank', { method: 'PUT' }).then(r => r.json());
const ws = new WebSocket(cible.webSocketDebuggerUrl);
await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
let numero = 0;
const attente = new Map(), evenements = new Map();
ws.addEventListener('message', e => {
  const m = JSON.parse(e.data);
  if (m.id) { const p = attente.get(m.id); attente.delete(m.id); if (m.error) p?.reject(new Error(JSON.stringify(m.error))); else p?.resolve(m.result); }
  else for (const f of evenements.get(m.method) ?? []) f(m.params);
});
const commande = (method, params = {}) => new Promise((resolve, reject) => { const id = ++numero; const timeout=setTimeout(()=>{attente.delete(id);reject(new Error('Délai CDP : '+method));},20000); attente.set(id, { resolve:r=>{clearTimeout(timeout);resolve(r)}, reject:e=>{clearTimeout(timeout);reject(e)} }); ws.send(JSON.stringify({ id, method, params })); });
const ecouter = (nom, fn) => evenements.set(nom, [...(evenements.get(nom) ?? []), fn]);
const pause = ms => new Promise(r => setTimeout(r, ms));
const evaluer = async expression => { const r = await commande('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text); return r.result.value; };
const exiger = (condition, message) => { if (!condition) throw new Error(message); };
const cliquer = texte => evaluer(`(() => { const b=[...document.querySelectorAll('button,a')].find(b=>b.textContent.trim()===${JSON.stringify(texte)}); if(!b) throw Error('Contrôle absent : '+${JSON.stringify(texte)}); b.click(); return true; })()`);
const captures = new URL('../screenshots/', import.meta.url);
await mkdir(captures, { recursive: true });
let page = '', mode = 'normal', role = null;
const erreurs = [], avertissements = [], reseau = [], rapport = [];
ecouter('Runtime.exceptionThrown', p => erreurs.push({ page, texte: p.exceptionDetails.exception?.description ?? p.exceptionDetails.text }));
ecouter('Runtime.consoleAPICalled', p => { if (p.type === 'error') erreurs.push({ page, texte: p.args.map(a => a.value ?? a.description).join(' ') }); if(p.type === 'warning') avertissements.push({page, texte:p.args.map(a=>a.value??a.description).join(' ')}); });
ecouter('Network.loadingFailed', p => reseau.push({ page, texte: p.errorText, type: p.type }));
await commande('Page.enable'); await commande('Runtime.enable'); await commande('Network.enable');
const profil = () => ({ id:1, nom:'Responsable', prenom:'Amira', email:'admin@fleetpulse.tn', telephone:null, role:'RESPONSABLE', statut:'ACTIF', sousRole:role, motifStatut:null });
const livraison = (id, statut, prenom, longitude, latitude) => ({ id, statut, livreurPrenom:prenom, codeSuivi:`FP-${id}`, zoneNom:'Centre-ville', nomPartenaire:'Chez Amira', partenaireId:1, clientEmail:'client@example.test', adresse:'Avenue Habib Bourguiba, Tunis', latitude, longitude, creneauDebut:null, creneauFin:null, typeLivraison:'IMMEDIATE', modePaiement:'COD', statutPaiement:'A_LA_LIVRAISON', distanceKm:1.8, fraisLivraison:3, supplementImmediat:0, montantTotal:25, montantArticles:22, montantACollecter:25, dateCreation:new Date().toISOString(), lignes:[], notes:null });
const commandes = [livraison(701,'RECUPEREE','Amine',10.1772,36.8032),livraison(702,'A_PROXIMITE','Yasmine',10.1795,36.8065),livraison(703,'PRETE',null,10.1815,36.8008)];
const debut = Date.now();
const supervision = () => ({ maintenant:new Date().toISOString(),parLots:true,ia:false,delaiOffreSecondes:30,delaiRechercheMaxMinutes:10,enAttente:[],lots:[{id:1,statut:'ACCEPTE',source:'REGLES',livreurPrenom:'Amine',creeLe:new Date().toISOString(),accepteLe:new Date().toISOString(),distanceKm:1.8,dureeMinutes:8,commandes:[{id:701,codeSuivi:'FP-701',statut:'RECUPEREE'},{id:703,codeSuivi:'FP-703',statut:'PRETE'}],offres:[]}],livreurs:[{id:11,prenom:'Amine',nom:'Ben Ali',missions:2,offreEnCours:false,latitude:36.8005,longitude:10.171+(Date.now()-debut)/100000000,dernierePositionLe:new Date().toISOString()},{id:12,prenom:'Yasmine',nom:'Trabelsi',missions:1,offreEnCours:false,latitude:36.807,longitude:10.1795,dernierePositionLe:new Date().toISOString()}]});
ecouter('Fetch.requestPaused', async p => {
  const chemin = new URL(p.request.url).pathname;
  let data, status = 200;
  if (mode === 'erreur' && !['/api/auth/config','/api/auth/login','/api/me'].includes(chemin)) { data = { message:'Serveur temporairement indisponible.' }; status=503; }
  else if (chemin === '/api/auth/config') data={demonstration:false,delaiRenvoiSecondes:60};
  else if (chemin === '/api/auth/login') data={token:'fixture-local',refreshToken:'fixture-local-refresh',expiresInMs:3600000,refreshExpiresInMs:3600000,type:'Bearer'};
  else if (chemin === '/api/me') data=profil();
  else if (chemin === '/api/admin/dispatch') data=mode==='vide'?{...supervision(),livreurs:[],lots:[]}:supervision();
  else if (chemin === '/api/livraisons') data=mode==='vide'?[]:commandes;
  else if (chemin === '/api/admin/audit/page') data={content:[],number:0,totalPages:0,totalElements:0};
  else if (/\/api\/admin\/commandes\/\d+\/suivi/.test(chemin)) data={commandeId:701,codeSuivi:'FP-701',statut:'RECUPEREE',livreurPrenom:'Amine',montantAttendu:25,actions:[],historique:[]};
  else if (chemin === '/api/auth/logout') data={};
  else data=[];
  await commande('Fetch.fulfillRequest',{requestId:p.requestId,responseCode:status,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(JSON.stringify(data)).toString('base64')});
});
await commande('Fetch.enable',{patterns:[{urlPattern:'*/api/*',requestStage:'Request'}]});
async function naviguer(route) { console.log('Page',route);page=route; await evaluer(`history.pushState({},'',${JSON.stringify(route)});dispatchEvent(new PopStateEvent('popstate'))`); await pause(1500); }
async function connexion(sousRole=null) {
  role=sousRole; page='/connexion'; await commande('Page.navigate',{url:'http://127.0.0.1:5173/connexion'}); await pause(1400);
  await evaluer(`(() => { const fields=[...document.querySelectorAll('input')]; const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; for(const [i,value] of ['admin@fleetpulse.tn','admin12345'].entries()){setter.call(fields[i],value);fields[i].dispatchEvent(new Event('input',{bubbles:true}));} })()`);
  await pause(100); await evaluer(`document.querySelector('form').requestSubmit()`); await pause(1500);
  exiger(await evaluer(`!!document.querySelector('.sidebar')`),'Connexion de test échouée');
}
try {
  await commande('Emulation.setDeviceMetricsOverride',{width:1366,height:768,deviceScaleFactor:1,mobile:false});
  await connexion();
  for (const route of ['/suivi-live','/accueil','/dispatch','/commandes']) { await naviguer(route); rapport.push({route,titre:await evaluer(`document.querySelector('h1')?.textContent`)}); }
  await naviguer('/suivi-live'); await cliquer('Voir la démonstration'); await pause(8000);
  exiger(await evaluer(`document.querySelectorAll('.mission-coursier').length===3`),'Trois coursiers de démo attendus');
  await evaluer(`document.querySelectorAll('.mission-coursier')[1].click()`); await pause(1100);
  exiger(await evaluer(`document.querySelector('.mission-commande h2').textContent==='Lafayette'`),'Sélection coursier incorrecte');
  await cliquer('Suivi'); await cliquer('Libre'); await cliquer('Vue 2D'); await pause(600); await cliquer('Vue 3D'); await pause(800);
  for (const width of [1366,390]) {
    await commande('Emulation.setDeviceMetricsOverride',{width,height:768,deviceScaleFactor:1,mobile:width===390}); await pause(900);
    const capture = await commande('Page.captureScreenshot',{format:'png',captureBeyondViewport:true}); await writeFile(new URL(`suivi-live-${width}.png`,captures),Buffer.from(capture.data,'base64'));
    exiger(await evaluer(`document.documentElement.scrollWidth<=innerWidth`),`Débordement horizontal à ${width}px`);
  }
  await commande('Emulation.setDeviceMetricsOverride',{width:1366,height:768,deviceScaleFactor:1,mobile:false});
  await cliquer('Revenir au direct'); await pause(1600);
  mode='vide'; await naviguer('/accueil'); await naviguer('/suivi-live'); exiger(await evaluer(`document.body.textContent.includes('La flotte est au repos')`),'État vide absent');
  mode='erreur'; await naviguer('/accueil'); await naviguer('/suivi-live'); exiger(await evaluer(`!!document.querySelector('[role=alert]')`),'État erreur absent');
  mode='normal';
  await connexion('FINANCE');
  exiger(await evaluer(`!!document.querySelector('nav a[href="/reclamations"]')&&!document.querySelector('nav a[href="/suivi-live"]')`),'Navigation Finance incorrecte');
  await naviguer('/suivi-live'); exiger(await evaluer(`document.body.textContent.includes('Accès refusé')`),'Garde Finance incorrecte');
  await connexion('OPERATIONS');
  exiger(await evaluer(`!!document.querySelector('nav a[href="/suivi-live"]')&&!document.querySelector('nav a[href="/reclamations"]')`),'Navigation Opérations incorrecte');
  await commande('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]}); await naviguer('/suivi-live'); await cliquer('Voir la démonstration'); await pause(1200);
  rapport.push({mouvementReduit:await evaluer(`getComputedStyle(document.querySelector('.mission-destination')).animationName`)});
  rapport.push({controlesSansNom:await evaluer(`[...document.querySelectorAll('button,input,select,textarea')].filter(e=>!e.textContent.trim()&&!e.getAttribute('aria-label')&&!e.labels?.length).map(e=>e.outerHTML.slice(0,180))`)});
  rapport.push({resultat:'Vérifications terminées',erreurs,avertissements,reseau});
  await writeFile(new URL('rapport-navigateur.json',captures),JSON.stringify(rapport,null,2));
  console.log(JSON.stringify(rapport,null,2));
} finally { ws.close(); await fetch(`http://127.0.0.1:9229/json/close/${cible.id}`).catch(()=>{}); }
