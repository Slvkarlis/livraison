import { useState, type FormEvent } from 'react';
import { api } from '../api';
import { Alerte, Champ, EnTete, EtatTableau, Modale, useDonnees } from '../composants/ui';
import { useSession } from '../session';
import { ROLES_COMPTE, STATUTS_COMPTE, verifierMotif, type Compte, type RoleCompte, type StatutCompte } from '../sprint1';

const ACTIONS: Record<string, string> = { valider: 'Valider le dossier', refuser: 'Refuser le dossier',
  complement: 'Demander un complément', suspendre: 'Suspendre le compte', reactiver: 'Réactiver le compte' };
export default function Comptes({ dossiers = false }: { dossiers?: boolean }) {
  const { profil } = useSession();
  const { donnees, erreur, chargement, recharger } = useDonnees(api.comptes);
  const [recherche, setRecherche] = useState('');
  const [role, setRole] = useState('');
  const [statut, setStatut] = useState(dossiers ? 'EN_ATTENTE' : '');
  const [selection, setSelection] = useState<Compte | null>(null);
  const [action, setAction] = useState('');
  const [motif, setMotif] = useState('');
  const [erreurAction, setErreurAction] = useState<string | null>(null);
  const [succes, setSucces] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const lignes = (donnees ?? []).filter(c => (!dossiers || c.role === 'PARTENAIRE' || c.role === 'LIVREUR') &&
    (!role || c.role === role) && (!statut || c.statut === statut) &&
    [c.nom, c.prenom, c.email, c.telephone, c.nomCommerce, String(c.id)].join(' ').toLocaleLowerCase('fr').includes(recherche.toLocaleLowerCase('fr')));
  function choisir(c: Compte) { setSelection(c); setAction(''); setMotif(''); setErreurAction(null); }
  async function confirmer(e: FormEvent) {
    e.preventDefault();
    if (!selection || envoi) return;
    const invalide = action !== 'valider' ? verifierMotif(motif) : null;
    if (invalide) { setErreurAction(invalide); return; }
    setEnvoi(true); setErreurAction(null); setSucces('');
    try {
      const resultat = dossiers ? await api.decision(selection.id, action, motif.trim()) : await api.statutCompte(selection.id, action, motif.trim());
      setSelection(resultat); setAction(''); setMotif('');
      setSucces('Action enregistrée : ' + STATUTS_COMPTE[resultat.statut] + '.');
      await recharger();
    } catch (err) { setErreurAction((err as Error).message); }
    finally { setEnvoi(false); }
  }
  const ouvert = selection?.statut === 'EN_ATTENTE' || selection?.statut === 'COMPLEMENT_DEMANDE';
  const peutModifier = selection && selection.id !== profil?.id &&
    (selection.role !== 'RESPONSABLE' || profil?.sousRole === null);
  const champsDetail: [string, unknown][] = selection ? [
    ['Nom', selection.prenom + ' ' + selection.nom], ['Email', selection.email], ['Téléphone', selection.telephone],
    ['Rôle', ROLES_COMPTE[selection.role]], ['Sous-rôle', selection.sousRole], ['Statut', STATUTS_COMPTE[selection.statut]],
    ['Message du responsable', selection.motifStatut], ['Création', new Date(selection.dateCreation).toLocaleString('fr')],
    ...(selection.role === 'PARTENAIRE' ? [['Commerce', selection.nomCommerce], ['Catégorie', selection.categorie],
      ['Adresse', selection.adresse], ['Latitude', selection.latitude], ['Longitude', selection.longitude], ['Matricule fiscal', selection.matriculeFiscal]] as [string, unknown][] : []),
    ...(selection.role === 'LIVREUR' ? [['Pièce d’identité', selection.numeroIdentite], ['Véhicule déclaré', selection.vehiculeDeclare]] as [string, unknown][] : []),
  ] : [];
  return <>
    <EnTete titre={dossiers ? 'Dossiers de candidature' : 'Gestion des comptes'} sousTitre={dossiers ? 'Examinez les candidatures des partenaires et coursiers.' : 'Consultez les comptes, suspendez ou réactivez leur accès.'} />
    {succes && <p className="succes" role="status">{succes}</p>}
    <div className="filtres">
      <Champ libelle="Rechercher"><input type="search" value={recherche} onChange={e => setRecherche(e.target.value)} placeholder="Nom, email, téléphone, commerce…" /></Champ>
      <Champ libelle={dossiers ? 'Type de dossier' : 'Rôle'}><select value={role} onChange={e => setRole(e.target.value)}>
        <option value="">Tous</option>{Object.entries(ROLES_COMPTE).filter(([r]) => !dossiers || r === 'PARTENAIRE' || r === 'LIVREUR')
          .map(([r, label]) => <option key={r} value={r}>{label}</option>)}
      </select></Champ>
      <Champ libelle="Statut"><select value={statut} onChange={e => setStatut(e.target.value)}>
        <option value="">Tous</option>{Object.entries(STATUTS_COMPTE).map(([s, label]) => <option key={s} value={s}>{label}</option>)}
      </select></Champ>
      <button className="bouton secondaire" onClick={() => void recharger()} disabled={chargement}>Actualiser</button>
    </div>
    <EtatTableau chargement={chargement} erreur={erreur} vide={!lignes.length} messageVide="Aucun compte ne correspond à ces filtres." onReessayer={() => void recharger()} />
    {!chargement && !erreur && lignes.length > 0 && <div className="tableau"><table>
      <thead><tr><th>Nom / commerce</th><th>Rôle</th><th>Contact</th><th>Statut</th><th>Action</th></tr></thead>
      <tbody>{lignes.map(c => <tr key={c.id}><td>{c.prenom} {c.nom}{c.nomCommerce && <div className="discret">{c.nomCommerce}</div>}</td>
        <td>{ROLES_COMPTE[c.role as RoleCompte]}</td><td>{c.email}<div className="discret">{c.telephone}</div></td>
        <td><span className={'statut statut-' + c.statut}>{STATUTS_COMPTE[c.statut as StatutCompte]}</span></td>
        <td><button className="bouton-lien" onClick={() => choisir(c)} aria-label={'Détail du compte de ' + c.prenom + ' ' + c.nom}>Voir le détail</button></td></tr>)}</tbody>
    </table></div>}
    {selection && <Modale titre={dossiers ? 'Détail du dossier' : 'Détail du compte'} onFermer={() => { if (!envoi) setSelection(null); }}>
      <dl className="detail-dossier">{champsDetail.filter(([, v]) => v !== null && v !== undefined).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{String(v)}</dd></div>)}</dl>
      {erreurAction && <Alerte message={erreurAction} />}
      {action ? <form onSubmit={confirmer} className="confirmation">
        <h3>{ACTIONS[action]} ?</h3>
        <p>Cette action sera appliquée au compte de {selection.prenom} {selection.nom} et inscrite au journal d’audit.</p>
        {action !== 'valider' && <Champ libelle={action === 'complement' ? 'Message au candidat (obligatoire)' : 'Motif (obligatoire)'}>
          <textarea required maxLength={500} rows={4} value={motif} onChange={e => setMotif(e.target.value)} disabled={envoi} autoFocus />
        </Champ>}
        <div className="actions"><button className="bouton secondaire" type="button" disabled={envoi} onClick={() => setAction('')}>Annuler</button>
          <button className="bouton plein" type="submit" disabled={envoi}>{envoi ? 'Enregistrement…' : 'Confirmer'}</button></div>
      </form> : <div className="actions">
        {(dossiers ? (ouvert ? ['valider', 'refuser', ...(selection.statut === 'EN_ATTENTE' ? ['complement'] : [])] : []) :
          peutModifier ? selection.statut === 'ACTIF' ? ['suspendre'] : selection.statut === 'SUSPENDU' ? ['reactiver'] : [] : [])
          .map(a => <button className="bouton secondaire" key={a} onClick={() => { setAction(a); setErreurAction(null); }}>{ACTIONS[a]}</button>)}
      </div>}
    </Modale>}
  </>;
}
