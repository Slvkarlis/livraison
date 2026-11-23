import { useState } from 'react';
import { api, type ResultatSimulation } from '../api';
import { Alerte, EnTete } from '../composants/ui';

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
    } catch (e) { setEchec((e as Error).message); setResultat(null); } finally { setEnvoi(false); }
  }

  return (
    <>
      <EnTete titre="Simulateur de lots" sousTitre="Compare le dispatch unitaire et le regroupement, sur des commandes données. Aucune commande réelle n'est modifiée." />
      <div className="carte">
        <form className="formulaire" onSubmit={e => { e.preventDefault(); void simuler(); }}>
          {echec && <Alerte message={echec} />}
          <div className="grille-2">
            <label className="champ">Départ, latitude<input value={departLat} disabled={envoi} onChange={e => setDepartLat(e.target.value)} /></label>
            <label className="champ">Départ, longitude<input value={departLng} disabled={envoi} onChange={e => setDepartLng(e.target.value)} /></label>
          </div>
          <label className="champ">Vitesse moyenne (km/h)<input type="number" min="5" max="80" value={vitesse} disabled={envoi} onChange={e => setVitesse(e.target.value)} /></label>
          <label className="champ">Une commande par ligne : id;zoneId;commerceLat;commerceLng;clientLat;clientLng
            <textarea rows={6} value={texte} disabled={envoi} placeholder={'1;1;36.801;10.181;36.805;10.185'} onChange={e => setTexte(e.target.value)} />
          </label>
          <div className="pied-modale"><button className="bouton" disabled={envoi}>{envoi ? 'Calcul…' : 'Simuler'}</button></div>
        </form>
      </div>
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
          <h2>Toutes les combinaisons</h2>
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
