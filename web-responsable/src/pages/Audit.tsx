import { useCallback, useState, type FormEvent } from 'react';
import { api, type Audit as Entree } from '../api';
import { Champ, EnTete, EtatTableau, Modale, useDonnees } from '../composants/ui';
const ACTIONS = ['INSCRIPTION_CLIENT', 'INSCRIPTION_PARTENAIRE', 'CANDIDATURE_LIVREUR', 'DOSSIER_RESOUMIS',
  'COMPTE_VALIDE', 'COMPTE_REFUSE', 'COMPLEMENT_DEMANDE', 'COMPTE_SUSPENDU', 'COMPTE_REACTIVE',
  'RESPONSABLE_CREE', 'LIVREUR_CREE', 'LIVREUR_MODIFIE', 'VEHICULE_CREE', 'VEHICULE_MODIFIE',
  'VEHICULE_ACTIVE', 'VEHICULE_DESACTIVE', 'VEHICULE_AFFECTE', 'VEHICULE_RETIRE', 'MOT_DE_PASSE_REINITIALISE',
  'ZONE_CREEE', 'ZONE_MODIFIEE', 'ZONE_SUPPRIMEE', 'FRAIS_ZONE_MODIFIES',
  'ZONE_LIVREUR_AFFECTEE', 'ZONE_LIVREUR_RETIREE'];
export default function Audit() {
  const [filtres, setFiltres] = useState({ acteur: '', action: '', debut: '', fin: '' });
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [selection, setSelection] = useState<Entree | null>(null);
  const charger = useCallback(() => api.audit(query + '&page=' + page), [query, page]);
  const { donnees, chargement, erreur, recharger } = useDonnees(charger);
  function filtrer(e: FormEvent) {
    e.preventDefault(); const q = new URLSearchParams();
    if (filtres.acteur.trim()) q.set('acteur', filtres.acteur.trim());
    if (filtres.action) q.set('action', filtres.action);
    // Dates interprétées dans le fuseau du navigateur ; borne de fin exclusive.
    if (filtres.debut) q.set('debut', new Date(filtres.debut + 'T00:00:00').toISOString());
    if (filtres.fin) { const fin = new Date(filtres.fin + 'T00:00:00'); fin.setDate(fin.getDate() + 1); q.set('fin', fin.toISOString()); }
    setQuery(q.toString()); setPage(0);
  }
  return <>
    <EnTete titre="Journal d’audit" sousTitre="Historique des actions sensibles sur les comptes et dossiers." />
    <form className="filtres" onSubmit={filtrer}>
      <Champ libelle="Acteur (email exact)"><input value={filtres.acteur} onChange={e => setFiltres({ ...filtres, acteur: e.target.value })} /></Champ>
      <Champ libelle="Action"><select value={filtres.action} onChange={e => setFiltres({ ...filtres, action: e.target.value })}>
        <option value="">Toutes les actions</option>{ACTIONS.map(a => <option key={a} value={a}>{a.replaceAll('_', ' ')}</option>)}
      </select></Champ>
      <Champ libelle="Du"><input type="date" value={filtres.debut} max={filtres.fin || undefined} onChange={e => setFiltres({ ...filtres, debut: e.target.value })} /></Champ>
      <Champ libelle="Au (inclus)"><input type="date" value={filtres.fin} min={filtres.debut || undefined} onChange={e => setFiltres({ ...filtres, fin: e.target.value })} /></Champ>
      <button className="bouton plein" disabled={chargement}>Filtrer</button>
      <button type="button" className="bouton secondaire" onClick={() => void recharger()} disabled={chargement}>Actualiser</button>
    </form>
    <EtatTableau chargement={chargement} erreur={erreur} vide={!donnees?.content.length} messageVide="Aucune entrée pour ces filtres." onReessayer={() => void recharger()} />
    {!chargement && !erreur && !!donnees?.content.length && <div className="tableau"><table>
      <thead><tr><th>Date</th><th>Acteur</th><th>Action</th><th>Cible</th><th>Détail</th></tr></thead>
      <tbody>{donnees.content.map(j => <tr key={j.id}><td>{new Date(j.date).toLocaleString('fr')}</td><td>{j.acteur}</td>
        <td>{j.action.replaceAll('_', ' ')}</td><td>{j.cibleType} #{j.cibleId}</td>
        <td><button className="bouton-lien" onClick={() => setSelection(j)} aria-label={'Détail de l’entrée ' + j.id}>Consulter</button></td></tr>)}</tbody>
    </table></div>}
    {donnees && !erreur && <div className="pagination" aria-label="Pagination du journal">
      <button className="bouton secondaire" disabled={page === 0 || chargement} onClick={() => setPage(p => p - 1)}>Précédent</button>
      <span role="status">Page {donnees.totalPages ? page + 1 : 0} / {donnees.totalPages} — {donnees.totalElements} entrées</span>
      <button className="bouton secondaire" disabled={page + 1 >= donnees.totalPages || chargement} onClick={() => setPage(p => p + 1)}>Suivant</button>
    </div>}
    {selection && <Modale titre={'Entrée d’audit #' + selection.id} onFermer={() => setSelection(null)}>
      <dl className="detail-dossier">{Object.entries(selection).map(([k, v]) => <div key={k}><dt>{{ id: 'Identifiant', date: 'Date', acteur: 'Acteur', action: 'Action', cibleType: 'Type de cible', cibleId: 'Identifiant cible', details: 'Détails' }[k]}</dt><dd>{v === null ? 'Aucun détail' : k === 'date' ? new Date(String(v)).toLocaleString('fr') : String(v)}</dd></div>)}</dl>
    </Modale>}
  </>;
}
