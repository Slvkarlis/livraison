import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import CarteMission from '../composants/CarteMission';
import RelectureSuivi from '../composants/RelectureSuivi';
import { EnTete } from '../composants/ui';
import { MODES_PAIEMENT, STATUTS } from '../format';
import type { Livraison, PartenaireCarte } from '../types';
import { correspond, coursiersDemo, coursiersDepuisApi, distanceKm, etapeDe, FILTRES_DEFAUT, LIBELLES_ETAPE, SCENARIO_DEMO, type CoursierCarte, type EtapeFiltre, type FiltresCarte, type PoiCarte, type PointCarte } from '../suivi';
import { useItineraires } from '../composants/useItineraires';
import { Icone } from '../composants/icones';
import { calculerItineraire, progression, type ItineraireRoutier } from '../../../mobile/packages/shared/src/itineraireRoutier';

export default function SuiviLive() {
  const [coursiers, setCoursiers] = useState<CoursierCarte[]>([]), [selection, setSelection] = useState<number>();
  const [chargement, setChargement] = useState(true), [erreur, setErreur] = useState(''), [demo, setDemo] = useState(false);
  const [actualise, setActualise] = useState(''), [incomplet, setIncomplet] = useState(0);
  const [relecture, setRelecture] = useState(false);
  // Carte complete : commerces, commandes en cours (clients) et filtres d'affichage
  const [commandes, setCommandes] = useState<Livraison[]>([]), [partenaires, setPartenaires] = useState<PartenaireCarte[]>([]);
  const [filtres, setFiltres] = useState<FiltresCarte>(FILTRES_DEFAUT);
  const [cadrage, setCadrage] = useState<{ cle: string; points: PointCarte[] }>();
  const generation = useRef(0), routesDemo = useRef<(ItineraireRoutier | undefined)[]>([]);
  const itineraires = useItineraires(coursiers);
  const debut = useRef(Date.now()), verrou = useRef<number | null>(null), monte = useRef(false);
  const charger = useCallback(async () => {
    const version = generation.current;
    if (verrou.current === version) return; verrou.current = version;
    try {
      const [supervision, commandes] = await Promise.all([api.supervision(), api.livraisons()]);
      if (!monte.current || version !== generation.current) return;
      const liste = coursiersDepuisApi(supervision, commandes);
      setCoursiers(liste); setCommandes(commandes); setIncomplet(supervision.livreurs.length - liste.length); setErreur(''); setActualise(new Date().toLocaleTimeString('fr-FR'));
    } catch (e) { if (monte.current && version === generation.current) setErreur(e instanceof Error ? e.message : 'Les positions sont indisponibles. Réessayez.'); }
    finally { if (verrou.current === version) verrou.current = null; if (monte.current && version === generation.current) setChargement(false); }
  }, []);
  useEffect(() => {
    monte.current = true;
    if (!demo) { void charger(); api.partenairesCarte().then(p => { if (monte.current) setPartenaires(p); }).catch(() => {}); }
    const actualiser = () => { if (document.hidden) return; if (demo) setCoursiers(coursiersDemo((Date.now() - debut.current) / 1000, routesDemo.current)); else void charger(); };
    if (demo) {
      actualiser();
      // La demonstration roule sur les vraies rues : trajet complet depart -> commerce -> client.
      void Promise.all(SCENARIO_DEMO.map(d => calculerItineraire(d.depart, [d.collecte, d.client]))).then(r => { if (monte.current) { routesDemo.current = r; actualiser(); } });
    }
    const delai = window.setInterval(actualiser, demo ? 2000 : 3000);
    return () => { monte.current = false; generation.current++; clearInterval(delai); };
  }, [charger, demo]);
  useEffect(() => { if (!coursiers.some(c => c.id === selection)) setSelection(coursiers[0]?.id); }, [coursiers, selection]);
  const choisi = coursiers.find(c => c.id === selection), commande = choisi?.commande;
  const suiviRoute = choisi ? itineraires.get(choisi.id) : undefined;
  const avancee = choisi && suiviRoute ? progression(suiviRoute.itineraire, choisi.position) : null;
  const routier = suiviRoute?.itineraire.source === 'osrm';
  const distance = avancee ? avancee.resteKm : choisi && commande ? distanceKm(choisi.position, commande.destination) : null;
  const eta = avancee ? avancee.resteMin : distance === null ? null : Math.max(1, Math.ceil(distance / 20 * 60));
  const etaDe = (c: CoursierCarte) => { const r = itineraires.get(c.id); return r ? progression(r.itineraire, c.position).resteMin : c.commande ? Math.max(1, Math.ceil(distanceKm(c.position, c.commande.destination) / 20 * 60)) : null; };
  // ---- Filtres et points d'interet ----
  const mf = (f: Partial<FiltresCarte>) => setFiltres(v => ({ ...v, ...f }));
  const etapeOk = (statut: Livraison['statut'] | undefined) => filtres.etape === 'toutes' || (!!statut && etapeDe(statut) === filtres.etape);
  const coursiersVisibles = useMemo(() => !filtres.livreurs ? [] : coursiers.filter(c => etapeOk(c.commande?.statut)
    && correspond([c.nom, c.commande?.code, c.commande?.zone, c.commande?.nomCommerce], filtres.recherche)),
  [coursiers, filtres]);
  const commandeComplete = (id?: number) => commandes.find(c => c.id === id);
  const poi = useMemo<PoiCarte[]>(() => {
    const lieA = choisi?.commande, points: PoiCarte[] = [];
    const proche = (a?: PointCarte, b?: PointCarte) => !!a && !!b && distanceKm(a, b) < .03;
    if (filtres.commerces) {
      const commerces: PartenaireCarte[] = demo ? SCENARIO_DEMO.map((d, i) => ({ id: -(i + 1), nomCommerce: d.commerce, categorie: 'Restaurant', adresse: d.zone, latitude: d.collecte[1], longitude: d.collecte[0], ouvert: true, zoneNom: d.zone })) : partenaires;
      for (const p of commerces) {
        const enCours = demo ? coursiers.filter(c => c.commande?.nomCommerce === p.nomCommerce).length
          : commandes.filter(c => c.partenaireId === p.id && etapeDe(c.statut)).length;
        if (!correspond([p.nomCommerce, p.categorie, p.adresse, p.zoneNom], filtres.recherche)) continue;
        points.push({ id: `p${p.id}`, type: 'commerce', position: [p.longitude, p.latitude], titre: p.nomCommerce, actif: p.ouvert,
          lie: proche(lieA?.commerce, [p.longitude, p.latitude]),
          lignes: [[p.categorie, p.zoneNom].filter(Boolean).join(' · '), p.adresse ?? '', p.ouvert ? 'Ouvert' : 'Fermé', `${enCours} commande(s) en cours`].filter(Boolean) });
      }
    }
    if (filtres.clients) {
      const enCours = demo ? coursiers.map(c => ({ id: c.commande!.id, codeSuivi: c.commande!.code, adresse: `Client · ${c.commande!.zone}`, statut: c.commande!.statut,
        latitude: c.commande!.destination[1], longitude: c.commande!.destination[0], nomPartenaire: c.commande!.nomCommerce ?? null, livreurPrenom: c.nom.split(' ')[0], montantACollecter: 0, modePaiement: 'COD' }))
        : commandes.filter(c => etapeDe(c.statut));
      for (const c of enCours) {
        if (!etapeOk(c.statut) || !correspond([c.adresse, c.codeSuivi, c.nomPartenaire, c.livreurPrenom], filtres.recherche)) continue;
        const livreur = coursiers.find(l => l.commande?.id === c.id);
        points.push({ id: `c${c.id}`, type: 'client', position: [c.longitude, c.latitude], titre: c.adresse, livreurId: livreur?.id,
          lie: lieA?.id === c.id,
          lignes: [`${c.codeSuivi} · ${STATUTS[c.statut].libelle}`, c.nomPartenaire ? `Commerce : ${c.nomPartenaire}` : '', c.livreurPrenom ? `Livreur : ${c.livreurPrenom}` : 'En attente d’un livreur',
            c.montantACollecter ? `À encaisser : ${c.montantACollecter.toLocaleString('fr-FR', { minimumFractionDigits: 3 })} DT` : ''].filter(Boolean) });
      }
    }
    return points;
  }, [filtres, partenaires, commandes, coursiers, demo, choisi?.commande]);
  const totalClients = demo ? coursiers.length : commandes.filter(c => etapeDe(c.statut)).length;
  const detail = commandeComplete(commande?.id);
  function voirTrajet() {
    if (!choisi) return;
    setCadrage({ cle: `${choisi.id}-${Date.now()}`, points: [choisi.position, ...(commande?.commerce ? [commande.commerce] : []), ...(commande ? [commande.destination] : [])] });
  }
  function voirTout() {
    const points: PointCarte[] = [...coursiersVisibles.map(c => c.position), ...poi.map(p => p.position)];
    if (points.length) setCadrage({ cle: `tout-${Date.now()}`, points });
  }

  function changerDemo() { setCoursiers([]); setSelection(undefined); setChargement(!demo ? false : true); debut.current = Date.now(); setDemo(!demo); }
  return <>
    <EnTete titre="Suivi en direct" sousTitre="Une vue sur la ville. Chaque livraison à sa place.">
      <button type="button" className="bouton secondaire" aria-pressed={demo} onClick={changerDemo}>{demo ? 'Revenir au direct' : 'Voir la démonstration'}</button>
      <button type="button" className="bouton secondaire" aria-pressed={relecture} onClick={() => setRelecture(!relecture)}>{relecture ? 'Fermer la relecture' : 'Revoir la journée'}</button>
      <Link className="bouton" to="/dispatch">Ouvrir le dispatch →</Link>
    </EnTete>
    <div className="mission-signal" role="status"><span className="mission-voyant" /><strong>{demo ? 'Démonstration · données fictives' : erreur ? 'Connexion interrompue' : chargement ? 'Connexion en cours' : 'Supervision connectée'}</strong><span>{demo ? 'Scénario local · Tunis' : actualise ? `Dernière lecture à ${actualise}` : 'Lecture des positions GPS'}</span></div>
    {!demo && erreur && <div className="bandeau" role="alert">{erreur} {coursiers.length > 0 && 'Les dernières positions sont conservées.'} <button className="bouton-lien" onClick={() => void charger()}>Réessayer</button></div>}
    {!relecture && <div className="mission-filtres" role="group" aria-label="Filtres de la carte">
      <button type="button" aria-pressed={filtres.livreurs} onClick={() => mf({ livreurs: !filtres.livreurs })}><Icone nom="livreur" /> Livreurs <span className="mono">{coursiers.length}</span></button>
      <button type="button" aria-pressed={filtres.commerces} onClick={() => mf({ commerces: !filtres.commerces })}><Icone nom="commerce" /> Commerces <span className="mono">{demo ? SCENARIO_DEMO.length : partenaires.length}</span></button>
      <button type="button" aria-pressed={filtres.clients} onClick={() => mf({ clients: !filtres.clients })}><Icone nom="client" /> Clients <span className="mono">{totalClients}</span></button>
      <select aria-label="Étape de livraison" value={filtres.etape} onChange={e => mf({ etape: e.target.value as EtapeFiltre })}>
        {(Object.keys(LIBELLES_ETAPE) as EtapeFiltre[]).map(e => <option key={e} value={e}>{LIBELLES_ETAPE[e]}</option>)}
      </select>
      <input type="search" placeholder="Rechercher un livreur, commerce, code, adresse…" aria-label="Rechercher sur la carte" value={filtres.recherche} onChange={e => mf({ recherche: e.target.value })} />
      <button type="button" aria-pressed="false" onClick={voirTout}>Tout afficher</button>
      {(filtres.etape !== 'toutes' || filtres.recherche || !filtres.livreurs || !filtres.commerces || !filtres.clients) && <button type="button" aria-pressed="false" onClick={() => setFiltres(FILTRES_DEFAUT)}>Réinitialiser</button>}
    </div>}
    {relecture ? <RelectureSuivi /> : <section className="mission" aria-label="Supervision des livraisons">
      <CarteMission coursiers={coursiersVisibles} selection={selection} onSelection={setSelection} itineraires={itineraires} poi={poi} cadrage={cadrage} />
      <aside className="mission-flotte" aria-label="Liste des coursiers, alternative à la carte">
        <div className="mission-flotte-titre"><h2>Sur le terrain</h2><span className="mono">{String(coursiersVisibles.length).padStart(2, '0')}</span></div>
        {!demo && chargement && <p className="mission-etat" role="status">Chargement des coursiers…</p>}
        {!chargement && !coursiers.length && <div className="mission-etat"><strong>{erreur ? 'Positions indisponibles' : 'La flotte est au repos'}</strong><p>{erreur ? 'Réessayez ou explorez le scénario de démonstration.' : 'Les coursiers disponibles apparaîtront dès leur premier envoi GPS.'}</p><button className="bouton secondaire" onClick={changerDemo}>Explorer la démonstration</button></div>}
        {!!coursiers.length && !coursiersVisibles.length && <p className="mission-etat">Aucun livreur ne correspond aux filtres.</p>}
        <ul>{coursiersVisibles.map(c => { const minutes = etaDe(c);
          const ancien = !c.date || Date.now() - Date.parse(c.date) > 60000;
          return <li key={c.id}><button type="button" className="mission-coursier" aria-pressed={c.id === selection} onClick={() => setSelection(c.id)}>
            <span className="mission-initiales" aria-hidden="true">{c.nom.split(' ').map(n => n[0]).slice(0, 2).join('')}</span>
            <span><strong>{c.nom}</strong><small>{ancien ? 'Position ancienne' : c.commande ? STATUTS[c.commande.statut].libelle : 'Disponible · mission non identifiée'}</small><span className="mono">{c.commande?.code ?? 'Sans commande associée'}</span></span>
            <span className="mission-eta">{minutes === null ? '—' : `≈ ${minutes}`}<small>{minutes === null ? 'ETA inconnue' : 'min'}</small></span>
          </button></li>;
        })}</ul>
        <p className="mission-note">{demo ? 'Positions simulées, sans modification des commandes.' : 'Lecture toutes les 3 s. Seuls les coursiers disponibles avec un GPS connu sont exposés.'}{incomplet > 0 && !demo ? ` ${incomplet} coursier(s) sans position.` : ''}</p>
      </aside>
      {choisi && <aside className="mission-commande" aria-label="Livraison sélectionnée">
        <div className="mission-commande-titre"><span className="mission-surtitre">{commande ? 'Livraison sélectionnée' : 'Coursier sélectionné'}</span><span className="mono">{commande?.code ?? `N° ${choisi.id}`}</span></div>
        <h2>{commande?.zone ?? choisi.nom}</h2>
        <p className="mission-note">{commande ? `${choisi.nom} · ${STATUTS[commande.statut].libelle}` : 'Aucune commande associée avec certitude.'}</p>
        {commande && <><div className="mission-mesures"><div><strong>≈ {eta}<small> min</small></strong><span>Arrivée estimée</span></div><div><strong>{distance?.toLocaleString('fr-FR', { maximumFractionDigits: 1 })}<small> km</small></strong><span>{routier ? (commande.statut === 'AFFECTEE' ? 'Par la route, via le commerce' : 'Par la route') : 'À vol d’oiseau'}</span></div></div>
          <ol className="mission-etapes" aria-label="Étapes de livraison"><li data-actif="true">Affectée</li><li data-actif={commande.statut !== 'AFFECTEE'}>Collectée</li><li data-actif={['A_PROXIMITE', 'ARRIVEE'].includes(commande.statut)}>À proximité</li><li>Livrée</li></ol>
          <ol className="mission-trajet" aria-label="Trajet du livreur">
            <li><span className="icone livreur"><Icone nom="livreur" /></span><span><strong>{choisi.nom}</strong><small>Position actuelle · {choisi.date ? new Date(choisi.date).toLocaleTimeString('fr-FR') : 'heure inconnue'}</small></span></li>
            <li><span className="icone"><Icone nom="commerce" /></span><span><strong>{commande.nomCommerce ?? detail?.nomPartenaire ?? 'Commerce'}</strong><small>{commande.statut === 'AFFECTEE' ? 'Départ : colis à récupérer' : `Départ : colis récupéré${detail?.recupereeLe ? ` à ${new Date(detail.recupereeLe).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : ''}`}</small></span></li>
            <li><span className="icone client"><Icone nom="client" /></span><span><strong>{detail?.adresse ?? `Client · ${commande.zone}`}</strong><small>Arrivée{eta ? ` dans ≈ ${eta} min` : ''}{detail?.clientEmail ? ` · ${detail.clientEmail}` : ''}</small></span></li>
          </ol>
          {detail && <dl className="mission-infos">
            <div><dt>Paiement</dt><dd>{MODES_PAIEMENT[detail.modePaiement]}</dd></div>
            <div><dt>À encaisser</dt><dd>{detail.montantACollecter.toLocaleString('fr-FR', { minimumFractionDigits: 3 })} DT</dd></div>
            <div><dt>Commandée à</dt><dd>{new Date(detail.dateCreation).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</dd></div>
            <div><dt>Articles</dt><dd>{detail.lignes?.reduce((n, l) => n + l.quantite, 0) ?? '—'}</dd></div>
          </dl>}
          <button type="button" className="bouton secondaire" onClick={voirTrajet}>Voir le trajet complet sur la carte</button>
          <p className="mission-note">{commande.statut === 'AFFECTEE' ? `Étape 1/2 : collecte${commande.nomCommerce ? ` chez ${commande.nomCommerce}` : ''}, puis livraison au client.` : 'Étape 2/2 : colis à bord, en route vers le client.'}</p>
          {avancee?.horsItineraire && <p className="mission-note mission-route-alerte" role="status">Hors itinéraire ({Math.round(avancee.ecartM)} m) · nouveau trajet en cours de calcul</p>}
          {avancee?.prochaine && !avancee.horsItineraire && <p className="mission-consigne">Prochaine consigne : {avancee.prochaine.instruction}</p>}
          <p className="mission-note">{routier ? `Itinéraire routier OpenStreetMap, recalculé si le coursier s’écarte du tracé${suiviRoute && suiviRoute.recalculs ? ` · ${suiviRoute.recalculs} recalcul(s)` : ''}. ETA hors circulation.` : suiviRoute ? 'Service d’itinéraire injoignable : direction indicative à 20 km/h.' : 'Calcul de l’itinéraire routier…'}</p>
          {!demo && <Link to={`/commandes?id=${commande.id}`}>Détail de la commande →</Link>}</>}
        <p className="mission-note">GPS : {choisi.position[1].toFixed(5)}, {choisi.position[0].toFixed(5)} · {choisi.date ? new Date(choisi.date).toLocaleTimeString('fr-FR') : 'date inconnue'}</p>
      </aside>}
    </section>}
    <p className="mission-bas">Tunis · {demo ? 'Scénario de présentation' : 'Positions connues du responsable'}<span>Les estimations restent indicatives.</span></p>
  </>;
}
