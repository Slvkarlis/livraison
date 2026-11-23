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
await commande('Page.enable'); await commande('Runtime.enable'); await commande('Network.enable');await commande('Network.setCacheDisabled',{cacheDisabled:true});
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
  else if (chemin === '/api/admin/livreurs') data=mode==='vide'?[]:[{id:11,prenom:'Amine',nom:'Ben Ali',actif:true},{id:12,prenom:'Yasmine',nom:'Trabelsi',actif:true}];
  else if (chemin === '/api/admin/finance/caisses') data={cashEnCirculation:0,coursiers:[]};
  else if (chemin === '/api/admin/bi/operations') data={periode:{debut:'2026-11-01',fin:'2026-11-23'},statuts:[],zones:[],gainDistanceKm:null,gainTempsMinutes:null,indisponibiliteGains:'Aucune mesure.'};
  else if (chemin === '/api/admin/bi/partenaires') data={periode:{debut:'2026-11-01',fin:'2026-11-23'},partenaires:[]};
  else if (chemin === '/api/admin/bi/coursiers') data={periode:{debut:'2026-11-01',fin:'2026-11-23'},coursiers:[],zones:[]};
  else if (chemin === '/api/admin/finance/bi') data={periode:{debut:'2026-11-01',fin:'2026-11-23'},gmv:0,ventesArticles:0,commissionsNettes:0,margeLivraison:0,cashEnCirculation:0,reversementsAEffectuer:0,remunerationsAEffectuer:0,reversementsEffectues:0,remunerationsEffectuees:0,articlesVendus:0};
  else if (chemin === '/api/admin/entrepot/export') { const minuit=new Date(new Date().toLocaleDateString('sv-SE',{timeZone:'Africa/Tunis'})+'T08:00:00+01:00').getTime();data={traces:mode==='vide'?[]:[0,1,2,3].map((t)=>({livreurId:11,longitude:10.17+t*.002,latitude:36.802+t*.0005,date:new Date(minuit+t*60000).toISOString()}))}; }
  else if (/\/api\/admin\/commandes\/\d+\/suivi/.test(chemin)) data={commandeId:701,codeSuivi:'FP-701',statut:'RECUPEREE',livreurPrenom:'Amine',montantAttendu:25,actions:[],historique:[]};
  else if (chemin === '/api/auth/logout') data={};
  else data=[];
  await commande('Fetch.fulfillRequest',{requestId:p.requestId,responseCode:status,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(JSON.stringify(data)).toString('base64')});
});
await commande('Fetch.enable',{patterns:[{urlPattern:'*/api/*',requestStage:'Request'}]});
async function naviguer(route) { console.log('Page',route);page=route; await evaluer(`history.pushState({},'',${JSON.stringify(route)});dispatchEvent(new PopStateEvent('popstate'))`); await pause(1500); }
async function connexion(sousRole=null) {
  role=sousRole; page='/connexion'; await commande('Page.navigate',{url:'http://127.0.0.1:5174/connexion'}); await pause(1400);
  for(let i=0;i<40 && !await evaluer('!!document.querySelector("input")');i++) await pause(300);
  await evaluer(`(() => { const fields=[...document.querySelectorAll('input')]; const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; for(const [i,value] of ['admin@fleetpulse.tn','admin12345'].entries()){setter.call(fields[i],value);fields[i].dispatchEvent(new Event('input',{bubbles:true}));} })()`);
  await pause(100); await evaluer(`document.querySelector('form').requestSubmit()`); await pause(1500);
  exiger(await evaluer(`!!document.querySelector('.sidebar')`),'Connexion de test échouée');
}
try {
 await commande('Emulation.setDeviceMetricsOverride',{width:1366,height:768,deviceScaleFactor:1,mobile:false});
 await connexion();
 for (const route of ['/accueil','/commandes','/dispatch','/suivi-live']) {
  await naviguer(route);
  const capture=await commande('Page.captureScreenshot',{format:'png'});
  await writeFile(new URL(`avant-${route.slice(1)}.png`,captures),Buffer.from(capture.data,'base64'));
 }
 console.log('Captures initiales enregistrées',JSON.stringify({erreurs,avertissements}));
} finally { ws.close(); await fetch(`http://127.0.0.1:9229/json/close/${cible.id}`).catch(()=>{}); }
