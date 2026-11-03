// Réutilise le navigateur réel, la base H2 et les neuf contrôles du Sprint 1.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
module.exports = async function verifier({ api, admin, cdp, evaluer, remplir, cliquer, contient, connexion, attendre, ok, temp, suffix }) {
  const resultats = [];
  const valide = message => { resultats.push(message); ok(message); };
  await evaluer("history.pushState({}, '', '/zones'); window.dispatchEvent(new PopStateEvent('popstate'))");
  await contient('Accès refusé'); valide('FINANCE : accès direct aux zones refusé');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await cdp('Page.bringToFront');
  await cliquer('Se déconnecter'); await cliquer('Revenir à mon espace'); await contient('Email ou téléphone'); await connexion('admin@sprint1.test', 'test-admin-password'); await contient('Dossiers de candidature');
  await cliquer('Zones et frais'); await contient('Aucune zone.');
  await cliquer('Créer une zone'); await contient('Sommets :');
  await attendre(() => evaluer("document.querySelector('[role=dialog] iframe').getAttribute('aria-busy') === 'false'"), 'Leaflet indisponible');
  const cadres = (await cdp('Target.getTargets')).targetInfos.filter(t => t.type === 'iframe');
  // Les iframes sandboxées sont des cibles Chrome distinctes (OOPIF).
  for (const cadre of cadres) await cdp('Target.attachToTarget', { targetId: cadre.targetId, flatten: true });
  const rect = await evaluer("(()=>{const e=document.querySelector('[role=dialog] iframe');e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.x,y:r.y};})()");
  let nbSommets = 0;
  for (const [x,y] of [[80,100],[200,120],[150,240]]) {
    await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: rect.x+x, y: rect.y+y });
    await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', x: rect.x+x, y: rect.y+y, button: 'left', clickCount: 1 });
    await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', x: rect.x+x, y: rect.y+y, button: 'left', clickCount: 1 });
    nbSommets++;
    try { await attendre(() => evaluer("document.querySelector('textarea[aria-label=Sommets]').value.trim().split('\\n').filter(Boolean).length >= " + nbSommets), 'Clic sans sommet', 3000); }
    catch (e) {
      await cdp('Page.captureScreenshot', { format: 'png' }).then(r => fs.writeFileSync(path.join(temp, 'sprint2-carte-echec.png'), Buffer.from(r.data, 'base64')));
      throw new Error(e.message + ' : ' + JSON.stringify(await evaluer("({sommets:document.querySelector('textarea').value,iframe:document.elementFromPoint(" + (rect.x+x) + "," + (rect.y+y) + ")?.tagName,rect:" + JSON.stringify(rect) + "})")));
    }
  }
  await attendre(() => evaluer("document.querySelector('textarea[aria-label=Sommets]').value.trim().split('\\n').length === 3"), 'Les clics sur la carte ne créent pas les sommets');
  valide('Trois sommets tracés à la souris sur la carte Leaflet réelle');
  await remplir('Nom de la zone', 'Tunis test navigateur'); await remplir('Frais de livraison', '3.125');
  // Le tracé est aussi accessible au clavier quand les tuiles distantes sont indisponibles.
  await remplir('Sommets', '36.75,10.05\n36.75,10.25\n36.86,10.25\n36.86,10.05');
  await cliquer('Enregistrer la zone'); await contient('Zone et frais enregistrés'); await contient('Tunis test navigateur');
  let zones = (await api('GET', '/api/admin/zones', undefined, admin)).data;
  assert.equal(zones.length, 1); assert.equal(zones[0].fraisLivraison, 3.125); valide('Zone créée depuis le formulaire réel, frais et géométrie persistés');
  await cliquer('Modifier Tunis test navigateur'); await remplir('Frais de livraison', '4.250'); await cliquer('Enregistrer la zone'); await contient('4,250 DT');
  zones = (await api('GET', '/api/admin/zones', undefined, admin)).data; assert.equal(zones[0].fraisLivraison, 4.25); valide('Modification des frais depuis le back-office');
  await cliquer('Créer une zone'); await remplir('Nom de la zone', 'Chevauchement interdit'); await remplir('Sommets', '36.76,10.06\n36.76,10.20\n36.80,10.20\n36.80,10.06');
  await cliquer('Enregistrer la zone'); await contient('chevauche'); assert.equal(await evaluer("document.querySelector('[role=dialog]').contains(document.activeElement)"), true); await cliquer('Fermer'); valide('Chevauchement refusé avec message et focus dans la modale');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  assert.ok(await evaluer('document.documentElement.scrollWidth <= window.innerWidth'));
  await cdp('Page.captureScreenshot', { format: 'png' }).then(r => fs.writeFileSync(path.join(temp, 'sprint2-zones-390.png'), Buffer.from(r.data, 'base64')));
  valide('Écran Zones utilisable à 390 px sans débordement de page');
  // Crée un partenaire par l'API publique puis le valide : mêmes règles que l'app partenaire.
  const email = 'commerce-sprint2-' + suffix + '@test.tn', password = 'sprint2-browser-password';
  const dossier = await api('POST', '/api/auth/inscription/partenaire', { nom: 'Test', prenom: 'Partenaire', email, telephone: '+2164' + String(suffix).slice(-7), motDePasse: password,
    nomCommerce: 'Restaurant navigateur', categorie: 'Restaurant', adresse: 'Tunis centre', latitude: 36.8, longitude: 10.18, matriculeFiscal: 'DEMO-BROWSER' });
  assert.equal(dossier.status, 201); assert.equal((await api('PUT', '/api/admin/dossiers/' + dossier.data.id + '/valider', undefined, admin)).status, 200);
  const p = (await api('POST', '/api/auth/login', { email, motDePasse: password })).data.token;
  assert.equal((await api('PUT', '/api/partenaire/commerce', { ouvert: true }, p)).status, 200);
  const produit = await api('POST', '/api/partenaire/produits', { nom: 'Brik test', prix: 6.125, disponible: true }, p); assert.equal(produit.status, 201);
  const clientEmail = 'client-sprint2-' + suffix + '@test.tn';
  assert.equal((await api('POST', '/api/auth/signup', { nom: 'Test', prenom: 'Client', email: clientEmail, motDePasse: password })).status, 201);
  const c = (await api('POST', '/api/auth/login', { email: clientEmail, motDePasse: password })).data.token;
  const adresse = await api('POST', '/api/adresses', { libelle: 'Maison', adresse: 'Rue navigateur', latitude: 36.81, longitude: 10.18 }, c); assert.equal(adresse.status, 201);
  const partenaires = await api('GET', '/api/partenaires?adresseId=' + adresse.data.id, undefined, c); assert.ok(partenaires.data.some(x => x.id === dossier.data.id));
  const panier = { partenaireId: dossier.data.id, adresseId: adresse.data.id, lignes: [{ produitId: produit.data.id, quantite: 2 }], notes: 'Sans sel' };
  const devis = await api('POST', '/api/commandes/devis', panier, c); assert.equal(devis.status, 200); assert.equal(devis.data.total, 16.5);
  const corps = { ...panier, devisEmpreinte: devis.data.empreinte, cleIdempotence: 'browser_sprint2_' + suffix };
  const commande = await api('POST', '/api/commandes', corps, c); assert.equal(commande.status, 201); assert.equal(commande.data.statut, 'PENDING_PARTNER');
  const doublon = await api('POST', '/api/commandes', corps, c); assert.equal(doublon.data.id, commande.data.id);
  const historique = await api('GET', '/api/livraisons/mes', undefined, c); assert.equal(historique.data.length, 1); assert.equal(historique.data[0].lignes[0].prixUnitaire, 6.125);
  valide('Parcours HTTP réel : zone → publication → adresse → partenaires → devis → COD idempotent → historique');
  await cliquer('Commandes'); await contient(commande.data.codeSuivi);
  await evaluer('(' + (code => [...document.querySelectorAll('tbody tr')].find(r => r.textContent.includes(code)).click()).toString() + ')(' + JSON.stringify(commande.data.codeSuivi) + ')');
  await contient('Brik test'); await contient('En attente du partenaire'); await contient('16,500 DT'); await cliquer('Fermer');
  valide('Commande COD, lignes et statut visibles dans le détail web réel');
  await cliquer('Journal d’audit'); await remplir('Action', 'FRAIS_ZONE_MODIFIES'); await cliquer('Filtrer'); await contient('FRAIS ZONE MODIFIES'); valide('Changement de frais consultable dans le journal réel');
  fs.writeFileSync(path.join(temp, 'sprint2-browser-results.json'), JSON.stringify(resultats, null, 2));
};
if (require.main === module) { process.env.SPRINT2_BROWSER = 'true'; require('./verify-sprint1-browser.cjs'); }
