// Connexion réelle ; aucune création ou modification de zone n'est envoyée au serveur.
import { writeFile } from 'node:fs/promises';
const cible = await fetch('http://127.0.0.1:9229/json/new?about:blank', { method:'PUT' }).then(r=>r.json());
const ws = new WebSocket(cible.webSocketDebuggerUrl);
await new Promise(r=>ws.addEventListener('open',r,{once:true}));
let numero=0;
const attente=new Map(), erreurs=[], rapport=[];
ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const a=attente.get(m.id);attente.delete(m.id);m.error?a?.reject(Error(JSON.stringify(m.error))):a?.resolve(m.result);}else if(m.method==='Runtime.exceptionThrown')erreurs.push(m.params.exceptionDetails.exception?.description??m.params.exceptionDetails.text);else if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')erreurs.push(m.params.args.map(a=>a.value??a.description).join(' '));});
const cmd=(method,params={})=>new Promise((resolve,reject)=>{const id=++numero;const timer=setTimeout(()=>{attente.delete(id);reject(Error('Délai CDP : '+method));},20000);attente.set(id,{resolve:r=>{clearTimeout(timer);resolve(r)},reject:e=>{clearTimeout(timer);reject(e)}});ws.send(JSON.stringify({id,method,params}));});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const evaluer=async expression=>{const r=await cmd('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result.value;};
const exiger=(valeur,message)=>{if(!valeur)throw Error(message);};
const cliquer=texte=>evaluer(`(()=>{const b=[...document.querySelectorAll('button')].find(e=>e.textContent.trim()===${JSON.stringify(texte)});if(!b)throw Error('Bouton absent : '+${JSON.stringify(texte)});b.click();})()`);
const captures=new URL('../screenshots/',import.meta.url);
await cmd('Page.enable');await cmd('Runtime.enable');
async function connexion(){await cmd('Page.navigate',{url:'http://127.0.0.1:5173/connexion'});await pause(1700);await evaluer(`(()=>{const champs=document.querySelectorAll('input');const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;['admin@fleetpulse.tn','admin12345'].forEach((v,i)=>{setter.call(champs[i],v);champs[i].dispatchEvent(new Event('input',{bubbles:true}));});})()`);await pause(100);await evaluer(`document.querySelector('form').requestSubmit()`);await pause(2000);exiger(await evaluer(`!!document.querySelector('.sidebar')`),'Connexion réelle impossible');await evaluer(`history.pushState({},'','/zones');dispatchEvent(new PopStateEvent('popstate'))`);await pause(5000);}
try{
  await cmd('Emulation.setDeviceMetricsOverride',{width:1366,height:768,deviceScaleFactor:1,mobile:false});
  await connexion();
  exiger(await evaluer(`!!document.querySelector('.mission-zones canvas')&&!document.querySelector('iframe[src="/carte-zones.html"]')`),'La carte des zones doit utiliser MapLibre');
  const nombre=await evaluer(`document.querySelectorAll('.zones-selection button').length`);exiger(nombre>0,'Zones réelles absentes');
  if(nombre>1)await evaluer(`document.querySelectorAll('.zones-selection button')[1].click()`);
  await pause(900);exiger(await evaluer(`document.querySelectorAll('.zones-selection button')[${nombre>1?1:0}].getAttribute('aria-pressed')==='true'`),'Sélection de zone incorrecte');
  await cliquer('Vue 2D');await pause(500);await cliquer('Vue 3D');await pause(700);
  for(const width of [1366,390]){await cmd('Emulation.setDeviceMetricsOverride',{width,height:768,deviceScaleFactor:1,mobile:width===390});await pause(600);exiger(await evaluer(`document.documentElement.scrollWidth<=innerWidth`),'Débordement horizontal à '+width);const capture=await cmd('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile(new URL(`zones-3d-${width}.png`,captures),Buffer.from(capture.data,'base64'));}
  rapport.push({zonesReelles:nombre,selection:true,vues2d3d:true,captures:[1366,390]});
  await cmd('Emulation.setDeviceMetricsOverride',{width:1366,height:768,deviceScaleFactor:1,mobile:false});
  await cliquer('Créer une zone');await pause(1800);
  await evaluer(`document.querySelector('.modale .mission-zones').scrollIntoView({block:'center',behavior:'instant'})`);await pause(400);
  const rect=await evaluer(`(()=>{const r=document.querySelector('.modale canvas').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};})()`);
  for(const [dx,dy] of [[-.15,0],[.15,0],[.1,.15]]){const x=rect.x+rect.width*(.5+dx),y=rect.y+rect.height*(.5+dy);await cmd('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});await cmd('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1});await pause(150);}
  exiger(await evaluer(`document.querySelector('textarea[aria-label="Sommets"]').value.trim().split(String.fromCharCode(10)).length===3`),'Les clics doivent ajouter trois sommets');
  await cliquer('Annuler le dernier point');exiger(await evaluer(`document.querySelector('textarea[aria-label="Sommets"]').value.trim().split(String.fromCharCode(10)).length===2`),'Annulation du sommet incorrecte');
  await cliquer('Effacer le tracé');exiger(await evaluer(`document.querySelector('textarea[aria-label="Sommets"]').value===''`),'Effacement incorrect');
  await evaluer(`(()=>{const e=document.querySelector('textarea[aria-label="Sommets"]');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,['36.8,10.17','36.8,10.18','36.81,10.18'].join(String.fromCharCode(10)));e.dispatchEvent(new Event('input',{bubbles:true}));})()`);await pause(300);
  exiger(await evaluer(`document.querySelector('.modale .mission-legende').textContent.includes('3 / 200')`),'La saisie doit actualiser le contour');
  await evaluer(`document.querySelector('.modale button[aria-label="Fermer"]').click()`);await pause(1000);
  await evaluer(`[...document.querySelectorAll('button')].find(b=>b.textContent.startsWith('Modifier ')).click()`);await pause(1200);
  exiger(await evaluer(`document.querySelector('textarea[aria-label="Sommets"]').value.trim().split(String.fromCharCode(10)).length>=3`),'Le contour existant doit être prérempli');
  await evaluer(`document.querySelector('.modale button[aria-label="Fermer"]').click()`);
  rapport.push({creation:'Trois clics ajoutent trois sommets',annulation:true,effacement:true,saisieCoordonnees:true,modificationContourExistant:true,ecritureServeur:false});
  await evaluer(`history.pushState({},'','/suivi-live');dispatchEvent(new PopStateEvent('popstate'))`);await pause(1700);exiger(await evaluer(`document.querySelector('h1').textContent==='Suivi en direct'`),'Régression du suivi');
  await cmd('Page.addScriptToEvaluateOnNewDocument',{source:`const obtenir=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type.startsWith('webgl')?null:obtenir.call(this,type,...args)};`});
  await connexion();exiger(await evaluer(`document.querySelectorAll('.mission-schema polygon.zone-schema').length>0`),'Les polygones doivent rester visibles sans WebGL');
  rapport.push({sansWebGL:'Polygones visibles en 2D schématique',regressionSuivi:false,erreurs});
  exiger(erreurs.length===0,'Erreurs console : '+JSON.stringify(erreurs));
  console.log(JSON.stringify(rapport,null,2));await writeFile(new URL('rapport-zones-3d.json',captures),JSON.stringify(rapport,null,2));
}catch(e){await writeFile(new URL('rapport-zones-3d.json',captures),JSON.stringify({rapport,echec:e.message,erreurs},null,2));throw e;}
finally{ws.close();await fetch(`http://127.0.0.1:9229/json/close/${cible.id}`).catch(()=>{});}
