import { useMemo, useState } from 'react';
import { api } from '../api';
import { jourTunis } from '../../../mobile/packages/shared/src/bi';
import { pointValide, type CoursierCarte, type PointCarte } from '../suivi';
import CarteMission from './CarteMission';

type Trace = Awaited<ReturnType<typeof api.tracesJour>>['traces'][number];
const heure = (temps: number) => new Date(temps).toLocaleTimeString('fr-FR', { timeZone: 'Africa/Tunis' });
export default function RelectureSuivi() {
  const [jour, setJour] = useState(jourTunis()), [traces, setTraces] = useState<Trace[] | null>(null);
  const [noms, setNoms] = useState<Map<number, string>>(new Map());
  const [instant, setInstant] = useState(0), [selection, setSelection] = useState<number>();
  const [chargement, setChargement] = useState(false), [erreur, setErreur] = useState('');
  async function charger() {
    setChargement(true); setErreur(''); setTraces(null);
    try {
      const depuis = new Date(`${jour}T00:00:00+01:00`).toISOString();
      const [exporte, livreurs] = await Promise.all([api.tracesJour(depuis), api.livreurs()]);
      const fin = Date.parse(depuis) + 86400000;
      const points = exporte.traces.filter(p => pointValide(p.longitude, p.latitude) && Date.parse(p.date) >= Date.parse(depuis) && Date.parse(p.date) < fin).sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
      setTraces(points); setNoms(new Map(livreurs.map(l => [l.id, `${l.prenom} ${l.nom}`]))); setInstant(points.length ? Date.parse(points[0].date) : 0); setSelection(points[0]?.livreurId);
    } catch (e) { setErreur(e instanceof Error ? e.message : 'Historique indisponible. Réessayez.'); }
    finally { setChargement(false); }
  }
  const groupes = useMemo(() => {
    const groupes = new Map<number, Trace[]>();
    traces?.forEach(t => { const points = groupes.get(t.livreurId) ?? []; points.push(t); groupes.set(t.livreurId, points); });
    return groupes;
  }, [traces]);
  const coursiers = useMemo<CoursierCarte[]>(() => Array.from(groupes).flatMap(([id, points]) => {
    const precedents = points.filter(p => Date.parse(p.date) <= instant), avant = precedents.at(-1);
    if (!avant) return [];
    const apres = points[precedents.length]; let position: PointCarte = [avant.longitude, avant.latitude];
    if (apres) { const t = (instant - Date.parse(avant.date)) / (Date.parse(apres.date) - Date.parse(avant.date)); position = [avant.longitude + (apres.longitude - avant.longitude) * t, avant.latitude + (apres.latitude - avant.latitude) * t]; }
    return [{ id, nom: noms.get(id) ?? `Coursier n° ${id}`, position, date: avant.date, historique: precedents.map(p => [p.longitude, p.latitude]) }];
  }), [groupes, instant, noms]);
  const debut = traces?.length ? Date.parse(traces[0].date) : 0, fin = traces?.length ? Date.parse(traces[traces.length - 1].date) : 0;
  return <section className="relecture" aria-label="Relecture des positions enregistrées">
    <form className="actions" onSubmit={e => { e.preventDefault(); void charger(); }}>
      <label className="champ">Journée à revoir (heure de Tunis)<input type="date" required max={jourTunis()} value={jour} disabled={chargement} onChange={e => { setJour(e.target.value); setTraces(null); setErreur(''); }} /></label>
      <button className="bouton secondaire" disabled={chargement}>{chargement ? 'Chargement des traces…' : 'Charger la journée'}</button>
    </form>
    {erreur && <p className="bandeau" role="alert">{erreur}</p>}
    {traces?.length === 0 && <p className="etat" role="status">Aucune position enregistrée ce jour. Choisissez une autre journée.</p>}
    {traces === null && !chargement && !erreur && <p className="discret">Choisissez une journée pour revoir les positions GPS enregistrées.</p>}
    {!!traces?.length && <>
      <label className="champ relecture-curseur">Heure de relecture · {heure(instant)}<input type="range" min={debut} max={Math.max(debut + 1, fin)} step="1000" value={instant} onChange={e => setInstant(Number(e.target.value))} aria-valuetext={heure(instant)} /></label>
      <div className="mission mission-lots"><CarteMission coursiers={coursiers} selection={selection} onSelection={setSelection} /></div>
      <ul className="relecture-coursiers">{coursiers.map(c => <li key={c.id}><button className="bouton secondaire" aria-pressed={selection === c.id} onClick={() => setSelection(c.id)}>{c.nom} · {c.position[1].toFixed(5)}, {c.position[0].toFixed(5)}</button></li>)}</ul>
      <p className="discret">{traces.length} points · {heure(debut)} à {heure(fin)}. Export limité par le serveur à 5 000 points. Positions interpolées entre deux mesures ; les statuts historiques des commandes ne sont pas reconstitués.</p>
    </>}
  </section>;
}
