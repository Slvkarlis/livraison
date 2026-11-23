import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import CarteMission from '../composants/CarteMission';
import RelectureSuivi from '../composants/RelectureSuivi';
import { EnTete } from '../composants/ui';
import { STATUTS } from '../format';
import { coursiersDemo, coursiersDepuisApi, distanceKm, type CoursierCarte } from '../suivi';

export default function SuiviLive() {
  const [coursiers, setCoursiers] = useState<CoursierCarte[]>([]), [selection, setSelection] = useState<number>();
  const [chargement, setChargement] = useState(true), [erreur, setErreur] = useState(''), [demo, setDemo] = useState(false);
  const [actualise, setActualise] = useState(''), [incomplet, setIncomplet] = useState(0);
  const [relecture, setRelecture] = useState(false);
  const generation = useRef(0);
  const debut = useRef(Date.now()), verrou = useRef<number | null>(null), monte = useRef(false);
  const charger = useCallback(async () => {
    const version = generation.current;
    if (verrou.current === version) return; verrou.current = version;
    try {
      const [supervision, commandes] = await Promise.all([api.supervision(), api.livraisons()]);
      if (!monte.current || version !== generation.current) return;
      const liste = coursiersDepuisApi(supervision, commandes);
      setCoursiers(liste); setIncomplet(supervision.livreurs.length - liste.length); setErreur(''); setActualise(new Date().toLocaleTimeString('fr-FR'));
    } catch (e) { if (monte.current && version === generation.current) setErreur(e instanceof Error ? e.message : 'Les positions sont indisponibles. Réessayez.'); }
    finally { if (verrou.current === version) verrou.current = null; if (monte.current && version === generation.current) setChargement(false); }
  }, []);
  useEffect(() => {
    monte.current = true;
    if (!demo) void charger();
    const actualiser = () => { if (document.hidden) return; if (demo) setCoursiers(coursiersDemo((Date.now() - debut.current) / 1000)); else void charger(); };
    if (demo) actualiser();
    const delai = window.setInterval(actualiser, demo ? 2000 : 3000);
    return () => { monte.current = false; generation.current++; clearInterval(delai); };
  }, [charger, demo]);
  useEffect(() => { if (!coursiers.some(c => c.id === selection)) setSelection(coursiers[0]?.id); }, [coursiers, selection]);
  const choisi = coursiers.find(c => c.id === selection), commande = choisi?.commande;
  const distance = choisi && commande ? distanceKm(choisi.position, commande.destination) : null;
  const eta = distance === null ? null : Math.max(1, Math.ceil(distance / 20 * 60));
  function changerDemo() { setCoursiers([]); setSelection(undefined); setChargement(!demo ? false : true); debut.current = Date.now(); setDemo(!demo); }
  return <>
    <EnTete titre="Suivi en direct" sousTitre="Une vue sur la ville. Chaque livraison à sa place.">
      <button type="button" className="bouton secondaire" aria-pressed={demo} onClick={changerDemo}>{demo ? 'Revenir au direct' : 'Voir la démonstration'}</button>
      <button type="button" className="bouton secondaire" aria-pressed={relecture} onClick={() => setRelecture(!relecture)}>{relecture ? 'Fermer la relecture' : 'Revoir la journée'}</button>
      <Link className="bouton" to="/dispatch">Ouvrir le dispatch →</Link>
    </EnTete>
    <div className="mission-signal" role="status"><span className="mission-voyant" /><strong>{demo ? 'Démonstration · données fictives' : erreur ? 'Connexion interrompue' : chargement ? 'Connexion en cours' : 'Supervision connectée'}</strong><span>{demo ? 'Scénario local · Tunis' : actualise ? `Dernière lecture à ${actualise}` : 'Lecture des positions GPS'}</span></div>
    {!demo && erreur && <div className="bandeau" role="alert">{erreur} {coursiers.length > 0 && 'Les dernières positions sont conservées.'} <button className="bouton-lien" onClick={() => void charger()}>Réessayer</button></div>}
    {relecture ? <RelectureSuivi /> : <section className="mission" aria-label="Supervision des livraisons">
      <CarteMission coursiers={coursiers} selection={selection} onSelection={setSelection} />
      <aside className="mission-flotte" aria-label="Liste des coursiers, alternative à la carte">
        <div className="mission-flotte-titre"><h2>Sur le terrain</h2><span className="mono">{String(coursiers.length).padStart(2, '0')}</span></div>
        {!demo && chargement && <p className="mission-etat" role="status">Chargement des coursiers…</p>}
        {!chargement && !coursiers.length && <div className="mission-etat"><strong>{erreur ? 'Positions indisponibles' : 'La flotte est au repos'}</strong><p>{erreur ? 'Réessayez ou explorez le scénario de démonstration.' : 'Les coursiers disponibles apparaîtront dès leur premier envoi GPS.'}</p><button className="bouton secondaire" onClick={changerDemo}>Explorer la démonstration</button></div>}
        <ul>{coursiers.map(c => { const km = c.commande ? distanceKm(c.position, c.commande.destination) : null;
          const ancien = !c.date || Date.now() - Date.parse(c.date) > 60000;
          return <li key={c.id}><button type="button" className="mission-coursier" aria-pressed={c.id === selection} onClick={() => setSelection(c.id)}>
            <span className="mission-initiales" aria-hidden="true">{c.nom.split(' ').map(n => n[0]).slice(0, 2).join('')}</span>
            <span><strong>{c.nom}</strong><small>{ancien ? 'Position ancienne' : c.commande ? STATUTS[c.commande.statut].libelle : 'Disponible · mission non identifiée'}</small><span className="mono">{c.commande?.code ?? 'Sans commande associée'}</span></span>
            <span className="mission-eta">{km === null ? '—' : `≈ ${Math.max(1, Math.ceil(km / 20 * 60))}`}<small>{km === null ? 'ETA inconnue' : 'min'}</small></span>
          </button></li>;
        })}</ul>
        <p className="mission-note">{demo ? 'Positions simulées, sans modification des commandes.' : 'Lecture toutes les 3 s. Seuls les coursiers disponibles avec un GPS connu sont exposés.'}{incomplet > 0 && !demo ? ` ${incomplet} coursier(s) sans position.` : ''}</p>
      </aside>
      {choisi && <aside className="mission-commande" aria-label="Livraison sélectionnée">
        <div className="mission-commande-titre"><span className="mission-surtitre">{commande ? 'Livraison sélectionnée' : 'Coursier sélectionné'}</span><span className="mono">{commande?.code ?? `N° ${choisi.id}`}</span></div>
        <h2>{commande?.zone ?? choisi.nom}</h2>
        <p className="mission-note">{commande ? `${choisi.nom} · ${STATUTS[commande.statut].libelle}` : 'Aucune commande associée avec certitude.'}</p>
        {commande && <><div className="mission-mesures"><div><strong>≈ {eta}<small> min</small></strong><span>Arrivée estimée</span></div><div><strong>{distance?.toLocaleString('fr-FR', { maximumFractionDigits: 1 })}<small> km</small></strong><span>À vol d’oiseau</span></div></div>
          <ol className="mission-etapes" aria-label="Étapes de livraison"><li data-actif="true">Affectée</li><li data-actif={commande.statut !== 'AFFECTEE'}>Collectée</li><li data-actif={['A_PROXIMITE', 'ARRIVEE'].includes(commande.statut)}>À proximité</li><li>Livrée</li></ol>
          <p className="mission-note">Direction indicative, sans guidage routier. ETA locale à 20 km/h, hors circulation.</p>
          {!demo && <Link to={`/commandes?id=${commande.id}`}>Détail de la commande →</Link>}</>}
        <p className="mission-note">GPS : {choisi.position[1].toFixed(5)}, {choisi.position[0].toFixed(5)} · {choisi.date ? new Date(choisi.date).toLocaleTimeString('fr-FR') : 'date inconnue'}</p>
      </aside>}
    </section>}
    <p className="mission-bas">Tunis · {demo ? 'Scénario de présentation' : 'Positions connues du responsable'}<span>Les estimations restent indicatives.</span></p>
  </>;
}
