import { useState } from 'react';
import { CarteVille3D } from '../composants/CarteVille3D';
import { api, type ResultatSimulation } from '../api';
import { Alerte, EnTete } from '../composants/ui';
import { quartierApi, type ComparaisonQuartier } from '../quartierApi';

/** Une commande par ligne : id;zoneId;commerceLat;commerceLng;clientLat;clientLng */
function commandesDepuisTexte(texte: string) {
  return texte.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
    const v = l.split(';').map(x => Number(x.trim().replace(',', '.')));
    if (v.length !== 6 || v.some(x => !Number.isFinite(x))) throw new Error('Ligne invalide : ' + l);
    const [id, zoneId, cLat, cLng, clLat, clLng] = v;
    return { id, zoneId, commerce: { latitude: cLat, longitude: cLng }, client: { latitude: clLat, longitude: clLng } };
  });
}

export default function Simulateur() {
  const [departLat, setDepartLat] = useState('36.8065'), [departLng, setDepartLng] = useState('10.1815');
  const [vitesse, setVitesse] = useState('20');
  const [texte, setTexte] = useState('');
  const [resultat, setResultat] = useState<ResultatSimulation | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [echec, setEchec] = useState<string | null>(null);
  const [adhesion, setAdhesion] = useState('0.25');
  const [quartier, setQuartier] = useState<ComparaisonQuartier | null>(null);

  async function simuler() {
    setEnvoi(true); setEchec(null);
    try {
      const commandes = commandesDepuisTexte(texte);
      if (!commandes.length) throw new Error('Saisissez au moins une commande.');
      setResultat(await api.simulerLots({
        depart: { latitude: Number(departLat), longitude: Number(departLng) },
        vitesseKmh: Number(vitesse),
        commandes,
        voisines: {},
      }));
      const commerces = new Map<string, number>();
      setQuartier(await quartierApi.simuler({ depart: { latitude: Number(departLat), longitude: Number(departLng) }, vitesseKmh: Number(vitesse),
        tauxAdhesion: Number(adhesion), fenetreSecondes: 480, rayonMetres: 400,
        commandes: commandes.map((c, i) => {
          const cle = `${c.zoneId}:${c.commerce.latitude}:${c.commerce.longitude}`;
          if (!commerces.has(cle)) commerces.set(cle, commerces.size + 1);
          return { ...c, commerceId: commerces.get(cle), creationSecondes: i * 90, preparationSecondes: 900, promesseSecondes: i * 90 + 3600, frais: 3 };
        }) }));
    } catch (e) { setEchec((e as Error).message); setResultat(null); setQuartier(null); } finally { setEnvoi(false); }
  }

  return (
    <>
      <EnTete titre="Simulateur de lots" sousTitre="Compare le dispatch unitaire et le regroupement, sur des commandes données. Aucune commande réelle n'est modifiée." />
      <div className="sim">
      <div className="carte">
        <form className="formulaire" onSubmit={e => { e.preventDefault(); void simuler(); }}>
          {echec && <Alerte message={echec} />}
          <div className="grille-2">
            <label className="champ">Départ, latitude<input value={departLat} disabled={envoi} onChange={e => setDepartLat(e.target.value)} /></label>
            <label className="champ">Départ, longitude<input value={departLng} disabled={envoi} onChange={e => setDepartLng(e.target.value)} /></label>
          </div>
          <label className="champ">Vitesse moyenne (km/h)<input type="number" min="5" max="80" value={vitesse} disabled={envoi} onChange={e => setVitesse(e.target.value)} /></label>
          <label className="champ">Adhésion aux invitations<select value={adhesion} disabled={envoi} onChange={e => setAdhesion(e.target.value)}><option value="0.1">10 %</option><option value="0.25">25 %</option><option value="0.4">40 %</option></select></label>
          <label className="champ">Une commande par ligne : id;zoneId;commerceLat;commerceLng;clientLat;clientLng
            <textarea rows={6} value={texte} disabled={envoi} placeholder={'1;1;36.801;10.181;36.805;10.185'} onChange={e => setTexte(e.target.value)} />
          </label>
          <p className="discret">Comparaison quartier : mêmes demandes espacées de 90 s, préparation 15 min, promesse 60 min, frais 3 DT. Les coordonnées identiques désignent le même commerce. Les adhérents commandent plus tôt après invitation.</p>
          <button className="bouton secondaire" type="button" disabled={envoi} onClick={() => { setDepartLat('36.80'); setDepartLng('10.18'); setVitesse('20'); setTexte(Array.from({ length: 60 }, (_, i) => `${i + 1};1;36.80;10.18;${(36.82 + (i % 3) * .0003).toFixed(4)};${(10.18 + (i % 5) * .0002).toFixed(4)}`).join('\n')); }}>Charger 60 demandes de quartier</button>
          <div className="pied-modale"><button className="bouton" disabled={envoi}>{envoi ? 'Calcul…' : 'Simuler'}</button></div>
        </form>
      </div>
      <aside className="sim-scene">
        <CarteVille3D />
        <div className="sim-texte">
          <small>Regroupement</small>
          <strong className={resultat?.recommandee ? undefined : 'sim-attente'}>{resultat?.recommandee ? `−${resultat.recommandee.economieMinPct} %` : resultat ? 'Aucun gain' : 'En attente'}</strong>
          <p>{resultat ? (resultat.recommandee ? `de minutes avec un rayon de ${resultat.recommandee.rayonKm} km et une fenêtre de ${resultat.recommandee.fenetreMin} min` : 'aucun gain sur ces commandes') : 'Lancez une simulation pour voir le gain des tournées groupées.'}</p>
        </div>
      </aside>
      </div>
      {quartier && <div className="carte" style={{ overflowX: 'auto', marginBottom: 20 }}><h2>Comparaison à demandes constantes · adhésion {quartier.tauxAdhesion * 100} %</h2>
        <table><thead><tr><th>Scénario</th><th>Km</th><th>Coût/commande</th><th>Commandes/coursier/h</th><th>À l’heure</th><th>Frais client moyens</th></tr></thead>
          <tbody>{quartier.scenarios.map(s => <tr key={s.mode}><td>{{ SANS_LOTS: 'Sans lots', LOTS: 'Lots actuels', LOTS_QUARTIER: 'Lots + quartier' }[s.mode] ?? s.mode}</td>
            <td>{s.kmTotaux.toFixed(2)}</td><td>{s.coutParCommande.toFixed(3)} DT</td><td>{s.commandesParCoursierHeure.toFixed(2)}</td><td>{s.aHeurePct.toFixed(1)} %</td><td>{s.fraisMoyenClient.toFixed(3)} DT</td></tr>)}</tbody></table>
        <p className="discret">Estimation : rémunération individuelle 3 DT + 0,5 DT/km conservée, plus coût variable de trajet 0,5 DT/km. Productivité mesurée pendant les tournées ; hypothèse de coursiers disponibles, sans trafic réel.</p>
      </div>}
      {resultat && <>
        <div className="bi-grille">
          <article className="bi-indicateur"><h2>Dispatch unitaire</h2><strong>{resultat.unitaire.tournees} tournées</strong><p>{resultat.unitaire.km} km · {resultat.unitaire.minutes} min</p></article>
          <article className="bi-indicateur"><h2>Recommandation</h2>
            {resultat.recommandee
              ? <><strong>rayon {resultat.recommandee.rayonKm} km · {resultat.recommandee.fenetreMin} min</strong><p>{resultat.recommandee.economieMinPct} % de minutes économisées</p></>
              : <><strong>Aucune</strong><p>Le regroupement n'apporte pas de gain sur ces commandes.</p></>}
          </article>
        </div>
        <div className="carte">
          <h2>Grille des lots à préparation simultanée</h2>
          <p className="discret">Cette grille suppose tous les colis déjà prêts. La comparaison quartier ci-dessus tient aussi compte de leur arrivée dans le temps.</p>
          <table>
            <thead><tr><th>Rayon</th><th>Fenêtre</th><th>Tournées</th><th>Km</th><th>Minutes</th><th>Gain km</th><th>Gain minutes</th></tr></thead>
            <tbody>{resultat.combinaisons.map(c => <tr key={c.rayonKm + '-' + c.fenetreMin} className={resultat.recommandee && c.rayonKm === resultat.recommandee.rayonKm && c.fenetreMin === resultat.recommandee.fenetreMin ? 'ligne-recommandee' : ''}>
              <td>{c.rayonKm} km</td><td>{c.fenetreMin} min</td><td>{c.lots.tournees}</td><td>{c.lots.km}</td><td>{c.lots.minutes}</td>
              <td>{c.economieKmPct} %</td><td>{c.economieMinPct} %</td>
            </tr>)}</tbody>
          </table>
        </div>
      </>}
    </>
  );
}
