import { useCallback, useEffect, useState } from 'react';
import { quartierApi, type GroupeQuartierAdmin, type StatsQuartier, type CommerceQuartier, type ReglagesQuartier } from '../quartierApi';
import { Alerte, EnTete } from '../composants/ui';
import { CarteQuartier } from '../composants/CarteQuartier';

export default function Quartier() {
  const [groupes, setGroupes] = useState<GroupeQuartierAdmin[]>([]), [stats, setStats] = useState<StatsQuartier | null>(null);
  const [commerces, setCommerces] = useState<CommerceQuartier[]>([]), [reglages, setReglages] = useState<ReglagesQuartier | null>(null);
  const [erreur, setErreur] = useState<string | null>(null), [envoi, setEnvoi] = useState(false), [maintenant, setMaintenant] = useState(() => Date.now());
  const charger = useCallback(async () => {
    try { const [g, s, c] = await Promise.all([quartierApi.groupes(), quartierApi.statistiques(), quartierApi.commerces()]); setGroupes(g); setStats(s); setCommerces(c); setErreur(null); }
    catch (e) { setErreur((e as Error).message); }
  }, []);
  useEffect(() => {
    void charger(); quartierApi.parametres().then(setReglages).catch(e => setErreur(e.message));
    const temps = setInterval(() => setMaintenant(Date.now()), 1000), donnees = setInterval(() => void charger(), 5000);
    return () => { clearInterval(temps); clearInterval(donnees); };
  }, [charger]);
  return <>
    <EnTete titre="Livraison de quartier" sousTitre="Inviter les voisins, remplir une tournée et réduire les frais. Actualisation toutes les 5 secondes." />
    {erreur && <Alerte message={erreur} />}
    <button className="bouton secondaire" onClick={() => void charger()}>Actualiser</button>
    {stats && <div className="bi-grille">
      <article className="bi-indicateur"><h2>Groupes</h2><strong>{stats.ouverts} ouverts</strong><p>{stats.fermes} fermés · {stats.annules} annulés</p></article>
      <article className="bi-indicateur"><h2>Remplissage à la fermeture</h2><strong>{stats.tauxRemplissage.toFixed(1)} %</strong><p>3 commandes par groupe au maximum</p></article>
      <article className="bi-indicateur"><h2>Économies estimées</h2><strong>{stats.kmEconomises.toFixed(2)} km</strong><p>{stats.dtEconomises.toFixed(3)} DT de trajet</p></article>
    </div>}
    <div className="carte"><CarteQuartier groupes={groupes} /><p className="discret">Le centre correspond à la première adresse : cette carte est réservée aux responsables.</p></div>
    <div className="carte" style={{ overflowX: 'auto' }}><h2>Groupes en direct</h2>
      <table><thead><tr><th>Groupe</th><th>Commerce</th><th>Statut</th><th>Membres</th><th>Temps restant</th><th>Lot</th><th>Économies</th></tr></thead>
        <tbody>{groupes.map(g => { const secondes = Math.max(0, Math.ceil((Date.parse(g.expiration) - maintenant) / 1000)); return <tr key={g.id}>
          <td>#{g.id}</td><td>{g.commerce}</td><td>{g.statut}</td><td>{g.nbMembres}/3</td>
          <td>{g.statut === 'OUVERT' ? `${Math.floor(secondes / 60)}:${String(secondes % 60).padStart(2, '0')}` : 'Fermé'}</td>
          <td>{g.lotId ? `#${g.lotId}` : '—'}</td><td>{g.gainKm.toFixed(2)} km · {g.gainDt.toFixed(3)} DT</td>
        </tr>; })}</tbody></table>{!groupes.length && <p>Aucun groupe pour le moment.</p>}
    </div>
    <div className="carte"><h2>Activation par commerce</h2>{commerces.map(c => <label key={c.id} style={{ display: 'flex', gap: 12, padding: 10 }}>
      <input type="checkbox" checked={c.groupesQuartierActifs} disabled={envoi} onChange={e => { setEnvoi(true); quartierApi.activer(c.id, e.target.checked).then(() => charger()).catch(e => setErreur(e.message)).finally(() => setEnvoi(false)); }} />{c.nomCommerce}
    </label>)}</div>
    {reglages && <form className="carte formulaire" onSubmit={e => { e.preventDefault(); setEnvoi(true); quartierApi.modifier(reglages).then(setReglages).catch(e => setErreur(e.message)).finally(() => setEnvoi(false)); }}>
      <h2>Paramètres des prochains groupes</h2>
      <div className="grille-2">{([
        ['rayonMetres', 'Rayon (m)', 10, 2000, 1], ['fenetreSecondes', 'Fenêtre (s)', 1, 900, 1],
        ['preparationMinutes', 'Préparation estimée (min)', 0, 120, 1], ['promesseMinutes', 'Promesse initiale (min)', 1, 240, 1],
        ['reductionDeux', 'Réduction à deux (0 à 1)', 0, 1, .01], ['reductionTrois', 'Réduction à trois, hors dernier (0 à 1)', 0, 1, .01],
        ['coutKm', 'Économie de trajet (DT/km)', 0, 100, .001],
      ] as const).map(([cle, libelle, min, max, step]) => <label className="champ" key={cle}>{libelle}<input type="number" required min={min} max={max} step={step} value={reglages[cle]} onChange={e => setReglages({ ...reglages, [cle]: Number(e.target.value) })} /></label>)}</div>
      <button className="bouton" disabled={envoi}>Enregistrer les paramètres</button>
    </form>}
  </>;
}
