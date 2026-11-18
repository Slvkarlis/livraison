import { useCallback, useEffect, useState } from 'react';
import { http } from '../api';
import { useDonnees } from './ui';
import { valeurBi } from '../../../mobile/packages/shared/src/bi';

interface Seuil { type: string; libelle: string; unite: string; valeur: number; maximum: number; actif: boolean }
interface Alerte { id: number; type: string; objet: string; valeur: number; seuil: number; unite: string; declencheeLe: string; observeeLe: string }

export default function CockpitAlertes({ finance = false }: { finance?: boolean }) {
  const [succes, setSucces] = useState('');
  const chemin = finance ? '/api/admin/finance/bi' : '/api/admin/bi';
  const charger = useCallback(async () => {
    const [seuils, alertes] = await Promise.all([http.request<Seuil[]>('GET', chemin + '/seuils'), http.request<Alerte[]>('GET', chemin + '/alertes')]);
    return { seuils, alertes };
  }, [chemin]);
  const { donnees: d, erreur, chargement, recharger } = useDonnees(charger);
  useEffect(() => { const delai = window.setInterval(() => void recharger(), 30000); return () => window.clearInterval(delai); }, [recharger]);
  return <section className="carte" style={{ margin: '20px 0', padding: 20 }} aria-label="Cockpit des alertes">
    <h2>Alertes actives · {finance ? 'Finance' : 'Opérations'}</h2>
    <p className="bi-legende">État actuel, indépendant du filtre de dates. Actualisé toutes les 30 secondes. Une alerte reste unique tant que la condition persiste.</p>
    {chargement && !d && <p role="status">Chargement des alertes…</p>}
    {erreur && <p role="alert">{erreur} <button onClick={() => void recharger()}>Réessayer</button></p>}
    {succes && <p role="status">{succes}</p>}
    {d && <>
      {!d.alertes.length ? <p role="status">Aucune alerte active.</p> : <div className="bi-alertes" aria-label="Valeurs et seuils dépassés">
        {d.alertes.map(a => <article className="bi-alerte" key={a.id}>
          <small>{new Intl.DateTimeFormat('fr-FR', { timeZone: 'Africa/Tunis', dateStyle: 'short', timeStyle: 'short', hourCycle: 'h23' }).format(new Date(a.declencheeLe))} · Tunis</small>
          <strong>{d.seuils.find(s => s.type === a.type)?.libelle ?? a.type}</strong><span>{a.objet}</span>
          <p><strong>{valeurBi(a.valeur, ' ' + a.unite)}</strong> · seuil {a.type === 'COUVERTURE_ZONE' ? 'minimum ' : 'maximum '}{valeurBi(a.seuil, ' ' + a.unite)}</p>
        </article>)}
      </div>}
      <details><summary>Configurer les seuils d’alerte</summary><p className="bi-legende">Déclenchement strictement au-dessus du seuil ; couverture strictement en dessous du minimum. La désactivation résout les alertes de ce type. Chaque modification est inscrite au journal d’audit.</p>
        <div className="bi-grille">{d.seuils.map(s => <FormulaireSeuil key={`${s.type}-${s.valeur}-${s.actif}`} seuil={s} chemin={chemin} onSauve={() => { setSucces('Seuil enregistré ; alertes actualisées.'); void recharger(); }} />)}</div>
      </details>
    </>}
  </section>;
}

function FormulaireSeuil({ seuil, chemin, onSauve }: { seuil: Seuil; chemin: string; onSauve: () => void }) {
  const [valeur, setValeur] = useState(String(seuil.valeur)), [actif, setActif] = useState(seuil.actif);
  const [envoi, setEnvoi] = useState(false), [erreur, setErreur] = useState(''), [succes, setSucces] = useState('');
  return <form className="formulaire" onSubmit={async e => {
    e.preventDefault(); setEnvoi(true); setErreur(''); setSucces('');
    try { await http.request('PUT', `${chemin}/seuils/${seuil.type}`, { valeur: Number(valeur), actif }); setSucces('Seuil enregistré.'); onSauve(); }
    catch (e) { setErreur((e as Error).message); } finally { setEnvoi(false); }
  }}>
    <label className="champ">{seuil.libelle} ({seuil.unite})<input type="number" required min="0" max={seuil.maximum} step="0.001" value={valeur} disabled={envoi} onChange={e => setValeur(e.target.value)} /></label>
    <label><input type="checkbox" checked={actif} disabled={envoi} onChange={e => setActif(e.target.checked)} /> Activer ce seuil</label>
    <button className="bouton" disabled={envoi}>{envoi ? 'Enregistrement…' : 'Enregistrer le seuil'}</button>
    {erreur && <p role="alert">{erreur}</p>}{succes && <p role="status">{succes}</p>}
  </form>;
}
