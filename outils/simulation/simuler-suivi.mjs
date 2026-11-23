#!/usr/bin/env node
// Simulateur FleetPulse (mode demo uniquement) : cree des commandes fictives a tous les stades,
// puis fait rouler une voiture de livraison en temps reel jusqu'au client.
//
// Le coursier envoie de vraies positions GPS au backend (PUT /api/livreur/position), exactement comme
// le telephone : le client les recoit en direct sur l'ecran de suivi de sa commande (carte + ETA).
//
//   node outils/simulation/simuler-suivi.mjs                   # 6 commandes fictives + 1 livraison suivie
//   node outils/simulation/simuler-suivi.mjs --commandes 0     # uniquement la voiture suivie
//   node outils/simulation/simuler-suivi.mjs --vitesse 45 --intervalle 1.5 --sans-remise
//
// Options : --api URL (http://localhost:8083) · --commandes N (6) · --vitesse km/h (35)
//           --intervalle s (2) · --sans-remise (la voiture s'arrete devant le client) · --boucle
// Aucun service payant : itineraire OSRM public si joignable, sinon trace urbain genere localement.

const args = process.argv.slice(2);
const opt = (nom, defaut) => { const i = args.indexOf('--' + nom); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : defaut; };
const drapeau = (nom) => args.includes('--' + nom);
const API = opt('api', process.env.FLEETPULSE_API ?? 'http://localhost:8083').replace(/\/$/, '');
const NB_FICTIVES = Number(opt('commandes', 6));
const VITESSE_KMH = Math.min(Number(opt('vitesse', 35)), 120); // le serveur ecarte tout deplacement > 150 km/h
const INTERVALLE_S = Math.max(Number(opt('intervalle', 2)), 1);
const SANS_REMISE = drapeau('sans-remise');
const BOUCLE = drapeau('boucle');

// Comptes crees par les donnees de demonstration du backend (profil demo).
const ADMIN = ['admin@fleetpulse.tn', 'admin12345'];
const CLIENT = ['client@sprint6.demo', 'demo-sprint6-password'];
const PARTENAIRES = {
  'Chez Amira': ['restaurant@sprint2.demo', 'sprint2-demo-password'],
  'Épicerie du centre': ['epicerie@sprint2.demo', 'sprint2-demo-password'],
  'La Table de Tunis': ['partenaire1@sprint6.demo', 'demo-sprint6-password'],
};
const COURSIERS = [1, 2, 3].map((n) => [`coursier${n}@sprint6.demo`, 'demo-sprint6-password']);

// Adresses fictives dans le centre de Tunis (zones de livraison de demonstration).
const ADRESSES = [
  { libelle: 'Bureau', adresse: 'Avenue Habib Bourguiba 52, Tunis', latitude: 36.8008, longitude: 10.1815 },
  { libelle: 'Maison', adresse: 'Rue de Marseille 14, Tunis', latitude: 36.8, longitude: 10.16 },
  { libelle: 'Salle de sport', adresse: 'Rue de Rome 9, Tunis', latitude: 36.8032, longitude: 10.1772 },
  { libelle: 'Parents', adresse: 'Avenue de Paris 30, Tunis', latitude: 36.8065, longitude: 10.1795 },
];
const NOTES = ['', 'Sonner deux fois', 'Sans oignons svp', 'Laisser au gardien', '3e étage, porte gauche', ''];

// ---------------------------------------------------------------- outils
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const hasard = (t) => t[Math.floor(Math.random() * t.length)];
const heure = () => new Date().toLocaleTimeString('fr-FR');
const log = (...m) => console.log(`[${heure()}]`, ...m);
const dt = (n) => Number(n).toFixed(3).replace('.', ',') + ' DT';

async function appel(jeton, methode, chemin, corps) {
  const r = await fetch(API + chemin, {
    method: methode,
    headers: { 'Content-Type': 'application/json', ...(jeton ? { Authorization: 'Bearer ' + jeton } : {}) },
    body: corps === undefined ? undefined : JSON.stringify(corps),
  });
  const texte = await r.text();
  let donnees = null; try { donnees = texte ? JSON.parse(texte) : null; } catch { donnees = texte; }
  if (!r.ok) throw new Error(`${methode} ${chemin} -> ${r.status} ${donnees?.message ?? donnees?.erreur ?? texte.slice(0, 200)}`);
  return donnees;
}
const connexion = async ([email, mdp]) => (await appel(null, 'POST', '/api/auth/login', { email, motDePasse: mdp })).token;
const essayer = async (f) => { try { return await f(); } catch (e) { return e; } };

function distanceKm(a, b) {
  const R = 6371, r = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * r, dLng = (b.longitude - a.longitude) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * r) * Math.cos(b.latitude * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Itineraire routier : OSRM public (gratuit) si joignable, sinon trace en rues a angles droits. */
async function itineraire(a, b) {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${a.longitude},${a.latitude};${b.longitude},${b.latitude}?overview=full&geometries=geojson`;
    const r = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'fleetpulse-simulateur' } });
    const d = await r.json();
    const pts = d.routes?.[0]?.geometry?.coordinates?.map(([lng, lat]) => ({ latitude: lat, longitude: lng }));
    if (pts?.length > 1) return { points: pts, source: 'OSRM' };
  } catch { /* hors ligne : trace local */ }
  // Trace local : quelques blocs d'immeubles, en alternant nord-sud et est-ouest.
  const pts = [a];
  const blocs = 3 + Math.floor(Math.random() * 2);
  for (let i = 1; i < blocs; i++) {
    const t = i / blocs, prec = pts[pts.length - 1];
    const lat = a.latitude + (b.latitude - a.latitude) * t + (Math.random() - 0.5) * 0.0012;
    const lng = a.longitude + (b.longitude - a.longitude) * t + (Math.random() - 0.5) * 0.0012;
    pts.push(i % 2 ? { latitude: prec.latitude, longitude: lng } : { latitude: lat, longitude: prec.longitude });
    pts.push({ latitude: lat, longitude: lng });
  }
  pts.push({ latitude: b.latitude, longitude: pts[pts.length - 1].longitude }, b);
  return { points: pts, source: 'trace local (OSRM injoignable)' };
}

/** Echantillonne le trace tous les `pasKm` (une position par intervalle d'envoi). */
function echantillonner(points, pasKm) {
  const sortie = [points[0]];
  let reste = pasKm;
  for (let i = 1; i < points.length; i++) {
    let a = points[i - 1]; const b = points[i];
    let seg = distanceKm(a, b);
    while (seg >= reste) {
      const t = reste / seg;
      a = { latitude: a.latitude + (b.latitude - a.latitude) * t, longitude: a.longitude + (b.longitude - a.longitude) * t };
      sortie.push(a); seg -= reste; reste = pasKm;
    }
    reste -= seg;
  }
  sortie.push(points[points.length - 1]);
  return sortie;
}

// ---------------------------------------------------------------- donnees
async function preparerAdresses(client) {
  const existantes = await appel(client, 'GET', '/api/adresses');
  for (const a of ADRESSES) {
    if (!existantes.some((e) => e.adresse === a.adresse)) existantes.push(await appel(client, 'POST', '/api/adresses', a));
  }
  return existantes;
}

/** Passe une commande au hasard (commerce ouvert et livrable, 1 a 3 articles). */
async function passerCommande(client, adresses, commerceVoulu) {
  for (const adresse of [...adresses].sort(() => Math.random() - 0.5)) {
    const commerces = (await appel(client, 'GET', '/api/partenaires?' + new URLSearchParams({ adresseId: adresse.id, recherche: '', categorie: '' })))
      .filter((c) => c.ouvert && PARTENAIRES[c.nomCommerce] && (!commerceVoulu || c.nomCommerce === commerceVoulu));
    if (!commerces.length) continue;
    const commerce = hasard(commerces);
    const produits = (await appel(client, 'GET', `/api/partenaires/${commerce.id}/produits?adresseId=${adresse.id}`)).filter((p) => p.disponible);
    if (!produits.length) continue;
    const choix = [...produits].sort(() => Math.random() - 0.5).slice(0, 1 + Math.floor(Math.random() * Math.min(3, produits.length)));
    const corps = { partenaireId: commerce.id, adresseId: adresse.id, notes: hasard(NOTES),
      lignes: choix.map((p) => ({ produitId: p.id, quantite: 1 + Math.floor(Math.random() * 3) })) };
    const devis = await appel(client, 'POST', '/api/commandes/devis', corps);
    const commande = await appel(client, 'POST', '/api/commandes', { ...corps, cleIdempotence: crypto.randomUUID(), devisEmpreinte: devis.empreinte });
    return { id: commande.id, commerce: commerce.nomCommerce, adresse, total: devis.total };
  }
  throw new Error('Aucun commerce ouvert ne livre les adresses de démonstration.');
}

async function avancerChezPartenaire(c, jetonsPartenaires, jusqua) {
  const p = jetonsPartenaires[c.commerce];
  const base = `/api/partenaire/commandes/${c.id}`;
  if (jusqua === 'REFUSEE') {
    return appel(p, 'PUT', base + '/refuser', { motif: 'RUPTURE', commentaire: 'Article épuisé (simulation)' });
  }
  await appel(p, 'PUT', base + '/accepter', { tempsPreparationMinutes: hasard([10, 15, 20]) });
  if (jusqua === 'ACCEPTEE') return;
  await appel(p, 'PUT', base + '/preparation/debut');
  if (jusqua === 'EN_PREPARATION') return;
  await appel(p, 'PUT', base + '/prete');
}

async function affecter(admin, jetonCoursier, livreurId, commandeId, position) {
  await essayer(() => appel(jetonCoursier, 'PUT', '/api/livreur/disponibilite', { disponible: true, ...position }));
  await appel(admin, 'PUT', `/api/admin/dispatch/commandes/${commandeId}/forcer`, { livreurId, motif: 'Simulation de démonstration' });
}

async function collecter(jetonPartenaire, jetonCoursier, commandeId) {
  const etiquette = await appel(jetonPartenaire, 'GET', `/api/partenaire/commandes/${commandeId}/etiquette`);
  await appel(jetonCoursier, 'POST', `/api/livreur/missions/${commandeId}/collecte`, { code: etiquette.codeCollecte });
  return etiquette;
}

async function remettre(client, jetonCoursier, commandeId) {
  const qr = await appel(client, 'GET', `/api/commandes/${commandeId}/qr-remise`);
  const mission = await appel(jetonCoursier, 'GET', `/api/livreur/missions/${commandeId}`);
  return appel(jetonCoursier, 'POST', `/api/livreur/missions/${commandeId}/remise`,
    { montantEncaisse: mission.montantACollecter, motifEcart: null, preuve: qr.contenuQr });
}

// ---------------------------------------------------------------- scenario
async function main() {
  log(`Simulateur FleetPulse -> ${API}`);
  const admin = await connexion(ADMIN);
  const client = await connexion(CLIENT);
  const jetonsPartenaires = {};
  for (const [nom, compte] of Object.entries(PARTENAIRES)) jetonsPartenaires[nom] = await connexion(compte);
  const coursiers = await Promise.all(COURSIERS.map(connexion));
  const livreurs = await appel(admin, 'GET', '/api/admin/livreurs');
  const idDe = (i) => livreurs.find((l) => l.email === COURSIERS[i][0])?.id;
  const adresses = await preparerAdresses(client);
  log(`Connecté : admin, client, ${Object.keys(jetonsPartenaires).length} commerces, ${coursiers.length} coursiers · ${adresses.length} adresses client`);

  // 1. Commandes fictives a des stades varies (visibles cote client, partenaire, back-office).
  const stades = ['LIVREE', 'PENDING_PARTNER', 'EN_PREPARATION', 'PRETE', 'LIVREE', 'ACCEPTEE', 'REFUSEE', 'LIVREE'];
  for (let i = 0; i < NB_FICTIVES; i++) {
    const stade = stades[i % stades.length];
    try {
      const c = await passerCommande(client, adresses);
      if (stade !== 'PENDING_PARTNER') await avancerChezPartenaire(c, jetonsPartenaires, stade === 'LIVREE' ? 'PRETE' : stade);
      if (stade === 'LIVREE') {
        const k = 1 + (i % 2); // coursiers 2 et 3 ; le coursier 1 conduit la voiture suivie
        await affecter(admin, coursiers[k], idDe(k), c.id, { latitude: 36.8, longitude: 10.17 });
        await collecter(jetonsPartenaires[c.commerce], coursiers[k], c.id);
        await remettre(client, coursiers[k], c.id);
      }
      log(`  #${c.id} ${c.commerce.padEnd(20)} -> ${c.adresse.libelle.padEnd(14)} ${dt(c.total).padStart(12)}  ${stade}`);
    } catch (e) { log(`  commande fictive ${i + 1} (${stade}) ignorée : ${e.message}`); }
  }

  // 2. Livraison suivie en temps reel par le coursier 1.
  do { await livraisonSuivie({ admin, client, jetonsPartenaires, coursier: coursiers[0], livreurId: idDe(0), adresses }); }
  while (BOUCLE);
}

/** Derniere position connue du coursier (supervision dispatch), pour repartir d'ou la voiture se trouve. */
async function positionActuelle(admin, livreurId) {
  const l = (await essayer(() => appel(admin, 'GET', '/api/admin/dispatch')))?.livreurs?.find?.((x) => x.id === livreurId);
  return l?.latitude != null ? { latitude: l.latitude, longitude: l.longitude } : null;
}

/** Fait rouler la voiture le long d'un itineraire, une position GPS par intervalle. */
async function conduire(coursier, depart, arrivee, vitesseKmh, titre) {
  const { points, source } = await itineraire(depart, arrivee);
  const trajet = echantillonner(points, vitesseKmh * INTERVALLE_S / 3600);
  const longueur = points.slice(1).reduce((s, p, i) => s + distanceKm(points[i], p), 0);
  log(`${titre} · ${longueur.toFixed(2)} km · ${trajet.length} positions toutes les ${INTERVALLE_S}s à ${vitesseKmh} km/h · itinéraire ${source}`);
  let ecartees = 0;
  for (let i = 0; i < trajet.length; i++) {
    const p = trajet[i];
    // Petit bruit GPS (quelques metres) et precision variable, comme un vrai telephone.
    const bruit = () => (Math.random() - 0.5) * 0.00004;
    const r = await essayer(() => appel(coursier, 'PUT', '/api/livreur/position',
      { latitude: p.latitude + bruit(), longitude: p.longitude + bruit(), precision: Math.round(4 + Math.random() * 12) }));
    if (r instanceof Error || !r.acceptee) ecartees++;
    const pct = Math.round((i + 1) / trajet.length * 100);
    const barre = '█'.repeat(Math.round(pct / 5)).padEnd(20, '·');
    process.stdout.write(`\r  ${barre} ${String(pct).padStart(3)}%  ${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}  reste ${(distanceKm(p, arrivee) * 1000).toFixed(0).padStart(5)} m  ` +
      (r instanceof Error ? 'erreur ' + r.message.slice(0, 50) : r.acceptee ? 'ok'.padEnd(36) : ('écartée : ' + r.raison).padEnd(36)));
    if (i < trajet.length - 1) await attendre(INTERVALLE_S * 1000);
  }
  process.stdout.write('\n');
  if (ecartees) log(`  ${ecartees} position(s) écartée(s) par le serveur`);
}

async function livraisonSuivie({ admin, client, jetonsPartenaires, coursier, livreurId, adresses }) {
  const c = await passerCommande(client, adresses);
  await avancerChezPartenaire(c, jetonsPartenaires, 'PRETE');
  const ici = (await positionActuelle(admin, livreurId)) ?? { latitude: 36.8, longitude: 10.16 };
  await affecter(admin, coursier, livreurId, c.id, ici);
  const mission = await appel(coursier, 'GET', `/api/livreur/missions/${c.id}`);
  const commerce = { latitude: mission.latitudeCommerce ?? 36.8, longitude: mission.longitudeCommerce ?? 10.17 };
  const client_ = { latitude: c.adresse.latitude, longitude: c.adresse.longitude };
  log('');
  log(`NOUVELLE MISSION · commande #${c.id} · ${c.commerce} -> ${c.adresse.adresse}`);

  // 1. Vers le commerce (visible dans le back-office, Dispatch > derniere position).
  if (distanceKm(ici, commerce) > 0.05) await conduire(coursier, ici, commerce, Math.max(VITESSE_KMH, 50), '  Vers le commerce');
  const etiquette = await collecter(jetonsPartenaires[c.commerce], coursier, c.id);
  log(`  Colis récupéré (${etiquette.codeSuivi})`);
  log(`  >>> Suivre en direct : app client (${CLIENT[0]}) -> Commandes -> ${etiquette.codeSuivi}`);

  // 2. Vers le client : chaque position part en temps reel vers l'ecran de suivi du client.
  await conduire(coursier, commerce, client_, VITESSE_KMH, '  Vers le client');
  log('  Arrivée devant le client.');
  if (SANS_REMISE) { log('  Option --sans-remise : la commande reste en livraison.'); return; }
  await attendre(4000);
  const fin = await remettre(client, coursier, c.id);
  log(`  Colis remis · commande #${c.id} ${fin.statut ?? 'LIVREE'} · ${dt(fin.montantACollecter ?? c.total)} encaissés`);
}

main().catch((e) => { console.error('\nÉchec du simulateur :', e.message); process.exit(1); });
