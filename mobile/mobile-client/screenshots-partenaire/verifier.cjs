/* Vérification du frontend avec Chrome CDP, sans dépendance de test ajoutée.
 * Les réponses ci-dessous sont des fixtures : aucune vérification backend n'est revendiquée.
 * Chrome : --headless=new --remote-debugging-port=9235 --user-data-dir=<dossier temporaire>
 * node mobile/mobile-client/screenshots-partenaire/verifier.cjs [avant|apres]
 */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const phase = process.argv[2] || 'apres';
const dossier = __dirname;
function fixtures() {
  const vraiFetch = window.fetch.bind(window);
  const maintenant = Date.now();
  const iso = minutes => new Date(maintenant + minutes * 60000).toISOString();
  const produits = [{ id: 1, partenaireId: 7, nom: 'Couscous maison', prix: 18.5, disponible: true }, { id: 2, partenaireId: 7, nom: 'Brik à l’œuf', prix: 6, disponible: true }, { id: 3, partenaireId: 7, nom: 'Citronnade fraîche', prix: 4.5, disponible: false }];
  const commandes = ['PENDING_PARTNER', 'EN_PREPARATION', 'AFFECTEE', 'LIVREE'].map((statut, i) => ({
    id: 101 + i, codeSuivi: 'FP-00' + (101 + i), statut, dateCreation: iso(-2 - i * 7), clientPrenom: ['Amira', 'Youssef', 'Inès', 'Sami'][i], nbArticles: 3, total: 32.5,
    zoneNom: 'Tunis centre', lignes: [{ produitId: 1, nomProduit: 'Couscous maison', quantite: 1, prixUnitaire: 18.5, sousTotal: 18.5 }, { produitId: 2, nomProduit: 'Brik à l’œuf', quantite: 2, prixUnitaire: 6, sousTotal: 12 }], notes: 'Sans piment, merci.', montantArticles: 30.5, fraisLivraison: 2,
    tempsPreparationMinutes: i ? 15 : null, accepteeLe: i ? iso(-10) : null, motifRefus: null, commentaireRefus: null, pretePrevueLe: i ? iso(5) : null, nbAjustementsPreparation: 0, preparationDebutLe: i ? iso(-9) : null, preteLe: i > 1 ? iso(-3) : null, annuleeLe: null, motifAnnulation: null, livreurPrenom: i === 2 ? 'Karim' : null, recupereeLe: null, livreeLe: i === 3 ? iso(-1) : null,
    historique: [{ ancien: null, nouveau: 'PENDING_PARTNER', acteurRole: 'CLIENT', motif: null, date: iso(-2 - i * 7) }],
  }));
  const commerce = { id: 7, nomCommerce: 'Maison du Jasmin', categorie: 'Restaurant', adresse: '12 avenue Habib Bourguiba', ouvert: true, zoneId: 1, zoneNom: 'Tunis centre' };
  const boutique = { ouvert: true, acceptePourCommandes: true, pauseJusqua: null, expirationsConsecutives: 0, horaires: { ouverture: '09:00', fermeture: '22:00', jours: [1, 2, 3, 4, 5, 6] } };
  window.__verification = { produits, commandes, echec: '', requetes: [] };
  window.fetch = async (input, options = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href);
    if (!url.pathname.startsWith('/api/')) return vraiFetch(input, options);
    const route = url.pathname, methode = options.method || 'GET';
    const corps = options.body ? JSON.parse(options.body) : {};
    window.__verification.requetes.push({ route, methode, corps });
    if (window.__verification.echec && route.includes(window.__verification.echec)) return new Response(JSON.stringify({ message: 'Connexion interrompue. Réessayez.' }), { status: 503 });
    let data;
    if (route === '/api/auth/login') data = { token: 'fixture', refreshToken: 'fixture' };
    else if (route === '/api/me') data = { id: 7, nom: 'Ben Ali', prenom: 'Nour', email: 'demo@example.test', telephone: '+21620000000', role: 'PARTENAIRE', statut: 'ACTIF', sousRole: null, motifStatut: null, vehicule: null };
    else if (route === '/api/auth/config') data = { demonstration: false, delaiRenvoiSecondes: 60 };
    else if (route === '/api/partenaire/commerce') { if (methode === 'PUT') commerce.ouvert = corps.ouvert; data = commerce; }
    else if (route.startsWith('/api/partenaire/boutique')) { boutique.ouvert = commerce.ouvert; boutique.acceptePourCommandes = commerce.ouvert; if (methode === 'POST') { boutique.pauseJusqua = iso(corps.minutes); boutique.acceptePourCommandes = false; } if (methode === 'DELETE') boutique.pauseJusqua = null; data = boutique; }
    else if (route === '/api/partenaire/produits' && methode === 'GET') data = produits;
    else if (route.startsWith('/api/partenaire/produits')) { const id = Number(route.split('/')[4]); const index = produits.findIndex(p => p.id === id); data = { ...corps, id: id || produits.length + 1, partenaireId: 7 }; if (index >= 0) produits[index] = data; else produits.push(data); }
    else if (route === '/api/partenaire/ventes') { const debut = url.searchParams.get('debut'), fin = url.searchParams.get('fin'); const n = Math.round((Date.parse(fin) - Date.parse(debut)) / 86400000) + 1; data = { periode: { debut, fin }, commandes: 8 * n, chiffreAffaires: 244 * n, meilleursProduits: produits.map((p, i) => ({ id: p.id, nom: p.nom, quantite: (10 - i * 2) * n, chiffreAffaires: p.prix * (10 - i * 2) * n })) }; }
    else if (route === '/api/partenaire/commandes') data = commandes;
    else if (route.startsWith('/api/partenaire/commandes/')) {
      const commande = commandes.find(c => c.id === Number(route.split('/')[4]));
      if (route.endsWith('/etiquette')) data = { commandeId: commande.id, codeSuivi: commande.codeSuivi, codeCollecte: '482917', contenuQr: 'fixture-collecte', clientPrenom: commande.clientPrenom, nomCommerce: commerce.nomCommerce, zoneNom: commande.zoneNom, nbArticles: commande.nbArticles, preteLe: commande.preteLe };
      else { const ancien = commande.statut;
        if (route.endsWith('/accepter')) { commande.statut = 'ACCEPTEE'; commande.tempsPreparationMinutes = corps.tempsPreparationMinutes; commande.pretePrevueLe = iso(corps.tempsPreparationMinutes); }
        if (route.endsWith('/refuser')) { commande.statut = 'REFUSEE'; commande.motifRefus = corps.motif; }
        if (route.endsWith('/debut')) commande.statut = 'EN_PREPARATION';
        if (route.endsWith('/prete')) { commande.statut = 'PRETE'; commande.preteLe = iso(0); }
        if (route.endsWith('/temps')) { commande.nbAjustementsPreparation++; commande.pretePrevueLe = iso(corps.tempsPreparationMinutes); }
        if (methode !== 'GET') commande.historique.push({ ancien, nouveau: commande.statut, acteurRole: 'PARTENAIRE', motif: null, date: iso(0) });
        data = commande;
      }
    } else if (route.includes('/notations')) data = [];
    else data = {};
    return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
}
async function main() {
  const cibles = await fetch('http://127.0.0.1:9235/json').then(r => r.json());
  const cible = cibles.find(t => t.type === 'page');
  const ws = new WebSocket(cible.webSocketDebuggerUrl);
  await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
  let sequence = 0; const attente = new Map(); const erreurs = [];
  ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id) { const p = attente.get(m.id); attente.delete(m.id); if (m.error) p.reject(new Error(JSON.stringify(m.error))); else p.resolve(m.result); } if (m.method === 'Runtime.exceptionThrown') erreurs.push(m.params.exceptionDetails.text + ': ' + m.params.exceptionDetails.exception?.description); });
  const cdp = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; attente.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
  const evaluer = async expression => { const r = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description); return r.result.value; };
  const attendre = async expression => { for (let i = 0; i < 120; i++) { if (await evaluer(expression)) return; await new Promise(r => setTimeout(r, 500)); } throw new Error('Attente : ' + expression + '\n' + await evaluer('document.body.innerText')); };
  const texte = t => attendre('document.body.innerText.includes(' + JSON.stringify(t) + ')');
  const cliquer = async t => { await evaluer("(()=>{const e=[...document.querySelectorAll('[role=button],[role=tab],button')].find(e=>e.innerText===" + JSON.stringify(t) + "||e.getAttribute('aria-label')===" + JSON.stringify(t) + "||(e.getAttribute('role')==='tab'&&e.innerText.endsWith(" + JSON.stringify(t) + ")));if(!e)throw Error('Bouton absent : '+" + JSON.stringify(t) + ");e.click();})()"); };
  const remplir = (label, valeur) => evaluer("(()=>{const e=document.querySelector('input[aria-label=" + JSON.stringify(label) + "]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e," + JSON.stringify(valeur) + ");e.dispatchEvent(new Event('input',{bubbles:true}));})()");
  const capture = async nom => { await new Promise(r => setTimeout(r, 600)); const r = await cdp('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(dossier, phase + '-' + nom + '.png'), Buffer.from(r.data, 'base64')); };
  await cdp('Page.enable'); await cdp('Runtime.enable');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: false });
  await cdp('Page.addScriptToEvaluateOnNewDocument', { source: '(' + fixtures.toString() + ')()' });
  await cdp('Page.navigate', { url: 'http://localhost:8092' });
  await texte('Se connecter'); await remplir('Email ou téléphone', 'demo@example.test'); await remplir('Mot de passe', 'fixture-password'); await cliquer('Se connecter');
  await texte('Commandes'); await texte('FP-00101'); await capture('01-commandes');
  for (const [onglet, attendu, fichier] of [['Catalogue', 'Couscous maison', '02-catalogue'], ['Ventes', 'Mes ventes', '03-ventes'], ['Commerce', 'Maison du Jasmin', '04-profil']]) { await cliquer(onglet); await texte(attendu); await capture(fichier); }
  await cliquer('Commandes');
  await evaluer("[...document.querySelectorAll('[role=button]')].find(e=>e.getAttribute('aria-label')?.includes('FP-00101')).click()");
  await texte('Sans piment'); await capture('05-detail');
  if (phase === 'apres') await verifierActions({ cdp, evaluer, attendre, texte, cliquer, remplir, capture });
  fs.writeFileSync(path.join(dossier, phase + '-resultats.json'), JSON.stringify({ mode: 'Frontend avec réponses API simulées ; backend non testé', largeur: 390, erreurs, resultats: await evaluer('window.__verification.requetes') }, null, 2));
  ws.close(); assert.deepEqual(erreurs, []); console.log('OK : 4 onglets et détail à 390 px, captures ' + phase + ', aucune exception JavaScript.');
}
async function verifierActions() {}
main().catch(e => { console.error(e); process.exit(1); });
